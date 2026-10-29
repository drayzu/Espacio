import * as THREE from 'three';
import { smoothstep } from '../lib/math';
import type { WorldModule } from '../engine/cadena';
import { lineSet, linesFromData, type LinesData } from './lineas';
import { paso } from './paso';

/**
 * Between the nucleus and the electron cloud: an atom is almost entirely empty. A long, dark pull
 * back with only the dust streaming, until the electrons appear far out.
 * Its sentence drawn, plate style: if the nucleus were a marble, the atom would be a stadium. So
 * the nucleus sits on the centre spot of a football pitch, drawn to the atom's real size, which
 * reveals itself as the camera pulls back (centre circle, halfway line, the boxes, the pitch,
 * the stands) and fades as the electrons fill it.
 */

const UNIT = -11.3;
/** Units per metre of the stadium: the stands, about 250 m long, span most of the atom. */
const M = 45 / 250;
/**
 * The stadium's orientation in this world: seen almost from above, as from an airship, its long
 * axis across the screen (solved in the page for the camera halfway through the pull back).
 */
const FACING = new THREE.Quaternion(-0.5455, -0.3306, -0.2302, 0.7349);
/** The stands' far edge, in units: the drawing's reach. */
const REACH = Math.hypot(52.5 + 68, 34 + 68) * M;

export function vacio(): WorldModule {
  const base = paso({
    id: 'vacio',
    territory: 'atómico',
    name: 'El vacío del átomo',
    fact: 'Si el núcleo fuera una canica, el átomo sería un estadio. Tú también eres casi todo vacío.',
    label: 'vacío',
    unitExp: UNIT,
    anchor: new THREE.Vector3(),
    tint: 0x9f8cff,
    // The sentence stays while the stadium draws itself.
    nameSpan: 1.62,
  });
  return {
    spec: {
      ...base,
      // On until the electrons have filled the stadium.
      fade: [-1.2, -0.7, 1.9, 2.3],
      notes: [
        { at: [0, 0, 0], text: 'la canica: el núcleo', e: [-12.6, -11.2] },
        { at: new THREE.Vector3(52.5 * M, 34 * M, 0).applyQuaternion(FACING).toArray(), text: 'el estadio: el átomo', e: [-10.3, -9.62] },
      ],
      noteSpan: 3,
      generate() {
        const ink = lineSet();
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        // Drawn outward from the centre spot as the camera pulls back: each part as it comes
        // to fit the screen (the reveal follows the scale, see update).
        const when = (p: THREE.Vector3) => Math.min(1, p.length() / REACH);
        const line = (x0: number, y0: number, x1: number, y1: number, l = 0.5) => {
          // Long lines in pieces, so each part appears as the reveal reaches it.
          const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2));
          for (let k = 0; k < n; k++) {
            a.set(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, 0).multiplyScalar(M).applyQuaternion(FACING);
            b.set(x0 + ((x1 - x0) * (k + 1)) / n, y0 + ((y1 - y0) * (k + 1)) / n, 0).multiplyScalar(M).applyQuaternion(FACING);
            ink.segment(a, b, l, when(a), when(b));
          }
        };
        const arc = (cx: number, cy: number, r: number, t0: number, t1: number, l = 0.5) => {
          const n = Math.max(12, Math.ceil((r * Math.abs(t1 - t0)) / 1.5));
          for (let k = 0; k < n; k++) {
            const u0 = t0 + ((t1 - t0) * k) / n;
            const u1 = t0 + ((t1 - t0) * (k + 1)) / n;
            line(cx + Math.cos(u0) * r, cy + Math.sin(u0) * r, cx + Math.cos(u1) * r, cy + Math.sin(u1) * r, l);
          }
        };
        const rect = (x0: number, y0: number, x1: number, y1: number, l = 0.5) => {
          line(x0, y0, x1, y0, l);
          line(x1, y0, x1, y1, l);
          line(x1, y1, x0, y1, l);
          line(x0, y1, x0, y0, l);
        };
        // The pitch, 105 by 68 m, in metres around the centre spot.
        const L = 52.5;
        const W = 34;
        arc(0, 0, 0.3, 0, Math.PI * 2, 0.7);
        arc(0, 0, 9.15, 0, Math.PI * 2);
        line(0, -W, 0, W);
        rect(-L, -W, L, W);
        for (const s of [-1, 1]) {
          rect(s * L, -20.16, s * (L - 16.5), 20.16);
          rect(s * L, -9.16, s * (L - 5.5), 9.16);
          arc(s * (L - 11), 0, 0.25, 0, Math.PI * 2, 0.7);
          // The arc of the box: the part of the circle round the spot outside the box.
          const t = Math.acos(5.5 / 9.15);
          arc(s * (L - 11), 0, 9.15, s > 0 ? Math.PI - t : -t, s > 0 ? Math.PI + t : t);
          // The goal.
          rect(s * L, -3.66, s * (L + 2), 3.66, 0.35);
          for (const c of [-1, 1]) arc(s * L, c * W, 1, s > 0 ? (c > 0 ? Math.PI : Math.PI / 2) : c > 0 ? -Math.PI / 2 : 0, s > 0 ? (c > 0 ? Math.PI * 1.5 : Math.PI) : c > 0 ? 0 : Math.PI / 2, 0.35);
        }
        // The stands: rings of tiers round the pitch, a rounded rectangle growing outward.
        for (let k = 0; k < 9; k++) {
          const gx = L + 8 + k * 7.5;
          const gy = W + 8 + k * 7.5;
          const rr = 14 + k * 7.5;
          const l = k === 0 || k === 8 ? 0.4 : 0.18;
          line(-gx + rr, -gy, gx - rr, -gy, l);
          line(-gx + rr, gy, gx - rr, gy, l);
          line(-gx, -gy + rr, -gx, gy - rr, l);
          line(gx, -gy + rr, gx, gy - rr, l);
          arc(gx - rr, gy - rr, rr, 0, Math.PI / 2, l);
          arc(-gx + rr, gy - rr, rr, Math.PI / 2, Math.PI, l);
          arc(-gx + rr, -gy + rr, rr, Math.PI, Math.PI * 1.5, l);
          arc(gx - rr, -gy + rr, rr, Math.PI * 1.5, Math.PI * 2, l);
        }
        return { ink: ink.data() };
      },
      assemble(data) {
        const ink = linesFromData(data.ink as LinesData, 0xece7db);
        return {
          object: ink.mesh,
          clouds: [],
          update(f) {
            // Out to a little beyond the half-height of the screen.
            ink.uniforms.uReveal.value = (0.62 * Math.pow(10, f.e - UNIT)) / REACH;
            // Gone once the electrons have filled the stadium.
            ink.uniforms.uAlpha.value = f.alpha * (1 - smoothstep(-9.68, -9.53, f.e));
          },
        };
      },
    },
    choreo(tl, w) {
      tl.label('vacio');
      tl.to(3.6, { e: w.home + 0.2, yaw: 0, pitch: 0.05, fov: 38 });
    },
  };
}
