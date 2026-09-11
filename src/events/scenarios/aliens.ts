import * as THREE from 'three';
import { createMilestones, disposeObject, smoothstep } from '../helpers';
import type { ScenarioFactory } from '../types';

/** Флот выходит из глубины, встаёт кольцом вокруг Земли, сканирует и уходит. Его передатчики глушат сигнал. */
const SHIP_SIZE = 0.38;
const SHIP_COUNT = 6;
const HOVER_RADIUS = 1.25;
const APPROACH_DISTANCE = 70;

function createShip(): THREE.Group {
  const ship = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 32, 16),
    new THREE.MeshStandardMaterial({ color: 0x9aa6a0, metalness: 0.85, roughness: 0.25, emissive: 0x0d2a18, emissiveIntensity: 0.8 }),
  );
  hull.scale.y = 0.22;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.09, 24, 12), new THREE.MeshBasicMaterial({ color: 0x8dffc4, transparent: true, opacity: 0.8 }));
  dome.position.y = 0.04;
  dome.scale.y = 0.6;
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.35, 1.6, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x57ffa0, transparent: true, opacity: 0.05, side: THREE.FrontSide, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  beam.name = 'beam';
  beam.position.y = -0.8;
  ship.add(hull, dome, beam);
  ship.scale.setScalar(SHIP_SIZE);
  return ship;
}

export const aliens: ScenarioFactory = ({ system, views, peaks }) => {
  const fleet = new THREE.Group();
  const ships = Array.from({ length: SHIP_COUNT }, createShip);
  ships.forEach(ship => fleet.add(ship));
  system.add(fleet);
  const milestone = createMilestones();
  const approachDirection = new THREE.Vector3(-0.6, 0.35, 0.72).normalize();
  const toEarth = new THREE.Vector3();

  return {
    preferredView: { focus: 'earth', distance: 9 },

    update({ progress, envelope, time }) {
      const earth = views.get('earth')!.root.position;
      const arrival = smoothstep(0.08, 0.28, progress);
      const departure = smoothstep(0.8, 0.96, progress);
      const distance = HOVER_RADIUS + (1 - arrival) * APPROACH_DISTANCE + departure * APPROACH_DISTANCE * 1.5;
      ships.forEach((ship, i) => {
        const angle = (i / SHIP_COUNT) * Math.PI * 2 + time * 0.25;
        const orbitOffset = new THREE.Vector3(Math.cos(angle), Math.sin(i * 1.7) * 0.25, Math.sin(angle)).multiplyScalar(HOVER_RADIUS);
        ship.position.copy(earth).add(orbitOffset).addScaledVector(approachDirection, distance - HOVER_RADIUS);
        // Корабль повёрнут днищем к Земле, чтобы луч бил в планету.
        toEarth.subVectors(earth, ship.position).normalize();
        ship.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), toEarth);
        const beam = ship.getObjectByName('beam') as THREE.Mesh;
        (beam.material as THREE.MeshBasicMaterial).opacity = 0.06 * arrival * (1 - departure) * (0.6 + 0.4 * Math.sin(time * 6 + i));
      });
      fleet.visible = envelope > 0.01;

      milestone('arrival', progress, 0.12, () => peaks.trigger('static', time, { duration: 1.1, strength: 0.95 }));
      milestone('departure', progress, 0.82, () => peaks.trigger('static', time, { duration: 0.7, strength: 0.7 }));

      const hover = arrival * (1 - departure);
      const jamming = hover * (0.55 + 0.45 * Math.sin(time * 1.9));
      return {
        signalLoss: jamming * 0.32,
        tear: jamming * 0.22,
        tintR: 0.85, tintG: 1.15, tintB: 0.9, tintAmount: envelope * 0.35,
        hotPixels: hover * 0.3,
      };
    },

    dispose() {
      disposeObject(fleet);
    },
  };
};
