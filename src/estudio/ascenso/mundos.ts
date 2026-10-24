import * as THREE from 'three';
import { gauss } from '../../lib/math';
import { perlin3, pointBuilder } from '../../lib/puntos';

/**
 * The five worlds of the ascent, each in its own physical units, plus where its child sits.
 * Points flagged 1 are the parent's stand-in for the nested child; the engine hides them while
 * the child itself is on screen.
 */

export interface Built {
  geometry: THREE.BufferGeometry;
  /** Where the child world's origin sits, in this world's units. */
  anchor?: THREE.Vector3;
  /** Direction the child's x axis should follow at the anchor. */
  anchorDir?: THREE.Vector3;
  /** What the camera frames when this world is at home. */
  frameCenter: THREE.Vector3;
}

/** Carbon atom. 1 unit = 10⁻¹⁰ m. A 1s core and four sp³ lobes on a tetrahedron. */
export function buildAtom(): Built {
  const b = pointBuilder(3);
  const { r } = b;
  const S = 0.13;
  const gamma = (k: number) => {
    let s = 0;
    for (let i = 0; i < k; i++) s -= Math.log(1 - r());
    return s;
  };
  for (let i = 0; i < 4000; i++) {
    const [x, y, z] = b.onSphere();
    const rad = (gamma(3) / 2) * S;
    b.push(x * rad, y * rad, z * rad, 0xe9dcff, 1, 0.01, 0.5);
  }
  const lobes: [[number, number, number], number][] = [
    [[1, 1, 1], 0xff4fb0],
    [[1, -1, -1], 0x4f8cff],
    [[-1, 1, -1], 0x33e6d9],
    [[-1, -1, 1], 0xad6bff],
  ];
  const k3 = Math.sqrt(3);
  for (const [[dx, dy, dz], color] of lobes) {
    const n = Math.hypot(dx, dy, dz);
    for (let i = 0; i < 12000; i++) {
      let u: [number, number, number];
      let c = 0;
      do {
        u = b.onSphere();
        c = (u[0] * dx + u[1] * dy + u[2] * dz) / n;
        // Sharpened beyond the textbook shape so the four lobes stay legible.
      } while (r() > ((1 + k3 * c) / (1 + k3)) ** 6);
      const rad = (gamma(9) / 1.8) * S;
      const front = 1 + k3 * c > 0;
      b.push(u[0] * rad, u[1] * rad, u[2] * rad, front ? color : 0xffa060, 1, 0.012, front ? 0.7 : 0.5);
    }
  }
  for (let i = 0; i < 40; i++) b.push(gauss(r) * 0.004, gauss(r) * 0.004, gauss(r) * 0.004, 0xffe2c0, 1.5, 0, 1.2);
  return { geometry: b.geometry(), frameCenter: new THREE.Vector3() };
}

/** CPK colours; carbon is tinted towards the atom's own lilac so the hand-over reads as one thing. */
const CPK = { C: 0xd9ccff, O: 0xff4a4a, N: 0x4f6dff, P: 0xffa040 } as const;
type El = keyof typeof CPK;

/** DNA double helix, atom by atom. 1 unit = 1 nm. Axis along x, 10 base pairs per turn. */
export function buildDNA(): Built {
  const b = pointBuilder(41);
  const { r } = b;
  const atoms: { p: THREE.Vector3; el: El; base?: boolean }[] = [];
  let anchorIdx = -1;
  const at = (x: number, rad: number, th: number, el: El) => atoms.push({ p: new THREE.Vector3(x, rad * Math.cos(th), rad * Math.sin(th)), el });

  const BP = 64;
  for (let i = -BP / 2; i < BP / 2; i++) {
    const x = i * 0.34;
    const phi = i * 0.628;
    for (const [th, side] of [
      [phi, 1],
      [phi + 2.4, -1],
    ]) {
      // Phosphate.
      at(x, 1.0, th, 'P');
      for (let k = 0; k < 4; k++) {
        atoms.push({ p: new THREE.Vector3(x + gauss(r) * 0.12, Math.cos(th) + gauss(r) * 0.12, Math.sin(th) + gauss(r) * 0.12), el: 'O' });
      }
      // Sugar ring.
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        if (i === 3 && side === 1 && k === 1) anchorIdx = atoms.length;
        at(x + 0.12 + Math.cos(a) * 0.12, 0.78 + Math.sin(a) * 0.1, th + 0.18 * side, k === 0 ? 'O' : 'C');
      }
    }
    // Base pair: a rung of rings across the helix.
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
  atoms.forEach((a, idx) => {
    // More points close to our atom: seen magnified, its neighbours read as clouds, not dots.
    const d2 = a.p.distanceToSquared(anchor);
    const base = a.base ? 8 : 14;
    const n = base + Math.round(60 * Math.exp(-d2 / 0.9));
    const flag = idx === anchorIdx ? 1 : 0;
    // The two backbones carry the shape of the helix; the bases sit dimmer between them.
    // Extra points near our atom share the same total light, so detail never reads as glare.
    const light = ((a.base ? 0.28 : 0.62) * base) / n;
    for (let j = 0; j < n; j++) {
      b.push(a.p.x + gauss(r) * 0.045, a.p.y + gauss(r) * 0.045, a.p.z + gauss(r) * 0.045, CPK[a.el], 1, 0.004, light, flag);
    }
  });
  return { geometry: b.geometry(), anchor, frameCenter: new THREE.Vector3(anchor.x, 0, 0) };
}

const DNA_HUE = 0xcfd6ff;

/** Nucleosomes: DNA wrapped 1.65 times around histone discs, on a two-start zigzag. 1 unit = 10 nm. */
export function buildFiber(): Built {
  const b = pointBuilder(51);
  const { r } = b;
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

  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (const { c, n } of beads) {
    u.set(1, 0, 0).cross(n);
    if (u.lengthSq() < 1e-3) u.set(0, 1, 0).cross(n);
    u.normalize();
    v.copy(n).cross(u);
    // Histone core: a flattened disc.
    for (let i = 0; i < 700; i++) {
      const a = gauss(r) * 0.22;
      const bb = gauss(r) * 0.22;
      const h = gauss(r) * 0.1;
      b.push(c.x + u.x * a + v.x * bb + n.x * h, c.y + u.y * a + v.y * bb + n.y * h, c.z + u.z * a + v.z * bb + n.z * h, 0xffb27a, 1, 0.006, 0.42);
    }
    // DNA superhelix around it.
    for (let i = 0; i < 900; i++) {
      const s = r();
      const ang = s * 1.65 * Math.PI * 2;
      const k = 0.48;
      const off = (s - 0.5) * 0.24;
      b.push(
        c.x + (u.x * Math.cos(ang) + v.x * Math.sin(ang)) * k + n.x * off + gauss(r) * 0.05,
        c.y + (u.y * Math.cos(ang) + v.y * Math.sin(ang)) * k + n.y * off + gauss(r) * 0.05,
        c.z + (u.z * Math.cos(ang) + v.z * Math.sin(ang)) * k + n.z * off + gauss(r) * 0.05,
        DNA_HUE,
        1,
        0.006,
        0.4,
      );
    }
  }
  // Linker DNA between beads.
  for (let k = 0; k < beads.length - 1; k++) {
    const a = beads[k].c;
    const c = beads[k + 1].c;
    const len = a.distanceTo(c);
    for (let i = 0; i < 360; i++) {
      const t = 0.5 / len + r() * (1 - 1 / len);
      const x = a.x + (c.x - a.x) * t;
      const y = a.y + (c.y - a.y) * t;
      const z = a.z + (c.z - a.z) * t;
      const near = k === anchorK ? 1 : 0;
      b.push(x + gauss(r) * 0.05, y + gauss(r) * 0.05, z + gauss(r) * 0.05, DNA_HUE, 1, 0.006, 0.4, near);
    }
  }
  return { geometry: b.geometry(), anchor, anchorDir, frameCenter: new THREE.Vector3(anchor.x, 0, 0) };
}

/** Inside the nucleus: chromatin fibres filling it, within the nuclear envelope. 1 unit = 1 µm. */
export function buildTerritories(): Built {
  const b = pointBuilder(61);
  const { r } = b;
  const noise = perlin3(62);
  const R = 3.4;
  const FLAT = 0.75;
  const inside = (p: THREE.Vector3, k: number) => p.x * p.x + p.y * p.y + (p.z / FLAT) * (p.z / FLAT) < k * k;

  for (let i = 0; i < 16000; i++) {
    const [x, y, z] = b.onSphere();
    const k = R * (1 + gauss(r) * 0.004);
    b.push(x * k, y * k, z * k * FLAT, 0x47e6c8, 1, 0.004, 0.24);
  }

  const hues = [0x5ab8ff, 0x5ab8ff, 0x7fe0d0, 0x9f8cff];
  let anchor = new THREE.Vector3();
  let anchorDir = new THREE.Vector3(1, 0, 0);
  const pos = new THREE.Vector3();
  const dir = new THREE.Vector3();
  for (let f = 0; f < 70; f++) {
    if (f === 0) pos.set(0.6, 0.3, 0.4);
    else {
      do pos.set((r() * 2 - 1) * 3, (r() * 2 - 1) * 3, (r() * 2 - 1) * 3 * FLAT);
      while (!inside(pos, 3.0));
    }
    dir.set(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
    const hue = hues[f % hues.length];
    const seed = f * 7.3;
    for (let s = 0; s < 420; s++) {
      dir.x += noise(pos.x * 1.5 + seed, pos.y * 1.5, pos.z * 1.5, 2) * 0.35;
      dir.y += noise(pos.x * 1.5, pos.y * 1.5 + seed, pos.z * 1.5, 2) * 0.35;
      dir.z += noise(pos.x * 1.5, pos.y * 1.5, pos.z * 1.5 + seed, 2) * 0.35;
      if (!inside(pos, 3.1)) dir.addScaledVector(pos, -0.4);
      dir.normalize();
      pos.addScaledVector(dir, 0.02);
      if (f === 0 && s === 210) {
        anchor = pos.clone();
        anchorDir = dir.clone();
      }
      const near = f === 0 && Math.abs(s - 210) < 9 ? 1 : 0;
      for (let j = 0; j < 2; j++) {
        b.push(pos.x + gauss(r) * 0.007, pos.y + gauss(r) * 0.007, pos.z + gauss(r) * 0.007, hue, 1, 0.003, 0.36, near);
      }
    }
  }
  return { geometry: b.geometry(), anchor, anchorDir, frameCenter: new THREE.Vector3() };
}
