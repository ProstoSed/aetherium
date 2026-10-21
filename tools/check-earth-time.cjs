// Проверка привязки карты Земли ко времени: камера ставится на линию Земля—Солнце, и в
// центре освещённого диска должна оказаться подсолнечная точка. В равноденствие 20.03.2026
// в 12:00 UTC это Гвинейский залив (0° д.), в 00:00 UTC — Тихий океан у линии перемены дат.
// Запуск: node tools/check-earth-time.cjs [url] (нужен npm run dev: движок открыт как window.observatory)
const { chromium } = require('@playwright/test');
const fs = require('node:fs');

const url = process.argv[2] || 'http://127.0.0.1:5177/';
// [снимок, момент, поворот камеры от направления на Солнце (°), расстояние в радиусах, подъём к северу (доля)]
const MOMENTS = [
  ['earth-noon-utc', '2026-03-20T12:00:00Z', 0, 3.2, 0],
  ['earth-midnight-utc', '2026-03-20T00:00:00Z', 0, 3.2, 0],
  ['earth-june-solstice', '2026-06-21T12:00:00Z', 0, 3.2, 0],
  // Вечер над Азией: терминатор проходит через Индию, видны Гималаи в косом свете и огни на ночной стороне.
  ['earth-terminator', '2026-03-20T13:00:00Z', 80, 2.6, 0.35],
];

(async () => {
  fs.mkdirSync('tools/shots', { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('aetherium.language', 'en'));
  await page.addInitScript(() => sessionStorage.setItem('aetherium.intro-seen', '1'));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.observatory && window.observatory.store.get().ready, null, { timeout: 120000 });
  for (const [name, iso, turnDegrees, distance, lift] of MOMENTS) {
    await page.evaluate(iso => {
      const o = window.observatory;
      o.updateSettings({ film: 'off', showOrbits: false, showLabels: false });
      o.setPaused(true);
      o.clock.julianDate = Date.parse(iso) / 86400000 + 2440587.5;
    }, iso);
    // Положения тел пересчитываются в кадре: направление на Солнце берётся после него.
    await page.waitForTimeout(200);
    await page.evaluate(([turnDegrees, distance, lift]) => {
      const o = window.observatory;
      o.store.set({ focused: 'earth', selected: null });
      const view = o.bodies.views.get('earth');
      const toSun = view.root.position.clone().negate().normalize();
      const pole = toSun.clone().set(0, 1, 0).applyQuaternion(view.axis.quaternion);
      const direction = toSun.applyAxisAngle(pole, (turnDegrees * Math.PI) / 180).addScaledVector(pole, lift).normalize();
      o.flyToTarget('earth', view.radius * distance, direction);
    }, [turnDegrees, distance, lift]);
    await page.waitForTimeout(4500);
    await page.screenshot({ path: `tools/shots/${name}.png` });
    console.log('shot', name, iso);
  }
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
