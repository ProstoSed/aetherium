// Сквозная проверка в настоящем браузере: запуск, выбор тела, события, масштаб, настройки, телефон.
// Нужен запущенный dev-сервер (npm run dev). Запуск: node tests/observatory.cjs [url]
const { chromium } = require('@playwright/test');

const url = process.argv[2] || 'http://127.0.0.1:5177/';
let failures = 0;
function expect(name, condition) {
  console.log(`${condition ? 'OK  ' : 'FAIL'} ${name}`);
  if (!condition) failures++;
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.keyboard.press('Shift');
  // Сцена готова, когда запечены поверхности и собраны шейдеры: заставка уходит сама.
  await page.waitForSelector('.intro', { state: 'detached', timeout: 120000 });
  await page.waitForTimeout(800);

  expect('холст сцены создан', await page.locator('.stage canvas').count() === 1);
  expect('подписи тел видны', await page.locator('.scene-label.is-visible').count() >= 5);
  expect('миниатюры тел отрисованы', await page.locator('.rail-item .orb-image').count() === 10);

  await page.locator('.rail-item', { hasText: 'Земля' }).click();
  await page.waitForTimeout(600);
  expect('карточка Земли открылась', (await page.locator('.card-name').innerText()) === 'Земля');
  expect('живое расстояние до Солнца считается', /а\. е\./.test(await page.locator('.card-live dd').first().innerText()));

  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  expect('пробел ставит паузу', (await page.getByRole('button', { name: 'Продолжить' }).count()) === 1);
  await page.keyboard.press('Space');

  await page.locator('.event-launcher').click();
  expect('каталог событий: 12 сценариев', await page.locator('.event-card').count() === 12);
  await page.locator('.event-card', { hasText: 'Незваная бездна' }).click();
  await page.waitForTimeout(1200);
  expect('событие идёт', (await page.locator('.banner-name').innerText()) === 'Незваная бездна');
  await page.locator('.banner-stop').click();
  await page.waitForTimeout(400);
  expect('событие остановлено', await page.locator('.event-banner').count() === 0);

  await page.getByRole('radio', { name: /Истинный/ }).click();
  await page.waitForTimeout(900);
  expect('включён истинный масштаб', (await page.getByRole('radio', { name: /Истинный/ }).getAttribute('aria-checked')) === 'true');
  await page.getByRole('radio', { name: 'Наглядно' }).click();
  await page.waitForTimeout(900);

  await page.getByRole('button', { name: 'Настройки' }).click();
  const orbitsSwitch = page.locator('.setting-row', { hasText: 'Орбиты' }).locator('input');
  await orbitsSwitch.click();
  expect('орбиты выключаются', !(await orbitsSwitch.isChecked()));
  await orbitsSwitch.click();
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  expect('на телефоне нет горизонтальной прокрутки', !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));

  expect(`нет ошибок в консоли${errors.length ? ': ' + errors.join(' | ') : ''}`, errors.length === 0);
  await browser.close();
  if (failures) {
    console.log(`\nПровалено: ${failures}`);
    process.exit(1);
  }
  console.log('\nВсе проверки пройдены');
})().catch(e => { console.error(e); process.exit(1); });
