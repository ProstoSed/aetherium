import { pluralForm } from '../numbers';
import type { Messages } from './en';

const plural = (count: number, forms: { one: string; few: string; many: string }) => {
  const form = pluralForm('ru', count);
  return form === 'one' ? forms.one : form === 'many' ? forms.many : forms.few;
};

export const ru: Messages = {
  locale: 'ru-RU',

  document: {
    title: 'Aetherium — механика неба',
    description: 'Солнечная система по настоящим орбитам, истинный масштаб и космические события сквозь объектив старой кинокамеры.',
  },
  brand: { tagline: 'механика неба' },
  intro: { developing: 'Проявляем плёнку…', ready: 'Готово', loadingLabel: 'Загрузка сцены', readyLabel: 'Сцена готова' },
  webglError: { title: 'Нужен WebGL 2', hint: 'Включите аппаратное ускорение в настройках браузера и перезагрузите страницу.' },

  topBar: {
    overview: 'Вся система',
    scale: 'Масштаб',
    illustrative: 'Наглядно',
    trueScaleShort: 'Истинный',
    trueScaleLong: 'Истинный масштаб',
    film: { off: 'Плёнка выключена', soft: 'Плёнка: мягко', strong: 'Плёнка: сильно' },
    soundOn: 'Включить звук',
    soundOff: 'Выключить звук',
    settings: 'Настройки',
    help: 'Как пользоваться',
    fullscreen: 'Полный экран',
    exitFullscreen: 'Выйти из полного экрана',
    language: 'Язык',
  },

  settings: {
    title: 'Настройки',
    view: 'Вид',
    orbits: { label: 'Орбиты', hint: 'Настоящие эллипсы на текущую дату' },
    labels: { label: 'Подписи', hint: 'Названия тел в сцене' },
    asteroids: { label: 'Пояс астероидов', hint: '7000 тел со своими орбитами' },
    constellations: { label: 'Созвездия', hint: 'Линии и названия по каталогу МАС' },
    film: 'Плёнка и объектив',
    filmStrength: 'Сила помех',
    filmOptions: { off: 'Выкл', soft: 'Мягко', strong: 'Сильно' },
    events: 'События',
    autoEvents: { label: 'Сами по себе', hint: 'Случайный сценарий после паузы' },
    autoInterval: 'Пауза между событиями',
    minutes: count => `${count} мин`,
    quality: 'Качество',
    qualityLabel: 'Качество отрисовки',
    qualityOptions: { auto: 'Авто', high: 'Высокое', low: 'Экономное' },
  },

  help: {
    title: 'Как смотреть',
    close: 'Закрыть',
    controls: [
      ['Левая кнопка, один палец', 'вращать вид'],
      ['Колесо, два пальца', 'приблизить и отдалить'],
      ['Правая кнопка', 'сдвинуть центр обзора'],
      ['Щелчок по телу или подписи', 'сведения о теле'],
      ['Пробел', 'пауза'],
      ['Esc', 'закрыть панель'],
    ],
    notes: [
      [
        { strong: 'Орбиты настоящие.', text: ' Положения планет считаются по кеплеровым элементам JPL на выбранную дату: эллипсы, наклоны, прецессия перигелиев. Точность — доли градуса в 1800–2050 годах, дальше — экстраполяция.' },
      ],
      [
        { strong: 'Наглядный масштаб', text: ' сжимает расстояния и размеры, чтобы вся система помещалась в кадр.' },
        { strong: ' Истинный', text: ' показывает пропорции как есть: Земля с орбиты Марса — меньше пикселя, поэтому тела отмечены кружками.' },
      ],
      [
        { strong: 'Помехи плёнки', text: ' зависят от того, куда вы смотрите: у Солнца — пересвет и марево, у Юпитера — радиация, у Нептуна — иней и слабый сигнал. События вымышлены, но опираются на настоящую механику.' },
      ],
    ],
  },

  time: {
    deck: 'Ход времени',
    reverse: 'Обратный ход',
    reverseOn: 'Время идёт назад',
    reverseOff: 'Пустить время назад',
    play: 'Продолжить',
    pause: 'Пауза',
    playHint: 'Продолжить (пробел)',
    pauseHint: 'Пауза (пробел)',
    speed: 'Скорость',
    speedLabel: 'Скорость времени',
    extrapolated: (from, to) => `вне ${from}–${to}: орбиты экстраполированы`,
    now: 'Сейчас',
    nowHint: 'Вернуться к сегодняшнему дню',
  },
  speeds: {
    realtime: 'Реальное время',
    hour: '1 час/с',
    day: '1 день/с',
    week: '1 неделя/с',
    month: '1 месяц/с',
    year: '1 год/с',
    decade: '10 лет/с',
    century: '100 лет/с',
    millennium: '1000 лет/с',
  },

  date: (dayMonth, year) => (year > 0 ? `${dayMonth} ${year}` : `${dayMonth} ${1 - year} до н. э.`),

  units: {
    au: value => `${value} а. е.`,
    km: value => `${value} км`,
    distance: (km, n) => (km >= 1e6 ? `${n(km / 1e6, km < 1e8 ? 1 : 0)} млн км` : `${n(km, 0)} км`),
    lightTime: (seconds, n) => {
      if (seconds < 60) return `${n(seconds, 2)} с`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} мин ${Math.round(seconds % 60)} с`;
      return `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
    },
    seconds: count => `${count} с`,
    earthMasses: (value, count) => `${value} ${plural(count, { one: 'масса Земли', few: 'массы Земли', many: 'масс Земли' })}`,
    days: (value, count) => `${value} ${plural(count, { one: 'сутки', few: 'суток', many: 'суток' })}`,
    earthDays: (value, count) => `${value} ${plural(count, { one: 'земные сутки', few: 'земных суток', many: 'земных суток' })}`,
    hoursMinutes: (hours, minutes) => `${hours} ч ${minutes} мин`,
  },

  bodies: {
    sun: { name: 'Солнце', kind: 'Звезда, жёлтый карлик G2V', description: 'Держит 99,86% массы всей системы. Свет от поверхности идёт до Земли 8 минут 20 секунд.' },
    mercury: { name: 'Меркурий', kind: 'Планета земной группы', description: 'Самая вытянутая орбита среди планет: в перигелии Солнце в полтора раза крупнее, чем в афелии.' },
    venus: { name: 'Венера', kind: 'Планета земной группы', description: 'Вращается в обратную сторону и так медленно, что сутки длиннее года. Жарче Меркурия из-за парникового эффекта.' },
    earth: { name: 'Земля', kind: 'Планета земной группы', description: 'Единственный известный мир с жидкими океанами на поверхности и жизнью.' },
    moon: { name: 'Луна', kind: 'Спутник Земли', description: 'Всегда повёрнута к Земле одной стороной. Плоскость её орбиты разворачивается за 18,6 года — отсюда ритм затмений.' },
    mars: { name: 'Марс', kind: 'Планета земной группы', description: 'Здесь гора Олимп высотой 22 км и каньон длиной с Австралию. Красный цвет даёт оксид железа в пыли.' },
    jupiter: { name: 'Юпитер', kind: 'Газовый гигант', description: 'Тяжелее всех остальных планет вместе взятых. Большое Красное Пятно — буря шире Земли.' },
    saturn: { name: 'Сатурн', kind: 'Газовый гигант', description: 'Кольца шириной 280 000 км, а толщиной местами около десяти метров. Средняя плотность ниже, чем у воды.' },
    uranus: { name: 'Уран', kind: 'Ледяной гигант', description: 'Лежит на боку: ось наклонена на 98°. Каждый полюс по 42 года освещён без перерыва, потом столько же во тьме.' },
    neptune: { name: 'Нептун', kind: 'Ледяной гигант', description: 'Найден в 1846 году на кончике пера — по отклонениям в движении Урана. Ветры до 2 000 км/ч.' },
  },

  facts: {
    diameter: 'Диаметр',
    distanceToEarth: 'До Земли',
    mass: 'Масса',
    temperature: 'Температура',
    meanTemperature: 'Средняя температура',
    surfaceTemperature: 'Поверхность',
    equatorRotation: 'Оборот у экватора',
    orbitalPeriod: 'Оборот',
    solarDay: 'Солнечные сутки',
    day: 'Сутки',
    axialTilt: 'Наклон оси',
    moons: 'Спутники',
  },
  noMoons: 'нет',

  rail: {
    label: 'Небесные тела',
    overview: 'Вся система',
    sunCaption: 'центр системы',
    moonCaption: distance => `${distance} от Земли`,
  },

  card: {
    label: name => `Сведения: ${name}`,
    close: 'Закрыть карточку',
    fromSun: 'До Солнца сейчас',
    fromEarth: 'До Земли сейчас',
    lightTime: 'Свет от Земли идёт',
    flyTo: 'Лететь к телу',
  },

  events: {
    alignment: { name: 'Парад планет', description: 'Планеты выстраиваются в линию по одну сторону Солнца.' },
    eclipse: { name: 'Солнечное затмение', description: 'Тень заслоняет Солнце, и вспыхивает корона.' },
    comet: { name: 'Великая комета', description: 'Гостья из облака Оорта огибает Солнце. Хвост всегда смотрит прочь от светила.' },
    meteors: { name: 'Звёздный дождь', description: 'Поток метеоров прошивает плоскость эклиптики.' },
    flare: { name: 'Дыхание Солнца', description: 'Выброс корональной массы. Волна плазмы бьёт по объективу.' },
    gravity: { name: 'Гравитационная волна', description: 'Пространство идёт рябью, орбиты колеблются, как струны.' },
    rogue: { name: 'Сбившийся странник', description: 'Нептун срывается с орбиты и уходит во тьму.' },
    ice: { name: 'Век великого льда', description: 'Землю сковывает лёд, а линза покрывается инеем.' },
    aliens: { name: 'Мы не одни', description: 'Флот чужих кораблей глушит сигнал обсерватории.' },
    blackhole: { name: 'Незваная бездна', description: 'Рядом рождается чёрная дыра. Свет вокруг неё гнётся.' },
    collision: { name: 'Столкновение миров', description: 'Земля и Марс сходятся. Удар прожигает плёнку.' },
    supernova: { name: 'Последний свет', description: 'Солнце раздувается и сбрасывает оболочку. Вымысел: наша звезда для этого слишком лёгкая.' },
  },
  intensity: { quiet: 'тихое', strong: 'сильное', devastating: 'разрушительное' },

  eventsUi: {
    title: 'События',
    scenarios: 'Сценарии',
    chronicle: 'Хроника',
    close: 'Закрыть',
    nextIn: 'следующее через',
    running: 'идёт сейчас',
    choose: 'выберите сценарий',
    inProgress: 'Идёт событие',
    settling: 'Возвращение к равновесию',
    stop: 'Остановить событие',
    chronicleEmpty: 'Пока пусто. Здесь останется след каждого события этого сеанса.',
    clearChronicle: 'Очистить хронику',
    completed: name => `${name} — завершено`,
    interrupted: name => `${name} — прервано`,
    orbitsRestored: 'Орбиты вернулись к расчётным.',
  },
};
