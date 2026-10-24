import * as THREE from 'three';
import { gauss, rng } from '../lib/math';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { NUC } from './nucleosomas';

/**
 * DNA, atom by atom. 1 unit = 1 nm. Axis along x, 10 base pairs per turn, 64 base pairs.
 * Arrival: its atoms fly in from the dark and lock into the helix in a wave that starts at our
 * carbon. Moment: the camera flies along the double helix.
 */

const TAU = Math.PI * 2;

/** CPK colours; carbon is tinted towards the atom's own lilac so the hand-over reads as one thing. */
const CPK = { C: 0xd9ccff, O: 0xff4a4a, N: 0x4f6dff, P: 0xffa040 } as const;
type El = keyof typeof CPK;

export const ADN = (() => {
  const r = rng(41);
  const atoms: { p: THREE.Vector3; el: El; base: boolean }[] = [];
  let anchorIdx = -1;
  const at = (x: number, rad: number, th: number, el: El) =>
    atoms.push({ p: new THREE.Vector3(x, rad * Math.cos(th), rad * Math.sin(th)), el, base: false });

  const BP = 64;
  for (let i = -BP / 2; i < BP / 2; i++) {
    const x = i * 0.34;
    const phi = i * 0.628;
    for (const [th, side] of [
      [phi, 1],
      [phi + 2.4, -1],
    ]) {
      at(x, 1.0, th, 'P');
      for (let k = 0; k < 4; k++) {
        atoms.push({ p: new THREE.Vector3(x + gauss(r) * 0.12, Math.cos(th) + gauss(r) * 0.12, Math.sin(th) + gauss(r) * 0.12), el: 'O', base: false });
      }
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        if (i === 3 && side === 1 && k === 1) anchorIdx = atoms.length;
        at(x + 0.12 + Math.cos(a) * 0.12, 0.78 + Math.sin(a) * 0.1, th + 0.18 * side, k === 0 ? 'O' : 'C');
      }
    }
    const ya = 0.6 * Math.cos(phi);
    const za = 0.6 * Math.sin(phi);
    const yb = 0.6 * Math.cos(phi + 2.4);
    const zb = 0.6 * Math.sin(phi + 2.4);
    for (let k = 0; k < 17; k++) {
      const t = (k + 0.5) / 17;
      const roll = r();
      atoms.push({
        p: new THREE.Vector3(x + gauss(r) * 0.05, ya + (yb - ya) * t + gauss(r) * 0.07, za + (zb - za) * t + gauss(r) * 0.07),
        el: roll < 0.55 ? 'C' : roll < 0.8 ? 'N' : 'O',
        base: true,
      });
    }
  }
  const anchor = atoms[anchorIdx].p.clone();
  return { atoms, anchorIdx, anchor };
})();

export function adn(): WorldModule {
  return {
    spec: {
      id: 'adn',
      territory: 'molecular',
      name: 'ADN · doble hélice',
      fact: 'Cada punto de luz es un átomo. Nuestro carbono es uno de ellos.',
      label: 'ADN',
      unitExp: -9,
      frame: 6,
      anchor: NUC.anchor,
      anchorDir: NUC.anchorDir,
      frameCenter: new THREE.Vector3(ADN.anchor.x, 0, 0),
      view: [0.25, 0, -0.45],
      fade: [-1.35, -0.85, 0.6, 1.0],
      tint: 0xd9ccff,
      notes: [
        { at: ADN.anchor.toArray(), text: 'nuestro carbono' },
        // A phosphate of the backbone, and the middle of a base pair, a few turns away.
        { at: [-1.7, Math.cos(-5 * 0.628), Math.sin(-5 * 0.628)], text: 'esqueleto de fosfato' },
        {
          at: [6 * 0.34, 0.3 * (Math.cos(6 * 0.628) + Math.cos(6 * 0.628 + 2.4)), 0.3 * (Math.sin(6 * 0.628) + Math.sin(6 * 0.628 + 2.4))],
          text: 'par de bases',
        },
      ],
      generate() {
        const b = cloudBuilder(42);
        const { r } = b;
        const { atoms, anchorIdx, anchor } = ADN;
        const off = new THREE.Vector3();
        atoms.forEach((a, idx) => {
          const d2 = a.p.distanceToSquared(anchor);
          // Detail close to our atom, at the same total light, so magnified neighbours read as clouds.
          const base = a.base ? 8 : 14;
          const n = base + Math.round(60 * Math.exp(-d2 / 0.9));
          const light = ((a.base ? 0.28 : 0.62) * base) / n;
          // The whole atom flies in together, from outside, later the farther it is from our carbon.
          off.copy(a.p).sub(anchor);
          const dist = off.length();
          if (dist < 1e-6) off.set(0, 0, 0);
          else off.normalize().multiplyScalar(1.5 + r() * 3.5).add(new THREE.Vector3(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.6));
          const delay = Math.min(1, dist / 9) * 0.85 + r() * 0.15;
          for (let j = 0; j < n; j++) {
            const x = a.p.x + gauss(r) * 0.045;
            const y = a.p.y + gauss(r) * 0.045;
            const z = a.p.z + gauss(r) * 0.045;
            b.push(x, y, z, CPK[a.el], 1, 0.004, light, { from: [x + off.x, y + off.y, z + off.z], delay, flag: idx === anchorIdx });
          }
        });
        return { main: b.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 0.02, 1);
        cloud.u.uFlyFade.value = 1;
        return {
          object: cloud.points,
          clouds: [cloud],
          update(f) {
            cloud.u.uAssemble.value = f.tl.get('adn.assemble', f.p);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('atomo'), f.e, f.home);
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'adn.assemble': 0, 'adn.tx': 0 });
      // Zoom out while the helix gathers around our atom, which keeps glowing among the others.
      tl.to(3.4, { e: w.home - 0.35, 'adn.assemble': 1, yaw: 0.2, pitch: 0.05, fov: 46 });
      tl.label('adn');
      // Fly along the double helix.
      tl.to(3.0, { 'adn.tx': -6, fov: 58, roll: 0.18, pitch: -0.1, yaw: 0.45, e: w.home - 0.3 });
      tl.to(2.2, { e: w.home + 0.05, fov: 40, roll: 0, 'adn.tx': -2, pitch: 0, yaw: 0 });
    },
  };
}
