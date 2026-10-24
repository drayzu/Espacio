# Potencias · biblia visual

**Una idea:** todo está hecho de algo más pequeño. El scroll lo demuestra: cada mundo se construye con las partículas del anterior.

## Principios
0. **Un viaje muy, muy largo.** De lo más pequeño que tiene sentido nombrar a lo más grande que se ha imaginado, incluidas estructuras hipotéticas que casi nadie ha pensado. Decenas de mundos, mucho scroll, y cada tramo con algo que ver.
1. **Lo visual va primero.** Cada mundo tiene un nombre, **una frase** y su escala. Si algo necesita un párrafo, no entra (para eso está la lámina).
2. **Inmersión, no diapositivas.** El scroll mueve una coreografía: escala, cámara y animación juntas. Cada mundo tiene **llegada → momento → salida**. Un momento es algo que solo pasa ahí: orbitar el átomo, volar a lo largo de la hélice, ver el ADN enrollarse.
3. **Lo grande se arma con lo pequeño, a la vista.** Las transiciones no son fundidos: las piezas del mundo anterior se mueven a su lugar en el siguiente.
4. **Nada parpadea sin razón física.** El electrón tiembla; las estrellas no titilan solas. Los puntos de menos de un píxel se atenúan, nunca saltan.
5. **Clean.** Fondo negro, poco HUD, una sola tipografía protagonista y un solo acento.
6. **La frase se dibuja.** Si la frase de un mundo afirma algo que se puede ver, se ve, en lenguaje de lámina: la canica en el centro de una cancha de fútbol (el átomo), los planetas en fila entre la Tierra y la Luna, la luz del Sol cruzando el Sistema Solar y la nube de Oort, la luz de Próxima llegando, el agua en las nervaduras, los cuatro enlaces del carbono, el aliento de los estomas, el choque por venir con Andrómeda. Líneas finas y un acento: se lee como ilustración, no como objeto real.
7. **Momentos con nombre.** Un instante que merece su propia frase (nadie ha visto un quark solo, una célula se divide, la Estación Espacial, la salida de la Tierra, Saturno, el punto azul pálido, Andrómeda, un año galáctico, Sagitario A*, Laniakea, un grano de arena de cielo, la luz más antigua) lleva un subtítulo que reemplaza el del mundo mientras dura. Pocos, y solo donde la cámara hace algo que no pasa en otro lado.
8. **Nunca un cuadro vacío por accidente.** Entre dos mundos siempre queda algo a la vista (un punto de luz, una red a escala intermedia, un anillo de medida). El vacío solo cuando es el tema, y aun así medido.

## Lenguaje
| Capa | Qué es | Dónde |
|---|---|---|
| **Partículas de luz** | La materia de cada mundo, con tamaño físico | En todos |
| **Tinta viva** | El medio entre la materia (shader procedural), con un dial por mundo | Alto en lo fluido (citoplasma, nebulosas, atmósfera, red cósmica); casi apagado donde manda la estructura (átomo, ADN, galaxia) |
| **Lámina científica** | Contornos finos y etiquetas que se dibujan solas | Capa opcional encima (tecla i) y lenguaje de lo especulativo (cuerdas, multiverso) |

## Color
Fondo `#000`. Interfaz: tinta `#ece7db`, tenue al 50 %, acento `#ff5b2e` (solo marcador y números de lámina).

| Territorio | Paleta |
|---|---|
| Especulativo (Planck, cuerdas, multiverso) | Lámina: `#ece7db` + acento `#ff5b2e` |
| Cuántico (quarks, átomo) | `#ff4fb0` `#4f8cff` `#33e6d9` `#ad6bff`, núcleo `#e9dcff` |
| Molecular (ADN) | CPK adaptado: C `#d9ccff` · O `#ff4a4a` · N `#4f6dff` · P `#ffa040` |
| Vida (nucleosomas → célula) | histona `#ffb27a` · ADN `#cfd6ff` · cromatina `#5ab8ff` `#7fe0d0` · membrana `#ffa24a` · núcleo `#47e6c8` · mitocondria `#ff6a4d` |
| Cósmico | azules y dorados: estrellas por su tipo, galaxias blanco azuladas con núcleo dorado, red cósmica azul plateada con cúmulos dorados, el universo enrojeciendo con la distancia, el fondo de microondas naranja y azul |

Cada mundo hereda un acento del anterior: el carbono es lila en el átomo y sigue lila en el ADN.

## Tipografía
- **Instrument Serif:** nombres de mundos (cursiva) y el exponente grande.
- **Geist:** interfaz.
- **Geist Mono:** cifras, unidades y etiquetas.

## Movimiento y cámara
- Zoom **lineal en el exponente** (velocidad constante en escala logarítmica), con curvas *in-out* en los extremos de cada tramo.
- Cada mundo tiene **su ángulo preferido**; entre mundos la cámara gira con suavidad (slerp).
- Herramientas de cámara: órbita, recorrido dentro del mundo, alabeo (roll) y *dolly zoom* (cambiar el campo de visión manteniendo la escala). Las vueltas completas se cierran: la cámara termina cada mundo en su ángulo.
- Desenfoque radial proporcional a la velocidad del zoom; polvo de escala que fluye con el zoom.
- El mouse inclina la vista unos grados (paralaje), nunca más.

## Sonido
- Siempre opcional y apagado al empezar (botón **Sonido** o tecla **S**). Generado en el navegador, sin archivos.
- La escala se oye: el acorde es agudo y vidrioso entre los quarks y grave entre las galaxias; cada mundo tiene su acorde y las voces se deslizan hacia él.
- La velocidad se oye como viento; la llegada a un mundo, como una campana suave.
- Ambiente, no música: nada de ritmo ni melodía que compita con la imagen.

## Los extremos: cuando la escala se rompe
Más allá del universo observable y bajo la longitud de Planck, lo medible da paso a lo hipotético. Ahí:
- el estilo pasa a **lámina** (líneas finas, anotaciones): se ve que es hipótesis;
- la **escala misma se vuelve el espectáculo**. Por ejemplo, tu copia idéntica más cercana estaría, según la estimación de Tegmark, a unos 10^(10^29) m. El marcador pasa a "potencia de potencia" y los números se vuelven el efecto.
- el final sube por las hipótesis como por una escalera: más allá del horizonte (10^(10^29) m), el multiverso (∞), el paisaje de cuerdas (10⁵⁰⁰ leyes posibles) y el universo matemático (∞^∞), donde todo resulta ser un dibujo en una lámina sin fin: lo que la página fue desde el principio.
- en el desierto (entre la unificación y el LHC) no hay nada conocido: lo único que pasa son las potencias de diez, anillos de lámina que cruzan como un túnel.

## Técnica (reglas del motor)
- Todo es función del **progreso del scroll** → pistas de la línea de tiempo (escala, cámara, animaciones). Reversible siempre.
- Mundos anidados en su posición física real. Las matrices se calculan en doble precisión **relativas al mundo pivote**, así que el rango de 60 órdenes nunca llega crudo a la GPU.
- Presupuesto: 60 fps en escritorio, con solo 2–3 mundos visibles a la vez.
