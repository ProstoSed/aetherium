import { PLANET_IDS } from '../../data/bodies';
import type { ScenarioFactory } from '../types';

/** Планеты сходятся к долготе Земли, сохраняя расстояние от Солнца. */
export const alignment: ScenarioFactory = ({ views }) => {
  let lineAngle: number | null = null;

  return {
    preferredView: { focus: null, distance: 115 },

    perturb({ envelope }) {
      if (lineAngle === null) {
        const earth = views.get('earth')!.root.position;
        lineAngle = Math.atan2(earth.z, earth.x);
      }
      for (const id of PLANET_IDS) {
        const position = views.get(id)!.root.position;
        const radius = Math.hypot(position.x, position.z);
        const angle = Math.atan2(position.z, position.x);
        // Кратчайший путь к линии, иначе половина планет обходила бы Солнце кругом.
        const delta = Math.atan2(Math.sin(lineAngle - angle), Math.cos(lineAngle - angle));
        const aligned = angle + delta * envelope;
        position.set(Math.cos(aligned) * radius, position.y * (1 - envelope), Math.sin(aligned) * radius);
      }
    },

    update({ envelope }) {
      return { lightLeak: envelope * 0.4, halation: envelope * 0.35, tintR: 1.08, tintG: 1, tintB: 0.88, tintAmount: envelope * 0.25 };
    },

    dispose() {},
  };
};
