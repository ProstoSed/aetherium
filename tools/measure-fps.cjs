// Замер производительности сцены в настоящем Chrome на видеокарте.
// Ограничение частоты кадров снято: число показывает запас, а не частоту монитора.
// Запуск: node tools/measure-fps.cjs [url] [секунды] [uncapped|weak]
// weak — обычные 60 Гц и процессор, замедленный в 6 раз: так видны пропущенные кадры
// на слабом ноутбуке, которых на мощной машине не заметно.
const { chromium } = require('@playwright/test');

const url = process.argv[2] || 'http://127.0.0.1:5177/';
const seconds = Number(process.argv[3] || 8);
const mode = process.argv[4] || 'uncapped';
const CPU_SLOWDOWN = 6;
const JANK_MS = 20;

(async () => {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist',
      ...(mode === 'uncapped' ? ['--disable-gpu-vsync', '--disable-frame-rate-limit'] : [])],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  if (mode === 'weak') {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });
    await page.waitForTimeout(1000);
  }

  const result = await page.evaluate(async ({ durationMs, jankMs }) => {
    const frameTimes = [];
    let domMutations = 0;
    const observer = new MutationObserver(list => { domMutations += list.length; });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    let longTaskMs = 0;
    const longTasks = new PerformanceObserver(list => { for (const e of list.getEntries()) longTaskMs += e.duration; });
    longTasks.observe({ type: 'longtask' });
    await new Promise(done => {
      const start = performance.now();
      let last = start;
      const tick = now => {
        frameTimes.push(now - last);
        last = now;
        if (now - start < durationMs) requestAnimationFrame(tick); else done();
      };
      requestAnimationFrame(tick);
    });
    observer.disconnect();
    longTasks.disconnect();
    frameTimes.shift();
    const sorted = [...frameTimes].sort((a, b) => a - b);
    const at = p => +sorted[Math.floor(sorted.length * p)].toFixed(2);
    const gl = document.createElement('canvas').getContext('webgl2');
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      gpu: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown',
      fps: +(frameTimes.length / (durationMs / 1000)).toFixed(1),
      frameMs: { p50: at(0.5), p95: at(0.95), p99: at(0.99), max: at(0.999) },
      jankFramesPercent: +(100 * frameTimes.filter(t => t > jankMs).length / frameTimes.length).toFixed(1),
      domMutationsPerSec: Math.round(domMutations / (durationMs / 1000)),
      longTaskMs: Math.round(longTaskMs),
    };
  }, { durationMs: seconds * 1000, jankMs: JANK_MS });

  console.log(JSON.stringify({ url, mode, ...result, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
