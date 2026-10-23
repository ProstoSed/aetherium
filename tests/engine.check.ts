// Логика движка без браузера: подстройка разрешения и выбор свободной полосы кадра.
// Запуск: node tools/run-ts.mjs tests/engine.check.ts
import { AdaptiveQuality } from '../src/engine/AdaptiveQuality';
import { freeBandCenter } from '../src/engine/framing';

let failed = 0;
function check(name: string, ok: boolean, detail: string) {
  if (!ok) failed++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}: ${detail}`);
}

/** Прогоняет подстройку на модели машины: время кадра как функция доли пикселей. */
function simulate(seconds: number, frameMsAt: (pixelShare: number) => number) {
  const quality = new AdaptiveQuality('auto');
  let changes = 0;
  for (let t = 0; t < seconds;) {
    const share = quality.pixelRatio(1) ** 2;
    const frameMs = frameMsAt(share);
    if (quality.sample(frameMs / 1000)) changes++;
    t += frameMs / 1000;
  }
  return { changes, finalShare: quality.pixelRatio(1) };
}

// Видеокарта на грани: на полном разрешении 25 мс, ступенью ниже — уже упор в 60 Гц.
// Без памяти о неудачном подъёме ступень менялась бы каждые ~7 с (82 раза за 5 минут);
// с ней попытки подъёма редеют вдвое каждый раз.
const edge = simulate(300, share => (share > 0.9 ? 25 : 16.7));
check('no back-and-forth on a GPU at the edge', edge.changes <= 12, `${edge.changes} changes in 300 s`);

// Экран ограничен 30 Гц: кадр 33 мс при любом разрешении. Спуск не помогает и должен отмениться.
const capped = simulate(60, () => 33.3);
check('30 Hz display keeps full resolution', capped.finalShare === 1, `final pixel ratio ${capped.finalShare}`);
check('30 Hz display: downgrade tried and undone, not repeated', capped.changes <= 2, `${capped.changes} changes in 60 s`);

// Настоящая нехватка заливки: время кадра пропорционально числу пикселей.
const fillBound = simulate(60, share => Math.max(16.7, 30 * share));
check('fill-bound GPU settles below full resolution', fillBound.finalShare < 1 && fillBound.finalShare >= 0.6, `final pixel ratio ${fillBound.finalShare}`);

check('free band: empty screen keeps the centre', freeBandCenter([], 800) === 0.5, `${freeBandCenter([], 800)}`);
const phone = freeBandCenter([[14, 120], [130, 176], [470, 720], [730, 830]], 844);
check('free band: phone card pushes the centre up', Math.abs(phone - (176 + 470) / 2 / 844) < 1e-9, phone.toFixed(3));
check('free band: a sliver is ignored', freeBandCenter([[0, 400], [440, 800]], 800) === 0.5, 'gap of 40 px out of 800');

if (failed) {
  console.log(`\nFailed checks: ${failed}`);
  process.exit(1);
}
console.log('\nAll checks passed');
