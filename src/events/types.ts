import type * as THREE from 'three';
import type { BodyId } from '../data/bodies';
import type { LensParams } from '../lens/LensParams';
import type { FilmPeaks } from '../lens/filmPeaks';
import type { BodyView } from '../scene/BodyViews';

export type ScreenPoint = { x: number; y: number; onScreen: boolean };

/** Всё, что сценарию разрешено трогать. Координаты — в системе Солнца, наглядный масштаб. */
export type ScenarioContext = {
  /** Группа с центром в Солнце: сюда сценарий добавляет свои объекты. */
  system: THREE.Group;
  views: Map<BodyId, BodyView>;
  /** Линии орбит — гравитационная волна растягивает и их. */
  orbits: THREE.Group;
  camera: THREE.PerspectiveCamera;
  glowTexture: THREE.Texture;
  peaks: FilmPeaks;
  /** Положение камеры в системе Солнца. */
  cameraInSystem: () => THREE.Vector3;
  /** Точка системы → экран, 0…1 от верхнего левого угла. */
  project: (point: THREE.Vector3) => ScreenPoint;
  /** Угловой радиус сферы на экране в долях высоты кадра. */
  screenRadius: (point: THREE.Vector3, radius: number) => number;
  /** Множитель яркости солнечного диска и света. */
  setSunBrightness: (brightness: number) => void;
};

export type ScenarioFrame = {
  /** 0…1 за всё событие. */
  progress: number;
  /** Сила возмущения: плавно от 0 до 1 и обратно к 0 — система всегда возвращается. */
  envelope: number;
  realSeconds: number;
  /** Реальные секунды с запуска приложения — для анимации и пиков. */
  time: number;
};

export interface Scenario {
  /** Как лучше смотреть: на какое тело и с какого расстояния (в радиусах тела или единицах сцены). */
  readonly preferredView: { focus: BodyId | null; distance: number };
  /** Вызывается после расчёта орбит: сценарий сдвигает, масштабирует и прячет тела. */
  perturb?(frame: ScenarioFrame): void;
  /** Анимация своих объектов; возвращает вклад в объектив. */
  update(frame: ScenarioFrame): Partial<LensParams>;
  dispose(): void;
}

export type ScenarioFactory = (context: ScenarioContext) => Scenario;
