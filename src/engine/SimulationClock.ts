import { julianDateFromDate } from '../physics/time';

/** Скорость хода времени: сколько суток симуляции проходит за секунду. */
export type SpeedPreset = { id: string; label: string; daysPerSecond: number };

const SECONDS_PER_DAY = 86_400;

export const SPEED_PRESETS: SpeedPreset[] = [
  { id: 'realtime', label: 'Реальное время', daysPerSecond: 1 / SECONDS_PER_DAY },
  { id: 'hour', label: '1 час/с', daysPerSecond: 1 / 24 },
  { id: 'day', label: '1 день/с', daysPerSecond: 1 },
  { id: 'week', label: '1 неделя/с', daysPerSecond: 7 },
  { id: 'month', label: '1 месяц/с', daysPerSecond: 30.44 },
  { id: 'year', label: '1 год/с', daysPerSecond: 365.25 },
  { id: 'decade', label: '10 лет/с', daysPerSecond: 3652.5 },
  { id: 'century', label: '100 лет/с', daysPerSecond: 36_525 },
  { id: 'millennium', label: '1000 лет/с', daysPerSecond: 365_250 },
];

export const DEFAULT_SPEED_ID = 'week';

/**
 * Даты дальше этих пределов теряют смысл: линейные вековые поправки
 * элементов орбит уводят эксцентриситеты за физические границы.
 */
const MIN_JD = julianDateFromDate(new Date(Date.UTC(-9000, 0, 1)));
const MAX_JD = julianDateFromDate(new Date(Date.UTC(11000, 0, 1)));

export class SimulationClock {
  julianDate = julianDateFromDate(new Date());
  daysPerSecond = SPEED_PRESETS.find(p => p.id === DEFAULT_SPEED_ID)!.daysPerSecond;
  direction: 1 | -1 = 1;
  paused = false;

  /** Сдвигает время; возвращает, на сколько суток оно ушло за кадр. */
  advance(realSeconds: number): number {
    if (this.paused) return 0;
    const before = this.julianDate;
    this.julianDate = Math.min(MAX_JD, Math.max(MIN_JD, before + realSeconds * this.daysPerSecond * this.direction));
    return this.julianDate - before;
  }

  resetToNow() {
    this.julianDate = julianDateFromDate(new Date());
  }
}
