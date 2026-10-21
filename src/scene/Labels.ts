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

type Placed = { left: number; right: number; top: number; bottom: number };
type Projected = { x: number; y: number; diskPx: number; distance: number; inFront: boolean };
type LabelState = { element: HTMLButtonElement; halfWidth: number; x: number; y: number; shown: boolean; chosen: boolean };

/** Ширина подписи по числу знаков: измерять узлы каждый кадр — это пересчёт раскладки. */
function estimateHalfWidth(text: string): number {
  let width = LABEL_PADDING_PX;
  for (const char of text) width += char.codePointAt(0)! >= FIRST_WIDE_CODE_POINT ? LABEL_WIDE_CHAR_WIDTH_PX : LABEL_CHAR_WIDTH_PX;
  return width / 2;
}

/**
 * Подписи тел — обычные кнопки поверх холста. Позиция пишется прямо в style.transform
 * и только при изменении: React в покадровой работе не участвует.
 * Перекрывающиеся подписи прячутся по приоритету — выбранное тело, Солнце, крупные планеты.
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
    this.priority = [...BODIES].sort((a, b) => b.radiusKm - a.radiusKm).map(b => b.id);
  }

  setNames(nameOf: (id: BodyId) => string) {
    for (const [id, state] of this.states) {
      const name = nameOf(id);
      state.element.textContent = name;
      state.halfWidth = estimateHalfWidth(name);
    }
  }

  update(views: Map<BodyId, BodyView>, camera: THREE.PerspectiveCamera, width: number, height: number, selected: BodyId | null, enabled: boolean) {
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
          const overlaps = placed.some(p => rect.left < p.right && rect.right > p.left && rect.top < p.bottom && rect.bottom > p.top);
          shown = !overlaps || id === selected;
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
