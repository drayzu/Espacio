import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { perlin3 } from '../lib/puntos';
import { fromEquatorial } from '../lib/astro';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { GALAXIA } from './galaxia';

/**
 * Our corner of the galaxy. 1 unit = 10¹⁸ m (about 106 light-years), the Sun at the origin, in the
 * Milky Way's frame (disc in x, z, y towards the north galactic pole). Real places, at their real
 * directions and distances: the Orion Nebula and Barnard's Loop, the Pleiades, the brightest giants
 * around us; and the Radcliffe Wave (found in 2020), a chain of star-forming clouds some 9 000
 * light-years long that passes by the Sun, rising and falling across the galactic plane (its path
 * here is an approximation through Orion, Taurus, Perseus, Cepheus and Cygnus).
 * Arrival: the clouds of the wave light up around us. Moment: a glide towards Orion.
 */

const LY = 1 / 105.7;

/** A direction in galactic longitude and latitude (degrees), at a distance in light-years. */
const atLB = (l: number, b: number, ly: number) => {
  const L = (l * Math.PI) / 180;
  const B = (b * Math.PI) / 180;
  return new THREE.Vector3(-Math.cos(B) * Math.sin(L), Math.sin(B), -Math.cos(B) * Math.cos(L)).multiplyScalar(ly * LY);
};
/** A place by right ascension (h) and declination (°), at a distance in light-years. */
const atEq = (raH: number, decD: number, ly: number) => fromEquatorial(raH, decD, 1).applyQuaternion(GALAXIA.sunRot).normalize().multiplyScalar(ly * LY);

const M42 = atEq(5.588, -5.39, 1344);
const BELT = atEq(5.6, -1.2, 1300);
const PLEIADES = atEq(3.79, 24.1, 444);
const STARS: [string, THREE.Vector3, number, number][] = [
  ['Betelgeuse', atEq(5.92, 7.41, 548), 0xff7a4a, 1.0],
  ['Rigel', atEq(5.24, -8.2, 860), 0xb8d0ff, 1.0],
  ['Antares', atEq(16.49, -26.43, 550), 0xff6a3a, 0.9],
  ['Deneb', atEq(20.69, 45.28, 2600), 0xf0f4ff, 1.0],
  ['Canopus', atEq(6.4, -52.7, 310), 0xfff4e0, 0.8],
];
/** The Radcliffe Wave through its main clouds (galactic l, b, distance in light-years). */
const WAVE: [number, number, number][] = [
  [224, -8, 2300],
  [209, -19, 1350],
  [172, -15, 450],
  [160, -20, 950],
  [135, 2, 1900],
  [110, 12, 2900],
  [92, 6, 3700],
  [80, 1, 4500],
];

export function radcliffe(): WorldModule {
  return {
    spec: {
      id: 'radcliffe',
      territory: 'Vía Láctea',
      name: 'La ola de Radcliffe',
      fact: 'Descubierta en 2020: una ola de nubes de 9 000 años luz pasa junto al Sol. En su cresta, en Orión, nacen estrellas.',
      label: 'Orión',
      unitExp: 18,
      nameSpan: 0.6,
      anchor: GALAXIA.sun,
      frame: 40,
      frameCenter: new THREE.Vector3(),
      view: [0.55, 0, 0],
      fade: [-1.8, -1.2, 1.0, 1.6],
      tint: 0xff8aa8,
      notes: [
        { at: [0, 0, 0], text: 'el Sol' },
        { at: M42.toArray(), text: 'nebulosa de Orión' },
        { at: BELT.clone().add(new THREE.Vector3(0, 0.6, 0)).toArray(), text: 'lazo de Barnard' },
        { at: PLEIADES.toArray(), text: 'Pléyades' },
        ...STARS.filter(([n]) => n !== 'Canopus').map(([text, p]) => ({ at: p.toArray() as [number, number, number], text })),
        { at: atLB(118, 9, 2500).toArray(), text: 'ola de Radcliffe' },
      ],
      generate() {
        const r = rng(281);
        const noise = perlin3(282);
        const b = cloudBuilder(283);
        const delayOf = (p: THREE.Vector3) => Math.min(1, p.length() / 45) * 0.85;

        // The Sun and the stars around it: the stand-in for the neighbourhood.
        for (let k = 0; k < 40; k++) b.push(gauss(r) * 0.002, gauss(r) * 0.002, gauss(r) * 0.002, 0xfff0c0, 0.004, 0, 0.9, { star: true, flag: true });

        // The Radcliffe Wave: clumps of glowing gas strung along a smooth curve.
        const pts = WAVE.map(([l, bb, d]) => atLB(l, bb, d));
        const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
        for (let k = 0; k < 90; k++) {
          const t = (k + r() * 0.6) / 90;
          const c = curve.getPoint(t);
          const rad = 0.25 + r() * 0.5;
          const n = 500 + Math.floor(r() * 700);
          for (let j = 0; j < n; j++) {
            const [x, y, z] = b.onSphere();
            const rr = Math.pow(r(), 0.6) * rad;
            const p = new THREE.Vector3(c.x + x * rr, c.y + y * rr * 0.6, c.z + z * rr);
            const f = noise(p.x * 2, p.y * 2, p.z * 2, 3);
            if (f < -0.1) continue;
            const hot = r() < 0.25;
            b.push(p.x, p.y, p.z, hot ? 0xff7aa8 : 0xd05478, 0.07, 0, (hot ? 0.22 : 0.12) * (0.5 + f), { delay: delayOf(p) });
          }
        }
        // Barnard's Loop: a great arc of glowing hydrogen around Orion's belt, open to the west.
        {
          const toBelt = BELT.clone().normalize();
          const u = new THREE.Vector3(0, 1, 0).sub(toBelt.clone().multiplyScalar(toBelt.y)).normalize();
          const v = toBelt.clone().cross(u);
          for (let k = 0; k < 9000; k++) {
            const a = -2.2 + r() * 2.6;
            const rad = 1.45 * (1 + gauss(r) * 0.04);
            const p = BELT.clone().addScaledVector(u, Math.sin(a) * rad).addScaledVector(v, Math.cos(a) * rad);
            p.addScaledVector(toBelt, gauss(r) * 0.25);
            b.push(p.x, p.y, p.z, 0xff4a6a, 0.06, 0, 0.16 * (0.6 + noise(p.x * 3, p.y * 3, p.z * 3, 2)), { delay: delayOf(p) });
          }
        }
        // The Orion Nebula: a bright glowing core, blue-white where its young stars light it, and
        // the long molecular cloud behind it.
        for (let k = 0; k < 6000; k++) {
          const [x, y, z] = b.onSphere();
          const rr = Math.pow(r(), 1.6) * 0.12;
          const p = M42.clone().add(new THREE.Vector3(x, y, z).multiplyScalar(rr));
          const inner = rr < 0.03;
          b.push(p.x, p.y, p.z, inner ? 0xc8dcff : r() < 0.5 ? 0xff6a9a : 0xff9ab8, 0.016, 0, inner ? 0.5 : 0.3, { delay: delayOf(M42) });
        }
        {
          const along = M42.clone().normalize().add(new THREE.Vector3(0.2, -0.3, 0.1)).normalize();
          for (let k = 0; k < 7000; k++) {
            const t = r();
            const p = M42.clone().addScaledVector(along, t * 1.3).add(new THREE.Vector3(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.08 + t * 0.12));
            b.push(p.x, p.y, p.z, 0xb04a6a, 0.05, 0, 0.1 * (1 - t * 0.6), { delay: delayOf(p) });
          }
        }
        for (let k = 0; k < 4; k++) {
          const p = M42.clone().add(new THREE.Vector3(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.004));
          for (let j = 0; j < 6; j++) b.push(p.x, p.y, p.z, 0xe0ecff, 0.003, 0, 0.8, { star: true, delay: delayOf(M42) });
        }
        // The Pleiades: seven bright blue sisters in a faint blue haze.
        for (let k = 0; k < 9; k++) {
          const p = PLEIADES.clone().add(new THREE.Vector3(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.03));
          for (let j = 0; j < 6; j++) b.push(p.x, p.y, p.z, 0xb8d4ff, 0.003, 0, 0.9, { star: true, delay: delayOf(PLEIADES) });
        }
        for (let k = 0; k < 1500; k++) {
          const p = PLEIADES.clone().add(new THREE.Vector3(gauss(r), gauss(r), gauss(r)).multiplyScalar(0.045));
          b.push(p.x, p.y, p.z, 0x8fb8ff, 0.012, 0, 0.06, { delay: delayOf(PLEIADES) });
        }
        // The disc we live in: thousands of stars in a thin layer around us, so the wave rides
        // among stars instead of floating on black. Its own cloud: pulling out to the whole
        // galaxy it fades, or it would sit on the galaxy's disc as a second, fuzzy one.
        const disc = cloudBuilder(284);
        for (let k = 0; k < 24000; k++) {
          const d = Math.sqrt(r()) * 48;
          const th = r() * Math.PI * 2;
          const p = new THREE.Vector3(Math.cos(th) * d, gauss(r) * 2.2, Math.sin(th) * d);
          const t = r();
          const hex = t < 0.12 ? 0xb8ccff : t < 0.6 ? 0xfff0dc : t < 0.9 ? 0xffd8a8 : 0xff9a70;
          disc.push(p.x, p.y, p.z, hex, 0.004, 0, (0.12 + Math.pow(r(), 4) * 0.5) * (1 - smoothstep(30, 48, d)), { star: true, delay: delayOf(p) });
        }
        // And the glow of the stars too faint to see one by one.
        for (let k = 0; k < 20000; k++) {
          const d = Math.sqrt(r()) * 48;
          const th = r() * Math.PI * 2;
          const p = new THREE.Vector3(Math.cos(th) * d, gauss(r) * 1.6, Math.sin(th) * d);
          disc.push(p.x, p.y, p.z, 0xffe8d0, 1.3, 0, 0.004 * (1 - smoothstep(30, 48, d)), { delay: delayOf(p) });
        }
        // The brightest giants around us.
        for (const [, p, hex, l] of STARS) {
          for (let j = 0; j < 10; j++) b.push(p.x, p.y, p.z, hex, 0.004, 0, l, { star: true, delay: delayOf(p) });
          for (let j = 0; j < 200; j++) {
            const [x, y, z] = b.onSphere();
            const rr = Math.abs(gauss(r)) * 0.06;
            b.push(p.x + x * rr, p.y + y * rr, p.z + z * rr, hex, 0.02, 0, 0.03, { delay: delayOf(p) });
          }
        }
        return { main: b.data(), disc: disc.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 1, 1);
        const disc = cloudFromData(data.disc as PointsData, 1, 1);
        const object = new THREE.Group();
        object.add(cloud.points, disc.points);
        return {
          object,
          clouds: [cloud, disc],
          update(f) {
            const form = f.tl.get('rad.form', f.p);
            cloud.u.uReveal.value = form;
            disc.u.uReveal.value = form;
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('vecindario'), f.e, f.home);
            disc.u.uGain.value = 1 - smoothstep(f.home + 0.2, f.home + 0.7, f.e);
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'rad.form': 0, 'radcliffe.tx': 0, 'radcliffe.ty': 0, 'radcliffe.tz': 0 });
      // The clouds of the wave light up around us as the neighbourhood shrinks.
      tl.to(4.6, { e: w.home - 0.1, 'rad.form': 1, yaw: 0.3, pitch: 0.2, roll: 0, fov: 42 });
      tl.label('radcliffe');
      // A glide towards Orion, where the wave crests and stars are being born.
      const o = BELT.clone().lerp(M42, 0.5);
      // Below this world's home the neighbourhood still weighs in the framing: it travels to the
      // same place, in its own units and frame.
      const v = o.clone().applyQuaternion(GALAXIA.sunRot.clone().invert()).multiplyScalar(100);
      tl.to(3.8, {
        e: w.home - 0.45,
        'radcliffe.tx': o.x,
        'radcliffe.ty': o.y,
        'radcliffe.tz': o.z,
        'vecindario.tx': v.x,
        'vecindario.ty': v.y,
        'vecindario.tz': v.z,
        yaw: -0.2,
        pitch: 0.12,
        fov: 48,
      });
    },
  };
}
