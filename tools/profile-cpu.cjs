// Где процессор тратит время кадра: суммарное собственное время функций за несколько секунд.
// Запуск: node tools/profile-cpu.cjs [url] [секунды] [замедление процессора]
const { launchChrome } = require('./chrome.cjs');

const url = process.argv[2] || 'http://127.0.0.1:5177/';
const seconds = Number(process.argv[3] || 4);
const slowdown = Number(process.argv[4] || 1);
const TOP = 25;

(async () => {
  const browser = await launchChrome();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const cdp = await page.context().newCDPSession(page);
  if (slowdown > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: slowdown });
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await page.waitForTimeout(seconds * 1000);
  const { profile } = await cdp.send('Profiler.stop');

  const selfMs = new Map();
  const byId = new Map(profile.nodes.map(n => [n.id, n]));
  const deltas = profile.timeDeltas;
  profile.samples.forEach((id, i) => {
    const node = byId.get(id);
    const f = node.callFrame;
    const file = f.url.split('/').pop().split('?')[0];
    const key = `${f.functionName || '(anonymous)'}  ${file}:${f.lineNumber + 1}`;
    selfMs.set(key, (selfMs.get(key) || 0) + (deltas[i] || 0) / 1000);
  });
  const total = [...selfMs.values()].reduce((a, b) => a + b, 0);
  console.log(`total sampled ${total.toFixed(0)} ms over ${seconds}s, slowdown x${slowdown}`);
  [...selfMs.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP)
    .forEach(([k, v]) => console.log(`${(100 * v / total).toFixed(1).padStart(5)}%  ${v.toFixed(0).padStart(6)} ms  ${k}`));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
