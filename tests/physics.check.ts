// Сверка орбитальной механики с наблюдаемыми датами.
// Запуск: node tools/run-ts.mjs tests/physics.check.ts
import { eclipticLongitudeDegrees, heliocentricPosition, length, moonGeocentricKm } from '../src/physics/kepler';
import { julianDateFromDate } from '../src/physics/time';

let failed = 0;
function check(name: string, actual: number, expected: number, tolerance: number, unit: string) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}: ${actual.toFixed(4)} ${unit} (ожидалось ${expected} ± ${tolerance})`);
}
function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
const jd = (iso: string) => julianDateFromDate(new Date(iso));
const longitude = (id: string, iso: string) => eclipticLongitudeDegrees(heliocentricPosition(id, jd(iso)));

// Противостояние и нижнее соединение — Земля и планета на одной гелиоцентрической долготе.
check('Марс, противостояние 16.01.2025', angleGap(longitude('mars', '2025-01-16T02:00Z'), longitude('earth', '2025-01-16T02:00Z')), 0, 1.5, '°');
check('Юпитер, противостояние 10.01.2026', angleGap(longitude('jupiter', '2026-01-10T12:00Z'), longitude('earth', '2026-01-10T12:00Z')), 0, 1.5, '°');
check('Сатурн, противостояние 21.09.2025', angleGap(longitude('saturn', '2025-09-21T12:00Z'), longitude('earth', '2025-09-21T12:00Z')), 0, 1.5, '°');
check('Венера, нижнее соединение 23.03.2025', angleGap(longitude('venus', '2025-03-23T01:00Z'), longitude('earth', '2025-03-23T01:00Z')), 0, 1.5, '°');

// Расстояния в перигелии и афелии.
check('Земля, перигелий 03.01.2026', length(heliocentricPosition('earth', jd('2026-01-03T17:00Z'))), 0.98329, 0.0005, 'а. е.');
check('Земля, афелий 06.07.2026', length(heliocentricPosition('earth', jd('2026-07-06T17:00Z'))), 1.01670, 0.0005, 'а. е.');
let mercuryMin = Infinity, mercuryMax = 0;
for (let d = 0; d < 88; d += 0.05) {
  const r = length(heliocentricPosition('mercury', jd('2026-01-01T00:00Z') + d));
  mercuryMin = Math.min(mercuryMin, r);
  mercuryMax = Math.max(mercuryMax, r);
}
check('Меркурий, перигелий', mercuryMin, 0.3075, 0.001, 'а. е.');
check('Меркурий, афелий', mercuryMax, 0.4667, 0.001, 'а. е.');

// Полное лунное затмение 07.09.2025 18:12 UTC: Луна строго за Землёй и у самого узла.
const eclipse = jd('2025-09-07T18:12Z');
const moon = moonGeocentricKm(eclipse);
const earthLongitude = eclipticLongitudeDegrees(heliocentricPosition('earth', eclipse));
check('Луна против Солнца в затмение', angleGap(eclipticLongitudeDegrees(moon), earthLongitude), 0, 3, '°');
check('Луна у узла в затмение (широта)', Math.abs(Math.asin(moon.y / length(moon)) * 180 / Math.PI), 0, 1, '°');
check('Расстояние до Луны', length(moon), 370_000, 25_000, 'км');

if (failed) {
  console.log(`\nПровалено проверок: ${failed}`);
  process.exit(1);
}
console.log('\nВсе проверки пройдены');
