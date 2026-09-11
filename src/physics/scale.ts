/**
 * Перевод физических величин в единицы сцены.
 *
 * Истинный масштаб: 1 единица = 100 000 км, расстояния и радиусы в одной мере.
 * Земля там меньше пикселя, а Нептун в 45 000 единиц от Солнца — таково пространство.
 *
 * Наглядный масштаб: расстояния и радиусы сжаты степенными функциями, иначе на одном
 * экране не уместить и Солнце, и Нептун. Сжимается расстояние вдоль направления на Солнце,
 * поэтому эллипс остаётся замкнутым, а перигелий — ближе афелия.
 */
import type { Vec3 } from './kepler';

export type ScaleMode = 'cinematic' | 'true';

export const KM_PER_AU = 149_597_870.7;
const KM_PER_TRUE_UNIT = 100_000;
const AU_IN_TRUE_UNITS = KM_PER_AU / KM_PER_TRUE_UNIT;

const CINEMATIC_DISTANCE_FACTOR = 10;
const CINEMATIC_DISTANCE_POWER = 0.5;
const CINEMATIC_EARTH_RADIUS = 0.32;
const EARTH_RADIUS_KM = 6371;
const CINEMATIC_RADIUS_POWER = 0.42;
/** Тела меньше этой доли Земли — только Луна: у планет сжатие остаётся. */
const MOON_SIZED_BELOW_EARTH_SHARE = 0.3;
/** Луна в наглядном масштабе отнесена на расстояние, соизмеримое с увеличенной Землёй. */
const CINEMATIC_MOON_DISTANCE = 1.15;
const MOON_MEAN_DISTANCE_KM = 384_400;
const NEPTUNE_APHELION_AU = 30.4;
const OVERVIEW_MARGIN = 1.9;

export function distanceFromSun(au: number, mode: ScaleMode): number {
  if (mode === 'true') return au * AU_IN_TRUE_UNITS;
  return CINEMATIC_DISTANCE_FACTOR * Math.pow(au, CINEMATIC_DISTANCE_POWER);
}

/** Обратная функция: сколько а. е. от Солнца соответствует расстоянию сцены. */
export function auFromSceneDistance(distance: number, mode: ScaleMode): number {
  if (mode === 'true') return distance / AU_IN_TRUE_UNITS;
  return Math.pow(distance / CINEMATIC_DISTANCE_FACTOR, 1 / CINEMATIC_DISTANCE_POWER);
}

export function bodyRadius(radiusKm: number, mode: ScaleMode): number {
  if (mode === 'true') return radiusKm / KM_PER_TRUE_UNIT;
  // Спутники меньше Земли остаются в настоящей пропорции к ней: сжатие делало Луну вдвое крупнее, чем она выглядит рядом с Землёй.
  if (radiusKm < EARTH_RADIUS_KM * MOON_SIZED_BELOW_EARTH_SHARE) return CINEMATIC_EARTH_RADIUS * (radiusKm / EARTH_RADIUS_KM);
  return CINEMATIC_EARTH_RADIUS * Math.pow(radiusKm / EARTH_RADIUS_KM, CINEMATIC_RADIUS_POWER);
}

/** Гелиоцентрический вектор в а. е. → точка сцены (Солнце в начале координат). */
export function heliocentricToScene(au: Vec3, mode: ScaleMode, out: Vec3): Vec3 {
  const r = Math.hypot(au.x, au.y, au.z);
  const k = r > 0 ? distanceFromSun(r, mode) / r : 0;
  out.x = au.x * k; out.y = au.y * k; out.z = au.z * k;
  return out;
}

/** Смещение Луны от Земли, км → единицы сцены. */
export function moonOffsetToScene(km: Vec3, mode: ScaleMode, out: Vec3): Vec3 {
  const k = mode === 'true' ? 1 / KM_PER_TRUE_UNIT : CINEMATIC_MOON_DISTANCE / MOON_MEAN_DISTANCE_KM;
  out.x = km.x * k; out.y = km.y * k; out.z = km.z * k;
  return out;
}

/** Расстояние обзора всей системы, чтобы орбита Нептуна поместилась в кадр. */
export function overviewDistance(mode: ScaleMode): number {
  return distanceFromSun(NEPTUNE_APHELION_AU, mode) * OVERVIEW_MARGIN;
}

/** Шейдер пояса астероидов повторяет наглядное сжатие — ему нужны те же константы. */
export const CINEMATIC_SHADER_CONSTANTS = {
  distanceFactor: CINEMATIC_DISTANCE_FACTOR,
  distancePower: CINEMATIC_DISTANCE_POWER,
  auInTrueUnits: AU_IN_TRUE_UNITS,
};
