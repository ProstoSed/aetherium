// Замер старта: сколько главный поток занят длинными задачами до первого кадра сцены.
// Запуск: node tools/measure-startup.cjs [url]
const { launchChrome } = require('./chrome.cjs');

const url = process.argv[2] || 'http://127.0.0.1:5177/';

(async () => {
  const browser = await launchChrome();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.addInitScript(() => {
    window.__longTasks = [];
    new PerformanceObserver(list => { for (const e of list.getEntries()) window.__longTasks.push({ start: Math.round(e.startTime), ms: Math.round(e.duration) }); })
      .observe({ type: 'longtask', buffered: true });
  });
  const started = Date.now();
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('.stage canvas') !== null, null, { timeout: 60000 });
  const canvasAfterMs = Date.now() - started;
  await page.waitForTimeout(4000);
  const tasks = await page.evaluate(() => window.__longTasks);
  const worst = tasks.reduce((m, t) => Math.max(m, t.ms), 0);
  console.log(JSON.stringify({ canvasAfterMs, longTasks: tasks.length, totalBlockedMs: tasks.reduce((s, t) => s + t.ms, 0), worstTaskMs: worst, tasks: tasks.slice(0, 8) }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
