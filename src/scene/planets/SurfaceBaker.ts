import * as THREE from 'three';
import type { BodyId } from '../../data/bodies';
import { NOISE_GLSL } from './noiseGlsl';
import { EXTRA_FACE_SHARE, SURFACE_RECIPES, type SurfaceMap } from './surfaceGenerators';

export type BakedSurface = {
  surface: THREE.WebGLCubeRenderTarget;
  extra?: THREE.WebGLCubeRenderTarget;
  clouds?: THREE.WebGLCubeRenderTarget;
  faceSize: number;
  relief: boolean;
};

type Output = 'surface' | 'extra' | 'clouds';
/** Что запечь в цель: генератор, выход и карты (общие у поверхности и её дополнительной карты). */
type Plan = { target: THREE.WebGLCubeRenderTarget; generator: string; output: Output; maps: Record<string, SurfaceMap> | null };
type LoadedMaps = { uniforms: Record<string, THREE.IUniform>; defines: Record<string, string>; loaded: Promise<unknown> };
const NO_MAPS: LoadedMaps = { uniforms: {}, defines: {}, loaded: Promise.resolve() };
type Job = {
  target: THREE.WebGLCubeRenderTarget;
  material: THREE.ShaderMaterial;
  face: number;
  /** Карты, без которых грань печь нельзя: пока они грузятся, грань ждёт. */
  maps: Promise<unknown>;
  compiled: Promise<void> | null;
  ready: boolean;
};

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
      // Генераторы отсчитывают высоту от 0,5, а half float у нуля в сотни раз точнее, чем у 0,5
      // (шаг 2^-11 там съедает весь рельеф Земли за ~60 ступеней). Рельефу нужны только разности.
      gl_FragColor = vec4(clamp(albedo, 0.0, 1.0), height - 0.5);
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
  private readonly plans: Plan[] = [];
  private readonly quad: THREE.Mesh;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private totalJobs = 0;
  // Картинка декодируется вне главного потока (createImageBitmap): декодирование карты 4096×2048
  // через <img> при первой загрузке в текстуру занимает главный поток на ~0,1 с. Переворот по
  // вертикали делается там же — у ImageBitmap three.js его не выполняет.
  private readonly loader = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: 'flipY' });
  private loadedMaps: THREE.Texture[] = [];

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
      const maps = recipe.maps ?? {};
      this.plans.push({ target: baked.surface, generator: recipe.glsl, output: 'surface', maps });
      if (recipe.extraGlsl) {
        baked.extra = this.createTarget(Math.round(faceSize * EXTRA_FACE_SHARE), THREE.UnsignedByteType);
        this.plans.push({ target: baked.extra, generator: recipe.extraGlsl, output: 'extra', maps });
      }
      if (recipe.cloudsGlsl) {
        baked.clouds = this.createTarget(Math.round(faceSize * EXTRA_FACE_SHARE), THREE.UnsignedByteType);
        this.plans.push({ target: baked.clouds, generator: recipe.cloudsGlsl, output: 'clouds', maps: null });
      }
      this.surfaces.set(id, baked);
    }
    this.queueAll();
  }

  /**
   * Ставит в очередь запекание всех поверхностей: при старте и после восстановления потерянного
   * контекста WebGL — видеопамять тогда пуста, а кубические карты существуют только в ней.
   * Карты-источники загружаются заново: после запекания они освобождаются.
   */
  queueAll() {
    this.jobs.length = 0;
    this.releaseMaps();
    const loaded = new Map<Record<string, SurfaceMap>, LoadedMaps>();
    for (const plan of this.plans) {
      let maps = NO_MAPS;
      if (plan.maps) {
        maps = loaded.get(plan.maps) ?? this.loadMaps(plan.maps);
        loaded.set(plan.maps, maps);
      }
      this.addJobs(plan.target, plan.generator, plan.output, maps);
    }
    this.totalJobs = this.jobs.length;
  }

  /**
   * Карты-источники нужны только шейдерам запекания: после него это ~70 МБ видеопамяти
   * (цвет 4096×2048 с мип-уровнями, рельеф и ночные огни) и столько же декодированных картинок.
   */
  private releaseMaps() {
    for (const texture of this.loadedMaps) {
      (texture.image as ImageBitmap | undefined)?.close?.();
      texture.dispose();
    }
    this.loadedMaps = [];
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

  /**
   * Карты читаются как есть, без перевода из sRGB: генераторы и так отдают цвет в гамме sRGB.
   * По долготе карта замкнута (повтор), по широте — нет.
   */
  private loadMaps(maps: Record<string, SurfaceMap>): LoadedMaps {
    const uniforms: Record<string, THREE.IUniform> = {};
    const defines: Record<string, string> = {};
    const loads: Promise<unknown>[] = [];
    for (const [name, map] of Object.entries(maps)) {
      const texture = new THREE.Texture();
      texture.flipY = false;
      loads.push(this.loader.loadAsync(map.url).then(bitmap => {
        texture.image = bitmap;
        texture.needsUpdate = true;
      }, () => {
        throw new Error(`Surface map failed to load: ${map.url}`);
      }));
      texture.colorSpace = THREE.NoColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      this.loadedMaps.push(texture);
      uniforms[name] = { value: texture };
      defines[`${name.replace(/Map$/, '').toUpperCase()}_ROWS`] = map.rows.toFixed(1);
    }
    return { uniforms, defines, loaded: Promise.all(loads) };
  }

  private addJobs(target: THREE.WebGLCubeRenderTarget, generator: string, output: Output, maps: LoadedMaps) {
    const material = new THREE.ShaderMaterial({
      uniforms: { face: { value: 0 }, cubeTexelAngle: { value: Math.PI / 2 / target.width }, ...maps.uniforms },
      defines: maps.defines,
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
    for (let face = 0; face < 6; face++) this.jobs.push({ target, material, face, maps: maps.loaded, compiled: null, ready: false });
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
          job.compiled = Promise.all([renderer.compileAsync(this.scene, this.camera), job.maps]).then(() => {
            for (const other of this.jobs) if (other.material === job.material) other.ready = true;
          });
          renderer.setRenderTarget(previous);
        }
        break;
      }
      this.quad.material = job.material;
      job.material.uniforms.face.value = job.face;
      // three.js пересчитывает мип-уровни всего куба после каждой грани; нужны они один раз — после
      // последней. Хранилище уровней уже выделено при сборке шейдера под эту цель (generateMipmaps
      // тогда было true), поэтому временное false его не урезает.
      job.target.texture.generateMipmaps = job.face === 5;
      const previousTarget = renderer.getRenderTarget();
      renderer.setRenderTarget(job.target, job.face);
      renderer.render(this.scene, this.camera);
      renderer.setRenderTarget(previousTarget);
      this.jobs.shift();
      facesThisFrame++;
      if (!this.jobs.some(other => other.material === job.material)) job.material.dispose();
    }
    if (this.done && this.loadedMaps.length > 0) this.releaseMaps();
    return this.done;
  }

  dispose() {
    for (const baked of this.surfaces.values()) {
      baked.surface.dispose();
      baked.extra?.dispose();
      baked.clouds?.dispose();
    }
    this.quad.geometry.dispose();
    this.releaseMaps();
  }
}
