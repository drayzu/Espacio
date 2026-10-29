import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { fromEquatorial } from '../lib/astro';
import { GALAXIA } from './galaxia';
import { lineSet, linesFromData, type LinesData } from './lineas';

/**
 * The Sun's neighbourhood. 1 unit = 10¹⁶ m (1 light-year ≈ 0.946), in the Solar System's frame
 * (ecliptic in x, z; y to ecliptic north). About thirty real stars at their approximate distances
 * and directions, coloured by type, among a few thousand faint red dwarfs at the local density,
 * inside the wisp of the Local Interstellar Cloud.
 * Arrival: the stars light up outward from the Sun. Moment: a turn among them, while the light of
 * Proxima Centauri travels to us along a dashed line, plate style: the light you see left it more
 * than four years ago.
 */

/** Proxima Centauri, in this world's units. */
export const PROXIMA = fromEquatorial(14.5, -62.68, 4.24 * 0.946);

const LY = 0.946;
// Name, distance (ly), RA (h), Dec (°), colour, luminosity (Suns).
const STARS: [string, number, number, number, number, number][] = [
  ['Alfa Centauri A', 4.37, 14.66, -60.83, 0xfff4e0, 1.5],
  ['Alfa Centauri B', 4.371, 14.661, -60.84, 0xffd2a0, 0.5],
  ['Próxima Centauri', 4.24, 14.5, -62.68, 0xff6040, 0.0017],
  ['Estrella de Barnard', 5.96, 17.96, 4.69, 0xff6a40, 0.0035],
  ['Wolf 359', 7.86, 10.94, 7.01, 0xff5a3a, 0.001],
  ['Lalande 21185', 8.31, 11.06, 35.97, 0xff7a4a, 0.02],
  ['Sirio', 8.6, 6.75, -16.72, 0xcfe0ff, 25],
  ['Luyten 726-8', 8.73, 1.65, -17.95, 0xff5a3a, 0.001],
  ['Ross 154', 9.69, 18.83, -23.84, 0xff6040, 0.004],
  ['Ross 248', 10.3, 23.7, 44.17, 0xff5a3a, 0.002],
  ['Épsilon Eridani', 10.5, 3.55, -9.46, 0xffc080, 0.34],
  ['Lacaille 9352', 10.7, 23.1, -35.85, 0xff8050, 0.03],
  ['Ross 128', 11.0, 11.8, 0.8, 0xff6040, 0.004],
  ['EZ Aquarii', 11.1, 22.65, -15.3, 0xff5a3a, 0.002],
  ['Procyon', 11.4, 7.66, 5.22, 0xfff6e8, 7],
  ['61 Cygni', 11.4, 21.12, 38.75, 0xffb070, 0.15],
  ['Struve 2398', 11.5, 18.71, 59.63, 0xff6a40, 0.03],
  ['Groombridge 34', 11.6, 0.3, 44.02, 0xff6a40, 0.006],
  ['Épsilon Indi', 11.8, 22.05, -56.79, 0xffb070, 0.22],
  ['Tau Ceti', 11.9, 1.73, -15.94, 0xffe8b0, 0.52],
  ['GJ 1061', 12.0, 3.6, -44.51, 0xff5030, 0.001],
  ['Estrella de Luyten', 12.2, 7.46, 5.23, 0xff6040, 0.01],
  ['Estrella de Teegarden', 12.5, 2.89, 16.88, 0xff4a30, 0.0007],
  ['Estrella de Kapteyn', 12.8, 5.19, -45.02, 0xff7040, 0.012],
  ['Lacaille 8760', 12.9, 21.29, -38.87, 0xff7a4a, 0.07],
  ['Kruger 60', 13.1, 22.47, 57.7, 0xff6040, 0.01],
  ['Altair', 16.7, 19.85, 8.87, 0xf0f4ff, 10.6],
  ['Vega', 25.0, 18.62, 38.78, 0xd8e4ff, 40],
  ['Fomalhaut', 25.1, 22.96, -29.62, 0xe8eeff, 16.6],
  ['Pólux', 33.8, 7.76, 28.03, 0xffc890, 43],
  ['Arturo', 36.7, 14.26, 19.18, 0xffb878, 170],
];

export function vecindario(): WorldModule {
  return {
    spec: {
      id: 'vecindario',
      territory: 'Vía Láctea',
      name: 'Las estrellas vecinas',
      fact: 'Treinta estrellas cerca de nosotros, y casi ninguna se ve a simple vista.',
      ficha: ['unas treinta estrellas a menos de doce años luz, casi todas enanas rojas', 'Próxima Centauri: a 4,24 años luz'],
      label: 'vecinas',
      unitExp: 16,
      // At the centre of our corner of the galaxy, turned from the ecliptic to the galactic frame.
      anchor: new THREE.Vector3(),
      anchorRot: GALAXIA.sunRot,
      frame: 44,
      frameCenter: new THREE.Vector3(),
      view: [0.3, 0, 0],
      fade: [-2.0, -1.4, 1.3, 1.9],
      tint: 0xffd2a0,
      notes: [
        { at: [0, 0, 0], text: 'el Sol' },
        ...['Alfa Centauri A', 'Sirio', 'Estrella de Barnard', 'Procyon', 'Tau Ceti', 'Altair', 'Vega', 'Arturo'].map((name) => {
          const [, ly, ra, dec] = STARS.find((s) => s[0] === name)!;
          return { at: fromEquatorial(ra, dec, ly * LY).toArray(), text: name === 'Alfa Centauri A' ? 'Alfa Centauri' : name };
        }),
      ],
      generate() {
        const r = rng(181);
        const b = cloudBuilder(182);
        const R = 60 * LY;
        const delayOf = (d: number) => Math.min(1, d / R) * 0.9;

        // The Sun: stand-in for everything before.
        for (let k = 0; k < 40; k++) b.push(gauss(r) * 0.001, gauss(r) * 0.001, gauss(r) * 0.001, 0xfff0c0, 0.3, 0, 1.1, { star: true, flag: true });

        for (const [, ly, ra, dec, hex, L] of STARS) {
          const p = fromEquatorial(ra, dec, ly * LY);
          const light = Math.min(1.6, 0.35 + 0.22 * Math.log10(L + 0.0005) + 0.5);
          const d = delayOf(p.length());
          for (let k = 0; k < 12; k++) b.push(p.x + gauss(r) * 0.002, p.y + gauss(r) * 0.002, p.z + gauss(r) * 0.002, hex, 0.3, 0, light, { star: true, delay: d });
          // Bright stars get a soft glow.
          if (L > 1) {
            for (let k = 0; k < 160; k++) {
              const [x, y, z] = b.onSphere();
              const rr = Math.abs(gauss(r)) * 0.25 * Math.log10(L * 10);
              b.push(p.x + x * rr, p.y + y * rr, p.z + z * rr, hex, 0.12, 0, 0.04, { delay: d });
            }
          }
        }
        // The rest: mostly faint red dwarfs, at about 0.004 stars per cubic light-year.
        for (let k = 0; k < 3600; k++) {
          const [x, y, z] = b.onSphere();
          const d = Math.cbrt(r()) * R;
          if (d < 13 * LY) continue;
          const roll = r();
          const [hex, light] = roll < 0.75 ? [0xff5a3a, 0.18] : roll < 0.87 ? [0xffb070, 0.32] : roll < 0.95 ? [0xffeec8, 0.45] : [0xdde6ff, 0.6];
          b.push(x * d, y * d, z * d, hex, 0.3, 0, light * (0.6 + r() * 0.8), { star: true, delay: delayOf(d) });
        }
        // The Local Interstellar Cloud: a faint wisp the Sun is passing through.
        for (let k = 0; k < 5000; k++) {
          b.push(gauss(r) * 9, gauss(r) * 5, gauss(r) * 7, 0x8fb0ff, 1.0, 0, 0.004, { delay: 0.2 });
        }
        // Proxima's light on its way: a dashed line from the star to the Sun, drawn as the light
        // travels, with the light itself a point at its head.
        const path = lineSet();
        const a = new THREE.Vector3();
        const c = new THREE.Vector3();
        const DASHES = 40;
        for (let d = 0; d < DASHES; d++) {
          const t0 = d / DASHES;
          const t1 = (d + 0.6) / DASHES;
          path.segment(a.copy(PROXIMA).lerp(new THREE.Vector3(), t0), c.copy(PROXIMA).lerp(new THREE.Vector3(), t1), 0.7, t0, t1);
        }
        const pulse = cloudBuilder(214);
        for (let k = 0; k < 8; k++) pulse.push(0, 0, 0, 0xffd8b0, 0.01, 0, 0.5, { star: true });
        for (let k = 0; k < 40; k++) pulse.push(gauss(r) * 0.03, gauss(r) * 0.03, gauss(r) * 0.03, 0xffb890, 0.06, 0, 0.05);
        return { main: b.data(), path: path.data(), pulse: pulse.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 1, 1);
        const path = linesFromData(data.path as LinesData, 0xff5b2e);
        const pulse = cloudFromData(data.pulse as PointsData, 1, 1);
        const object = new THREE.Group();
        object.add(cloud.points, path.mesh, pulse.points);
        return {
          object,
          clouds: [cloud, pulse],
          update(f) {
            cloud.u.uReveal.value = f.tl.get('vec.form', f.p);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('oort'), f.e, f.home);
            const light = f.tl.get('vec.light', f.p);
            const on = smoothstep(0, 0.03, light) * (1 - smoothstep(0, 0.5, f.tl.get('vec.after', f.p)));
            path.uniforms.uReveal.value = light;
            path.uniforms.uAlpha.value = f.alpha * on;
            pulse.points.position.copy(PROXIMA).multiplyScalar(1 - Math.min(1, light));
            pulse.u.uGain.value = on * (1 - smoothstep(0.97, 1, light));
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'vec.form': 0 });
      // The stars light up around us, nearest first.
      tl.to(4.6, { e: w.home - 0.12, 'vec.form': 1, yaw: 0, pitch: 0.2, roll: 0, fov: 46 });
      tl.label('vecindario');
      // In close on the Sun and the Alpha Centauri system, seen side on (Proxima below): the
      // light that left Proxima more than four years ago comes to us along a dashed line. The
      // Oort cloud's world still frames this close in, so it travels to the same point.
      const mid = PROXIMA.clone().multiplyScalar(0.5);
      const travel = (k: number) => ({
        'vecindario.tx': mid.x * k,
        'vecindario.ty': mid.y * k,
        'vecindario.tz': mid.z * k,
        'oort.tx': mid.x * 100 * k,
        'oort.ty': mid.y * 100 * k,
        'oort.tz': mid.z * 100 * k,
      });
      tl.set({ 'vec.light': 0, 'vec.after': 0 });
      tl.to(2.2, { e: w.home - 0.75, yaw: 0.1, pitch: 0.3, fov: 44, ...travel(1) });
      tl.caption(3.2, 'La luz de Próxima', 'Esa luz salió hace más de cuatro años. Ves la estrella como era entonces.');
      tl.with(3.2, { 'vec.light': 1 }, (t) => t);
      tl.to(3.2, { e: w.home - 0.7, yaw: 0.25, pitch: 0.32 });
      // Then back out among the neighbours.
      tl.to(2.8, { yaw: 1.1, pitch: 0.35, e: w.home + 0.05, fov: 52, ...travel(0), 'vec.after': 1 });
    },
  };
}
