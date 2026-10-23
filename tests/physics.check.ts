// Сверка орбитальной механики с наблюдаемыми датами и с эфемеридой JPL DE441.
// Запуск: node tools/run-ts.mjs tests/physics.check.ts
import {
  eclipticLongitudeDegrees, heliocentricPosition, length, meridianAngle, meridianOriginDirection, moonGeocentricKm, poleDirection, solveKepler, type Vec3,
} from '../src/physics/kepler';
import { julianDateFromDate, terrestrialTime } from '../src/physics/time';

const DEG = 180 / Math.PI;
let failed = 0;
function check(name: string, actual: number, expected: number, tolerance: number, unit: string) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}: ${actual.toFixed(4)} ${unit} (expected ${expected} ± ${tolerance})`);
}
function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const jd = (iso: string) => julianDateFromDate(new Date(iso));
/** Юлианская дата 1 января года в астрономическом счёте (0 — это 1 год до н. э.). */
const jdOfYear = (year: number, month = 0, day = 1, hour = 0) => {
  const date = new Date(Date.UTC(2000, 0, 1));
  date.setUTCFullYear(year, month, day);
  date.setUTCHours(hour);
  return julianDateFromDate(date);
};
const longitude = (id: string, iso: string) => eclipticLongitudeDegrees(heliocentricPosition(id, jd(iso)));
/** Из эклиптических координат J2000 (как у JPL) в оси сцены. */
const fromEcliptic = ([x, y, z]: readonly number[]): Vec3 => ({ x: x!, y: z!, z: -y! });
const separation = (a: Vec3, b: Vec3) => Math.acos(Math.min(1, dot(a, b) / (length(a) * length(b)))) * DEG;

// Противостояние и нижнее соединение — Земля и планета на одной гелиоцентрической долготе.
// Модель даёт 0,01–0,18°; допуск 0,3° ловит ухудшение вдвое.
check('Mars opposition, 2025-01-16', angleGap(longitude('mars', '2025-01-16T02:00Z'), longitude('earth', '2025-01-16T02:00Z')), 0, 0.3, '°');
check('Jupiter opposition, 2026-01-10', angleGap(longitude('jupiter', '2026-01-10T12:00Z'), longitude('earth', '2026-01-10T12:00Z')), 0, 0.3, '°');
check('Saturn opposition, 2025-09-21', angleGap(longitude('saturn', '2025-09-21T12:00Z'), longitude('earth', '2025-09-21T12:00Z')), 0, 0.3, '°');
check('Venus inferior conjunction, 2025-03-23', angleGap(longitude('venus', '2025-03-23T01:00Z'), longitude('earth', '2025-03-23T01:00Z')), 0, 0.3, '°');

// Расстояния в перигелии и афелии.
check('Earth perihelion, 2026-01-03', length(heliocentricPosition('earth', jd('2026-01-03T17:00Z'))), 0.98329, 0.0005, 'AU');
check('Earth aphelion, 2026-07-06', length(heliocentricPosition('earth', jd('2026-07-06T17:00Z'))), 1.01670, 0.0005, 'AU');
let mercuryMin = Infinity, mercuryMax = 0;
for (let d = 0; d < 88; d += 0.05) {
  const r = length(heliocentricPosition('mercury', jd('2026-01-01T00:00Z') + d));
  mercuryMin = Math.min(mercuryMin, r);
  mercuryMax = Math.max(mercuryMax, r);
}
check('Mercury perihelion', mercuryMin, 0.3075, 0.001, 'AU');
check('Mercury aphelion', mercuryMax, 0.4667, 0.001, 'AU');

// Полное лунное затмение 07.09.2025: Луна строго за Землёй. Эталон — JPL Horizons (DE441)
// на 18:11 TDB: X 357109,6, Y −95521,0, Z −1754,3 км, расстояние 369 668 км.
{
  const at = 2460926.257638889;
  const moon = moonGeocentricKm(at);
  const reference = fromEcliptic([357109.5865195519, -95520.99028821562, -1754.333691826265]);
  check('Moon opposite the Sun at the eclipse', angleGap(eclipticLongitudeDegrees(moon), eclipticLongitudeDegrees(heliocentricPosition('earth', at))), 0, 0.1, '°');
  check('Moon direction at the eclipse vs DE441', separation(moon, reference), 0, 0.1, '°');
  check('Distance to the Moon at the eclipse vs DE441', length(moon), 369668, 1500, 'km');
}

// Положения на пять тысячелетий против DE441 (Horizons, эклиптика J2000, TDB, барицентры систем
// Юпитера и Сатурна). Без таблицы 2 JPL Сатурн в 1001 году до н. э. уходил на 16°, Луна — на 40°.
{
  const dates = [661856.5, 1355817.5, 2086302.5, 2634166.5, 2780263.5];
  const labels = ['2901 BC', '1001 BC', 'AD 999', 'AD 2500', 'AD 2900'];
  const reference: Record<string, { tolerance: number[]; vectors: number[][] }> = {
    earth: {
      tolerance: [0.05, 0.05, 0.05, 0.05, 0.05],
      vectors: [[-0.9794743630591154, 0.1860195347752845, 0.003451572634439811], [-0.7891817449376204, 0.5948149689739689, 0.004344446972209271], [-0.4098386436911781, 0.8939309013987281, 0.002003168791197524], [-0.06043680849538124, 0.9819574676601853, -0.001099819008649609], [0.03704468538902031, 0.9837489739381448, -0.001998335216189024]],
    },
    jupiter: {
      tolerance: [0.3, 0.3, 0.3, 0.3, 0.3],
      vectors: [[4.955048209406246, 0.6375227039620445, -0.1275665075489086], [1.42241327279559, 4.897075559933323, -0.04689644489006344], [0.972217652096008, -5.106217262560801, -0.004241472034857925], [-0.3759012798981326, 5.127914869658286, -0.01447155847564865], [4.812665127754527, -1.282804372644278, -0.09979525306280182]],
    },
    saturn: {
      tolerance: [0.4, 0.4, 0.4, 0.4, 0.4],
      vectors: [[2.16422511846549, -9.837115624602298, 0.1566438178879949], [-3.17055969719308, 8.441846219181411, -0.06878759445506204], [3.60905135819265, 8.259222824519597, -0.295857440073814], [7.599650565811811, 5.319788543729173, -0.3954720580078297], [-3.180222494681727, -9.436369736447679, 0.2796648528596789]],
    },
    moon: {
      // Ошибка Луны растёт с удалением от нашего времени: вековые члены известны лишь приближённо.
      tolerance: [1.5, 0.6, 0.15, 0.15, 0.15],
      vectors: [[136386.904508271, 370775.6566253144, 26358.60158043515], [278399.7377547979, -282270.7976381376, 32375.80181155434], [-264710.7892821796, 247467.2292341839, 32222.99148438874], [-34987.57968810983, -353933.8073528467, 31385.80838562899], [362078.5169944535, 98152.77701438038, 16187.48739996271]],
    },
  };
  for (const [id, { tolerance, vectors }] of Object.entries(reference)) {
    dates.forEach((at, i) => {
      const model = id === 'moon' ? moonGeocentricKm(at) : heliocentricPosition(id, at);
      check(`${id} vs DE441, ${labels[i]}`, separation(model, fromEcliptic(vectors[i]!)), 0, tolerance[i]!, '°');
    });
  }
}

/** Подсолнечная точка на Земле: широта и долгота от Гринвича, градусы. Дата — гражданское время. */
function subsolarPoint(atUt: number) {
  const pole = poleDirection('earth', atUt);
  const origin = meridianOriginDirection('earth', atUt);
  // Поворот на W вокруг полюса переводит опорное направление X в X·cosW − Z·sinW, где Z = X × полюс.
  const w = meridianAngle('earth', atUt);
  const z = cross(origin, pole);
  const greenwich = { x: origin.x * Math.cos(w) - z.x * Math.sin(w), y: origin.y * Math.cos(w) - z.y * Math.sin(w), z: origin.z * Math.cos(w) - z.z * Math.sin(w) };
  const toSun = scale(heliocentricPosition('earth', terrestrialTime(atUt)), -1);
  const east = cross(pole, greenwich);
  return {
    longitude: Math.atan2(dot(toSun, east), dot(toSun, greenwich)) * DEG,
    latitude: Math.asin(dot(toSun, pole) / length(toSun)) * DEG,
  };
}

// В 12:00 UTC Солнце над Гринвичем с поправкой на уравнение времени. 20.03.2026 уравнение
// времени ≈ −7,5 мин: Солнце кульминирует позже полудня и стоит ~1,9° к востоку.
check('Subsolar longitude at 12:00 UTC, 2026-03-20', subsolarPoint(jd('2026-03-20T12:00Z')).longitude, 1.9, 0.5, '°');
// Через тысячелетия полдень остаётся полднем: уравнение времени не выходит за ±17 мин (±4,3°).
// Без поправки угла вращения на прецессию в 3000 году до н. э. Солнце в полдень стояло бы на 64° в стороне.
for (const year of [-2999, 1000, 3000]) {
  check(`Subsolar longitude at noon UTC, 20 March ${year}`, subsolarPoint(jdOfYear(year, 2, 20, 12)).longitude, 0, 4.5, '°');
}
// Солнцестояние: Солнце над тропиком Рака, широта равна наклону оси на ту дату (Laskar 1986:
// 23,44° сейчас, 24,02° в 3000 году до н. э., 23,31° в 3000 году; у −9000 года формула уже на
// пределе и берётся её значение для −8000 года, 24,23°). Без прецессии оси к −9000 году лето
// и зима менялись местами, а без наклона даты солнцестояние давало не тот тропик.
for (const [year, obliquity] of [[2026, 23.436], [-2999, 24.02], [3000, 23.31], [-9000, 24.233]] as const) {
  let highest = -90;
  for (let day = 10; day <= 30; day += 0.25) highest = Math.max(highest, subsolarPoint(jdOfYear(year, 5, 1) + day).latitude);
  check(`Subsolar latitude at the June solstice ${year}`, highest, obliquity, 0.05, '°');
}

// Луна повёрнута к Земле одной стороной: нулевой меридиан Луны смотрит на Землю с точностью
// до либрации (до ~8°). Элементы Луны в равноденствии даты без поправки к J2000 разворачивали её
// к нам обратной стороной к −9000 году.
for (const year of [1000, 2025, 3000]) {
  let worst = 0;
  for (let day = 0; day < 30; day += 1.5) {
    const at = jdOfYear(year) + day;
    const pole = poleDirection('moon');
    const origin = meridianOriginDirection('moon');
    const w = meridianAngle('moon', at);
    const z = cross(origin, pole);
    const meridian = { x: origin.x * Math.cos(w) - z.x * Math.sin(w), y: origin.y * Math.cos(w) - z.y * Math.sin(w), z: origin.z * Math.cos(w) - z.z * Math.sin(w) };
    const toEarth = scale(moonGeocentricKm(at), -1);
    const inEquator = { x: toEarth.x - pole.x * dot(toEarth, pole), y: toEarth.y - pole.y * dot(toEarth, pole), z: toEarth.z - pole.z * dot(toEarth, pole) };
    worst = Math.max(worst, separation(meridian, inEquator));
  }
  check(`Moon keeps its near side to Earth, ${year} (worst over a month)`, worst, 0, 8, '°');
}

// Уравнение Кеплера при больших эксцентриситетах и отрицательной средней аномалии.
{
  let worst = 0;
  for (const e of [0.8, 0.9, 0.97, 0.999]) {
    for (const m of [-3, -1, -0.1, 0.1, 1, 3]) {
      const ecc = solveKepler(m, e);
      worst = Math.max(worst, Math.abs(ecc - e * Math.sin(ecc) - m));
    }
  }
  check('Kepler equation residual, e up to 0.999', worst, 0, 1e-9, 'rad');
}

// На границах часов модели (−9000 и 11000 годы) положения конечны.
{
  const finite = [jdOfYear(-9000), jdOfYear(11000)].every(at =>
    ['mercury', 'earth', 'neptune'].every(id => Number.isFinite(length(heliocentricPosition(id, at)))) && Number.isFinite(length(moonGeocentricKm(at))));
  check('Finite positions at the clock limits', finite ? 1 : 0, 1, 0, '');
}

if (failed) {
  console.log(`\nFailed checks: ${failed}`);
  process.exit(1);
}
console.log('\nAll checks passed');
