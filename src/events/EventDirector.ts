import { EVENT_BY_ID, EVENTS, type EventId, type EventInfo } from '../data/events';
import type { LensParams } from '../lens/LensParams';
import { smoothstep } from './helpers';
import { SCENARIOS } from './scenarios';
import type { Scenario, ScenarioContext, ScenarioFrame } from './types';

/** Доля события на нарастание и на затухание; между ними возмущение держится полным. */
const ATTACK_SHARE = 0.22;
const RELEASE_FROM = 0.75;

type Running = { info: EventInfo; scenario: Scenario; elapsed: number };

export type EventCallbacks = {
  onStart: (info: EventInfo, scenario: Scenario) => void;
  onEnd: (info: EventInfo, interrupted: boolean) => void;
};

export class EventDirector {
  private running: Running | null = null;
  private readonly frame: ScenarioFrame = { progress: 0, envelope: 0, realSeconds: 0, time: 0 };
  /** Секунды до следующего автособытия. */
  countdown: number;

  constructor(private readonly context: ScenarioContext, private readonly callbacks: EventCallbacks, interval: number) {
    this.countdown = interval;
  }

  get activeId(): EventId | null {
    return this.running?.info.id ?? null;
  }

  get progress(): number {
    return this.frame.progress;
  }

  get remainingSeconds(): number {
    return this.running ? Math.max(0, this.running.info.durationSec - this.running.elapsed) : 0;
  }

  start(id: EventId) {
    if (this.running) this.finish(true);
    const info = EVENT_BY_ID[id];
    const scenario = SCENARIOS[id](this.context);
    this.running = { info, scenario, elapsed: 0 };
    this.frame.progress = 0;
    this.frame.envelope = 0;
    this.callbacks.onStart(info, scenario);
  }

  stop() {
    if (this.running) this.finish(true);
  }

  /**
   * Сдвигает событие на кадр. Автособытия идут, только если разрешены и
   * вызывающий подтвердил, что сейчас уместно (например, не истинный масштаб).
   */
  advance(realSeconds: number, time: number, paused: boolean, auto: { enabled: boolean; allowed: boolean; interval: number }) {
    this.frame.realSeconds = paused ? 0 : realSeconds;
    this.frame.time = time;
    if (this.running) {
      if (!paused) this.running.elapsed += realSeconds;
      const progress = Math.min(1, this.running.elapsed / this.running.info.durationSec);
      this.frame.progress = progress;
      this.frame.envelope = smoothstep(0, ATTACK_SHARE, progress) * (1 - smoothstep(RELEASE_FROM, 1, progress));
      if (progress >= 1) this.finish(false);
      return;
    }
    this.frame.progress = 0;
    if (!auto.enabled || !auto.allowed || paused) return;
    this.countdown -= realSeconds;
    if (this.countdown <= 0) {
      this.countdown = auto.interval;
      this.start(EVENTS[Math.floor(Math.random() * EVENTS.length)].id);
    }
  }

  /** Возмущение тел — после расчёта орбит, до отрисовки. */
  perturb() {
    this.running?.scenario.perturb?.(this.frame);
  }

  /** Анимация объектов события и вклад в объектив. */
  update(): Partial<LensParams> | null {
    return this.running ? this.running.scenario.update(this.frame) : null;
  }

  resetCountdown(interval: number) {
    this.countdown = interval;
  }

  private finish(interrupted: boolean) {
    const { info, scenario } = this.running!;
    scenario.dispose();
    this.running = null;
    this.frame.progress = 0;
    this.frame.envelope = 0;
    this.callbacks.onEnd(info, interrupted);
  }

  dispose() {
    this.running?.scenario.dispose();
    this.running = null;
  }
}
