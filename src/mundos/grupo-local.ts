import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { fromEquatorial } from '../lib/astro';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { GALAXIA } from './galaxia';
import { lineSet, linesFromData, type LinesData } from './lineas';

/**
 * The Local Group. 1 unit = 10²¹ m (about 105 700 light-years), in the Milky Way's frame (disc in
 * x, z). The Milky Way and Andromeda, Triangulum, the Magellanic Clouds and some fifty dwarfs, at
 * their real directions and distances (equatorial → ecliptic → galactic). Around the two spirals,
 * their haloes of thin gas: Andromeda's reaches some 1.3 million light-years and already meets ours.
 * Arrival: the Milky Way shrinks among its satellites, the Magellanic Clouds trailing their stream
 * of gas. Moment: the camera glides out towards Andromeda as the two haloes appear. Pulling back,
 * its sentence draws itself, plate style: the two galaxies' paths to come, falling together, a
 * first pass in some 4 500 million years, a swing out and back, and one galaxy.
 */

const MLY = 1e6 / 105700;
const toGalaxy = (raH: number, decD: number, mly: number) =>
  fromEquatorial(raH, decD, 1).applyQuaternion(GALAXIA.sunRot).normalize().multiplyScalar(mly * MLY);

type B = ReturnType<typeof cloudBuilder>;

export const M31 = toGalaxy(0.712, 41.27, 2.54);
/** Andromeda's disc normal: tilted 77° to our line of sight. */
export const M31_NORMAL = (() => {
  const toM31 = M31.clone().normalize();
  return new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3().crossVectors(toM31, new THREE.Vector3(0, 1, 0)).normalize(), 1.1).normalize();
})();

/**
 * The collision to come, integrated once: the separation between the two galaxies falls in almost
 * straight (Andromeda approaches at about 110 km/s, with little sideways motion) under a softened
 * pull (their haloes are extended), swings past at a first pericentre and out again, and settles:
 * dynamical friction, drawn as a loss of speed at each close pass (where the haloes overlap most),
 * drains the orbit until the two are one. Each galaxy moves about the centre of mass, Andromeda a
 * little heavier. Shape only: the time scale is in the words, not the units.
 */
export const CRASH = (() => {
  // Andromeda's share of the mass: the centre of mass lies that far along the way to it.
  const q = 0.55;
  const B = M31.clone().multiplyScalar(q);
  const xh = M31.clone().normalize();
  const yh = new THREE.Vector3().crossVectors(xh, M31_NORMAL).normalize();
  const KICKS = [0.9, 0.75, 0.6];
  let x = M31.length();
  let y = 0;
  let vx = -0.16;
  let vy = 0.07;
  const rel: THREE.Vector3[] = [];
  let first = 0;
  let passes = 0;
  let prevR = Infinity;
  let falling = true;
  let lx = Infinity;
  let ly = 0;
  for (let i = 0; i < 900000; i++) {
    const r = Math.hypot(x, y);
    if (Math.hypot(x - lx, y - ly) > 0.06) {
      rel.push(xh.clone().multiplyScalar(x).addScaledVector(yh, y));
      lx = x;
      ly = y;
    }
    if (falling && r > prevR) {
      if (passes === 0) first = rel.length - 1;
      const k = KICKS[Math.min(passes, KICKS.length - 1)];
      vx *= k;
      vy *= k;
      passes++;
      falling = false;
    } else if (!falling && r < prevR) falling = true;
    prevR = r;
    if (r < 0.15) break;
    const a = 1 / Math.pow(r * r + 0.5, 1.5);
    vx -= a * x * 0.004;
    vy -= a * y * 0.004;
    x += vx * 0.004;
    y += vy * 0.004;
  }
  return {
    B,
    mw: rel.map((R) => B.clone().addScaledVector(R, -q)),
    m31: rel.map((R) => B.clone().addScaledVector(R, 1 - q)),
    first,
  };
})();

/** A spiral of `n` points, radius `rad`, its disc normal `normal`. */
function spiral(b: B, c: THREE.Vector3, rad: number, normal: THREE.Vector3, n: number, hex: number, light: number, delay: number, flag = false) {
  const { r } = b;
  const u = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0.3, 1, 0.2)).normalize();
  const v = normal.clone().cross(u);
  for (let k = 0; k < n; k++) {
    const rr = -Math.log(1 - r() * 0.98) * rad * 0.3;
    const arm = r() < 0.6;
    const th = arm ? 3.2 * Math.log(rr / rad + 0.05) + (r() < 0.5 ? 0 : Math.PI) + gauss(r) * 0.3 : r() * Math.PI * 2;
    const h = gauss(r) * rad * 0.03;
    const p = c.clone().addScaledVector(u, Math.cos(th) * rr).addScaledVector(v, Math.sin(th) * rr).addScaledVector(normal, h);
    b.push(p.x, p.y, p.z, rr < rad * 0.15 ? 0xffe2b0 : hex, rad * 0.03, 0, light, { delay, flag });
  }
}

function blob(b: B, c: THREE.Vector3, rad: number, n: number, hex: number, light: number, delay: number) {
  const { r } = b;
  for (let k = 0; k < n; k++) b.push(c.x + gauss(r) * rad, c.y + gauss(r) * rad * 0.7, c.z + gauss(r) * rad, hex, rad * 0.25, 0, light, { delay });
}

/** A halo of thin gas: density falling as 1/r², out to `rad`; soft, wide points. */
function halo(b: B, c: THREE.Vector3, rad: number, n: number, hex: number, light: number, delay: number) {
  const { r } = b;
  for (let k = 0; k < n; k++) {
    const [x, y, z] = b.onSphere();
    const rr = rad * (0.08 + 0.92 * r());
    b.push(c.x + x * rr, c.y + y * rr, c.z + z * rr, hex, rad * 0.05, 0, light, { delay: delay + (rr / rad) * 0.3 });
  }
}

export function grupoLocal(): WorldModule {
  return {
    spec: {
      id: 'grupoLocal',
      territory: 'galaxias',
      name: 'El Grupo Local',
      fact: 'Andrómeda viene hacia nosotros: su halo de gas ya toca el nuestro, y en unos 4 500 millones de años chocarán.',
      label: 'Grupo Local',
      unitExp: 21,
      nameSpan: 0.6,
      frame: 14,
      // The Milky Way; the moment travels from it towards Andromeda.
      frameCenter: new THREE.Vector3(),
      // Chosen so Andromeda ends up upper left and the Milky Way's disc is seen from above.
      view: [0.913, -0.999, 0],
      fade: [-1.6, -1.1, 1.7, 2.3],
      tint: 0xc8d4ff,
      notes: [
        { at: [0, 0, 0], text: 'Vía Láctea' },
        { at: M31.toArray(), text: 'Andrómeda' },
        { at: toGalaxy(1.564, 30.66, 2.73).toArray(), text: 'Triángulo' },
        { at: toGalaxy(5.392, -69.76, 0.16).toArray(), text: 'Nube Grande de Magallanes' },
        { at: CRASH.m31[CRASH.first].toArray(), text: 'primer paso: en 4 500 millones de años' },
        { at: CRASH.m31[CRASH.m31.length - 1].toArray(), text: 'una sola galaxia' },
      ],
      generate() {
        const b = cloudBuilder(201);
        const { r } = b;
        const m31 = M31;
        const m33 = toGalaxy(1.564, 30.66, 2.73);
        const lmc = toGalaxy(5.392, -69.76, 0.16);
        const smc = toGalaxy(0.877, -72.83, 0.2);
        const d = (p: THREE.Vector3) => Math.min(1, p.length() / 30) * 0.9;

        // The Milky Way: the stand-in for everything we have crossed.
        spiral(b, new THREE.Vector3(), 0.47, new THREE.Vector3(0, 1, 0), 9000, 0xd8e0ff, 0.12, 0, true);
        // Andromeda, bigger, tilted 77° to our line of sight.
        spiral(b, m31, 1.05, M31_NORMAL, 14000, 0xd0dcff, 0.15, d(m31));
        blob(b, m31.clone().add(new THREE.Vector3(0.05, 0.02, 0.06)), 0.03, 400, 0xffe2b0, 0.07, d(m31));
        blob(b, m31.clone().add(new THREE.Vector3(-0.08, 0.06, -0.05)), 0.05, 500, 0xffe2b0, 0.05, d(m31));
        spiral(b, m33, 0.29, new THREE.Vector3(0.4, 0.8, 0.3).normalize(), 3500, 0xb8ccff, 0.16, d(m33));
        // The Magellanic Clouds, irregular and faint beside the spiral.
        blob(b, lmc, 0.05, 1600, 0xd8e0ff, 0.07, 0.1);
        blob(b, lmc.clone().add(new THREE.Vector3(0.02, 0, -0.01)), 0.012, 300, 0xffd8f0, 0.06, 0.1);
        blob(b, smc, 0.03, 800, 0xd8e0ff, 0.07, 0.12);
        // The Magellanic Stream: gas torn from the Clouds, trailing past the south galactic pole.
        {
          const u = lmc.clone().normalize();
          const v = new THREE.Vector3(0, -1, 0).addScaledVector(u, u.y).normalize();
          const R = lmc.length() * 1.05;
          for (let k = 0; k < 2600; k++) {
            const t = Math.pow(r(), 1.4);
            const th = t * 1.9;
            const rr = R * (1 + gauss(r) * 0.06);
            const p = u.clone().multiplyScalar(Math.cos(th) * rr).addScaledVector(v, Math.sin(th) * rr);
            p.addScaledVector(new THREE.Vector3(gauss(r), gauss(r), gauss(r)), 0.05 + t * 0.06);
            b.push(p.x, p.y, p.z, 0x8fb8ff, 0.06, 0, 0.035 * (1 - t * 0.8), { delay: 0.12 + t * 0.15 });
          }
        }
        // Dwarfs, most of them around the two big spirals: small smudges, each with a point of
        // light at its heart so it can be found.
        for (let k = 0; k < 50; k++) {
          const host = r() < 0.5 ? new THREE.Vector3() : m31;
          const [x, y, z] = b.onSphere();
          const dist = 0.3 + r() * 3.5;
          const c = host.clone().add(new THREE.Vector3(x, y, z).multiplyScalar(dist));
          blob(b, c, 0.015 + r() * 0.03, 120, 0xe8e0d0, 0.09, d(c));
          for (let j = 0; j < 3; j++) b.push(c.x, c.y, c.z, 0xf0e8d8, 0.004, 0, 0.12, { star: true, delay: d(c) });
        }
        // The haloes of gas: ours out to some 600 000 light-years, Andromeda's to 1.3 million.
        halo(b, new THREE.Vector3(), 5.7, 9000, 0x7f9cff, 0.01, 0.25);
        halo(b, m31, 12.3, 18000, 0xa08cff, 0.009, 0.35);
        // Faint background galaxies, to give depth. Not light sources: zooming out they would
        // gather into a glaring knot (the cosmic web draws them from there on).
        for (let k = 0; k < 2500; k++) {
          const [x, y, z] = b.onSphere();
          const dist = 40 + r() * 60;
          b.push(x * dist, y * dist, z * dist, k % 3 ? 0xd8d0ff : 0xffe2c0, 0.035, 0, 0.2, { delay: 0.9 });
        }
        // The two paths to come, dashed, drawn from today to the merger; the merger ringed in the
        // accent.
        const ink = lineSet();
        const mark = lineSet();
        for (const path of [CRASH.mw, CRASH.m31]) {
          let along = 0;
          const total = path.reduce((acc, q, i) => (i ? acc + q.distanceTo(path[i - 1]) : 0), 0);
          for (let i = 1; i < path.length; i++) {
            const step = path[i].distanceTo(path[i - 1]);
            // Dashes about 0.35 units long, gaps 0.25.
            if (along % 0.6 < 0.35) ink.segment(path[i - 1], path[i], 0.55, along / total, (along + step) / total);
            along += step;
          }
        }
        const end = CRASH.m31[CRASH.m31.length - 1];
        const ring: THREE.Vector3[] = [];
        const nu = M31_NORMAL.clone();
        const uu = new THREE.Vector3().crossVectors(nu, new THREE.Vector3(0, 1, 0)).normalize();
        const vv = nu.clone().cross(uu);
        for (let k = 0; k <= 48; k++) {
          const t = (k / 48) * Math.PI * 2;
          ring.push(end.clone().addScaledVector(uu, Math.cos(t) * 0.9).addScaledVector(vv, Math.sin(t) * 0.9));
        }
        mark.path(ring, 0.9, 0.97, 1);
        return { main: b.data(), ink: ink.data(), mark: mark.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 1, 1);
        const ink = linesFromData(data.ink as LinesData, 0xece7db);
        const mark = linesFromData(data.mark as LinesData, 0xff5b2e);
        const object = new THREE.Group();
        object.add(cloud.points, ink.mesh, mark.mesh);
        return {
          object,
          clouds: [cloud],
          update(f) {
            cloud.u.uReveal.value = f.tl.get('gl.form', f.p);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('galaxia'), f.e, f.home);
            // The collision to come draws itself as the camera pulls back, and goes before the
            // cosmic web.
            const crash = f.tl.get('gl.crash', f.p);
            const alpha = f.alpha * smoothstep(0, 0.03, crash) * (1 - smoothstep(f.home + 0.7, f.home + 1.1, f.e));
            for (const l of [ink, mark]) {
              l.uniforms.uReveal.value = crash;
              l.uniforms.uAlpha.value = alpha;
            }
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'gl.form': 0, 'grupoLocal.tx': 0, 'grupoLocal.ty': 0, 'grupoLocal.tz': 0 });
      // The Milky Way shrinks among its satellites.
      tl.to(4.6, { e: w.home - 0.08, 'gl.form': 1, yaw: 0.3, pitch: 0.12, roll: 0, fov: 42 });
      tl.label('grupoLocal');
      // Across to Andromeda, close enough for its spiral to fill half the screen, seen at a
      // slant. Below this world's home the galaxy still frames the view: it travels too.
      const at = (p: THREE.Vector3) => ({
        'grupoLocal.tx': p.x,
        'grupoLocal.ty': p.y,
        'grupoLocal.tz': p.z,
        'galaxia.tx': p.x * 100,
        'galaxia.ty': p.y * 100,
        'galaxia.tz': p.z * 100,
      });
      // (Pulling back a little on the way, so both galaxies stay in sight across the gap.)
      tl.to(1.7, { e: w.home + 0.12, ...at(M31.clone().multiplyScalar(0.6)), yaw: 0.36, pitch: -0.12, fov: 44 });
      tl.to(1.9, { e: w.home - 0.55, ...at(M31), yaw: 0.4, pitch: -0.3 });
      tl.caption(2.6, 'Andrómeda', 'Un billón de estrellas a dos millones y medio de años luz: lo más lejano que suele verse a simple vista.');
      tl.to(2.6, { e: w.home - 0.5, yaw: 0.55, pitch: -0.25 });
      // Then out, until both haloes show, while the collision to come draws itself.
      tl.set({ 'gl.crash': 0 });
      tl.with(4.0, { 'gl.crash': 1 }, (t) => smoothstep(0.2, 0.95, t));
      tl.to(4.0, { e: w.home + 0.42, ...at(CRASH.B), yaw: 0, pitch: 0, fov: 46 });
    },
  };
}
