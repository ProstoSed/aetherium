import * as THREE from 'three';
import { BODIES, PLANET_IDS, type BodyId } from '../data/bodies';
import type { EventId } from '../data/events';
import { EventDirector } from '../events/EventDirector';
import type { ScenarioContext } from '../events/types';
import { i18n } from '../i18n';
import { formatSimulationDate } from '../i18n/format';
import { FilmOverlay } from '../lens/FilmOverlay';
import { FilmPeaks, emptyPeakState } from '../lens/filmPeaks';
import { LensDirector, type FilmIntensity } from '../lens/LensDirector';
import { LensPass } from '../lens/LensPass';
import { heliocentricPosition, length, moonGeocentricKm, type Vec3 } from '../physics/kepler';
import { terrestrialTime } from '../physics/time';
import { KM_PER_AU, auFromSceneDistance, heliocentricToScene, moonOffsetToScene, overviewDistance, type ScaleMode } from '../physics/scale';
import { createAsteroidBelt } from '../scene/AsteroidBelt';
import { BodyViews } from '../scene/BodyViews';
import { Labels } from '../scene/Labels';
import { OrbitLines } from '../scene/OrbitLines';
import { SurfaceBaker } from '../scene/planets/SurfaceBaker';
import { renderThumbnails } from '../scene/planets/thumbnails';
import { SkyLayer } from '../scene/sky/SkyLayer';
import { createGlowTexture } from '../scene/textures';
import { AdaptiveQuality, type QualityMode } from './AdaptiveQuality';
import { freeBandCenter } from './framing';
import { CameraRig, VIEW_DISTANCE_IN_RADII } from './CameraRig';
import { SPEED_PRESETS, SimulationClock, type SpeedId } from './SimulationClock';
import { createStore } from './store';

/** Запись хроники хранит факты, а не текст: при смене языка хроника перечитывается на новом. */
export type HistoryEntry = { key: number; eventId: EventId; outcome: 'started' | 'completed' | 'interrupted'; julianDate: number };

export type ObservatoryState = {
  selected: BodyId | null;
  focused: BodyId | null;
  scaleMode: ScaleMode;
  speedId: SpeedId;
  reversed: boolean;
  paused: boolean;
  activeEvent: EventId | null;
  /** Куда смотрит идущее событие: тело или весь обзор (null). */
  eventFocus: BodyId | null;
  autoEvents: boolean;
  autoInterval: number;
  showOrbits: boolean;
  showLabels: boolean;
  showAsteroids: boolean;
  showConstellations: boolean;
  film: FilmIntensity;
  quality: QualityMode;
  history: HistoryEntry[];
  /** Запекание поверхностей и компиляция шейдеров, 0…1. */
  loadProgress: number;
  /** Сцена готова к показу: поверхности запечены, шейдеры собраны. */
  ready: boolean;
  /** Изображения тел для интерфейса (data URL); появляются после запекания. */
  thumbnails: Partial<Record<BodyId, string>>;
};

/** Покадровые величины для интерфейса: пишутся прямо в DOM, мимо React. */
export type FrameInfo = {
  julianDate: number;
  dateText: string;
  eventProgress: number;
  eventRemaining: number;
  autoCountdown: number;
  /** Для выбранного тела: расстояние до Солнца (а. е.) и до Земли (км). */
  selectedFromSunAu: number | null;
  selectedFromEarthKm: number | null;
  fps: number;
};

type Pending = { at: number; action: () => void };
/** Панель интерфейса поверх сцены. framing — учитывать ли её, выбирая, где по высоте держать центр кадра. */
type Occluder = { element: HTMLElement; framing: boolean };

const SCALE_CHANGE_COVER_DELAY = 0.18;
const EVENT_START_AFTER_SCALE_CHANGE = 0.45;
const CLICK_MOVE_TOLERANCE_PX = 5;
const PICK_RADIUS_PX = 18;
/** Тела ближе друг к другу на экране, чем это, касанием не различить: выбирается крупное (Земля, а не Луна). */
const PICK_TIE_PX = 4;
const SUN_LIGHT_INTENSITY = 3.2;
const AMBIENT_INTENSITY = 0.1;
const NEAR_BODY_FAR_RADII = 16;
const NEAR_BODY_CLOSE_RADII = 2.5;
const FREE_CAMERA_MIN_DISTANCE: Record<ScaleMode, number> = { cinematic: 0.5, true: 0.01 };
/**
 * Плёнка мерцает каждый кадр, а на пиках даёт вспышки на весь экран и тряску. Тому, кто попросил
 * систему уменьшить движение, она по умолчанию выключена; включить можно в настройках.
 */
const DEFAULT_FILM: FilmIntensity = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'off' : 'soft';

export class Observatory {
  readonly store = createStore<ObservatoryState>({
    selected: null,
    focused: null,
    scaleMode: 'cinematic',
    speedId: 'week',
    reversed: false,
    paused: false,
    activeEvent: null,
    eventFocus: null,
    autoEvents: true,
    autoInterval: 120,
    showOrbits: true,
    showLabels: true,
    showAsteroids: true,
    film: DEFAULT_FILM,
    quality: 'auto',
    history: [],
    showConstellations: true,
    loadProgress: 0,
    ready: false,
    thumbnails: {},
  });
  readonly frameListeners = new Set<(frame: FrameInfo) => void>();

  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly system = new THREE.Group();
  private readonly rig: CameraRig;
  private readonly clock = new SimulationClock();
  private readonly bodies: BodyViews;
  private readonly orbits = new OrbitLines();
  private readonly belt = createAsteroidBelt();
  private readonly baker = new SurfaceBaker();
  private readonly sky = new SkyLayer();
  private shadersCompiling = false;
  private readonly labels: Labels;
  private readonly lensPass = new LensPass();
  private readonly peaks = new FilmPeaks();
  private readonly lens = new LensDirector(this.peaks);
  private readonly overlay: FilmOverlay;
  private readonly events: EventDirector;
  private readonly quality = new AdaptiveQuality();
  private readonly resizeObserver: ResizeObserver;
  private readonly heliocentric = new Map<BodyId, Vec3>();
  private readonly peakState = emptyPeakState();
  private readonly pending: Pending[] = [];
  private readonly frame: FrameInfo;
  private sunBrightness = 1;
  private eventView: { focus: BodyId | null; distance: number } | null = null;
  private pendingEventId: EventId | null = null;
  private pendingScaleMode: ScaleMode | null = null;
  private historyKey = 0;
  private readonly stopListeningLanguage: () => void;
  private animationFrame = 0;
  private disposed = false;
  private stopWatchingPixelRatio = () => {};
  private readonly glowTexture = createGlowTexture();
  private lastTimestamp = 0;
  private width = 1;
  private height = 1;
  private pointerDown = { x: 0, y: 0 };
  private readonly occluders = new Set<Occluder>();
  private readonly occluderRects: DOMRect[] = [];
  private readonly coveredBands: [number, number][] = [];
  private readonly scratch = { world: new THREE.Vector3(), projected: new THREE.Vector3(), scene: { x: 0, y: 0, z: 0 } as Vec3, drawingBuffer: new THREE.Vector2() };

  constructor(private readonly host: HTMLElement, labelsLayer: HTMLElement, hud: HTMLElement) {
    // Буфер глубины холсту не нужен: сцена рисуется в свою цель, а на холст ложится только
    // полноэкранный проход объектива без проверки глубины.
    this.renderer = new THREE.WebGLRenderer({ antialias: false, depth: false, powerPreference: 'high-performance', stencil: false });
    // Сцена, ореол и рельеф рисуются в half float. В WebGL 2 рисовать в такие цели можно только
    // с расширением; без него кадр молча остаётся чёрным — лучше честно показать ошибку.
    const extensions = this.renderer.extensions;
    if (!extensions.has('EXT_color_buffer_float') && !extensions.has('EXT_color_buffer_half_float')) {
      this.renderer.dispose();
      throw new Error('Rendering to half-float targets is not supported (EXT_color_buffer_float)');
    }
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.toneMapping = THREE.NoToneMapping;
    // Проверка ошибок шейдера синхронно ждёт драйвер при первом использовании программы — секунды
    // блокировки при старте. В разработке она нужна ради сообщений об ошибках, в сборке — нет.
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV;
    host.appendChild(this.renderer.domElement);

    this.rig = new CameraRig(this.renderer.domElement);
    this.bodies = new BodyViews(this.clock.julianDate, this.baker);
    this.labels = new Labels(labelsLayer, id => this.select(id, true));
    this.stopListeningLanguage = i18n.subscribe(() => this.applyLanguage());
    this.applyLanguage();
    this.overlay = new FilmOverlay(hud);
    document.body.appendChild(this.overlay.canvas);

    this.scene.add(this.system, new THREE.AmbientLight(0x8da0c8, AMBIENT_INTENSITY));
    this.system.add(this.bodies.group, this.orbits.group, this.orbits.moonLine.line, this.belt.points);
    for (const id of PLANET_IDS) this.heliocentric.set(id, { x: 0, y: 0, z: 0 });

    this.events = new EventDirector(this.createScenarioContext(), {
      onStart: (info, scenario) => {
        this.store.set({ activeEvent: info.id, eventFocus: scenario.preferredView.focus });
        this.addHistory(info.id, 'started');
        this.eventView = scenario.preferredView;
        this.showEvent();
      },
      onEnd: (info, interrupted) => {
        this.store.set({ activeEvent: null, eventFocus: null });
        this.eventView = null;
        this.events.resetCountdown(this.store.get().autoInterval);
        this.addHistory(info.id, interrupted ? 'interrupted' : 'completed');
      },
    }, this.store.get().autoInterval);

    this.frame = {
      julianDate: this.clock.julianDate, dateText: '', eventProgress: 0, eventRemaining: 0, autoCountdown: 0,
      selectedFromSunAu: null, selectedFromEarthKm: null, fps: 60,
    };

    this.applyScaleMode('cinematic');
    this.rig.jumpTo(() => new THREE.Vector3(), overviewDistance('cinematic'));
    this.rig.camera.position.set(0, 0.42, 1).normalize().multiplyScalar(overviewDistance('cinematic'));

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.watchPixelRatio();

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    this.store.subscribe(() => { host.dataset.sceneReady = String(this.store.get().ready); });
    this.animationFrame = requestAnimationFrame(this.tick);
    // Доступ из консоли и автотестов при разработке; в сборку не попадает.
    if (import.meta.env.DEV) (window as unknown as { observatory: Observatory }).observatory = this;
  }

  // --- Команды интерфейса ---------------------------------------------------

  select(id: BodyId | null, fly = false) {
    this.store.set({ selected: id });
    if (fly && id) this.focus(id);
  }

  focus(id: BodyId) {
    this.store.set({ focused: id, selected: id });
    const view = this.bodies.views.get(id)!;
    const radiiAway = id === 'saturn' ? VIEW_DISTANCE_IN_RADII * 1.6 : id === 'sun' ? 4 : VIEW_DISTANCE_IN_RADII;
    this.flyToTarget(id, view.radius * radiiAway, id === 'sun' ? null : this.threeQuarterView(view.root.position));
  }

  /**
   * Направление камеры «на три четверти»: Солнце сбоку-сзади от наблюдателя, видны и день,
   * и терминатор. Прилёт с ночной стороны показывал бы чёрный круг.
   */
  private threeQuarterView(bodyPosition: THREE.Vector3): THREE.Vector3 {
    const toSun = bodyPosition.clone().negate().normalize();
    const side = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, toSun).normalize();
    return toSun.multiplyScalar(0.62).addScaledVector(side, 0.72).add(new THREE.Vector3(0, 0.3, 0)).normalize();
  }

  overview() {
    this.store.set({ focused: null });
    this.flyToTarget(null, overviewDistance(this.store.get().scaleMode));
  }

  setScaleMode(mode: ScaleMode) {
    // Смена применяется с задержкой: повторный запрос того же масштаба за это время ничего не добавляет.
    if (mode === (this.pendingScaleMode ?? this.store.get().scaleMode)) return;
    if (mode === 'true' && this.events.activeId) this.events.stop();
    const now = performance.now() / 1000;
    this.peaks.triggerReelChange(now);
    this.pendingScaleMode = mode;
    // Сама подмена — в момент, когда кадр закрыт засветкой: переход без видимого рывка.
    this.schedule(now + SCALE_CHANGE_COVER_DELAY, () => {
      if (this.pendingScaleMode !== mode) return;
      this.pendingScaleMode = null;
      if (mode !== this.store.get().scaleMode) this.applyScaleModeKeepingView(mode);
    });
  }

  setSpeed(speedId: SpeedId) {
    const preset = SPEED_PRESETS.find(p => p.id === speedId);
    if (!preset) return;
    this.clock.daysPerSecond = preset.daysPerSecond;
    this.store.set({ speedId });
  }

  setPaused(paused: boolean) {
    this.clock.paused = paused;
    this.store.set({ paused });
  }

  setReversed(reversed: boolean) {
    this.clock.direction = reversed ? -1 : 1;
    this.store.set({ reversed });
  }

  jumpToNow() {
    this.clock.resetToNow();
  }

  /**
   * В истинном масштабе события невидимы: планеты меньше пикселя. Сначала — смена кадра, затем
   * тот же запуск заново: он снова проверит масштаб (его могли вернуть за эти доли секунды) и снимет
   * паузу. Ждёт только один запуск — повторный щелчок заменяет его, а не ставит второй в очередь.
   */
  startEvent(id: EventId) {
    if (this.store.get().scaleMode === 'true') {
      this.pendingEventId = id;
      this.setScaleMode('cinematic');
      this.schedule(performance.now() / 1000 + EVENT_START_AFTER_SCALE_CHANGE, () => {
        const pending = this.pendingEventId;
        this.pendingEventId = null;
        if (pending && this.store.get().scaleMode === 'cinematic') this.startEvent(pending);
      });
      return;
    }
    this.pendingEventId = null;
    if (this.clock.paused) this.setPaused(false);
    this.events.start(id);
  }

  stopEvent() {
    this.events.stop();
  }

  /** Камера — туда, откуда событие задумано смотреть: после выбора другого тела к нему иначе не вернуться. */
  showEvent() {
    if (!this.eventView) return;
    const { focus, distance } = this.eventView;
    this.store.set({ focused: focus, selected: focus ?? this.store.get().selected });
    this.flyToTarget(focus, distance);
  }

  updateSettings(patch: Partial<Pick<ObservatoryState, 'autoEvents' | 'autoInterval' | 'showOrbits' | 'showLabels' | 'showAsteroids' | 'showConstellations' | 'film' | 'quality'>>) {
    this.store.set(patch);
    if (patch.autoInterval !== undefined) this.events.resetCountdown(patch.autoInterval);
    if (patch.quality !== undefined) {
      this.quality.mode = patch.quality;
      this.resize();
    }
  }

  clearHistory() {
    this.store.set({ history: [] });
  }

  /**
   * Регистрирует панель интерфейса поверх сцены: подписи тел под ней прячутся, а панели с framing
   * сдвигают кадр так, чтобы центр внимания стоял в свободной от них полосе (на телефоне карточка
   * тела закрывает нижнюю половину экрана). Возвращает функцию отмены.
   */
  addOccluder(element: HTMLElement, framing: boolean): () => void {
    const occluder = { element, framing };
    this.occluders.add(occluder);
    return () => { this.occluders.delete(occluder); };
  }

  // --- Кадр ------------------------------------------------------------------

  private readonly tick = (timestamp: number) => {
    this.animationFrame = requestAnimationFrame(this.tick);
    const realSeconds = Math.min(0.1, this.lastTimestamp ? (timestamp - this.lastTimestamp) / 1000 : 1 / 60);
    this.lastTimestamp = timestamp;
    const now = timestamp / 1000;

    // Сначала отложенные действия (смена масштаба за засветкой), потом снимок состояния: иначе
    // кадр смены считал бы положения в старом масштабе, а радиусы и камера были бы уже в новом.
    this.runPending(now);
    const state = this.store.get();
    if (!state.ready) {
      this.advanceLoading();
      return;
    }
    if (this.quality.sample(realSeconds)) this.resize();
    this.peaks.strength = state.film === 'off' ? 0 : state.film === 'strong' ? 1.2 : 1;

    const daysAdvanced = this.clock.advance(realSeconds);
    this.updateBodyPositions(state.scaleMode);
    this.events.advance(realSeconds, now, state.paused, { enabled: state.autoEvents, allowed: state.scaleMode === 'cinematic', interval: state.autoInterval });
    this.events.perturb();
    this.updateMoon(state.scaleMode);
    const eventLens = this.events.update();

    this.bodies.updateRotation(this.clock.julianDate, daysAdvanced, realSeconds);
    this.orbits.update(terrestrialTime(this.clock.julianDate), state.scaleMode, state.selected);
    this.orbits.group.visible = state.showOrbits;
    this.orbits.moonLine.line.visible = state.showOrbits;
    this.orbits.moonLine.line.position.copy(this.bodies.views.get('earth')!.root.position);
    this.belt.points.visible = state.showAsteroids;
    this.belt.update(this.clock.julianDate, state.scaleMode, this.renderer.getPixelRatio());

    this.measureOccluders();
    this.rig.update(realSeconds, this.nearestSurfaceDistance());
    if (!this.rig.isFollowing && state.focused) this.store.set({ focused: null });
    this.system.position.copy(this.rig.origin).negate();
    this.scene.updateMatrixWorld();

    const camera = this.rig.camera;
    const sun = this.bodies.views.get('sun')!;
    const sunWorld = sun.root.getWorldPosition(this.scratch.world);
    const cameraToSun = sunWorld.distanceTo(camera.position);
    this.bodies.sunLight.intensity = SUN_LIGHT_INTENSITY * this.sunBrightness;
    this.bodies.updateSun(now, this.sunBrightness, camera, cameraToSun);
    camera.updateMatrixWorld();
    this.bodies.updateLighting(camera, now, this.sunBrightness);
    this.sky.update(camera, this.renderer.getPixelRatio(), state.showConstellations);
    this.bodies.updateMarkers(camera, this.height, this.renderer.getPixelRatio(), state.scaleMode === 'true' || state.showLabels);
    this.labels.update(this.bodies.views, camera, this.width, this.height, state.selected, state.showLabels, this.occluderRects);

    this.peaks.sample(now, this.peakState);
    const sunScreen = this.projectSystemPoint(sun.root.position);
    const params = this.lens.update({
      intensity: state.film,
      sun: { ...sunScreen, radiusFraction: this.screenRadius(sun.root.position, sun.radius * sun.root.scale.x) },
      viewedDistanceAu: auFromSceneDistance(this.rig.origin.length(), state.scaleMode),
      nearBody: this.nearestBody(),
      flight: this.rig.flightIntensity,
      daysPerSecond: this.clock.daysPerSecond,
      event: eventLens,
      peak: this.peakState,
    }, realSeconds, now);

    this.lensPass.render(this.renderer, this.sky, this.scene, camera, params, now);
    this.overlay.update(this.peakState, now, params.cueMark > 0.5);
    this.publishFrame(state, realSeconds);
  };

  /**
   * Пока сцена не готова, кадр тратится только на подготовку: запекание граней, затем
   * параллельная компиляция шейдеров сцены и неба, затем миниатюры. Сцена не рисуется —
   * отрисовка до конца компиляции заставила бы браузер собирать шейдеры синхронно.
   */
  private advanceLoading() {
    if (!this.baker.done) {
      this.baker.step(this.renderer);
      const progress = Math.round(this.baker.progress * 80) / 100;
      if (progress !== this.store.get().loadProgress) this.store.set({ loadProgress: progress });
      return;
    }
    if (this.shadersCompiling) return;
    this.shadersCompiling = true;
    this.store.set({ loadProgress: 0.85 });
    const mode = this.store.get().scaleMode;
    this.updateBodyPositions(mode);
    this.updateMoon(mode);
    this.scene.updateMatrixWorld();
    void this.lensPass.compileAsync(this.renderer, this.scene, this.rig.camera, this.sky).then(() => {
      if (this.disposed) return;
      const thumbnails = renderThumbnails(this.renderer, this.bodies.views, sun => this.bodies.useThumbnailLighting(sun));
      this.store.set({ thumbnails, loadProgress: 1, ready: true });
      this.lastTimestamp = 0;
    });
  }

  /** Положения — в земном времени TT, а вращение Земли и дата в интерфейсе — в гражданском UT (см. deltaTSeconds). */
  private updateBodyPositions(mode: ScaleMode) {
    const jd = terrestrialTime(this.clock.julianDate);
    for (const id of PLANET_IDS) {
      const au = heliocentricPosition(id, jd);
      this.heliocentric.set(id, au);
      const view = this.bodies.views.get(id)!;
      heliocentricToScene(au, mode, this.scratch.scene);
      view.root.position.set(this.scratch.scene.x, this.scratch.scene.y, this.scratch.scene.z);
    }
    this.bodies.views.get('sun')!.root.position.set(0, 0, 0);
  }

  private updateMoon(mode: ScaleMode) {
    const offset = moonOffsetToScene(moonGeocentricKm(terrestrialTime(this.clock.julianDate)), mode, this.scratch.scene);
    this.bodies.views.get('moon')!.root.position.copy(this.bodies.views.get('earth')!.root.position).add(offset);
  }

  private publishFrame(state: ObservatoryState, realSeconds: number) {
    const frame = this.frame;
    frame.julianDate = this.clock.julianDate;
    frame.dateText = formatSimulationDate(i18n.messages, this.clock.julianDate);
    frame.eventProgress = this.events.progress;
    frame.eventRemaining = this.events.remainingSeconds;
    frame.autoCountdown = this.events.countdown;
    frame.fps += (1 / Math.max(realSeconds, 1e-3) - frame.fps) * 0.05;
    frame.selectedFromSunAu = null;
    frame.selectedFromEarthKm = null;
    if (state.selected && state.selected !== 'sun') {
      const earthAu = this.heliocentric.get('earth')!;
      const moonKm = moonGeocentricKm(terrestrialTime(this.clock.julianDate));
      const selectedAu = state.selected === 'moon'
        ? { x: earthAu.x + moonKm.x / KM_PER_AU, y: earthAu.y + moonKm.y / KM_PER_AU, z: earthAu.z + moonKm.z / KM_PER_AU }
        : this.heliocentric.get(state.selected)!;
      frame.selectedFromSunAu = length(selectedAu);
      if (state.selected === 'moon') frame.selectedFromEarthKm = length(moonKm);
      else if (state.selected !== 'earth') {
        frame.selectedFromEarthKm = Math.hypot(selectedAu.x - earthAu.x, selectedAu.y - earthAu.y, selectedAu.z - earthAu.z) * KM_PER_AU;
      }
    }
    this.frameListeners.forEach(listener => listener(frame));
  }

  // --- Масштаб и камера ------------------------------------------------------

  private applyScaleMode(mode: ScaleMode) {
    this.bodies.applyScale(mode);
    this.store.set({ scaleMode: mode });
    this.updateBodyPositions(mode);
    this.updateMoon(mode);
    this.updateDistanceLimits();
  }

  /** Смена масштаба с сохранением кадра: тот же объект занимает ту же долю экрана. */
  private applyScaleModeKeepingView(mode: ScaleMode) {
    const { focused } = this.store.get();
    const before = focused ? this.bodies.views.get(focused)!.radius : overviewDistance(this.store.get().scaleMode);
    const distanceShare = this.rig.distance / before;
    this.applyScaleMode(mode);
    if (focused) {
      const view = this.bodies.views.get(focused)!;
      this.rig.jumpTo(() => view.root.position, view.radius * distanceShare);
    } else {
      this.rig.jumpTo(() => new THREE.Vector3(), overviewDistance(mode) * Math.min(distanceShare, 1.5));
    }
    this.updateDistanceLimits();
  }

  private flyToTarget(focus: BodyId | null, distance: number, direction: THREE.Vector3 | null = null) {
    const target = focus ? this.bodies.views.get(focus)!.root.position : new THREE.Vector3();
    this.updateDistanceLimits(focus);
    this.rig.flyTo(() => target, distance, direction);
  }

  private updateDistanceLimits(focus = this.store.get().focused) {
    const mode = this.store.get().scaleMode;
    const overview = overviewDistance(mode);
    const minimum = focus ? this.bodies.views.get(focus)!.radius * 1.2 : FREE_CAMERA_MIN_DISTANCE[mode];
    this.rig.setDistanceLimits(minimum, overview * 3);
  }

  /** До ближайшей поверхности — от него зависит ближняя плоскость отсечения камеры. */
  private nearestSurfaceDistance(): number {
    let nearest = this.rig.distance;
    const camera = this.cameraInSystem();
    for (const view of this.bodies.views.values()) {
      const gap = view.root.position.distanceTo(camera) - view.radius * view.root.scale.x;
      nearest = Math.min(nearest, Math.max(gap, view.radius * 0.02));
    }
    return nearest;
  }

  private nearestBody(): { id: BodyId; closeness: number } | null {
    let best: { id: BodyId; closeness: number } | null = null;
    const camera = this.cameraInSystem();
    for (const view of this.bodies.views.values()) {
      const radii = view.root.position.distanceTo(camera) / Math.max(view.radius, 1e-9);
      const closeness = 1 - THREE.MathUtils.smoothstep(radii, NEAR_BODY_CLOSE_RADII, NEAR_BODY_FAR_RADII);
      if (closeness > 0 && (!best || closeness > best.closeness)) best = { id: view.info.id, closeness };
    }
    return best;
  }

  private cameraInSystem(): THREE.Vector3 {
    return this.rig.camera.position.clone().add(this.rig.origin);
  }

  private projectSystemPoint(point: THREE.Vector3) {
    const p = this.scratch.projected.copy(point).sub(this.rig.origin).project(this.rig.camera);
    return { x: p.x * 0.5 + 0.5, y: -p.y * 0.5 + 0.5, onScreen: p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.2 && Math.abs(p.y) < 1.2 };
  }

  private screenRadius(point: THREE.Vector3, radius: number): number {
    const distance = point.clone().sub(this.rig.origin).distanceTo(this.rig.camera.position);
    const angular = Math.atan(radius / Math.max(distance, 1e-9));
    return Math.tan(angular) / (2 * Math.tan(THREE.MathUtils.degToRad(this.rig.camera.fov) / 2));
  }

  private createScenarioContext(): ScenarioContext {
    return {
      system: this.system,
      views: this.bodies.views,
      orbits: this.orbits.group,
      camera: this.rig.camera,
      glowTexture: this.glowTexture,
      peaks: this.peaks,
      cameraInSystem: () => this.cameraInSystem(),
      project: point => this.projectSystemPoint(point),
      screenRadius: (point, radius) => this.screenRadius(point, radius),
      setSunBrightness: brightness => { this.sunBrightness = brightness; },
    };
  }

  // --- Служебное -------------------------------------------------------------

  /**
   * Прямоугольники панелей читаются каждый кадр: они двигаются (анимации, смена раскладки, язык),
   * а размер при этом может не меняться, и ResizeObserver об этом не скажет. Раскладка к этому
   * моменту обычно уже посчитана, так что чтение почти бесплатно.
   */
  private measureOccluders() {
    this.occluderRects.length = 0;
    this.coveredBands.length = 0;
    const centerX = this.width / 2;
    for (const { element, framing } of this.occluders) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      this.occluderRects.push(rect);
      if (framing && rect.left < centerX && rect.right > centerX) this.coveredBands.push([rect.top, rect.bottom]);
    }
    this.rig.setFramingCenter(freeBandCenter(this.coveredBands, this.height));
  }

  private schedule(at: number, action: () => void) {
    this.pending.push({ at, action });
  }

  /**
   * Созревшие действия выполняются в порядке их времени. На медленной машине кадр длиннее промежутков
   * между ними, и в один кадр созревают сразу несколько: запуск события после смены масштаба обязан
   * увидеть масштаб уже сменённым.
   */
  private runPending(now: number) {
    const due = this.pending.filter(entry => now >= entry.at).sort((a, b) => a.at - b.at);
    if (due.length === 0) return;
    this.pending.splice(0, this.pending.length, ...this.pending.filter(entry => now < entry.at));
    for (const { action } of due) action();
  }

  private addHistory(eventId: EventId, outcome: HistoryEntry['outcome']) {
    const entry: HistoryEntry = { key: ++this.historyKey, eventId, outcome, julianDate: this.clock.julianDate };
    this.store.set(state => ({ history: [entry, ...state.history].slice(0, 60) }));
  }

  /** Подписи тел и созвездий в сцене рисует движок, а не React, — их язык меняется здесь. */
  private applyLanguage() {
    const messages = i18n.messages;
    this.labels.setNames(id => messages.bodies[id].name);
    this.sky.setLanguage(i18n.language);
  }

  /**
   * Окно перенесли на монитор с другим масштабом: размер в точках может не измениться, и
   * ResizeObserver молчит, а плотность пикселей уже другая. Запрос на текущую плотность срабатывает
   * один раз, поэтому после каждого срабатывания ставится заново.
   */
  private watchPixelRatio() {
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const onChange = () => {
      this.resize();
      this.watchPixelRatio();
    };
    query.addEventListener('change', onChange, { once: true });
    this.stopWatchingPixelRatio = () => query.removeEventListener('change', onChange);
  }

  private resize() {
    this.width = Math.max(1, this.host.clientWidth);
    this.height = Math.max(1, this.host.clientHeight);
    const pixelRatio = this.quality.pixelRatio(window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.rig.setAspect(this.width / this.height);
    // Размер цели сцены — ровно размер буфера холста (three.js округляет вниз): разница в пиксель
    // заставила бы последний проход растягивать кадр и мылить его на полтекселя.
    const drawingBuffer = this.renderer.getDrawingBufferSize(this.scratch.drawingBuffer);
    this.lensPass.setSize(drawingBuffer.x, drawingBuffer.y, this.quality.msaaSamples(window.devicePixelRatio || 1));
  }

  /**
   * Контекст WebGL теряется при сбросе драйвера, сне ноутбука, нехватке памяти на телефоне.
   * three.js сам отменяет потерю и после восстановления заново заливает текстуры с картинками,
   * но кубические карты поверхностей были только в видеопамяти: без нового запекания планеты
   * остались бы чёрными. Сцена снова проходит подготовку, как при запуске.
   */
  private readonly onContextRestored = () => {
    this.baker.queueAll();
    this.shadersCompiling = false;
    this.store.set({ ready: false, loadProgress: 0 });
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    this.pointerDown = { x: event.clientX, y: event.clientY };
  };

  /**
   * Выбор тела щелчком. По экранной близости, а не лучом: в истинном масштабе диск меньше пикселя.
   * Ближе всех — тот, у кого меньше доля от зоны захвата; почти равные кандидаты решаются в пользу крупного.
   */
  private readonly onPointerUp = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > CLICK_MOVE_TOLERANCE_PX) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    let best: { id: BodyId; gap: number; score: number; radiusKm: number } | null = null;
    for (const body of BODIES) {
      const view = this.bodies.views.get(body.id)!;
      if (!view.root.visible || view.root.scale.x < 0.01) continue;
      const screen = this.projectSystemPoint(view.root.position);
      if (!screen.onScreen) continue;
      const diskPx = this.screenRadius(view.root.position, view.radius) * this.height;
      const gap = Math.hypot(screen.x * this.width - x, screen.y * this.height - y);
      const reach = Math.max(diskPx, PICK_RADIUS_PX);
      if (gap > reach) continue;
      const candidate = { id: body.id, gap, score: gap / reach, radiusKm: body.radiusKm };
      const tie = best && Math.abs(gap - best.gap) < PICK_TIE_PX;
      if (!best || (tie ? candidate.radiusKm > best.radiusKm : candidate.score < best.score)) best = candidate;
    }
    if (best) this.select(best.id);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.stopWatchingPixelRatio();
    this.stopListeningLanguage();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.events.dispose();
    this.rig.dispose();
    this.labels.dispose();
    this.overlay.dispose();
    this.lensPass.dispose();
    this.baker.dispose();
    this.sky.dispose();
    this.scene.traverse(object => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      materials.forEach(material => {
        Object.values(material).forEach(value => { if (value instanceof THREE.Texture) value.dispose(); });
        material.dispose();
      });
    });
    this.glowTexture.dispose();
    this.renderer.dispose();
    // Иначе контексты копятся при горячей перезагрузке, а их у вкладки всего около шестнадцати.
    this.renderer.forceContextLoss();
    canvas.remove();
    if (import.meta.env.DEV) delete (window as unknown as { observatory?: Observatory }).observatory;
  }
}
