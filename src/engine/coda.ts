import type { Timeline } from './timeline';

/**
 * The coda (GUION.md 51–54, from drayzu.github.io/RELEVOS.md): it answers the journey's question
 * and hands on to Tiempo.
 *
 * Out of the mathematical plate the camera flies back down through the hypotheses into our own
 * sphere (the other regions fade). Then the expansion runs backwards: the camera stays, the universe
 * shrinks towards us (track `encoge`, in orders of magnitude; the page scales the worlds and the
 * readout follows the universe's own size) to a white-hot point, everything there is once smaller
 * than a proton. The point turns Tiempo's blue, and the card says where the journey goes on
 * (track `relevo`).
 *
 * `universo`: the observable universe's scale exponent (its home).
 */
export function codaChoreo(tl: Timeline, universo: number) {
  // 51 · Where are we? Back to our own sphere.
  tl.caption(6.4, '¿Dónde estamos?', '¿Dónde estamos? En uno de esos dibujos, a mitad de camino entre lo más pequeño y lo más grande.');
  tl.to(3.2, { e: universo + 2, yaw: 0.6, pitch: 0.3, roll: 0, fov: 46 });
  tl.with(1.8, { 'masAlla.keep': -1 });
  tl.to(1.8, { e: universo + 0.35, yaw: 1.0, pitch: 0.45 });
  tl.to(1.4, { yaw: 1.12, e: universo + 0.36 });

  // 52 · Backwards: the universe shrinks to a point, and the readout races down to before inflation.
  tl.caption(5.6, 'Hacia atrás', 'Pero no siempre fue así de grande. Míralo hacia atrás.', 'el universo');
  tl.to(1.2, { yaw: 1.2 });
  tl.to(2.0, { encoge: 2.4, yaw: 1.3 });
  tl.with(1.4, { 'universo.keep': -1, tu: 1, tono: 1 });
  tl.to(2.4, { encoge: ENCOGE });

  // 53 · All of it fitted here.
  tl.caption(
    5.6,
    'Todo cabía aquí',
    'Cada átomo, cada estrella, cada galaxia que viste, y tú, cupieron una vez en un punto más pequeño que un protón.',
    'el universo',
    ['antes de la inflación, la región que hoy es el universo observable medía quizá 10⁻²⁶ m o menos; las estimaciones varían'],
  );
  tl.to(3.0, { tono: 2 });
  tl.wait(2.6);

  // 54 · When? Tiempo's question, and the card.
  tl.caption(4.4, '¿Cuándo?', '¿Y antes de eso?');
  tl.wait(1.0);
  tl.to(1.6, { relevo: 1 });
  tl.wait(1.8);
}

/** The universe's diameter today (8.8 × 10²⁶ m), as a power of ten. */
export const DIAMETRO = Math.log10(8.8e26);
/** How far the coda shrinks it: down to about 10⁻²⁶ m, before inflation. */
const ENCOGE = DIAMETRO + 26;
