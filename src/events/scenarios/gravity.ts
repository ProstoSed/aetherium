import { BODIES } from '../../data/bodies';
import { createMilestones } from '../helpers';
import type { ScenarioFactory } from '../types';

/**
 * Гравитационная волна, идущая вдоль оси Y, растягивает пространство по X и одновременно
 * сжимает по Z, затем наоборот («плюс»-поляризация). Амплитуда настоящих волн ~10⁻²¹ —
 * здесь она увеличена до заметной, но форма искажения та же.
 */
const STRAIN = 0.16;
const WAVE_FREQUENCY = 2.4;

export const gravity: ScenarioFactory = ({ views, orbits, peaks }) => {
  const milestone = createMilestones();
  let strain = 0;

  return {
    preferredView: { focus: null, distance: 75 },

    perturb({ envelope, time }) {
      strain = Math.sin(time * WAVE_FREQUENCY) * STRAIN * envelope;
      for (const body of BODIES) {
        if (body.id === 'moon') continue;
        const position = views.get(body.id)!.root.position;
        position.x *= 1 + strain;
        position.z *= 1 - strain;
      }
      orbits.scale.set(1 + strain, 1, 1 - strain);
    },

    update({ progress, envelope, time }) {
      milestone('crest', progress, 0.5, () => {
        peaks.trigger('rollIn', time, { duration: 0.9 });
        peaks.trigger('shake', time, { duration: 0.8, strength: 0.8 });
      });
      return { ripple: envelope, distortion: strain * 1.6, aberration: envelope * 0.002, weave: envelope * 0.4 };
    },

    dispose() {
      orbits.scale.set(1, 1, 1);
    },
  };
};
