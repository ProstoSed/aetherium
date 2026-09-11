import * as THREE from 'three';
import type { BodyId } from '../../data/bodies';
import { NOISE_GLSL } from './noiseGlsl';
import { EXTRA_FACE_SHARE, SURFACE_RECIPES } from './surfaceGenerators';

export type BakedSurface = {
  surface: THREE.WebGLCubeRenderTarget;
  extra?: THREE.WebGLCubeRenderTarget;
  clouds?: THREE.WebGLCubeRenderTarget;
  faceSize: number;
  relief: boolean;
};

type Output = 'surface' | 'extra' | 'clouds';
type Job = { target: THREE.WebGLCubeRenderTarget; material: THREE.ShaderMaterial; face: number; compiled: Promise<void> | null; ready: boolean };

/** Граней за кадр. Одна тяжёлая грань Земли — десятки миллисекунд работы видеокарты на слабой машине. */
const FACES_PER_FRAME = 2;

/**
 * Направление внутри грани кубической карты по правилам OpenGL: какая грань и какие
 * текстурные координаты соответствуют направлению. Писать грань и читать textureCube
 * нужно по одним правилам, иначе на рёбрах куба появятся швы.
 */
const FACE_DIRECTION_GLSL = /* glsl */ `
  uniform int face;
  vec3 faceDirection(vec2 uv) {
    vec2 st = uv * 2.0 - 1.0;
    if (face == 0) return vec3(1.0, -st.y, -st.x);
    if (face == 1) return vec3(-1.0, -st.y, st.x);
    if (face == 2) return vec3(st.x, 1.0, st.y);
    if (face == 3) return vec3(st.x, -1.0, -st.y);
    if (face == 4) return vec3(st.x, -st.y, 1.0);
    return vec3(-st.x, -st.y, -1.0);
  }
`;

const MAIN_BY_OUTPUT: Record<Output, string> = {
  surface: /* glsl */ `
    void main() {
      vec3 p = normalize(faceDirection(vUv));
      vec3 albedo;
      float height;
      generateSurface(p, albedo, height);
      gl_FragColor = vec4(clamp(albedo, 0.0, 1.0), height);
    }
  `,
  extra: /* glsl */ `
    void main() {
      vec4 extra;
      generateExtra(normalize(faceDirection(vUv)), extra);
      gl_FragColor = extra;
    }
  `,
  clouds: /* glsl */ `
    void main() {
      gl_FragColor = vec4(generateClouds(normalize(faceDirection(vUv))), 0.0, 0.0, 1.0);
    }
  `,
};

/**
 * Запекает поверхности тел в кубические карты на видеокарте. Работа растянута на кадры,
 * а шейдеры компилируются параллельно (KHR_parallel_shader_compile) — главный поток
 * не блокируется, и заставка при старте не замирает.
 */
export class SurfaceBaker {
  readonly surfaces = new Map<BodyId, BakedSurface>();
  private readonly jobs: Job[] = [];
  private readonly quad: THREE.Mesh;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly totalJobs: number;

  constructor(sizeScale = 1) {
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    for (const [id, recipe] of Object.entries(SURFACE_RECIPES) as [BodyId, NonNullable<(typeof SURFACE_RECIPES)[BodyId]>][]) {
      const faceSize = Math.max(64, Math.round(recipe.faceSize * sizeScale));
      const baked: BakedSurface = {
        surface: this.createTarget(faceSize, recipe.relief ? THREE.HalfFloatType : THREE.UnsignedByteType),
        faceSize,
        relief: recipe.relief,
      };
      this.addJobs(baked.surface, recipe.glsl, 'surface');
      if (recipe.extraGlsl) {
        baked.extra = this.createTarget(Math.round(faceSize * EXTRA_FACE_SHARE), THREE.UnsignedByteType);
        this.addJobs(baked.extra, recipe.extraGlsl, 'extra');
      }
      if (recipe.cloudsGlsl) {
        baked.clouds = this.createTarget(Math.round(faceSize * EXTRA_FACE_SHARE), THREE.UnsignedByteType);
        this.addJobs(baked.clouds, recipe.cloudsGlsl, 'clouds');
      }
      this.surfaces.set(id, baked);
    }
    this.totalJobs = this.jobs.length;
  }

  get progress(): number {
    return 1 - this.jobs.length / this.totalJobs;
  }

  get done(): boolean {
    return this.jobs.length === 0;
  }

  private createTarget(size: number, type: THREE.TextureDataType): THREE.WebGLCubeRenderTarget {
    return new THREE.WebGLCubeRenderTarget(size, {
      type,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
  }

  private addJobs(target: THREE.WebGLCubeRenderTarget, generator: string, output: Output) {
    const material = new THREE.ShaderMaterial({
      uniforms: { face: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `precision highp float;\nvarying vec2 vUv;\n${FACE_DIRECTION_GLSL}\n${NOISE_GLSL}\n${generator}\n${MAIN_BY_OUTPUT[output]}`,
      depthTest: false,
      depthWrite: false,
    });
    for (let face = 0; face < 6; face++) this.jobs.push({ target, material, face, compiled: null, ready: false });
  }

  /** Вызывается раз в кадр. Возвращает true, когда всё запечено. */
  step(renderer: THREE.WebGLRenderer): boolean {
    let facesThisFrame = 0;
    while (this.jobs.length > 0 && facesThisFrame < FACES_PER_FRAME) {
      const job = this.jobs[0];
      if (!job.ready) {
        if (!job.compiled) {
          this.quad.material = job.material;
          // Программа собирается под текущую цель отрисовки (цветовое пространство входит в её ключ).
          // Собранная под экран, при записи в кубическую карту она пересобралась бы синхронно.
          const previous = renderer.getRenderTarget();
          renderer.setRenderTarget(job.target, job.face);
          job.compiled = renderer.compileAsync(this.scene, this.camera).then(() => {
            for (const other of this.jobs) if (other.material === job.material) other.ready = true;
          });
          renderer.setRenderTarget(previous);
        }
        break;
      }
      this.quad.material = job.material;
      job.material.uniforms.face.value = job.face;
      const previousTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(job.target, job.face);
      renderer.render(this.scene, this.camera);
      renderer.setRenderTarget(previousTarget);
      this.jobs.shift();
      facesThisFrame++;
      if (!this.jobs.some(other => other.material === job.material)) job.material.dispose();
    }
    return this.done;
  }

  dispose() {
    for (const baked of this.surfaces.values()) {
      baked.surface.dispose();
      baked.extra?.dispose();
      baked.clouds?.dispose();
    }
    this.quad.geometry.dispose();
  }
}
