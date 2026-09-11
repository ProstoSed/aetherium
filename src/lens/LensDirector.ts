import type { BodyId } from '../data/bodies';
import { addLens, dampLens, neutralLens, type LensParams } from './LensParams';
import type { FilmPeaks, PeakState } from './filmPeaks';

export type FilmIntensity = 'off' | 'soft' | 'strong';

export type LensInput = {
  intensity: FilmIntensity;
  /** Положение Солнца на экране (0…1, от верхнего левого угла) и радиус диска в долях высоты кадра. */
  sun: { x: number; y: number; onScreen: boolean; radiusFraction: number };
  /**
   * Насколько далеко от Солнца то, на что смотрят, в а. е. Именно точка обзора, а не камера:
   * общий план снимается издалека, но смотрит на Солнце и должен быть чистым.
   */
  viewedDistanceAu: number;
  /** Ближайшее тело, к которому подлетели, и насколько близко (0 — далеко, 1 — у поверхности). */
  nearBody: { id: BodyId; closeness: number } | null;
  flight: number;
  daysPerSecond: number;
  event: Partial<LensParams> | null;
  peak: PeakState;
};

const INTENSITY_GAIN: Record<FilmIntensity, number> = { off: 0, soft: 1, strong: 1.9 };
const RESPONSIVENESS_PER_SECOND = 3.2;

/** Дефекты плёнки масштабируются настройкой; оптика событий (линза, рябь) — нет, это часть сюжета. */
const FILM_DEFECTS: (keyof LensParams)[] = ['grain', 'scratches', 'dust', 'flicker', 'weave', 'tear', 'hotPixels', 'lightLeak', 'signalLoss', 'frost', 'heat', 'aberration', 'vignette', 'defocus', 'halation'];

type Incident = { until: number; lens: Partial<LensParams> };

const smoothstep = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

export class LensDirector {
  /** Итог кадра: сглаженное состояние плюс пики. */
  readonly params = neutralLens();
  /** Отдельно от итога: иначе пик засветки попадал бы в сглаживание и копился от кадра к кадру. */
  private readonly smoothed = neutralLens();
  private readonly goal = neutralLens();
  private incident: Incident | null = null;
  private nextIncidentAt = 8;
  private nextSignalDropAt = 120;

  constructor(private readonly peaks: FilmPeaks) {}

  update(input: LensInput, realSeconds: number, now: number): LensParams {
    const gain = INTENSITY_GAIN[input.intensity];
    const goal = this.goal;
    Object.assign(goal, neutralLens());

    if (gain > 0) {
      addLens(goal, { grain: 0.22, vignette: 0.42, weave: 0.1, flicker: 0.08, dust: 0.12, scratches: 0.06, halation: 0.45 });
      this.updateIncidents(goal, now, input.intensity);
    } else {
      addLens(goal, { vignette: 0.25, halation: 1 });
    }

    this.addSunProximity(goal, input);
    this.addDistance(goal, input.viewedDistanceAu, now);
    if (input.nearBody) this.addBodyProximity(goal, input.nearBody.id, input.nearBody.closeness);

    addLens(goal, { defocus: input.flight * 0.005, aberration: input.flight * 0.004, weave: input.flight * 0.7, flicker: input.flight * 0.15 });

    const fastForward = smoothstep(365, 365_250, input.daysPerSecond);
    addLens(goal, { flicker: fastForward * 0.45, scratches: fastForward * 0.55, weave: fastForward * 0.35, grain: fastForward * 0.15 });

    if (input.event) addLens(goal, input.event);

    for (const key of FILM_DEFECTS) goal[key] *= gain === 0 ? (key === 'vignette' ? 1 : 0.35) : gain;
    goal.defocus = Math.min(goal.defocus, 0.03);

    dampLens(this.smoothed, goal, realSeconds, RESPONSIVENESS_PER_SECOND);
    Object.assign(this.params, this.smoothed);
    this.applyPeaks(input.peak);
    return this.params;
  }

  /** Случайные мелкие сбои: царапины, пыль, «дыхание» фокуса, мигание. Время от времени — сбой сигнала на весь экран. */
  private updateIncidents(goal: LensParams, now: number, intensity: FilmIntensity) {
    const frequent = intensity === 'strong';
    if (!this.incident && now >= this.nextIncidentAt) {
      const incidents: Partial<LensParams>[] = [
        { scratches: 0.95, weave: 0.4 },
        { dust: 0.9 },
        { defocus: 0.0045 },
        { flicker: 0.9 },
        { tear: 0.25, aberration: 0.003 },
        { lightLeak: 0.45 },
      ];
      this.incident = { until: now + 0.8 + Math.random() * 1.4, lens: incidents[Math.floor(Math.random() * incidents.length)] };
      this.nextIncidentAt = now + (frequent ? 4 : 9) + Math.random() * (frequent ? 8 : 16);
    }
    if (this.incident) {
      addLens(goal, this.incident.lens);
      if (now > this.incident.until) this.incident = null;
    }
    if (now >= this.nextSignalDropAt) {
      this.peaks.trigger('static', now, { duration: 0.45, strength: 0.55 });
      this.nextSignalDropAt = now + (frequent ? 45 : 110) + Math.random() * (frequent ? 60 : 140);
    }
  }

  /** Солнце в кадре: пересвет растёт с угловым размером диска, а у самой короны воздух «плывёт». */
  private addSunProximity(goal: LensParams, input: LensInput) {
    const { sun } = input;
    if (!sun.onScreen) return;
    const centered = 1 - Math.min(1, Math.hypot(sun.x - 0.5, sun.y - 0.5) * 1.6);
    const glare = smoothstep(0.004, 0.2, sun.radiusFraction) * (0.45 + 0.55 * centered);
    const scorch = smoothstep(0.12, 0.5, sun.radiusFraction);
    addLens(goal, {
      exposure: 1 + glare * 0.35 + scorch * 0.25,
      halation: glare * 1.2,
      aberration: glare * 0.003,
      grain: glare * 0.25,
      heat: scorch,
      lightLeak: scorch * 0.35,
      hotPixels: scorch * 0.6,
    });
  }

  /** Далеко от Солнца света мало: плёнка недодержана и зернит, у края системы теряется сигнал. */
  private addDistance(goal: LensParams, distanceAu: number, now: number) {
    const far = smoothstep(3, 30, distanceAu);
    const edge = smoothstep(18, 60, distanceAu);
    // Фокус «ищет» объект: медленное дыхание резкости.
    const hunting = far * 0.0022 * (0.5 + 0.5 * Math.sin(now * 0.9)) * (0.5 + 0.5 * Math.sin(now * 0.37));
    addLens(goal, {
      exposure: 1 - far * 0.3,
      grain: far * 0.45,
      defocus: hunting,
      signalLoss: edge * 0.28,
      tear: edge * 0.06,
      tintR: 0.86, tintG: 0.95, tintB: 1.12, tintAmount: far * 0.35,
    });
  }

  private addBodyProximity(goal: LensParams, id: BodyId, closeness: number) {
    const c = closeness;
    switch (id) {
      case 'jupiter':
        addLens(goal, { hotPixels: c * 1.3, grain: c * 0.25, signalLoss: c * 0.08 });
        break;
      case 'saturn':
        addLens(goal, { dust: c * 0.7, halation: c * 0.2 });
        break;
      case 'uranus':
      case 'neptune':
        addLens(goal, { frost: c * 0.55, tintR: 0.85, tintG: 0.97, tintB: 1.15, tintAmount: c * 0.4 });
        break;
      case 'mars':
        addLens(goal, { dust: c * 0.6, tintR: 1.12, tintG: 0.95, tintB: 0.82, tintAmount: c * 0.25 });
        break;
      case 'venus':
        addLens(goal, { halation: c * 0.5, tintR: 1.1, tintG: 1.02, tintB: 0.8, tintAmount: c * 0.3, defocus: c * 0.0012 });
        break;
      case 'mercury':
        addLens(goal, { heat: c * 0.35, exposure: 1 + c * 0.2 });
        break;
      case 'sun':
        addLens(goal, { heat: c * 0.6 });
        break;
      default:
        break;
    }
  }

  /** Пики не сглаживаются: они сами описывают свою форму во времени. */
  private applyPeaks(peak: PeakState) {
    const p = this.params;
    p.roll = peak.roll;
    p.burn = Math.max(p.burn, peak.burn * 0.9);
    // Пики задают точку от верхнего края экрана, а текстурные координаты шейдера растут снизу.
    if (peak.burn > 0) { p.burnX = peak.burnX; p.burnY = 1 - peak.burnY; }
    p.exposure *= 1 + peak.whiteout * 4;
    p.tear += peak.static * 0.8;
    p.signalLoss = Math.min(1, p.signalLoss + peak.static * 0.45);
    p.weave += peak.static * 1.5 + Math.abs(peak.shakeX + peak.shakeY) * 80;
  }
}
