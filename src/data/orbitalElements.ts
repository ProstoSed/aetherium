/**
 * Кеплеровы элементы планет на эпоху J2000 и их вековые изменения, эклиптика и равноденствие J2000.
 *
 * Источник: E. M. Standish, JPL Solar System Dynamics, «Keplerian Elements for
 * Approximate Positions of the Major Planets», https://ssd.jpl.nasa.gov/planets/approx_pos.html
 * - таблица 1 — 1800–2050, ошибка по долготе от 10″ (Нептун) до 600″ (Сатурн);
 * - таблицы 2a и 2b — 3000 до н. э. – 3000 н. э., ошибка до 2000″ (Уран); у Юпитера–Нептуна
 *   средняя аномалия дополняется членами b·T² + c·cos(f·T) + s·sin(f·T).
 * Внутри 1800–2050 таблица 1 точнее, поэтому таблица 2 берётся только снаружи (см. kepler.ts).
 * Дальше 3000 лет от нашей эры формулы продолжают давать правдоподобное вековое движение
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

/** Добавка к средней аномалии из таблицы 2b, градусы: b·T² + c·cos(f·T) + s·sin(f·T). */
export type MeanAnomalyTerms = { b: number; c: number; s: number; f: number };
export type SecularElements = { epoch: OrbitalElements; perCentury: OrbitalElements; meanAnomalyTerms?: MeanAnomalyTerms };

/** Годы астрономического счёта: −2999 — это 3000 год до н. э. */
export const ELEMENTS_VALID_FROM_YEAR = -2999;
export const ELEMENTS_VALID_TO_YEAR = 3000;
/** Интервал таблицы 1, в столетиях от J2000: 1800 и 2050 годы. */
export const PRECISE_ELEMENTS_FROM_CENTURY = -2;
export const PRECISE_ELEMENTS_TO_CENTURY = 0.5;

function row(values: number[], rates: number[], meanAnomalyTerms?: MeanAnomalyTerms): SecularElements {
  const [a, e, i, l, peri, node] = values as [number, number, number, number, number, number];
  const [da, de, di, dl, dperi, dnode] = rates as [number, number, number, number, number, number];
  return {
    epoch: { semiMajorAxis: a, eccentricity: e, inclination: i, meanLongitude: l, longitudeOfPerihelion: peri, longitudeOfAscendingNode: node },
    perCentury: { semiMajorAxis: da, eccentricity: de, inclination: di, meanLongitude: dl, longitudeOfPerihelion: dperi, longitudeOfAscendingNode: dnode },
    ...(meanAnomalyTerms ? { meanAnomalyTerms } : {}),
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

/** Таблицы 2a и 2b: 3000 до н. э. – 3000 н. э. */
export const LONG_TERM_PLANET_ELEMENTS: Record<string, SecularElements> = {
  //                a            e            I             L               ϖ              Ω
  mercury: row([0.38709843, 0.20563661, 7.00559432, 252.25166724, 77.45771895, 48.33961819],
               [0.00000000, 0.00002123, -0.00590158, 149472.67486623, 0.15940013, -0.12214182]),
  venus:   row([0.72332102, 0.00676399, 3.39777545, 181.97970850, 131.76755713, 76.67261496],
               [-0.00000026, -0.00005107, 0.00043494, 58517.81560260, 0.05679648, -0.27274174]),
  earth:   row([1.00000018, 0.01673163, -0.00054346, 100.46691572, 102.93005885, -5.11260389],
               [-0.00000003, -0.00003661, -0.01337178, 35999.37306329, 0.31795260, -0.24123856]),
  mars:    row([1.52371243, 0.09336511, 1.85181869, -4.56813164, -23.91744784, 49.71320984],
               [0.00000097, 0.00009149, -0.00724757, 19140.29934243, 0.45223625, -0.26852431]),
  jupiter: row([5.20248019, 0.04853590, 1.29861416, 34.33479152, 14.27495244, 100.29282654],
               [-0.00002864, 0.00018026, -0.00322699, 3034.90371757, 0.18199196, 0.13024619],
               { b: -0.00012452, c: 0.06064060, s: -0.35635438, f: 38.35125000 }),
  saturn:  row([9.54149883, 0.05550825, 2.49424102, 50.07571329, 92.86136063, 113.63998702],
               [-0.00003065, -0.00032044, 0.00451969, 1222.11494724, 0.54179478, -0.25015002],
               { b: 0.00025899, c: -0.13434469, s: 0.87320147, f: 38.35125000 }),
  uranus:  row([19.18797948, 0.04685740, 0.77298127, 314.20276625, 172.43404441, 73.96250215],
               [-0.00020455, -0.00001550, -0.00180155, 428.49512595, 0.09266985, 0.05739699],
               { b: 0.00058331, c: -0.97731848, s: 0.17689245, f: 7.67025000 }),
  neptune: row([30.06952752, 0.00895439, 1.77005520, 304.22289287, 46.68158724, 131.78635853],
               [0.00006447, 0.00000818, 0.00022400, 218.46515314, 0.01009938, -0.00606302],
               { b: -0.00041348, c: 0.68346318, s: -0.10162547, f: 7.67025000 }),
};

/**
 * Геоцентрическая орбита Луны с регрессией узла (18,6 года) и прецессией перигея (8,85 года).
 * Источник: P. Schlyter, «How to compute planetary positions», эпоха 2000 Jan 0.0 = JD 2451543.5.
 * https://stjarnhimlen.se/comp/ppcomp.html
 * Элементы Шлютера отнесены к равноденствию даты, планеты — к J2000: узел сдвигается на общую
 * прецессию (precessionPerDay), иначе Луна уходила бы от остальной системы на 1,4° за столетие.
 * Главные возмущения от Солнца (эвекция, вариация и др.) добавляются в kepler.ts.
 * Линейные скорости Шлютера дополнены квадратичными членами (градусы на столетие²) из
 * J. Meeus, «Astronomical Algorithms», гл. 47: приливное торможение Луны за тысячелетия даёт
 * градусы — против DE441 ошибка в 2901 году до н. э. 6,4° без них и 1,05° с ними.
 * Аргумент перигея ω = L′ − M′ − Ω, поэтому его член — разность членов L′, M′ и Ω.
 */
export const MOON_ORBIT = {
  precessionPerDay: 3.82394e-5,
  ascendingNodePerCentury2: 0.0020754,
  argumentOfPerigeePerCentury2: -0.0015786 - 0.0087414 - 0.0020754,
  meanAnomalyPerCentury2: 0.0087414,
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
  // У Земли W = ERA − 90°: W отсчитывается от узла экватора (RA = 90°), а ERA — от точки на RA ≈ 0°.
  earth:   { poleRa: 0,          poleDec: 90,        meridianAtEpoch: 190.46061837504, degreesPerDay: 360.985612288087 },
  moon:    { poleRa: 269.9949,   poleDec: 66.5392,   meridianAtEpoch: 38.3213,    degreesPerDay: 13.17635815 },
  mars:    { poleRa: 317.269202, poleDec: 54.432516, meridianAtEpoch: 176.049863, degreesPerDay: 350.891982443297 },
  jupiter: { poleRa: 268.056595, poleDec: 64.495303, meridianAtEpoch: 284.95,     degreesPerDay: 870.536 },
  saturn:  { poleRa: 40.589,     poleDec: 83.537,    meridianAtEpoch: 38.90,      degreesPerDay: 810.7939024 },
  uranus:  { poleRa: 257.311,    poleDec: -15.175,   meridianAtEpoch: 203.81,     degreesPerDay: -501.1600928 },
  neptune: { poleRa: 299.36,     poleDec: 43.46,     meridianAtEpoch: 249.978,    degreesPerDay: 541.1397757 },
};

/** Наклон эклиптики к экватору на J2000, градусы (IAU 2006). */
export const OBLIQUITY_J2000 = 23.4392911;

/** Средняя орбита Солнца для возмущений Луны (Шлютер): аргумент перигелия и средняя аномалия Земли. */
export const SUN_FOR_MOON = {
  perihelionAtEpoch: 282.9404,
  perihelionPerDay: 4.70935e-5,
  meanAnomalyAtEpoch: 356.047,
  meanAnomalyPerDay: 0.9856002585,
  meanAnomalyPerCentury2: -0.0001536,
};

/**
 * Общая прецессия по долготе p_A (IAU 2006, Capitaine et al. 2003), угловые секунды:
 * 5028,796195″·T + 1,1054348″·T². Ось Земли обходит полюс эклиптики за ~25 800 лет; без этого
 * к −9000 году солнцестояния менялись бы местами.
 */
export const GENERAL_PRECESSION_ARCSEC = { linear: 5028.796195, quadratic: 1.1054348 };

/**
 * Наклон экватора к эклиптике даты, угловые секунды, многочлен по U = T/100 (десятки тысячелетий):
 * J. Laskar 1986, по J. Meeus, «Astronomical Algorithms», формула 22.3. Годен при |U| < 1,
 * то есть в пределах 10 000 лет от 2000 года. Наклон гуляет в 22–24,5° с периодом ~41 000 лет:
 * около 8700 года до н. э. он был наибольшим, 24,2°.
 */
export const OBLIQUITY_OF_DATE_ARCSEC = [84381.448, -4680.93, -1.55, 1999.25, -51.38, -249.67, -39.05, 7.12, 27.87, 5.79, 2.45];

/**
 * Угол вращения Земли (ERA, IERS Conventions 2010): 2π·(0,7790572732640 + 1,00273781191135448·Du),
 * Du — сутки UT1 от J2000. В градусах это 280,46061837504 + 360,985612288087·Du от небесного
 * промежуточного начала. Скорость МАС для Земли (360,9856235) быстрее на 0,41° за столетие:
 * за пять тысячелетий полдень уехал бы на 20°.
 */
export const EARTH_ROTATION_ANGLE = { atEpoch: 280.46061837504, degreesPerDay: 360.985612288087 };
