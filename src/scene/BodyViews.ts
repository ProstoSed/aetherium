import * as THREE from 'three';
import { BODIES, type BodyId, type BodyInfo } from '../data/bodies';
import { ROTATION } from '../data/orbitalElements';
import { meridianAngle, meridianOriginDirection, poleDirection } from '../physics/kepler';
import { bodyRadius, type ScaleMode } from '../physics/scale';
import { createPlanetMaterial, SUN_INTENSITY } from './planets/planetMaterial';
import { createRingMaterial, createRingTexture, RING_PROFILES } from './planets/rings';
import type { SurfaceBaker } from './planets/SurfaceBaker';
import { createSunMaterial } from './sunMaterial';
import { createGlowTexture } from './textures';

/**
 * Скорость вращения на экране ограничена: при «1 месяц/с» Земля делала бы
 * 30 оборотов в секунду, и глаз видел бы стробоскоп вместо планеты.
 */
const MAX_VISIBLE_SPIN_DEGREES_PER_SECOND = 120;
/** За месяц ось Земли уходит на 4″ — меньше пикселя при любом приближении. */
const EARTH_AXIS_REBUILD_DAYS = 30;
const SPHERE_SEGMENTS = { width: 128, height: 96 };
const SUN_GLOW_SIZE_IN_RADII = 5.5;
/** Минимальный видимый размер свечения Солнца, доля высоты кадра: из-за Нептуна Солнце — просто яркая звезда. */
const SUN_GLOW_MIN_SCREEN_FRACTION = 0.05;
const ATMOSPHERE_SHELLS: Partial<Record<BodyId, { color: number; thickness: number }>> = {
  earth: { color: 0x5aa8ff, thickness: 1.025 },
  venus: { color: 0xf2d49a, thickness: 1.04 },
  mars: { color: 0xe0a07a, thickness: 1.012 },
};

/**
 * Базис оси тела: Y — северный полюс, X — направление, от которого отсчитывается нулевой
 * меридиан. Поворот поверхности на W вокруг Y тогда ставит нулевой меридиан туда, где он есть
 * на самом деле, — у Земли в 12:00 UTC Солнце стоит над Гринвичем.
 */
function axisOrientation(id: BodyId, julianDate: number): THREE.Quaternion {
  const poleVector = poleDirection(id, julianDate);
  const originVector = meridianOriginDirection(id, julianDate);
  const y = new THREE.Vector3(poleVector.x, poleVector.y, poleVector.z);
  const x = new THREE.Vector3(originVector.x, originVector.y, originVector.z).addScaledVector(y, -new THREE.Vector3(originVector.x, originVector.y, originVector.z).dot(y)).normalize();
  const z = new THREE.Vector3().crossVectors(x, y);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

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

type RingView = { material: THREE.ShaderMaterial; planet: BodyView };

export class BodyViews {
  readonly group = new THREE.Group();
  readonly views = new Map<BodyId, BodyView>();
  /** Свет для объектов событий на стандартных материалах; планеты освещаются своими шейдерами. */
  readonly sunLight = new THREE.PointLight(0xfff1dc, 3.2, 0, 0);
  private readonly sunMaterial = createSunMaterial();
  private readonly sunGlow: THREE.Sprite;
  private readonly markers: THREE.Points;
  private readonly markerPositions: Float32Array;
  private readonly planetMaterials: THREE.ShaderMaterial[] = [];
  private readonly rings: RingView[] = [];
  private readonly atmospheres: { mesh: THREE.Mesh; material: THREE.ShaderMaterial }[] = [];
  private readonly sunWorld = new THREE.Vector3();
  private readonly bodyWorld = new THREE.Vector3();
  private earthAxisBuiltAt = Number.NaN;

  constructor(initialJulianDate: number, baker: SurfaceBaker) {
    BODIES.forEach((info, index) => {
      const view = this.createView(info, index, initialJulianDate, baker);
      this.views.set(info.id, view);
      this.group.add(view.root);
    });

    const sun = this.views.get('sun')!;
    sun.root.add(this.sunLight);
    this.sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: createGlowTexture(), color: 0xffd39a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
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
      uniforms: { pixelRatio: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float pixelRatio;
        attribute vec3 color;
        attribute float visibility;
        varying vec3 vColor;
        varying float vVisibility;
        void main() {
          vColor = color;
          vVisibility = visibility;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          // 7 точек интерфейса, а не 7 пикселей буфера: на плотном экране кружок не должен мельчать.
          gl_PointSize = 7.0 * pixelRatio;
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

  private createView(info: BodyInfo, index: number, julianDate: number, baker: SurfaceBaker): BodyView {
    const root = new THREE.Group();
    root.name = info.id;
    const axis = new THREE.Group();
    axis.quaternion.copy(axisOrientation(info.id, julianDate));
    root.add(axis);

    const ringProfile = RING_PROFILES[info.id];
    const ringTexture = ringProfile ? createRingTexture(ringProfile, 900 + index) : null;
    const ringInner = ringProfile ? ringProfile.innerKm / info.radiusKm : 0;
    const ringOuter = ringProfile ? ringProfile.outerKm / info.radiusKm : 0;

    const geometry = new THREE.SphereGeometry(1, SPHERE_SEGMENTS.width, SPHERE_SEGMENTS.height);
    let material: THREE.Material = this.sunMaterial;
    if (info.id !== 'sun') {
      const planetMaterial = createPlanetMaterial(info.id, baker.surfaces.get(info.id)!, ringTexture ? { texture: ringTexture, inner: ringInner, outer: ringOuter } : undefined);
      this.planetMaterials.push(planetMaterial);
      material = planetMaterial;
    }
    const surface = new THREE.Mesh(geometry, material);
    surface.userData.bodyId = info.id;
    axis.add(surface);

    const view: BodyView = { info, root, axis, surface, radius: 1, spinAngle: meridianAngle(info.id, julianDate) };
    const shell = ATMOSPHERE_SHELLS[info.id];
    if (shell) axis.add(this.createAtmosphere(shell.color, shell.thickness));
    if (ringProfile && ringTexture) axis.add(this.createRings(view, ringProfile, ringTexture, ringInner, ringOuter));
    return view;
  }

  /**
   * Внешняя оболочка атмосферы — ореол над краем диска. Светится со стороны Солнца,
   * у терминатора краснеет (свет проходит сквозь толщу воздуха), на ночной стороне гаснет.
   */
  private createAtmosphere(color: number, thickness: number): THREE.Mesh {
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
          float facing = clamp(dot(vNormal, vViewDir), 0.0, 1.0);
          float rim = pow(1.0 - facing, 3.5);
          float sunHeight = dot(vNormal, sunDirection);
          float daylight = smoothstep(-0.3, 0.4, sunHeight);
          float sunset = smoothstep(0.3, -0.05, sunHeight) * smoothstep(-0.35, -0.02, sunHeight);
          vec3 tint = mix(glowColor, vec3(1.0, 0.6, 0.35), sunset * 0.5);
          float glow = rim * daylight;
          gl_FragColor = vec4(tint * glow * 1.8, glow);
        }
      `,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(thickness, 96, 64), material);
    mesh.name = 'atmosphere';
    this.atmospheres.push({ mesh, material });
    return mesh;
  }

  private createRings(planet: BodyView, profile: NonNullable<(typeof RING_PROFILES)[BodyId]>, texture: THREE.Texture, inner: number, outer: number): THREE.Mesh {
    const geometry = new THREE.RingGeometry(inner, outer, 512, 1);
    geometry.rotateX(-Math.PI / 2);
    const material = createRingMaterial(profile, texture, inner, outer);
    this.rings.push({ material, planet });
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
    // Ось Земли прецессирует (круг за ~25 800 лет): её ориентация пересчитывается, когда набежит заметный сдвиг.
    if (!(Math.abs(julianDate - this.earthAxisBuiltAt) < EARTH_AXIS_REBUILD_DAYS)) {
      this.views.get('earth')!.axis.quaternion.copy(axisOrientation('earth', julianDate));
      this.earthAxisBuiltAt = julianDate;
    }
    const maxStep = THREE.MathUtils.degToRad(MAX_VISIBLE_SPIN_DEGREES_PER_SECOND) * realSeconds;
    for (const view of this.views.values()) {
      const exact = meridianAngle(view.info.id, julianDate);
      const requested = THREE.MathUtils.degToRad(ROTATION[view.info.id].degreesPerDay) * daysAdvanced;
      view.spinAngle = Math.abs(requested) <= maxStep ? exact : view.spinAngle + Math.sign(requested) * maxStep;
      view.surface.rotation.y = view.spinAngle;
    }
  }

  /** Всё, что зависит от положения Солнца: освещение планет, колец и атмосфер. Вызывать после обновления матриц. */
  updateLighting(camera: THREE.PerspectiveCamera, time: number, sunBrightness: number) {
    this.views.get('sun')!.root.getWorldPosition(this.sunWorld);
    for (const material of this.planetMaterials) {
      material.uniforms.sunPosition.value.copy(this.sunWorld);
      material.uniforms.sunIntensity.value = SUN_INTENSITY * sunBrightness;
      material.uniforms.time.value = time;
    }
    for (const { material, planet } of this.rings) {
      material.uniforms.sunPosition.value.copy(this.sunWorld);
      material.uniforms.sunIntensity.value = SUN_INTENSITY * sunBrightness;
      planet.root.getWorldPosition(material.uniforms.planetCenter.value);
      material.uniforms.planetRadius.value = planet.radius * planet.root.scale.x;
    }
    for (const { mesh, material } of this.atmospheres) {
      mesh.getWorldPosition(this.bodyWorld);
      (material.uniforms.sunDirection.value as THREE.Vector3).subVectors(this.sunWorld, this.bodyWorld).transformDirection(camera.matrixWorldInverse);
    }
  }

  /** Освещение для миниатюр: тело в начале координат, радиус 1. */
  useThumbnailLighting(sunPosition: THREE.Vector3) {
    for (const material of this.planetMaterials) {
      material.uniforms.sunPosition.value.copy(sunPosition);
      material.uniforms.sunIntensity.value = SUN_INTENSITY;
    }
    for (const { material } of this.rings) {
      material.uniforms.sunPosition.value.copy(sunPosition);
      material.uniforms.sunIntensity.value = SUN_INTENSITY;
      material.uniforms.planetCenter.value.set(0, 0, 0);
      material.uniforms.planetRadius.value = 1;
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
  updateMarkers(camera: THREE.PerspectiveCamera, viewportHeight: number, pixelRatio: number, enabled: boolean) {
    (this.markers.material as THREE.ShaderMaterial).uniforms.pixelRatio.value = pixelRatio;
    const visibility = this.markers.geometry.attributes.visibility as THREE.BufferAttribute;
    const pixelsPerRadian = viewportHeight / THREE.MathUtils.degToRad(camera.fov);
    BODIES.forEach((info, i) => {
      const view = this.views.get(info.id)!;
      view.root.getWorldPosition(this.bodyWorld);
      this.markerPositions[i * 3] = view.root.position.x;
      this.markerPositions[i * 3 + 1] = view.root.position.y;
      this.markerPositions[i * 3 + 2] = view.root.position.z;
      const distance = this.bodyWorld.distanceTo(camera.position);
      const diskPixels = (view.radius * view.root.scale.x / Math.max(distance, 1e-9)) * pixelsPerRadian;
      const isVisible = enabled && info.id !== 'sun' && view.root.visible;
      visibility.setX(i, isVisible ? THREE.MathUtils.clamp(1 - (diskPixels - 2) / 4, 0, 1) : 0);
    });
    (this.markers.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    visibility.needsUpdate = true;
  }
}
