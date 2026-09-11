import * as THREE from 'three';
import { PLANET_IDS } from '../../data/bodies';
import { createMilestones, disposeObject, fresnelMaterial, smoothstep } from '../helpers';
import type { ScenarioFactory } from '../types';

/**
 * Вымышленная гибель Солнца: звезда раздувается, вспыхивает — плёнка сгорает, и в
 * заправленном новом кадре видна уходящая оболочка и сжатое ядро. В конце Солнце
 * возвращается, иначе системе не к чему восстанавливаться.
 */
const SWELL_END = 0.48;
const MAX_SWELL = 5;
const COLLAPSED_SIZE = 0.3;
const SHELL_REACH = 95;

export const supernova: ScenarioFactory = ({ system, views, peaks, project, setSunBrightness }) => {
  const group = new THREE.Group();
  const shellMaterial = fresnelMaterial(0xff9a4a, 1.8);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), shellMaterial);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const shockRing = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 256), ringMaterial);
  shockRing.rotation.x = -Math.PI / 2;
  group.add(shell, shockRing);
  system.add(group);
  const milestone = createMilestones();
  const sunCenter = new THREE.Vector3();

  let sunScale = 1;
  let shellRadius = 0;

  return {
    preferredView: { focus: null, distance: 80 },

    perturb({ progress, envelope }) {
      const swell = smoothstep(0, SWELL_END, progress);
      const collapse = smoothstep(SWELL_END, SWELL_END + 0.08, progress);
      const restore = smoothstep(0.82, 1, progress);
      sunScale = THREE.MathUtils.lerp(THREE.MathUtils.lerp(1 + swell * swell * (MAX_SWELL - 1), COLLAPSED_SIZE, collapse), 1, restore);
      views.get('sun')!.root.scale.setScalar(sunScale);

      const sinceBlast = Math.max(0, progress - SWELL_END);
      shellRadius = views.get('sun')!.radius + smoothstep(0, 0.45, sinceBlast) * SHELL_REACH;
      // Оболочка, проходя планету, отталкивает её наружу; к концу планеты возвращаются.
      for (const id of PLANET_IDS) {
        const position = views.get(id)!.root.position;
        const passed = smoothstep(position.length() - 4, position.length() + 4, shellRadius);
        position.multiplyScalar(1 + passed * 0.18 * envelope);
      }
    },

    update({ progress, envelope, time }) {
      const swell = smoothstep(0, SWELL_END, progress);
      const sinceBlast = progress - SWELL_END;
      const shellFade = sinceBlast > 0 ? 1 - smoothstep(0, 0.45, sinceBlast) : 0;
      shell.visible = sinceBlast > 0;
      shell.scale.setScalar(shellRadius);
      shellMaterial.uniforms.opacity.value = shellFade;
      shockRing.visible = shell.visible;
      shockRing.scale.setScalar(shellRadius * 1.1);
      ringMaterial.opacity = shellFade * 0.8;
      setSunBrightness(1 + swell * 2.5 * (sinceBlast > 0 ? 0.2 : 1));

      milestone('blast', progress, SWELL_END - 0.06, () => {
        const screen = project(sunCenter);
        peaks.triggerBurnOut(time, screen.onScreen ? screen.x : 0.5, screen.onScreen ? screen.y : 0.5);
      });

      return {
        exposure: 1 + swell * 1.1,
        halation: swell * 2 + shellFade * 0.6,
        heat: swell,
        grain: shellFade * 0.35 * envelope,
        dust: shellFade * 0.4,
        aberration: swell * 0.004,
      };
    },

    dispose() {
      views.get('sun')!.root.scale.setScalar(1);
      setSunBrightness(1);
      disposeObject(group);
    },
  };
};
