import type { BodyFact } from '../data/bodies';
import { dateFromJulianDate } from '../physics/time';
import type { Messages } from './messages/en';
import { numberText } from './numbers';

const SPEED_OF_LIGHT_KM_S = 299_792.458;
/** Настоящий минус, а не дефис: в «−173…+427 °C» дефис читается как тире. */
const MINUS = '−';

export function formatAu(t: Messages, au: number): string {
  return t.units.au(numberText(t.locale)(au, au < 10 ? 3 : 2));
}

export function formatDistance(t: Messages, km: number): string {
  return t.units.distance(km, numberText(t.locale));
}

/** Сколько идёт свет: у Луны секунды, у Нептуна часы. */
export function formatLightTime(t: Messages, km: number): string {
  return t.units.lightTime(km / SPEED_OF_LIGHT_KM_S, numberText(t.locale));
}

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function signed(t: Messages, celsius: number): string {
  const magnitude = numberText(t.locale)(Math.abs(celsius));
  return celsius > 0 ? `+${magnitude}` : celsius < 0 ? `${MINUS}${magnitude}` : magnitude;
}

/** Факт о теле — подпись и значение на языке интерфейса. */
export function formatFact(t: Messages, fact: BodyFact): { label: string; value: string } {
  const n = numberText(t.locale);
  const label = t.facts[fact.kind];
  switch (fact.kind) {
    case 'diameter':
      return { label, value: t.units.km(n(fact.km)) };
    case 'distanceToEarth':
      return { label, value: `${n(fact.km[0])}…${t.units.km(n(fact.km[1]))}` };
    case 'mass':
      return { label, value: t.units.earthMasses(n(fact.earths), fact.earths) };
    case 'temperature':
    case 'meanTemperature':
    case 'surfaceTemperature': {
      const range = Array.isArray(fact.celsius) ? `${signed(t, fact.celsius[0])}…${signed(t, fact.celsius[1])}` : signed(t, fact.celsius);
      return { label, value: `${range} °C` };
    }
    case 'equatorRotation':
    case 'orbitalPeriod':
      return { label, value: t.units.days(n(fact.days), fact.days) };
    case 'solarDay':
      return { label, value: t.units.earthDays(n(fact.earthDays), fact.earthDays) };
    case 'day':
      return { label, value: t.units.hoursMinutes(fact.hours, fact.minutes) };
    case 'axialTilt':
      return { label, value: `${n(fact.degrees)}°` };
    case 'moons':
      return { label, value: fact.count === 0 ? t.noMoons : n(fact.count) };
  }
}

/**
 * Дата словами. Intl не умеет годы до нашей эры и за пределами ±275 000 лет, поэтому
 * день и месяц берутся из Intl, а год собирается словарём: при быстрой перемотке дата уходит далеко.
 */
const dayMonthFormats = new Map<string, Intl.DateTimeFormat>();
let cachedKey = '';
let cachedText = '';

export function formatSimulationDate(t: Messages, julianDate: number): string {
  // Дата спрашивается каждый кадр, а меняется раз в сутки симуляции; Intl-форматирование дорогое.
  const key = `${t.locale}|${Math.floor(julianDate + 0.5)}`;
  if (key === cachedKey) return cachedText;
  cachedKey = key;
  cachedText = formatDate(t, julianDate);
  return cachedText;
}

export function formatDate(t: Messages, julianDate: number): string {
  let format = dayMonthFormats.get(t.locale);
  if (!format) {
    format = new Intl.DateTimeFormat(t.locale, { day: 'numeric', month: 'long', timeZone: 'UTC' });
    dayMonthFormats.set(t.locale, format);
  }
  const date = dateFromJulianDate(julianDate);
  return t.date(format.format(date), date.getUTCFullYear());
}
