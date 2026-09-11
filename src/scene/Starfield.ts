import * as THREE from 'three';

/**
 * Звёздное небо на бесконечности. Вершинный шейдер отбрасывает перенос камеры,
 * поэтому звёзды не приближаются ни при каком масштабе — от Меркурия до облака Оорта.
 * Часть звёзд собрана в полосу Млечного Пути: плоскость Галактики наклонена к
 * эклиптике примерно на 60°.
 */
const STAR_COUNT = 9000;
const MILKY_WAY_SHARE = 0.55;
const GALACTIC_TILT = THREE.MathUtils.degToRad(60.2);

export function createStarfield(): THREE.Points {
  const positions = new Float32Array(STAR_COUNT * 3);
  const colors = new Float32Array(STAR_COUNT * 3);
  const sizes = new Float32Array(STAR_COUNT);
  const phases = new Float32Array(STAR_COUNT);
  const tilt = new THREE.Matrix4().makeRotationX(GALACTIC_TILT);
  const direction = new THREE.Vector3();
  const color = new THREE.Color();
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  for (let i = 0; i < STAR_COUNT; i++) {
    const inMilkyWay = random() < MILKY_WAY_SHARE;
    const longitude = random() * Math.PI * 2;
    // Звёзды полосы тяготеют к галактическому экватору (гауссов разброс по широте).
    const latitude = inMilkyWay
      ? (random() + random() + random() - 1.5) * 0.16
      : Math.asin(random() * 2 - 1);
    direction.set(Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude));
    if (inMilkyWay) direction.applyMatrix4(tilt);
    direction.toArray(positions, i * 3);

    // Температура звезды → цвет: от красноватых карликов до голубых гигантов.
    const temperature = random();
    color.setHSL(temperature < 0.7 ? 0.08 + temperature * 0.04 : 0.58, temperature < 0.7 ? 0.35 : 0.45, 0.72 + random() * 0.25);
    color.toArray(colors, i * 3);
    const brightness = Math.pow(random(), 6);
    sizes[i] = (inMilkyWay ? 0.6 : 0.9) + brightness * 3.2;
    phases[i] = random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, pixelRatio: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float phase;
      attribute vec3 color;
      uniform float time;
      uniform float pixelRatio;
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        vec4 clip = projectionMatrix * vec4(mat3(viewMatrix) * position, 1.0);
        // z = w кладёт звезду на дальнюю плоскость при любых near/far.
        gl_Position = vec4(clip.xy, clip.w * 0.99999, clip.w);
        vTwinkle = 0.8 + 0.2 * sin(time * 1.7 + phase * 13.0);
        vColor = color;
        gl_PointSize = size * pixelRatio;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float core = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * core * core * vTwinkle * 1.4, 1.0);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    transparent: true,
  });

  const stars = new THREE.Points(geometry, material);
  stars.frustumCulled = false;
  stars.renderOrder = -10;
  return stars;
}
