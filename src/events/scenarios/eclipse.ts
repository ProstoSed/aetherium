import * as THREE from 'three';
import { additiveSprite, createMilestones, disposeObject, smoothstep } from '../helpers';
import type { ScenarioFactory } from '../types';

/**
 * Тёмный диск проходит между камерой и Солнцем. Его размер подобран так, чтобы
 * он чуть перекрывал солнечный диск с точки зрения камеры, — где бы она ни была.
 */
const DISC_POSITION_ALONG_SIGHTLINE = 0.35;
const DISC_OVERSIZE = 1.06;
const CROSSING_WIDTH_IN_DISCS = 7;

export const eclipse: ScenarioFactory = ({ system, views, camera, glowTexture, peaks, cameraInSystem }) => {
  const group = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const corona = additiveSprite(glowTexture, 0xd8e6ff);
  group.add(corona, disc);
  system.add(group);
  const milestone = createMilestones();
  const toSun = new THREE.Vector3();
  const right = new THREE.Vector3();

  return {
    preferredView: { focus: null, distance: 70 },

    update({ progress, envelope, time }) {
      const sun = views.get('sun')!;
      const cameraPosition = cameraInSystem();
      toSun.copy(sun.root.position).sub(cameraPosition);
      const distance = toSun.length();
      const discDistance = distance * DISC_POSITION_ALONG_SIGHTLINE;
      const discRadius = sun.radius * (discDistance / distance) * DISC_OVERSIZE;
      right.setFromMatrixColumn(camera.matrixWorld, 0);
      const offset = (progress - 0.5) * discRadius * CROSSING_WIDTH_IN_DISCS;

      disc.position.copy(cameraPosition).addScaledVector(toSun.normalize(), discDistance).addScaledVector(right, offset);
      disc.scale.setScalar(discRadius);
      disc.visible = envelope > 0.01;

      const totality = 1 - smoothstep(0, discRadius * 1.2, Math.abs(offset));
      corona.position.copy(sun.root.position);
      corona.scale.setScalar(sun.radius * (5 + totality * 11));
      (corona.material as THREE.SpriteMaterial).opacity = Math.min(1, totality * 1.3);

      // «Бриллиантовое кольцо»: последний луч перед полной фазой вспыхивает на плёнке.
      milestone('diamond-ring', progress, 0.47, () => peaks.trigger('whiteout', time, { duration: 0.5, strength: 0.3 }));

      return { exposure: 1 - totality * 0.6 - envelope * 0.1, vignette: envelope * 0.35, grain: totality * 0.35, halation: totality * 1.1 };
    },

    dispose() {
      disposeObject(group);
    },
  };
};
