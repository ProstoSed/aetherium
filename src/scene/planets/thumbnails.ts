import * as THREE from 'three';
import type { BodyId } from '../../data/bodies';
import type { BodyView } from '../BodyViews';

/**
 * Миниатюры тел для интерфейса: каждое тело рисуется один раз тем же материалом, что и
 * в сцене, со светом сбоку. Так список и карточка показывают ту же планету, что и сцена,
 * а не нарисованный кружок.
 */
const SIZE = 192;
const FIELD_OF_VIEW = 28;
/** Сколько радиусов тела помещается в полкадра: у Сатурна и Урана есть кольца. */
const FRAME_RADII: Partial<Record<BodyId, number>> = { saturn: 2.55, uranus: 2.2 };
const LIGHT_DIRECTION = new THREE.Vector3(-0.75, 0.35, 0.56).normalize();

const toneMapFragment = /* glsl */ `
  uniform sampler2D source;
  varying vec2 vUv;
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  void main() {
    vec4 c = texture2D(source, vUv);
    // В буфере цвет уже умножен на прозрачность (кольца поверх пустоты) — делим обратно.
    vec3 straight = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
    vec3 display = pow(aces(straight * 1.15), vec3(1.0 / 2.2));
    gl_FragColor = vec4(display, clamp(c.a, 0.0, 1.0));
  }
`;

/** prepareLighting ставит Солнце и центр планеты в координаты миниатюры; следующий кадр сцены вернёт свои. */
export function renderThumbnails(renderer: THREE.WebGLRenderer, views: Map<BodyId, BodyView>, prepareLighting: (sunPosition: THREE.Vector3) => void): Record<BodyId, string> {
  const hdrTarget = new THREE.WebGLRenderTarget(SIZE, SIZE, { type: THREE.HalfFloatType, samples: 4 });
  const displayTarget = new THREE.WebGLRenderTarget(SIZE, SIZE);
  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.01, 100);
  const quadScene = new THREE.Scene();
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const toneMaterial = new THREE.ShaderMaterial({
    uniforms: { source: { value: hdrTarget.texture } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: toneMapFragment,
    // Без смешивания: в буфер миниатюры пишется «чистая» прозрачность, как ждёт PNG.
    blending: THREE.NoBlending,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), toneMaterial);
  quadScene.add(quad);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const context = canvas.getContext('2d')!;
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const result = {} as Record<BodyId, string>;
  const previousTarget = renderer.getRenderTarget();
  const previousClear = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);

  for (const [id, view] of views) {
    // Временная сцена с копией оси тела: сама ось остаётся в основной сцене нетронутой.
    const scene = new THREE.Scene();
    const axis = view.axis.clone(false);
    axis.position.set(0, 0, 0);
    axis.scale.setScalar(1);
    // Внешняя оболочка атмосферы считает свет в координатах основной камеры — в миниатюре её нет,
    // край диска и так подсвечен шейдером планеты.
    view.axis.children.forEach(child => {
      if (child.name !== 'atmosphere') axis.add(child.clone(false));
    });
    scene.add(axis);
    scene.updateMatrixWorld(true);

    const frameRadii = FRAME_RADII[id] ?? 1.08;
    const distance = frameRadii / Math.tan(THREE.MathUtils.degToRad(FIELD_OF_VIEW / 2));
    camera.position.set(0.08, 0.32, 1).normalize().multiplyScalar(distance);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    prepareLighting(LIGHT_DIRECTION.clone().multiplyScalar(1000));

    renderer.setRenderTarget(hdrTarget);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(displayTarget);
    renderer.clear();
    renderer.render(quadScene, quadCamera);
    renderer.readRenderTargetPixels(displayTarget, 0, 0, SIZE, SIZE, pixels);

    const image = context.createImageData(SIZE, SIZE);
    // Строки буфера идут снизу вверх, у холста — сверху вниз.
    for (let y = 0; y < SIZE; y++) {
      image.data.set(pixels.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4);
    }
    context.clearRect(0, 0, SIZE, SIZE);
    context.putImageData(image, 0, 0);
    result[id] = canvas.toDataURL('image/png');
  }

  renderer.setRenderTarget(previousTarget);
  renderer.setClearColor(0x000000, previousClear);
  hdrTarget.dispose();
  displayTarget.dispose();
  toneMaterial.dispose();
  quad.geometry.dispose();
  return result;
}
