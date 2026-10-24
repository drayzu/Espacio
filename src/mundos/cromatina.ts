import * as THREE from 'three';
import { gauss, rng } from '../lib/math';
import { perlin3 } from '../lib/puntos';
import { NUCLEUS } from '../lib/cell';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';

/**
 * Inside the nucleus: chromatin fibres filling it, within the nuclear envelope. 1 unit = 1 µm.
 * Our fibre (the one the nucleosomes belong to) keeps the nucleosomes' warm colour, so you can
 * follow it among the others. Arrival: the other fibres draw themselves until they fill the
 * nucleus. Moment: a slow swing inside it.
 */

const R = 3.4;
const FLAT = 0.75;
const FIBRES = 70;
const STEPS = 420;
/** Where our nucleosome fibre sits along our chromatin fibre is chosen so that it lies across the
 * screen: then the zoom from one to the other needs no turn. */
const ANCHOR_TARGET = new THREE.Vector3(Math.cos(-0.3), Math.sin(-0.3), 0);

export const CROM = (() => {
  const r = rng(61);
  const noise = perlin3(62);
  const inside = (p: THREE.Vector3, k: number) => p.x * p.x + p.y * p.y + (p.z / FLAT) * (p.z / FLAT) < k * k;
  const paths: Float32Array[] = [];
  let anchor = new THREE.Vector3();
  let anchorDir = new THREE.Vector3(1, 0, 0);
  let anchorStep = 0;
  let best = -Infinity;
  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let f = 0; f < FIBRES; f++) {
    if (f === 0) pos.set(0.6, 0.3, 0.4);
    else {
      do pos.set((r() * 2 - 1) * 3, (r() * 2 - 1) * 3, (r() * 2 - 1) * 3 * FLAT);
      while (!inside(pos, 3.0));
    }
    dir.set(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    const seed = f * 7.3;
    const path = new Float32Array(STEPS * 3);
    for (let s = 0; s < STEPS; s++) {
      dir.x += noise(pos.x * 1.5 + seed, pos.y * 1.5, pos.z * 1.5, 2) * 0.35;
      dir.y += noise(pos.x * 1.5, pos.y * 1.5 + seed, pos.z * 1.5, 2) * 0.35;
      dir.z += noise(pos.x * 1.5, pos.y * 1.5, pos.z * 1.5 + seed, 2) * 0.35;
      if (!inside(pos, 3.1)) dir.addScaledVector(pos, -0.4);
      dir.normalize();
      pos.addScaledVector(dir, 0.02);
      path.set([pos.x, pos.y, pos.z], s * 3);
      if (f === 0 && s > 80 && s < STEPS - 80 && dir.dot(ANCHOR_TARGET) > best) {
        best = dir.dot(ANCHOR_TARGET);
        anchorStep = s;
        anchor = pos.clone();
        anchorDir = dir.clone();
      }
    }
    paths.push(path);
  }
  return { paths, anchor, anchorDir, anchorStep };
})();

const HUES = [0x5ab8ff, 0x5ab8ff, 0x7fe0d0, 0x9f8cff];
/** Ours: between the histones' amber and the DNA's lilac. */
const OURS = 0xffd2b0;

export function cromatina(): WorldModule {
  return {
    spec: {
      id: 'cromatina',
      territory: 'vida',
      name: 'Cromatina',
      fact: 'Cada hebra es ADN plegado una y otra vez.',
      label: 'cromatina',
      unitExp: -6,
      frame: 3,
      anchor: new THREE.Vector3(NUCLEUS.x, NUCLEUS.y, 0),
      frameCenter: new THREE.Vector3(),
      view: 'continue',
      fade: [-1.25, -0.8, 0.55, 0.95],
      tint: 0x5ab8ff,
      notes: [
        { at: CROM.anchor.toArray(), text: 'nuestra fibra' },
        { at: [CROM.paths[5][900], CROM.paths[5][901], CROM.paths[5][902]], text: 'cromatina' },
        { at: [0, R, 0], text: 'envoltura nuclear' },
      ],
      generate() {
        const fibres = cloudBuilder(63);
        const shell = cloudBuilder(64);
        const { r } = fibres;
        CROM.paths.forEach((path, f) => {
          const hue = f === 0 ? OURS : HUES[f % HUES.length];
          const lag = r() * 0.15;
          for (let s = 0; s < STEPS; s++) {
            const x = path[s * 3];
            const y = path[s * 3 + 1];
            const z = path[s * 3 + 2];
            // Our fibre is there from the start; the others draw themselves along their length.
            const delay = f === 0 ? 0 : 0.05 + lag + (s / STEPS) * 0.78;
            const flag = f === 0 && Math.abs(s - CROM.anchorStep) < 9;
            for (let j = 0; j < 2; j++) {
              fibres.push(x + gauss(r) * 0.007, y + gauss(r) * 0.007, z + gauss(r) * 0.007, hue, 1, 0.003, f === 0 ? 0.42 : 0.36, { delay, flag });
            }
          }
        });
        for (let i = 0; i < 16000; i++) {
          const [x, y, z] = shell.onSphere();
          const k = R * (1 + gauss(r) * 0.004);
          shell.push(x * k, y * k, z * k * FLAT, 0x47e6c8, 1, 0.004, 0.24, { delay: 0.7 + r() * 0.3 });
        }
        return { fibres: fibres.data(), shell: shell.data() };
      },
      assemble(data) {
        const fibreCloud = cloudFromData(data.fibres as PointsData, 0.009, 1);
        const shellCloud = cloudFromData(data.shell as PointsData, 0.009, 1);
        const object = new THREE.Group();
        object.add(shellCloud.points, fibreCloud.points);
        return {
          object,
          clouds: [fibreCloud, shellCloud],
          update(f) {
            const grow = f.tl.get('crom.grow', f.p);
            fibreCloud.u.uReveal.value = grow;
            shellCloud.u.uReveal.value = grow;
            fibreCloud.u.uFlagAlpha.value = standIn(f.alphaOf('nucleosomas'), f.e, f.home);
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'crom.grow': 0 });
      // A long, calm zoom out: our fibre stays in view while the others draw themselves around it.
      tl.to(4.2, { e: w.home - 0.05, 'crom.grow': 0.75, yaw: 0.15, pitch: 0.05, fov: 40 });
      tl.label('cromatina');
      tl.to(2.4, { 'crom.grow': 1, yaw: 0.6, e: w.home + 0.2, pitch: 0.15 });
    },
  };
}
