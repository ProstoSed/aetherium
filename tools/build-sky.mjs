// Подготовка настоящего неба из каталогов d3-celestial (BSD-3-Clause).
// Запуск: node tools/build-sky.mjs
//
// Сырые GeoJSON весят десятки мегабайт, а сборка — один HTML-файл. Поэтому:
// - звёзды упаковываются по 6 байт (RA, Dec, звёздная величина, показатель цвета B−V);
// - контуры Млечного Пути растеризуются в равнопромежуточную текстуру PNG;
// - линии и названия созвездий, туманности и галактики — компактные массивы.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import path from 'node:path';

const DATA = 'node_modules/d3-celestial/data';
const OUT_TS = 'src/data/sky/skyCatalog.generated.ts';
const OUT_PNG = 'src/assets/sky/milkyway.png';
const MILKY_WAY_WIDTH = 2048;
const MILKY_WAY_HEIGHT = 1024;
const MILKY_WAY_BLUR_PX = 5;
/** Туманности крупнее этого (угловые минуты) попадают на небо; мелкие не видны даже с увеличением. */
const MIN_NEBULA_ARCMIN = 5;
const MIN_GALAXY_ARCMIN = 12;

const read = file => JSON.parse(readFileSync(path.join(DATA, file), 'utf8'));
/** В d3-celestial долгота — это RA в градусах, сдвинутое в −180…180. */
const raOf = lon => (lon < 0 ? lon + 360 : lon);
const round = (value, digits = 2) => Number(value.toFixed(digits));

// --- Звёзды -------------------------------------------------------------------
const stars = read('stars.8.json').features;
const packed = Buffer.alloc(stars.length * 6);
stars.forEach((star, i) => {
  const [lon, dec] = star.geometry.coordinates;
  const bv = Number.parseFloat(star.properties.bv);
  packed.writeUInt16LE(Math.round((raOf(lon) / 360) * 65535), i * 6);
  packed.writeInt16LE(Math.round((dec / 90) * 32767), i * 6 + 2);
  packed.writeUInt8(Math.max(0, Math.min(255, Math.round((star.properties.mag + 2) * 25))), i * 6 + 4);
  packed.writeUInt8(Number.isFinite(bv) ? Math.max(0, Math.min(255, Math.round((bv + 0.5) * 100))) : 115, i * 6 + 5);
});

// --- Созвездия -----------------------------------------------------------------
const lines = read('constellations.lines.json').features.map(feature => ({
  id: feature.id,
  segments: feature.geometry.coordinates.map(line => line.flatMap(([lon, dec]) => [round(raOf(lon)), round(dec)])),
}));
const names = read('constellations.json').features.map(feature => ({
  id: feature.id,
  name: feature.properties.ru || feature.properties.name,
  rank: Number(feature.properties.rank),
  ra: round(raOf(feature.geometry.coordinates[0])),
  dec: round(feature.geometry.coordinates[1]),
}));

// --- Туманности и галактики ----------------------------------------------------
const dimensions = dim => String(dim).split('x').map(Number.parseFloat).filter(Number.isFinite);
const NEBULA_TYPES = { sfr: 'emission', en: 'emission', bn: 'emission', rn: 'reflection', pn: 'planetary', snr: 'remnant' };
const GALAXY_TYPES = new Set(['s', 'sd', 'e', 'i', 'sb']);
const deepSky = [];
const seen = new Set();
const addObject = (feature, fallbackName) => {
  const p = feature.properties;
  const [major, minor = major] = dimensions(p.dim);
  const kind = NEBULA_TYPES[p.type] ?? (GALAXY_TYPES.has(p.type) ? 'galaxy' : null);
  if (!kind || !major) return;
  if (kind === 'galaxy' ? major < MIN_GALAXY_ARCMIN : major < MIN_NEBULA_ARCMIN) return;
  const key = `${round(feature.geometry.coordinates[0], 1)}:${round(feature.geometry.coordinates[1], 1)}`;
  if (seen.has(key)) return;
  seen.add(key);
  deepSky.push({
    id: feature.id,
    name: p.alt || fallbackName || p.desig || feature.id,
    kind,
    ra: round(raOf(feature.geometry.coordinates[0])),
    dec: round(feature.geometry.coordinates[1]),
    major: round(major, 1),
    minor: round(minor, 1),
  });
};
read('messier.json').features.forEach(feature => addObject(feature));
const FAMOUS = { 'NGC 3372': 'Туманность Киля', 'NGC 7000': 'Северная Америка', 'NGC 1499': 'Калифорния', 'IC 2944': 'Бегущий цыплёнок', 'PGC 17223': 'Большое Магелланово Облако', 'NGC 292': 'Малое Магелланово Облако' };
read('dsos.6.json').features.filter(feature => FAMOUS[feature.id]).forEach(feature => addObject(feature, FAMOUS[feature.id]));

// --- Млечный Путь: пять вложенных уровней яркости -------------------------------
const brightness = new Float32Array(MILKY_WAY_WIDTH * MILKY_WAY_HEIGHT);
const LEVEL_WEIGHT = { ol1: 0.12, ol2: 0.18, ol3: 0.22, ol4: 0.24, ol5: 0.24 };
for (const feature of read('milkyway.json').features) {
  const weight = LEVEL_WEIGHT[feature.id] ?? 0.2;
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  for (const rings of polygons) fillPolygon(rings, weight);
}
blurWrapped(brightness, MILKY_WAY_WIDTH, MILKY_WAY_HEIGHT, MILKY_WAY_BLUR_PX);

/**
 * Чётно-нечётная заливка на периодическом небе. Края полосы обходят небо по кругу, и такое
 * кольцо не замкнуто в развёрнутых координатах, поэтому обычная заливка строк не годится.
 * Чётность в начале строки (у шва RA = 0) отсчитывается от северного полюса мира, который
 * лежит вне Млечного Пути: сколько раз контур пересёк шов выше этой строки.
 */
function fillPolygon(rings, weight) {
  const wrap = x => ((x % MILKY_WAY_WIDTH) + MILKY_WAY_WIDTH) % MILKY_WAY_WIDTH;
  const edges = [];
  const seamCrossingsY = [];
  for (const ring of rings) {
    let previous = null;
    const points = ring.map(([lon, dec]) => {
      let ra = raOf(lon);
      if (previous !== null) {
        while (ra - previous > 180) ra -= 360;
        while (previous - ra > 180) ra += 360;
      }
      previous = ra;
      return [(ra / 360) * MILKY_WAY_WIDTH, ((90 - dec) / 180) * MILKY_WAY_HEIGHT];
    });
    for (let i = 0; i + 1 < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[i + 1];
      edges.push([x1, y1, x2, y2]);
      // Пересечение шва — переход через кратное ширине (развёрнутые координаты непрерывны).
      const k1 = Math.floor(x1 / MILKY_WAY_WIDTH), k2 = Math.floor(x2 / MILKY_WAY_WIDTH);
      if (k1 !== k2) {
        const seamX = Math.max(k1, k2) * MILKY_WAY_WIDTH;
        seamCrossingsY.push(y1 + ((seamX - x1) / (x2 - x1)) * (y2 - y1));
      }
    }
  }
  for (let y = 0; y < MILKY_WAY_HEIGHT; y++) {
    const scan = y + 0.5;
    const crossings = [];
    for (const [x1, y1, x2, y2] of edges) {
      if ((y1 <= scan && y2 > scan) || (y2 <= scan && y1 > scan)) crossings.push(wrap(x1 + ((scan - y1) / (y2 - y1)) * (x2 - x1)));
    }
    crossings.sort((a, b) => a - b);
    let inside = seamCrossingsY.filter(seamY => seamY < scan).length % 2 === 1;
    let cursor = 0;
    for (const crossing of [...crossings, MILKY_WAY_WIDTH]) {
      const end = Math.round(crossing);
      if (inside) for (let x = cursor; x < end; x++) brightness[y * MILKY_WAY_WIDTH + x] += weight;
      cursor = end;
      inside = !inside;
    }
  }
}

function blurWrapped(data, width, height, radius) {
  const temp = new Float32Array(data.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let x = -radius; x <= radius; x++) sum += data[y * width + ((x + width) % width)];
      for (let x = 0; x < width; x++) {
        temp[y * width + x] = sum / (radius * 2 + 1);
        sum += data[y * width + ((x + radius + 1) % width)] - data[y * width + ((x - radius + width) % width)];
      }
    }
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += temp[Math.min(height - 1, Math.max(0, y)) * width + x];
      for (let y = 0; y < height; y++) {
        data[y * width + x] = sum / (radius * 2 + 1);
        sum += temp[Math.min(height - 1, y + radius + 1) * width + x] - temp[Math.max(0, y - radius) * width + x];
      }
    }
  }
}

function writeGrayPng(file, data, width, height) {
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0;
    for (let x = 0; x < width; x++) raw[y * (width + 1) + 1 + x] = Math.round(Math.min(1, data[y * width + x]) * 255);
  }
  const chunk = (type, payload) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(payload.length);
    const body = Buffer.concat([Buffer.from(type), payload]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(8, 8); // глубина цвета
  header.writeUInt8(0, 9); // оттенки серого
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, png);
  return png.length;
}

const pngBytes = writeGrayPng(OUT_PNG, brightness, MILKY_WAY_WIDTH, MILKY_WAY_HEIGHT);
mkdirSync(path.dirname(OUT_TS), { recursive: true });
writeFileSync(OUT_TS, `// Сгенерировано tools/build-sky.mjs из каталогов d3-celestial (BSD-3-Clause). Не править руками.
// Звёзды: XHIP (Anderson & Francis 2012) до 8,5 величины. Созвездия: IAU. Млечный Путь: Milky Way Outline Catalog, J. R. Vieira.
// Туманности и галактики: Messier (H. Frommert, SEDS), Saguaro Astronomy Club.

/** ${stars.length} звёзд по 6 байт: RA uint16 (доля круга), Dec int16 (доля 90°), (mag + 2)·25 uint8, (B−V + 0,5)·100 uint8. */
export const STARS_BASE64 = '${packed.toString('base64')}';
export const STAR_COUNT = ${stars.length};

/** Линии созвездий: для каждого — ломаные в виде плоских пар [RA°, Dec°, …]. */
export const CONSTELLATION_LINES: { id: string; segments: number[][] }[] = ${JSON.stringify(lines)};

export const CONSTELLATION_NAMES: { id: string; name: string; rank: number; ra: number; dec: number }[] = ${JSON.stringify(names)};

export type DeepSkyKind = 'emission' | 'reflection' | 'planetary' | 'remnant' | 'galaxy';
/** Размеры — в угловых минутах. */
export const DEEP_SKY: { id: string; name: string; kind: DeepSkyKind; ra: number; dec: number; major: number; minor: number }[] = ${JSON.stringify(deepSky)};
`);
console.log(`stars ${stars.length} (${packed.length} B), constellations ${lines.length}, deep sky ${deepSky.length}, milky way png ${pngBytes} B`);
