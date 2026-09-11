// Снимки ключевых состояний и ошибки консоли — проверка без ручного клика.
// Запуск: node tools/shoot.cjs [url] [папка] [сценарии через запятую]
const { chromium } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');

const url = process.argv[2] || 'http://127.0.0.1:5177/';
const outDir = process.argv[3] || 'tools/shots';
const only = process.argv[4] ? process.argv[4].split(',') : null;
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  const shot = async name => { await page.screenshot({ path: path.join(outDir, `${name}.png`) }); console.log('shot', name); };
  const want = name => !only || only.includes(name);

  await page.waitForTimeout(900);
  if (want('intro')) await shot('intro');
  await page.keyboard.press('Shift');
  await page.waitForTimeout(2500);
  if (want('overview')) await shot('overview');

  if (want('earth')) {
    await page.locator('.rail-item', { hasText: 'Земля' }).click();
    await page.waitForTimeout(3800);
    await shot('earth');
  }
  if (want('saturn')) {
    await page.locator('.rail-item', { hasText: 'Сатурн' }).click();
    await page.waitForTimeout(3800);
    await shot('saturn');
  }
  if (want('sun')) {
    await page.locator('.rail-item', { hasText: 'Солнце' }).click();
    await page.waitForTimeout(3800);
    await shot('sun');
  }
  if (want('true')) {
    await page.locator('.rail-item', { hasText: 'Вся система' }).click();
    await page.waitForTimeout(3000);
    await page.getByRole('radio', { name: 'Истинный масштаб' }).click();
    await page.waitForTimeout(350);
    await shot('true-transition');
    await page.waitForTimeout(2200);
    await shot('true');
    await page.getByRole('radio', { name: 'Наглядно' }).click();
    await page.waitForTimeout(2500);
  }
  const quietMoments = only && only.includes('ice') ? [['Век великого льда', 12], ['Солнечное затмение', 11], ['Дыхание Солнца', 11]] : [['Парад планет', 13], ['Солнечное затмение', 11], ['Великая комета', 12], ['Звёздный дождь', 10], ['Дыхание Солнца', 13], ['Сбившийся странник', 12], ['Век великого льда', 12]];
  const eventMoments = only && (only.includes('rest') || only.includes('ice')) ? quietMoments : only && only.includes('late') ? [['Последний свет', 20], ['Незваная бездна', 18], ['Гравитационная волна', 12.5]] : [['Незваная бездна', 13], ['Последний свет', 14], ['Столкновение миров', 11.5], ['Мы не одни', 9]];
  for (const [name, at] of eventMoments) {
    const key = `event-${name}`;
    if (!want(key) && !want('events') && !want('late') && !want('rest') && !want('ice')) continue;
    await page.locator('.event-launcher').click();
    await page.waitForTimeout(500);
    if (name === 'Незваная бездна' && want('events')) await shot('events-sheet');
    await page.locator('.event-card', { hasText: name }).click();
    await page.waitForTimeout(at * 1000);
    await shot(key + (want('late') ? '-late' : ''));
    await page.locator('.banner-stop').click();
    await page.waitForTimeout(1500);
  }
  if (want('help')) {
    await page.getByRole('button', { name: 'Как пользоваться' }).click();
    await page.waitForTimeout(500);
    await shot('help');
    await page.keyboard.press('Escape');
  }
  if (want('mobile')) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1500);
    await shot('mobile');
  }
  console.log(JSON.stringify({ errors: [...new Set(errors)].slice(0, 30) }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
