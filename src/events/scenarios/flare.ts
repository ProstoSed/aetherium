import * as THREE from 'three';
import { createBurstParticles, createMilestones, disposeObject, fresnelMaterial, smoothstep } from '../helpers';
import type { ScenarioFactory } from '../types';

/**
 * Выброс корональной массы — не сфера, а расширяющийся купол, направленный к Земле.
 * Когда фронт доходит до камеры, по плёнке бьёт поток частиц: снег, горячие пиксели.
 */
const CONE_HALF_ANGLE = 0.55;
const FRONT_START = 0.15;
const FRONT_END = 0.9;
/** Фронт проходит орбиту Земли к середине события — тогда удар совпадает с разгаром. */
const FRONT_MAX_DISTANCE = 26;
const FORWARD = new THREE.Vector3(0, 0, 1);

export const flare: ScenarioFactory = ({ system, views, peaks, cameraInSystem, setSunBrightness }) => {
  const group = new THREE.Group();
  const shellMaterial = fresnelMaterial(0xffa55a, 1.6);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, CONE_HALF_ANGLE), shellMaterial);
  shell.rotation.x = Math.PI / 2;
  const plasma = createBurstParticles(2400, 0xffb070, 77, CONE_HALF_ANGLE);
  group.add(shell, plasma.points);
  system.add(group);
  const milestone = createMilestones();
  const direction = new THREE.Vector3();

  return {
    preferredView: { focus: 'earth', distance: 16 },

    update({ progress, envelope, time }) {
      if (progress < 0.02) {
        direction.copy(views.get('earth')!.root.position).normalize();
        // Купол и частицы построены вокруг +Z; lookAt здесь не годится — он считает в мировых координатах, а система сдвинута.
        group.quaternion.setFromUnitVectors(FORWARD, direction);
      }
      const front = smoothstep(FRONT_START, FRONT_END, progress);
      const radius = views.get('sun')!.radius + front * FRONT_MAX_DISTANCE;
      shell.scale.setScalar(radius);
      shellMaterial.uniforms.opacity.value = (1 - front) * Math.min(1, progress * 12);
      plasma.material.uniforms.spread.value = radius;
      plasma.material.uniforms.opacity.value = (1 - front) * 0.9;
      setSunBrightness(1 + envelope * 0.8);

      const cameraDistance = cameraInSystem().length();
      const hit = progress > FRONT_START && radius >= cameraDistance;
      milestone('front-at-camera', hit ? 1 : 0, 1, () => {
        peaks.trigger('static', time, { duration: 1.1, strength: 0.9 });
        peaks.trigger('shake', time, { duration: 0.7, strength: 0.6 });
      });
      const impact = Math.max(0, 1 - Math.abs(radius - cameraDistance) / 6);

      return {
        halation: envelope * 0.7,
        lightLeak: envelope * 0.45,
        exposure: 1 + envelope * 0.3 + impact * 0.5,
        hotPixels: impact * 2.2,
        grain: impact * 0.5,
      };
    },

    dispose() {
      setSunBrightness(1);
      disposeObject(group);
    },
  };
};
