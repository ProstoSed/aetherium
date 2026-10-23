import { pluralForm } from '../numbers';
import type { Messages } from './en';

/** В французском единственное число — для значений меньше двух: «0,055 masse terrestre». */
const plural = (count: number, one: string, other: string) => (pluralForm('fr', count) === 'one' ? one : other);
/** Перед двоеточием во французской типографике — неразрывный пробел. */
const COLON = ' :';

export const fr: Messages = {
  locale: 'fr-FR',

  document: {
    title: 'Aetherium — mécanique céleste',
    description: 'Le Système solaire sur ses vraies orbites, à l’échelle réelle, avec des événements cosmiques vus à travers l’objectif d’une vieille caméra argentique.',
  },
  brand: { tagline: 'mécanique céleste' },
  intro: { developing: 'Développement de la pellicule…', ready: 'Prêt', loadingLabel: 'Chargement de la scène', readyLabel: 'Scène prête' },
  firstSteps: { text: 'Cliquez sur une planète pour ouvrir sa fiche, ou lancez un événement et regardez les orbites réagir.', dismiss: 'Compris' },
  webglError: { title: 'WebGL 2 est nécessaire', hint: 'Activez l’accélération matérielle dans les réglages du navigateur, puis rechargez la page.' },

  topBar: {
    overview: 'Tout le système',
    scale: 'Échelle',
    illustrative: 'Illustrative',
    trueScaleShort: 'Réelle',
    trueScaleLong: 'Échelle réelle',
    film: { off: 'Pellicule désactivée', soft: `Pellicule${COLON} douce`, strong: `Pellicule${COLON} forte` },
    soundOn: 'Activer le son',
    soundOff: 'Couper le son',
    settings: 'Réglages',
    help: 'Mode d’emploi',
    fullscreen: 'Plein écran',
    exitFullscreen: 'Quitter le plein écran',
    language: 'Langue',
  },

  settings: {
    title: 'Réglages',
    view: 'Affichage',
    orbits: { label: 'Orbites', hint: 'Vraies ellipses à la date actuelle' },
    labels: { label: 'Étiquettes', hint: 'Noms des corps dans la scène' },
    asteroids: { label: 'Ceinture d’astéroïdes', hint: count => `${count} corps sur leurs propres orbites` },
    constellations: { label: 'Constellations', hint: 'Tracés et noms de l’UAI' },
    film: 'Pellicule et objectif',
    filmStrength: 'Intensité des défauts',
    filmOptions: { off: 'Non', soft: 'Douce', strong: 'Forte' },
    events: 'Événements',
    autoEvents: { label: 'D’eux-mêmes', hint: 'Un scénario au hasard après une pause' },
    autoInterval: 'Pause entre les événements',
    minutes: count => `${count} min`,
    quality: 'Qualité',
    qualityLabel: 'Qualité du rendu',
    qualityOptions: { auto: 'Auto', high: 'Haute', low: 'Économe' },
  },

  help: {
    title: 'Comment regarder',
    close: 'Fermer',
    controls: [
      ['Bouton gauche, un doigt', 'faire pivoter la vue'],
      ['Molette, deux doigts', 'zoomer et dézoomer'],
      ['Bouton droit', 'déplacer le centre de la vue'],
      ['Clic sur un corps ou son nom', 'fiche du corps'],
      ['Espace', 'pause'],
      ['Échap', 'fermer le panneau ou la fiche'],
    ],
    notes: [
      [
        { strong: 'Les orbites sont réelles.', text: ` Les positions des planètes sont calculées à partir des éléments képlériens du JPL pour la date choisie${COLON} ellipses, inclinaisons, précession des périhélies. La précision est d’une fraction de degré entre 1800 et 2050 et d’un degré au plus de 3000 av. J.-C. à 3000 apr. J.-C.${' '}; au-delà, les éléments sont extrapolés.` },
      ],
      [
        { strong: 'L’échelle illustrative', text: ' comprime les distances et les tailles pour que tout le système tienne dans le cadre.' },
        { strong: ' L’échelle réelle', text: ` montre les proportions telles quelles${COLON} vue depuis l’orbite de Mars, la Terre est plus petite qu’un pixel, c’est pourquoi les corps sont marqués d’un cercle.` },
      ],
      [
        { strong: 'Les défauts de la pellicule', text: ` dépendent de ce que vous regardez${COLON} près du Soleil, surexposition et mirage de chaleur${' '}; près de Jupiter, radiations${' '}; près de Neptune, givre et signal faible. Les événements sont imaginaires, mais reposent sur une vraie mécanique.` },
      ],
    ],
  },

  time: {
    deck: 'Écoulement du temps',
    reverse: 'Marche arrière',
    reverseOn: 'Le temps remonte',
    reverseOff: 'Faire remonter le temps',
    play: 'Reprendre',
    pause: 'Pause',
    playHint: 'Reprendre (Espace)',
    pauseHint: 'Pause (Espace)',
    speed: 'Vitesse',
    speedLabel: 'Vitesse du temps',
    extrapolated: (from, to) => `hors ${from} – ${to}${COLON} orbites extrapolées`,
    now: 'Maintenant',
    nowHint: 'Revenir à aujourd’hui',
  },
  speeds: {
    realtime: 'Temps réel',
    hour: '1 heure/s',
    day: '1 jour/s',
    week: '1 semaine/s',
    month: '1 mois/s',
    year: '1 an/s',
    decade: '10 ans/s',
    century: '100 ans/s',
    millennium: '1000 ans/s',
  },

  date: (dayMonth, year) => (year > 0 ? `${dayMonth} ${year}` : `${dayMonth} ${1 - year} av. J.-C.`),
  year: year => (year > 0 ? `${year} apr. J.-C.` : `${1 - year} av. J.-C.`),

  units: {
    au: value => `${value} UA`,
    km: value => `${value} km`,
    distance: (km, n) => (km >= 1e6 ? `${n(km / 1e6, km < 1e8 ? 1 : 0)} millions de km` : `${n(km, 0)} km`),
    lightSeconds: value => `${value} s`,
    minutesSeconds: (minutes, seconds) => `${minutes} min ${seconds} s`,
    seconds: count => `${count} s`,
    earthMasses: (value, count) => `${value} ${plural(count, 'masse terrestre', 'masses terrestres')}`,
    days: (value, count) => `${value} ${plural(count, 'jour', 'jours')}`,
    earthDays: (value, count) => `${value} ${plural(count, 'jour terrestre', 'jours terrestres')}`,
    hoursMinutes: (hours, minutes) => `${hours} h ${minutes} min`,
  },

  bodies: {
    sun: { name: 'Soleil', kind: 'Étoile, naine jaune G2V', description: 'Concentre 99,86 % de la masse de tout le système. Sa lumière met 8 minutes 20 secondes pour atteindre la Terre.' },
    mercury: { name: 'Mercure', kind: 'Planète tellurique', description: `L’orbite la plus allongée de toutes les planètes${COLON} au périhélie, le Soleil paraît une fois et demie plus grand qu’à l’aphélie.` },
    venus: { name: 'Vénus', kind: 'Planète tellurique', description: 'Tourne à l’envers, et si lentement que son jour dure plus que son année. Plus chaude que Mercure à cause de l’effet de serre.' },
    earth: { name: 'Terre', kind: 'Planète tellurique', description: 'Le seul monde connu avec des océans liquides à sa surface — et de la vie.' },
    moon: { name: 'Lune', kind: 'Satellite de la Terre', description: 'Montre toujours la même face à la Terre. Le plan de son orbite fait un tour en 18,6 ans, d’où le rythme des éclipses.' },
    mars: { name: 'Mars', kind: 'Planète tellurique', description: 'Ici se dressent l’Olympus Mons, haut de 22 km, et un canyon long comme l’Australie. Sa couleur rouge vient de l’oxyde de fer contenu dans la poussière.' },
    jupiter: { name: 'Jupiter', kind: 'Géante gazeuse', description: 'Plus lourde que toutes les autres planètes réunies. La Grande Tache rouge est une tempête plus large que la Terre.' },
    saturn: { name: 'Saturne', kind: 'Géante gazeuse', description: 'Ses anneaux s’étendent sur 280 000 km, mais ne font par endroits qu’une dizaine de mètres d’épaisseur. Sa densité moyenne est inférieure à celle de l’eau.' },
    uranus: { name: 'Uranus', kind: 'Géante de glace', description: `Couchée sur le côté${COLON} son axe est incliné de 98°. Chaque pôle connaît 42 ans de jour ininterrompu, puis autant de nuit.` },
    neptune: { name: 'Neptune', kind: 'Géante de glace', description: 'Découverte en 1846 par le calcul, à partir des écarts dans le mouvement d’Uranus. Des vents jusqu’à 2 000 km/h.' },
  },

  facts: {
    diameter: 'Diamètre',
    distanceToEarth: 'Distance à la Terre',
    mass: 'Masse',
    temperature: 'Température',
    meanTemperature: 'Température moyenne',
    surfaceTemperature: 'Surface',
    equatorRotation: 'Rotation à l’équateur',
    orbitalPeriod: 'Révolution',
    solarDay: 'Jour solaire',
    day: 'Jour',
    axialTilt: 'Inclinaison de l’axe',
    moons: 'Satellites',
  },
  noMoons: 'aucun',

  rail: {
    label: 'Corps célestes',
    overview: 'Tout le système',
    sunCaption: 'centre du système',
    moonCaption: distance => `${distance} de la Terre`,
  },

  card: {
    label: name => `Fiche${COLON} ${name}`,
    close: 'Fermer la fiche',
    fromSun: 'Distance au Soleil',
    fromEarth: 'Distance à la Terre',
    lightTime: 'Lumière depuis la Terre',
    flyTo: 'Voler vers le corps',
  },

  events: {
    alignment: { name: 'Alignement des planètes', description: 'Les planètes s’alignent d’un même côté du Soleil.' },
    eclipse: { name: 'Éclipse solaire', description: 'Une ombre masque le Soleil, et la couronne s’embrase.' },
    comet: { name: 'La Grande Comète', description: 'Une visiteuse du nuage d’Oort contourne le Soleil. Sa queue pointe toujours à l’opposé de l’astre.' },
    meteors: { name: 'Pluie d’étoiles filantes', description: 'Un essaim de météores transperce le plan de l’écliptique.' },
    flare: { name: 'Souffle du Soleil', description: 'Une éjection de masse coronale. Une vague de plasma frappe l’objectif.' },
    gravity: { name: 'Onde gravitationnelle', description: 'L’espace ondule, les orbites vibrent comme des cordes.' },
    rogue: { name: 'Le Vagabond égaré', description: 'Neptune s’arrache à son orbite et s’enfonce dans l’obscurité.' },
    ice: { name: 'L’Âge de la grande glace', description: 'La glace enserre la Terre, et le givre couvre l’objectif.' },
    aliens: { name: 'Nous ne sommes pas seuls', description: 'Une flotte de vaisseaux étrangers brouille le signal de l’observatoire.' },
    blackhole: { name: 'L’Abîme importun', description: 'Un trou noir naît tout près. La lumière se courbe autour de lui.' },
    collision: { name: 'Le Choc des mondes', description: 'La Terre et Mars se rapprochent. L’impact brûle la pellicule.' },
    supernova: { name: 'La Dernière Lumière', description: `Le Soleil enfle et rejette son enveloppe. Fiction${COLON} notre étoile est trop légère pour cela.` },
  },
  intensity: { quiet: 'calme', strong: 'fort', devastating: 'dévastateur' },

  eventsUi: {
    title: 'Événements',
    scenarios: 'Scénarios',
    chronicle: 'Chronique',
    close: 'Fermer',
    nextIn: 'prochain dans',
    running: 'en cours',
    choose: 'choisissez un scénario',
    inProgress: 'Événement en cours',
    settling: 'Retour à l’équilibre',
    stop: 'Arrêter l’événement',
    showEvent: 'Revenir à l’événement',
    chronicleEmpty: 'Rien pour l’instant. Chaque événement de cette séance laissera ici sa trace.',
    clearChronicle: 'Effacer la chronique',
    completed: name => `${name} — terminé`,
    interrupted: name => `${name} — interrompu`,
    orbitsRestored: 'Les orbites ont retrouvé leur tracé calculé.',
  },
};
