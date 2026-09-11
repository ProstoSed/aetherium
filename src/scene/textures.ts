import * as THREE from 'three';
import type { BodyId } from '../data/bodies';

/**
 * Процедурные поверхности. Внешних картинок нет: сборка остаётся одним файлом,
 * который открывается без сети. Текстура рисуется один раз при запуске.
 */
const TEXTURE_WIDTH = 1024;
const TEXTURE_HEIGHT = 512;

/** Детерминированный генератор: одинаковые поверхности при каждом запуске. */
function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Value-noise на решётке 256×256 с периодом по X — шов на меридиане не виден. */
function createNoise(seed: number) {
  const random = seededRandom(seed);
  const size = 256;
  const grid = new Float32Array(size * size).map(() => random());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const at = (x: number, y: number) => grid[((y % size) + size) % size * size + ((x % size) + size) % size];
  const sample = (x: number, y: number, periodX: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = smooth(x - x0), fy = smooth(y - y0);
    const wrap = (v: number) => ((v % periodX) + periodX) % periodX;
    const a = at(wrap(x0), y0), b = at(wrap(x0 + 1), y0);
    const c = at(wrap(x0), y0 + 1), d = at(wrap(x0 + 1), y0 + 1);
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
  };
  /** Фрактальный шум: u ∈ [0,1) по долготе, v ∈ [0,1] по широте. Возвращает ≈[0,1]. */
  return (u: number, v: number, baseFrequency: number, octaves = 5) => {
    let amplitude = 0.5, frequency = baseFrequency, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amplitude * sample(u * frequency, v * frequency * 0.5, frequency);
      norm += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    return sum / norm;
  };
}

type Rgb = [number, number, number];
const hex = (value: string): Rgb => {
  const c = new THREE.Color(value);
  return [c.r * 255, c.g * 255, c.b * 255];
};
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

type SurfacePainter = (u: number, v: number, noise: ReturnType<typeof createNoise>) => Rgb;

/** Полосы газовых гигантов: цвет по широте, искажённый турбулентностью. */
function bandedPainter(palette: string[], turbulence: number, bandCount: number): SurfacePainter {
  const colors = palette.map(hex);
  return (u, v, noise) => {
    const warp = (noise(u, v, 6, 4) - 0.5) * turbulence;
    const band = (Math.sin((v + warp) * Math.PI * bandCount) * 0.5 + 0.5) * (colors.length - 1);
    const i = Math.floor(band);
    const base = mix(colors[i], colors[Math.min(colors.length - 1, i + 1)], band - i);
    const detail = 0.9 + noise(u, v, 32, 3) * 0.2;
    return [base[0] * detail, base[1] * detail, base[2] * detail];
  };
}

function rockyPainter(dark: string, light: string, frequency: number): SurfacePainter {
  const a = hex(dark), b = hex(light);
  return (u, v, noise) => {
    const n = noise(u, v, frequency, 6);
    const ridges = 1 - Math.abs(noise(u + 0.37, v, frequency * 2, 4) * 2 - 1);
    return mix(a, b, clamp01(n * 1.3 - 0.15 + ridges * 0.15));
  };
}

const PAINTERS: Partial<Record<BodyId, SurfacePainter>> = {
  mercury: rockyPainter('#4e4a45', '#b3ab9d', 10),
  moon: rockyPainter('#55534f', '#c9c5bc', 9),
  venus: bandedPainter(['#b98f4f', '#e3c68b', '#d6ad6a', '#f0dcae'], 0.5, 7),
  mars: (u, v, noise) => {
    const base = rockyPainter('#6e2f19', '#d08556', 8)(u, v, noise);
    const polar = v < 0.07 + noise(u, v, 12, 3) * 0.04 || v > 0.94 - noise(u, v, 12, 3) * 0.03;
    return polar ? mix(base, [236, 230, 222], 0.85) : base;
  },
  jupiter: (u, v, noise) => {
    const base = bandedPainter(['#8a5a3b', '#e2c7a2', '#b77f55', '#f1e0c4', '#9d6a47', '#d9b48b'], 0.22, 14)(u, v, noise);
    // Большое Красное Пятно — овал в южном полушарии.
    const dx = (u - 0.62) * 7, dy = (v - 0.64) * 18;
    const spot = dx * dx + dy * dy;
    return spot < 1 ? mix(base, [178, 88, 56], clamp01(1 - spot) * 0.85) : base;
  },
  saturn: bandedPainter(['#b99a67', '#e8d4a8', '#cfb27c', '#f3e6c6'], 0.12, 12),
  uranus: bandedPainter(['#86bfc6', '#a4d4d8', '#93c8ce'], 0.08, 5),
  neptune: (u, v, noise) => {
    const base = bandedPainter(['#2f55a8', '#4f7ed0', '#3a66b8', '#6d98dc'], 0.3, 6)(u, v, noise);
    const dx = (u - 0.3) * 9, dy = (v - 0.6) * 20;
    return dx * dx + dy * dy < 1 ? mix(base, [22, 36, 88], 0.7) : base;
  },
  earth: (u, v, noise) => {
    const land = noise(u, v, 5, 6);
    const latitude = Math.abs(v - 0.5) * 2;
    const ocean = mix(hex('#0d2f5c'), hex('#1c5b8c'), noise(u, v, 12, 3));
    const green = mix(hex('#2f5a2b'), hex('#8a7a4a'), clamp01(noise(u + 0.5, v, 9, 4) * 1.4 - 0.3 + (1 - latitude) * 0.25));
    let color = land > 0.53 ? green : ocean;
    if (latitude > 0.84 + noise(u, v, 10, 3) * 0.08) color = [232, 238, 242];
    const cloud = noise(u + 0.21, v, 8, 5);
    return cloud > 0.58 ? mix(color, [245, 247, 250], clamp01((cloud - 0.58) * 4)) : color;
  },
};

/** Рисует текстуру попиксельно; painter возвращает значения 0…255 по каналам. */
function paintTexture(painter: (u: number, v: number) => Rgb, colorTexture: boolean): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = TEXTURE_WIDTH;
  canvas.height = TEXTURE_HEIGHT;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(TEXTURE_WIDTH, TEXTURE_HEIGHT);
  for (let y = 0; y < TEXTURE_HEIGHT; y++) {
    const v = y / (TEXTURE_HEIGHT - 1);
    for (let x = 0; x < TEXTURE_WIDTH; x++) {
      const [r, g, b] = painter(x / TEXTURE_WIDTH, v);
      const i = (y * TEXTURE_WIDTH + x) * 4;
      image.data[i] = r; image.data[i + 1] = g; image.data[i + 2] = b; image.data[i + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  if (colorTexture) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export type SurfaceMaps = { map: THREE.Texture; bumpMap?: THREE.Texture; roughnessMap?: THREE.Texture; emissiveMap?: THREE.Texture };

const ROCKY_WITH_RELIEF: BodyId[] = ['mercury', 'moon', 'mars'];
const EARTH_LAND_THRESHOLD = 0.53;

export function createSurfaceMaps(id: BodyId, seed: number): SurfaceMaps {
  const noise = createNoise(seed);
  const painter = PAINTERS[id];
  const maps: SurfaceMaps = { map: paintTexture((u, v) => (painter ? painter(u, v, noise) : [200, 200, 200]), true) };

  if (ROCKY_WITH_RELIEF.includes(id)) {
    // Рельеф из того же шума, что и цвет: иначе тени легли бы мимо пятен.
    maps.bumpMap = paintTexture((u, v) => {
      const ridges = 1 - Math.abs(noise(u + 0.37, v, 20, 4) * 2 - 1);
      const h = clamp01(noise(u, v, 10, 6) * 0.7 + ridges * 0.3) * 255;
      return [h, h, h];
    }, false);
  }

  if (id === 'earth') {
    // Океан гладкий и даёт солнечный блик, суша матовая.
    maps.roughnessMap = paintTexture((u, v) => {
      const r = noise(u, v, 5, 6) > EARTH_LAND_THRESHOLD ? 235 : 95;
      return [r, r, r];
    }, false);
    // Огни городов: редкие тёплые точки на суше умеренных широт, скученные шумом.
    const random = seededRandom(seed * 7);
    maps.emissiveMap = paintTexture((u, v) => {
      const latitude = Math.abs(v - 0.5) * 2;
      const onLand = noise(u, v, 5, 6) > EARTH_LAND_THRESHOLD + 0.01;
      const populated = onLand && latitude < 0.72 && noise(u + 0.7, v, 14, 3) > 0.52;
      const light = populated && random() > 0.93 ? 120 + random() * 110 : 0;
      return [light, light * 0.72, light * 0.38];
    }, true);
  }
  return maps;
}

/** Радиальный градиент для свечения: яркое ядро и долгий спад. */
export function createGlowTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.08, 'rgba(255,240,200,0.9)');
  gradient.addColorStop(0.25, 'rgba(255,190,110,0.35)');
  gradient.addColorStop(0.55, 'rgba(255,140,60,0.08)');
  gradient.addColorStop(1, 'rgba(255,120,40,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/** Кольца: радиальная полоса с щелью Кассини и неравномерной плотностью. */
export function createRingTexture(seed: number, withCassiniGap: boolean): THREE.Texture {
  const width = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = 4;
  const context = canvas.getContext('2d')!;
  const random = seededRandom(seed);
  let density = 0.6;
  for (let x = 0; x < width; x++) {
    const t = x / width;
    density = clamp01(density + (random() - 0.5) * 0.18);
    let alpha = 0.25 + density * 0.7;
    // Щель Кассини и деление Энке в долях ширины колец C–A.
    if (withCassiniGap && t > 0.62 && t < 0.675) alpha *= 0.08;
    if (withCassiniGap && t > 0.93 && t < 0.94) alpha *= 0.2;
    if (t < 0.28) alpha *= 0.35 + t;
    const shade = 200 + density * 45;
    context.fillStyle = `rgba(${shade},${shade * 0.92},${shade * 0.78},${alpha})`;
    context.fillRect(x, 0, 1, 4);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
