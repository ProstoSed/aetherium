// Подготовка карт Земли из снимков NASA Earth Observatory.
// Запуск: node tools/build-earth.cjs
//
// Исходники (не хранятся в репозитории, скачать в tools/sources/nasa):
//   world.topo.bathy.200407.3x5400x2700.jpg — Blue Marble: Next Generation, июль
//     https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/july/world.topo.bathy.200407.3x5400x2700.jpg
//   gebco_08_rev_elev_5400x2700.jpg — рельеф суши (GEBCO)
//     https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/topography/gebco_08_rev_elev_5400x2700.jpg
//   BlackMarble_2016_01deg.jpg — Земля ночью, 2016
//     https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144898/BlackMarble_2016_01deg.jpg
//
// Картинки уменьшаются и пережимаются настоящим Chrome через canvas: сборка остаётся одним
// файлом, а отдельная библиотека обработки изображений не нужна.
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const SOURCES = 'tools/sources/nasa';
const OUT = 'src/assets/earth';
const MAPS = [
  { source: 'world.topo.bathy.200407.3x5400x2700.jpg', out: 'color.jpg', width: 4096, height: 2048, quality: 0.88 },
  { source: 'gebco_08_rev_elev_5400x2700.jpg', out: 'elevation.jpg', width: 2048, height: 1024, quality: 0.92 },
  { source: 'BlackMarble_2016_01deg.jpg', out: 'night.jpg', width: 2048, height: 1024, quality: 0.86 },
];
/** Точки для проверки кодировки карт: долгота, широта. */
const PROBES = { 'Гвинейский залив (океан)': [0, 0], 'Эверест': [86.9, 27.9], 'Сахара': [10, 23], 'Нидерланды': [5, 52.3], 'Токио ночью': [139.7, 35.7], 'Тихий океан': [-150, 0] };

(async () => {
  for (const map of MAPS) {
    if (!fs.existsSync(path.join(SOURCES, map.source))) {
      console.error(`Нет исходника ${path.join(SOURCES, map.source)} — скачайте по ссылке в начале файла.`);
      process.exit(1);
    }
  }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.goto('about:blank');

  for (const map of MAPS) {
    const dataUrl = `data:image/jpeg;base64,${fs.readFileSync(path.join(SOURCES, map.source)).toString('base64')}`;
    const result = await page.evaluate(async ({ dataUrl, map, probes }) => {
      const image = new Image();
      image.src = dataUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = map.width;
      canvas.height = map.height;
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, 0, 0, map.width, map.height);
      const samples = {};
      for (const [name, [lon, lat]] of Object.entries(probes)) {
        const x = Math.floor(((lon + 180) / 360) * map.width);
        const y = Math.floor(((90 - lat) / 180) * map.height);
        samples[name] = Array.from(context.getImageData(x, y, 1, 1).data.slice(0, 3));
      }
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', map.quality));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { base64: btoa(binary), samples, sourceSize: [image.naturalWidth, image.naturalHeight] };
    }, { dataUrl, map, probes: PROBES });
    const file = path.join(OUT, map.out);
    fs.writeFileSync(file, Buffer.from(result.base64, 'base64'));
    console.log(`${map.out}: ${result.sourceSize.join('×')} → ${map.width}×${map.height}, ${fs.statSync(file).size} B`, JSON.stringify(result.samples));
  }
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
