/**
 * Каталог сценариев. Поведение каждого — в src/events/scenarios, названия и описания
 * на языках интерфейса — в src/i18n/messages.
 */
export type EventId =
  | 'alignment' | 'eclipse' | 'comet' | 'blackhole' | 'collision' | 'supernova'
  | 'rogue' | 'aliens' | 'meteors' | 'flare' | 'gravity' | 'ice';

/** Насколько сильно событие бьёт по плёнке — для подписи и цвета карточки. */
export type EventIntensity = 'quiet' | 'strong' | 'devastating';

export type EventInfo = {
  id: EventId;
  durationSec: number;
  intensity: EventIntensity;
  /** Имя иконки из lucide-react. */
  icon: 'Orbit' | 'Eclipse' | 'Sparkles' | 'Disc3' | 'Zap' | 'Sun' | 'MoveUpRight' | 'Radar' | 'CloudHail' | 'Flame' | 'Waves' | 'Snowflake';
};

export const EVENTS: EventInfo[] = [
  { id: 'alignment', icon: 'Orbit', durationSec: 26, intensity: 'quiet' },
  { id: 'eclipse', icon: 'Eclipse', durationSec: 22, intensity: 'quiet' },
  { id: 'comet', icon: 'Sparkles', durationSec: 24, intensity: 'quiet' },
  { id: 'meteors', icon: 'CloudHail', durationSec: 22, intensity: 'quiet' },
  { id: 'flare', icon: 'Flame', durationSec: 22, intensity: 'strong' },
  { id: 'gravity', icon: 'Waves', durationSec: 24, intensity: 'strong' },
  { id: 'rogue', icon: 'MoveUpRight', durationSec: 25, intensity: 'strong' },
  { id: 'ice', icon: 'Snowflake', durationSec: 25, intensity: 'strong' },
  { id: 'aliens', icon: 'Radar', durationSec: 28, intensity: 'strong' },
  { id: 'blackhole', icon: 'Disc3', durationSec: 30, intensity: 'devastating' },
  { id: 'collision', icon: 'Zap', durationSec: 26, intensity: 'devastating' },
  { id: 'supernova', icon: 'Sun', durationSec: 30, intensity: 'devastating' },
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map(e => [e.id, e])) as Record<EventId, EventInfo>;

/** Класс оформления по силе события. */
export const INTENSITY_CLASS: Record<EventIntensity, string> = { quiet: 'low', strong: 'mid', devastating: 'high' };
