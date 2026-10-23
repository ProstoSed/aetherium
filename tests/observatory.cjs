// Сквозная проверка в настоящем браузере: запуск, выбор тела, события, масштаб, настройки, языки, телефон.
// Запуск: node tests/observatory.cjs [url] — по умолчанию dev-сервер (npm run dev); годится и собранный
// файл: node tests/observatory.cjs file:///…/dist/index.html.
// Селекторы не зависят от языка (data-body, классы), язык на старте — английский.
// Проверки не ждут фиксированное время, а опрашивают условие до таймаута: на медленной машине
// (CI с программным WebGL) кадр идёт дольше, и пауза «на глаз» давала бы ложные провалы.
const { launchChrome } = require('../tools/chrome.cjs');

const url = process.argv[2] || 'http://127.0.0.1:5177/';
const SCENE_READY_TIMEOUT_MS = 240000;
const CHECK_TIMEOUT_MS = 8000;
let failures = 0;

async function check(name, condition, timeoutMs = CHECK_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let passed = false;
  for (;;) {
    passed = await condition().catch(() => false);
    if (passed || Date.now() > deadline) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.log(`${passed ? 'OK  ' : 'FAIL'} ${name}`);
  if (!passed) failures++;
}

const CYRILLIC_OR_CJK = /[Ѐ-ӿ一-鿿]/;

/** Средняя яркость участка экрана, 0…255: снимок разбирается тут же, в странице, через 2D-холст. */
async function brightness(page, clip) {
  const png = (await page.screenshot({ clip })).toString('base64');
  return page.evaluate(async b64 => {
    const image = new Image();
    image.src = `data:image/png;base64,${b64}`;
    await image.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: image.width, height: image.height });
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
    return sum / (data.length / 4);
  }, png);
}

(async () => {
  const browser = await launchChrome();
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
  const text = selector => page.locator(selector).first().innerText();
  const count = selector => page.locator(selector).count();
  const activeHasClass = name => page.evaluate(c => Boolean(document.activeElement?.classList.contains(c)), name);

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.keyboard.press('Shift');
  // Сцена готова, когда запечены поверхности и собраны шейдеры: заставка уходит сама.
  await page.waitForSelector('.intro', { state: 'detached', timeout: SCENE_READY_TIMEOUT_MS });

  await check('scene canvas created', async () => await count('.stage canvas') === 1);
  await check('body labels visible', async () => await count('.scene-label.is-visible') >= 5);
  await check('body thumbnails rendered', async () => await count('.rail-item .orb-image') === 10);
  await check('document language is English', async () => (await page.evaluate(() => document.documentElement.lang)) === 'en-GB');

  await page.locator('.rail-item[data-body="earth"]').click();
  await check('Earth card opened', async () => await text('.card-name') === 'Earth');
  await check('live distance to the Sun is computed', async () => / AU$/.test(await text('.card-live dd')));
  await check('no Cyrillic or Chinese text in the English interface', async () => !CYRILLIC_OR_CJK.test(await page.evaluate(() => document.body.innerText)));

  await page.keyboard.press('Space');
  await check('Space pauses time', async () => await count('.deck-play .lucide-play') === 1);
  await page.keyboard.press('Space');

  await page.locator('.event-launcher').click();
  await check('event catalogue has 12 scenarios', async () => await count('.event-card') === 12);
  await page.locator('.event-card.event-blackhole').click();
  await check('event is running', async () => await text('.banner-name') === 'Uninvited Abyss');
  await page.locator('.rail-item[data-body="mars"]').click();
  const backToEvent = page.locator('.event-banner button[aria-label="Back to the event"]');
  await check('picking another body offers a way back to the event', async () => await backToEvent.count() === 1);
  await backToEvent.click();
  await check('back to the event refocuses it', async () => await backToEvent.count() === 0);
  await page.locator('.banner-stop').click();
  await check('event stopped', async () => await count('.event-banner') === 0);

  const trueScale = page.locator('.scale-toggle [role="radio"]').nth(1);
  await trueScale.click();
  await check('true scale switched on', async () => (await trueScale.getAttribute('aria-checked')) === 'true');
  await page.locator('.scale-toggle [role="radio"]').nth(0).click();
  await check('illustrative scale back on', async () => (await trueScale.getAttribute('aria-checked')) === 'false');

  await page.locator('.tool-settings').click();
  const orbitsSwitch = page.locator('.setting-row input').first();
  await orbitsSwitch.click();
  await check('orbits can be turned off', async () => !(await orbitsSwitch.isChecked()));
  await orbitsSwitch.click();
  await page.keyboard.press('Escape');
  await check('Esc closes settings and returns focus to its button', async () => await count('.settings-panel') === 0 && await activeHasClass('tool-settings'));

  await page.locator('.rail-item[data-body="earth"]').click();
  await check('card opens for Earth again', async () => await count('.body-card') === 1);
  await page.keyboard.press('Escape');
  await check('Esc closes the body card when no panel is open', async () => await count('.body-card') === 0);

  await page.locator('.tool-help').click();
  await check('help dialog opens', async () => await count('.help-dialog') === 1);
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  await check('help dialog keeps keyboard focus inside', () => page.evaluate(() => Boolean(document.activeElement?.closest('.help-dialog'))));
  await page.keyboard.press('Escape');
  await check('Esc closes help and returns focus to its button', async () => await count('.dialog-backdrop') === 0 && await activeHasClass('tool-help'));

  // Языки: смена в меню переводит интерфейс, карточку, хронику и язык документа, выбор переживает перезагрузку.
  const chooseLanguage = async code => {
    await page.locator('.language-button').click();
    await page.locator(`.language-list [lang="${code}"]`).click();
  };
  await page.locator('.rail-item[data-body="earth"]').click();
  const expectedEarth = { ru: 'Земля', de: 'Erde', fr: 'Terre', zh: '地球' };
  for (const [code, earth] of Object.entries(expectedEarth)) {
    await chooseLanguage(code);
    await check(`${code}: card in the chosen language`, async () => await text('.card-name') === earth);
    await check(`${code}: scene label translated`, async () => await page.locator('.scene-label', { hasText: earth }).count() === 1);
    await check(`${code}: document language`, async () => (await page.evaluate(() => document.documentElement.lang)).startsWith(code));
  }
  await check('zh: date in Chinese format', async () => /\d+年\d+月\d+日/.test(await text('.deck-date-value')));
  await chooseLanguage('ru');
  await page.locator('.event-launcher').click();
  await page.locator('.sheet-tabs [role="tab"]').nth(1).click();
  await check('chronicle re-read in the new language', async () => {
    const chronicle = await text('.chronicle-list');
    return chronicle.includes('Незваная бездна') && !chronicle.includes('Uninvited');
  });
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.intro', { state: 'detached', timeout: SCENE_READY_TIMEOUT_MS });
  await check('language choice persists', async () => (await page.evaluate(() => document.documentElement.lang)) === 'ru-RU');
  await chooseLanguage('en');

  // Потеря контекста WebGL (сброс драйвера, сон ноутбука): поверхности планет жили только
  // в видеопамяти и должны запечься заново, а не остаться чёрными дисками.
  await page.locator('.rail-item[data-body="jupiter"]').click();
  await page.waitForTimeout(4500);
  const disk = { x: 640, y: 370, width: 120, height: 120 };
  const litBefore = await brightness(page, disk);
  await page.evaluate(() => {
    window.__loseContext = document.querySelector('.stage canvas').getContext('webgl2').getExtension('WEBGL_lose_context');
    window.__loseContext.loseContext();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__loseContext.restoreContext());
  await page.waitForFunction(() => document.querySelector('.stage').dataset.sceneReady === 'true', null, { timeout: SCENE_READY_TIMEOUT_MS });
  await check('planets are drawn again after the WebGL context is restored', async () => await brightness(page, disk) > litBefore * 0.7);

  await page.setViewportSize({ width: 360, height: 740 });
  await check('no horizontal scroll on a phone', async () => !(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
  await check('top bar fits a 360 px phone', () => page.evaluate(() =>
    [...document.querySelectorAll('.top-bar button')].every(b => b.getBoundingClientRect().right <= innerWidth)));

  await check(`no console errors${errors.length ? ': ' + errors.join(' | ') : ''}`, async () => errors.length === 0, 0);
  await browser.close();
  if (failures) {
    console.log(`\nFailed: ${failures}`);
    process.exit(1);
  }
  console.log('\nAll checks passed');
})().catch(e => { console.error(e); process.exit(1); });
