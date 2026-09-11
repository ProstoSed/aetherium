import * as THREE from 'three';
import { BODY_BY_ID, PLANET_IDS, type BodyId } from '../data/bodies';
import { MOON_ORBIT } from '../data/orbitalElements';
import { elementsAt, orbitPoint, type Vec3 } from '../physics/kepler';
import { heliocentricToScene, moonOffsetToScene, type ScaleMode } from '../physics/scale';
import { centuriesSinceJ2000 } from '../physics/time';

const POINTS_PER_ORBIT = 512;
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
      const line = this.createLine(BODY_BY_ID[id].color);
      this.planetLines.set(id, line);
      this.group.add(line.line);
    }
    this.moonLine = this.createLine(BODY_BY_ID.moon.color);
  }

  private createLine(color: string): Line {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(POINTS_PER_ORBIT * 3), 3));
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
    for (let i = 0; i < POINTS_PER_ORBIT; i++) {
      const point = orbitPoint(elements, (i / POINTS_PER_ORBIT) * Math.PI * 2);
      heliocentricToScene(point, mode, this.scratch);
      positions.setXYZ(i, this.scratch.x, this.scratch.y, this.scratch.z);
    }
    positions.needsUpdate = true;
    entry.builtAt = centuriesSinceJ2000(julianDate);
    entry.builtMode = mode;
  }

  private rebuildMoon(julianDate: number, mode: ScaleMode) {
    const days = julianDate - MOON_ORBIT.epochJd;
    const node = MOON_ORBIT.ascendingNodeAtEpoch + MOON_ORBIT.ascendingNodePerDay * days;
    const perigee = MOON_ORBIT.argumentOfPerigeeAtEpoch + MOON_ORBIT.argumentOfPerigeePerDay * days;
    const elements = {
      semiMajorAxis: MOON_ORBIT.semiMajorAxisKm, eccentricity: MOON_ORBIT.eccentricity, inclination: MOON_ORBIT.inclination,
      meanLongitude: 0, longitudeOfPerihelion: node + perigee, longitudeOfAscendingNode: node,
    };
    const positions = this.moonLine.line.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < POINTS_PER_ORBIT; i++) {
      moonOffsetToScene(orbitPoint(elements, (i / POINTS_PER_ORBIT) * Math.PI * 2), mode, this.scratch);
      positions.setXYZ(i, this.scratch.x, this.scratch.y, this.scratch.z);
    }
    positions.needsUpdate = true;
    this.moonLine.builtAt = julianDate;
    this.moonLine.builtMode = mode;
  }
}
