import * as THREE from 'three';
import { disposeObject, fresnelMaterial } from '../helpers';
import type { ScenarioFactory } from '../types';

/** Ледяной панцирь нарастает на Земле; объектив в холоде покрывается инеем от краёв. */
export const ice: ScenarioFactory = ({ views }) => {
  const earth = views.get('earth')!;
  const shell = new THREE.Group();
  const surface = new THREE.Mesh(
    new THREE.SphereGeometry(1.012, 64, 48),
    new THREE.MeshStandardMaterial({ color: 0xeaf6ff, roughness: 0.35, metalness: 0, transparent: true, opacity: 0 }),
  );
  const glowMaterial = fresnelMaterial(0xbfe8ff, 3);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 48), glowMaterial);
  shell.add(surface, glow);
  earth.axis.add(shell);

  return {
    preferredView: { focus: 'earth', distance: 3.6 },

    update({ envelope }) {
      (surface.material as THREE.MeshStandardMaterial).opacity = Math.min(0.95, envelope * 1.2);
      glowMaterial.uniforms.opacity.value = envelope;
      return {
        frost: envelope,
        tintR: 0.9, tintG: 0.97, tintB: 1.12, tintAmount: envelope * 0.3,
        defocus: envelope * 0.0012,
        exposure: 1 + envelope * 0.15,
      };
    },

    dispose() {
      disposeObject(shell);
    },
  };
};
