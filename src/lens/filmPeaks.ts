/**
 * Пиковые сбои плёнки — короткие, на весь экран, вместе с интерфейсом.
 * Каждый пик — функция времени, у всех одинаковая форма ответа, поэтому
 * одновременные пики просто складываются.
 */
export type PeakKind =
  /** Засветка до белого. */
  | 'whiteout'
  /** Прожог: дыра с раскалённым краем растёт из точки. */
  | 'burn'
  /** Смена кадра: новый кадр въезжает снизу, на стыке перемычка и перфорация. */
  | 'rollIn'
  /** Потеря сигнала: снег, разрывы, дёрганье. */
  | 'static'
  /** Удар: встряска кадра. */
  | 'shake'
  /** Разрыв плёнки: половины кадра расходятся по рваной линии, в щели свет лампы. */
  | 'rip';

export type PeakState = {
  whiteout: number;
  burn: number;
  burnX: number;
  burnY: number;
  /** 0 — кадр на месте, 1 — новый кадр ещё целиком ниже экрана. */
  roll: number;
  static: number;
  shakeX: number;
  shakeY: number;
  rip: number;
  ripAngle: number;
};

type Peak = { kind: PeakKind; start: number; duration: number; strength: number; x: number; y: number };

export function emptyPeakState(): PeakState {
  return { whiteout: 0, burn: 0, burnX: 0.5, burnY: 0.5, roll: 0, static: 0, shakeX: 0, shakeY: 0, rip: 0, ripAngle: 0 };
}

const smoothstep = (a: number, b: number, t: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

export class FilmPeaks {
  private peaks: Peak[] = [];
  /** Общая сила пиков из настроек: 0 — выключены. */
  strength = 1;

  trigger(kind: PeakKind, now: number, options: { duration?: number; strength?: number; x?: number; y?: number; delay?: number } = {}) {
    if (this.strength <= 0) return;
    const defaults: Record<PeakKind, number> = { whiteout: 0.6, burn: 1.8, rollIn: 0.9, static: 0.8, shake: 0.5, rip: 1.1 };
    this.peaks.push({
      kind,
      start: now + (options.delay ?? 0),
      duration: options.duration ?? defaults[kind],
      strength: (options.strength ?? 1) * this.strength,
      // Для разрыва x хранит угол линии: у каждого разрыва свой.
      x: options.x ?? 0.5,
      y: options.y ?? 0.5,
    });
  }

  /** Серия «плёнка сгорела — заправили новую»: для самых сильных моментов. */
  triggerBurnOut(now: number, x = 0.5, y = 0.5) {
    this.trigger('burn', now, { duration: 1.7, x, y });
    this.trigger('whiteout', now, { delay: 1.3, duration: 0.7 });
    this.trigger('rollIn', now, { delay: 1.75, duration: 1.0 });
  }

  /** Разрыв под случайным углом, со встряской и коротким снегом. */
  triggerRip(now: number, strength = 1) {
    const angle = (Math.random() - 0.5) * 1.2 + (Math.random() < 0.5 ? 0 : Math.PI / 2);
    this.trigger('rip', now, { duration: 1.2, strength, x: angle });
    this.trigger('static', now, { duration: 0.35, strength: 0.5 * strength });
  }

  /** Короткая смена кадра — маскирует мгновенные переходы, например смену масштаба. */
  triggerReelChange(now: number) {
    this.trigger('whiteout', now, { duration: 0.35, strength: 0.6 });
    this.trigger('rollIn', now, { delay: 0.12, duration: 0.85 });
    this.trigger('static', now, { duration: 0.5, strength: 0.5 });
  }

  isActive(now: number): boolean {
    return this.peaks.some(p => now >= p.start && now < p.start + p.duration);
  }

  /** Момент, когда кадр полностью закрыт, — в него удобно подменять сцену. */
  coverTime(now: number): number | null {
    const roll = this.peaks.find(p => p.kind === 'rollIn' && p.start >= now);
    return roll ? roll.start : null;
  }

  sample(now: number, out: PeakState): PeakState {
    Object.assign(out, emptyPeakState());
    this.peaks = this.peaks.filter(p => now < p.start + p.duration);
    for (const p of this.peaks) {
      if (now < p.start) continue;
      const t = (now - p.start) / p.duration;
      switch (p.kind) {
        case 'whiteout':
          out.whiteout = Math.max(out.whiteout, Math.sin(Math.PI * t) ** 0.6 * p.strength);
          break;
        case 'burn':
          out.burn = Math.max(out.burn, Math.pow(t, 1.7) * p.strength);
          out.burnX = p.x;
          out.burnY = p.y;
          break;
        case 'rollIn':
          // Кадр въезжает с замедлением и чуть «проскакивает» на месте — как лапка грейфера.
          out.roll = Math.max(out.roll, t < 0.85 ? 1 - smoothstep(0, 0.85, t) : Math.sin((t - 0.85) / 0.15 * Math.PI) * 0.015);
          break;
        case 'static':
          out.static = Math.max(out.static, Math.sin(Math.PI * t) * p.strength);
          break;
        case 'rip': {
          // Разрыв возникает рывком и медленнее «затягивается», когда плёнку заправляют заново.
          const strength = (t < 0.12 ? t / 0.12 : Math.pow(1 - (t - 0.12) / 0.88, 1.6)) * p.strength;
          if (strength > out.rip) {
            out.rip = strength;
            out.ripAngle = p.x;
          }
          out.shakeX += Math.sin(now * 83) * 0.006 * strength;
          break;
        }
        case 'shake': {
          const decay = (1 - t) ** 2 * p.strength;
          out.shakeX += Math.sin(now * 91) * 0.012 * decay;
          out.shakeY += Math.cos(now * 77) * 0.012 * decay;
          break;
        }
      }
    }
    return out;
  }

  clear() {
    this.peaks = [];
  }
}
