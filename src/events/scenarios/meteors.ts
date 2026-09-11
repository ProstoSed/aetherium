import * as THREE from 'three';
import { disposeObject } from '../helpers';
import type { ScenarioFactory } from '../types';

/**
 * Метеоры летят из одного радианта — поэтому на небе их следы кажутся расходящимися
 * из точки. Поток держится вокруг того места, куда смотрит камера.
 */
const METEOR_COUNT = 160;
const RADIANT = new THREE.Vector3(-0.55, -0.45, 0.7).normalize();
const STREAK_LENGTH_SHARE = 0.06;

export const meteors: ScenarioFactory = ({ system, camera, cameraInSystem }) => {
  let seed = 314;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const offsets = Array.from({ length: METEOR_COUNT }, () => new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5));
  const phases = Array.from({ length: METEOR_COUNT }, () => random());
  const speeds = Array.from({ length: METEOR_COUNT }, () => 0.5 + random() * 0.8);

  const positions = new Float32Array(METEOR_COUNT * 6);
  const colors = new Float32Array(METEOR_COUNT * 6);
  for (let i = 0; i < METEOR_COUNT; i++) {
    // Голова яркая, хвост гаснет — градиент вдоль отрезка.
    colors.set([1, 0.9, 0.7, 0.05, 0.03, 0.01], i * 6);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  lines.frustumCulled = false;
  system.add(lines);

  const center = new THREE.Vector3();
  const head = new THREE.Vector3();

  return {
    preferredView: { focus: 'earth', distance: 12 },

    update({ envelope, time }) {
      const cameraPosition = cameraInSystem();
      // Центр потока — точка перед камерой на расстоянии до цели.
      center.copy(cameraPosition).sub(camera.position);
      const region = camera.position.length() * 1.4;
      const streak = region * STREAK_LENGTH_SHARE;
      for (let i = 0; i < METEOR_COUNT; i++) {
        const t = (time * 0.35 * speeds[i] + phases[i]) % 1;
        head.copy(offsets[i]).multiplyScalar(region).addScaledVector(RADIANT, (t - 0.5) * region).add(center);
        positions.set([head.x, head.y, head.z, head.x - RADIANT.x * streak, head.y - RADIANT.y * streak, head.z - RADIANT.z * streak], i * 6);
      }
      geometry.attributes.position.needsUpdate = true;
      (lines.material as THREE.LineBasicMaterial).opacity = envelope;
      return { dust: envelope * 0.55, scratches: envelope * 0.35, flicker: envelope * 0.15 };
    },

    dispose() {
      disposeObject(lines);
    },
  };
};
