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
