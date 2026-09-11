/**
 * Разрешение отрисовки подстраивается под машину. Узкое место этой сцены — заливка
 * пикселей (полноэкранный проход объектива), поэтому регулируется число пикселей,
 * а не детализация моделей. Небольшая потеря резкости под нагрузкой маскируется зерном плёнки.
 */
export type QualityMode = 'auto' | 'high' | 'low';

const RESOLUTION_STEPS = [1, 0.85, 0.72, 0.6];
/** Сглаживание отключается на ступенях ниже этой — оно дорогое, а при низком разрешении почти не видно. */
const MSAA_UNTIL_STEP = 1;
const SLOW_FRAME_MS = 22;
const FAST_FRAME_MS = 17.5;
const DOWNGRADE_AFTER_SECONDS = 1.5;
const UPGRADE_AFTER_SECONDS = 5;
const MAX_PIXEL_RATIO = 2;

export class AdaptiveQuality {
  private step = 0;
  private averageFrameMs = 16.7;
  private slowFor = 0;
  private fastFor = 0;

  constructor(public mode: QualityMode = 'auto') {}

  /** Возвращает true, если ступень изменилась. */
  sample(frameSeconds: number): boolean {
    if (this.mode !== 'auto') return false;
    const frameMs = frameSeconds * 1000;
    this.averageFrameMs += (frameMs - this.averageFrameMs) * 0.08;
    this.slowFor = this.averageFrameMs > SLOW_FRAME_MS ? this.slowFor + frameSeconds : 0;
    this.fastFor = this.averageFrameMs < FAST_FRAME_MS ? this.fastFor + frameSeconds : 0;
    if (this.slowFor > DOWNGRADE_AFTER_SECONDS && this.step < RESOLUTION_STEPS.length - 1) return this.changeStep(1);
    if (this.fastFor > UPGRADE_AFTER_SECONDS && this.step > 0) return this.changeStep(-1);
    return false;
  }

  private changeStep(delta: number): boolean {
    this.step += delta;
    this.slowFor = 0;
    this.fastFor = 0;
    return true;
  }

  pixelRatio(devicePixelRatio: number): number {
    const base = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
    if (this.mode === 'high') return base;
    if (this.mode === 'low') return Math.min(devicePixelRatio, 1) * 0.75;
    return base * RESOLUTION_STEPS[this.step];
  }

  msaaSamples(): number {
    if (this.mode === 'high') return 4;
    if (this.mode === 'low') return 0;
    return this.step <= MSAA_UNTIL_STEP ? 4 : 0;
  }

  get frameMs(): number {
    return this.averageFrameMs;
  }
}
