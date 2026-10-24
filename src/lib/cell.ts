import { rng } from './math';

/**
 * One cell, described once. Every style draws this same layout so the comparison is fair.
 * Units: the cell's radius is about 1. The cell lies in the XY plane; styles that use depth add their own Z.
 */

export const STRETCH_X = 1.08;

/** Membrane radius for an angle around the centre. */
export function membraneR(theta: number) {
  return 1 + 0.045 * Math.sin(3 * theta + 0.6) + 0.03 * Math.sin(5 * theta - 1.1) + 0.015 * Math.sin(9 * theta + 2);
}

export function membranePoint(theta: number, scale = 1): [number, number] {
  const r = membraneR(theta) * scale;
  return [Math.cos(theta) * r * STRETCH_X, Math.sin(theta) * r];
}

export const NUCLEUS = { x: -0.16, y: 0.06, r: 0.34 };
export const NUCLEOLUS = { x: -0.22, y: 0.11, r: 0.09 };

export interface Mito {
  x: number;
  y: number;
  angle: number;
  len: number;
  r: number;
}

export const MITOS: Mito[] = [
  [0.4, 0.4, 0.7],
  [0.7, 0.14, -1.2],
  [0.1, -0.6, 0.15],
  [-0.48, -0.48, 1.0],
  [-0.66, 0.36, -0.8],
  [0.05, 0.66, 0.1],
  [-0.74, -0.05, 1.5],
].map(([x, y, angle]) => ({ x, y, angle, len: 0.26, r: 0.06 }));

/** Endoplasmic reticulum: wavy sheets hugging the nucleus. Each entry is a polyline. */
export function erPaths(): [number, number][][] {
  const paths: [number, number][][] = [];
  for (let k = 0; k < 5; k++) {
    const pts: [number, number][] = [];
    const base = NUCLEUS.r + 0.07 + k * 0.045;
    const a0 = Math.PI * 0.42 + k * 0.08;
    const a1 = Math.PI * 1.42 - k * 0.05;
    for (let i = 0; i <= 90; i++) {
      const a = a0 + ((a1 - a0) * i) / 90;
      const r = base + 0.012 * Math.sin(a * 14 + k * 1.7);
      pts.push([NUCLEUS.x + Math.cos(a) * r, NUCLEUS.y + Math.sin(a) * r]);
    }
    paths.push(pts);
  }
  return paths;
}

/** Golgi apparatus: a stack of curved cisternae. */
export function golgiPaths(): [number, number][][] {
  const paths: [number, number][][] = [];
  const cx = 0.3;
  const cy = -0.1;
  for (let k = 0; k < 5; k++) {
    const pts: [number, number][] = [];
    const r = 0.16 + k * 0.035;
    const span = 0.42 - k * 0.03;
    for (let i = 0; i <= 40; i++) {
      const a = -0.55 - span + (2 * span * i) / 40;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    paths.push(pts);
  }
  return paths;
}

export interface Vesicle {
  x: number;
  y: number;
  r: number;
}

function clearOfOrganelles(x: number, y: number, margin: number) {
  if (Math.hypot(x - NUCLEUS.x, y - NUCLEUS.y) < NUCLEUS.r + 0.3 + margin) return false;
  if (Math.hypot(x - 0.45, y + 0.25) < 0.2 + margin) return false;
  return MITOS.every((m) => Math.hypot(x - m.x, y - m.y) > 0.17 + margin);
}

export const VESICLES: Vesicle[] = (() => {
  const r = rng(7);
  const out: Vesicle[] = [];
  let guard = 0;
  while (out.length < 26 && guard++ < 4000) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.86;
    const x = Math.cos(a) * d * STRETCH_X;
    const y = Math.sin(a) * d;
    const rad = 0.018 + r() * 0.026;
    if (!clearOfOrganelles(x, y, rad)) continue;
    if (out.some((v) => Math.hypot(v.x - x, v.y - y) < v.r + rad + 0.03)) continue;
    out.push({ x, y, r: rad });
  }
  return out;
})();

/** Point on a mitochondrion outline, t in [0, 2π). */
export function mitoOutline(m: Mito, t: number, scale = 1): [number, number] {
  const lx = Math.cos(t) * (m.len / 2) * scale;
  const ly = Math.sin(t) * m.r * scale;
  const c = Math.cos(m.angle);
  const s = Math.sin(m.angle);
  return [m.x + lx * c - ly * s, m.y + lx * s + ly * c];
}

/** Cristae: the folded inner membrane, as a zigzag along the long axis (local -> world). */
export function mitoCristae(m: Mito): [number, number][] {
  const pts: [number, number][] = [];
  const n = 9;
  const c = Math.cos(m.angle);
  const s = Math.sin(m.angle);
  for (let i = 0; i <= n; i++) {
    const u = -0.38 + (0.76 * i) / n;
    const lx = u * m.len;
    const half = Math.sqrt(Math.max(0, 1 - (u / 0.5) ** 2)) * m.r * 0.72;
    const ly = i % 2 === 0 ? half : -half;
    pts.push([m.x + lx * c - ly * s, m.y + lx * s + ly * c]);
  }
  return pts;
}

export const LABELS = [
  { text: 'núcleo', at: [NUCLEUS.x - 0.12, NUCLEUS.y + 0.24], to: [-1.55, 0.78] },
  { text: 'mitocondria', at: [MITOS[0].x, MITOS[0].y], to: [1.5, 0.82] },
  { text: 'aparato de Golgi', at: [0.48, -0.28], to: [1.55, -0.32] },
  { text: 'retículo endoplasmático', at: [NUCLEUS.x - 0.36, NUCLEUS.y - 0.22], to: [-1.6, -0.62] },
  { text: 'membrana', at: [membranePoint(-0.75)[0], membranePoint(-0.75)[1]], to: [1.55, -0.9] },
] as const;
