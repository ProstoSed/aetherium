import * as THREE from 'three';
import { BODIES, type BodyId } from '../data/bodies';
import type { BodyView } from './BodyViews';

const LABEL_HEIGHT_PX = 24;
const LABEL_CHAR_WIDTH_PX = 7.6;
/** Иероглиф шире латинской буквы почти вдвое. */
const LABEL_WIDE_CHAR_WIDTH_PX = 13.5;
const FIRST_WIDE_CODE_POINT = 0x2e80;
const LABEL_PADDING_PX = 22;
const GAP_ABOVE_DISK_PX = 8;
const VIEWPORT_MARGIN_PX = 40;
/** Ширина подписи оценивается по числу знаков, поэтому у панелей запас: подпись не должна выглядывать из-под края. */
const BLOCKED_MARGIN_PX = 8;
/**
 * Кому уступать место при наложении, после выбранного тела. Земля первая: в обзоре она рядом
 * с Солнцем и Луной и без этого почти всегда пряталась. Солнце узнаётся и без подписи, Луна —
 * спутник Земли и в обзоре сливается с ней.
 */
const LABEL_PRIORITY: BodyId[] = ['earth', 'jupiter', 'saturn', 'mars', 'venus', 'uranus', 'neptune', 'mercury', 'sun', 'moon'];

type Placed = { left: number; right: number; top: number; bottom: number };
type Projected = { x: number; y: number; diskPx: number; distance: number; inFront: boolean };
type LabelState = { element: HTMLButtonElement; halfWidth: number; x: number; y: number; shown: boolean; chosen: boolean };

function intersects(a: Placed, b: Placed, margin = 0): boolean {
  return a.left < b.right + margin && a.right > b.left - margin && a.top < b.bottom + margin && a.bottom > b.top - margin;
}

/** Ширина подписи по числу знаков: измерять узлы каждый кадр — это пересчёт раскладки. */
function estimateHalfWidth(text: string): number {
  let width = LABEL_PADDING_PX;
  for (const char of text) width += char.codePointAt(0)! >= FIRST_WIDE_CODE_POINT ? LABEL_WIDE_CHAR_WIDTH_PX : LABEL_CHAR_WIDTH_PX;
  return width / 2;
}

/**
 * Подписи тел — обычные кнопки поверх холста. Позиция пишется прямо в style.transform
 * и только при изменении: React в покадровой работе не участвует.
 * Перекрывающиеся подписи прячутся по приоритету (LABEL_PRIORITY), подписи под панелями — всегда.
 */
export class Labels {
  private readonly states = new Map<BodyId, LabelState>();
  private readonly projected = new THREE.Vector3();
  private readonly world = new THREE.Vector3();
  private readonly priority: BodyId[];
  private readonly projections = new Map<BodyId, Projected>();

  constructor(private readonly container: HTMLElement, onSelect: (id: BodyId) => void) {
    for (const body of BODIES) {
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'scene-label';
      element.style.setProperty('--body-color', body.color);
      element.addEventListener('click', () => onSelect(body.id));
      container.appendChild(element);
      this.states.set(body.id, { element, halfWidth: 0, x: -1, y: -1, shown: false, chosen: false });
    }
    this.priority = LABEL_PRIORITY;
  }

  setNames(nameOf: (id: BodyId) => string) {
    for (const [id, state] of this.states) {
      const name = nameOf(id);
      state.element.textContent = name;
      state.halfWidth = estimateHalfWidth(name);
    }
  }

  /** blocked — прямоугольники панелей интерфейса: подпись под панелью не показывается, даже у выбранного тела. */
  update(views: Map<BodyId, BodyView>, camera: THREE.PerspectiveCamera, width: number, height: number, selected: BodyId | null, enabled: boolean, blocked: readonly Placed[]) {
    const placed: Placed[] = [];
    const pixelsPerRadian = height / THREE.MathUtils.degToRad(camera.fov);
    const order = selected ? [selected, ...this.priority.filter(id => id !== selected)] : this.priority;

    for (const [id, view] of views) {
      view.root.getWorldPosition(this.world);
      const distance = this.world.distanceTo(camera.position);
      this.projected.copy(this.world).project(camera);
      this.projections.set(id, {
        x: (this.projected.x * 0.5 + 0.5) * width,
        y: (-this.projected.y * 0.5 + 0.5) * height,
        diskPx: (view.radius * view.root.scale.x / Math.max(distance, 1e-9)) * pixelsPerRadian,
        distance,
        inFront: this.projected.z > -1 && this.projected.z < 1,
      });
    }

    for (const id of order) {
      const state = this.states.get(id)!;
      const view = views.get(id)!;
      const p = this.projections.get(id)!;
      let shown = enabled && view.root.visible && p.inFront && !this.isHidden(id, p);
      let x = 0, y = 0;
      if (shown) {
        x = Math.round(p.x);
        y = Math.round(p.y - Math.min(p.diskPx, height) - GAP_ABOVE_DISK_PX);
        const inside = x > -VIEWPORT_MARGIN_PX && x < width + VIEWPORT_MARGIN_PX && y > -VIEWPORT_MARGIN_PX && y < height + VIEWPORT_MARGIN_PX;
        shown = inside;
        if (shown) {
          const halfWidth = state.halfWidth;
          const rect = { left: x - halfWidth, right: x + halfWidth, top: y - LABEL_HEIGHT_PX, bottom: y };
          const overlaps = placed.some(p => intersects(rect, p));
          shown = (!overlaps || id === selected) && !blocked.some(b => intersects(rect, b, BLOCKED_MARGIN_PX));
          if (shown) placed.push(rect);
        }
      }
      this.write(state, shown, x, y, id === selected);
    }
  }

  /** Тело заслонено, если его центр лежит внутри диска более близкого тела. */
  private isHidden(id: BodyId, target: Projected): boolean {
    for (const [otherId, other] of this.projections) {
      if (otherId === id || !other.inFront || other.distance >= target.distance) continue;
      if (Math.hypot(other.x - target.x, other.y - target.y) < other.diskPx) return true;
    }
    return false;
  }

  private write(state: LabelState, shown: boolean, x: number, y: number, chosen: boolean) {
    if (state.shown !== shown) {
      state.element.classList.toggle('is-visible', shown);
      state.shown = shown;
    }
    if (state.chosen !== chosen) {
      state.element.classList.toggle('is-chosen', chosen);
      state.chosen = chosen;
    }
    if (shown && (state.x !== x || state.y !== y)) {
      state.element.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
      state.x = x;
      state.y = y;
    }
  }

  dispose() {
    this.container.replaceChildren();
  }
}
