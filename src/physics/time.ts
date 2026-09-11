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

/**
 * Дата словами. `Intl` не умеет годы до нашей эры и за пределами ±275 000 лет,
 * поэтому год собирается вручную: при быстрой перемотке дата уходит далеко.
 */
let cachedDay = Number.NaN;
let cachedDateText = '';

export function formatSimulationDate(jd: number): string {
  // Дата спрашивается каждый кадр, а меняется раз в сутки симуляции; Intl-форматирование дорогое.
  const day = Math.floor(jd + 0.5);
  if (day === cachedDay) return cachedDateText;
  cachedDay = day;
  cachedDateText = formatDate(jd);
  return cachedDateText;
}

function formatDate(jd: number): string {
  const date = dateFromJulianDate(jd);
  const year = date.getUTCFullYear();
  const dayMonth = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const yearText = year > 0 ? `${year}` : `${1 - year} до н. э.`;
  return `${dayMonth} ${yearText}`;
}
