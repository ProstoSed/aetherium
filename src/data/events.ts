/** Каталог сценариев. Поведение каждого — в src/events/scenarios. */
export type EventId =
  | 'alignment' | 'eclipse' | 'comet' | 'blackhole' | 'collision' | 'supernova'
  | 'rogue' | 'aliens' | 'meteors' | 'flare' | 'gravity' | 'ice';

export type EventInfo = {
  id: EventId;
  name: string;
  description: string;
  durationSec: number;
  /** Насколько сильно событие бьёт по плёнке — для подписи на карточке. */
  intensity: 'тихое' | 'сильное' | 'разрушительное';
  /** Имя иконки из lucide-react. */
  icon: 'Orbit' | 'Eclipse' | 'Sparkles' | 'Disc3' | 'Zap' | 'Sun' | 'MoveUpRight' | 'Radar' | 'CloudHail' | 'Flame' | 'Waves' | 'Snowflake';
};

export const EVENTS: EventInfo[] = [
  { id: 'alignment', name: 'Парад планет', icon: 'Orbit', durationSec: 26, intensity: 'тихое',
    description: 'Планеты выстраиваются в линию по одну сторону Солнца.' },
  { id: 'eclipse', name: 'Солнечное затмение', icon: 'Eclipse', durationSec: 22, intensity: 'тихое',
    description: 'Тень заслоняет Солнце, и вспыхивает корона.' },
  { id: 'comet', name: 'Великая комета', icon: 'Sparkles', durationSec: 24, intensity: 'тихое',
    description: 'Гостья из облака Оорта огибает Солнце. Хвост всегда смотрит прочь от светила.' },
  { id: 'meteors', name: 'Звёздный дождь', icon: 'CloudHail', durationSec: 22, intensity: 'тихое',
    description: 'Поток метеоров прошивает плоскость эклиптики.' },
  { id: 'flare', name: 'Дыхание Солнца', icon: 'Flame', durationSec: 22, intensity: 'сильное',
    description: 'Выброс корональной массы. Волна плазмы бьёт по объективу.' },
  { id: 'gravity', name: 'Гравитационная волна', icon: 'Waves', durationSec: 24, intensity: 'сильное',
    description: 'Пространство идёт рябью, орбиты колеблются, как струны.' },
  { id: 'rogue', name: 'Сбившийся странник', icon: 'MoveUpRight', durationSec: 25, intensity: 'сильное',
    description: 'Нептун срывается с орбиты и уходит во тьму.' },
  { id: 'ice', name: 'Век великого льда', icon: 'Snowflake', durationSec: 25, intensity: 'сильное',
    description: 'Землю сковывает лёд, а линза покрывается инеем.' },
  { id: 'aliens', name: 'Мы не одни', icon: 'Radar', durationSec: 28, intensity: 'сильное',
    description: 'Флот чужих кораблей глушит сигнал обсерватории.' },
  { id: 'blackhole', name: 'Незваная бездна', icon: 'Disc3', durationSec: 30, intensity: 'разрушительное',
    description: 'Рядом рождается чёрная дыра. Свет вокруг неё гнётся.' },
  { id: 'collision', name: 'Столкновение миров', icon: 'Zap', durationSec: 26, intensity: 'разрушительное',
    description: 'Земля и Марс сходятся. Удар прожигает плёнку.' },
  { id: 'supernova', name: 'Последний свет', icon: 'Sun', durationSec: 30, intensity: 'разрушительное',
    description: 'Солнце раздувается и сбрасывает оболочку. Вымысел: наша звезда для этого слишком лёгкая.' },
];

export const EVENT_BY_ID = Object.fromEntries(EVENTS.map(e => [e.id, e])) as Record<EventId, EventInfo>;
