import * as THREE from 'three';
import type { BodyId } from '../../data/bodies';

/**
 * Кольца по настоящему радиальному профилю. Плотность (альфа) и цвет заданы по зонам:
 * у Сатурна — D, C, B, щель Кассини, A с делениями Энке и Килера, узкое F; у Урана — девять
 * узких тёмных колец, самое широкое — ε. Радиусы в километрах от центра планеты.
 */
type RingZone = { from: number; to: number; density: number; color: [number, number, number]; ringlets?: number };

export type RingProfile = { innerKm: number; outerKm: number; zones: RingZone[]; opacity: number; tint: [number, number, number] };

const SATURN: RingProfile = {
  innerKm: 66_900,
  outerKm: 140_600,
  opacity: 1,
  tint: [1, 1, 1],
  zones: [
    { from: 66_900, to: 74_500, density: 0.05, color: [0.55, 0.52, 0.48] },
    { from: 74_500, to: 92_000, density: 0.2, color: [0.6, 0.56, 0.5], ringlets: 0.5 },
    { from: 92_000, to: 104_000, density: 0.78, color: [0.84, 0.76, 0.62], ringlets: 0.35 },
    { from: 104_000, to: 117_580, density: 0.94, color: [0.9, 0.82, 0.67], ringlets: 0.25 },
    { from: 117_580, to: 120_000, density: 0.05, color: [0.5, 0.48, 0.45] },
    { from: 120_000, to: 120_300, density: 0.18, color: [0.6, 0.57, 0.52] },
    { from: 120_300, to: 122_170, density: 0.06, color: [0.5, 0.48, 0.45] },
    { from: 122_170, to: 133_400, density: 0.6, color: [0.8, 0.76, 0.68], ringlets: 0.2 },
    { from: 133_400, to: 133_720, density: 0.0, color: [0.5, 0.5, 0.5] },
    { from: 133_720, to: 136_480, density: 0.52, color: [0.78, 0.74, 0.67], ringlets: 0.2 },
    { from: 136_480, to: 136_775, density: 0.02, color: [0.5, 0.5, 0.5] },
    { from: 139_950, to: 140_450, density: 0.55, color: [0.82, 0.8, 0.76] },
  ],
};

const URANUS_RING = (center: number, width: number, density: number): RingZone => ({ from: center - width / 2, to: center + width / 2, density, color: [0.42, 0.42, 0.44] });
const URANUS: RingProfile = {
  innerKm: 41_000,
  outerKm: 51_400,
  opacity: 0.9,
  tint: [0.85, 0.9, 0.95],
  zones: [
    URANUS_RING(41_837, 60, 0.5), URANUS_RING(42_234, 60, 0.5), URANUS_RING(42_570, 60, 0.5),
    URANUS_RING(44_718, 90, 0.55), URANUS_RING(45_661, 110, 0.55), URANUS_RING(47_176, 60, 0.4),
    URANUS_RING(47_627, 60, 0.5), URANUS_RING(48_300, 80, 0.6), URANUS_RING(51_149, 220, 0.8),
  ],
};

export const RING_PROFILES: Partial<Record<BodyId, RingProfile>> = { saturn: SATURN, uranus: URANUS };

const RING_TEXTURE_WIDTH = 2048;

/** Радиальная текстура: цвет в sRGB, плотность в альфе. Мелкие колечки — шум внутри зоны. */
export function createRingTexture(profile: RingProfile, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = RING_TEXTURE_WIDTH;
  canvas.height = 1;
  const context = canvas.getContext('2d')!;
  const image = context.createImageData(RING_TEXTURE_WIDTH, 1);
  let s = seed;
  const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  let ringletNoise = 0.5;
  for (let x = 0; x < RING_TEXTURE_WIDTH; x++) {
    const km = profile.innerKm + ((x + 0.5) / RING_TEXTURE_WIDTH) * (profile.outerKm - profile.innerKm);
    const zone = profile.zones.find(z => km >= z.from && km < z.to);
    ringletNoise = Math.min(1, Math.max(0, ringletNoise + (random() - 0.5) * 0.35));
    let density = 0;
    let color: [number, number, number] = [0, 0, 0];
    if (zone) {
      // Края зон смягчены на ~2 текселя, иначе на удалении кольца мерцают лесенкой.
      const kmPerTexel = (profile.outerKm - profile.innerKm) / RING_TEXTURE_WIDTH;
      const edge = Math.min(1, (km - zone.from) / (kmPerTexel * 2), (zone.to - km) / (kmPerTexel * 2));
      const variation = zone.ringlets ? 1 - zone.ringlets + zone.ringlets * 2 * ringletNoise : 1;
      density = Math.min(1, zone.density * variation) * Math.max(0.3, edge);
      color = zone.color;
    }
    const i = x * 4;
    image.data[i] = color[0] * 255;
    image.data[i + 1] = color[1] * 255;
    image.data[i + 2] = color[2] * 255;
    image.data[i + 3] = density * 255;
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Кольца видны с обеих сторон, но по-разному. С освещённой — отражённый свет. С теневой —
 * свет на просвет: тонкие зоны (C, щель Кассини) светятся, плотное кольцо B темнеет.
 * Против Солнца просвет ярче (рассеяние пыли вперёд). На кольцах лежит тень планеты.
 */
export function createRingMaterial(profile: RingProfile, texture: THREE.Texture, innerRadii: number, outerRadii: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ringDensity: { value: texture },
      ringRadii: { value: new THREE.Vector2(innerRadii, outerRadii) },
      sunPosition: { value: new THREE.Vector3() },
      planetCenter: { value: new THREE.Vector3() },
      planetRadius: { value: 1 },
      sunIntensity: { value: 1 },
      tint: { value: new THREE.Vector3(...profile.tint) },
      opacity: { value: profile.opacity },
    },
    vertexShader: /* glsl */ `
      varying vec2 vLocal;
      varying vec3 vWorldPosition;
      varying vec3 vRingNormal;
      void main() {
        vLocal = position.xz;
        vRingNormal = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPosition = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D ringDensity;
      uniform vec2 ringRadii;
      uniform vec3 sunPosition;
      uniform vec3 planetCenter;
      uniform float planetRadius;
      uniform float sunIntensity;
      uniform vec3 tint;
      uniform float opacity;
      varying vec2 vLocal;
      varying vec3 vWorldPosition;
      varying vec3 vRingNormal;
      void main() {
        float u = (length(vLocal) - ringRadii.x) / (ringRadii.y - ringRadii.x);
        if (u < 0.0 || u > 1.0) discard;
        vec4 ring = texture2D(ringDensity, vec2(u, 0.5));
        float density = ring.a;
        if (density < 0.004) discard;
        vec3 albedo = pow(ring.rgb, vec3(2.2)) * tint;

        vec3 normal = normalize(vRingNormal);
        vec3 L = normalize(sunPosition - vWorldPosition);
        vec3 V = normalize(cameraPosition - vWorldPosition);
        float nl = dot(normal, L);
        float nv = dot(normal, V);
        float sameSide = step(0.0, nl * nv);

        float reflected = (0.3 + 0.7 * abs(nl)) * (1.0 + 0.35 * pow(max(dot(L, V), 0.0), 12.0));
        float forward = pow(max(dot(-L, V), 0.0), 4.0);
        float transmitted = (1.0 - density) * (0.45 + 2.6 * forward) * (0.35 + 0.65 * abs(nl));
        float brightness = mix(transmitted, reflected, sameSide);

        // Тень планеты: луч от точки кольца к Солнцу пересекает сферу планеты.
        vec3 toCenter = vWorldPosition - planetCenter;
        float b = dot(toCenter, L);
        float c = dot(toCenter, toCenter) - planetRadius * planetRadius;
        float discriminant = b * b - c;
        float shadow = (b < 0.0) ? smoothstep(0.0, planetRadius * planetRadius * 0.03, discriminant) : 0.0;
        brightness *= 1.0 - shadow * 0.96;

        gl_FragColor = vec4(albedo * brightness * sunIntensity, density * opacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
