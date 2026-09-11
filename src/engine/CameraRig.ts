import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Камера вращается вокруг точки интереса, а мир сдвигается так, чтобы эта точка
 * всегда была в начале координат («плавающее начало»). В истинном масштабе Нептун
 * в 45 000 единиц от Солнца, и видеокарта с её float32 иначе трясла бы планету
 * размером 0,25 единицы при каждом повороте.
 */
const FIELD_OF_VIEW = 45;
const MIN_NEAR = 1e-5;
const NEAR_TO_SURFACE_SHARE = 0.05;
const FAR_PLANE = 5e6;
const FLIGHT_MIN_SECONDS = 1.1;
const FLIGHT_MAX_SECONDS = 3.2;
/** Во сколько радиусов тела камера останавливается после перелёта. */
export const VIEW_DISTANCE_IN_RADII = 5.5;

type Flight = {
  from: THREE.Vector3;
  /** Направление камеры от цели в начале и в конце; null — сохранить текущее. */
  startDirection: THREE.Vector3;
  endDirection: THREE.Vector3 | null;
  getTarget: () => THREE.Vector3;
  startDistance: number;
  endDistance: number;
  elapsed: number;
  duration: number;
};

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, FAR_PLANE);
  readonly controls: OrbitControls;
  /** Точка сцены, которая сейчас в начале координат, — в системе Солнца. */
  readonly origin = new THREE.Vector3();
  /** Скорость перелёта 0…1 — для размытия и дрожи объектива. */
  flightIntensity = 0;
  private flight: Flight | null = null;
  private follow: (() => THREE.Vector3) | null = null;
  private readonly scratch = new THREE.Vector3();

  constructor(domElement: HTMLElement) {
    this.camera.position.set(0, 40, 80);
    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.6;
    this.controls.zoomSpeed = 1.1;
    this.controls.screenSpacePanning = true;
    this.controls.maxPolarAngle = Math.PI * 0.98;
    this.controls.minPolarAngle = Math.PI * 0.02;
    this.controls.target.set(0, 0, 0);
    this.controls.addEventListener('start', () => { this.flight = null; });
  }

  setAspect(aspect: number) {
    this.camera.aspect = aspect;
    // На узком экране держим горизонтальный угол, иначе система не влезает по ширине.
    this.camera.fov = aspect < 1 ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(FIELD_OF_VIEW) / 2) / aspect)) : FIELD_OF_VIEW;
    this.camera.updateProjectionMatrix();
  }

  /** Сопровождает ли камера тело. Перенос правой кнопкой сопровождение снимает. */
  get isFollowing(): boolean {
    return this.follow !== null;
  }

  get distance(): number {
    return this.camera.position.length();
  }

  /** Перелёт к движущейся цели; после прибытия камера сопровождает её. */
  flyTo(getTarget: () => THREE.Vector3, endDistance: number, endDirection: THREE.Vector3 | null = null) {
    const from = this.origin.clone();
    const gap = from.distanceTo(getTarget()) + Math.abs(this.distance - endDistance);
    const logGap = Math.log10(1 + gap / Math.max(endDistance, 1e-6));
    this.flight = {
      from,
      startDirection: this.camera.position.clone().normalize(),
      endDirection: endDirection?.clone().normalize() ?? null,
      getTarget,
      startDistance: this.distance,
      endDistance,
      elapsed: 0,
      duration: THREE.MathUtils.clamp(0.6 + logGap * 0.5, FLIGHT_MIN_SECONDS, FLIGHT_MAX_SECONDS),
    };
    this.follow = getTarget;
  }

  /** Мгновенный переход без полёта — для смены масштаба за кадром плёнки. */
  jumpTo(getTarget: () => THREE.Vector3 | null, distance: number) {
    this.flight = null;
    const target = getTarget();
    this.follow = target ? (getTarget as () => THREE.Vector3) : null;
    if (target) this.origin.copy(target);
    this.setDistance(distance);
  }

  stopFollowing() {
    this.follow = null;
  }

  setDistanceLimits(min: number, max: number) {
    this.controls.minDistance = min;
    this.controls.maxDistance = max;
  }

  /** Вызывается раз в кадр до отрисовки. surfaceDistance — до ближайшей поверхности. */
  update(realSeconds: number, surfaceDistance: number) {
    this.flightIntensity = 0;
    if (this.flight) {
      const f = this.flight;
      f.elapsed += realSeconds;
      const t = Math.min(1, f.elapsed / f.duration);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      this.origin.lerpVectors(f.from, f.getTarget(), eased);
      // Расстояние меняется в логарифмической шкале: от Нептуна к Земле без рывка в конце.
      if (f.endDirection) {
        this.scratch.copy(f.startDirection).lerp(f.endDirection, eased);
        if (this.scratch.lengthSq() > 1e-6) this.camera.position.copy(this.scratch.normalize());
      }
      this.setDistance(Math.exp(THREE.MathUtils.lerp(Math.log(f.startDistance), Math.log(f.endDistance), eased)));
      this.flightIntensity = Math.sin(Math.PI * t);
      if (t >= 1) this.flight = null;
    } else if (this.follow) {
      this.origin.copy(this.follow());
    }

    this.controls.update();
    // Перенос правой кнопкой сдвигает target; переносим сдвиг в origin и снимаем сопровождение.
    if (this.controls.target.lengthSq() > 0) {
      this.scratch.copy(this.controls.target);
      this.origin.add(this.scratch);
      this.camera.position.sub(this.scratch);
      this.controls.target.set(0, 0, 0);
      this.follow = null;
      this.flight = null;
    }

    this.camera.near = Math.max(MIN_NEAR, surfaceDistance * NEAR_TO_SURFACE_SHARE);
    this.camera.updateProjectionMatrix();
  }

  private setDistance(distance: number) {
    const direction = this.camera.position.lengthSq() > 0 ? this.camera.position.clone().normalize() : new THREE.Vector3(0, 0.5, 1).normalize();
    this.camera.position.copy(direction.multiplyScalar(distance));
  }

  dispose() {
    this.controls.dispose();
  }
}
