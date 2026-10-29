import * as THREE from 'three';
import { gauss, rng } from '../lib/math';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { CROM } from './cromatina';

/**
 * Nucleosomes: DNA wrapped 1.65 times around histone discs, on a two-start zigzag. 1 unit = 10 nm.
 * Arrival: the stretched DNA coils around the histones, in a wave that starts at our linker.
 * Moment: the camera orbits the fibre.
 */

const TAU = Math.PI * 2;
const DNA_HUE = 0xcfd6ff;

export const NUC = (() => {
  const r = rng(51);
  const beads: { c: THREE.Vector3; n: THREE.Vector3 }[] = [];
  for (let k = 0; k < 30; k++) {
    const t = k - 14.5;
    const c = new THREE.Vector3(t * 1.15, 0.9 * Math.sin(k * 2.1) + 0.3 * Math.sin(k * 0.4), 0.9 * Math.cos(k * 2.1));
    const n = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    beads.push({ c, n });
  }
  const anchorK = 14;
  const anchor = beads[anchorK].c.clone().lerp(beads[anchorK + 1].c, 0.5);
  const anchorDir = beads[anchorK + 1].c.clone().sub(beads[anchorK].c).normalize();
  return { beads, anchorK, anchor, anchorDir };
})();

export function nucleosomas(): WorldModule {
  return {
    spec: {
      id: 'nucleosomas',
      territory: 'vida',
      name: 'Nucleosomas',
      fact: 'En cada una de tus células hay dos metros de esto, enrollado como hilo en carretes.',
      label: 'nucleosomas',
      unitExp: -8,
      frame: 8,
      anchor: CROM.anchor,
      anchorDir: CROM.anchorDir,
      frameCenter: new THREE.Vector3(NUC.anchor.x, 0, 0),
      view: [0.3, 0, -0.3],
      fade: [-1.0, -0.55, 0.75, 1.15],
      tint: 0xffc79a,
      notes: [
        { at: NUC.anchor.toArray(), text: 'nuestro tramo de ADN' },
        { at: NUC.beads[11].c.toArray(), text: 'histonas' },
        { at: NUC.beads[18].c.toArray(), text: 'ADN enrollado' },
      ],
      generate() {
        const dna = cloudBuilder(52);
        const cores = cloudBuilder(53);
        const { r } = dna;
        const { beads, anchorK } = NUC;
        const u = new THREE.Vector3();
        const v = new THREE.Vector3();
        const into = new THREE.Vector3();
        const outof = new THREE.Vector3();

        beads.forEach(({ c, n }, k) => {
          u.set(1, 0, 0).cross(n);
          if (u.lengthSq() < 1e-3) u.set(0, 1, 0).cross(n);
          u.normalize();
          v.copy(n).cross(u);
          const delay = Math.min(1, Math.abs(k - anchorK - 0.5) / 15);
          // Unwrapped, the DNA runs straight through where the bead will be.
          const prev = beads[Math.max(0, k - 1)].c;
          const next = beads[Math.min(beads.length - 1, k + 1)].c;
          into.copy(prev).sub(c);
          if (into.lengthSq() > 0) into.normalize().multiplyScalar(0.5).add(c);
          else into.copy(c);
          outof.copy(next).sub(c);
          if (outof.lengthSq() > 0) outof.normalize().multiplyScalar(0.5).add(c);
          else outof.copy(c);

          for (let i = 0; i < 700; i++) {
            const a = gauss(r) * 0.22;
            const bb = gauss(r) * 0.22;
            const h = gauss(r) * 0.1;
            cores.push(c.x + u.x * a + v.x * bb + n.x * h, c.y + u.y * a + v.y * bb + n.y * h, c.z + u.z * a + v.z * bb + n.z * h, 0xffb27a, 1, 0.006, 0.42, { delay });
          }
          for (let i = 0; i < 900; i++) {
            const s = r();
            const ang = s * 1.65 * TAU;
            const off = (s - 0.5) * 0.24;
            const jx = gauss(r) * 0.05;
            const jy = gauss(r) * 0.05;
            const jz = gauss(r) * 0.05;
            dna.push(
              c.x + (u.x * Math.cos(ang) + v.x * Math.sin(ang)) * 0.48 + n.x * off + jx,
              c.y + (u.y * Math.cos(ang) + v.y * Math.sin(ang)) * 0.48 + n.y * off + jy,
              c.z + (u.z * Math.cos(ang) + v.z * Math.sin(ang)) * 0.48 + n.z * off + jz,
              DNA_HUE,
              1,
              0.006,
              0.4,
              { from: [into.x + (outof.x - into.x) * s + jx, into.y + (outof.y - into.y) * s + jy, into.z + (outof.z - into.z) * s + jz], delay },
            );
          }
        });
        // Linker DNA between beads; the one holding our helix is its stand-in.
        for (let k = 0; k < beads.length - 1; k++) {
          const a = beads[k].c;
          const c = beads[k + 1].c;
          const len = a.distanceTo(c);
          for (let i = 0; i < 360; i++) {
            const t = 0.5 / len + r() * (1 - 1 / len);
            dna.push(
              a.x + (c.x - a.x) * t + gauss(r) * 0.05,
              a.y + (c.y - a.y) * t + gauss(r) * 0.05,
              a.z + (c.z - a.z) * t + gauss(r) * 0.05,
              DNA_HUE,
              1,
              0.006,
              0.4,
              { flag: k === anchorK },
            );
          }
        }
        return { dna: dna.data(), cores: cores.data() };
      },
      assemble(data) {
        const dnaCloud = cloudFromData(data.dna as PointsData, 0.025, 1);
        const coreCloud = cloudFromData(data.cores as PointsData, 0.025, 1);
        dnaCloud.u.uSpread.value = 1.2;
        coreCloud.u.uSpread.value = 1.2;
        const object = new THREE.Group();
        object.add(coreCloud.points, dnaCloud.points);
        return {
          object,
          clouds: [dnaCloud, coreCloud],
          update(f) {
            const wrap = f.tl.get('nuc.wrap', f.p);
            dnaCloud.u.uAssemble.value = wrap;
            coreCloud.u.uReveal.value = wrap;
            dnaCloud.u.uFlagAlpha.value = standIn(f.alphaOf('adn'), f.e, f.home);
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'nuc.wrap': 0 });
      // Zoom out as the DNA coils around the histones; our stretch of DNA glows.
      tl.to(3.4, { e: w.home - 0.1, 'nuc.wrap': 1, 'adn.tx': 0, fov: 42 });
      tl.label('nucleosomas');
      // Swing along the fibre. (The next zoom swings back.)
      tl.to(2.4, { yaw: 0.9, pitch: 0.25, e: w.home + 0.15 });
    },
  };
}
