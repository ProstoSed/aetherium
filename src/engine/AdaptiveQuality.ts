/**
 * Разрешение отрисовки подстраивается под машину. Узкое место этой сцены — заливка
 * пикселей (полноэкранный проход объектива), поэтому регулируется число пикселей,
 * а не детализация моделей. Небольшая потеря резкости под нагрузкой маскируется зерном плёнки.
 */
export type QualityMode = 'auto' | 'high' | 'low';

const RESOLUTION_STEPS = [1, 0.85, 0.72, 0.6];
/** Сглаживание отключается на ступенях ниже этой — оно дорогое, а при низком разрешении почти не видно. */
const MSAA_UNTIL_STEP = 1;
/**
 * На экране с такой плотностью пиксель уже мельче, чем видит глаз, и сглаживание лишь тратит память:
 * 4 выборки half float на 4K — около 400 МБ видеопамяти на одну цель.
 */
const MSAA_MAX_DEVICE_PIXEL_RATIO = 1.75;
const SLOW_FRAME_MS = 22;
const FAST_FRAME_MS = 17.5;
const DOWNGRADE_AFTER_SECONDS = 1.5;
const FIRST_UPGRADE_AFTER_SECONDS = 5;
const MAX_UPGRADE_AFTER_SECONDS = 160;
/** Спуск так скоро после подъёма значит, что подъём не удался: следующего ждать вдвое дольше. */
const FAILED_UPGRADE_WINDOW_SECONDS = 10;
/** Через столько секунд после спуска видно, помог ли он: среднее время кадра уже устоялось. */
const VERIFY_DOWNGRADE_AFTER_SECONDS = 3;
/** Спуск, который ускорил кадр меньше чем на 10%, бесполезен: упор не в видеокарту. */
const USEFUL_DOWNGRADE_GAIN = 0.9;
const MAX_PIXEL_RATIO = 2;

export class AdaptiveQuality {
  private step = 0;
  private averageFrameMs = 16.7;
  private slowFor = 0;
  private fastFor = 0;
  private sinceChange = Infinity;
  private lastChange: 'up' | 'down' | null = null;
  private frameMsBeforeDowngrade = 0;
  private upgradeAfterSeconds = FIRST_UPGRADE_AFTER_SECONDS;
  /** Ниже этой ступени не спускаться: спуск сюда уже не дал выигрыша. */
  private lowestUsefulStep = RESOLUTION_STEPS.length - 1;

  constructor(public mode: QualityMode = 'auto') {}

  /**
   * Возвращает true, если ступень изменилась. Время кадра берётся из промежутков между кадрами,
   * поэтому медленный кадр не всегда значит перегруженную видеокарту: экран может быть ограничен
   * 30 Гц (режим экономии батареи) или упор — в процессор. Такой спуск проверяется и отменяется.
   */
  sample(frameSeconds: number): boolean {
    if (this.mode !== 'auto') return false;
    const frameMs = frameSeconds * 1000;
    this.averageFrameMs += (frameMs - this.averageFrameMs) * 0.08;
    this.sinceChange += frameSeconds;
    this.slowFor = this.averageFrameMs > SLOW_FRAME_MS ? this.slowFor + frameSeconds : 0;
    this.fastFor = this.averageFrameMs < FAST_FRAME_MS ? this.fastFor + frameSeconds : 0;

    if (this.lastChange === 'down' && this.sinceChange > VERIFY_DOWNGRADE_AFTER_SECONDS) {
      this.lastChange = null;
      if (this.averageFrameMs > this.frameMsBeforeDowngrade * USEFUL_DOWNGRADE_GAIN) {
        this.lowestUsefulStep = this.step - 1;
        return this.changeStep(-1);
      }
    }
    // Пока прошлый спуск не проверен, следующего нет: иначе бесполезные спуски шли бы подряд до самого низа.
    const verifying = this.lastChange === 'down';
    if (this.slowFor > DOWNGRADE_AFTER_SECONDS && this.step < this.lowestUsefulStep && !verifying) {
      if (this.lastChange === 'up' && this.sinceChange < FAILED_UPGRADE_WINDOW_SECONDS) {
        this.upgradeAfterSeconds = Math.min(this.upgradeAfterSeconds * 2, MAX_UPGRADE_AFTER_SECONDS);
      }
      this.frameMsBeforeDowngrade = this.averageFrameMs;
      return this.changeStep(1);
    }
    if (this.fastFor > this.upgradeAfterSeconds && this.step > 0) {
      // Кадр снова быстрый — нагрузка сменилась, и прежний вывод о бесполезном спуске устарел.
      this.lowestUsefulStep = RESOLUTION_STEPS.length - 1;
      return this.changeStep(-1);
    }
    return false;
  }

  private changeStep(delta: number): boolean {
    this.step += delta;
    this.lastChange = delta > 0 ? 'down' : 'up';
    this.sinceChange = 0;
    this.slowFor = 0;
    this.fastFor = 0;
    return true;
  }

  pixelRatio(devicePixelRatio: number): number {
    const base = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
    if (this.mode === 'high') return base;
    if (this.mode === 'low') return Math.min(devicePixelRatio, 1) * 0.75;
    return base * RESOLUTION_STEPS[this.step]!;
  }

  msaaSamples(devicePixelRatio: number): number {
    if (this.mode === 'high') return 4;
    if (this.mode === 'low') return 0;
    if (devicePixelRatio >= MSAA_MAX_DEVICE_PIXEL_RATIO) return 0;
    return this.step <= MSAA_UNTIL_STEP ? 4 : 0;
  }

  get frameMs(): number {
    return this.averageFrameMs;
  }
}
