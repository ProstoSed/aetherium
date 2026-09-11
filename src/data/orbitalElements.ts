/**
 * Кеплеровы элементы планет на эпоху J2000 и их вековые изменения.
 *
 * Источник: E. M. Standish, JPL Solar System Dynamics, «Keplerian Elements for
 * Approximate Positions of the Major Planets», таблица 1 (действительна 1800–2050).
 * https://ssd.jpl.nasa.gov/planets/approx_pos.html
 *
 * Вне интервала формулы продолжают давать правдоподобное вековое движение
 * (прецессия перигелия, дрейф эксцентриситета), но точность не гарантирована.
 * Для Земли даны элементы барицентра Земля–Луна.
 */
export type OrbitalElements = {
  /** Большая полуось, а. е. */
  semiMajorAxis: number;
  eccentricity: number;
  /** Наклонение к эклиптике, градусы. */
  inclination: number;
  /** Средняя долгота, градусы. */
  meanLongitude: number;
  /** Долгота перигелия ϖ, градусы. */
  longitudeOfPerihelion: number;
  /** Долгота восходящего узла Ω, градусы. */
  longitudeOfAscendingNode: number;
};

export type SecularElements = { epoch: OrbitalElements; perCentury: OrbitalElements };

export const ELEMENTS_VALID_FROM_YEAR = 1800;
export const ELEMENTS_VALID_TO_YEAR = 2050;

function row(values: number[], rates: number[]): SecularElements {
  const [a, e, i, l, peri, node] = values;
  const [da, de, di, dl, dperi, dnode] = rates;
  return {
    epoch: { semiMajorAxis: a, eccentricity: e, inclination: i, meanLongitude: l, longitudeOfPerihelion: peri, longitudeOfAscendingNode: node },
    perCentury: { semiMajorAxis: da, eccentricity: de, inclination: di, meanLongitude: dl, longitudeOfPerihelion: dperi, longitudeOfAscendingNode: dnode },
  };
}

export const PLANET_ELEMENTS: Record<string, SecularElements> = {
  //                a            e            I             L               ϖ              Ω
  mercury: row([0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
               [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]),
  venus:   row([0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
               [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]),
  earth:   row([1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
               [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]),
  mars:    row([1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
               [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]),
  jupiter: row([5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
               [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]),
  saturn:  row([9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
               [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]),
  uranus:  row([19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
               [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]),
  neptune: row([30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
               [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]),
};

/**
 * Геоцентрическая орбита Луны с регрессией узла (18,6 года) и прецессией перигея (8,85 года).
 * Источник: P. Schlyter, «How to compute planetary positions», эпоха 2000 Jan 0.0 = JD 2451543.5.
 * https://stjarnhimlen.se/comp/ppcomp.html
 * Большие возмущения от Солнца (эвекция, вариация, до ~1,3°) опущены.
 */
export const MOON_ORBIT = {
  epochJd: 2451543.5,
  semiMajorAxisKm: 384_400,
  eccentricity: 0.0549,
  inclination: 5.1454,
  ascendingNodeAtEpoch: 125.1228,
  ascendingNodePerDay: -0.0529538083,
  argumentOfPerigeeAtEpoch: 318.0634,
  argumentOfPerigeePerDay: 0.1643573223,
  meanAnomalyAtEpoch: 115.3654,
  meanAnomalyPerDay: 13.0649929509,
};

/**
 * Ориентация осей вращения: координаты северного полюса (экваториальные J2000)
 * и угол нулевого меридиана W = W0 + rate·d, d — сутки от J2000.
 * Источник: Archinal et al. 2018, «Report of the IAU Working Group on Cartographic
 * Coordinates and Rotational Elements: 2015». Отрицательная скорость — обратное вращение.
 */
export type RotationElements = { poleRa: number; poleDec: number; meridianAtEpoch: number; degreesPerDay: number };

export const ROTATION: Record<string, RotationElements> = {
  sun:     { poleRa: 286.13,     poleDec: 63.87,     meridianAtEpoch: 84.176,     degreesPerDay: 14.1844 },
  mercury: { poleRa: 281.0103,   poleDec: 61.4155,   meridianAtEpoch: 329.5988,   degreesPerDay: 6.1385108 },
  venus:   { poleRa: 272.76,     poleDec: 67.16,     meridianAtEpoch: 160.20,     degreesPerDay: -1.4813688 },
  earth:   { poleRa: 0,          poleDec: 90,        meridianAtEpoch: 190.147,    degreesPerDay: 360.9856235 },
  moon:    { poleRa: 269.9949,   poleDec: 66.5392,   meridianAtEpoch: 38.3213,    degreesPerDay: 13.17635815 },
  mars:    { poleRa: 317.269202, poleDec: 54.432516, meridianAtEpoch: 176.049863, degreesPerDay: 350.891982443297 },
  jupiter: { poleRa: 268.056595, poleDec: 64.495303, meridianAtEpoch: 284.95,     degreesPerDay: 870.536 },
  saturn:  { poleRa: 40.589,     poleDec: 83.537,    meridianAtEpoch: 38.90,      degreesPerDay: 810.7939024 },
  uranus:  { poleRa: 257.311,    poleDec: -15.175,   meridianAtEpoch: 203.81,     degreesPerDay: -501.1600928 },
  neptune: { poleRa: 299.36,     poleDec: 43.46,     meridianAtEpoch: 249.978,    degreesPerDay: 541.1397757 },
};

/** Наклон эклиптики к экватору на J2000, градусы (IAU 2006). */
export const OBLIQUITY_J2000 = 23.4392911;
