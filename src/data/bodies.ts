/**
 * Справочные сведения о небесных телах. Орбиты и вращение — в orbitalElements.ts,
 * названия и описания на языках интерфейса — в src/i18n/messages.
 */
export type BodyId = 'sun' | 'mercury' | 'venus' | 'earth' | 'moon' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

/** Факт хранится числом, а не строкой: единицы, разделители и склонения зависят от языка. */
export type BodyFact =
  | { kind: 'diameter'; km: number }
  | { kind: 'distanceToEarth'; km: [number, number] }
  | { kind: 'mass'; earths: number }
  | { kind: 'temperature' | 'meanTemperature' | 'surfaceTemperature'; celsius: number | [number, number] }
  | { kind: 'equatorRotation' | 'orbitalPeriod'; days: number }
  | { kind: 'solarDay'; earthDays: number }
  | { kind: 'day'; hours: number; minutes: number }
  | { kind: 'axialTilt'; degrees: number }
  | { kind: 'moons'; count: number };

export type FactKind = BodyFact['kind'];

export type BodyInfo = {
  id: BodyId;
  /** Цвет точки в списке и маркера в истинном масштабе. */
  color: string;
  radiusKm: number;
  /** Вокруг чего обращается; у Солнца — ничего. */
  parent: BodyId | null;
  facts: BodyFact[];
};

export const BODIES: BodyInfo[] = [
  {
    id: 'sun', color: '#f3b54a', radiusKm: 695_700, parent: null,
    facts: [
      { kind: 'diameter', km: 1_392_700 },
      { kind: 'mass', earths: 333_000 },
      { kind: 'surfaceTemperature', celsius: 5500 },
      { kind: 'equatorRotation', days: 25.4 },
    ],
  },
  {
    id: 'mercury', color: '#a79f90', radiusKm: 2439.7, parent: 'sun',
    facts: [
      { kind: 'diameter', km: 4879 },
      { kind: 'mass', earths: 0.055 },
      { kind: 'temperature', celsius: [-173, 427] },
      { kind: 'solarDay', earthDays: 176 },
      { kind: 'moons', count: 0 },
    ],
  },
  {
    id: 'venus', color: '#d9b876', radiusKm: 6051.8, parent: 'sun',
    facts: [
      { kind: 'diameter', km: 12_104 },
      { kind: 'mass', earths: 0.815 },
      { kind: 'temperature', celsius: 464 },
      { kind: 'axialTilt', degrees: 177.4 },
      { kind: 'moons', count: 0 },
    ],
  },
  {
    id: 'earth', color: '#4f8fc9', radiusKm: 6371, parent: 'sun',
    facts: [
      { kind: 'diameter', km: 12_742 },
      { kind: 'meanTemperature', celsius: 15 },
      { kind: 'axialTilt', degrees: 23.44 },
      { kind: 'day', hours: 23, minutes: 56 },
      { kind: 'moons', count: 1 },
    ],
  },
  {
    id: 'moon', color: '#bdb9b0', radiusKm: 1737.4, parent: 'earth',
    facts: [
      { kind: 'diameter', km: 3474 },
      { kind: 'distanceToEarth', km: [363_000, 406_000] },
      { kind: 'orbitalPeriod', days: 27.3 },
      { kind: 'mass', earths: 0.012 },
    ],
  },
  {
    id: 'mars', color: '#c1653d', radiusKm: 3389.5, parent: 'sun',
    facts: [
      { kind: 'diameter', km: 6779 },
      { kind: 'mass', earths: 0.107 },
      { kind: 'temperature', celsius: -65 },
      { kind: 'day', hours: 24, minutes: 37 },
      { kind: 'moons', count: 2 },
    ],
  },
  {
    id: 'jupiter', color: '#c99a6b', radiusKm: 69_911, parent: 'sun',
    facts: [
      { kind: 'diameter', km: 139_820 },
      { kind: 'mass', earths: 317.8 },
      { kind: 'temperature', celsius: -110 },
      { kind: 'day', hours: 9, minutes: 56 },
      { kind: 'moons', count: 97 },
    ],
  },
  {
    id: 'saturn', color: '#dcc08a', radiusKm: 58_232, parent: 'sun',
    facts: [
      { kind: 'diameter', km: 116_460 },
      { kind: 'mass', earths: 95.2 },
      { kind: 'temperature', celsius: -140 },
      { kind: 'day', hours: 10, minutes: 34 },
      { kind: 'moons', count: 274 },
    ],
  },
  {
    id: 'uranus', color: '#8fc3c9', radiusKm: 25_362, parent: 'sun',
    facts: [
      { kind: 'diameter', km: 50_724 },
      { kind: 'mass', earths: 14.5 },
      { kind: 'temperature', celsius: -195 },
      { kind: 'axialTilt', degrees: 97.8 },
      { kind: 'moons', count: 29 },
    ],
  },
  {
    id: 'neptune', color: '#4f78c4', radiusKm: 24_622, parent: 'sun',
    facts: [
      { kind: 'diameter', km: 49_244 },
      { kind: 'mass', earths: 17.1 },
      { kind: 'temperature', celsius: -200 },
      { kind: 'day', hours: 16, minutes: 6 },
      { kind: 'moons', count: 16 },
    ],
  },
];

export const BODY_BY_ID = Object.fromEntries(BODIES.map(b => [b.id, b])) as Record<BodyId, BodyInfo>;
export const PLANET_IDS: BodyId[] = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
/** Средний радиус орбиты Луны — подпись в списке тел. */
export const MOON_MEAN_DISTANCE_KM = 384_400;
