import * as THREE from 'three';
import { gauss, smoothstep } from '../lib/math';
import { perlin3 } from '../lib/puntos';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { TIERRA } from './tierra';

/**
 * A valley. 1 unit = 1 km, y up; our tree stands at the origin. Forest on the valley floor, a lake
 * to the west and a river coming down from the range to the east: the same range the Earth shows.
 * Sampling is log-polar around our tree: dense close to it, sparser and with larger points further
 * out, so there is detail wherever the camera is looking, from metres to kilometres.
 * Lighting is baked from a low afternoon sun so the relief reads in 3D.
 * Arrival: the landscape spreads outward from our tree. Moment: a slow aerial drift.
 */

const R_MIN = 0.006;
const R_MAX = 12;
const SUN = new THREE.Vector3(-0.55, 0.55, 0.35).normalize();
// East and north on the valley floor, from the valley's place on the Earth.
const toLocal = TIERRA.anchorRot.clone().invert();
const LON = Math.atan2(TIERRA.normal.z, TIERRA.normal.x);
const LAT = Math.asin(TIERRA.normal.y);
const EAST = new THREE.Vector3(-Math.sin(LON), 0, Math.cos(LON)).applyQuaternion(toLocal);
const NORTH = new THREE.Vector3(-Math.sin(LAT) * Math.cos(LON), Math.cos(LAT), -Math.sin(LAT) * Math.sin(LON)).applyQuaternion(toLocal);
const at = (east: number, north: number) => ({ x: EAST.x * east + NORTH.x * north, z: EAST.z * east + NORTH.z * north });
const lake = at(-1.8, -0.7);
const LAKE = { x: lake.x, z: lake.z, r: 0.75 };

const noise = perlin3(131);
const rawHeight = (x: number, z: number) => {
  const east = x * EAST.x + z * EAST.z;
  const d = Math.hypot(x, z);
  // The range rises to the east; low hills elsewhere.
  const range = smoothstep(1.8, 7, east) * (1.5 + 1.3 * noise(x * 0.22, 0.5, z * 0.22, 4));
  const ridge = Math.pow(1 - Math.abs(noise(x * 0.35 + 7, 1.3, z * 0.35, 3) * 2), 3) * smoothstep(3, 8, east) * 0.9;
  const foothills = (0.12 + 0.18 * noise(x * 0.5, 6.1, z * 0.5, 3)) * smoothstep(3, 9, d) * (1 - smoothstep(0, 4, east));
  const hills = noise(x * 1.4, 2.1, z * 1.4, 3) * 0.07 * (1 - smoothstep(2, 6, d)) + noise(x * 14, 3.3, z * 14, 2) * 0.006;
  return range + ridge + foothills + hills;
};
const H0 = rawHeight(0, 0);
const height = (x: number, z: number) => rawHeight(x, z) - H0;
const lakeLevel = Math.min(height(LAKE.x, LAKE.z) - 0.01, -0.01);

export function valle(): WorldModule {
  return {
    spec: {
      id: 'valle',
      territory: 'Tierra',
      name: 'Un valle',
      fact: 'Millones de árboles, y bajo cada uno, raíces, hojas y células.',
      label: 'valle',
      unitExp: 3,
      anchor: TIERRA.anchor,
      anchorRot: TIERRA.anchorRot,
      frame: 22,
      frameCenter: new THREE.Vector3(0.6, 0, -1.2),
      view: [0.62, 0, 0],
      fade: [-2.7, -2.0, 1.2, 1.8],
      tint: 0x9fd0ff,
      notes: (() => {
        const ground = (east: number, north: number): [number, number, number] => {
          const p = at(east, north);
          return [p.x, height(p.x, p.z), p.z];
        };
        const t = 0.42;
        return [
          { at: [0, 0.01, 0], text: 'nuestro árbol' },
          { at: [LAKE.x, lakeLevel, LAKE.z], text: 'lago' },
          { at: ground(-1.8 + 8.5 * t + Math.sin(t * 9) * 0.3, -0.7 + 2.2 * t + Math.cos(t * 7) * 0.35), text: 'río' },
          { at: ground(6.8, 0.8), text: 'cordillera' },
        ];
      })(),
      generate() {
        const b = cloudBuilder(132);
        const { r } = b;
        const lnSpan = Math.log(R_MAX / R_MIN);
        const delayOf = (d: number) => Math.min(1, Math.max(0, Math.log(Math.max(d, R_MIN) / R_MIN) / lnSpan)) * 0.92;
        const n = new THREE.Vector3();
        const shade = (x: number, z: number) => {
          const e = 0.02;
          n.set(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)).normalize();
          return 0.12 + 1.25 * Math.pow(Math.max(0, n.dot(SUN)), 1.4);
        };
        const inLake = (x: number, z: number) => Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r * (1 + 0.15 * Math.sin(Math.atan2(z - LAKE.z, x - LAKE.x) * 3));

        // Ground.
        const ground = (d: number, th: number) => {
          const x = Math.cos(th) * d;
          const z = Math.sin(th) * d;
          const D = Math.max(d, R_MIN);
          const size = D * 0.022 + 0.0004;
          // The minimum size makes the ground near the tree cover itself many times over: dim it
          // a little there, so the tree stands in a soft pool of light rather than a glare.
          const even = (D * 0.022) / size;
          if (inLake(x, z)) {
            b.push(x, lakeLevel, z, 0x3f7fd0, size, 0, 0.45 * even, { delay: delayOf(d) });
            return;
          }
          const h = height(x, z);
          const s = shade(x, z);
          let hex = 0x2f6a3a;
          if (h > 2.25 + noise(x, 4.2, z, 2) * 0.35) hex = 0xeef4ff;
          else if (h > 1.1) hex = 0x8a7f72;
          else if (h > 0.45) hex = 0x55704a;
          else if (noise(x * 3, 5.1, z * 3, 2) > 0.12) hex = 0x6a8f4a;
          // Distance haze: the patch of land fades out instead of ending at an edge.
          const haze = 1 - smoothstep(R_MAX * 0.5, R_MAX, d);
          b.push(x, h, z, hex, size, 0, (hex === 0xeef4ff ? 0.34 : hex === 0x8a7f72 ? 0.2 : 0.3) * s * haze * even, { delay: delayOf(d) });
        };
        for (let k = 0; k < 150000; k++) ground(R_MIN * Math.exp(r() * lnSpan), r() * Math.PI * 2);
        // The river, meandering down from the mountains into the lake.
        for (let k = 0; k < 9000; k++) {
          const t = r();
          const p = at(-1.8 + 8.5 * t + Math.sin(t * 9) * 0.3, -0.7 + 2.2 * t + Math.cos(t * 7) * 0.35);
          const x = p.x;
          const z = p.z;
          const w = 0.012 + t * 0.01;
          const px = x + gauss(r) * w;
          const pz = z + gauss(r) * w;
          b.push(px, height(px, pz) + 0.002, pz, 0x5f9fe8, 0.012, 0, 0.2, { delay: delayOf(Math.hypot(px, pz)) });
        }
        // Forest: crowns at an even density over the valley floor (a real forest has no favourite tree),
        // keeping a little clearing around ours.
        for (let k = 0; k < 22000; k++) {
          const d = Math.sqrt(r()) * 4.4;
          if (d < 0.02) continue;
          const th = r() * Math.PI * 2;
          const x = Math.cos(th) * d;
          const z = Math.sin(th) * d;
          const h = height(x, z);
          if (h > 1.2 || inLake(x, z)) continue;
          const s = shade(x, z);
          const hue = [0x3f9a4a, 0x5fb85a, 0x2f7f3f][k % 3];
          for (let j = 0; j < 5; j++) {
            b.push(x + gauss(r) * 0.0025, h + 0.009 + gauss(r) * 0.002, z + gauss(r) * 0.0025, hue, 0.006, 0.0002, 0.22 * s, { delay: delayOf(d) });
          }
        }
        // The ground right under our tree (the log-polar sampling starts a few metres out), as
        // dense as where that sampling starts.
        for (let k = 0; k < 9000; k++) ground(R_MIN * Math.sqrt(r()), r() * Math.PI * 2);
        // Our tree's crown: the stand-in.
        for (let k = 0; k < 80; k++) {
          b.push(gauss(r) * 0.003, 0.0075 + gauss(r) * 0.002, gauss(r) * 0.003, 0x9fe88a, 0.004, 0.0002, 0.6, { flag: true });
        }
        return { main: b.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 1, 1);
        cloud.u.uSurface.value.set(0, 1, 0, 1);
        return {
          object: cloud.points,
          clouds: [cloud],
          update(f) {
            cloud.u.uReveal.value = f.tl.get('valle.form', f.p);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('arbol'), f.e, f.home);
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'valle.form': 0 });
      // Crane up: the landscape spreads out from our tree as the camera rises, tilting down to
      // look at it (seen level, the ground would be edge on and fade away). The valley's own view
      // takes over the tilt as the framing moves to it.
      tl.to(2.0, { e: 2.3, 'valle.form': 0.4, yaw: 0.1, pitch: 0.55, fov: 44 });
      tl.to(2.6, { e: w.home - 0.15, 'valle.form': 1, yaw: 0.2, pitch: 0, roll: 0, fov: 40 });
      tl.label('valle');
      // Lower towards the horizon: the peaks stand up around the valley. Meanwhile the Earth
      // begins to assemble round it, so the valley is never a patch of land in the void.
      tl.set({ 'tierra.form': 0 });
      tl.to(3.0, { yaw: 0.7, pitch: -0.14, e: w.home + 0.05, fov: 46, 'tierra.form': 0.05 });
    },
  };
}
