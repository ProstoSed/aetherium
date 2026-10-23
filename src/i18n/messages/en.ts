import type { BodyId, FactKind } from '../../data/bodies';
import type { EventId, EventIntensity } from '../../data/events';
import type { SpeedId } from '../../engine/SimulationClock';
import type { NumberText } from '../numbers';

/**
 * Английский словарь — эталон: его форма задаёт тип Messages, и остальные словари обязаны
 * повторить её целиком. Где текст зависит от числа, вместо строки стоит функция: склонения
 * и порядок слов в языках разные.
 */
export const en = {
  locale: 'en-GB',

  document: {
    title: 'Aetherium — celestial mechanics',
    description: 'The Solar System on real orbits, in true scale, with cosmic events seen through the lens of an old film camera.',
  },
  brand: { tagline: 'celestial mechanics' },
  intro: { developing: 'Developing the film…', ready: 'Ready', loadingLabel: 'Loading the scene', readyLabel: 'Scene ready' },
  /** Подсказка при первом посещении: что здесь можно делать. */
  firstSteps: { text: 'Click a planet to open its card — or start an event and watch the orbits react.', dismiss: 'Got it' },
  webglError: { title: 'WebGL 2 is required', hint: 'Turn on hardware acceleration in your browser settings and reload the page.' },

  topBar: {
    overview: 'Whole system',
    scale: 'Scale',
    illustrative: 'Illustrative',
    trueScaleShort: 'True',
    trueScaleLong: 'True scale',
    film: { off: 'Film off', soft: 'Film: soft', strong: 'Film: strong' },
    soundOn: 'Turn sound on',
    soundOff: 'Turn sound off',
    settings: 'Settings',
    help: 'How to use',
    fullscreen: 'Full screen',
    exitFullscreen: 'Exit full screen',
    language: 'Language',
  },

  settings: {
    title: 'Settings',
    view: 'View',
    orbits: { label: 'Orbits', hint: 'True ellipses for the current date' },
    labels: { label: 'Labels', hint: 'Body names in the scene' },
    asteroids: { label: 'Asteroid belt', hint: (count: string) => `${count} bodies on their own orbits` },
    constellations: { label: 'Constellations', hint: 'IAU lines and names' },
    film: 'Film and lens',
    filmStrength: 'Artefact strength',
    filmOptions: { off: 'Off', soft: 'Soft', strong: 'Strong' },
    events: 'Events',
    autoEvents: { label: 'On their own', hint: 'A random scenario after a pause' },
    autoInterval: 'Pause between events',
    minutes: (count: number) => `${count} min`,
    quality: 'Quality',
    qualityLabel: 'Rendering quality',
    qualityOptions: { auto: 'Auto', high: 'High', low: 'Economy' },
  },

  help: {
    title: 'How to watch',
    close: 'Close',
    controls: [
      ['Left button, one finger', 'rotate the view'],
      ['Wheel, two fingers', 'zoom in and out'],
      ['Right button', 'move the view centre'],
      ['Click a body or its label', 'body details'],
      ['Space', 'pause'],
      ['Esc', 'close the panel or card'],
    ] as [string, string][],
    /** Абзацы справки: жирный зачин и продолжение. */
    notes: [
      [
        { strong: 'The orbits are real.', text: ' Planet positions come from JPL Keplerian elements for the chosen date: ellipses, inclinations, precession of perihelia. Accuracy is a fraction of a degree in 1800–2050; beyond that the elements are extrapolated.' },
      ],
      [
        { strong: 'Illustrative scale', text: ' compresses distances and sizes so the whole system fits in the frame.' },
        { strong: ' True scale', text: ' shows the proportions as they are: Earth seen from Mars’s orbit is smaller than a pixel, so bodies are marked with rings.' },
      ],
      [
        { strong: 'Film artefacts', text: ' depend on where you look: near the Sun — overexposure and heat shimmer, at Jupiter — radiation, at Neptune — frost and a weak signal. The events are fiction, but they rest on real mechanics.' },
      ],
    ] as { strong: string; text: string }[][],
  },

  time: {
    deck: 'Flow of time',
    reverse: 'Reverse time',
    reverseOn: 'Time runs backwards',
    reverseOff: 'Run time backwards',
    play: 'Resume',
    pause: 'Pause',
    playHint: 'Resume (Space)',
    pauseHint: 'Pause (Space)',
    speed: 'Speed',
    speedLabel: 'Time speed',
    extrapolated: (from: number, to: number) => `outside ${from}–${to}: orbits extrapolated`,
    now: 'Now',
    nowHint: 'Back to today',
  },
  speeds: {
    realtime: 'Real time',
    hour: '1 hour/s',
    day: '1 day/s',
    week: '1 week/s',
    month: '1 month/s',
    year: '1 year/s',
    decade: '10 years/s',
    century: '100 years/s',
    millennium: '1000 years/s',
  } satisfies Record<SpeedId, string>,

  /** Дата: «день и месяц» уже отформатированы Intl, год — число, у дат до н. э. ≤ 0. */
  date: (dayMonth: string, year: number) => (year > 0 ? `${dayMonth} ${year}` : `${dayMonth} ${1 - year} BC`),

  units: {
    au: (value: string) => `${value} AU`,
    km: (value: string) => `${value} km`,
    /** Расстояние целиком: большие числа — в миллионах километров, иначе цифры не читаются. */
    distance: (km: number, n: NumberText) => (km >= 1e6 ? `${n(km / 1e6, km < 1e8 ? 1 : 0)} million km` : `${n(km, 0)} km`),
    /** Секунды света с дробью: у Луны «1,28 s». */
    lightSeconds: (value: string) => `${value} s`,
    minutesSeconds: (minutes: number, seconds: number) => `${minutes} min ${seconds} s`,
    seconds: (count: number) => `${count} s`,
    earthMasses: (value: string, count: number) => `${value} ${count === 1 ? 'Earth mass' : 'Earth masses'}`,
    days: (value: string, count: number) => `${value} ${count === 1 ? 'day' : 'days'}`,
    earthDays: (value: string, count: number) => `${value} Earth ${count === 1 ? 'day' : 'days'}`,
    hoursMinutes: (hours: number, minutes: number) => `${hours} h ${minutes} min`,
  },

  bodies: {
    sun: { name: 'Sun', kind: 'Star, yellow dwarf G2V', description: 'Holds 99.86% of the mass of the whole system. Light from its surface reaches Earth in 8 minutes 20 seconds.' },
    mercury: { name: 'Mercury', kind: 'Terrestrial planet', description: 'The most elongated orbit of all the planets: at perihelion the Sun looks one and a half times larger than at aphelion.' },
    venus: { name: 'Venus', kind: 'Terrestrial planet', description: 'Spins backwards, and so slowly that its day is longer than its year. Hotter than Mercury because of the greenhouse effect.' },
    earth: { name: 'Earth', kind: 'Terrestrial planet', description: 'The only known world with liquid oceans on its surface — and with life.' },
    moon: { name: 'Moon', kind: 'Earth’s satellite', description: 'Always turns the same face to Earth. The plane of its orbit swings round every 18.6 years, setting the rhythm of eclipses.' },
    mars: { name: 'Mars', kind: 'Terrestrial planet', description: 'Home to Olympus Mons, 22 km high, and a canyon as long as Australia. The red colour comes from iron oxide in the dust.' },
    jupiter: { name: 'Jupiter', kind: 'Gas giant', description: 'Heavier than all the other planets combined. The Great Red Spot is a storm wider than Earth.' },
    saturn: { name: 'Saturn', kind: 'Gas giant', description: 'Its rings span 280,000 km yet in places are only about ten metres thick. Its average density is lower than that of water.' },
    uranus: { name: 'Uranus', kind: 'Ice giant', description: 'Lies on its side: the axis is tilted by 98°. Each pole has 42 years of unbroken daylight, then as many in darkness.' },
    neptune: { name: 'Neptune', kind: 'Ice giant', description: 'Found in 1846 with pen and paper, from deviations in the motion of Uranus. Winds reach 2,000 km/h.' },
  } satisfies Record<BodyId, { name: string; kind: string; description: string }>,

  facts: {
    diameter: 'Diameter',
    distanceToEarth: 'Distance to Earth',
    mass: 'Mass',
    temperature: 'Temperature',
    meanTemperature: 'Mean temperature',
    surfaceTemperature: 'Surface',
    equatorRotation: 'Rotation at equator',
    orbitalPeriod: 'Orbit',
    solarDay: 'Solar day',
    day: 'Day',
    axialTilt: 'Axial tilt',
    moons: 'Moons',
  } satisfies Record<FactKind, string>,
  noMoons: 'none',

  rail: {
    label: 'Celestial bodies',
    overview: 'Whole system',
    sunCaption: 'centre of the system',
    moonCaption: (distance: string) => `${distance} from Earth`,
  },

  card: {
    label: (name: string) => `Details: ${name}`,
    close: 'Close card',
    fromSun: 'To the Sun now',
    fromEarth: 'To Earth now',
    lightTime: 'Light from Earth takes',
    flyTo: 'Fly to body',
  },

  events: {
    alignment: { name: 'Planetary Alignment', description: 'The planets line up on one side of the Sun.' },
    eclipse: { name: 'Solar Eclipse', description: 'A shadow covers the Sun, and the corona flares up.' },
    comet: { name: 'The Great Comet', description: 'A visitor from the Oort cloud rounds the Sun. Its tail always points away from the star.' },
    meteors: { name: 'Meteor Shower', description: 'A stream of meteors pierces the plane of the ecliptic.' },
    flare: { name: 'Breath of the Sun', description: 'A coronal mass ejection. A wave of plasma strikes the lens.' },
    gravity: { name: 'Gravitational Wave', description: 'Space ripples, and the orbits quiver like strings.' },
    rogue: { name: 'The Stray Wanderer', description: 'Neptune breaks away from its orbit and drifts into the dark.' },
    ice: { name: 'Age of Great Ice', description: 'Ice grips the Earth, and frost creeps over the lens.' },
    aliens: { name: 'We Are Not Alone', description: 'A fleet of alien ships jams the observatory’s signal.' },
    blackhole: { name: 'Uninvited Abyss', description: 'A black hole is born nearby. Light bends around it.' },
    collision: { name: 'Clash of Worlds', description: 'Earth and Mars converge. The impact burns through the film.' },
    supernova: { name: 'The Last Light', description: 'The Sun swells and sheds its envelope. Fiction: our star is too light for this.' },
  } satisfies Record<EventId, { name: string; description: string }>,
  intensity: { quiet: 'quiet', strong: 'strong', devastating: 'devastating' } satisfies Record<EventIntensity, string>,

  eventsUi: {
    title: 'Events',
    scenarios: 'Scenarios',
    chronicle: 'Chronicle',
    close: 'Close',
    nextIn: 'next in',
    running: 'running now',
    choose: 'choose a scenario',
    inProgress: 'Event in progress',
    settling: 'Returning to balance',
    stop: 'Stop event',
    showEvent: 'Back to the event',
    chronicleEmpty: 'Nothing here yet. Every event of this session will leave a trace.',
    clearChronicle: 'Clear chronicle',
    completed: (name: string) => `${name} — completed`,
    interrupted: (name: string) => `${name} — interrupted`,
    orbitsRestored: 'The orbits returned to their computed paths.',
  },
};

export type Messages = typeof en;
