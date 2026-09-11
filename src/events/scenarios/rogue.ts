import * as THREE from 'three';
import { createMilestones } from '../helpers';
import type { ScenarioFactory } from '../types';

/** Нептун уходит наружу и вверх из плоскости эклиптики; камера провожает его, теряя фокус. */
const ESCAPE_DISTANCE = 42;
const ESCAPE_HEIGHT = 16;

export const rogue: ScenarioFactory = ({ views, peaks }) => {
  const milestone = createMilestones();
  const outward = new THREE.Vector3();

  return {
    preferredView: { focus: 'neptune', distance: 9 },

    perturb({ envelope }) {
      const position = views.get('neptune')!.root.position;
      outward.set(position.x, 0, position.z).normalize();
      position.addScaledVector(outward, envelope * ESCAPE_DISTANCE);
      position.y += envelope * ESCAPE_HEIGHT;
    },

    update({ progress, envelope, time }) {
      milestone('slip', progress, 0.3, () => peaks.trigger('static', time, { duration: 0.5, strength: 0.5 }));
      const focusHunting = 0.5 + 0.5 * Math.sin(time * 2.3) * Math.sin(time * 0.9);
      return { defocus: envelope * 0.006 * focusHunting, weave: envelope * 0.5, grain: envelope * 0.25 };
    },

    dispose() {},
  };
};
