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
  'De un quark al borde de todo.': 'From a quark to the edge of everything.',
  'Desliza para empezar': 'Scroll to begin',
  // ---- The opening (GUION.md 1–4).
  'Aquí': 'Here',
  'Estás aquí.': 'You are here.',
  'tú': 'you',
  'Hecho de algo': 'Made of something',
  'Todo lo que ves, y tú también, está hecho de algo más pequeño.': 'Everything you see, and you too, is made of something smaller.',
  'Más adentro': 'Further in',
  'Y eso, de algo más pequeño todavía. Vamos a bajar hasta donde ya no se puede más.': 'And that, of something smaller still. Let’s go down as far as it goes.',
  'El fondo': 'The bottom',
  'Aquí el espacio deja de ser liso.': 'Here, space itself stops being smooth.',
  'Lámina': 'Plate',
  'Sonido': 'Sound',
  'Sonido · pronto': 'Sound · soon',
  'Reproducir': 'Play',
  'Escala': 'Scale',
  // ---- The pauses (GUION.md 20, 23, 47).
  'A mitad de camino': 'Halfway',
  'Entre lo más pequeño y el borde de lo que vemos, la mitad del camino cae aquí: un décimo de milímetro. Ese tamaño tenías cuando eras una sola célula.':
    'Between the smallest thing and the edge of what we see, the halfway point falls here: a tenth of a millimetre. That was your size when you were a single cell.',
  'la mitad': 'halfway',
  'entre la longitud de Planck (1,6 × 10⁻³⁵ m) y el universo observable (8,8 × 10²⁶ m), la media geométrica es 1,2 × 10⁻⁴ m':
    'between the Planck length (1.6 × 10⁻³⁵ m) and the observable universe (8.8 × 10²⁶ m), the geometric mean is 1.2 × 10⁻⁴ m',
  'un óvulo humano mide unos 0,1 mm': 'a human egg cell is about 0.1 mm across',
  'Tu tamaño': 'Your size',
  'Volviste a tu tamaño. Aquí empezó la caída.': 'Back to your size. This is where the fall began.',
  'En el centro': 'At the centre',
  'Y en el centro de todo esto estás tú. No porque seas especial: el centro de lo que se ve siempre es quien mira.':
    'And at the centre of all this, you. Not because you are special: the centre of what can be seen is always whoever is looking.',
  // ---- The coda (GUION.md 51–54) and the card to Tiempo.
  '¿Dónde estamos?': 'Where are we?',
  '¿Dónde estamos? En uno de esos dibujos, a mitad de camino entre lo más pequeño y lo más grande.':
    'Where are we? In one of those drawings, halfway between the smallest and the largest.',
  'Hacia atrás': 'Backwards',
  'Pero no siempre fue así de grande. Míralo hacia atrás.': 'But it was not always this big. Watch it backwards.',
  'el universo': 'the universe',
  'Todo cabía aquí': 'It all fitted here',
  'Cada átomo, cada estrella, cada galaxia que viste, y tú, cupieron una vez en un punto más pequeño que un protón.':
    'Every atom, every star, every galaxy you saw, and you, once fitted in a point smaller than a proton.',
  'antes de la inflación, la región que hoy es el universo observable medía quizá 10⁻²⁶ m o menos; las estimaciones varían':
    'before inflation, the region that is now the observable universe was perhaps 10⁻²⁶ m across or less; estimates vary',
  '¿Cuándo?': 'When?',
  '¿Y antes de eso?': 'And before that?',
  'Continúa en': 'Continues in',
  'De antes del Big Bang a la última luz.': 'From before the Big Bang to the last light.',
  'Entrar': 'Enter',
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
  'Nadie lo ha visto: es una hipótesis. A esta escala el espacio burbujea, y quizá todo sean cuerdas que vibran.':
    'No one has seen it: it is a hypothesis. At this scale space bubbles, and perhaps everything is vibrating strings.',
  'Planck': 'Planck',
  'La gran unificación': 'Grand unification',
  'Un poco más arriba, quizá, tres de las fuerzas de la naturaleza son una sola.':
    'A little higher, perhaps, three of the forces of nature are one.',
  'unificación': 'unification',
  'una sola fuerza': 'a single force',
  'fuerte': 'strong',
  'débil': 'weak',
  'electromagnética': 'electromagnetic',
  'El desierto': 'The desert',
  'Ahora, catorce potencias de diez de las que no sabemos nada. Solo pasan los números.':
    'Now, fourteen powers of ten we know nothing about. Only the numbers go by.',
  'desierto': 'desert',
  'El límite de lo visto': 'The edge of the seen',
  'Aquí termina lo que hemos visto. Más abajo, todo es suposición; de aquí hacia arriba, todo es real.':
    'Here ends what we have seen. Below, everything is guesswork; from here up, everything is real.',
  'LHC': 'LHC',
  'choque': 'collision',
  'detector de trazas': 'tracker',
  'calorímetro': 'calorimeter',
  'cámaras de muones': 'muon chambers',
  'haz de protones': 'proton beam',

  // Proton, nucleus, the atom's emptiness, the atom.
  'Protón': 'Proton',
  'Tres quarks atados por la fuerza más intensa que conocemos. En tu cuerpo hay más de estos que estrellas en todo lo que se ve.':
    'Three quarks bound by the strongest force we know. There are more of these in your body than stars in all we can see.',
  'protón': 'proton',
  'quark up': 'up quark',
  'quark down': 'down quark',
  'gluones': 'gluons',
  'Nadie ha visto un quark solo': 'No one has ever seen a lone quark',
  'Si tiras de uno, la cuerda no se afloja: se rompe, y de su energía nacen dos quarks nuevos. Nunca quedan solos.':
    'Pull one and the string does not slacken: it snaps, and from its energy two new quarks are born. They are never alone.',
  'Núcleo de carbono': 'Carbon nucleus',
  'Seis protones y seis neutrones. Casi todo lo que pesas está en núcleos como este.':
    'Six protons and six neutrons. Almost everything you weigh is in nuclei like this one.',
  'nuestro protón': 'our proton',
  'neutrón': 'neutron',
  'núcleo': 'nucleus',
  'El vacío del átomo': "The atom's emptiness",
  'Si el núcleo fuera una canica, el átomo sería un estadio. Tú también eres casi todo vacío.':
    'If the nucleus were a marble, the atom would be a stadium. You, too, are almost all emptiness.',
  'vacío': 'emptiness',
  'la canica: el núcleo': 'the marble: the nucleus',
  'el estadio: el átomo': 'the stadium: the atom',
  'Un átomo de carbono': 'A carbon atom',
  'Sigue a este. Con sus cuatro brazos se agarra a otros átomos, y así se arma todo lo vivo.':
    'Follow this one. With its four arms it holds on to other atoms, and that is how everything alive is built.',
  'átomo': 'atom',
  'orbital sp³': 'sp³ orbital',
  'nube de electrones': 'electron cloud',
  '109,5°': '109.5°',
  'un vecino: 1,54 Å': 'a neighbour: 1.54 Å',

  // DNA to the cell.
  'Cada punto de luz es un átomo; el que seguías es uno de ellos. Cada célula tuya guarda una escalera como esta.':
    'Every point of light is an atom; the one you were following is one of them. Every cell of yours keeps a ladder like this.',
  'ADN': 'DNA',
  'nuestro carbono': 'our carbon',
  'esqueleto de fosfato': 'phosphate backbone',
  'par de bases': 'base pair',
  'Nucleosomas': 'Nucleosomes',
  'En cada una de tus células hay dos metros de esto, enrollado como hilo en carretes.':
    'In each of your cells there are two metres of this, wound like thread on spools.',
  'nucleosomas': 'nucleosomes',
  'nuestro tramo de ADN': 'our stretch of DNA',
  'histonas': 'histones',
  'ADN enrollado': 'wound DNA',
  'Cromatina': 'Chromatin',
  'El mismo hilo, plegado sobre sí mismo una y otra vez.':
    'The same thread, folded over on itself again and again.',
  'cromatina': 'chromatin',
  'nuestra fibra': 'our fibre',
  'envoltura nuclear': 'nuclear envelope',
  'Una célula': 'A cell',
  'Cien billones de átomos que trabajan juntos. Y están vivos.':
    'A hundred trillion atoms working together. And they are alive.',
  'célula': 'cell',
  'nucléolo': 'nucleolus',
  'mitocondria': 'mitochondrion',
  'aparato de Golgi': 'Golgi apparatus',
  'retículo endoplasmático': 'endoplasmic reticulum',
  'membrana': 'membrane',
  'Una célula se divide': 'A cell divides',
  'Así nació cada célula de esta hoja, y cada una de las tuyas: de otra que se partió en dos.':
    'This is how every cell in this leaf was born, and every one of yours: from another that split in two.',

  // Tissue, leaf, tree, valley.
  'Una hoja respira': 'A leaf breathes',
  'Por estos poros respira la hoja. El carbono que seguías entró por aquí, en el aire. Quizá lo exhalaste tú.':
    'Through these pores the leaf breathes. The carbon you were following came in here, in the air. Perhaps you breathed it out.',
  'tejido': 'tissue',
  'nuestra célula': 'our cell',
  'estoma': 'stoma',
  'célula epidérmica': 'epidermal cell',
  'Una hoja': 'A leaf',
  'Sus nervaduras llevan agua a millones de células, como tus venas a las tuyas.':
    'Its veins carry water to millions of cells, as yours do to yours.',
  'hoja': 'leaf',
  'nuestro tejido': 'our tissue',
  'nervadura central': 'midrib',
  'nervadura secundaria': 'secondary vein',
  'pecíolo': 'petiole',
  'Un árbol': 'A tree',
  'Once mil hojas, y en cada una, millones de células.':
    'Eleven thousand leaves, and in each one, millions of cells.',
  'árbol': 'tree',
  'nuestra hoja': 'our leaf',
  'tronco': 'trunk',
  'rama': 'branch',
  'Un valle': 'A valley',
  'Un valle en el sur de Chile. Millones de árboles, y bajo cada uno, raíces, hojas y células.':
    'A valley in the south of Chile. Millions of trees, and in each one, roots, leaves and cells.',
  'valle': 'valley',
  'nuestro árbol': 'our tree',
  'lago': 'lake',
  'río': 'river',
  'cordillera': 'mountain range',

  // Earth, Moon, Solar System, Voyager.
  'La Tierra': 'The Earth',
  'Todos los que has conocido están aquí. Y todos los que no.':
    "Everyone you have ever known is here. And everyone you haven't.",
  'nuestro valle': 'our valley',
  'los Andes': 'the Andes',
  'océano Pacífico': 'Pacific Ocean',
  'Estación Espacial': 'Space Station',
  'La Estación Espacial': 'The Space Station',
  'Lo más lejos de la Tierra que vive alguien hoy: a cuatrocientos kilómetros.':
    'The farthest from Earth that anyone lives today: four hundred kilometres up.',
  'La Tierra y la Luna': 'The Earth and the Moon',
  'Entre las dos cabrían todos los demás planetas, uno junto a otro.':
    'All the other planets would fit between the two, side by side.',
  'Luna': 'Moon',
  'la Tierra': 'the Earth',
  'la Luna': 'the Moon',
  'La salida de la Tierra': 'Earthrise',
  'Nochebuena de 1968: por primera vez, alguien vio la Tierra asomar sobre el horizonte de otro mundo.':
    "Christmas Eve, 1968: for the first time, someone saw the Earth rise over another world's horizon.",
  'El Sistema Solar': 'The Solar System',
  'La luz del Sol tarda ocho minutos en llegarte. A Neptuno, más de cuatro horas.':
    'Sunlight takes eight minutes to reach you. To reach Neptune, more than four hours.',
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
  'Sus anillos cubrirían tres cuartos del camino a la Luna, y son tan delgados que de canto desaparecen.':
    'Its rings would cover three quarters of the way to the Moon, and are so thin that edge on they vanish.',
  'Voyager 1': 'Voyager 1',
  'Voyager 2': 'Voyager 2',
  'Voyager': 'Voyager',
  'Lo más lejos que ha llegado algo nuestro. Salió hace casi cincuenta años y sigue.':
    'The farthest anything of ours has gone. It left almost fifty years ago and is still going.',
  'heliopausa': 'heliopause',
  'Un punto azul pálido': 'A pale blue dot',
  'Así vio la Tierra la Voyager, desde seis mil millones de kilómetros. Todo lo que conoces cabe en un píxel.':
    'This is how Voyager saw the Earth, from six billion kilometres. Everything you know fits in a pixel.',

  // Oort, neighbours, Radcliffe.
  'La nube de Oort': 'The Oort cloud',
  'Un billón de cometas helados. Hasta aquí llega el Sol.':
    'A trillion icy comets. This is as far as the Sun reaches.',
  'Oort': 'Oort',
  'heliosfera': 'heliosphere',
  'nube de Oort interior': 'inner Oort cloud',
  'nube de Oort exterior': 'outer Oort cloud',
  'Las estrellas vecinas': 'The neighbouring stars',
  'Treinta estrellas cerca de nosotros, y casi ninguna se ve a simple vista.':
    'Thirty stars near us, and hardly any can be seen with the naked eye.',
  'vecinas': 'neighbours',
  'La luz de Próxima': "Proxima's light",
  'Esa luz salió hace más de cuatro años. Ves la estrella como era entonces.':
    'That light left more than four years ago. You see the star as it was then.',
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
  'Una ola de nubes pasa junto al Sol, y en su cresta nacen estrellas. Nadie la vio hasta 2020.':
    'A wave of clouds passes beside the Sun, and on its crest stars are born. No one saw it until 2020.',
  'Orión': 'Orion',
  'nebulosa de Orión': 'Orion Nebula',
  'lazo de Barnard': "Barnard's Loop",
  'Pléyades': 'Pleiades',
  'ola de Radcliffe': 'Radcliffe Wave',

  // Galaxy, Local Group, cosmic web, universe.
  'La Vía Láctea': 'The Milky Way',
  'Doscientos mil millones de soles. El nuestro es uno.': 'Two hundred billion suns. Ours is one.',
  'Sagitario A*': 'Sagittarius A*',
  'barra central': 'central bar',
  'brazo espiral': 'spiral arm',
  'cúmulo estelar nuclear': 'nuclear star cluster',
  'Sagitario A*: 4 millones de soles': 'Sagittarius A*: 4 million suns',
  'S2: una vuelta cada 16 años': 'S2: once round every 16 years',
  'Un año galáctico': 'A galactic year',
  'La última vez que el Sol pasó por aquí, aparecían los primeros dinosaurios.':
    'The last time the Sun passed this way, the first dinosaurs were appearing.',
  'Estrellas que giran a toda velocidad alrededor de algo que no se ve: un agujero negro de cuatro millones de soles.':
    'Stars whirling at full speed around something that cannot be seen: a black hole of four million suns.',
  'El Grupo Local': 'The Local Group',
  'Andrómeda viene hacia nosotros. Quizá algún día las dos galaxias sean una.':
    'Andromeda is coming towards us. Perhaps one day the two galaxies will be one.',
  'Grupo Local': 'Local Group',
  'Andrómeda': 'Andromeda',
  'Triángulo': 'Triangulum',
  'Nube Grande de Magallanes': 'Large Magellanic Cloud',
  'primer paso: en 4 500 millones de años': 'first pass: in 4.5 billion years',
  'una sola galaxia': 'a single galaxy',
  'Un billón de estrellas: lo más lejos que puedes ver sin telescopio. Su luz salió cuando todavía no había nadie como tú.':
    'A trillion stars: the farthest you can see without a telescope. Its light set out before there was anyone like you.',
  'La red cósmica': 'The cosmic web',
  'Las galaxias no están repartidas al azar: forman hilos alrededor de vacíos inmensos.':
    'Galaxies are not scattered at random: they form threads around immense voids.',
  'red cósmica': 'cosmic web',
  'cúmulo de Virgo': 'Virgo Cluster',
  'Gran Atractor': 'Great Attractor',
  'Laniakea': 'Laniakea',
  '«Cielo inmenso»: cien mil galaxias que caen juntas. La nuestra va en un borde.':
    '“Immense heaven”: a hundred thousand galaxies falling together. Ours rides on one edge.',
  'El universo observable': 'The observable universe',
  'Todo lo que podrás ver jamás. Más allá, la luz no ha tenido tiempo de llegar.':
    'All you will ever be able to see. Beyond it, light has not had time to arrive.',
  'nosotros': 'us',
  'fondo de microondas': 'microwave background',
  'Un grano de arena de cielo': 'A grain of sand of sky',
  'Un trocito de cielo oscuro, del tamaño de un grano de arena a un brazo de distancia: diez mil galaxias.':
    "A patch of dark sky the size of a grain of sand at arm's length: ten thousand galaxies.",
  'La luz más antigua': 'The oldest light',
  'Luz que salió cuando el universo tenía 380 000 años, y que te llega ahora.':
    'Light that set out when the universe was 380,000 years old, and reaches you now.',

  // The hypotheses.
  'Más allá del horizonte': 'Beyond the horizon',
  'Si el espacio no se acaba, muy lejos de aquí habría una copia exacta de ti.':
    'If space never ends, very far from here there would be an exact copy of you.',
  'más allá': 'beyond',
  'nuestro universo observable': 'our observable universe',
  'una copia exacta': 'an exact copy',
  'hipótesis · la distancia a otra copia exacta de ti': 'hypothesis · the distance to another exact copy of you',
  'El multiverso': 'The multiverse',
  'Y nuestro universo sería una burbuja entre infinitas, cada una con sus propias leyes.':
    'And our universe would be one bubble among infinitely many, each with its own laws.',
  'multiverso': 'multiverse',
  'nuestro universo': 'our universe',
  'hipótesis · multiverso inflacionario': 'hypothesis · inflationary multiverse',
  'El paisaje de cuerdas': 'The string landscape',
  'Quizá hay unas 10⁵⁰⁰ maneras de ser un universo. Cada valle, otras leyes; el nuestro es uno de ellos.':
    'Perhaps there are some 10⁵⁰⁰ ways to be a universe. Each valley, other laws; ours is one of them.',
  'paisaje': 'landscape',
  'hipótesis · leyes posibles de la física': 'hypothesis · possible laws of physics',
  'nuestro multiverso': 'our multiverse',
  'una barrera de energía': 'an energy barrier',
  'El universo matemático': 'The mathematical universe',
  'Quizá todo lo que se puede describir existe. El nuestro sería un dibujo más en una lámina sin fin.':
    'Perhaps everything that can be described exists. Ours would be one more drawing on an endless plate.',
  'matemático': 'mathematical',
  'hipótesis · todas las estructuras matemáticas': 'hypothesis · every mathematical structure',
  'nuestro paisaje': 'our landscape',
  'atractor de Lorenz': 'Lorenz attractor',
  'conjunto de Mandelbrot': 'Mandelbrot set',
  'nudo de trébol': 'trefoil knot',
  'triángulo de Sierpinski': 'Sierpinski triangle',
  'hipercubo': 'hypercube',
  'curva del dragón': 'dragon curve',

  // The plate's data (ficha), shown with the plate on.
  'el LHC distingue hasta unos 10⁻¹⁹ m': 'the LHC resolves down to about 10⁻¹⁹ m',
  'unos 2 × 10²⁸ protones en un cuerpo de 70 kg': 'some 2 × 10²⁸ protons in a 70 kg body',
  'de 10²² a 10²⁴ estrellas en el universo observable': '10²² to 10²⁴ stars in the observable universe',
  'más del 99,9 % de la masa de un átomo está en su núcleo': "over 99.9% of an atom's mass is in its nucleus",
  'unos 10¹⁴ átomos en una célula': 'some 10¹⁴ atoms in a cell',
  'unos 8 200 millones de personas': 'some 8.2 billion people',
  'la Estación Espacial: a 400 km, una vuelta cada hora y media': 'the Space Station: 400 km up, once round every hour and a half',
  'la luz: 8 min hasta la Tierra, 4 h hasta Neptuno': 'light: 8 min to the Earth, 4 h to Neptune',
  'los anillos de Saturno: 280 000 km de punta a punta, unas decenas de metros de grosor': "Saturn's rings: 280,000 km across, a few tens of metres thick",
  'de la Tierra a la Luna: 384 000 km': 'Earth to Moon: 384,000 km',
  'lanzada en 1977; salió del viento solar en 2012': 'launched in 1977; left the solar wind in 2012',
  'hoy, a casi un día luz': 'now almost a light-day away',
  'la luz del Sol tarda un año y medio en atravesarla': 'sunlight takes a year and a half to cross it',
  'unas treinta estrellas a menos de doce años luz, casi todas enanas rojas': 'some thirty stars within twelve light-years, mostly red dwarfs',
  'Próxima Centauri: a 4,24 años luz': 'Proxima Centauri: 4.24 light-years away',
  '9 000 años luz de largo; en su cresta, Orión': '9,000 light-years long; Orion on its crest',
  'Alves y otros, 2020': 'Alves et al., 2020',
  'el Sol tarda 230 millones de años en dar una vuelta': 'the Sun takes 230 million years to go round once',
  'el halo de gas de Andrómeda ya toca el nuestro': "Andromeda's gas halo already touches ours",
  'chocar en 10 000 millones de años: ≈ 50 % (Sawala y otros, 2025)': 'a collision within 10 billion years: ≈ 50% (Sawala et al., 2025)',
  'Andrómeda, a 2,5 millones de años luz; Homo sapiens, unos 300 000 años': 'Andromeda, 2.5 million light-years away; Homo sapiens, some 300,000 years old',
  'radio: 46 000 millones de años luz': 'radius: 46 billion light-years',
  'el fondo de microondas: luz de cuando el universo tenía 380 000 años': 'the microwave background: light from when the universe was 380,000 years old',
  'Tegmark (2003): la copia más cercana, a unos 10^(10^29) m': 'Tegmark (2003): the nearest copy, some 10^(10^29) m away',
  'Bousso y Polchinski, 2000; Susskind, 2003': 'Bousso and Polchinski, 2000; Susskind, 2003',
  'Tegmark, la hipótesis del universo matemático (2007)': 'Tegmark, the mathematical universe hypothesis (2007)',
};
