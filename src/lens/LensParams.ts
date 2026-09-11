/**
 * Состояние «объектива и плёнки» на один кадр. Каждый источник помех — время,
 * близость к телам, перелёт, событие — вносит свой вклад, вклады складываются,
 * затем сглаживаются, чтобы помехи нарастали и уходили, а не щёлкали.
 */
export type LensParams = {
  /** Множитель экспозиции: <1 недодержка, >1 пересвет. */
  exposure: number;
  /** Радиус расфокуса, доля высоты кадра. */
  defocus: number;
  /** Хроматическая аберрация, доля ширины кадра. */
  aberration: number;
  /** Бочкообразная дисторсия. */
  distortion: number;
  vignette: number;
  grain: number;
  scratches: number;
  dust: number;
  flicker: number;
  /** Дрожание кадра в фильмовом канале. */
  weave: number;
  /** Горизонтальные разрывы изображения. */
  tear: number;
  /** Сдвиг кадра по вертикали 0…1 — «кадр съехал», видна межкадровая перемычка. */
  roll: number;
  /** Прожог плёнки 0…1 и его центр в долях экрана. */
  burn: number;
  burnX: number;
  burnY: number;
  /** Ореол вокруг ярких мест. */
  halation: number;
  /** Дрожание горячего воздуха у Солнца. */
  heat: number;
  /** Иней по краям линзы. */
  frost: number;
  /** Слабый сигнал: полосы, огрубление, выцветание. */
  signalLoss: number;
  /** Засветка сбоку, как от щели в кассете. */
  lightLeak: number;
  /** «Горячие пиксели» от радиации (пояса Юпитера). */
  hotPixels: number;
  tintR: number;
  tintG: number;
  tintB: number;
  tintAmount: number;
  /** Гравитационная линза: центр в долях экрана, сила и радиус. */
  warpX: number;
  warpY: number;
  warpStrength: number;
  warpRadius: number;
  /** Рябь пространства от центра. */
  ripple: number;
  rippleX: number;
  rippleY: number;
};

export type LensKey = keyof LensParams;

export function neutralLens(): LensParams {
  return {
    exposure: 1, defocus: 0, aberration: 0, distortion: 0, vignette: 0, grain: 0, scratches: 0, dust: 0,
    flicker: 0, weave: 0, tear: 0, roll: 0, burn: 0, burnX: 0.5, burnY: 0.5, halation: 0, heat: 0, frost: 0,
    signalLoss: 0, lightLeak: 0, hotPixels: 0, tintR: 1, tintG: 1, tintB: 1, tintAmount: 0,
    warpX: 0.5, warpY: 0.5, warpStrength: 0, warpRadius: 0.2, ripple: 0, rippleX: 0.5, rippleY: 0.5,
  };
}

/** Параметры-координаты и множители не складываются, а заменяются или перемножаются. */
const POSITIONAL: LensKey[] = ['burnX', 'burnY', 'warpX', 'warpY', 'warpRadius', 'rippleX', 'rippleY', 'tintR', 'tintG', 'tintB'];

export function addLens(target: LensParams, contribution: Partial<LensParams>, weight = 1) {
  for (const key of Object.keys(contribution) as LensKey[]) {
    const value = contribution[key]!;
    if (key === 'exposure') target.exposure *= 1 + (value - 1) * weight;
    else if (POSITIONAL.includes(key)) target[key] = value;
    else target[key] += value * weight;
  }
}

/** Экспоненциальное сглаживание, не зависящее от частоты кадров. */
export function dampLens(current: LensParams, goal: LensParams, realSeconds: number, responsiveness: number) {
  const k = 1 - Math.exp(-responsiveness * realSeconds);
  for (const key of Object.keys(goal) as LensKey[]) {
    current[key] += (goal[key] - current[key]) * k;
  }
}
