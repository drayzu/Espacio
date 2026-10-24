import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { perlin3 } from '../lib/puntos';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { lineSet, linesFromData, type LinesData } from './lineas';

/**
 * The string landscape (hypothesis), drawn in the plate's language. String theory seems to allow
 * an enormous number of stable ways to be, about 10⁵⁰⁰ by a common estimate: each a valley in a
 * landscape of energy, each a set of laws (other particles, other forces, other constants). The
 * inflationary multiverse would fill some valleys with bubbles of universe; most stay empty.
 *
 * A relief drawn with contour lines, plate style. Pulling back from the multiverse's foam, the
 * foam turns out to be a point of light at the bottom of one valley; the camera tilts until the
 * landscape runs to the horizon, a few valleys lit, most dark. The scale is symbolic.
 */

const INK = 0xece7db;
const ACCENT = 0xff5b2e;
const SIZE = 220;
const N = 330;
export const PAISAJE_SIZE = SIZE;

const noise = perlin3(251);
/** Height of the landscape (y up). Our valley at the origin. */
export const height = (x: number, z: number) => {
  const d2 = x * x + z * z;
  const broad = noise(x * 0.035, 0.5, z * 0.035, 3) * 9;
  const hills = noise(x * 0.11 + 7, 1.5, z * 0.11, 3) * 3.2;
  const fine = noise(x * 0.4, 2.5, z * 0.4, 2) * 0.5;
  // Our valley: a bowl around the origin, so the multiverse sits at its bottom.
  const bowl = -3.2 * Math.exp(-d2 / 26);
  return broad + hills + fine + bowl;
};
/** Where the multiverse sits: the bottom of our valley (found by walking downhill from the origin). */
export const PAISAJE = (() => {
  let x = 0;
  let z = 0;
  const e = 0.01;
  for (let k = 0; k < 4000; k++) {
    const gx = (height(x + e, z) - height(x - e, z)) / (2 * e);
    const gz = (height(x, z + e) - height(x, z - e)) / (2 * e);
    const g = Math.hypot(gx, gz);
    if (g < 1e-4) break;
    x -= (gx / g) * Math.min(0.05, g * 0.2);
    z -= (gz / g) * Math.min(0.05, g * 0.2);
  }
  return { valley: new THREE.Vector3(x, height(x, z), z) };
})();
const V = PAISAJE.valley;
const H0 = V.y;

export function paisaje(): WorldModule {
  return {
    spec: {
      id: 'paisaje',
      territory: 'hipotético',
      name: 'El paisaje de cuerdas',
      fact: 'Hipótesis: unas 10⁵⁰⁰ maneras posibles de ser un universo. Cada valle, otras leyes; el nuestro, uno entre ellos.',
      label: 'paisaje',
      unitExp: 32,
      frame: 30,
      frameCenter: PAISAJE.valley.clone(),
      // From above at a slant, so the relief reads.
      view: [0.5, 0, 0],
      // Out as the plate it is drawn on takes over (its panel redraws it).
      fade: [-2.4, -1.6, 0.9, 1.5],
      tint: INK,
      nameSpan: 1.4,
      scaleLabel: { exp: '10<sup>500</sup><span class="m"> ?</span>', unit: 'hipótesis · leyes posibles de la física' },
      notes: [
        { at: PAISAJE.valley.toArray(), text: 'nuestro multiverso' },
        { at: [V.x, H0 + 3.2, V.z - 14], text: 'una barrera de energía' },
      ],
      generate() {
        const r = rng(252);
        const step = SIZE / N;
        const W = N + 1;
        const h = new Float32Array(W * W);
        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i < W; i++) {
          for (let j = 0; j < W; j++) {
            const v = height(-SIZE / 2 + i * step, -SIZE / 2 + j * step);
            h[i * W + j] = v;
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
          }
        }
        const xOf = (i: number) => -SIZE / 2 + i * step;

        // Contour lines (marching squares), each drawn at its height: the relief as a plate
        // draws it. Faint with distance, so the landscape fades into a horizon instead of
        // ending at an edge; drawn outward from our valley.
        const ink = lineSet();
        const ours = lineSet();
        const DL = 0.42;
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        const cross = (i0: number, j0: number, v0: number, i1: number, j1: number, v1: number, L: number, out: THREE.Vector3) => {
          const t = (L - v0) / (v1 - v0);
          return out.set(xOf(i0 + (i1 - i0) * t), L, xOf(j0 + (j1 - j0) * t));
        };
        for (let i = 0; i < N; i++) {
          for (let j = 0; j < N; j++) {
            const v00 = h[i * W + j];
            const v10 = h[(i + 1) * W + j];
            const v11 = h[(i + 1) * W + j + 1];
            const v01 = h[i * W + j + 1];
            const mn = Math.min(v00, v10, v11, v01);
            const mx = Math.max(v00, v10, v11, v01);
            const cx = xOf(i + 0.5);
            const cz = xOf(j + 0.5);
            const d = Math.hypot(cx, cz);
            if (d > SIZE / 2) continue;
            const dv = Math.hypot(cx - V.x, cz - V.z);
            // Steep slopes crowd their lines together (worse seen edge on): dim them by how many
            // levels cross the cell, so a ridge does not burn white.
            const steep = 1 / (1 + (1.2 * (mx - mn)) / DL);
            const fade = Math.pow(1 - smoothstep(SIZE * 0.05, SIZE * 0.42, d), 1.6) * steep;
            if (fade < 0.004) continue;
            const t = Math.min(1, d / (SIZE * 0.5)) * 0.9;
            for (let k = Math.ceil((mn - lo) / DL); lo + k * DL <= mx; k++) {
              const L = lo + k * DL;
              // Edges crossed by this level: bottom (00-10), right (10-11), top (11-01), left (01-00).
              const cut: THREE.Vector3[] = [];
              if (v00 < L !== v10 < L) cut.push(cross(i, j, v00, i + 1, j, v10, L, new THREE.Vector3()));
              if (v10 < L !== v11 < L) cut.push(cross(i + 1, j, v10, i + 1, j + 1, v11, L, new THREE.Vector3()));
              if (v11 < L !== v01 < L) cut.push(cross(i + 1, j + 1, v11, i, j + 1, v01, L, new THREE.Vector3()));
              if (v01 < L !== v00 < L) cut.push(cross(i, j + 1, v01, i, j, v00, L, new THREE.Vector3()));
              // Every fifth level a little brighter, as on a map.
              const major = k % 5 === 0 ? 1.8 : 1;
              const set = dv < 7.5 && L < H0 + 2.2 ? ours : ink;
              const l = (set === ours ? 1.1 : 0.4 * major) * fade;
              for (let s = 0; s + 1 < cut.length; s += 2) {
                a.copy(cut[s]);
                b.copy(cut[s + 1]);
                set.segment(a, b, l, t, t);
              }
            }
          }
        }

        // Valleys: local minima. A few are lit (a multiverse of their own, other laws); most
        // stay dark. Ours, at the origin, in the accent colour.
        const pts = cloudBuilder(253);
        const R = 3;
        for (let i = R; i < W - R; i++) {
          for (let j = R; j < W - R; j++) {
            const v = h[i * W + j];
            let isMin = true;
            for (let di = -R; di <= R && isMin; di++) for (let dj = -R; dj <= R; dj++) if (h[(i + di) * W + j + dj] < v) { isMin = false; break; }
            if (!isMin) continue;
            const x = xOf(i);
            const z = xOf(j);
            const d = Math.hypot(x, z);
            if (d < 6 || d > SIZE * 0.47) continue;
            const fade = 1 - smoothstep(SIZE * 0.15, SIZE * 0.47, d);
            const lit = r() < 0.5;
            if (!lit) continue;
            const hex = r() < 0.7 ? 0xd8e4ff : 0xffe2c0;
            // A little foam of its own, glowing at the bottom of its valley.
            for (let k = 0; k < 24; k++) {
              pts.push(x + gauss(r) * 0.25, v + 0.2 + Math.abs(gauss(r)) * 0.2, z + gauss(r) * 0.25, hex, 0.12, 0, 0.5 * fade, { star: true, delay: Math.min(1, d / (SIZE * 0.5)) * 0.9 });
            }
          }
        }
        // Our multiverse: the stand-in for everything before.
        for (let k = 0; k < 40; k++) pts.push(V.x + gauss(r) * 0.05, H0 + gauss(r) * 0.05, V.z + gauss(r) * 0.05, 0xfff0e0, 0.04, 0, 0.7, { star: true, flag: true });
        return { ink: ink.data(), ours: ours.data(), pts: pts.data() };
      },
      assemble(data) {
        const ink = linesFromData(data.ink as LinesData, INK);
        const ours = linesFromData(data.ours as LinesData, ACCENT);
        const cloud = cloudFromData(data.pts as PointsData, 1, 1);
        const object = new THREE.Group();
        object.add(ink.mesh, ours.mesh, cloud.points);
        return {
          object,
          clouds: [cloud],
          update(f) {
            const form = f.tl.get('pai.form', f.p);
            // Pulling back, all its lines crowd into a small patch: thin them so it never burns.
            const back = 1 - 0.8 * smoothstep(f.home + 0.2, f.home + 1.0, f.e);
            ink.uniforms.uAlpha.value = f.alpha * back;
            ours.uniforms.uAlpha.value = f.alpha * back;
            ink.uniforms.uReveal.value = form;
            ours.uniforms.uReveal.value = form;
            cloud.u.uReveal.value = form;
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('multiverso'), f.e, f.home);
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'pai.form': 0 });
      // Out of the foam: it shrinks to a point at the bottom of a valley, and the landscape
      // draws itself outward.
      tl.to(5.2, { e: w.home - 0.25, 'pai.form': 1, yaw: 0, pitch: 0.25, roll: 0, fov: 46 });
      tl.label('paisaje');
      // The camera lowers towards the horizon: valleys beyond valleys, a few lit.
      tl.to(4.2, { yaw: 0.6, pitch: -0.12, e: w.home + 0.25, fov: 54 });
    },
  };
}
