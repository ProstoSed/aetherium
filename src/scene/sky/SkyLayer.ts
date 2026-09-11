import * as THREE from 'three';
import milkyWayUrl from '../../assets/sky/milkyway.png';
import { CONSTELLATION_LINES, CONSTELLATION_NAMES, DEEP_SKY, STAR_COUNT, STARS_BASE64, type DeepSkyKind } from '../../data/sky/skyCatalog.generated';
import { OBLIQUITY_J2000 } from '../../data/orbitalElements';
import { equatorialToScene } from '../../physics/kepler';

/**
 * Настоящее небо: 41 тыс. звёзд до 8,5 величины (XHIP), Млечный Путь по контурам яркости,
 * туманности и галактики на своих местах, линии и названия созвездий.
 *
 * Небо рисуется отдельным проходом перед сценой, камерой с тем же поворотом, но без переноса.
 * Звёзды поэтому всегда позади планет: в одном проходе прозрачные точки рисовались бы после
 * непрозрачных тел и ложились поверх них, а отключённая проверка глубины это только прятала.
 */
const NAMED_CONSTELLATION_MAX_RANK = 2;
const DEEP_SKY_SIZE_EXAGGERATION = 2;
const DEEP_SKY_MIN_ARCMIN = 45;
const DEEP_SKY_MAX_ARCMIN = 360;
const ARCMIN = Math.PI / (180 * 60);
const DEEP_SKY_KIND_INDEX: Record<DeepSkyKind, number> = { emission: 0, reflection: 1, planetary: 2, remnant: 3, galaxy: 4 };

const toVector = (ra: number, dec: number) => {
  const v = equatorialToScene(ra, dec);
  return new THREE.Vector3(v.x, v.y, v.z);
};

/**
 * Цвет звезды по показателю B−V: сначала температура (формула Бальестероса, 2012),
 * затем цвет абсолютно чёрного тела (приближение Таннера Хелланда).
 */
function starColor(bv: number, out: THREE.Color): THREE.Color {
  const temperature = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  const t = temperature / 100;
  const red = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const green = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const blue = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const clamp = (v: number) => Math.min(255, Math.max(0, v)) / 255;
  return out.setRGB(clamp(red), clamp(green), clamp(blue), THREE.SRGBColorSpace);
}

function createStars(): THREE.Points {
  const bytes = Uint8Array.from(atob(STARS_BASE64), c => c.charCodeAt(0));
  const data = new DataView(bytes.buffer);
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const magnitudes = new Float32Array(STAR_COUNT);
  const color = new THREE.Color();
  for (let i = 0; i < STAR_COUNT; i++) {
    const ra = (data.getUint16(i * 6, true) / 65535) * 360;
    const dec = (data.getInt16(i * 6 + 2, true) / 32767) * 90;
    toVector(ra, dec).toArray(positions, i * 3);
    magnitudes[i] = data.getUint8(i * 6 + 4) / 25 - 2;
    starColor(data.getUint8(i * 6 + 5) / 100 - 0.5, color).toArray(colors, i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('magnitude', new THREE.BufferAttribute(magnitudes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { pixelRatio: { value: 1 }, brightness: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float magnitude;
      uniform float pixelRatio;
      uniform float brightness;
      varying vec3 vColor;
      varying float vSpikes;
      void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // Поток света ∝ 10^(−0,4·m). Размер растёт медленнее яркости, иначе яркие звёзды — пятна.
        float flux = pow(10.0, -0.4 * (magnitude - 1.0));
        gl_PointSize = clamp(1.6 + sqrt(flux) * 3.4, 1.4, 11.0) * pixelRatio;
        // Восприятие яркости ближе к степени 0,5 от потока: иначе звёзды слабее 4-й величины не видны вовсе.
        vColor = color * clamp(pow(flux, 0.5) * 1.5, 0.12, 3.0) * brightness;
        vSpikes = smoothstep(1.5, -0.5, magnitude);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vSpikes;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float r = length(p);
        float core = exp(-r * r * 60.0);
        float halo = exp(-r * r * 14.0) * 0.35;
        // Лучи дифракции у самых ярких звёзд — как на снимках через объектив.
        float spikes = (exp(-abs(p.x) * 70.0) + exp(-abs(p.y) * 70.0)) * smoothstep(0.5, 0.0, r) * vSpikes * 0.6;
        float intensity = core + halo + spikes;
        if (intensity < 0.003) discard;
        gl_FragColor = vec4(vColor * intensity, 1.0);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 3;
  return points;
}

function createMilkyWay(): THREE.Mesh {
  const texture = new THREE.TextureLoader().load(milkyWayUrl);
  // Без мип-уровней: на шве RA = 0 производная координаты скачет, и мип-уровень рисовал бы линию.
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.RepeatWrapping;
  const material = new THREE.ShaderMaterial({
    uniforms: { milkyWay: { value: texture }, obliquity: { value: THREE.MathUtils.degToRad(OBLIQUITY_J2000) }, brightness: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D milkyWay;
      uniform float obliquity;
      uniform float brightness;
      varying vec3 vDirection;

      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      float fbm(vec3 p) {
        float s = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.07; a *= 0.5; }
        return s;
      }

      void main() {
        vec3 d = normalize(vDirection);
        // Оси сцены → эклиптика (x, −z, y) → экватор поворотом на наклон эклиптики.
        vec3 ecliptic = vec3(d.x, -d.z, d.y);
        float ce = cos(obliquity), se = sin(obliquity);
        vec3 equatorial = vec3(ecliptic.x, ecliptic.y * ce - ecliptic.z * se, ecliptic.y * se + ecliptic.z * ce);
        float ra = atan(equatorial.y, equatorial.x);
        float dec = asin(clamp(equatorial.z, -1.0, 1.0));
        vec2 uv = vec2(fract(ra / 6.2831853), dec / 3.14159265 + 0.5);
        float band = texture2D(milkyWay, uv).r;
        // Звёздная «зернистость» и пылевые прожилки внутри полосы.
        float grain = fbm(d * 60.0);
        float dust = smoothstep(0.35, 0.75, fbm(d * 14.0 + 3.0));
        float glow = pow(band, 1.25) * (0.55 + 0.6 * grain) * (1.0 - dust * 0.45);
        vec3 core = vec3(1.0, 0.82, 0.62);
        vec3 arm = vec3(0.62, 0.72, 1.0);
        vec3 color = mix(arm, core, smoothstep(0.35, 0.9, band)) * glow;
        gl_FragColor = vec4(color * 0.42 * brightness, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 32), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 0;
  return mesh;
}

/** Туманности и галактики: процедурные изображения на местах настоящих объектов, размер увеличен. */
function createDeepSky(): THREE.Mesh {
  const positions: number[] = [];
  const uvs: number[] = [];
  const kinds: number[] = [];
  const seeds: number[] = [];
  const indices: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  DEEP_SKY.forEach((object, i) => {
    const center = toVector(object.ra, object.dec).multiplyScalar(4.5);
    const normal = center.clone().normalize();
    const east = new THREE.Vector3().crossVectors(up, normal).normalize();
    const north = new THREE.Vector3().crossVectors(normal, east);
    const rotation = (i * 2.399) % Math.PI;
    const axisA = east.clone().multiplyScalar(Math.cos(rotation)).addScaledVector(north, Math.sin(rotation));
    const axisB = new THREE.Vector3().crossVectors(normal, axisA);
    const major = THREE.MathUtils.clamp(object.major * DEEP_SKY_SIZE_EXAGGERATION, DEEP_SKY_MIN_ARCMIN, DEEP_SKY_MAX_ARCMIN) * ARCMIN * 4.5;
    const minor = major * Math.max(0.35, object.minor / object.major);
    const base = positions.length / 3;
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const corner = center.clone().addScaledVector(axisA, u * major).addScaledVector(axisB, v * minor);
      positions.push(corner.x, corner.y, corner.z);
      uvs.push(u, v);
      kinds.push(DEEP_SKY_KIND_INDEX[object.kind]);
      seeds.push(i * 7.13);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('kind', new THREE.Float32BufferAttribute(kinds, 1));
  geometry.setAttribute('seed', new THREE.Float32BufferAttribute(seeds, 1));
  geometry.setIndex(indices);
  const material = new THREE.ShaderMaterial({
    uniforms: { brightness: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float kind;
      attribute float seed;
      varying vec2 vUv;
      varying float vKind;
      varying float vSeed;
      void main() {
        vUv = uv;
        vKind = kind;
        vSeed = seed;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float brightness;
      varying vec2 vUv;
      varying float vKind;
      varying float vSeed;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float s = 0.0, a = 0.5;
        for (int i = 0; i < 5; i++) { s += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; }
        return s;
      }
      void main() {
        vec2 p = vUv;
        float r = length(p);
        if (r > 1.0) discard;
        vec2 q = p * 2.2 + vSeed;
        float clouds = fbm(q + fbm(q * 1.7) * 1.4);
        float edge = smoothstep(1.0, 0.25, r);
        vec3 color;
        if (vKind < 0.5) {
          // Эмиссионная: водород светится красным, горячее ядро голубовато-белое, пыль режет прожилками.
          float density = pow(clouds, 1.6) * edge * 1.8;
          float lanes = smoothstep(0.55, 0.75, fbm(q * 2.8 + 4.0));
          color = mix(vec3(0.95, 0.22, 0.32), vec3(0.55, 0.85, 1.0), exp(-r * r * 9.0) * 0.8) * density * (1.0 - lanes * 0.7);
        } else if (vKind < 1.5) {
          color = vec3(0.35, 0.55, 1.0) * pow(clouds, 1.8) * edge * 1.6;
        } else if (vKind < 2.5) {
          float shell = exp(-pow((r - 0.55) * 6.0, 2.0));
          color = (mix(vec3(0.2, 0.9, 0.85), vec3(1.0, 0.3, 0.3), smoothstep(0.45, 0.7, r)) * shell + vec3(0.3, 0.8, 0.9) * exp(-r * r * 20.0) * 0.4) * (0.7 + clouds * 0.6);
        } else if (vKind < 3.5) {
          float filaments = pow(1.0 - abs(noise(q * 3.0) * 2.0 - 1.0), 6.0);
          color = mix(vec3(1.0, 0.35, 0.3), vec3(0.4, 0.85, 1.0), noise(q)) * filaments * exp(-pow((r - 0.6) * 3.0, 2.0)) * 1.6;
        } else {
          // Галактика: тёплое ядро, голубоватый диск и намёк на спиральные рукава.
          float angle = atan(p.y, p.x);
          float arms = 0.6 + 0.4 * sin(angle * 2.0 - log(r + 0.05) * 5.0 + vSeed);
          color = vec3(1.0, 0.86, 0.7) * exp(-r * r * 30.0) * 1.4 + vec3(0.65, 0.75, 1.0) * exp(-r * 3.2) * arms * (0.5 + clouds * 0.5) * 0.7;
          color *= edge;
        }
        gl_FragColor = vec4(color * 0.16 * brightness, 1.0);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}

function createConstellationLines(): THREE.LineSegments {
  const vertices: number[] = [];
  for (const constellation of CONSTELLATION_LINES) {
    for (const line of constellation.segments) {
      for (let i = 0; i + 3 < line.length; i += 2) {
        const a = toVector(line[i], line[i + 1]).multiplyScalar(4.4);
        const b = toVector(line[i + 2], line[i + 3]).multiplyScalar(4.4);
        vertices.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xb8975a, transparent: true, opacity: 0.09, depthTest: false, depthWrite: false }));
  lines.frustumCulled = false;
  lines.renderOrder = 2;
  return lines;
}

function createConstellationNames(): THREE.Group {
  const group = new THREE.Group();
  group.renderOrder = 4;
  const build = () => {
    for (const constellation of CONSTELLATION_NAMES) {
      if (constellation.rank > NAMED_CONSTELLATION_MAX_RANK) continue;
      const text = constellation.name.replace(/\s+/g, ' ').toUpperCase();
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      const fontSize = 34;
      const font = `600 ${fontSize}px Manrope, "Segoe UI", sans-serif`;
      context.font = font;
      const letterSpacing = fontSize * 0.28;
      const width = Math.ceil([...text].reduce((sum, ch) => sum + context.measureText(ch).width + letterSpacing, 0));
      canvas.width = width + 16;
      canvas.height = fontSize + 16;
      context.font = font;
      context.fillStyle = 'rgba(226, 196, 138, 1)';
      context.textBaseline = 'middle';
      let x = 8;
      for (const ch of text) {
        context.fillText(ch, x, canvas.height / 2);
        x += context.measureText(ch).width + letterSpacing;
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.26, depthTest: false, depthWrite: false, sizeAttenuation: false }));
      const height = 0.018;
      sprite.scale.set(height * (canvas.width / canvas.height), height, 1);
      sprite.position.copy(toVector(constellation.ra, constellation.dec).multiplyScalar(4.3));
      sprite.renderOrder = 4;
      group.add(sprite);
    }
  };
  // Подписи рисуются шрифтом интерфейса — дождаться его загрузки, иначе останется системный.
  void document.fonts.ready.then(build);
  return group;
}

export class SkyLayer {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
  private readonly stars = createStars();
  private readonly milkyWay = createMilkyWay();
  private readonly deepSky = createDeepSky();
  private readonly lines = createConstellationLines();
  private readonly names = createConstellationNames();

  constructor() {
    this.scene.add(this.milkyWay, this.deepSky, this.lines, this.stars, this.names);
  }

  /** Поворот и перспектива — как у основной камеры; положение — всегда в центре небесной сферы. */
  update(mainCamera: THREE.PerspectiveCamera, pixelRatio: number, showConstellations: boolean) {
    this.camera.quaternion.copy(mainCamera.quaternion);
    if (this.camera.fov !== mainCamera.fov || this.camera.aspect !== mainCamera.aspect) {
      this.camera.fov = mainCamera.fov;
      this.camera.aspect = mainCamera.aspect;
      this.camera.updateProjectionMatrix();
    }
    this.camera.updateMatrixWorld();
    (this.stars.material as THREE.ShaderMaterial).uniforms.pixelRatio.value = pixelRatio;
    this.lines.visible = showConstellations;
    this.names.visible = showConstellations;
  }

  dispose() {
    this.scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      materials.forEach(material => {
        Object.values(material).forEach(value => { if (value instanceof THREE.Texture) value.dispose(); });
        material.dispose();
      });
    });
  }
}
