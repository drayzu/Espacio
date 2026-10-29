import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, warp, type PointsData } from '../engine/points';

/**
 * A tree. 1 unit = 1 m, y up. Recursive branching (three children per branch, seven levels),
 * about eleven thousand leaves at the tips. One of them is ours.
 * Arrival: the tree grows from our leaf along the branches to the trunk, then out to the rest
 * of the crown, ordered by distance along the wood. Moment: a walk around it, the crown swaying in
 * a breeze (only with the whole tree in view: closer in, our leaf must stay where the leaf's world
 * sits).
 */

/** The breeze: the higher a point, the more it sways; the trunk barely moves. */
const WIND = /* glsl */ `
  float hgt = max(0.0, p.y - 1.5) / 9.0;
  float gust = 0.75 + 0.25 * sin(uTime * 0.23);
  p.x += uWind * gust * hgt * hgt * (0.22 * sin(uTime * 0.8 + p.x * 0.12 + p.z * 0.07) + 0.05 * sin(uTime * 1.9 + p.y * 0.4));
  p.z += uWind * gust * hgt * hgt * 0.1 * sin(uTime * 0.6 + p.x * 0.1 + 1.3);
`;

interface Seg {
  a: THREE.Vector3;
  b: THREE.Vector3;
  r: number;
  depth: number;
  parent: number;
  /** Length of wood from the root to this segment's end. */
  reach: number;
}

const DEPTH = 7;

export const ARBOL = (() => {
  const r = rng(121);
  const segs: Seg[] = [];
  const tips: number[] = [];
  const up = new THREE.Vector3(0, 1, 0);
  const grow = (a: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number, parent: number) => {
    const b = a.clone().addScaledVector(dir, len);
    const reach = (parent >= 0 ? segs[parent].reach : 0) + len;
    const id = segs.push({ a, b, r: rad, depth, parent, reach }) - 1;
    if (depth === DEPTH) {
      tips.push(id);
      return;
    }
    const n = depth === 0 ? 4 : 3;
    const turn = r() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      // Spread around the parent, lean outward, and reach for the light.
      const side = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : up).normalize();
      side.applyAxisAngle(dir, turn + (k / n) * Math.PI * 2 + (r() - 0.5) * 0.6);
      const spread = depth === 0 ? 0.75 : 0.42 + r() * 0.3;
      const d = dir.clone().multiplyScalar(Math.cos(spread)).addScaledVector(side, Math.sin(spread));
      d.y += 0.18 * (1 - depth / DEPTH);
      d.normalize();
      grow(b, d, len * (0.66 + r() * 0.14), rad * 0.62, depth + 1, id);
    }
  };
  grow(new THREE.Vector3(0, 0, 0), up.clone(), 3.4, 0.24, 0, -1);

  // Leaves at the tips; ours is a leaf facing us at middle height on the front of the crown.
  const leaves: { p: THREE.Vector3; x: THREE.Vector3; n: THREE.Vector3; seg: number }[] = [];
  for (const id of tips) {
    const s = segs[id];
    const dir = s.b.clone().sub(s.a).normalize();
    for (let k = 0; k < 5; k++) {
      const x = dir.clone().add(new THREE.Vector3(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.6)).normalize();
      const n = new THREE.Vector3(gauss(r), gauss(r), gauss(r)).cross(x).normalize();
      leaves.push({ p: s.b.clone().addScaledVector(x, 0.05 + r() * 0.06), x, n, seg: id });
    }
  }
  let ours = 0;
  let best = -Infinity;
  leaves.forEach((l, i) => {
    const score = l.p.z * 1.0 - Math.abs(l.p.y - 6.5) * 0.8 - Math.abs(l.p.x) * 0.5;
    if (score > best) {
      best = score;
      ours = i;
    }
  });
  // Ours faces the viewer (+z), its midrib running out along its twig.
  const leaf = leaves[ours];
  leaf.n.set(0.15, 0.1, 1).normalize();
  leaf.x.sub(leaf.n.clone().multiplyScalar(leaf.x.dot(leaf.n))).normalize();
  const y = leaf.n.clone().cross(leaf.x);
  const anchorRot = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(leaf.x, y, leaf.n));
  return { segs, leaves, ours, anchor: leaf.p.clone(), anchorRot };
})();

const LEAF_HUES = [0x5fcf6a, 0x7fe07a, 0x4fb85a, 0xa6e070];

export function arbol(): WorldModule {
  return {
    spec: {
      id: 'arbol',
      territory: 'vida',
      name: 'Un árbol',
      fact: 'Once mil hojas, y en cada una, millones de células.',
      label: 'árbol',
      unitExp: 0,
      frame: 16,
      frameCenter: new THREE.Vector3(0, 6.5, 0),
      view: [0.06, 0, 0],
      fade: [-2.0, -1.3, 1.2, 1.8],
      tint: 0x8fe07a,
      notes: [
        { at: ARBOL.anchor.toArray(), text: 'nuestra hoja' },
        { at: [0, 1.6, 0], text: 'tronco' },
        { at: ARBOL.segs[1].b.toArray(), text: 'rama' },
      ],
      generate() {
        const b = cloudBuilder(122);
        const { r } = b;
        const { segs, leaves, ours } = ARBOL;
        const our = leaves[ours];

        // Distance along the wood from our leaf to every segment: through the lowest common ancestor.
        const ancestors = (id: number) => {
          const out = new Set<number>();
          for (let k = id; k >= 0; k = segs[k].parent) out.add(k);
          return out;
        };
        const ourLine = ancestors(our.seg);
        const ourReach = segs[our.seg].reach;
        const dist = segs.map((s, id) => {
          let k = id;
          while (k >= 0 && !ourLine.has(k)) k = segs[k].parent;
          const lca = k >= 0 ? segs[k].reach : 0;
          return ourReach - lca + (s.reach - lca);
        });
        const maxDist = Math.max(...dist);
        const delayOf = (id: number) => (dist[id] / maxDist) * 0.92;

        // Wood: points over each branch's surface, tapering.
        segs.forEach((s, id) => {
          const axis = s.b.clone().sub(s.a);
          const len = axis.length();
          axis.normalize();
          const u = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
          const v = axis.clone().cross(u);
          const n = Math.max(6, Math.round(len * s.r * 9000));
          const d = delayOf(id);
          for (let k = 0; k < n; k++) {
            const t = r();
            const rad = s.r * (1 - 0.38 * t);
            const th = r() * Math.PI * 2;
            const x = s.a.x + axis.x * len * t + (u.x * Math.cos(th) + v.x * Math.sin(th)) * rad;
            const y = s.a.y + axis.y * len * t + (u.y * Math.cos(th) + v.y * Math.sin(th)) * rad;
            const z = s.a.z + axis.z * len * t + (u.z * Math.cos(th) + v.z * Math.sin(th)) * rad;
            b.push(x, y, z, 0x8a6448, 1, 0.002, 0.1, { delay: d });
          }
        });

        // Leaves: small blades of points.
        leaves.forEach((l, i) => {
          const isOurs = i === ours;
          const y = l.n.clone().cross(l.x);
          const d = isOurs ? 0 : delayOf(l.seg) + 0.02;
          const hue = isOurs ? 0x9fe88a : LEAF_HUES[i % LEAF_HUES.length];
          const n = isOurs ? 120 : 10;
          for (let k = 0; k < n; k++) {
            const t = r() * 2 - 1;
            const w = 0.022 * Math.pow(Math.max(0, 1 - t * t), 0.85) * (r() * 2 - 1);
            b.push(
              l.p.x + l.x.x * t * 0.04 + y.x * w,
              l.p.y + l.x.y * t * 0.04 + y.y * w,
              l.p.z + l.x.z * t * 0.04 + y.z * w,
              hue,
              isOurs ? 0.5 : 0.55,
              0.006,
              isOurs ? 0.5 : 0.26,
              { delay: d, flag: isOurs },
            );
          }
        });

        return { main: b.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 0.05, 1);
        const wind = { value: 0 };
        warp(cloud, WIND, { uWind: wind });
        return {
          object: cloud.points,
          clouds: [cloud],
          update(f) {
            wind.value = smoothstep(f.home - 0.75, f.home - 0.3, f.e) * (1 - smoothstep(f.home + 0.5, f.home + 0.9, f.e));
            cloud.u.uReveal.value = f.tl.get('arbol.grow', f.p);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('hoja'), f.e, f.home);
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'arbol.grow': 0 });
      // The tree grows from our leaf back to the trunk and out into the crown. Halfway, the scale is
      // your own (10⁰ m), where the opening began its fall (GUION.md 23): the point again, a moment.
      tl.to(2.2, { e: -0.02, 'arbol.grow': 0.4, yaw: 0.2, pitch: 0.3, roll: 0.05, fov: 44 });
      tl.caption(4.0, 'Tu tamaño', 'Volviste a tu tamaño. Aquí empezó la caída.', 'tú');
      tl.with(1.0, { tu: 1 });
      tl.to(3.0, { e: 0.06, 'arbol.grow': 0.5 });
      tl.to(1.0, { tu: 0, e: 0.1 });
      tl.to(2.8, { e: w.home - 0.2, 'arbol.grow': 1, yaw: 0, pitch: 0.05, roll: 0, fov: 42 });
      tl.label('arbol');
      // Walk around it.
      tl.to(2.8, { yaw: 0.8, pitch: -0.06, e: w.home + 0.05, fov: 48 });
    },
  };
}
