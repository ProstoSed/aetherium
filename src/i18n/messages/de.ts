import { pluralForm } from '../numbers';
import type { Messages } from './en';

const plural = (count: number, one: string, other: string) => (pluralForm('de', count) === 'one' ? one : other);

export const de: Messages = {
  locale: 'de-DE',

  document: {
    title: 'Aetherium — Himmelsmechanik',
    description: 'Das Sonnensystem auf echten Bahnen, im echten Maßstab, mit kosmischen Ereignissen — gesehen durch das Objektiv einer alten Filmkamera.',
  },
  brand: { tagline: 'Himmelsmechanik' },
  intro: { developing: 'Film wird entwickelt…', ready: 'Fertig', loadingLabel: 'Szene wird geladen', readyLabel: 'Szene bereit' },
  webglError: { title: 'WebGL 2 wird benötigt', hint: 'Aktivieren Sie die Hardwarebeschleunigung in den Browsereinstellungen und laden Sie die Seite neu.' },

  topBar: {
    overview: 'Ganzes System',
    scale: 'Maßstab',
    illustrative: 'Anschaulich',
    trueScaleShort: 'Echt',
    trueScaleLong: 'Echter Maßstab',
    film: { off: 'Film aus', soft: 'Film: sanft', strong: 'Film: stark' },
    soundOn: 'Ton einschalten',
    soundOff: 'Ton ausschalten',
    settings: 'Einstellungen',
    help: 'Bedienung',
    fullscreen: 'Vollbild',
    exitFullscreen: 'Vollbild beenden',
    language: 'Sprache',
  },

  settings: {
    title: 'Einstellungen',
    view: 'Ansicht',
    orbits: { label: 'Umlaufbahnen', hint: 'Echte Ellipsen zum aktuellen Datum' },
    labels: { label: 'Beschriftungen', hint: 'Namen der Himmelskörper in der Szene' },
    asteroids: { label: 'Asteroidengürtel', hint: '7000 Körper auf eigenen Bahnen' },
    constellations: { label: 'Sternbilder', hint: 'Linien und Namen nach der IAU' },
    film: 'Film und Objektiv',
    filmStrength: 'Stärke der Störungen',
    filmOptions: { off: 'Aus', soft: 'Sanft', strong: 'Stark' },
    events: 'Ereignisse',
    autoEvents: { label: 'Von selbst', hint: 'Zufälliges Szenario nach einer Pause' },
    autoInterval: 'Pause zwischen Ereignissen',
    minutes: count => `${count} Min.`,
    quality: 'Qualität',
    qualityLabel: 'Darstellungsqualität',
    qualityOptions: { auto: 'Auto', high: 'Hoch', low: 'Sparsam' },
  },

  help: {
    title: 'So beobachten Sie',
    close: 'Schließen',
    controls: [
      ['Linke Taste, ein Finger', 'Ansicht drehen'],
      ['Mausrad, zwei Finger', 'heran- und wegzoomen'],
      ['Rechte Taste', 'Blickzentrum verschieben'],
      ['Klick auf Körper oder Beschriftung', 'Details zum Körper'],
      ['Leertaste', 'Pause'],
      ['Esc', 'Fenster schließen'],
    ],
    notes: [
      [
        { strong: 'Die Bahnen sind echt.', text: ' Die Positionen der Planeten werden aus den Kepler-Elementen des JPL für das gewählte Datum berechnet: Ellipsen, Neigungen, Präzession der Perihele. Zwischen 1800 und 2050 liegt die Genauigkeit bei Bruchteilen eines Grades, außerhalb wird extrapoliert.' },
      ],
      [
        { strong: 'Der anschauliche Maßstab', text: ' staucht Entfernungen und Größen, damit das ganze System ins Bild passt.' },
        { strong: ' Der echte', text: ' zeigt die Proportionen, wie sie sind: Von der Marsbahn aus ist die Erde kleiner als ein Pixel, deshalb sind die Körper mit Ringen markiert.' },
      ],
      [
        { strong: 'Filmstörungen', text: ' hängen davon ab, wohin Sie schauen: an der Sonne Überbelichtung und Hitzeflimmern, bei Jupiter Strahlung, bei Neptun Reif und ein schwaches Signal. Die Ereignisse sind erfunden, beruhen aber auf echter Mechanik.' },
      ],
    ],
  },

  time: {
    deck: 'Zeitablauf',
    reverse: 'Rückwärtslauf',
    reverseOn: 'Die Zeit läuft rückwärts',
    reverseOff: 'Zeit rückwärts laufen lassen',
    play: 'Fortsetzen',
    pause: 'Pause',
    playHint: 'Fortsetzen (Leertaste)',
    pauseHint: 'Pause (Leertaste)',
    speed: 'Tempo',
    speedLabel: 'Zeittempo',
    extrapolated: (from, to) => `außerhalb ${from}–${to}: Bahnen extrapoliert`,
    now: 'Jetzt',
    nowHint: 'Zurück zum heutigen Tag',
  },
  speeds: {
    realtime: 'Echtzeit',
    hour: '1 Stunde/s',
    day: '1 Tag/s',
    week: '1 Woche/s',
    month: '1 Monat/s',
    year: '1 Jahr/s',
    decade: '10 Jahre/s',
    century: '100 Jahre/s',
    millennium: '1000 Jahre/s',
  },

  date: (dayMonth, year) => (year > 0 ? `${dayMonth} ${year}` : `${dayMonth} ${1 - year} v. Chr.`),

  units: {
    au: value => `${value} AE`,
    km: value => `${value} km`,
    distance: (km, n) => (km >= 1e6 ? `${n(km / 1e6, km < 1e8 ? 1 : 0)} Mio. km` : `${n(km, 0)} km`),
    lightTime: (seconds, n) => {
      if (seconds < 60) return `${n(seconds, 2)} s`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} min ${Math.round(seconds % 60)} s`;
      return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
    },
    seconds: count => `${count} s`,
    earthMasses: (value, count) => `${value} ${plural(count, 'Erdmasse', 'Erdmassen')}`,
    days: (value, count) => `${value} ${plural(count, 'Tag', 'Tage')}`,
    earthDays: (value, count) => `${value} ${plural(count, 'Erdtag', 'Erdtage')}`,
    hoursMinutes: (hours, minutes) => `${hours} h ${minutes} min`,
  },

  bodies: {
    sun: { name: 'Sonne', kind: 'Stern, Gelber Zwerg G2V', description: 'Vereint 99,86 % der Masse des ganzen Systems. Licht von ihrer Oberfläche braucht bis zur Erde 8 Minuten 20 Sekunden.' },
    mercury: { name: 'Merkur', kind: 'Gesteinsplanet', description: 'Die gestreckteste Bahn aller Planeten: Im Perihel erscheint die Sonne anderthalbmal so groß wie im Aphel.' },
    venus: { name: 'Venus', kind: 'Gesteinsplanet', description: 'Dreht sich rückwärts und so langsam, dass ihr Tag länger ist als ihr Jahr. Wegen des Treibhauseffekts heißer als Merkur.' },
    earth: { name: 'Erde', kind: 'Gesteinsplanet', description: 'Die einzige bekannte Welt mit flüssigen Ozeanen an der Oberfläche — und mit Leben.' },
    moon: { name: 'Mond', kind: 'Trabant der Erde', description: 'Zeigt der Erde stets dieselbe Seite. Die Ebene seiner Bahn dreht sich in 18,6 Jahren einmal herum — daher der Rhythmus der Finsternisse.' },
    mars: { name: 'Mars', kind: 'Gesteinsplanet', description: 'Hier stehen der 22 km hohe Olympus Mons und ein Canyon, so lang wie Australien. Die rote Farbe stammt vom Eisenoxid im Staub.' },
    jupiter: { name: 'Jupiter', kind: 'Gasriese', description: 'Schwerer als alle anderen Planeten zusammen. Der Große Rote Fleck ist ein Sturm, breiter als die Erde.' },
    saturn: { name: 'Saturn', kind: 'Gasriese', description: 'Seine Ringe sind 280.000 km breit, stellenweise aber nur etwa zehn Meter dick. Seine mittlere Dichte ist geringer als die von Wasser.' },
    uranus: { name: 'Uranus', kind: 'Eisriese', description: 'Liegt auf der Seite: Die Achse ist um 98° geneigt. Jeder Pol hat 42 Jahre lang ununterbrochen Tag, danach ebenso lange Nacht.' },
    neptune: { name: 'Neptun', kind: 'Eisriese', description: '1846 mit Papier und Feder entdeckt — aus Abweichungen in der Bewegung des Uranus. Winde bis 2.000 km/h.' },
  },

  facts: {
    diameter: 'Durchmesser',
    distanceToEarth: 'Abstand zur Erde',
    mass: 'Masse',
    temperature: 'Temperatur',
    meanTemperature: 'Mittlere Temperatur',
    surfaceTemperature: 'Oberfläche',
    equatorRotation: 'Rotation am Äquator',
    orbitalPeriod: 'Umlauf',
    solarDay: 'Sonnentag',
    day: 'Tag',
    axialTilt: 'Achsneigung',
    moons: 'Monde',
  },
  noMoons: 'keine',

  rail: {
    label: 'Himmelskörper',
    overview: 'Ganzes System',
    sunCaption: 'Zentrum des Systems',
    moonCaption: distance => `${distance} von der Erde`,
  },

  card: {
    label: name => `Details: ${name}`,
    close: 'Karte schließen',
    fromSun: 'Zur Sonne jetzt',
    fromEarth: 'Zur Erde jetzt',
    lightTime: 'Licht von der Erde braucht',
    flyTo: 'Hinfliegen',
  },

  events: {
    alignment: { name: 'Planetenparade', description: 'Die Planeten reihen sich auf einer Seite der Sonne auf.' },
    eclipse: { name: 'Sonnenfinsternis', description: 'Ein Schatten verdeckt die Sonne, und die Korona leuchtet auf.' },
    comet: { name: 'Der Große Komet', description: 'Ein Gast aus der Oortschen Wolke umrundet die Sonne. Sein Schweif zeigt stets von ihr weg.' },
    meteors: { name: 'Sternschnuppenregen', description: 'Ein Meteorstrom durchstößt die Ebene der Ekliptik.' },
    flare: { name: 'Atem der Sonne', description: 'Ein koronaler Massenauswurf. Eine Plasmawelle trifft das Objektiv.' },
    gravity: { name: 'Gravitationswelle', description: 'Der Raum kräuselt sich, die Bahnen schwingen wie Saiten.' },
    rogue: { name: 'Der verirrte Wanderer', description: 'Neptun reißt sich von seiner Bahn los und verschwindet im Dunkel.' },
    ice: { name: 'Zeitalter des großen Eises', description: 'Eis umklammert die Erde, und Reif überzieht die Linse.' },
    aliens: { name: 'Wir sind nicht allein', description: 'Eine fremde Flotte stört das Signal der Sternwarte.' },
    blackhole: { name: 'Ungebetener Abgrund', description: 'In der Nähe entsteht ein Schwarzes Loch. Das Licht krümmt sich um es herum.' },
    collision: { name: 'Zusammenstoß der Welten', description: 'Erde und Mars rücken zusammen. Der Einschlag brennt den Film durch.' },
    supernova: { name: 'Das letzte Licht', description: 'Die Sonne bläht sich auf und stößt ihre Hülle ab. Fiktion: Dafür ist unser Stern zu leicht.' },
  },
  intensity: { quiet: 'ruhig', strong: 'stark', devastating: 'verheerend' },

  eventsUi: {
    title: 'Ereignisse',
    scenarios: 'Szenarien',
    chronicle: 'Chronik',
    close: 'Schließen',
    nextIn: 'nächstes in',
    running: 'läuft gerade',
    choose: 'Szenario wählen',
    inProgress: 'Ereignis läuft',
    settling: 'Rückkehr ins Gleichgewicht',
    stop: 'Ereignis stoppen',
    chronicleEmpty: 'Noch leer. Jedes Ereignis dieser Sitzung hinterlässt hier eine Spur.',
    clearChronicle: 'Chronik leeren',
    completed: name => `${name} — beendet`,
    interrupted: name => `${name} — abgebrochen`,
    orbitsRestored: 'Die Bahnen sind zu den berechneten zurückgekehrt.',
  },
};
