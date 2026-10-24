import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { fromEquatorial } from '../lib/astro';
import { lineSet, linesFromData, type LinesData } from './lineas';

/**
 * The Milky Way. 1 unit = 10¹⁹ m (about 1 057 light-years); disc in (x, z), y towards the north
 * galactic pole, centre at the origin. Two major and two minor logarithmic arms, a central bar and
 * bulge, pink star-forming regions. The Sun sits 26 000 light-years out, between two arms, and the
 * neighbourhood is turned to real galactic coordinates (the pole and the direction to the centre).
 * Near the Sun the galaxy is resolved into stars (log-radial), so the neighbourhood grows into it.
 * Arrival: the galaxy builds outward from our neighbourhood. Moment: rise to see the spiral, while
 * the Sun's orbit draws itself round the centre, plate style, in the direction it really turns.
 * Then a named moment, Sagittarius A*: the camera dives six orders of magnitude to the centre,
 * through the nuclear star cluster, to the S stars on their real orbits round something that
 * cannot be seen, seen along our line of sight from the Sun (as in the published plots), while S2
 * completes its sixteen-year orbit and whips past the black hole in 2018.
 */

const LY = 1 / 1057;
const SUN_R = 26000 * LY;
const ARM_K = 1 / Math.tan((16 * Math.PI) / 180);

export const GALAXIA = (() => {
  const sun = new THREE.Vector3(0, 0.02, SUN_R);
  // In the neighbourhood's frame: towards the galactic centre and the north galactic pole.
  const gc = fromEquatorial(17.761, -28.94, 1).normalize();
  const ngp = fromEquatorial(12.857, 27.13, 1).normalize();
  const basis = (a: THREE.Vector3, b: THREE.Vector3) => {
    const x = a.clone().normalize();
    const y = b.clone().sub(x.clone().multiplyScalar(b.dot(x))).normalize();
    return new THREE.Matrix4().makeBasis(x, y, x.clone().cross(y));
  };
  const from = basis(gc, ngp);
  const to = basis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 1, 0));
  const sunRot = new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.invert()));
  return { sun, sunRot };
})();

const PC = 3.0857e16 / 1e19;
const AU = 1.496e11 / 1e19;

/**
 * The sky at the galactic centre as seen from the Sun: the line of sight, celestial north and east
 * (galactic axes here: towards the centre is -z, longitude 90° is -x, the north galactic pole +y).
 */
const SKY = (() => {
  const gal = (l: number, b: number) => {
    const L = (l * Math.PI) / 180;
    const B = (b * Math.PI) / 180;
    return new THREE.Vector3(-Math.sin(L) * Math.cos(B), Math.sin(B), -Math.cos(L) * Math.cos(B));
  };
  const los = GALAXIA.sun.clone().negate().normalize();
  const ncp = gal(122.93, 27.13);
  const north = ncp.clone().addScaledVector(los, -ncp.dot(los)).normalize();
  const east = north.clone().cross(los);
  return { los, north, east };
})();

/**
 * The S stars: orbital elements (a in arcseconds at 8.2 kpc, e, i, Ω, ω in degrees, time of
 * pericentre, period in years), after Gillessen et al. 2017. S2 first.
 */
const S_STARS: [string, number, number, number, number, number, number, number][] = [
  ['S2', 0.1255, 0.8839, 134.18, 226.94, 65.51, 2018.38, 16.0],
  ['S1', 0.595, 0.556, 119.14, 342.04, 122.3, 2001.8, 166],
  ['S4', 0.357, 0.3905, 80.33, 258.84, 290.8, 1957.4, 77.0],
  ['S6', 0.6574, 0.84, 87.24, 85.07, 116.23, 2108.6, 192],
  ['S8', 0.4047, 0.8031, 74.37, 315.43, 346.7, 1983.64, 92.9],
  ['S9', 0.2724, 0.644, 82.41, 156.6, 150.6, 1976.71, 51.3],
  ['S12', 0.2987, 0.8883, 33.56, 230.1, 317.9, 1995.59, 58.9],
  ['S13', 0.2641, 0.425, 24.7, 74.5, 245.2, 2004.86, 49.0],
  ['S14', 0.2863, 0.9761, 100.59, 226.38, 334.59, 2000.12, 55.3],
  ['S17', 0.3559, 0.397, 96.83, 191.62, 326.0, 1991.19, 76.6],
  ['S18', 0.2379, 0.471, 110.67, 49.11, 349.46, 1993.86, 41.9],
  ['S29', 0.428, 0.728, 105.8, 161.96, 346.5, 2021.4, 101],
  ['S38', 0.1416, 0.8201, 171.1, 101.06, 17.99, 2003.19, 19.2],
  ['S55', 0.1078, 0.7209, 150.1, 325.5, 331.5, 2009.31, 12.8],
];

/** Where an S star is (galaxy units, round the centre) at `year`. */
const sStar = (el: (typeof S_STARS)[number], year: number, out = new THREE.Vector3()) => {
  const [, aSec, e, iD, OD, wD, tp, P] = el;
  const a = aSec * 8200 * AU;
  let M = (2 * Math.PI * (year - tp)) / P;
  M = Math.atan2(Math.sin(M), Math.cos(M));
  let E = e > 0.8 ? Math.PI * Math.sign(M) : M;
  for (let k = 0; k < 30; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const r = a * (1 - e * Math.cos(E));
  const d = Math.PI / 180;
  const u = wD * d + nu;
  const O = OD * d;
  const i = iD * d;
  // On the sky: north and east offsets, and depth along the line of sight.
  const xN = r * (Math.cos(O) * Math.cos(u) - Math.sin(O) * Math.sin(u) * Math.cos(i));
  const yE = r * (Math.sin(O) * Math.cos(u) + Math.cos(O) * Math.sin(u) * Math.cos(i));
  const z = r * Math.sin(u) * Math.sin(i);
  return out.copy(SKY.north).multiplyScalar(xN).addScaledVector(SKY.east, yE).addScaledVector(SKY.los, z);
};

export function galaxia(): WorldModule {
  return {
    spec: {
      id: 'galaxia',
      territory: 'Vía Láctea',
      name: 'La Vía Láctea',
      fact: 'Unos 200 mil millones de estrellas. El Sol tarda 230 millones de años en dar una vuelta.',
      label: 'Vía Láctea',
      unitExp: 19,
      frame: 130,
      frameCenter: new THREE.Vector3(0, 0, 4),
      view: [0.95, 0.35, 0],
      fade: [-2.4, -1.7, 1.2, 1.8],
      tint: 0xc8d4ff,
      notes: (() => {
        const S = GALAXIA.sun;
        const armPhase = (rad: number) => ARM_K * Math.log(rad / 4);
        const offset = Math.atan2(S.z, S.x) - armPhase(SUN_R) + Math.PI / 4;
        const arm = (k: number, rad: number): [number, number, number] => {
          const th = offset + armPhase(rad) + (k * Math.PI) / 2;
          return [Math.cos(th) * rad, 0, Math.sin(th) * rad];
        };
        const whole: [number, number] = [19.9, 22.6];
        const centre: [number, number] = [14.2, 15.6];
        const s2Far = sStar(S_STARS[0], 2010.4).toArray();
        return [
          { at: S.toArray(), text: 'el Sol', e: whole },
          { at: [0, 0, 0], text: 'Sagitario A*', e: whole },
          { at: [Math.cos(0.47) * 9, 0, Math.sin(0.47) * 9], text: 'barra central', e: whole },
          { at: arm(2, 36), text: 'brazo espiral', e: whole },
          { at: SKY.north.clone().multiplyScalar(4 * PC).toArray(), text: 'cúmulo estelar nuclear', e: [17.2, 18.7] },
          { at: [0, 0, 0], text: 'Sagitario A*: 4 millones de soles', e: centre },
          { at: s2Far, text: 'S2: una vuelta cada 16 años', e: centre },
        ];
      })(),
      noteSpan: 7.5,
      generate() {
        const r = rng(191);
        const b = cloudBuilder(192);
        const S = GALAXIA.sun;
        const delayOf = (x: number, y: number, z: number) => Math.min(1, Math.hypot(x - S.x, y - S.y, z - S.z) / 70) * 0.9;
        const put = (x: number, y: number, z: number, hex: number, size: number, light: number, star = false) =>
          b.push(x, y, z, hex, size, 0, light, { delay: delayOf(x, y, z), star });

        // Bulge and bar.
        for (let k = 0; k < 30000; k++) put(gauss(r) * 3.2, gauss(r) * 2.2, gauss(r) * 3.2, 0xffe2b0, 0.4, 0.09);
        const barA = 0.47;
        for (let k = 0; k < 26000; k++) {
          const u = gauss(r) * 6.5;
          const v = gauss(r) * 2.0;
          put(Math.cos(barA) * u - Math.sin(barA) * v, gauss(r) * 1.0, Math.sin(barA) * u + Math.cos(barA) * v, 0xffd8a0, 0.35, 0.08);
        }
        // Disc: four arms on an exponential disc, plus an inter-arm glow.
        const sunAngle = Math.atan2(S.z, S.x);
        const armPhase = (rad: number) => ARM_K * Math.log(rad / 4);
        // Rotate the pattern so the Sun sits between two arms.
        const offset = sunAngle - armPhase(SUN_R) + Math.PI / 4;
        for (let k = 0; k < 190000; k++) {
          const rad = 3 + -Math.log(1 - r() * 0.985) * 11;
          if (rad > 52) continue;
          const onArm = r() < 0.66;
          // Two major arms (0, 2) and two fainter minor ones (1, 3).
          const arm = r() < 0.68 ? (r() < 0.5 ? 0 : 2) : r() < 0.5 ? 1 : 3;
          const major = arm % 2 === 0;
          const th = onArm ? offset + armPhase(rad) + (arm * Math.PI) / 2 + gauss(r) * (major ? 0.2 : 0.3) : r() * Math.PI * 2;
          const h = gauss(r) * 0.3 * (1 + rad / 40);
          const young = onArm && r() < 0.6;
          put(Math.cos(th) * rad, h, Math.sin(th) * rad, young ? 0xb8ccff : 0xffe6c8, 0.32, onArm ? (major ? 0.1 : 0.07) : 0.05);
        }
        // Star-forming regions, pink, strung along the arms.
        for (let c = 0; c < 400; c++) {
          const rad = 5 + r() * 40;
          const th = offset + armPhase(rad) + (r() < 0.5 ? 0 : Math.PI) + gauss(r) * 0.1;
          const cx = Math.cos(th) * rad;
          const cz = Math.sin(th) * rad;
          for (let k = 0; k < 20; k++) put(cx + gauss(r) * 0.3, gauss(r) * 0.1, cz + gauss(r) * 0.3, k % 4 ? 0xff7ab0 : 0xa0c8ff, 0.25, 0.22);
        }
        // Around the Sun the galaxy resolves into stars, log-radial from the neighbourhood outward.
        for (let k = 0; k < 70000; k++) {
          const d = 60 * LY * Math.exp(r() * Math.log(9000 / 60));
          const [x, y, z] = b.onSphere();
          const flat = Math.min(1, 300 * LY / d);
          const roll = r();
          const [hex, light] = roll < 0.75 ? [0xff6a40, 0.16] : roll < 0.9 ? [0xffd2a0, 0.26] : [0xe8eeff, 0.36];
          // Dense near the Sun by construction: dimmer there, so it never gathers into a glare.
          put(S.x + x * d, S.y + y * d * flat, S.z + z * d, hex, 0.02, light * (0.25 + 0.75 * Math.min(1, d / (3000 * LY))));
        }
        // The Sun: stand-in for the neighbourhood.
        for (let k = 0; k < 30; k++) b.push(S.x + gauss(r) * 0.0005, S.y, S.z + gauss(r) * 0.0005, 0xfff0c0, 0.01, 0, 1.1, { star: true, flag: true });

        // The Sun's orbit: a dashed circle drawn from the Sun onward, the way the galaxy turns
        // (clockwise seen from the north galactic pole: towards Cygnus, galactic longitude 90°).
        const orbit = lineSet();
        const sunAng = Math.atan2(S.z, S.x);
        const DASHES = 120;
        const a = new THREE.Vector3();
        const c = new THREE.Vector3();
        for (let d = 0; d < DASHES; d++) {
          for (let j = 0; j < 3; j++) {
            const t0 = (d + (j / 3) * 0.6) / DASHES;
            const t1 = (d + ((j + 1) / 3) * 0.6) / DASHES;
            const a0 = sunAng + t0 * Math.PI * 2;
            const a1 = sunAng + t1 * Math.PI * 2;
            orbit.segment(a.set(Math.cos(a0) * SUN_R, S.y, Math.sin(a0) * SUN_R), c.set(Math.cos(a1) * SUN_R, S.y, Math.sin(a1) * SUN_R), 1.0, t0 * 0.97, t1 * 0.97);
          }
        }

        // The centre. The nuclear star cluster: some 30 000 stars, denser towards the middle
        // (density falling as r^-1.8 out to 20 pc), mostly old red giants, some young blue stars.
        const core = cloudBuilder(193);
        for (let k = 0; k < 30000; k++) {
          const [x, y, z] = core.onSphere();
          const rr = Math.max(0.004, Math.pow(r(), 1 / 1.2) * 20) * PC;
          const roll = r();
          const [hex, light] = roll < 0.7 ? [0xff9a60, 0.2] : roll < 0.9 ? [0xffe0b0, 0.26] : [0xb8d0ff, 0.36];
          core.push(x * rr, y * rr * 0.8, z * rr, hex, 1e-7, 0, light, { star: true });
        }
        // The bulge resolved into stars, for the way in: a dense field of old, yellowish stars.
        const bulge = cloudBuilder(195);
        for (let k = 0; k < 40000; k++) {
          const t = Math.pow(r(), 1.6);
          const x = gauss(r) * 2.6 * t;
          const y = gauss(r) * 1.6 * t;
          const z = gauss(r) * 2.6 * t;
          const roll = r();
          bulge.push(x, y, z, roll < 0.8 ? 0xffd8a8 : 0xfff0e0, 1e-7, 0, roll < 0.8 ? 0.14 : 0.22, { star: true });
        }
        // The S stars: hot, blue-white, a few points each (moved every frame, see assemble).
        const sb = cloudBuilder(194);
        S_STARS.forEach((_, i) => {
          for (let k = 0; k < 3; k++) sb.push(0, 0, 0, 0xd8e4ff, 1e-7, 0, i === 0 ? 1.0 : 0.7, { star: true });
        });
        // Their orbits, plate style: dashed ellipses; S2's in the accent. And the black hole itself,
        // too small to see: a small ring where it is.
        const ink = lineSet();
        const mark = lineSet();
        const q0 = new THREE.Vector3();
        const q1 = new THREE.Vector3();
        S_STARS.forEach((el, i) => {
          const set = i === 0 ? mark : ink;
          // Sampled evenly in eccentric anomaly, so the sharp turn at pericentre stays smooth.
          const yearAt = (E: number) => el[6] + (el[7] * (E - el[2] * Math.sin(E))) / (Math.PI * 2);
          const N = 240;
          for (let k = 0; k < N; k++) {
            if (i !== 0 && k % 2) continue;
            const E0 = (Math.PI * 2 * k) / N;
            const E1 = (Math.PI * 2 * (k + (i === 0 ? 1 : 0.8))) / N;
            set.segment(sStar(el, yearAt(E0), q0), sStar(el, yearAt(E1), q1), i === 0 ? 0.8 : 0.3);
          }
        });
        const ring: THREE.Vector3[] = [];
        for (let k = 0; k <= 40; k++) {
          const t = (k / 40) * Math.PI * 2;
          ring.push(SKY.north.clone().multiplyScalar(Math.cos(t) * 40 * AU).addScaledVector(SKY.east, Math.sin(t) * 40 * AU));
        }
        mark.path(ring, 1.0);
        return { main: b.data(), orbit: orbit.data(), core: core.data(), bulge: bulge.data(), sstars: sb.data(), sInk: ink.data(), sMark: mark.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 1, 1);
        cloud.u.uSurface.value.set(0, 1, 0, 0.5);
        const orbit = linesFromData(data.orbit as LinesData, 0xff5b2e);
        const core = cloudFromData(data.core as PointsData, 1, 1);
        const bulge = cloudFromData(data.bulge as PointsData, 1, 1);
        const sstars = cloudFromData(data.sstars as PointsData, 1, 1);
        const sInk = linesFromData(data.sInk as LinesData, 0xece7db);
        const sMark = linesFromData(data.sMark as LinesData, 0xff5b2e);
        const spos = sstars.points.geometry.attributes.position as THREE.BufferAttribute;
        const at = new THREE.Vector3();
        const object = new THREE.Group();
        object.add(cloud.points, orbit.mesh, bulge.points, core.points, sstars.points, sInk.mesh, sMark.mesh);
        return {
          object,
          clouds: [cloud, bulge, core, sstars],
          update(f) {
            cloud.u.uReveal.value = f.tl.get('gal.form', f.p);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('radcliffe'), f.e, f.home);
            // Diving to the centre, the galaxy's own points (light-years wide) give way to the
            // centre's stars.
            const dive = f.tl.get('gal.dive', f.p);
            const deep = 1 - smoothstep(f.home - 1.8, f.home - 1.0, f.e);
            // Dim while the camera is still inside the disc: seen from there, the centre would
            // be a white veil and the disc's points blurred discs.
            cloud.u.uGain.value = (0.25 + 0.75 * smoothstep(f.home - 1.0, f.home - 0.35, f.e)) * (1 - dive * deep);
            // On the way in the bulge's own stars take over, then the nuclear cluster's.
            const inBulge = dive * (1 - smoothstep(f.home - 1.3, f.home - 0.7, f.e)) * smoothstep(16.9, 17.9, f.e);
            bulge.u.uGain.value = inBulge;
            bulge.points.visible = inBulge > 0.001;
            bulge.u.uMinPx.value *= 1.7;
            const inCentre = dive * (1 - smoothstep(f.home - 1.9, f.home - 1.3, f.e));
            core.u.uGain.value = inCentre;
            core.points.visible = inCentre > 0.001;
            // Stars far below a pixel: drawn a little larger than the usual minimum, so a point of
            // light reads as one (the S stars larger still: they are the subject).
            core.u.uMinPx.value *= 1.7;
            // The S stars where they are in that year, and their orbits near their own scale.
            const sNear = dive * (1 - smoothstep(15.6, 16.4, f.e));
            sstars.u.uGain.value = sNear;
            sstars.points.visible = sNear > 0.001;
            sstars.u.uMinPx.value *= 2.6;
            if (sstars.points.visible) {
              const year = f.tl.get('gal.t', f.p);
              S_STARS.forEach((el, i) => {
                sStar(el, year, at);
                for (let k = 0; k < 3; k++) spos.setXYZ(i * 3 + k, at.x, at.y, at.z);
              });
              spos.needsUpdate = true;
            }
            for (const l of [sInk, sMark]) {
              l.uniforms.uAlpha.value = f.alpha * sNear;
              l.mesh.visible = sNear > 0.001;
            }
            const year = f.tl.get('gal.year', f.p);
            orbit.uniforms.uReveal.value = year;
            orbit.uniforms.uAlpha.value = f.alpha * smoothstep(0, 0.04, year);
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'gal.form': 0 });
      // The galaxy builds outward from our neighbourhood as we leave it.
      tl.to(5.4, { e: w.home - 0.15, 'gal.form': 1, yaw: 0.1, pitch: 0, roll: 0, fov: 42 });
      tl.label('galaxia');
      // Rise to see the spiral whole; the Sun's orbit draws itself, one galactic year.
      tl.set({ 'gal.year': 0 });
      tl.to(1.4, { yaw: 0.25, pitch: 0.12, e: w.home - 0.03, fov: 44 });
      tl.caption(3.4, 'Un año galáctico', 'La vez anterior que el Sol pasó por este punto de su órbita, aparecían los primeros dinosaurios.');
      tl.to(3.4, { yaw: 0.75, pitch: 0.35, e: w.home + 0.1, fov: 46, 'gal.year': 1 });

      // Sagittarius A*. The aim holds the framing on the centre and the view on the galaxy's own
      // all the way down, whatever worlds the scale passes through.
      tl.set({ 'gal.dive': 0, 'galaxia.keep': 0, 'galaxia.aim': 0, 'galaxia.ax': 0, 'galaxia.ay': 0, 'galaxia.az': 0, 'gal.t': 2002 });
      // The caption covers the whole way down and back: the scale passes those of other worlds,
      // whose names must not show here.
      tl.caption(17.2, 'Sagitario A*', 'Estrellas que giran a miles de kilómetros por segundo alrededor de algo invisible: un agujero negro de cuatro millones de soles.');
      tl.to(2.8, { 'galaxia.aim': 1, 'galaxia.keep': 1, 'gal.dive': 1, e: w.home - 1.9, yaw: 0.25, pitch: -0.15 });
      tl.to(2.6, { e: 17.4, ...SGR_APPROACH });
      tl.to(2.6, { e: SGR_E, ...SGR_VIEW, fov: 40 });
      tl.with(4.4, { 'gal.t': 2019.6 }, (t) => t);
      tl.to(4.4, { e: SGR_E + 0.04, ...SGR_VIEW_END });
      // Back up, still on the centre; then out to the whole galaxy.
      tl.to(2.4, { e: w.home - 1.7, yaw: 0.25, pitch: -0.15, roll: 0 });
      tl.to(2.8, { 'galaxia.aim': 0, 'galaxia.keep': 0, 'gal.dive': 0, e: w.home + 0.1, yaw: 0.75, pitch: 0.35, roll: 0, fov: 46 });
    },
  };
}

/**
 * The centre shots (yaw, pitch, roll on top of the galaxy's own view, which the aim holds), solved
 * in the page: the S stars seen along our line of sight from the Sun (a little from above the
 * plane), galactic north up, then a slight turn; on the way in, from a little higher. SGR_E fits
 * S2's orbit on screen.
 */
const SGR_E = 14.78;
const SGR_APPROACH = { yaw: -0.2465, pitch: -0.6139, roll: -0.1447 };
const SGR_VIEW = { yaw: -0.3019, pitch: -0.8355, roll: -0.0616 };
const SGR_VIEW_END = { yaw: -0.4781, pitch: -0.8468, roll: -0.0936 };
