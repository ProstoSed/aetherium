import * as THREE from 'three';
import { BODY_BY_ID, PLANET_IDS, type BodyId } from '../data/bodies';
import { elementsAt, moonElementsAt, orbitPoint, type Vec3 } from '../physics/kepler';
import { heliocentricToScene, moonOffsetToScene, type ScaleMode } from '../physics/scale';
import { centuriesSinceJ2000 } from '../physics/time';

/**
 * Точек на орбиту. Хорда отходит от эллипса на r·(1 − cos(π/N)): в истинном масштабе при 512 точках
 * это 3,4 радиуса Нептуна, и планета вблизи висела бы мимо своей линии; при 4096 — 0,05 радиуса.
 */
const POINTS_PER_ORBIT: Record<ScaleMode, number> = { cinematic: 512, true: 4096 };
const MOON_POINTS = 512;
/** Элементы планет меняются медленно: перестраивать линию чаще раза в полгода нет смысла. */
const PLANET_REBUILD_CENTURIES = 0.005;
/** Узел лунной орбиты обходит круг за 18,6 года — пересчёт раз в несколько суток. */
const MOON_REBUILD_DAYS = 3;

type Line = { line: THREE.LineLoop; builtAt: number; builtMode: ScaleMode | null };

/**
 * Орбиты по настоящим элементам на текущую дату. При быстрой перемотке видно,
 * как поворачиваются перигелии и дрожат эксцентриситеты.
 */
export class OrbitLines {
  readonly group = new THREE.Group();
  readonly moonLine: Line;
  private readonly planetLines = new Map<BodyId, Line>();
  private readonly scratch: Vec3 = { x: 0, y: 0, z: 0 };

  constructor() {
    for (const id of PLANET_IDS) {
      const line = this.createLine(BODY_BY_ID[id].color, POINTS_PER_ORBIT.true);
      this.planetLines.set(id, line);
      this.group.add(line.line);
    }
    this.moonLine = this.createLine(BODY_BY_ID.moon.color, MOON_POINTS);
  }

  private createLine(color: string, maxPoints: number): Line {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(maxPoints * 3), 3));
    const material = new THREE.LineBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#d9b36c'), 0.55), transparent: true, opacity: 0.28, depthWrite: false });
    const line = new THREE.LineLoop(geometry, material);
    line.frustumCulled = false;
    return { line, builtAt: Number.NaN, builtMode: null };
  }

  update(julianDate: number, mode: ScaleMode, selected: BodyId | null) {
    const centuries = centuriesSinceJ2000(julianDate);
    for (const [id, entry] of this.planetLines) {
      const stale = entry.builtMode !== mode || !(Math.abs(centuries - entry.builtAt) < PLANET_REBUILD_CENTURIES);
      if (stale) this.rebuildPlanet(id, entry, julianDate, mode);
      const material = entry.line.material as THREE.LineBasicMaterial;
      material.opacity = id === selected ? 0.75 : 0.26;
    }
    const moonStale = this.moonLine.builtMode !== mode || !(Math.abs(julianDate - this.moonLine.builtAt) < MOON_REBUILD_DAYS);
    if (moonStale) this.rebuildMoon(julianDate, mode);
    (this.moonLine.line.material as THREE.LineBasicMaterial).opacity = selected === 'moon' ? 0.75 : 0.3;
  }

  private rebuildPlanet(id: BodyId, entry: Line, julianDate: number, mode: ScaleMode) {
    const elements = elementsAt(id, julianDate);
    const positions = entry.line.geometry.attributes.position as THREE.BufferAttribute;
    const count = POINTS_PER_ORBIT[mode];
    for (let i = 0; i < count; i++) {
      const point = orbitPoint(elements, (i / count) * Math.PI * 2);
      heliocentricToScene(point, mode, this.scratch);
      positions.setXYZ(i, this.scratch.x, this.scratch.y, this.scratch.z);
    }
    positions.needsUpdate = true;
    entry.line.geometry.setDrawRange(0, count);
    entry.builtAt = centuriesSinceJ2000(julianDate);
    entry.builtMode = mode;
  }

  private rebuildMoon(julianDate: number, mode: ScaleMode) {
    // Линия — средняя орбита: возмущения сдвигают саму Луну на ~1°, эллипс от этого почти не меняется.
    const elements = moonElementsAt(julianDate);
    const positions = this.moonLine.line.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < MOON_POINTS; i++) {
      moonOffsetToScene(orbitPoint(elements, (i / MOON_POINTS) * Math.PI * 2), mode, this.scratch);
      positions.setXYZ(i, this.scratch.x, this.scratch.y, this.scratch.z);
    }
    positions.needsUpdate = true;
    this.moonLine.builtAt = julianDate;
    this.moonLine.builtMode = mode;
  }
}
