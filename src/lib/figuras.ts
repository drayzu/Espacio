/**
 * Mathematical figures as line segments, for the plate of all mathematical structures. Each
 * returns a flat list of segments [ax, ay, az, bx, by, bz, ...] fitting in a radius of about 0.5
 * around the origin. Flat figures lie in the x-z plane (y up); the others are 3D.
 */

export type Segs = number[];

/** Scales a figure to fit a radius of 0.5 around its centre. */
function fit(s: Segs): Segs {
  let cx = 0;
  let cy = 0;
  let cz = 0;
  const n = s.length / 3;
  for (let i = 0; i < s.length; i += 3) {
    cx += s[i];
    cy += s[i + 1];
    cz += s[i + 2];
  }
  cx /= n;
  cy /= n;
  cz /= n;
  let m = 1e-9;
  for (let i = 0; i < s.length; i += 3) m = Math.max(m, Math.hypot(s[i] - cx, s[i + 1] - cy, s[i + 2] - cz));
  const k = 0.5 / m;
  const out = new Array<number>(s.length);
  for (let i = 0; i < s.length; i += 3) {
    out[i] = (s[i] - cx) * k;
    out[i + 1] = (s[i + 1] - cy) * k;
    out[i + 2] = (s[i + 2] - cz) * k;
  }
  return out;
}

/** A polyline through points as segments. */
function poly(pts: [number, number, number][], closed = false): Segs {
  const s: Segs = [];
  const n = pts.length;
  for (let i = 0; i + 1 < n + (closed ? 1 : 0); i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    s.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  return s;
}

/** A flat polyline from 2D points (x, z). */
const flat = (pts: [number, number][], closed = false) => poly(pts.map(([x, z]) => [x, 0, z]), closed);

export function lorenz(): Segs {
  let x = 0.1;
  let y = 0;
  let z = 0;
  const pts: [number, number, number][] = [];
  const dt = 0.009;
  for (let i = 0; i < 2600; i++) {
    const dx = 10 * (y - x);
    const dy = x * (28 - z) - y;
    const dz = x * y - (8 / 3) * z;
    x += dx * dt;
    y += dy * dt;
    z += dz * dt;
    if (i > 150) pts.push([x, z, y]);
  }
  return fit(poly(pts));
}

export function trefoil(): Segs {
  const s: Segs = [];
  const at = (t: number): [number, number, number] => [Math.sin(t) + 2 * Math.sin(2 * t), -Math.sin(3 * t), Math.cos(t) - 2 * Math.cos(2 * t)];
  // Three strands around the core curve suggest a tube.
  for (let k = 0; k < 3; k++) {
    const pts: [number, number, number][] = [];
    for (let i = 0; i < 240; i++) {
      const t = (i / 240) * Math.PI * 2;
      const c = at(t);
      const n = at(t + 0.01);
      const tx = n[0] - c[0];
      const ty = n[1] - c[1];
      const tz = n[2] - c[2];
      // A normal: tangent crossed with up, then rotated by the strand's angle around the tangent.
      let nx = -tz;
      let nz = tx;
      const nl = Math.hypot(nx, nz) || 1;
      nx /= nl;
      nz /= nl;
      const bx = ty * nz;
      const by = tz * nx - tx * nz;
      const bz = -ty * nx;
      const bl = Math.hypot(bx, by, bz) || 1;
      const a = (k / 3) * Math.PI * 2 + t * 3;
      const r = 0.32;
      pts.push([c[0] + (nx * Math.cos(a) + (bx / bl) * Math.sin(a)) * r, c[1] + (by / bl) * Math.sin(a) * r, c[2] + (nz * Math.cos(a) + (bz / bl) * Math.sin(a)) * r]);
    }
    s.push(...poly(pts, true));
  }
  return fit(s);
}

export function torus(): Segs {
  const s: Segs = [];
  const R = 1;
  const r = 0.42;
  const P = (u: number, v: number): [number, number, number] => [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)];
  for (let i = 0; i < 18; i++) {
    const u = (i / 18) * Math.PI * 2;
    const pts: [number, number, number][] = [];
    for (let j = 0; j < 20; j++) pts.push(P(u, (j / 20) * Math.PI * 2));
    s.push(...poly(pts, true));
  }
  for (let j = 0; j < 8; j++) {
    const v = (j / 8) * Math.PI * 2;
    const pts: [number, number, number][] = [];
    for (let i = 0; i < 48; i++) pts.push(P((i / 48) * Math.PI * 2, v));
    s.push(...poly(pts, true));
  }
  return fit(s);
}

export function mobius(): Segs {
  const s: Segs = [];
  const P = (u: number, v: number): [number, number, number] => [(1 + (v / 2) * Math.cos(u / 2)) * Math.cos(u), (v / 2) * Math.sin(u / 2), (1 + (v / 2) * Math.cos(u / 2)) * Math.sin(u)];
  for (let i = 0; i < 40; i++) {
    const u = (i / 40) * Math.PI * 2;
    s.push(...poly([P(u, -0.5), P(u, 0.5)]));
  }
  for (const v of [-0.5, 0.5]) {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 160; i++) pts.push(P((i / 160) * Math.PI * 4, v));
    s.push(...poly(pts));
  }
  return fit(s);
}

/** Smoothed escape count of the Mandelbrot iteration. */
function escape(cx: number, cy: number, max: number) {
  let x = 0;
  let y = 0;
  for (let i = 0; i < max; i++) {
    const xx = x * x - y * y + cx;
    y = 2 * x * y + cy;
    x = xx;
    const m = x * x + y * y;
    if (m > 256) return i + 1 - Math.log2(Math.log2(m) / 2);
  }
  return max;
}

/** Contour lines of a scalar field on a grid (marching squares), as flat segments. */
export function contours(f: (x: number, z: number) => number, x0: number, x1: number, z0: number, z1: number, n: number, levels: number[]): Segs {
  const s: Segs = [];
  const W = n + 1;
  const v = new Float32Array(W * W);
  const X = (i: number) => x0 + ((x1 - x0) * i) / n;
  const Z = (j: number) => z0 + ((z1 - z0) * j) / n;
  for (let i = 0; i < W; i++) for (let j = 0; j < W; j++) v[i * W + j] = f(X(i), Z(j));
  const cut: number[] = [];
  const edge = (ia: number, ja: number, va: number, ib: number, jb: number, vb: number, L: number) => {
    const t = (L - va) / (vb - va);
    cut.push(X(ia + (ib - ia) * t), Z(ja + (jb - ja) * t));
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = v[i * W + j];
      const b = v[(i + 1) * W + j];
      const c = v[(i + 1) * W + j + 1];
      const d = v[i * W + j + 1];
      for (const L of levels) {
        cut.length = 0;
        if (a < L !== b < L) edge(i, j, a, i + 1, j, b, L);
        if (b < L !== c < L) edge(i + 1, j, b, i + 1, j + 1, c, L);
        if (c < L !== d < L) edge(i + 1, j + 1, c, i, j + 1, d, L);
        if (d < L !== a < L) edge(i, j + 1, d, i, j, a, L);
        for (let k = 0; k + 3 < cut.length; k += 4) s.push(cut[k], 0, cut[k + 1], cut[k + 2], 0, cut[k + 3]);
      }
    }
  }
  return s;
}

export function mandelbrot(): Segs {
  return fit(contours((x, z) => escape(x, z, 60), -2.2, 0.8, -1.5, 1.5, 110, [4, 6, 9, 14, 24, 59]));
}

export function sierpinski(depth = 5): Segs {
  const s: Segs = [];
  const tri = (a: [number, number], b: [number, number], c: [number, number], d: number) => {
    if (d === 0) {
      s.push(...flat([a, b, c], true));
      return;
    }
    const ab: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const bc: [number, number] = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
    const ca: [number, number] = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
    tri(a, ab, ca, d - 1);
    tri(ab, b, bc, d - 1);
    tri(ca, bc, c, d - 1);
  };
  tri([0, 1], [-0.866, -0.5], [0.866, -0.5], depth);
  return fit(s);
}

export function koch(depth = 4): Segs {
  let pts: [number, number][] = [
    [0, 1],
    [0.866, -0.5],
    [-0.866, -0.5],
  ];
  for (let d = 0; d < depth; d++) {
    const next: [number, number][] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const dx = (b[0] - a[0]) / 3;
      const dz = (b[1] - a[1]) / 3;
      const p1: [number, number] = [a[0] + dx, a[1] + dz];
      const p2: [number, number] = [a[0] + 2 * dx, a[1] + 2 * dz];
      // The bump points outward (the curve runs clockwise).
      const px: [number, number] = [p1[0] + dx * 0.5 - dz * 0.866, p1[1] + dz * 0.5 + dx * 0.866];
      next.push(a, p1, px, p2);
    }
    pts = next;
  }
  return fit(flat(pts, true));
}

export function hypercube(): Segs {
  const s: Segs = [];
  const v: number[][] = [];
  for (let i = 0; i < 16; i++) v.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
  // A turn in the x-w and y-z planes, then perspective from the fourth dimension.
  const a = 0.5;
  const b = 0.35;
  const P = (p: number[]): [number, number, number] => {
    const x = p[0] * Math.cos(a) - p[3] * Math.sin(a);
    const w = p[0] * Math.sin(a) + p[3] * Math.cos(a);
    const y = p[1] * Math.cos(b) - p[2] * Math.sin(b);
    const z = p[1] * Math.sin(b) + p[2] * Math.cos(b);
    const k = 1 / (2.6 - w);
    return [x * k, y * k, z * k];
  };
  for (let i = 0; i < 16; i++) {
    for (let j = i + 1; j < 16; j++) {
      const d = i ^ j;
      if (d && !(d & (d - 1))) s.push(...poly([P(v[i]), P(v[j])]));
    }
  }
  return fit(s);
}

export function fibonacci(): Segs {
  const s: Segs = [];
  // Squares of Fibonacci sides spiralling out, each with its quarter circle.
  const F = [1, 1, 2, 3, 5, 8, 13, 21];
  let x = 0;
  let z = 0;
  const dirs = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  let minX = 0;
  let minZ = 0;
  let maxX = 1;
  let maxZ = 1;
  F.forEach((f, k) => {
    let sx: number;
    let sz: number;
    if (k === 0) {
      sx = 0;
      sz = 0;
    } else {
      const d = dirs[k % 4];
      if (d[0] === 1) {
        sx = maxX;
        sz = minZ;
      } else if (d[1] === 1) {
        sx = maxX - f;
        sz = maxZ;
      } else if (d[0] === -1) {
        sx = minX - f;
        sz = maxZ - f;
      } else {
        sx = minX;
        sz = minZ - f;
      }
    }
    x = sx;
    z = sz;
    s.push(
      ...flat(
        [
          [x, z],
          [x + f, z],
          [x + f, z + f],
          [x, z + f],
        ],
        true,
      ),
    );
    // Quarter arc inside the square, joining the spiral.
    const corner = [
      [x, z + f],
      [x, z],
      [x + f, z],
      [x + f, z + f],
    ][k % 4];
    const start = [0, Math.PI / 2, Math.PI, Math.PI * 1.5][k % 4] - Math.PI / 2;
    const arc: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const t = start + (i / 12) * (Math.PI / 2);
      arc.push([corner[0] + Math.cos(t) * f, corner[1] + Math.sin(t) * f]);
    }
    s.push(...flat(arc));
    minX = Math.min(minX, x);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x + f);
    maxZ = Math.max(maxZ, z + f);
  });
  return fit(s);
}

export function lissajous(): Segs {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < 600; i++) {
    const t = (i / 600) * Math.PI * 2;
    pts.push([Math.sin(3 * t + 0.5), Math.sin(4 * t), Math.sin(5 * t + 1.1)]);
  }
  return fit(poly(pts, true));
}

export function hexagons(): Segs {
  const s: Segs = [];
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) {
      if (Math.abs(q + r) > 3) continue;
      const cx = 1.5 * q;
      const cz = Math.sqrt(3) * (r + q / 2);
      const hex: [number, number][] = [];
      for (let k = 0; k < 6; k++) hex.push([cx + Math.cos((k * Math.PI) / 3), cz + Math.sin((k * Math.PI) / 3)]);
      s.push(...flat(hex, true));
    }
  }
  return fit(s);
}

export function graph(seed: () => number): Segs {
  const n = 22;
  const p: [number, number, number][] = [];
  for (let i = 0; i < n; i++) p.push([seed() * 2 - 1, seed() * 2 - 1, seed() * 2 - 1]);
  const s: Segs = [];
  for (let i = 0; i < n; i++) {
    // Each node to its two nearest neighbours, and a small cross at each node.
    const d = p.map((q, j) => [Math.hypot(q[0] - p[i][0], q[1] - p[i][1], q[2] - p[i][2]), j]).sort((a, b) => a[0] - b[0]);
    for (const [, j] of d.slice(1, 3)) s.push(...poly([p[i], p[j]]));
    const e = 0.05;
    s.push(p[i][0] - e, p[i][1], p[i][2], p[i][0] + e, p[i][1], p[i][2], p[i][0], p[i][1] - e, p[i][2], p[i][0], p[i][1] + e, p[i][2]);
  }
  return fit(s);
}

export function dragon(order = 10): Segs {
  let turns: number[] = [];
  for (let i = 0; i < order; i++) turns = [...turns, 1, ...turns.map((t) => -t).reverse()];
  let x = 0;
  let z = 0;
  let dir = 0;
  const pts: [number, number][] = [[0, 0]];
  const step = () => {
    x += [1, 0, -1, 0][dir];
    z += [0, 1, 0, -1][dir];
    pts.push([x, z]);
  };
  step();
  for (const t of turns) {
    dir = (dir + (t > 0 ? 1 : 3)) % 4;
    step();
  }
  return fit(flat(pts));
}

export function icosphere(): Segs {
  const t = (1 + Math.sqrt(5)) / 2;
  let verts: [number, number, number][] = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ];
  let faces = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  const norm = (v: [number, number, number]): [number, number, number] => {
    const l = Math.hypot(...v);
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  verts = verts.map(norm);
  // One subdivision.
  const mid = new Map<string, number>();
  const m = (a: number, b: number) => {
    const key = a < b ? `${a},${b}` : `${b},${a}`;
    let i = mid.get(key);
    if (i === undefined) {
      i = verts.push(norm([(verts[a][0] + verts[b][0]) / 2, (verts[a][1] + verts[b][1]) / 2, (verts[a][2] + verts[b][2]) / 2])) - 1;
      mid.set(key, i);
    }
    return i;
  };
  faces = faces.flatMap(([a, b, c]) => {
    const ab = m(a, b);
    const bc = m(b, c);
    const ca = m(c, a);
    return [
      [a, ab, ca],
      [b, bc, ab],
      [c, ca, bc],
      [ab, bc, ca],
    ];
  });
  const edges = new Set<string>();
  const s: Segs = [];
  for (const f of faces) {
    for (let k = 0; k < 3; k++) {
      const a = f[k];
      const b = f[(k + 1) % 3];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (edges.has(key)) continue;
      edges.add(key);
      s.push(...verts[a], ...verts[b]);
    }
  }
  return fit(s);
}

export function hilbert(order = 4): Segs {
  const n = 1 << order;
  const pts: [number, number][] = [];
  for (let d = 0; d < n * n; d++) {
    let rx: number;
    let ry: number;
    let t = d;
    let x = 0;
    let y = 0;
    for (let s = 1; s < n; s *= 2) {
      rx = 1 & (t / 2);
      ry = 1 & (t ^ rx);
      if (ry === 0) {
        if (rx === 1) {
          x = s - 1 - x;
          y = s - 1 - y;
        }
        [x, y] = [y, x];
      }
      x += s * rx;
      y += s * ry;
      t = Math.floor(t / 4);
    }
    pts.push([x, y]);
  }
  return fit(flat(pts));
}

export function rose(): Segs {
  const pts: [number, number][] = [];
  // r = cos(5θ/3): closes after 6π.
  for (let i = 0; i <= 720; i++) {
    const th = (i / 720) * Math.PI * 6;
    const r = Math.cos((5 * th) / 3);
    pts.push([r * Math.cos(th), r * Math.sin(th)]);
  }
  return fit(flat(pts));
}

export function apollonius(): Segs {
  // An Apollonian gasket: three touching circles in a bounding one, then the gaps filled by
  // Descartes' theorem, a few levels deep.
  type C = { k: number; x: number; z: number };
  const circles: C[] = [];
  const r1 = 2 * Math.sqrt(3) - 3;
  const outer: C = { k: -1, x: 0, z: 0 };
  const inner: C[] = [0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;
    return { k: 1 / r1, x: Math.cos(a) * (1 - r1), z: Math.sin(a) * (1 - r1) };
  });
  circles.push(outer, ...inner);
  // Complex Descartes: z4 = z1 + z2 + z3 ± 2 sqrt(z1 z2 + z2 z3 + z3 z1), with z = k * centre.
  const fourth = (a: C, b: C, c: C, avoid: C): C | null => {
    const k = a.k + b.k + c.k + 2 * Math.sqrt(Math.max(0, a.k * b.k + b.k * c.k + c.k * a.k));
    const zr = a.k * a.x + b.k * b.x + c.k * c.x;
    const zi = a.k * a.z + b.k * b.z + c.k * c.z;
    // sqrt of the complex sum of products.
    const pr = a.k * a.x * (b.k * b.x) - a.k * a.z * (b.k * b.z) + (b.k * b.x * (c.k * c.x) - b.k * b.z * (c.k * c.z)) + (c.k * c.x * (a.k * a.x) - c.k * c.z * (a.k * a.z));
    const pi = a.k * a.x * (b.k * b.z) + a.k * a.z * (b.k * b.x) + (b.k * b.x * (c.k * c.z) + b.k * b.z * (c.k * c.x)) + (c.k * c.x * (a.k * a.z) + c.k * c.z * (a.k * a.x));
    const mod = Math.sqrt(Math.hypot(pr, pi));
    const ang = Math.atan2(pi, pr) / 2;
    const sr = mod * Math.cos(ang);
    const si = mod * Math.sin(ang);
    for (const sign of [1, -1]) {
      const x = (zr + 2 * sign * sr) / k;
      const z = (zi + 2 * sign * si) / k;
      if (Math.hypot(x - avoid.x, z - avoid.z) > 1e-3 && Math.hypot(x, z) + 1 / k <= 1.0001) return { k, x, z };
    }
    return null;
  };
  let queue: [C, C, C, C][] = [
    [outer, inner[0], inner[1], inner[2]],
    [outer, inner[1], inner[2], inner[0]],
    [outer, inner[2], inner[0], inner[1]],
    [inner[0], inner[1], inner[2], outer],
  ];
  for (let depth = 0; depth < 4; depth++) {
    const next: [C, C, C, C][] = [];
    for (const [a, b, c, avoid] of queue) {
      const d = fourth(a, b, c, avoid);
      if (!d || d.k > 60) continue;
      circles.push(d);
      next.push([a, b, d, c], [b, c, d, a], [c, a, d, b]);
    }
    queue = next;
  }
  const s: Segs = [];
  for (const c of circles) {
    const r = Math.abs(1 / c.k);
    const n = Math.max(10, Math.round(r * 64));
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) pts.push([c.x + Math.cos((i / n) * Math.PI * 2) * r, c.z + Math.sin((i / n) * Math.PI * 2) * r]);
    s.push(...flat(pts, true));
  }
  return fit(s);
}

export function rule30(): Segs {
  // Rule 30 from a single cell: each live run drawn as a short horizontal stroke.
  const W = 63;
  let row = new Array<number>(W).fill(0);
  row[31] = 1;
  const s: Segs = [];
  for (let y = 0; y < 32; y++) {
    let start = -1;
    for (let x = 0; x <= W; x++) {
      const on = x < W && row[x] === 1;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        s.push(start, 0, y, x - 0.15, 0, y);
        start = -1;
      }
    }
    const next = new Array<number>(W).fill(0);
    for (let x = 0; x < W; x++) {
      const l = row[(x + W - 1) % W];
      const c = row[x];
      const r = row[(x + 1) % W];
      next[x] = (30 >> ((l << 2) | (c << 1) | r)) & 1;
    }
    row = next;
  }
  return fit(s);
}
