import * as THREE from 'three';
import { PLANET_IDS } from '../../data/bodies';
import { additiveSprite, createMilestones, disposeObject } from '../helpers';
import type { ScenarioFactory } from '../types';

/**
 * Чёрная дыра: горизонт, аккреционный диск и изгиб света. Изгиб делает объектив
 * (warp в шейдере) — геометрия здесь только рисует диск и тянет планеты.
 * Одна сторона диска ярче: вещество летит к наблюдателю (релятивистское усиление).
 */
const POSITION = new THREE.Vector3(-17, 2.5, -13);
const HORIZON_RADIUS = 1.2;
const DISK_INNER = 1.7;
const DISK_OUTER = 6;
const PULL = 0.45;
const SWIRL_RADIANS = 1.3;
/** Тень чёрной дыры в 2,6 раза шире горизонта; объектив получает радиус Эйнштейна чуть больше тени. */
const EINSTEIN_RADIUS_IN_HORIZONS = 2.4;

function createDiskMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, opacity: { value: 1 }, inner: { value: DISK_INNER }, outer: { value: DISK_OUTER } },
    vertexShader: /* glsl */ `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time, opacity, inner, outer;
      varying vec2 vLocal;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        float r = length(vLocal);
        float t = (r - inner) / (outer - inner);
        float angle = atan(vLocal.y, vLocal.x);
        // Внутренние кольца вращаются быстрее — кеплеровское вращение, ω ∝ r^(-3/2).
        float swirl = angle + time * 2.2 / pow(r, 1.5);
        float streaks = noise(vec2(swirl * 6.0, r * 3.0)) * 0.6 + noise(vec2(swirl * 17.0, r * 9.0)) * 0.4;
        vec3 hot = vec3(4.0, 3.4, 2.6), warm = vec3(2.6, 0.9, 0.2), cold = vec3(0.5, 0.08, 0.02);
        vec3 color = mix(hot, warm, smoothstep(0.0, 0.35, t));
        color = mix(color, cold, smoothstep(0.35, 1.0, t));
        float doppler = 1.0 + 0.75 * sin(angle);
        float edge = smoothstep(0.0, 0.06, t) * (1.0 - smoothstep(0.7, 1.0, t));
        float a = edge * (0.45 + streaks * 0.8) * opacity;
        gl_FragColor = vec4(color * doppler * a, a);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export const blackhole: ScenarioFactory = ({ system, views, glowTexture, peaks, project, screenRadius }) => {
  const group = new THREE.Group();
  group.position.copy(POSITION);
  const horizon = new THREE.Mesh(new THREE.SphereGeometry(HORIZON_RADIUS, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  const diskMaterial = createDiskMaterial();
  const disk = new THREE.Mesh(new THREE.RingGeometry(DISK_INNER, DISK_OUTER, 256, 8), diskMaterial);
  disk.rotation.x = -Math.PI / 2 + 0.32;
  const halo = additiveSprite(glowTexture, 0xff7a30);
  halo.scale.setScalar(16);
  group.add(halo, disk, horizon);
  system.add(group);
  const milestone = createMilestones();
  const offset = new THREE.Vector3();
  const worldCenter = new THREE.Vector3();

  return {
    preferredView: { focus: null, distance: 85 },

    perturb({ envelope }) {
      for (const id of PLANET_IDS) {
        const position = views.get(id)!.root.position;
        offset.subVectors(position, POSITION);
        const distance = offset.length();
        offset.multiplyScalar(1 - PULL * envelope);
        // Ближние к дыре планеты закручиваются сильнее.
        offset.applyAxisAngle(THREE.Object3D.DEFAULT_UP, SWIRL_RADIANS * envelope * Math.min(1, 25 / distance));
        position.copy(POSITION).add(offset);
      }
    },

    update({ progress, envelope, time }) {
      group.scale.setScalar(Math.max(0.001, envelope));
      diskMaterial.uniforms.time.value = time;
      diskMaterial.uniforms.opacity.value = Math.min(1, envelope * 1.5);
      (halo.material as THREE.SpriteMaterial).opacity = envelope * 0.6;

      milestone('horizon-tear', progress, 0.42, () => peaks.trigger('static', time, { duration: 0.9, strength: 0.8 }));
      milestone('frame-slip', progress, 0.5, () => {
        peaks.trigger('rollIn', time, { duration: 1.0 });
        peaks.trigger('shake', time, { duration: 0.9, strength: 0.9 });
      });

      worldCenter.copy(POSITION);
      const screen = project(worldCenter);
      const horizonOnScreen = screenRadius(worldCenter, HORIZON_RADIUS * envelope);
      return {
        warpX: screen.x,
        warpY: 1 - screen.y,
        warpStrength: screen.onScreen ? envelope : 0,
        warpRadius: Math.min(0.45, horizonOnScreen * EINSTEIN_RADIUS_IN_HORIZONS),
        aberration: envelope * 0.003,
        signalLoss: envelope * 0.12,
        tear: envelope * 0.1,
        grain: envelope * 0.2,
        hotPixels: envelope * 0.5,
      };
    },

    dispose() {
      disposeObject(group);
    },
  };
};
