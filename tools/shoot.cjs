// Снимки ключевых состояний и ошибки консоли — проверка без ручного клика.
// Запуск: node tools/shoot.cjs [url] [папка] [сценарии через запятую] [язык: en|ru|de|fr|zh]
const { launchChrome } = require('./chrome.cjs');
const path = require('node:path');
const fs = require('node:fs');

const url = process.argv[2] || 'http://127.0.0.1:5177/';
const outDir = process.argv[3] || 'tools/shots';
const only = process.argv[4] ? process.argv[4].split(',') : null;
const language = process.argv[5] || 'en';
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await launchChrome();
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.addInitScript(code => {
    localStorage.setItem('aetherium.language', code);
    localStorage.setItem('aetherium.first-steps-seen', '1');
  }, language);
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  await page.goto(url, { waitUntil: 'networkidle' });
  const shot = async name => { await page.screenshot({ path: path.join(outDir, `${name}.png`) }); console.log('shot', name); };
  const want = name => !only || only.includes(name);

  await page.waitForTimeout(900);
  if (want('intro')) await shot('intro');
  await page.keyboard.press('Shift');
  // Сцена показывается после запекания поверхностей; в dev-сборке движок доступен как window.observatory.
  const readyStarted = Date.now();
  await page.waitForFunction(() => window.observatory && window.observatory.store.get().ready, null, { timeout: 120000 }).catch(() => {});
  console.log('ready after', Date.now() - readyStarted, 'ms');
  await page.waitForTimeout(1500);
  if (want('overview')) await shot('overview');

  if (want('earth')) {
    await page.locator('.rail-item[data-body="earth"]').click();
    await page.waitForTimeout(3800);
    await shot('earth');
  }
  if (want('saturn')) {
    await page.locator('.rail-item[data-body="saturn"]').click();
    await page.waitForTimeout(3800);
    await shot('saturn');
  }
  if (want('sun')) {
    await page.locator('.rail-item[data-body="sun"]').click();
    await page.waitForTimeout(3800);
    await shot('sun');
  }
  if (want('true')) {
    await page.locator('.rail-overview').click();
    await page.waitForTimeout(3000);
    await page.locator('.scale-toggle [role="radio"]').nth(1).click();
    await page.waitForTimeout(350);
    await shot('true-transition');
    await page.waitForTimeout(2200);
    await shot('true');
    await page.locator('.scale-toggle [role="radio"]').nth(0).click();
    await page.waitForTimeout(2500);
  }
  const quietMoments = only && only.includes('ice') ? [['ice', 12], ['eclipse', 11], ['flare', 11]] : [['alignment', 13], ['eclipse', 11], ['comet', 12], ['meteors', 10], ['flare', 13], ['rogue', 12], ['ice', 12]];
  const eventMoments = only && (only.includes('rest') || only.includes('ice')) ? quietMoments : only && only.includes('late') ? [['supernova', 20], ['blackhole', 18], ['gravity', 12.5]] : [['blackhole', 13], ['supernova', 14], ['collision', 11.5], ['aliens', 9]];
  for (const [name, at] of eventMoments) {
    const key = `event-${name}`;
    if (!want(key) && !want('events') && !want('late') && !want('rest') && !want('ice')) continue;
    await page.locator('.event-launcher').click();
    await page.waitForTimeout(500);
    if (name === 'blackhole' && want('events')) await shot('events-sheet');
    await page.locator(`.event-card.event-${name}`).click();
    await page.waitForTimeout(at * 1000);
    await shot(key + (want('late') ? '-late' : ''));
    await page.locator('.banner-stop').click();
    await page.waitForTimeout(1500);
  }
  if (want('help')) {
    await page.locator('.tool-help').click();
    await page.waitForTimeout(500);
    await shot('help');
    await page.keyboard.press('Escape');
  }
  if (want('settings')) {
    await page.locator('.tool-settings').click();
    await page.waitForTimeout(500);
    await shot('settings');
    await page.keyboard.press('Escape');
  }
  if (want('language')) {
    await page.locator('.language-button').click();
    await page.waitForTimeout(400);
    await shot('language');
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
