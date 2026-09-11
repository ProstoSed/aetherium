/** Справочные сведения о небесных телах. Орбиты и вращение — в orbitalElements.ts. */
export type BodyId = 'sun' | 'mercury' | 'venus' | 'earth' | 'moon' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune';

export type BodyInfo = {
  id: BodyId;
  name: string;
  kind: string;
  /** Цвет точки в списке и маркера в истинном масштабе. */
  color: string;
  radiusKm: number;
  /** Вокруг чего обращается; у Солнца — ничего. */
  parent: BodyId | null;
  description: string;
  facts: { label: string; value: string }[];
};

export const BODIES: BodyInfo[] = [
  {
    id: 'sun', name: 'Солнце', kind: 'Звезда, жёлтый карлик G2V', color: '#f3b54a', radiusKm: 695_700, parent: null,
    description: 'Держит 99,86% массы всей системы. Свет от поверхности идёт до Земли 8 минут 20 секунд.',
    facts: [
      { label: 'Диаметр', value: '1 392 700 км' },
      { label: 'Масса', value: '333 000 Земель' },
      { label: 'Поверхность', value: '5 500 °C' },
      { label: 'Оборот у экватора', value: '25,4 суток' },
    ],
  },
  {
    id: 'mercury', name: 'Меркурий', kind: 'Планета земной группы', color: '#a79f90', radiusKm: 2439.7, parent: 'sun',
    description: 'Самая вытянутая орбита среди планет: в перигелии Солнце в полтора раза крупнее, чем в афелии.',
    facts: [
      { label: 'Диаметр', value: '4 879 км' },
      { label: 'Масса', value: '0,055 Земли' },
      { label: 'Температура', value: '−173…+427 °C' },
      { label: 'Солнечные сутки', value: '176 земных суток' },
      { label: 'Спутники', value: 'нет' },
    ],
  },
  {
    id: 'venus', name: 'Венера', kind: 'Планета земной группы', color: '#d9b876', radiusKm: 6051.8, parent: 'sun',
    description: 'Вращается в обратную сторону и так медленно, что сутки длиннее года. Жарче Меркурия из-за парникового эффекта.',
    facts: [
      { label: 'Диаметр', value: '12 104 км' },
      { label: 'Масса', value: '0,815 Земли' },
      { label: 'Температура', value: '+464 °C' },
      { label: 'Наклон оси', value: '177,4°' },
      { label: 'Спутники', value: 'нет' },
    ],
  },
  {
    id: 'earth', name: 'Земля', kind: 'Планета земной группы', color: '#4f8fc9', radiusKm: 6371, parent: 'sun',
    description: 'Единственный известный мир с жидкими океанами на поверхности и жизнью.',
    facts: [
      { label: 'Диаметр', value: '12 742 км' },
      { label: 'Средняя температура', value: '+15 °C' },
      { label: 'Наклон оси', value: '23,44°' },
      { label: 'Сутки', value: '23 ч 56 мин' },
      { label: 'Спутники', value: '1' },
    ],
  },
  {
    id: 'moon', name: 'Луна', kind: 'Спутник Земли', color: '#bdb9b0', radiusKm: 1737.4, parent: 'earth',
    description: 'Всегда повёрнута к Земле одной стороной. Плоскость её орбиты разворачивается за 18,6 года — отсюда ритм затмений.',
    facts: [
      { label: 'Диаметр', value: '3 474 км' },
      { label: 'До Земли', value: '363 000…406 000 км' },
      { label: 'Оборот', value: '27,3 суток' },
      { label: 'Масса', value: '0,012 Земли' },
    ],
  },
  {
    id: 'mars', name: 'Марс', kind: 'Планета земной группы', color: '#c1653d', radiusKm: 3389.5, parent: 'sun',
    description: 'Здесь гора Олимп высотой 22 км и каньон длиной с Австралию. Красный цвет даёт оксид железа в пыли.',
    facts: [
      { label: 'Диаметр', value: '6 779 км' },
      { label: 'Масса', value: '0,107 Земли' },
      { label: 'Температура', value: '−65 °C' },
      { label: 'Сутки', value: '24 ч 37 мин' },
      { label: 'Спутники', value: '2' },
    ],
  },
  {
    id: 'jupiter', name: 'Юпитер', kind: 'Газовый гигант', color: '#c99a6b', radiusKm: 69_911, parent: 'sun',
    description: 'Тяжелее всех остальных планет вместе взятых. Большое Красное Пятно — буря шире Земли.',
    facts: [
      { label: 'Диаметр', value: '139 820 км' },
      { label: 'Масса', value: '317,8 Земли' },
      { label: 'Температура', value: '−110 °C' },
      { label: 'Сутки', value: '9 ч 56 мин' },
      { label: 'Спутники', value: '97' },
    ],
  },
  {
    id: 'saturn', name: 'Сатурн', kind: 'Газовый гигант', color: '#dcc08a', radiusKm: 58_232, parent: 'sun',
    description: 'Кольца шириной 280 000 км, а толщиной местами около десяти метров. Средняя плотность ниже, чем у воды.',
    facts: [
      { label: 'Диаметр', value: '116 460 км' },
      { label: 'Масса', value: '95,2 Земли' },
      { label: 'Температура', value: '−140 °C' },
      { label: 'Сутки', value: '10 ч 34 мин' },
      { label: 'Спутники', value: '274' },
    ],
  },
  {
    id: 'uranus', name: 'Уран', kind: 'Ледяной гигант', color: '#8fc3c9', radiusKm: 25_362, parent: 'sun',
    description: 'Лежит на боку: ось наклонена на 98°. Каждый полюс по 42 года освещён без перерыва, потом столько же во тьме.',
    facts: [
      { label: 'Диаметр', value: '50 724 км' },
      { label: 'Масса', value: '14,5 Земли' },
      { label: 'Температура', value: '−195 °C' },
      { label: 'Наклон оси', value: '97,8°' },
      { label: 'Спутники', value: '29' },
    ],
  },
  {
    id: 'neptune', name: 'Нептун', kind: 'Ледяной гигант', color: '#4f78c4', radiusKm: 24_622, parent: 'sun',
    description: 'Найден в 1846 году на кончике пера — по отклонениям в движении Урана. Ветры до 2 000 км/ч.',
    facts: [
      { label: 'Диаметр', value: '49 244 км' },
      { label: 'Масса', value: '17,1 Земли' },
      { label: 'Температура', value: '−200 °C' },
      { label: 'Сутки', value: '16 ч 6 мин' },
      { label: 'Спутники', value: '16' },
    ],
  },
];

export const BODY_BY_ID = Object.fromEntries(BODIES.map(b => [b.id, b])) as Record<BodyId, BodyInfo>;
export const PLANET_IDS: BodyId[] = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
