import * as THREE from 'three';
import type { LensParams } from './LensParams';
import { LENS_UNIFORM_NAMES, lensFragmentShader, lensVertexShader } from './lensShader';

/**
 * Сцена рисуется в HDR-буфер (half float, без тонирования), затем проявляется через объектив.
 * Ореол ярких мест считается отдельно в четверти разрешения: выделение ярких пикселей и
 * раздельное размытие по Гауссу. Точечные выборки прямо в шейдере объектива размножали
 * маленькие яркие источники (Солнце вдали) на кольцо копий, а здесь свечение сплошное.
 */
const BLOOM_DOWNSCALE = 4;
const BLOOM_THRESHOLD = 0.85;

const fullscreenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const brightPassFragment = /* glsl */ `
  uniform sampler2D tSource;
  uniform vec2 texelSize;
  uniform float threshold;
  varying vec2 vUv;
  void main() {
    // Четыре выборки на пиксель четверти разрешения — без мерцания мелких ярких точек.
    vec3 c = texture2D(tSource, vUv + texelSize * vec2(-1.0, -1.0)).rgb
           + texture2D(tSource, vUv + texelSize * vec2(1.0, -1.0)).rgb
           + texture2D(tSource, vUv + texelSize * vec2(-1.0, 1.0)).rgb
           + texture2D(tSource, vUv + texelSize * vec2(1.0, 1.0)).rgb;
    c *= 0.25;
    float brightness = max(c.r, max(c.g, c.b));
    float soft = clamp(brightness - threshold + 0.25, 0.0, 0.5);
    float contribution = max(soft * soft * 2.0, brightness - threshold) / max(brightness, 1e-4);
    gl_FragColor = vec4(c * contribution, 1.0);
  }
`;

const blurFragment = /* glsl */ `
  uniform sampler2D tSource;
  uniform vec2 direction;
  varying vec2 vUv;
  void main() {
    // Гауссово ядро на 9 выборок с линейной интерполяцией между текселями (эквивалент 17 текселей).
    vec3 sum = texture2D(tSource, vUv).rgb * 0.1964825501511404;
    sum += texture2D(tSource, vUv + direction * 1.411764705882353).rgb * 0.2969069646728344;
    sum += texture2D(tSource, vUv - direction * 1.411764705882353).rgb * 0.2969069646728344;
    sum += texture2D(tSource, vUv + direction * 3.2941176470588234).rgb * 0.09447039785044732;
    sum += texture2D(tSource, vUv - direction * 3.2941176470588234).rgb * 0.09447039785044732;
    sum += texture2D(tSource, vUv + direction * 5.176470588235294).rgb * 0.010381362401148057;
    sum += texture2D(tSource, vUv - direction * 5.176470588235294).rgb * 0.010381362401148057;
    gl_FragColor = vec4(sum, 1.0);
  }
`;

export class LensPass {
  private readonly sceneTarget: THREE.WebGLRenderTarget;
  private readonly bloomA: THREE.WebGLRenderTarget;
  private readonly bloomB: THREE.WebGLRenderTarget;
  private readonly lensMaterial: THREE.ShaderMaterial;
  private readonly brightMaterial: THREE.ShaderMaterial;
  private readonly blurMaterial: THREE.ShaderMaterial;
  private readonly quad: THREE.Mesh;
  private readonly quadScene = new THREE.Scene();
  private readonly quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor() {
    this.sceneTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: true, samples: 4 });
    const bloomOptions = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.bloomA = new THREE.WebGLRenderTarget(1, 1, bloomOptions);
    this.bloomB = new THREE.WebGLRenderTarget(1, 1, bloomOptions);

    const lensUniforms: Record<string, THREE.IUniform> = {
      tScene: { value: this.sceneTarget.texture },
      tBloom: { value: this.bloomA.texture },
      resolution: { value: new THREE.Vector2(1, 1) },
      time: { value: 0 },
    };
    for (const name of LENS_UNIFORM_NAMES) lensUniforms[name] = { value: 0 };
    this.lensMaterial = new THREE.ShaderMaterial({ uniforms: lensUniforms, vertexShader: lensVertexShader, fragmentShader: lensFragmentShader, depthTest: false, depthWrite: false });
    this.brightMaterial = new THREE.ShaderMaterial({
      uniforms: { tSource: { value: this.sceneTarget.texture }, texelSize: { value: new THREE.Vector2() }, threshold: { value: BLOOM_THRESHOLD } },
      vertexShader: fullscreenVertex,
      fragmentShader: brightPassFragment,
      depthTest: false,
      depthWrite: false,
    });
    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: { tSource: { value: null }, direction: { value: new THREE.Vector2() } },
      vertexShader: fullscreenVertex,
      fragmentShader: blurFragment,
      depthTest: false,
      depthWrite: false,
    });

    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.lensMaterial);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  /** width/height — в физических пикселях буфера. samples = 0 отключает сглаживание. */
  setSize(width: number, height: number, samples: number) {
    if (this.sceneTarget.samples !== samples) {
      this.sceneTarget.samples = samples;
      this.sceneTarget.dispose();
    }
    this.sceneTarget.setSize(width, height);
    const bloomWidth = Math.max(1, Math.round(width / BLOOM_DOWNSCALE));
    const bloomHeight = Math.max(1, Math.round(height / BLOOM_DOWNSCALE));
    this.bloomA.setSize(bloomWidth, bloomHeight);
    this.bloomB.setSize(bloomWidth, bloomHeight);
    (this.brightMaterial.uniforms.texelSize.value as THREE.Vector2).set(1 / width, 1 / height);
    (this.lensMaterial.uniforms.resolution.value as THREE.Vector2).set(width, height);
  }

  /**
   * Небо рисуется первым и отдельно: после него очищается только глубина, и любое тело
   * сцены гарантированно закрывает звёзды за собой.
   */
  render(renderer: THREE.WebGLRenderer, sky: { scene: THREE.Scene; camera: THREE.Camera }, scene: THREE.Scene, camera: THREE.Camera, params: LensParams, time: number) {
    renderer.setRenderTarget(this.sceneTarget);
    renderer.autoClear = false;
    renderer.clear();
    renderer.render(sky.scene, sky.camera);
    renderer.clearDepth();
    renderer.render(scene, camera);
    renderer.autoClear = true;

    this.renderBloom(renderer);

    const uniforms = this.lensMaterial.uniforms;
    uniforms.time.value = time;
    for (const name of LENS_UNIFORM_NAMES) uniforms[name].value = params[name];
    this.drawQuad(renderer, this.lensMaterial, null);
  }

  private renderBloom(renderer: THREE.WebGLRenderer) {
    this.drawQuad(renderer, this.brightMaterial, this.bloomA);
    const blur = this.blurMaterial.uniforms;
    const direction = blur.direction.value as THREE.Vector2;
    blur.tSource.value = this.bloomA.texture;
    direction.set(1 / this.bloomA.width, 0);
    this.drawQuad(renderer, this.blurMaterial, this.bloomB);
    blur.tSource.value = this.bloomB.texture;
    direction.set(0, 1 / this.bloomB.height);
    this.drawQuad(renderer, this.blurMaterial, this.bloomA);
  }

  /** Параллельная сборка шейдеров объектива до первого кадра: иначе первый кадр блокирует поток. */
  async compileAsync(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, sky: { scene: THREE.Scene; camera: THREE.Camera }) {
    // Каждая программа собирается под ту цель, в которую потом рисует: цель входит в ключ программы.
    const compileFor = (target: THREE.WebGLRenderTarget | null, compile: () => Promise<unknown>) => {
      const previous = renderer.getRenderTarget();
      renderer.setRenderTarget(target);
      const promise = compile();
      renderer.setRenderTarget(previous);
      return promise;
    };
    const pending: Promise<unknown>[] = [
      compileFor(this.sceneTarget, () => renderer.compileAsync(scene, camera)),
      compileFor(this.sceneTarget, () => renderer.compileAsync(sky.scene, sky.camera)),
    ];
    for (const [material, target] of [[this.brightMaterial, this.bloomA], [this.blurMaterial, this.bloomB], [this.lensMaterial, null]] as const) {
      this.quad.material = material;
      pending.push(compileFor(target, () => renderer.compileAsync(this.quadScene, this.quadCamera)));
    }
    await Promise.all(pending);
  }

  private drawQuad(renderer: THREE.WebGLRenderer, material: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(this.quadScene, this.quadCamera);
  }

  dispose() {
    this.sceneTarget.dispose();
    this.bloomA.dispose();
    this.bloomB.dispose();
    this.lensMaterial.dispose();
    this.brightMaterial.dispose();
    this.blurMaterial.dispose();
    this.quad.geometry.dispose();
  }
}
