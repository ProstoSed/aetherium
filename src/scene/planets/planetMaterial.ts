import * as THREE from 'three';
import type { BodyId } from '../../data/bodies';
import type { BakedSurface } from './SurfaceBaker';

/**
 * Освещение планет. Поверхность берётся из запечённой кубической карты по нормали сферы —
 * без растяжения у полюсов. Рельеф — из разности высот по двум касательным направлениям,
 * поэтому работает в любой точке сферы. Сверху — то, что зависит от Солнца и времени:
 * терминатор, блики океана, огни на ночной стороне, облака с тенями, рассеяние у края диска,
 * тень колец и течение полос газовых гигантов.
 */
export type PlanetLook = {
  /** Цвет рассеянного света у края диска и его сила (0 — атмосферы нет). */
  atmosphere: [number, number, number];
  atmosphereDensity: number;
  /** Мягкий терминатор: густая атмосфера разносит свет за линию дня и ночи. */
  thickAtmosphere?: boolean;
  limbDarkening?: boolean;
  /** Скорость течения полос (0 — не течёт). */
  bandFlow?: number;
  /** Суперротация облачного слоя, радиан за секунду (Венера). */
  cloudSpin?: number;
  bumpStrength?: number;
};

export const PLANET_LOOKS: Partial<Record<BodyId, PlanetLook>> = {
  mercury: { atmosphere: [0, 0, 0], atmosphereDensity: 0, bumpStrength: 0.55 },
  venus: { atmosphere: [1.0, 0.82, 0.5], atmosphereDensity: 0.9, thickAtmosphere: true, cloudSpin: 0.01 },
  earth: { atmosphere: [0.32, 0.58, 1.0], atmosphereDensity: 0.85, bumpStrength: 0.6 },
  moon: { atmosphere: [0, 0, 0], atmosphereDensity: 0, bumpStrength: 0.55 },
  mars: { atmosphere: [0.95, 0.6, 0.42], atmosphereDensity: 0.28, bumpStrength: 0.5 },
  jupiter: { atmosphere: [0.9, 0.78, 0.62], atmosphereDensity: 0.35, limbDarkening: true, bandFlow: 0.02 },
  saturn: { atmosphere: [0.95, 0.85, 0.62], atmosphereDensity: 0.3, limbDarkening: true, bandFlow: 0.015 },
  uranus: { atmosphere: [0.62, 0.9, 0.95], atmosphereDensity: 0.55, limbDarkening: true, bandFlow: 0.01 },
  neptune: { atmosphere: [0.42, 0.62, 1.0], atmosphereDensity: 0.55, limbDarkening: true, bandFlow: 0.02 },
};

/** Солнечный свет в линейных единицах сцены: альбедо 0,6 на подсолнечной точке даёт ~0,8 до тонирования. */
export const SUN_INTENSITY = 1.45;
const EARTH_CLOUD_DRIFT = 0.0035;

const vertexShader = /* glsl */ `
  varying vec3 vObjectNormal;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  // modelMatrix во фрагментном шейдере three.js недоступна — поворот передаётся отсюда.
  varying mat3 vToWorld;
  void main() {
    vObjectNormal = normal;
    vToWorld = mat3(modelMatrix);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform samplerCube surfaceMap;
  uniform vec3 sunPosition;
  uniform float sunIntensity;
  uniform float time;
  uniform float texelAngle;
  uniform float bumpStrength;
  uniform vec3 atmosphereColor;
  uniform float atmosphereDensity;
  #ifdef EARTH
    uniform samplerCube extraMap;
    uniform samplerCube cloudMap;
  #endif
  #ifdef RINGED
    uniform sampler2D ringDensity;
    uniform vec2 ringRadii;
  #endif
  #ifdef BAND_FLOW
    uniform float bandFlow;
  #endif
  #ifdef CLOUD_SPIN
    uniform float cloudSpin;
  #endif
  varying vec3 vObjectNormal;
  varying vec3 vWorldPosition;
  varying vec3 vWorldNormal;
  varying mat3 vToWorld;

  vec3 rotateY(vec3 v, float angle) {
    float c = cos(angle), s = sin(angle);
    return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
  }

  vec4 sampleSurface(vec3 direction) {
    #ifdef BAND_FLOW
      // Двухфазное течение: две копии, сдвинутые по долготе со скоростью, зависящей от широты,
      // сменяют друг друга. Полосы текут, а вихри не размазываются бесконечно.
      float speed = sin(direction.y * 11.0) * 0.6 + sin(direction.y * 23.0 + 1.0) * 0.25;
      float phaseA = fract(time * bandFlow);
      float phaseB = fract(time * bandFlow + 0.5);
      vec4 a = textureCube(surfaceMap, rotateY(direction, (phaseA - 0.5) * speed * 0.08));
      vec4 b = textureCube(surfaceMap, rotateY(direction, (phaseB - 0.5) * speed * 0.08));
      return mix(a, b, abs(phaseA - 0.5) * 2.0);
    #else
      return textureCube(surfaceMap, direction);
    #endif
  }

  void main() {
    vec3 n = normalize(vObjectNormal);
    #ifdef CLOUD_SPIN
      n = rotateY(n, time * cloudSpin);
    #endif
    vec4 surface = sampleSurface(n);
    vec3 albedo = pow(surface.rgb, vec3(2.2));

    vec3 objectNormal = n;
    #ifdef RELIEF
      vec3 tangent = normalize(cross(abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), n));
      vec3 bitangent = cross(n, tangent);
      float h0 = surface.a;
      float hT = textureCube(surfaceMap, normalize(n + tangent * texelAngle)).a;
      float hB = textureCube(surfaceMap, normalize(n + bitangent * texelAngle)).a;
      objectNormal = normalize(n - bumpStrength * ((hT - h0) * tangent + (hB - h0) * bitangent) / texelAngle);
    #endif

    mat3 toWorld = vToWorld;
    vec3 N = normalize(toWorld * objectNormal);
    vec3 geometricNormal = normalize(vWorldNormal);
    vec3 L = normalize(sunPosition - vWorldPosition);
    vec3 V = normalize(cameraPosition - vWorldPosition);
    float sunHeight = dot(geometricNormal, L);
    float ndl = dot(N, L);

    #ifdef THICK_ATMOSPHERE
      float diffuse = smoothstep(-0.18, 0.65, ndl);
    #else
      // Рельеф может «поднять» склон к Солнцу на ночной стороне — геометрический терминатор его гасит.
      float diffuse = max(ndl, 0.0) * smoothstep(-0.02, 0.08, sunHeight);
    #endif
    vec3 color = albedo * diffuse * sunIntensity;

    #ifdef LIMB_DARKENING
      color *= 0.42 + 0.58 * pow(max(dot(geometricNormal, V), 0.0), 0.45);
    #endif

    #ifdef EARTH
      vec4 extra = textureCube(extraMap, n);
      float roughness = extra.r;
      float cityLights = extra.g;
      float ocean = 1.0 - extra.b;
      float cloud = textureCube(cloudMap, rotateY(n, time * ${EARTH_CLOUD_DRIFT})).r;
      vec3 sunInObject = normalize(transpose(toWorld) * L);
      float cloudShadow = textureCube(cloudMap, rotateY(normalize(n + sunInObject * 0.012), time * ${EARTH_CLOUD_DRIFT})).r;
      color *= 1.0 - cloudShadow * 0.55;

      vec3 H = normalize(L + V);
      // Блик Солнца на воде: узкое пятно, а у края диска — длинная полоса за счёт Френеля.
      float gloss = mix(900.0, 14.0, roughness);
      float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
      float glint = pow(max(dot(N, H), 0.0), gloss) * (gloss + 8.0) / 80.0;
      color += vec3(1.0, 0.94, 0.82) * glint * (0.025 + fresnel * 0.6) * ocean * (1.0 - cloud) * max(ndl, 0.0) * sunIntensity;

      float night = smoothstep(0.06, -0.2, sunHeight);
      color += vec3(1.0, 0.66, 0.3) * pow(cityLights, 1.4) * night * (1.0 - cloud * 0.85) * 1.8;

      float cloudLight = smoothstep(-0.12, 0.55, sunHeight);
      color = mix(color, vec3(0.96, 0.97, 1.0) * cloudLight * sunIntensity, cloud * 0.93);
    #endif

    #ifdef RINGED
      // Тень колец: луч от точки к Солнцу пересекает плоскость экватора внутри колец.
      vec3 sunDirectionObject = normalize(transpose(toWorld) * L);
      if (n.y * sunDirectionObject.y < 0.0) {
        float t = -n.y / sunDirectionObject.y;
        float r = length(n.xz + sunDirectionObject.xz * t);
        float u = (r - ringRadii.x) / (ringRadii.y - ringRadii.x);
        if (u > 0.0 && u < 1.0) color *= 1.0 - texture2D(ringDensity, vec2(u, 0.5)).a * 0.82;
      }
    #endif

    // Рассеяние у края диска: голубое днём, оранжевое на закатной полосе у терминатора.
    float rim = pow(1.0 - max(dot(geometricNormal, V), 0.0), 3.0);
    float sunset = smoothstep(0.35, -0.02, sunHeight) * smoothstep(-0.28, 0.0, sunHeight);
    vec3 scatter = mix(atmosphereColor, vec3(1.0, 0.62, 0.38), sunset * 0.45);
    color += scatter * rim * atmosphereDensity * smoothstep(-0.25, 0.3, sunHeight) * sunIntensity;

    // Звёздный свет: ночная сторона чуть различима, а не провал в чёрное.
    color += albedo * 0.005;
    gl_FragColor = vec4(color, 1.0);
  }
`;

export type RingShadow = { texture: THREE.Texture; inner: number; outer: number };

export function createPlanetMaterial(id: BodyId, baked: BakedSurface, rings?: RingShadow): THREE.ShaderMaterial {
  const look = PLANET_LOOKS[id]!;
  const defines: Record<string, string> = {};
  if (baked.relief) defines.RELIEF = '';
  if (look.thickAtmosphere) defines.THICK_ATMOSPHERE = '';
  if (look.limbDarkening) defines.LIMB_DARKENING = '';
  if (look.bandFlow) defines.BAND_FLOW = '';
  if (look.cloudSpin) defines.CLOUD_SPIN = '';
  if (baked.extra && baked.clouds) defines.EARTH = '';
  if (rings) defines.RINGED = '';

  return new THREE.ShaderMaterial({
    defines,
    uniforms: {
      surfaceMap: { value: baked.surface.texture },
      extraMap: { value: baked.extra?.texture ?? null },
      cloudMap: { value: baked.clouds?.texture ?? null },
      sunPosition: { value: new THREE.Vector3() },
      sunIntensity: { value: SUN_INTENSITY },
      time: { value: 0 },
      // Шаг выборки для рельефа — две ячейки грани: грань куба покрывает ~90° дуги.
      texelAngle: { value: (Math.PI / 2 / baked.faceSize) * 2 },
      bumpStrength: { value: look.bumpStrength ?? 0 },
      atmosphereColor: { value: new THREE.Vector3(...look.atmosphere) },
      atmosphereDensity: { value: look.atmosphereDensity },
      bandFlow: { value: look.bandFlow ?? 0 },
      cloudSpin: { value: look.cloudSpin ?? 0 },
      ringDensity: { value: rings?.texture ?? null },
      ringRadii: { value: new THREE.Vector2(rings?.inner ?? 0, rings?.outer ?? 1) },
    },
    vertexShader,
    fragmentShader,
  });
}
