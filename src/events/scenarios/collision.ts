import * as THREE from 'three';
import { additiveSprite, createBurstParticles, createMilestones, disposeObject, fresnelMaterial, smoothstep } from '../helpers';
import type { ScenarioFactory } from '../types';

/**
 * Земля и Марс сходятся, удар выбрасывает облако обломков, миры исчезают и в конце
 * собираются вновь на своих орбитах. Удар прожигает плёнку в точке столкновения.
 */
const IMPACT_AT = 0.42;
const REFORM_FROM = 0.78;
const DEBRIS_REACH = 16;

export const collision: ScenarioFactory = ({ system, views, glowTexture, peaks, project }) => {
  const group = new THREE.Group();
  const flash = additiveSprite(glowTexture, 0xfff0d0);
  const debris = createBurstParticles(3000, 0xff9a50, 91);
  const shockMaterial = fresnelMaterial(0xffc890, 3.5);
  const shock = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), shockMaterial);
  group.add(debris.points, shock, flash);
  group.visible = false;
  system.add(group);
  const milestone = createMilestones();
  const meetingPoint = new THREE.Vector3();
  const earthStart = new THREE.Vector3();
  const marsStart = new THREE.Vector3();
  let meetingChosen = false;

  return {
    preferredView: { focus: 'earth', distance: 14 },

    perturb({ progress }) {
      const earth = views.get('earth')!, mars = views.get('mars')!, moon = views.get('moon')!;
      if (!meetingChosen) {
        meetingPoint.addVectors(earth.root.position, mars.root.position).multiplyScalar(0.5);
        meetingPoint.setLength((earth.root.position.length() + mars.root.position.length()) / 2);
        meetingChosen = true;
      }
      earthStart.copy(earth.root.position);
      marsStart.copy(mars.root.position);
      const approach = smoothstep(0, IMPACT_AT, progress);
      const reform = smoothstep(REFORM_FROM, 1, progress);
      const destroyed = progress >= IMPACT_AT && progress < REFORM_FROM;
      // Сближение ускоряется к удару, как при падении.
      const pull = progress < IMPACT_AT ? approach * approach : 1 - reform;
      earth.root.position.lerpVectors(earthStart, meetingPoint, pull);
      mars.root.position.lerpVectors(marsStart, meetingPoint, pull);
      const size = destroyed ? 0.001 : progress < IMPACT_AT ? 1 : Math.max(0.001, reform);
      earth.root.scale.setScalar(size);
      mars.root.scale.setScalar(size);
      moon.root.scale.setScalar(size);
    },

    update({ progress, envelope, time }) {
      const sinceImpact = progress - IMPACT_AT;
      group.visible = sinceImpact > 0 && envelope > 0.01;
      group.position.copy(meetingPoint);
      const blast = smoothstep(0, 0.5, sinceImpact);
      const flashStrength = sinceImpact > 0 ? Math.exp(-sinceImpact * 28) : 0;
      flash.scale.setScalar(2 + flashStrength * 14);
      (flash.material as THREE.SpriteMaterial).opacity = flashStrength;
      debris.material.uniforms.spread.value = blast * DEBRIS_REACH;
      debris.material.uniforms.opacity.value = (1 - smoothstep(0.2, 0.55, sinceImpact)) * envelope;
      shock.scale.setScalar(0.5 + blast * DEBRIS_REACH * 1.3);
      shockMaterial.uniforms.opacity.value = (1 - blast) * 0.9;

      milestone('impact', progress, IMPACT_AT, () => {
        const screen = project(meetingPoint);
        peaks.trigger('shake', time, { duration: 1.2, strength: 1 });
        if (screen.onScreen) peaks.trigger('burn', time, { duration: 1.4, strength: 0.45, x: screen.x, y: screen.y });
        peaks.trigger('static', time, { delay: 0.25, duration: 0.6, strength: 0.6 });
      });

      return {
        exposure: 1 + flashStrength * 3,
        halation: flashStrength * 2 + blast * 0.3 * envelope,
        dust: sinceImpact > 0 ? envelope * 0.5 : 0,
        tear: flashStrength * 0.4,
        aberration: flashStrength * 0.006,
      };
    },

    dispose() {
      for (const id of ['earth', 'mars', 'moon'] as const) views.get(id)!.root.scale.setScalar(1);
      disposeObject(group);
    },
  };
};
