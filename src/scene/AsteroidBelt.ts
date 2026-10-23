import * as THREE from 'three';
import { J2000 } from '../physics/time';
import { CINEMATIC_SHADER_CONSTANTS, type ScaleMode } from '../physics/scale';

/**
 * Главный пояс астероидов: у каждой частицы свои кеплеровы элементы, а уравнение
 * Кеплера решается в вершинном шейдере. Процессор не тратит на пояс ничего,
 * сколько бы частиц ни было, а внутренние части пояса обгоняют внешние, как на деле.
 * Распределение полуосей повторяет щели Кирквуда (резонансы с Юпитером 3:1, 5:2, 7:3).
 */
export const ASTEROID_COUNT = 7000;
const KIRKWOOD_GAPS_AU = [2.502, 2.825, 2.958];
const KIRKWOOD_GAP_HALF_WIDTH_AU = 0.025;

export function createAsteroidBelt(): { points: THREE.Points; update: (julianDate: number, mode: ScaleMode, pixelRatio: number) => void } {
  const elementsA = new Float32Array(ASTEROID_COUNT * 3); // a, e, i
  const elementsB = new Float32Array(ASTEROID_COUNT * 3); // Ω, ω, M0
  const sizes = new Float32Array(ASTEROID_COUNT);
  let seed = 4242;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  for (let i = 0; i < ASTEROID_COUNT; i++) {
    let a: number;
    do {
      a = 2.1 + Math.pow(random(), 0.9) * 1.2;
    } while (KIRKWOOD_GAPS_AU.some(gap => Math.abs(a - gap) < KIRKWOOD_GAP_HALF_WIDTH_AU));
    elementsA[i * 3] = a;
    elementsA[i * 3 + 1] = Math.pow(random(), 1.6) * 0.3;
    elementsA[i * 3 + 2] = THREE.MathUtils.degToRad(Math.pow(random(), 1.8) * 22);
    elementsB[i * 3] = random() * Math.PI * 2;
    elementsB[i * 3 + 1] = random() * Math.PI * 2;
    elementsB[i * 3 + 2] = random() * Math.PI * 2;
    sizes[i] = 0.6 + Math.pow(random(), 8) * 1.6;
  }

  const geometry = new THREE.BufferGeometry();
  // Позиции нужны three.js только для подсчёта вершин — реальные координаты считает шейдер.
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ASTEROID_COUNT * 3), 3));
  geometry.setAttribute('elementsA', new THREE.BufferAttribute(elementsA, 3));
  geometry.setAttribute('elementsB', new THREE.BufferAttribute(elementsB, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      daysSinceJ2000: { value: 0 },
      trueScale: { value: 0 },
      pixelRatio: { value: 1 },
      distanceFactor: { value: CINEMATIC_SHADER_CONSTANTS.distanceFactor },
      distancePower: { value: CINEMATIC_SHADER_CONSTANTS.distancePower },
      auInTrueUnits: { value: CINEMATIC_SHADER_CONSTANTS.auInTrueUnits },
    },
    vertexShader: /* glsl */ `
      attribute vec3 elementsA;
      attribute vec3 elementsB;
      attribute float size;
      uniform float daysSinceJ2000;
      uniform float trueScale;
      uniform float pixelRatio;
      uniform float distanceFactor;
      uniform float distancePower;
      uniform float auInTrueUnits;
      varying float vShade;

      const float GAUSS_DEGREES_PER_DAY = 0.9856076686;

      void main() {
        float a = elementsA.x, e = elementsA.y, inc = elementsA.z;
        float node = elementsB.x, perihelionArgument = elementsB.y;
        float meanMotion = radians(GAUSS_DEGREES_PER_DAY) / (a * sqrt(a));
        float M = mod(elementsB.z + meanMotion * daysSinceJ2000, 6.2831853);
        float E = M;
        for (int k = 0; k < 6; k++) E -= (E - e * sin(E) - M) / (1.0 - e * cos(E));

        float px = a * (cos(E) - e);
        float py = a * sqrt(1.0 - e * e) * sin(E);
        float cw = cos(perihelionArgument), sw = sin(perihelionArgument);
        float cn = cos(node), sn = sin(node), ci = cos(inc), si = sin(inc);
        vec3 ecliptic = vec3(
          (cw * cn - sw * sn * ci) * px + (-sw * cn - cw * sn * ci) * py,
          (cw * sn + sw * cn * ci) * px + (-sw * sn + cw * cn * ci) * py,
          sw * si * px + cw * si * py);
        vec3 au = vec3(ecliptic.x, ecliptic.z, -ecliptic.y);

        float r = length(au);
        float sceneDistance = mix(distanceFactor * pow(r, distancePower), r * auInTrueUnits, trueScale);
        vec4 viewPosition = modelViewMatrix * vec4(au * (sceneDistance / r), 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = size * pixelRatio;
        vShade = 0.55 + 0.45 * fract(sin(elementsB.z * 91.7) * 43758.5);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vShade;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(vec3(0.5, 0.44, 0.36) * vShade, 0.5 * smoothstep(0.5, 0.1, d));
      }
    `,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return {
    points,
    update(julianDate, mode, pixelRatio) {
      // float32 в шейдере держит сутки с точностью ~0,25 при ±10 000 лет — для пояса достаточно.
      material.uniforms.daysSinceJ2000.value = julianDate - J2000;
      material.uniforms.trueScale.value = mode === 'true' ? 1 : 0;
      material.uniforms.pixelRatio.value = pixelRatio;
    },
  };
}
