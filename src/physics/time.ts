/** Юлианская дата эпохи J2000.0 (1 января 2000, 12:00 TT). */
export const J2000 = 2451545.0;
export const DAYS_PER_CENTURY = 36525;
const UNIX_EPOCH_JD = 2440587.5;
const MS_PER_DAY = 86_400_000;

export function julianDateFromDate(date: Date): number {
  return date.getTime() / MS_PER_DAY + UNIX_EPOCH_JD;
}

export function dateFromJulianDate(jd: number): Date {
  return new Date((jd - UNIX_EPOCH_JD) * MS_PER_DAY);
}

/** Юлианские века от J2000 — аргумент вековых поправок орбитальных элементов. */
export function centuriesSinceJ2000(jd: number): number {
  return (jd - J2000) / DAYS_PER_CENTURY;
}

const DAYS_PER_YEAR = 365.25;

/**
 * ΔT = TT − UT, секунды. Дата в интерфейсе — гражданское время (UT, по вращению Земли), а орбиты
 * считаются в равномерном земном времени TT. Вращение Земли замедляется, и разница копится:
 * 69 с сейчас, около 5 ч в 500 году до н. э., около 20 ч в 3000 году до н. э. Луна за час уходит
 * на полградуса, так что на древних датах без ΔT она оказалась бы не там.
 * Многочлены Espenak & Meeus, «Five Millennium Canon of Solar Eclipses»,
 * https://eclipse.gsfc.nasa.gov/SEhelp/deltatpoly2004.html; вне 1955–2005 — поправка c на вековое
 * ускорение Луны −25,858″/столетие² (как в теории Луны ELP-2000/82, к которой близка наша).
 */
export function deltaTSeconds(jd: number): number {
  const y = 2000 + (jd - J2000) / DAYS_PER_YEAR;
  const parabola = (year: number) => -20 + 32 * ((year - 1820) / 100) ** 2;
  let value: number;
  if (y < -500) value = parabola(y);
  else if (y < 500) {
    const u = y / 100;
    value = 10583.6 - 1014.41 * u + 33.78311 * u ** 2 - 5.952053 * u ** 3 - 0.1798452 * u ** 4 + 0.022174192 * u ** 5 + 0.0090316521 * u ** 6;
  } else if (y < 1600) {
    const u = (y - 1000) / 100;
    value = 1574.2 - 556.01 * u + 71.23472 * u ** 2 + 0.319781 * u ** 3 - 0.8503463 * u ** 4 - 0.005050998 * u ** 5 + 0.0083572073 * u ** 6;
  } else if (y < 1700) {
    const t = y - 1600;
    value = 120 - 0.9808 * t - 0.01532 * t ** 2 + t ** 3 / 7129;
  } else if (y < 1800) {
    const t = y - 1700;
    value = 8.83 + 0.1603 * t - 0.0059285 * t ** 2 + 0.00013336 * t ** 3 - t ** 4 / 1174000;
  } else if (y < 1860) {
    const t = y - 1800;
    value = 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7;
  } else if (y < 1900) {
    const t = y - 1860;
    value = 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174;
  } else if (y < 1920) {
    const t = y - 1900;
    value = -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  } else if (y < 1941) {
    const t = y - 1920;
    value = 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  } else if (y < 1961) {
    const t = y - 1950;
    value = 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  } else if (y < 1986) {
    const t = y - 1975;
    value = 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  } else if (y < 2005) {
    const t = y - 2000;
    value = 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5;
  } else if (y < 2050) {
    const t = y - 2000;
    value = 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  } else if (y < 2150) {
    value = parabola(y) - 0.5628 * (2150 - y);
  } else {
    value = parabola(y);
  }
  const lunarCorrection = y >= 1955 && y <= 2005 ? 0 : -0.000012932 * (y - 1955) ** 2;
  return value + lunarCorrection;
}

/** Земное время (TT) по гражданскому (UT), юлианская дата: аргумент для положений планет и Луны. */
export function terrestrialTime(jdUt: number): number {
  return jdUt + deltaTSeconds(jdUt) / 86_400;
}
