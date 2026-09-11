import { MOON_ORBIT, OBLIQUITY_J2000, PLANET_ELEMENTS, ROTATION, type OrbitalElements } from '../data/orbitalElements';
import { J2000, centuriesSinceJ2000 } from './time';

export type Vec3 = { x: number; y: number; z: number };

const DEG = Math.PI / 180;
const KEPLER_TOLERANCE = 1e-10;
const KEPLER_MAX_ITERATIONS = 30;
/** Линейные вековые поправки уводят эксцентриситет за [0, 1) через десятки тысяч лет. */
const MAX_ECCENTRICITY = 0.97;

/**
 * Оси сцены: three.js держит «вверх» по Y, а эклиптика задаётся с севером по Z.
 * Поворот (x, y, z) → (x, z, −y) сохраняет правую систему координат,
 * поэтому планеты при взгляде сверху идут против часовой стрелки, как на небе.
 */
export function eclipticToScene(x: number, y: number, z: number): Vec3 {
  return { x, y: z, z: -y };
}

export function elementsAt(id: string, jd: number): OrbitalElements {
  const { epoch, perCentury } = PLANET_ELEMENTS[id];
  const t = centuriesSinceJ2000(jd);
  return {
    semiMajorAxis: epoch.semiMajorAxis + perCentury.semiMajorAxis * t,
    eccentricity: Math.min(MAX_ECCENTRICITY, Math.max(0, epoch.eccentricity + perCentury.eccentricity * t)),
    inclination: epoch.inclination + perCentury.inclination * t,
    meanLongitude: epoch.meanLongitude + perCentury.meanLongitude * t,
    longitudeOfPerihelion: epoch.longitudeOfPerihelion + perCentury.longitudeOfPerihelion * t,
    longitudeOfAscendingNode: epoch.longitudeOfAscendingNode + perCentury.longitudeOfAscendingNode * t,
  };
}

/** Эксцентрическая аномалия E из M = E − e·sin E (метод Ньютона). */
export function solveKepler(meanAnomaly: number, eccentricity: number): number {
  const m = normalizeRadians(meanAnomaly);
  // Для больших эксцентриситетов старт с π сходится надёжнее, чем с M.
  let e = eccentricity < 0.8 ? m : Math.PI;
  for (let i = 0; i < KEPLER_MAX_ITERATIONS; i++) {
    const delta = (e - eccentricity * Math.sin(e) - m) / (1 - eccentricity * Math.cos(e));
    e -= delta;
    if (Math.abs(delta) < KEPLER_TOLERANCE) break;
  }
  return e;
}

/** Точка орбиты по эксцентрической аномалии, эклиптика J2000 в а. е. — в осях сцены. */
export function orbitPoint(elements: OrbitalElements, eccentricAnomaly: number): Vec3 {
  const { semiMajorAxis: a, eccentricity: e } = elements;
  const inPlaneX = a * (Math.cos(eccentricAnomaly) - e);
  const inPlaneY = a * Math.sqrt(1 - e * e) * Math.sin(eccentricAnomaly);
  return rotateToEcliptic(inPlaneX, inPlaneY, elements);
}

function rotateToEcliptic(px: number, py: number, elements: OrbitalElements): Vec3 {
  const node = elements.longitudeOfAscendingNode * DEG;
  const perihelionArgument = (elements.longitudeOfPerihelion - elements.longitudeOfAscendingNode) * DEG;
  const inclination = elements.inclination * DEG;
  const cw = Math.cos(perihelionArgument), sw = Math.sin(perihelionArgument);
  const cn = Math.cos(node), sn = Math.sin(node);
  const ci = Math.cos(inclination), si = Math.sin(inclination);
  const x = (cw * cn - sw * sn * ci) * px + (-sw * cn - cw * sn * ci) * py;
  const y = (cw * sn + sw * cn * ci) * px + (-sw * sn + cw * cn * ci) * py;
  const z = sw * si * px + cw * si * py;
  return eclipticToScene(x, y, z);
}

/** Гелиоцентрическое положение планеты, а. е., оси сцены. */
export function heliocentricPosition(id: string, jd: number): Vec3 {
  const elements = elementsAt(id, jd);
  const meanAnomaly = (elements.meanLongitude - elements.longitudeOfPerihelion) * DEG;
  return orbitPoint(elements, solveKepler(meanAnomaly, elements.eccentricity));
}

/** Геоцентрическое положение Луны, километры, оси сцены. */
export function moonGeocentricKm(jd: number): Vec3 {
  const days = jd - MOON_ORBIT.epochJd;
  const node = (MOON_ORBIT.ascendingNodeAtEpoch + MOON_ORBIT.ascendingNodePerDay * days) * DEG;
  const perigee = (MOON_ORBIT.argumentOfPerigeeAtEpoch + MOON_ORBIT.argumentOfPerigeePerDay * days) * DEG;
  const meanAnomaly = (MOON_ORBIT.meanAnomalyAtEpoch + MOON_ORBIT.meanAnomalyPerDay * days) * DEG;
  const e = MOON_ORBIT.eccentricity;
  const eccentricAnomaly = solveKepler(meanAnomaly, e);
  const elements: OrbitalElements = {
    semiMajorAxis: MOON_ORBIT.semiMajorAxisKm,
    eccentricity: e,
    inclination: MOON_ORBIT.inclination,
    meanLongitude: 0,
    longitudeOfPerihelion: (node + perigee) / DEG,
    longitudeOfAscendingNode: node / DEG,
  };
  return orbitPoint(elements, eccentricAnomaly);
}

/** Сидерический период по третьему закону Кеплера, сутки. */
export function orbitalPeriodDays(semiMajorAxisAu: number): number {
  return 365.256898 * Math.pow(semiMajorAxisAu, 1.5);
}

/** Направление северного полюса вращения в осях сцены (единичный вектор). */
export function poleDirection(id: string): Vec3 {
  const { poleRa, poleDec } = ROTATION[id];
  const ra = poleRa * DEG, dec = poleDec * DEG, obliquity = OBLIQUITY_J2000 * DEG;
  const xe = Math.cos(dec) * Math.cos(ra);
  const ye = Math.cos(dec) * Math.sin(ra);
  const ze = Math.sin(dec);
  // Экваториальные координаты → эклиптические поворотом вокруг оси X на наклон эклиптики.
  const y = ye * Math.cos(obliquity) + ze * Math.sin(obliquity);
  const z = -ye * Math.sin(obliquity) + ze * Math.cos(obliquity);
  return eclipticToScene(xe, y, z);
}

/** Угол нулевого меридиана, радианы. */
export function meridianAngle(id: string, jd: number): number {
  const { meridianAtEpoch, degreesPerDay } = ROTATION[id];
  return ((meridianAtEpoch + degreesPerDay * (jd - J2000)) % 360) * DEG;
}

export function eclipticLongitudeDegrees(position: Vec3): number {
  // Обратно из осей сцены: эклиптические x = x, y = −z.
  const longitude = Math.atan2(-position.z, position.x) / DEG;
  return (longitude + 360) % 360;
}

export function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function normalizeRadians(angle: number): number {
  const twoPi = Math.PI * 2;
  let a = angle % twoPi;
  if (a > Math.PI) a -= twoPi;
  if (a < -Math.PI) a += twoPi;
  return a;
}
