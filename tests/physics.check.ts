// Сверка орбитальной механики с наблюдаемыми датами.
// Запуск: node tools/run-ts.mjs tests/physics.check.ts
import { eclipticLongitudeDegrees, heliocentricPosition, length, meridianAngle, meridianOriginDirection, moonGeocentricKm, poleDirection, type Vec3 } from '../src/physics/kepler';
import { julianDateFromDate } from '../src/physics/time';

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
const jd = (iso: string) => julianDateFromDate(new Date(iso));
const longitude = (id: string, iso: string) => eclipticLongitudeDegrees(heliocentricPosition(id, jd(iso)));

// Противостояние и нижнее соединение — Земля и планета на одной гелиоцентрической долготе.
check('Mars opposition, 2025-01-16', angleGap(longitude('mars', '2025-01-16T02:00Z'), longitude('earth', '2025-01-16T02:00Z')), 0, 1.5, '°');
check('Jupiter opposition, 2026-01-10', angleGap(longitude('jupiter', '2026-01-10T12:00Z'), longitude('earth', '2026-01-10T12:00Z')), 0, 1.5, '°');
check('Saturn opposition, 2025-09-21', angleGap(longitude('saturn', '2025-09-21T12:00Z'), longitude('earth', '2025-09-21T12:00Z')), 0, 1.5, '°');
check('Venus inferior conjunction, 2025-03-23', angleGap(longitude('venus', '2025-03-23T01:00Z'), longitude('earth', '2025-03-23T01:00Z')), 0, 1.5, '°');

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

// Полное лунное затмение 07.09.2025 18:12 UTC: Луна строго за Землёй и у самого узла.
const eclipse = jd('2025-09-07T18:12Z');
const moon = moonGeocentricKm(eclipse);
const earthLongitude = eclipticLongitudeDegrees(heliocentricPosition('earth', eclipse));
check('Moon opposite the Sun at the eclipse', angleGap(eclipticLongitudeDegrees(moon), earthLongitude), 0, 3, '°');
check('Moon at the node at the eclipse (latitude)', Math.abs(Math.asin(moon.y / length(moon)) * 180 / Math.PI), 0, 1, '°');
check('Distance to the Moon', length(moon), 370_000, 25_000, 'km');

// Подсолнечная точка: в 12:00 UTC Солнце над Гринвичем с поправкой на уравнение времени.
// 20.03.2026 уравнение времени ≈ −7,5 мин: Солнце кульминирует позже полудня и стоит ~1,9° к востоку.
{
  const at = jd('2026-03-20T12:00Z');
  const pole = poleDirection('earth');
  const origin = meridianOriginDirection('earth');
  const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
  // Поворот на W вокруг полюса переводит опорное направление X в X·cosW − Z·sinW, где Z = X × полюс.
  const w = meridianAngle('earth', at);
  const z = cross(origin, pole);
  const greenwich = { x: origin.x * Math.cos(w) - z.x * Math.sin(w), y: origin.y * Math.cos(w) - z.y * Math.sin(w), z: origin.z * Math.cos(w) - z.z * Math.sin(w) };
  const earth = heliocentricPosition('earth', at);
  const toSun = { x: -earth.x, y: -earth.y, z: -earth.z };
  const east = cross(pole, greenwich);
  const subsolarLongitude = Math.atan2(dot(toSun, east), dot(toSun, greenwich)) * 180 / Math.PI;
  check('Subsolar longitude at 12:00 UTC, 2026-03-20', subsolarLongitude, 1.9, 1.5, '°');
}

if (failed) {
  console.log(`\nFailed checks: ${failed}`);
  process.exit(1);
}
console.log('\nAll checks passed');
