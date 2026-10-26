/**
 * Languages. The journey is written in Spanish; English is a dictionary keyed by the Spanish text,
 * applied where text reaches the screen (the worlds' names, sentences and notes, the moments'
 * captions, the page's own copy). A missing entry simply shows the Spanish.
 *
 * The language: `?lang=en|es`, else the visitor's last choice, else the browser's language
 * (Spanish for Spanish speakers, English for everyone else).
 */

export type Lang = 'es' | 'en';
const KEY = 'potencias.lang';

export const lang: Lang = (() => {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('lang') : null;
  if (q === 'en' || q === 'es') return q;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'es') return saved;
  } catch {
    /* storage unavailable */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language : 'en';
  return nav.toLowerCase().startsWith('es') ? 'es' : 'en';
})();

/** The text in the current language. */
export const tx = (es: string) => (lang === 'en' ? (EN[es] ?? es) : es);

/** Switches language (remembered) and reloads in place. */
export function switchLang() {
  const next: Lang = lang === 'en' ? 'es' : 'en';
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* storage unavailable */
  }
  const url = new URL(location.href);
  url.searchParams.delete('lang');
  location.replace(url.toString());
}

const EN: Record<string, string> = {
  // The page.
  'Espacio': 'Space',
  'Todo está hecho de algo más pequeño.': 'Everything is made of something smaller.',
  'Desliza para empezar': 'Scroll to begin',
  'Lámina': 'Plate',
  'Sonido': 'Sound',
  'Reproducir': 'Play',
  'Escala': 'Scale',
  'Fin del viaje': 'End of the journey',
  'De la espuma de Planck a todas las matemáticas posibles: más de sesenta órdenes de magnitud, y todo hecho de algo más pequeño.':
    'From the Planck foam to every possible mathematics: more than sixty orders of magnitude, and all of it made of something smaller.',
  'Un viaje continuo por las potencias de diez, de la espuma de Planck al multiverso: todo está hecho de algo más pequeño.':
    'A continuous journey through the powers of ten, from the Planck foam to the multiverse: everything is made of something smaller.',

  // Territories.
  'hipotético': 'hypothetical',
  'desconocido': 'unknown',
  'subatómico': 'subatomic',
  'atómico': 'atomic',
  'molecular': 'molecular',
  'vida': 'life',
  'Tierra': 'Earth',
  'Sistema Solar': 'Solar System',
  'Vía Láctea': 'Milky Way',
  'galaxias': 'galaxies',
  'universo': 'universe',

  // Planck, unification, desert, collider.
  'Espuma de Planck': 'Planck foam',
  'Hipótesis: a esta escala el propio espacio burbujea, y quizá todo sean cuerdas vibrando.':
    'Hypothesis: at this scale space itself bubbles, and perhaps everything is vibrating strings.',
  'Planck': 'Planck',
  'La gran unificación': 'Grand unification',
  'Hipótesis: a esta escala, la fuerza nuclear fuerte, la débil y el electromagnetismo serían una sola fuerza.':
    'Hypothesis: at this scale the strong force, the weak force and electromagnetism would be a single force.',
  'unificación': 'unification',
  'una sola fuerza': 'a single force',
  'fuerte': 'strong',
  'débil': 'weak',
  'electromagnética': 'electromagnetic',
  'El desierto': 'The desert',
  'Entre la unificación y lo que hemos visto: catorce órdenes de magnitud de los que no sabemos nada.':
    'Between unification and what we have seen: fourteen orders of magnitude we know nothing about.',
  'desierto': 'desert',
  'El límite de lo visto': 'The edge of the seen',
  'Lo más pequeño que hemos explorado: chocando protones, el LHC distingue hasta unos 10⁻¹⁹ metros.':
    'The smallest we have explored: smashing protons together, the LHC resolves down to about 10⁻¹⁹ metres.',
  'LHC': 'LHC',
  'choque': 'collision',
  'detector de trazas': 'tracker',
  'calorímetro': 'calorimeter',
  'cámaras de muones': 'muon chambers',
  'haz de protones': 'proton beam',

  // Proton, nucleus, the atom's emptiness, the atom.
  'Protón': 'Proton',
  'Tres quarks unidos por gluones: la fuerza más intensa que conocemos.': 'Three quarks bound by gluons: the strongest force we know.',
  'protón': 'proton',
  'quark up': 'up quark',
  'quark down': 'down quark',
  'gluones': 'gluons',
  'Nadie ha visto un quark solo': 'No one has ever seen a lone quark',
  'Al separarlos, la fuerza no se debilita: la energía del tubo crece hasta romperlo, y con ella nacen dos quarks nuevos.':
    'Pull them apart and the force does not weaken: the energy in the tube grows until it snaps, and two new quarks are born from it.',
  'Núcleo de carbono': 'Carbon nucleus',
  'Seis protones y seis neutrones: casi toda la masa del átomo cabe aquí.': "Six protons and six neutrons: almost all of the atom's mass fits in here.",
  'nuestro protón': 'our proton',
  'neutrón': 'neutron',
  'núcleo': 'nucleus',
  'El vacío del átomo': "The atom's emptiness",
  'Si el núcleo fuera una canica, el átomo sería un estadio.': 'If the nucleus were a marble, the atom would be a stadium.',
  'vacío': 'emptiness',
  'la canica: el núcleo': 'the marble: the nucleus',
  'el estadio: el átomo': 'the stadium: the atom',
  'Átomo de carbono': 'Carbon atom',
  'Cuatro nubes de probabilidad: así se enlaza el carbono.': 'Four clouds of probability: this is how carbon bonds.',
  'átomo': 'atom',
  'orbital sp³': 'sp³ orbital',
  'nube de electrones': 'electron cloud',
  '109,5°': '109.5°',
  'un vecino: 1,54 Å': 'a neighbour: 1.54 Å',

  // DNA to the cell.
  'ADN · doble hélice': 'DNA · double helix',
  'Cada punto de luz es un átomo. Nuestro carbono es uno de ellos.': 'Every point of light is an atom. Our carbon is one of them.',
  'ADN': 'DNA',
  'nuestro carbono': 'our carbon',
  'esqueleto de fosfato': 'phosphate backbone',
  'par de bases': 'base pair',
  'Nucleosomas': 'Nucleosomes',
  'El ADN se enrolla en proteínas: así caben dos metros en cada núcleo.': 'DNA winds around proteins: that is how two metres of it fit in every nucleus.',
  'nucleosomas': 'nucleosomes',
  'nuestro tramo de ADN': 'our stretch of DNA',
  'histonas': 'histones',
  'ADN enrollado': 'wound DNA',
  'Cromatina': 'Chromatin',
  'Cada hebra es ADN plegado una y otra vez.': 'Every strand is DNA folded over and over.',
  'cromatina': 'chromatin',
  'nuestra fibra': 'our fibre',
  'envoltura nuclear': 'nuclear envelope',
  'Célula eucariota': 'Eukaryotic cell',
  'Unos cien billones de átomos.': 'Some hundred trillion atoms.',
  'célula': 'cell',
  'nucléolo': 'nucleolus',
  'mitocondria': 'mitochondrion',
  'aparato de Golgi': 'Golgi apparatus',
  'retículo endoplasmático': 'endoplasmic reticulum',
  'membrana': 'membrane',
  'Una célula se divide': 'A cell divides',
  'Cada célula de esta hoja nació así: de otra que se dividió en dos.': 'Every cell in this leaf was born like this: from another that split in two.',

  // Tissue, leaf, tree, valley.
  'Epidermis de una hoja': 'Leaf epidermis',
  'Células como la nuestra, una junto a otra. Algunas forman poros: así respira la hoja.':
    'Cells like ours, side by side. Some form pores: this is how the leaf breathes.',
  'tejido': 'tissue',
  'nuestra célula': 'our cell',
  'estoma': 'stoma',
  'célula epidérmica': 'epidermal cell',
  'Una hoja': 'A leaf',
  'Una red de nervaduras lleva agua a cada una de sus millones de células.': 'A network of veins carries water to every one of its millions of cells.',
  'hoja': 'leaf',
  'nuestro tejido': 'our tissue',
  'nervadura central': 'midrib',
  'nervadura secundaria': 'secondary vein',
  'pecíolo': 'petiole',
  'Un árbol': 'A tree',
  'Unas once mil hojas, cada una con su red de nervaduras, cada nervadura hecha de células.':
    'Some eleven thousand leaves, each with its network of veins, each vein made of cells.',
  'árbol': 'tree',
  'nuestra hoja': 'our leaf',
  'tronco': 'trunk',
  'rama': 'branch',
  'Un valle': 'A valley',
  'Millones de árboles, y bajo cada uno, raíces, hojas y células.': 'Millions of trees, and in each one, roots, leaves and cells.',
  'valle': 'valley',
  'nuestro árbol': 'our tree',
  'lago': 'lake',
  'río': 'river',
  'cordillera': 'mountain range',

  // Earth, Moon, Solar System, Voyager.
  'La Tierra': 'The Earth',
  'Ocho mil millones de personas, y todo lo vivo que conocemos, en una sola esfera.':
    'Eight billion people, and every living thing we know, on a single sphere.',
  'nuestro valle': 'our valley',
  'los Andes': 'the Andes',
  'océano Pacífico': 'Pacific Ocean',
  'Estación Espacial': 'Space Station',
  'La Estación Espacial': 'The Space Station',
  'A 400 km de altura, una vuelta cada hora y media: lo más lejos de la Tierra que vive gente hoy.':
    'At 400 km up, once round every hour and a half: the farthest from Earth that people live today.',
  'La Tierra y la Luna': 'The Earth and the Moon',
  'Entre ambas cabrían todos los demás planetas del Sistema Solar, uno junto a otro.':
    "All the other planets in the Solar System would fit between them, side by side.",
  'Luna': 'Moon',
  'la Tierra': 'the Earth',
  'la Luna': 'the Moon',
  'La salida de la Tierra': 'Earthrise',
  'Apollo 8, Nochebuena de 1968: la primera vez que alguien vio la Tierra asomar sobre el horizonte de otro mundo.':
    "Apollo 8, Christmas Eve 1968: the first time anyone saw the Earth rise over another world's horizon.",
  'El Sistema Solar': 'The Solar System',
  'La luz del Sol tarda ocho minutos en llegar a la Tierra, y más de cuatro horas en llegar a Neptuno.':
    "Sunlight takes eight minutes to reach the Earth, and more than four hours to reach Neptune.",
  'el Sol': 'the Sun',
  'Mercurio': 'Mercury',
  'Venus': 'Venus',
  'Marte': 'Mars',
  'Júpiter': 'Jupiter',
  'Saturno': 'Saturn',
  'Urano': 'Uranus',
  'Neptuno': 'Neptune',
  'anillo A': 'A ring',
  'anillo B': 'B ring',
  'división de Cassini': 'Cassini Division',
  'sombra de Saturno': "Saturn's shadow",
  'Sus anillos miden 280 000 km de punta a punta y apenas unas decenas de metros de grosor: de canto, casi desaparecen.':
    'Its rings span 280,000 km from edge to edge and are only a few tens of metres thick: seen edge on, they all but vanish.',
  'Voyager 1': 'Voyager 1',
  'Voyager 2': 'Voyager 2',
  'Voyager': 'Voyager',
  'Lo más lejos que ha llegado algo nuestro: salió del viento solar en 2012 y ya está a casi un día luz.':
    'The farthest anything of ours has gone: it left the solar wind in 2012 and is now almost a light-day away.',
  'heliopausa': 'heliopause',
  'Un punto azul pálido': 'A pale blue dot',
  'Así vio la Tierra la Voyager 1 en 1990, desde seis mil millones de kilómetros: todo lo que conocemos, en un píxel.':
    'This is how Voyager 1 saw the Earth in 1990, from six billion kilometres: everything we know, in a single pixel.',

  // Oort, neighbours, Radcliffe.
  'La nube de Oort': 'The Oort cloud',
  'Un billón de cometas helados: la luz del Sol tarda un año y medio en atravesarla.':
    "A trillion icy comets: sunlight takes a year and a half to cross it.",
  'Oort': 'Oort',
  'heliosfera': 'heliosphere',
  'nube de Oort interior': 'inner Oort cloud',
  'nube de Oort exterior': 'outer Oort cloud',
  'Las estrellas vecinas': 'The neighbouring stars',
  'Unas treinta estrellas a menos de doce años luz; la mayoría, enanas rojas demasiado tenues para verlas a simple vista.':
    'Some thirty stars within twelve light-years; most of them red dwarfs too faint to see with the naked eye.',
  'vecinas': 'neighbours',
  'La luz de Próxima': "Proxima's light",
  'Sale de la estrella más cercana y tarda más de cuatro años en llegar: la vemos como era entonces.':
    'It leaves the nearest star and takes more than four years to arrive: we see it as it was then.',
  'Alfa Centauri': 'Alpha Centauri',
  'Alfa Centauri A': 'Alpha Centauri A',
  'Alfa Centauri B': 'Alpha Centauri B',
  'Próxima Centauri': 'Proxima Centauri',
  'Estrella de Barnard': "Barnard's Star",
  'Sirio': 'Sirius',
  'Épsilon Eridani': 'Epsilon Eridani',
  'Épsilon Indi': 'Epsilon Indi',
  'Estrella de Luyten': "Luyten's Star",
  'Estrella de Teegarden': "Teegarden's Star",
  'Estrella de Kapteyn': "Kapteyn's Star",
  'Pólux': 'Pollux',
  'Arturo': 'Arcturus',
  'La ola de Radcliffe': 'The Radcliffe Wave',
  'Descubierta en 2020: una ola de nubes de 9 000 años luz pasa junto al Sol. En su cresta, en Orión, nacen estrellas.':
    'Discovered in 2020: a 9,000-light-year wave of clouds passes beside the Sun. On its crest, in Orion, stars are born.',
  'Orión': 'Orion',
  'nebulosa de Orión': 'Orion Nebula',
  'lazo de Barnard': "Barnard's Loop",
  'Pléyades': 'Pleiades',
  'ola de Radcliffe': 'Radcliffe Wave',

  // Galaxy, Local Group, cosmic web, universe.
  'La Vía Láctea': 'The Milky Way',
  'Unos 200 mil millones de estrellas. El Sol tarda 230 millones de años en dar una vuelta.':
    'Some 200 billion stars. The Sun takes 230 million years to go round once.',
  'Sagitario A*': 'Sagittarius A*',
  'barra central': 'central bar',
  'brazo espiral': 'spiral arm',
  'cúmulo estelar nuclear': 'nuclear star cluster',
  'Sagitario A*: 4 millones de soles': 'Sagittarius A*: 4 million suns',
  'S2: una vuelta cada 16 años': 'S2: once round every 16 years',
  'Un año galáctico': 'A galactic year',
  'La vez anterior que el Sol pasó por este punto de su órbita, aparecían los primeros dinosaurios.':
    'The last time the Sun passed this point of its orbit, the first dinosaurs were appearing.',
  'Estrellas que giran a miles de kilómetros por segundo alrededor de algo invisible: un agujero negro de cuatro millones de soles.':
    'Stars whirling at thousands of kilometres a second around something invisible: a black hole of four million suns.',
  'El Grupo Local': 'The Local Group',
  'Andrómeda viene hacia nosotros: su halo de gas ya toca el nuestro, y en unos 4 500 millones de años chocarán.':
    'Andromeda is coming towards us: its halo of gas already touches ours, and in some 4.5 billion years they will collide.',
  'Grupo Local': 'Local Group',
  'Andrómeda': 'Andromeda',
  'Triángulo': 'Triangulum',
  'Nube Grande de Magallanes': 'Large Magellanic Cloud',
  'primer paso: en 4 500 millones de años': 'first pass: in 4.5 billion years',
  'una sola galaxia': 'a single galaxy',
  'Un billón de estrellas a dos millones y medio de años luz: lo más lejano que suele verse a simple vista.':
    'A trillion stars two and a half million light-years away: the farthest thing usually seen with the naked eye.',
  'La red cósmica': 'The cosmic web',
  'Las galaxias no están repartidas al azar: forman hilos y paredes alrededor de inmensos vacíos.':
    'Galaxies are not scattered at random: they form filaments and walls around immense voids.',
  'red cósmica': 'cosmic web',
  'cúmulo de Virgo': 'Virgo Cluster',
  'Gran Atractor': 'Great Attractor',
  'Laniakea': 'Laniakea',
  '«Cielo inmenso»: cien mil galaxias que caen hacia el Gran Atractor. La nuestra va en un borde.':
    "“Immense heaven”: a hundred thousand galaxies falling towards the Great Attractor. Ours rides on one edge.",
  'El universo observable': 'The observable universe',
  'Todo lo que podremos ver jamás. Más allá de este borde, la luz aún no ha tenido tiempo de llegar.':
    'All we will ever be able to see. Beyond this edge, light has not yet had time to reach us.',
  'nosotros': 'us',
  'fondo de microondas': 'microwave background',
  'Un grano de arena de cielo': 'A grain of sand of sky',
  'Un telescopio apunta a un trocito de cielo oscuro, como un grano de arena a un brazo de distancia: hay unas diez mil galaxias.':
    "A telescope points at a tiny patch of dark sky, like a grain of sand at arm's length: there are some ten thousand galaxies.",
  'La luz más antigua': 'The oldest light',
  'El fondo de microondas: luz que salió cuando el universo tenía 380 000 años y viajó 13 800 millones de años hasta aquí.':
    'The microwave background: light that set out when the universe was 380,000 years old and travelled 13.8 billion years to get here.',

  // The hypotheses.
  'Más allá del horizonte': 'Beyond the horizon',
  'Hipótesis: si el espacio no tiene fin, a unos 10^(10^29) metros habría una copia exacta de ti leyendo esto.':
    'Hypothesis: if space has no end, some 10^(10^29) metres away there would be an exact copy of you reading this.',
  'más allá': 'beyond',
  'nuestro universo observable': 'our observable universe',
  'una copia exacta': 'an exact copy',
  'hipótesis · la distancia a otra copia exacta de ti': 'hypothesis · the distance to another exact copy of you',
  'El multiverso': 'The multiverse',
  'Hipótesis: nuestro universo sería una burbuja entre infinitas, cada una con sus propias leyes.':
    'Hypothesis: our universe would be one bubble among infinitely many, each with its own laws.',
  'multiverso': 'multiverse',
  'nuestro universo': 'our universe',
  'hipótesis · multiverso inflacionario': 'hypothesis · inflationary multiverse',
  'El paisaje de cuerdas': 'The string landscape',
  'Hipótesis: unas 10⁵⁰⁰ maneras posibles de ser un universo. Cada valle, otras leyes; el nuestro, uno entre ellos.':
    'Hypothesis: some 10⁵⁰⁰ possible ways to be a universe. Each valley, other laws; ours, one among them.',
  'paisaje': 'landscape',
  'hipótesis · leyes posibles de la física': 'hypothesis · possible laws of physics',
  'nuestro multiverso': 'our multiverse',
  'una barrera de energía': 'an energy barrier',
  'El universo matemático': 'The mathematical universe',
  'Hipótesis: toda estructura matemática existiría como un universo. La nuestra, un dibujo más en una lámina sin fin.':
    'Hypothesis: every mathematical structure would exist as a universe. Ours, one more drawing on an endless plate.',
  'matemático': 'mathematical',
  'hipótesis · todas las estructuras matemáticas': 'hypothesis · every mathematical structure',
  'nuestro paisaje': 'our landscape',
  'atractor de Lorenz': 'Lorenz attractor',
  'conjunto de Mandelbrot': 'Mandelbrot set',
  'nudo de trébol': 'trefoil knot',
  'triángulo de Sierpinski': 'Sierpinski triangle',
  'hipercubo': 'hypercube',
  'curva del dragón': 'dragon curve',
};
