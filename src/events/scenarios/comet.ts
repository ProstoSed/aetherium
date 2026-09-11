import * as THREE from 'three';
import { additiveSprite, disposeObject } from '../helpers';
import type { ScenarioFactory } from '../types';

/**
 * Комета идёт по параболе. Ионный хвост направлен строго от Солнца (его сдувает
 * солнечный ветер), пылевой изогнут и отстаёт от движения — частицы пыли тяжелее.
 * Хвосты растут по мере приближения к Солнцу.
 */
const PERIHELION = 3.4;
const ANOMALY_PARAMETER_RANGE = 3.2;
const TAIL_PARTICLES = 1400;

function createTail(color: THREE.ColorRepresentation, seed: number) {
  let s = seed;
  const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const along = new Float32Array(TAIL_PARTICLES);
  const jitter = new Float32Array(TAIL_PARTICLES * 2);
  for (let i = 0; i < TAIL_PARTICLES; i++) {
    along[i] = Math.pow(random(), 1.7);
    jitter[i * 2] = (random() - 0.5) * 2;
    jitter[i * 2 + 1] = (random() - 0.5) * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TAIL_PARTICLES * 3), 3));
  geometry.setAttribute('along', new THREE.BufferAttribute(along, 1));
  geometry.setAttribute('jitter', new THREE.BufferAttribute(jitter, 2));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      head: { value: new THREE.Vector3() },
      direction: { value: new THREE.Vector3(1, 0, 0) },
      bend: { value: new THREE.Vector3() },
      sideA: { value: new THREE.Vector3(0, 1, 0) },
      sideB: { value: new THREE.Vector3(0, 0, 1) },
      tailLength: { value: 1 },
      width: { value: 0.3 },
      opacity: { value: 1 },
      tint: { value: new THREE.Color(color) },
    },
    vertexShader: /* glsl */ `
      attribute float along;
      attribute vec2 jitter;
      uniform vec3 head, direction, bend, sideA, sideB;
      uniform float tailLength, width;
      varying float vAlong;
      void main() {
        vec3 p = head + direction * along * tailLength + bend * along * along * tailLength
               + (sideA * jitter.x + sideB * jitter.y) * width * along;
        vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(30.0 / -viewPosition.z, 1.0, 5.0);
        vAlong = along;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float opacity;
      uniform vec3 tint;
      varying float vAlong;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        float fade = (1.0 - vAlong) * opacity;
        gl_FragColor = vec4(tint * 1.6 * fade, fade);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

export const comet: ScenarioFactory = ({ system, glowTexture }) => {
  const group = new THREE.Group();
  const orbitPlane = new THREE.Matrix4().makeRotationY(0.7).multiply(new THREE.Matrix4().makeRotationX(0.55));
  const head = additiveSprite(glowTexture, 0xcfe6ff);
  const ionTail = createTail(0x7fb8ff, 11);
  const dustTail = createTail(0xffdca0, 29);
  group.add(ionTail.points, dustTail.points, head);
  system.add(group);

  const position = new THREE.Vector3();
  const previous = new THREE.Vector3();
  const awayFromSun = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const sideA = new THREE.Vector3();
  const sideB = new THREE.Vector3();

  const pointAt = (progress: number, out: THREE.Vector3) => {
    // Параметр D = tan(ν/2) линейно во времени: у Солнца комета заметно быстрее, как по уравнению Баркера.
    const d = (progress - 0.5) * 2 * ANOMALY_PARAMETER_RANGE;
    const anomaly = 2 * Math.atan(d);
    const radius = PERIHELION * (1 + d * d);
    return out.set(Math.cos(anomaly) * radius, 0, Math.sin(anomaly) * radius).applyMatrix4(orbitPlane);
  };

  return {
    preferredView: { focus: null, distance: 60 },

    update({ progress, envelope }) {
      pointAt(progress, position);
      pointAt(Math.max(0, progress - 0.002), previous);
      const distanceToSun = position.length();
      awayFromSun.copy(position).normalize();
      velocity.subVectors(position, previous).normalize();
      sideA.crossVectors(awayFromSun, velocity).normalize();
      sideB.crossVectors(awayFromSun, sideA).normalize();

      const activity = THREE.MathUtils.clamp(16 / distanceToSun, 0.3, 4);
      const length = activity * 4.5 * Math.min(1, envelope * 3);
      head.position.copy(position);
      head.scale.setScalar(0.6 + activity * 0.45);
      for (const tail of [ionTail, dustTail]) {
        const u = tail.material.uniforms;
        u.head.value.copy(position);
        u.sideA.value.copy(sideA);
        u.sideB.value.copy(sideB);
        u.opacity.value = Math.min(1, envelope * 2.5);
      }
      ionTail.material.uniforms.direction.value.copy(awayFromSun);
      ionTail.material.uniforms.tailLength.value = length * 1.25;
      ionTail.material.uniforms.width.value = 0.12 * activity;
      dustTail.material.uniforms.direction.value.copy(awayFromSun);
      dustTail.material.uniforms.bend.value.copy(velocity).multiplyScalar(-0.45);
      dustTail.material.uniforms.tailLength.value = length;
      dustTail.material.uniforms.width.value = 0.45 * activity;

      const nearSun = THREE.MathUtils.clamp(1 - distanceToSun / 12, 0, 1);
      return { dust: envelope * 0.45, scratches: envelope * 0.25, halation: nearSun * 0.35 };
    },

    dispose() {
      disposeObject(group);
    },
  };
};
