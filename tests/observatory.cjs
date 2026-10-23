// Сквозная проверка в настоящем браузере: запуск, выбор тела, события, масштаб, настройки, языки, телефон.
// Нужен запущенный dev-сервер (npm run dev). Запуск: node tests/observatory.cjs [url]
// Селекторы не зависят от языка (data-body, классы), язык на старте — английский.
const { chromium } = require('@playwright/test');

const url = process.argv[2] || 'http://127.0.0.1:5177/';
let failures = 0;
function expect(name, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${name}`);
  if (!condition) failures++;
}

const CYRILLIC_OR_CJK = /[Ѐ-ӿ一-鿿]/;

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('test.language-set')) {
      localStorage.setItem('aetherium.language', 'en');
      localStorage.setItem('aetherium.first-steps-seen', '1');
      sessionStorage.setItem('test.language-set', '1');
    }
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.keyboard.press('Shift');
  // Сцена готова, когда запечены поверхности и собраны шейдеры: заставка уходит сама.
  await page.waitForSelector('.intro', { state: 'detached', timeout: 120000 });
  await page.waitForTimeout(800);

  expect('scene canvas created', await page.locator('.stage canvas').count() === 1);
  expect('body labels visible', await page.locator('.scene-label.is-visible').count() >= 5);
  expect('body thumbnails rendered', await page.locator('.rail-item .orb-image').count() === 10);
  expect('document language is English', (await page.evaluate(() => document.documentElement.lang)) === 'en-GB');

  await page.locator('.rail-item[data-body="earth"]').click();
  await page.waitForTimeout(600);
  expect('Earth card opened', (await page.locator('.card-name').innerText()) === 'Earth');
  expect('live distance to the Sun is computed', / AU$/.test(await page.locator('.card-live dd').first().innerText()));
  expect('no Cyrillic or Chinese text in the English interface', !CYRILLIC_OR_CJK.test(await page.evaluate(() => document.body.innerText)));

  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  expect('Space pauses time', (await page.locator('.deck-play .lucide-play').count()) === 1);
  await page.keyboard.press('Space');

  await page.locator('.event-launcher').click();
  expect('event catalogue has 12 scenarios', await page.locator('.event-card').count() === 12);
  await page.locator('.event-card.event-blackhole').click();
  await page.waitForTimeout(1200);
  expect('event is running', (await page.locator('.banner-name').innerText()) === 'Uninvited Abyss');
  await page.locator('.rail-item[data-body="mars"]').click();
  await page.waitForTimeout(300);
  const backToEvent = page.locator('.event-banner button[aria-label="Back to the event"]');
  expect('picking another body offers a way back to the event', await backToEvent.count() === 1);
  await backToEvent.click();
  await page.waitForTimeout(300);
  expect('back to the event refocuses it', await backToEvent.count() === 0);
  await page.locator('.banner-stop').click();
  await page.waitForTimeout(400);
  expect('event stopped', await page.locator('.event-banner').count() === 0);

  const trueScale = page.locator('.scale-toggle [role="radio"]').nth(1);
  await trueScale.click();
  await page.waitForTimeout(900);
  expect('true scale switched on', (await trueScale.getAttribute('aria-checked')) === 'true');
  await page.locator('.scale-toggle [role="radio"]').nth(0).click();
  await page.waitForTimeout(900);

  await page.locator('.tool-settings').click();
  const orbitsSwitch = page.locator('.setting-row input').first();
  await orbitsSwitch.click();
  expect('orbits can be turned off', !(await orbitsSwitch.isChecked()));
  await orbitsSwitch.click();
  await page.keyboard.press('Escape');
  expect('Esc closes settings and returns focus to its button', await page.evaluate(() => document.activeElement?.classList.contains('tool-settings')));

  await page.locator('.rail-item[data-body="earth"]').click();
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect('Esc closes the body card when no panel is open', await page.locator('.body-card').count() === 0);

  await page.locator('.tool-help').click();
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  expect('help dialog keeps keyboard focus inside', await page.evaluate(() => Boolean(document.activeElement?.closest('.help-dialog'))));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  expect('Esc closes help and returns focus to its button', (await page.locator('.dialog-backdrop').count()) === 0 && await page.evaluate(() => document.activeElement?.classList.contains('tool-help')));

  // Языки: смена в меню переводит интерфейс, карточку, хронику и язык документа, выбор переживает перезагрузку.
  const chooseLanguage = async code => {
    await page.locator('.language-button').click();
    await page.locator(`.language-list [lang="${code}"]`).click();
    await page.waitForTimeout(300);
  };
  await page.locator('.rail-item[data-body="earth"]').click();
  await page.waitForTimeout(300);
  const expectedEarth = { ru: 'Земля', de: 'Erde', fr: 'Terre', zh: '地球' };
  for (const [code, earth] of Object.entries(expectedEarth)) {
    await chooseLanguage(code);
    expect(`${code}: card in the chosen language`, (await page.locator('.card-name').innerText()) === earth);
    expect(`${code}: scene label translated`, (await page.locator('.scene-label', { hasText: earth }).count()) === 1);
    expect(`${code}: document language`, (await page.evaluate(() => document.documentElement.lang)).startsWith(code));
  }
  expect('zh: date in Chinese format', /\d+年\d+月\d+日/.test(await page.locator('.deck-date-value').innerText()));
  await chooseLanguage('ru');
  await page.locator('.event-launcher').click();
  await page.locator('.sheet-tabs [role="tab"]').nth(1).click();
  const chronicle = await page.locator('.chronicle-list').innerText();
  expect('chronicle re-read in the new language', chronicle.includes('Незваная бездна') && !chronicle.includes('Uninvited'));
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.intro', { state: 'detached', timeout: 120000 });
  expect('language choice persists', (await page.evaluate(() => document.documentElement.lang)) === 'ru-RU');
  await chooseLanguage('en');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  expect('no horizontal scroll on a phone', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));

  expect(`no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`, errors.length === 0);
  await browser.close();
  if (failures) {
    console.log(`\nFailed: ${failures}`);
    process.exit(1);
  }
  console.log('\nAll checks passed');
})().catch(e => { console.error(e); process.exit(1); });
