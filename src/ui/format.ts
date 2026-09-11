const SPEED_OF_LIGHT_KM_S = 299_792.458;

const number = (value: number, digits: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits });

export function formatAu(au: number): string {
  return `${number(au, au < 10 ? 3 : 2)} а. е.`;
}

/** Большие расстояния — в миллионах километров, иначе цифры не читаются. */
export function formatKm(km: number): string {
  if (km >= 1e6) return `${number(km / 1e6, km < 1e8 ? 1 : 0)} млн км`;
  return `${Math.round(km).toLocaleString('ru-RU')} км`;
}

/** Сколько идёт свет: у Луны секунды, у Нептуна часы. */
export function formatLightTime(km: number): string {
  const seconds = km / SPEED_OF_LIGHT_KM_S;
  if (seconds < 60) return `${number(seconds, 2)} с`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)} мин ${Math.round(seconds % 60)} с`;
  return `${Math.floor(minutes / 60)} ч ${Math.round(minutes % 60)} мин`;
}

export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
