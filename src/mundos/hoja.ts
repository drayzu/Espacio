import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { ARBOL } from './arbol';

/**
 * A leaf. 1 unit = 1 mm; midrib along x (base at -40, tip at +40), blade in the (x, y) plane,
 * facing +z. Midrib, ten secondary veins a side looping towards the margin, ladder-like tertiary
 * veins between them and, around our patch of tissue, the fine network of areoles.
 * Particle sizes are physical, so the fine veins only appear as you come close: free detail.
 * Arrival: the leaf assembles outward from our tissue. Moment: it tilts into the light.
 */

const halfWidth = (x: number) => {
  const t = THREE.MathUtils.clamp((x + 40) / 80, 0, 1);
  return 24 * Math.pow(Math.sin(Math.PI * t), 0.85) * (1.2 - 0.4 * t);
};
/** The blade arches gently. */
const surfZ = (x: number, y: number) => 0.004 * y * y - 0.0012 * x * x;

/**
 * Water in the veins: small points along the midrib and the secondary veins, each knowing how far
 * it is from the petiole along the veins; soft pulses run outward along that distance, as the
 * water the sentence speaks of. Screen-sized points, faded where the leaf is seen edge on.
 */
const FLOW_VERT = /* glsl */ `
  attribute float aPath;
  uniform float uTime;
  uniform float uAlpha;
  varying float vL;
  void main() {
    float ph = fract(aPath / 26.0 - uTime * 0.22);
    vL = smoothstep(0.0, 0.04, ph) * (1.0 - smoothstep(0.04, 0.2, ph)) * uAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float facing = abs(dot(normalize(normalMatrix * vec3(0.0, 0.0, 1.0)), normalize(-mv.xyz)));
    vL *= smoothstep(0.05, 0.4, facing);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 2.4;
    if (vL < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;
const FLOW_FRAG = /* glsl */ `
  varying float vL;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    gl_FragColor = vec4(vec3(0.85, 1.0, 0.92) * vL * exp(-dot(c, c) * 12.0), 1.0);
  }
`;

export const HOJA = (() => {
  const anchor = new THREE.Vector3(6, 10, surfZ(6, 10));
  // Our tissue lies on the blade: tilt it to the blade's normal there.
  const normal = new THREE.Vector3(0.0024 * 6, -0.008 * 10, 1).normalize();
  const anchorRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  return { anchor, anchorRot, halfWidth };
})();

type P2 = [number, number];
const bezier = (a: P2, b: P2, c: P2, t: number): P2 => [
  (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0],
  (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1],
];

export function hoja(): WorldModule {
  return {
    spec: {
      id: 'hoja',
      territory: 'vida',
      name: 'Una hoja',
      fact: 'Una red de nervaduras lleva agua a cada una de sus millones de células.',
      label: 'hoja',
      unitExp: -3,
      frame: 100,
      anchor: ARBOL.anchor,
      anchorRot: ARBOL.anchorRot,
      frameCenter: new THREE.Vector3(0, 0, 0),
      view: 'continue',
      // In early: the areoles must already surround our tissue as it shrinks.
      fade: [-3.0, -2.3, 1.1, 1.6],
      tint: 0x9fe08a,
      notes: (() => {
        const on = (x: number, y: number): [number, number, number] => [x, y, surfZ(x, y)];
        const vein = bezier([2, 0], [2 + 0.45 * 16.5, 0.72 * halfWidth(8)], [18.5, 0.9 * halfWidth(18.5)], 0.55);
        return [
          { at: HOJA.anchor.toArray(), text: 'nuestro tejido' },
          { at: on(-18, 0), text: 'nervadura central' },
          { at: on(vein[0], vein[1]), text: 'nervadura secundaria' },
          { at: on(-52, 0), text: 'pecíolo' },
        ];
      })(),
      generate() {
        const b = cloudBuilder(111);
        const { r } = b;
        const A = HOJA.anchor;
        const delayOf = (x: number, y: number) => Math.min(1, Math.hypot(x - A.x, y - A.y) / 75) * 0.9 + r() * 0.05;
        const put = (x: number, y: number, hex: number, size: number, light: number, flag = false, lift = 0) =>
          b.push(x, y, surfZ(x, y) + lift, hex, size, 0.002, light, { delay: flag ? 0 : delayOf(x, y), flag });

        /** Points along a polyline-ish curve with a thickness that tapers from w0 to w1. */
        const vein = (f: (t: number) => P2, len: number, w0: number, w1: number, hex: number, size: number, light: number, density = 60) => {
          const n = Math.max(8, Math.round(len * density * (w0 + w1)));
          for (let k = 0; k < n; k++) {
            const t = r();
            const [x, y] = f(t);
            const w = w0 + (w1 - w0) * t;
            put(x + gauss(r) * w * 0.35, y + gauss(r) * w * 0.35, hex, size, light, false, gauss(r) * w * 0.2);
          }
        };

        // Petiole and midrib.
        vein((t) => [-62 + t * 22, 0], 22, 1.1, 0.95, 0xc8e07a, 1.6, 0.18, 30);
        vein((t) => [-40 + t * 79.5, 0], 80, 0.95, 0.15, 0xd8f08a, 1.4, 0.2, 30);

        // Secondary veins, looping towards the margin; tertiaries as rungs between them.
        const secs: Record<number, ((t: number) => P2)[]> = { 1: [], [-1]: [] };
        for (const s of [1, -1]) {
          for (let k = 0; k < 10; k++) {
            const x0 = -33 + k * 7;
            // Towards the tip they shorten, so none runs past it.
            const L = Math.min(15 + k * 0.3, 36 - x0);
            const p0: P2 = [x0, 0];
            const p1: P2 = [x0 + 0.45 * L, s * 0.72 * halfWidth(x0 + 6)];
            const p2: P2 = [x0 + L, s * 0.9 * halfWidth(x0 + L)];
            const f = (t: number) => bezier(p0, p1, p2, t);
            secs[s].push(f);
            vein(f, L * 1.2, 0.32, 0.08, 0xd2ec88, 0.8, 0.3);
          }
          for (let k = 0; k < 9; k++) {
            const fa = secs[s][k];
            const fb = secs[s][k + 1];
            for (let u = 0.12; u < 0.98; u += 0.075) {
              const [ax, ay] = fa(u);
              const [bx, by] = fb(Math.min(1, u * 0.92 + 0.04));
              const wob = (r() - 0.5) * 1.2;
              const len = Math.hypot(bx - ax, by - ay);
              vein((t) => [ax + (bx - ax) * t + Math.sin(t * Math.PI) * wob * 0.3, ay + (by - ay) * t + Math.sin(t * Math.PI) * wob], len, 0.07, 0.07, 0xbfe07e, 0.35, 0.3, 40);
            }
          }
        }

        // Around our tissue: the fine network of areoles (about 0.5 mm), our patch in the middle of one.
        const G = 0.5;
        const N = 13;
        const node = (i: number, j: number): P2 => {
          const h = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
          const jx = (h - Math.floor(h) - 0.5) * 0.18;
          const h2 = Math.sin(i * 39.346 + j * 11.135) * 24634.6345;
          const jy = (h2 - Math.floor(h2) - 0.5) * 0.18;
          return [A.x + (i + 0.5) * G + jx, A.y + (j + 0.5) * G + jy];
        };
        for (let i = -N; i < N; i++) {
          for (let j = -N; j < N; j++) {
            const a = node(i, j);
            if (Math.hypot(a[0] - A.x, a[1] - A.y) > N * G) continue;
            for (const [di, dj] of [
              [1, 0],
              [0, 1],
            ]) {
              const c = node(i + di, j + dj);
              vein((t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t], G, 0.03, 0.03, 0xb0d878, 0.12, 0.34, 220);
            }
          }
        }
        // The cells themselves, as a fine texture fading out from our patch.
        for (let k = 0; k < 16000; k++) {
          const rad = Math.pow(r(), 0.6) * 1.4;
          const th = r() * Math.PI * 2;
          const x = A.x + Math.cos(th) * rad;
          const y = A.y + Math.sin(th) * rad;
          const ours = rad < 0.1;
          put(x, y, ours ? 0xffb070 : k % 3 ? 0x7cc86a : 0xffa24a, 0.05, ours ? 0.6 : 0.3, ours);
        }

        // Blade and margin.
        for (let k = 0; k < 52000; k++) {
          const x = -40 + r() * 80;
          const w = halfWidth(x);
          const y = (r() * 2 - 1) * w;
          put(x, y, 0x3fae5a, 1.0, 0.11);
        }
        for (let k = 0; k < 5000; k++) {
          const x = -40 + r() * 80;
          const s = r() < 0.5 ? 1 : -1;
          put(x, s * halfWidth(x) * (1 + gauss(r) * 0.006), 0x8fe07a, 0.7, 0.4);
        }

        // Water: points along the midrib and the secondaries, with their distance from the
        // petiole along the veins.
        const fpos: number[] = [];
        const fpath: number[] = [];
        const water = (x: number, y: number, path: number) => {
          fpos.push(x, y, surfZ(x, y) + 0.05);
          fpath.push(path);
        };
        for (let k = 0; k < 1400; k++) {
          const x = -62 + r() * 101.5;
          water(x, gauss(r) * 0.15, x + 62);
        }
        for (const sd of [1, -1]) {
          secs[sd].forEach((fv, k) => {
            const x0 = -33 + k * 7;
            const L = Math.min(15 + k * 0.3, 36 - x0) * 1.2;
            for (let j = 0; j < 160; j++) {
              const t = r();
              const [x, y] = fv(t);
              water(x + gauss(r) * 0.06, y + gauss(r) * 0.06, x0 + 62 + t * L);
            }
          });
        }

        return { main: b.data(), flow: { position: new Float32Array(fpos), aPath: new Float32Array(fpath) } };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 0.3, 1);
        cloud.u.uSurface.value.set(0, 0, 1, 0.85);
        const fd = data.flow as { position: Float32Array; aPath: Float32Array };
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(fd.position, 3));
        geo.setAttribute('aPath', new THREE.BufferAttribute(fd.aPath, 1));
        const flowU = { uTime: { value: 0 }, uAlpha: { value: 0 } };
        const flow = new THREE.Points(
          geo,
          new THREE.ShaderMaterial({ vertexShader: FLOW_VERT, fragmentShader: FLOW_FRAG, uniforms: flowU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
        );
        flow.frustumCulled = false;
        const object = new THREE.Group();
        object.add(cloud.points, flow);
        return {
          object,
          clouds: [cloud],
          update(f) {
            cloud.u.uReveal.value = f.tl.get('hoja.form', f.p);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('tejido'), f.e, f.home);
            // The water shows once the whole leaf is in view, and goes with it.
            flowU.uTime.value = f.time;
            flowU.uAlpha.value = 0.55 * f.alpha * smoothstep(f.home - 0.9, f.home - 0.35, f.e) * (1 - smoothstep(f.home + 0.5, f.home + 0.9, f.e));
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'hoja.form': 0 });
      // The network of veins grows around our tissue as we pull out.
      tl.to(4.0, { e: w.home - 0.15, 'hoja.form': 1, pitch: 0.25, yaw: -0.1, roll: 0, fov: 40 });
      tl.label('hoja');
      // Tilt it into the light.
      tl.to(2.6, { pitch: 0.65, yaw: 0.45, roll: 0.12, e: w.home + 0.05, fov: 46 });
    },
  };
}
