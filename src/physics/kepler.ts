import {
  GENERAL_PRECESSION_ARCSEC, LONG_TERM_PLANET_ELEMENTS, MOON_ORBIT, OBLIQUITY_J2000, OBLIQUITY_OF_DATE_ARCSEC, PLANET_ELEMENTS, PRECISE_ELEMENTS_FROM_CENTURY,
  PRECISE_ELEMENTS_TO_CENTURY, ROTATION, SUN_FOR_MOON, type OrbitalElements, type SecularElements,
} from '../data/orbitalElements';
import { J2000, centuriesSinceJ2000 } from './time';

export type Vec3 = { x: number; y: number; z: number };

const DEG = Math.PI / 180;
const KEPLER_TOLERANCE = 1e-10;
const KEPLER_MAX_ITERATIONS = 30;
/** Линейные вековые поправки уводят эксцентриситет за [0, 1) через десятки тысяч лет. */
const MAX_ECCENTRICITY = 0.97;
/**
 * За границей таблицы 1 (1800 и 2050 годы) положение за 50 лет плавно переходит к таблице 2:
 * таблицы расходятся на десятые доли градуса, и резкая смена дала бы скачок планеты.
 */
const TABLE_BLEND_CENTURIES = 0.5;
/** Экваториальный радиус Земли, км: в нём Шлютер даёт поправки к расстоянию до Луны. */
const EARTH_RADIUS_KM = 6378.14;

/**
 * Оси сцены: three.js держит «вверх» по Y, а эклиптика задаётся с севером по Z.
 * Поворот (x, y, z) → (x, z, −y) сохраняет правую систему координат,
 * поэтому планеты при взгляде сверху идут против часовой стрелки, как на небе.
 */
export function eclipticToScene(x: number, y: number, z: number): Vec3 {
  return { x, y: z, z: -y };
}

/** Доля таблицы 2 в положении планеты: 0 внутри 1800–2050, 1 дальше 50 лет от этих границ. */
function longTermShare(t: number): number {
  const beyond = Math.max(PRECISE_ELEMENTS_FROM_CENTURY - t, t - PRECISE_ELEMENTS_TO_CENTURY, 0);
  const x = Math.min(1, beyond / TABLE_BLEND_CENTURIES);
  return x * x * (3 - 2 * x);
}

/** Элементы орбиты на дату по той таблице, что сейчас преобладает: для линии орбиты. */
export function elementsAt(id: string, jd: number): OrbitalElements {
  const t = centuriesSinceJ2000(jd);
  return secularElementsAt(longTermShare(t) < 0.5 ? PLANET_ELEMENTS[id]! : LONG_TERM_PLANET_ELEMENTS[id]!, t);
}

function secularElementsAt({ epoch, perCentury }: SecularElements, t: number): OrbitalElements {
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
  // Для больших эксцентриситетов старт с ±π (со знаком M) сходится надёжнее, чем с M. Старт с +π
  // при отрицательной M уводил первый шаг к нулю, где 1 − e·cos E ≈ 0, и метод расходился.
  let e = eccentricity < 0.8 ? m : m < 0 ? -Math.PI : Math.PI;
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

function positionFromTable(table: SecularElements, t: number): Vec3 {
  const elements = secularElementsAt(table, t);
  let meanAnomaly = elements.meanLongitude - elements.longitudeOfPerihelion;
  const terms = table.meanAnomalyTerms;
  if (terms) meanAnomaly += terms.b * t * t + terms.c * Math.cos(terms.f * t * DEG) + terms.s * Math.sin(terms.f * t * DEG);
  return orbitPoint(elements, solveKepler(meanAnomaly * DEG, elements.eccentricity));
}

/** Гелиоцентрическое положение планеты, а. е., оси сцены. */
export function heliocentricPosition(id: string, jd: number): Vec3 {
  const t = centuriesSinceJ2000(jd);
  const share = longTermShare(t);
  if (share === 0) return positionFromTable(PLANET_ELEMENTS[id]!, t);
  const longTerm = positionFromTable(LONG_TERM_PLANET_ELEMENTS[id]!, t);
  if (share === 1) return longTerm;
  const precise = positionFromTable(PLANET_ELEMENTS[id]!, t);
  return {
    x: precise.x + (longTerm.x - precise.x) * share,
    y: precise.y + (longTerm.y - precise.y) * share,
    z: precise.z + (longTerm.z - precise.z) * share,
  };
}

type MoonAngles = { elements: OrbitalElements; meanAnomaly: number; elongation: number; argumentOfLatitude: number; sunMeanAnomaly: number };

/** Средние элементы Луны на дату (эклиптика J2000) и аргументы её возмущений, градусы. */
function moonAngles(jd: number): MoonAngles {
  const days = jd - MOON_ORBIT.epochJd;
  const t2 = centuriesSinceJ2000(jd) ** 2;
  const nodeOfDate = MOON_ORBIT.ascendingNodeAtEpoch + MOON_ORBIT.ascendingNodePerDay * days + MOON_ORBIT.ascendingNodePerCentury2 * t2;
  const perigee = MOON_ORBIT.argumentOfPerigeeAtEpoch + MOON_ORBIT.argumentOfPerigeePerDay * days + MOON_ORBIT.argumentOfPerigeePerCentury2 * t2;
  const meanAnomaly = MOON_ORBIT.meanAnomalyAtEpoch + MOON_ORBIT.meanAnomalyPerDay * days + MOON_ORBIT.meanAnomalyPerCentury2 * t2;
  const sunMeanAnomaly = SUN_FOR_MOON.meanAnomalyAtEpoch + SUN_FOR_MOON.meanAnomalyPerDay * days + SUN_FOR_MOON.meanAnomalyPerCentury2 * t2;
  const sunMeanLongitude = SUN_FOR_MOON.perihelionAtEpoch + SUN_FOR_MOON.perihelionPerDay * days + sunMeanAnomaly;
  const moonMeanLongitude = nodeOfDate + perigee + meanAnomaly;
  // Аргументы возмущений — разности долгот, прецессия в них сокращается; сдвиг к J2000 нужен только узлу.
  const node = nodeOfDate - MOON_ORBIT.precessionPerDay * days;
  return {
    elements: {
      semiMajorAxis: MOON_ORBIT.semiMajorAxisKm,
      eccentricity: MOON_ORBIT.eccentricity,
      inclination: MOON_ORBIT.inclination,
      meanLongitude: 0,
      longitudeOfPerihelion: node + perigee,
      longitudeOfAscendingNode: node,
    },
    meanAnomaly,
    elongation: moonMeanLongitude - sunMeanLongitude,
    argumentOfLatitude: moonMeanLongitude - nodeOfDate,
    sunMeanAnomaly,
  };
}

/** Средняя орбита Луны на дату, без возмущений: для линии орбиты. */
export function moonElementsAt(jd: number): OrbitalElements {
  return moonAngles(jd).elements;
}

/**
 * Геоцентрическое положение Луны, километры, оси сцены. К кеплеровой орбите добавлены главные
 * возмущения от Солнца по Шлютеру: эвекция (до 1,27°), вариация (0,66°), годичное уравнение и
 * ещё девять членов по долготе, пять по широте и два по расстоянию. Без них Луна в затмение
 * расходилась с Солнцем больше чем на градус.
 */
export function moonGeocentricKm(jd: number): Vec3 {
  const { elements, meanAnomaly, elongation, argumentOfLatitude, sunMeanAnomaly } = moonAngles(jd);
  const point = orbitPoint(elements, solveKepler(meanAnomaly * DEG, elements.eccentricity));
  const Mm = meanAnomaly * DEG, Ms = sunMeanAnomaly * DEG, D = elongation * DEG, F = argumentOfLatitude * DEG;
  const longitudeTerms =
    -1.274 * Math.sin(Mm - 2 * D) + 0.658 * Math.sin(2 * D) - 0.186 * Math.sin(Ms)
    - 0.059 * Math.sin(2 * Mm - 2 * D) - 0.057 * Math.sin(Mm - 2 * D + Ms) + 0.053 * Math.sin(Mm + 2 * D)
    + 0.046 * Math.sin(2 * D - Ms) + 0.041 * Math.sin(Mm - Ms) - 0.035 * Math.sin(D)
    - 0.031 * Math.sin(Mm + Ms) - 0.015 * Math.sin(2 * F - 2 * D) + 0.011 * Math.sin(Mm - 4 * D);
  const latitudeTerms =
    -0.173 * Math.sin(F - 2 * D) - 0.055 * Math.sin(Mm - F - 2 * D) - 0.046 * Math.sin(Mm + F - 2 * D)
    + 0.033 * Math.sin(F + 2 * D) + 0.017 * Math.sin(2 * Mm + F);
  const distanceTermsKm = (-0.58 * Math.cos(Mm - 2 * D) - 0.46 * Math.cos(2 * D)) * EARTH_RADIUS_KM;

  // Из осей сцены в эклиптические (x, −z, y), поправки — в сферических координатах, и обратно.
  const x = point.x, y = -point.z, z = point.y;
  const distance = Math.hypot(x, y, z) + distanceTermsKm;
  const longitude = Math.atan2(y, x) + longitudeTerms * DEG;
  const latitude = Math.atan2(z, Math.hypot(x, y)) + latitudeTerms * DEG;
  return eclipticToScene(
    distance * Math.cos(latitude) * Math.cos(longitude),
    distance * Math.cos(latitude) * Math.sin(longitude),
    distance * Math.sin(latitude),
  );
}

/** Общая прецессия p_A на дату, радианы. */
function generalPrecession(jd: number): number {
  const t = centuriesSinceJ2000(jd);
  return ((GENERAL_PRECESSION_ARCSEC.linear * t + GENERAL_PRECESSION_ARCSEC.quadratic * t * t) / 3600) * DEG;
}

/** Наклон экватора Земли к эклиптике даты, радианы. За пределами формулы Ласкара — её крайнее значение. */
function obliquityOfDate(jd: number): number {
  const u = Math.max(-1, Math.min(1, centuriesSinceJ2000(jd) / 100));
  let arcsec = 0;
  for (let i = OBLIQUITY_OF_DATE_ARCSEC.length - 1; i >= 0; i--) arcsec = arcsec * u + OBLIQUITY_OF_DATE_ARCSEC[i]!;
  return (arcsec / 3600) * DEG;
}

const dot3 = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const normalize = (v: Vec3): Vec3 => { const l = length(v); return { x: v.x / l, y: v.y / l, z: v.z / l }; };

/** Поворот вектора вокруг единичной оси (формула Родрига). */
function rotateAbout(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle), s = Math.sin(angle), k = dot3(axis, v) * (1 - c);
  return {
    x: v.x * c + (axis.y * v.z - axis.z * v.y) * s + axis.x * k,
    y: v.y * c + (axis.z * v.x - axis.x * v.z) * s + axis.y * k,
    z: v.z * c + (axis.x * v.y - axis.y * v.x) * s + axis.z * k,
  };
}

/** Нормаль к плоскости орбиты Земли на дату — полюс эклиптики даты, оси сцены. */
function eclipticPoleOfDate(jd: number): Vec3 {
  const { inclination, longitudeOfAscendingNode } = elementsAt('earth', jd);
  const i = inclination * DEG, node = longitudeOfAscendingNode * DEG;
  return eclipticToScene(Math.sin(i) * Math.sin(node), -Math.sin(i) * Math.cos(node), Math.cos(i));
}

type EarthFrame = { pole: Vec3; origin: Vec3 };

/**
 * Ось Земли на дату. Прецессия поворачивает её вокруг полюса эклиптики на −p_A (круг за ~25 800 лет),
 * а наклон к плоскости орбиты меняется (формула Ласкара): за 3000 лет — на полградуса, и сама
 * плоскость орбиты за это время уходит. Без этого к −9000 году лето и зима менялись бы местами,
 * а солнцестояние давало бы не тот тропик. Полюса других тел МАС даёт с медленными поправками
 * в доли градуса за столетие — ими пренебрегаем.
 */
function earthFrame(jd: number): EarthFrame {
  const eclipticJ2000 = { x: 0, y: 1, z: 0 };
  const precession = -generalPrecession(jd);
  let pole = rotateAbout(equatorialToScene(0, 90), eclipticJ2000, precession);
  let origin = rotateAbout(equatorialToScene(90, 0), eclipticJ2000, precession);
  // Плоскость орбиты на дату: тот же поворот, что переводит полюс эклиптики J2000 в нынешний.
  const eclipticNow = eclipticPoleOfDate(jd);
  const tiltAxis = { x: eclipticJ2000.y * eclipticNow.z - eclipticJ2000.z * eclipticNow.y, y: eclipticJ2000.z * eclipticNow.x - eclipticJ2000.x * eclipticNow.z, z: eclipticJ2000.x * eclipticNow.y - eclipticJ2000.y * eclipticNow.x };
  const tiltSine = length(tiltAxis);
  if (tiltSine > 1e-12) {
    const axis = scaleVec(tiltAxis, 1 / tiltSine);
    const tilt = Math.atan2(tiltSine, dot3(eclipticJ2000, eclipticNow));
    pole = rotateAbout(pole, axis, tilt);
    origin = rotateAbout(origin, axis, tilt);
  }
  // Наклон оси к этой плоскости — наклон даты: доворот в плоскости, где лежат ось и полюс эклиптики.
  const toward = normalize({ x: pole.x - eclipticNow.x * dot3(pole, eclipticNow), y: pole.y - eclipticNow.y * dot3(pole, eclipticNow), z: pole.z - eclipticNow.z * dot3(pole, eclipticNow) });
  const obliquity = obliquityOfDate(jd);
  const target = normalize({ x: eclipticNow.x * Math.cos(obliquity) + toward.x * Math.sin(obliquity), y: eclipticNow.y * Math.cos(obliquity) + toward.y * Math.sin(obliquity), z: eclipticNow.z * Math.cos(obliquity) + toward.z * Math.sin(obliquity) });
  const nodAxis = { x: pole.y * target.z - pole.z * target.y, y: pole.z * target.x - pole.x * target.z, z: pole.x * target.y - pole.y * target.x };
  const nodSine = length(nodAxis);
  if (nodSine > 1e-12) origin = rotateAbout(origin, scaleVec(nodAxis, 1 / nodSine), Math.atan2(nodSine, dot3(pole, target)));
  return { pole: target, origin };
}

function scaleVec(v: Vec3, k: number): Vec3 {
  return { x: v.x * k, y: v.y * k, z: v.z * k };
}

/** Направление северного полюса вращения в осях сцены (единичный вектор); у Земли — на дату. */
export function poleDirection(id: string, jd?: number): Vec3 {
  if (id === 'earth' && jd !== undefined) return earthFrame(jd).pole;
  const { poleRa, poleDec } = ROTATION[id]!;
  return equatorialToScene(poleRa, poleDec);
}

/**
 * Направление, от которого МАС отсчитывает угол нулевого меридиана W: восходящий узел экватора
 * тела на небесном экваторе, RA = α₀ + 90°. Без этой опоры поворот поверхности на W указывал бы
 * в произвольную сторону, и полдень UTC приходился бы не на Гринвич.
 */
export function meridianOriginDirection(id: string, jd?: number): Vec3 {
  if (id === 'earth' && jd !== undefined) return earthFrame(jd).origin;
  return equatorialToScene(ROTATION[id]!.poleRa + 90, 0);
}

/** Экваториальные координаты J2000 (RA и Dec в градусах) → единичный вектор в осях сцены. */
export function equatorialToScene(raDegrees: number, decDegrees: number): Vec3 {
  const ra = raDegrees * DEG, dec = decDegrees * DEG, obliquity = OBLIQUITY_J2000 * DEG;
  const xe = Math.cos(dec) * Math.cos(ra);
  const ye = Math.cos(dec) * Math.sin(ra);
  const ze = Math.sin(dec);
  // Экваториальные координаты → эклиптические поворотом вокруг оси X на наклон эклиптики.
  const y = ye * Math.cos(obliquity) + ze * Math.sin(obliquity);
  const z = -ye * Math.sin(obliquity) + ze * Math.cos(obliquity);
  return eclipticToScene(xe, y, z);
}

/**
 * Угол нулевого меридиана, радианы. У Земли это угол вращения ERA (дата — в UT), который отсчитывается
 * от невращающегося начала. Наша опора для Земли прецессирует вокруг полюса эклиптики на −p_A, то есть
 * вокруг оси Земли на −p_A·cos ε; угол получает обратную добавку, и полдень UTC остаётся над Гринвичем.
 */
export function meridianAngle(id: string, jd: number): number {
  const { meridianAtEpoch, degreesPerDay } = ROTATION[id]!;
  const precession = id === 'earth' ? generalPrecession(jd) * Math.cos(OBLIQUITY_J2000 * DEG) : 0;
  return ((meridianAtEpoch + degreesPerDay * (jd - J2000)) % 360) * DEG + precession;
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
