import * as THREE from 'three';
import { BODIES, type BodyId, type BodyInfo } from '../data/bodies';
import { ROTATION } from '../data/orbitalElements';
import { meridianAngle, poleDirection } from '../physics/kepler';
import { bodyRadius, type ScaleMode } from '../physics/scale';
import { createSunMaterial } from './sunMaterial';
import { createGlowTexture, createRingTexture, createSurfaceMaps } from './textures';

/**
 * Скорость вращения на экране ограничена: при «1 месяц/с» Земля делала бы
 * 30 оборотов в секунду, и глаз видел бы стробоскоп вместо планеты.
 */
const MAX_VISIBLE_SPIN_DEGREES_PER_SECOND = 120;
const SPHERE_SEGMENTS = { width: 96, height: 64 };
const SUN_GLOW_SIZE_IN_RADII = 5.5;
/** Минимальный видимый размер свечения Солнца, доля высоты кадра: из-за Нептуна Солнце — просто яркая звезда. */
const SUN_GLOW_MIN_SCREEN_FRACTION = 0.05;

export type BodyView = {
  info: BodyInfo;
  /** Центр тела; координаты — в системе Солнца. */
  root: THREE.Group;
  /** Ориентация оси вращения; кольца и атмосфера не крутятся вместе с поверхностью. */
  axis: THREE.Group;
  surface: THREE.Mesh;
  /** Физический радиус в единицах сцены при текущем масштабе, до возмущений событий. */
  radius: number;
  spinAngle: number;
};

export class BodyViews {
  readonly group = new THREE.Group();
  readonly views = new Map<BodyId, BodyView>();
  readonly sunLight = new THREE.PointLight(0xfff1dc, 3.2, 0, 0);
  private readonly sunMaterial = createSunMaterial();
  private readonly sunGlow: THREE.Sprite;
  private readonly markers: THREE.Points;
  private readonly markerPositions: Float32Array;
  private readonly atmospheres: { mesh: THREE.Mesh; material: THREE.ShaderMaterial }[] = [];
  /** Направление на Солнце для материалов со свечением ночной стороны; у Земли одно. */
  private readonly nightSideUniforms: { value: THREE.Vector3 }[] = [];
  private readonly sunWorld = new THREE.Vector3();
  private readonly bodyWorld = new THREE.Vector3();

  constructor(initialJulianDate: number) {
    const glowTexture = createGlowTexture();
    BODIES.forEach((info, index) => {
      const view = this.createView(info, index, initialJulianDate);
      this.views.set(info.id, view);
      this.group.add(view.root);
    });

    const sun = this.views.get('sun')!;
    sun.root.add(this.sunLight);
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture, color: 0xffd39a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    sun.root.add(this.sunGlow);

    // Маркеры — точки постоянного размера в пикселях. В истинном масштабе без них
    // планеты не найти: диск Земли с орбиты Марса меньше пикселя.
    this.markerPositions = new Float32Array(BODIES.length * 3);
    const markerGeometry = new THREE.BufferGeometry();
    markerGeometry.setAttribute('position', new THREE.BufferAttribute(this.markerPositions, 3));
    markerGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(BODIES.flatMap(b => new THREE.Color(b.color).toArray())), 3));
    markerGeometry.setAttribute('visibility', new THREE.BufferAttribute(new Float32Array(BODIES.length), 1));
    this.markers = new THREE.Points(markerGeometry, new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec3 color;
        attribute float visibility;
        varying vec3 vColor;
        varying float vVisibility;
        void main() {
          vColor = color;
          vVisibility = visibility;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = 7.0;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vVisibility;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float ring = smoothstep(0.5, 0.36, d) * (0.55 + 0.45 * smoothstep(0.1, 0.3, d));
          if (vVisibility * ring < 0.01) discard;
          gl_FragColor = vec4(vColor * 1.6, ring * vVisibility);
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    }));
    this.markers.frustumCulled = false;
    this.markers.renderOrder = 5;
    this.group.add(this.markers);
  }

  private createView(info: BodyInfo, index: number, julianDate: number): BodyView {
    const root = new THREE.Group();
    root.name = info.id;
    const axis = new THREE.Group();
    const pole = poleDirection(info.id);
    axis.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(pole.x, pole.y, pole.z));
    root.add(axis);

    const geometry = new THREE.SphereGeometry(1, SPHERE_SEGMENTS.width, SPHERE_SEGMENTS.height);
    const material = info.id === 'sun' ? this.sunMaterial : this.createSurfaceMaterial(info, index);
    const surface = new THREE.Mesh(geometry, material);
    surface.userData.bodyId = info.id;
    axis.add(surface);

    if (info.id === 'earth' || info.id === 'venus') axis.add(this.createAtmosphere(info.id === 'earth' ? 0x6fb6ff : 0xf2d49a));
    if (info.rings) axis.add(this.createRings(info, index));

    const spinAngle = meridianAngle(info.id, julianDate);
    return { info, root, axis, surface, radius: 1, spinAngle };
  }

  private createSurfaceMaterial(info: BodyInfo, index: number): THREE.MeshStandardMaterial {
    const maps = createSurfaceMaps(info.id, 101 + index * 17);
    const material = new THREE.MeshStandardMaterial({
      map: maps.map,
      bumpMap: maps.bumpMap ?? null,
      bumpScale: maps.bumpMap ? 2.2 : 1,
      roughnessMap: maps.roughnessMap ?? null,
      roughness: maps.roughnessMap ? 1 : 0.95,
      emissiveMap: maps.emissiveMap ?? null,
      emissive: new THREE.Color(maps.emissiveMap ? 0xffc27a : 0x000000),
      emissiveIntensity: maps.emissiveMap ? 0.9 : 0,
      metalness: 0,
    });
    if (maps.emissiveMap) this.limitGlowToNightSide(material);
    return material;
  }

  /**
   * Свечение поверхности (огни городов) гаснет на дневной стороне: стандартный материал
   * добавляет emissive всюду, и днём огни лежали бы на континентах рыжими пятнами.
   */
  private limitGlowToNightSide(material: THREE.MeshStandardMaterial) {
    const sunDirection = { value: new THREE.Vector3(1, 0, 0) };
    this.nightSideUniforms.push(sunDirection);
    material.onBeforeCompile = shader => {
      shader.uniforms.nightSunDirection = sunDirection;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 nightSunDirection;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= smoothstep(0.08, -0.22, dot(normal, nightSunDirection));');
    };
  }

  /**
   * Атмосфера светится по краю диска и только со стороны Солнца: рассеянный свет
   * есть там, куда он падает. На ночной стороне остаётся тонкий след сумерек у терминатора.
   */
  private createAtmosphere(color: number): THREE.Mesh {
    const material = new THREE.ShaderMaterial({
      uniforms: { glowColor: { value: new THREE.Color(color) }, sunDirection: { value: new THREE.Vector3(1, 0, 0) } },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-viewPosition.xyz);
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 glowColor;
        uniform vec3 sunDirection;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float rim = pow(1.0 - clamp(dot(vNormal, vViewDir), 0.0, 1.0), 4.0);
          float daylight = smoothstep(-0.25, 0.45, dot(vNormal, sunDirection));
          float glow = rim * daylight;
          gl_FragColor = vec4(glowColor * glow * 1.6, glow);
        }
      `,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.025, 64, 48), material);
    mesh.name = 'atmosphere';
    this.atmospheres.push({ mesh, material });
    return mesh;
  }

  private createRings(info: BodyInfo, index: number): THREE.Mesh {
    const rings = info.rings!;
    const inner = rings.innerKm / info.radiusKm;
    const outer = rings.outerKm / info.radiusKm;
    const geometry = new THREE.RingGeometry(inner, outer, 256, 1);
    // Текстура колец радиальная: u = доля пути от внутреннего края к внешнему.
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const point = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i);
      uv.setXY(i, (point.length() - inner) / (outer - inner), 0.5);
    }
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({
      map: createRingTexture(900 + index, info.id === 'saturn'),
      color: rings.color,
      transparent: true,
      opacity: rings.opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'rings';
    return mesh;
  }

  /** Радиусы тел под выбранный масштаб. Кольца и атмосфера — дети оси, растут вместе. */
  applyScale(mode: ScaleMode) {
    for (const view of this.views.values()) {
      view.radius = bodyRadius(view.info.radiusKm, mode);
      view.axis.scale.setScalar(view.radius);
    }
    this.sunGlow.scale.setScalar(this.views.get('sun')!.radius * SUN_GLOW_SIZE_IN_RADII);
  }

  /** Поворот поверхностей по реальному углу меридиана с ограничением видимой скорости. */
  updateRotation(julianDate: number, daysAdvanced: number, realSeconds: number) {
    const maxStep = THREE.MathUtils.degToRad(MAX_VISIBLE_SPIN_DEGREES_PER_SECOND) * realSeconds;
    for (const view of this.views.values()) {
      const exact = meridianAngle(view.info.id, julianDate);
      const requested = THREE.MathUtils.degToRad(ROTATION[view.info.id].degreesPerDay) * daysAdvanced;
      view.spinAngle = Math.abs(requested) <= maxStep ? exact : view.spinAngle + Math.sign(requested) * maxStep;
      view.surface.rotation.y = view.spinAngle;
    }
  }

  /** Направление на Солнце в координатах камеры — для дневной стороны атмосфер. */
  updateAtmospheres(camera: THREE.PerspectiveCamera) {
    this.views.get('sun')!.root.getWorldPosition(this.sunWorld);
    for (const { mesh, material } of this.atmospheres) {
      mesh.getWorldPosition(this.bodyWorld);
      const direction = material.uniforms.sunDirection.value as THREE.Vector3;
      direction.subVectors(this.sunWorld, this.bodyWorld).transformDirection(camera.matrixWorldInverse);
    }
    this.views.get('earth')!.root.getWorldPosition(this.bodyWorld);
    for (const uniform of this.nightSideUniforms) {
      uniform.value.subVectors(this.sunWorld, this.bodyWorld).transformDirection(camera.matrixWorldInverse);
    }
  }

  updateSun(time: number, brightness: number, camera: THREE.PerspectiveCamera, cameraDistanceToSun: number) {
    this.sunMaterial.uniforms.time.value = time;
    this.sunMaterial.uniforms.intensity.value = brightness;
    const sun = this.views.get('sun')!;
    const frameHeightAtSun = 2 * cameraDistanceToSun * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const glowSize = Math.max(sun.radius * SUN_GLOW_SIZE_IN_RADII, frameHeightAtSun * SUN_GLOW_MIN_SCREEN_FRACTION);
    this.sunGlow.scale.setScalar(glowSize * sun.root.scale.x);
    (this.sunGlow.material as THREE.SpriteMaterial).opacity = Math.min(1, 0.35 + brightness * 0.35);
  }

  /**
   * Маркеры видны, пока диск тела меньше нескольких пикселей, и гаснут, когда
   * тело становится различимым само.
   */
  updateMarkers(camera: THREE.PerspectiveCamera, viewportHeight: number, enabled: boolean) {
    const visibility = this.markers.geometry.attributes.visibility as THREE.BufferAttribute;
    const pixelsPerRadian = viewportHeight / THREE.MathUtils.degToRad(camera.fov);
    const world = new THREE.Vector3();
    BODIES.forEach((info, i) => {
      const view = this.views.get(info.id)!;
      view.root.getWorldPosition(world);
      this.markerPositions[i * 3] = view.root.position.x;
      this.markerPositions[i * 3 + 1] = view.root.position.y;
      this.markerPositions[i * 3 + 2] = view.root.position.z;
      const distance = world.distanceTo(camera.position);
      const diskPixels = (view.radius * view.root.scale.x / Math.max(distance, 1e-9)) * pixelsPerRadian;
      const isVisible = enabled && info.id !== 'sun' && view.root.visible;
      visibility.setX(i, isVisible ? THREE.MathUtils.clamp(1 - (diskPixels - 2) / 4, 0, 1) : 0);
    });
    (this.markers.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    visibility.needsUpdate = true;
  }
}
