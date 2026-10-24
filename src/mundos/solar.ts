import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { SUN_DIR } from './tierra';
import { lineSet, linesFromData, type LinesData } from './lineas';
import { LUNA } from './luna';

/**
 * The Solar System. 1 unit = 10¹¹ m (1 AU ≈ 1.496), the ecliptic in (x, z), y towards ecliptic
 * north. The Sun, eight planets on their orbits at their real distances, the asteroid and Kuiper
 * belts. Planets are drawn larger than life (they would be far below a pixel), with soft halos.
 * The Earth–Moon system sits on the Earth's orbit, its axis tilted 23.4°, turned so that the Sun
 * here is the very sun that lit the Earth and the Moon before (it is summer in the south).
 * Arrival: the orbits draw outward from ours. Moment: rise above the ecliptic. Then a named moment,
 * Saturn: the camera dives four orders of magnitude to the planet drawn to its real size (banded,
 * its rings with the Cassini division, the shadows of each on the other) and glides into the ring
 * plane, where rings 280 000 km across and a few tens of metres thick all but vanish.
 */

const AU = 1.496;

const PLANETS = [
  { name: 'Mercurio', a: 0.387, hex: 0xb8a898, size: 0.0016, incl: 0.12, ang: 4.1 },
  { name: 'Venus', a: 0.723, hex: 0xffe2a8, size: 0.0024, incl: 0.06, ang: 1.9 },
  { name: 'Tierra', a: 1.0, hex: 0x6fa8ff, size: 0.0025, incl: 0, ang: 0.7 },
  { name: 'Marte', a: 1.524, hex: 0xff7a50, size: 0.002, incl: 0.03, ang: 2.8 },
  { name: 'Júpiter', a: 5.203, hex: 0xe8c090, size: 0.006, incl: 0.02, ang: 5.3 },
  { name: 'Saturno', a: 9.537, hex: 0xf0d8a0, size: 0.0055, incl: 0.04, ang: 3.6 },
  { name: 'Urano', a: 19.19, hex: 0x9fe8f0, size: 0.004, incl: 0.01, ang: 0.2 },
  { name: 'Neptuno', a: 30.07, hex: 0x6f8fff, size: 0.004, incl: 0.03, ang: 1.2 },
];

const onOrbit = (a: number, ang: number, incl: number) =>
  new THREE.Vector3(Math.cos(ang) * a * AU, Math.sin(ang) * a * AU * Math.sin(incl), Math.sin(ang) * a * AU * Math.cos(incl));

/** Kilometres in this world's units. */
const KM = 1e-8;

/**
 * Saturn drawn to scale: its place, the direction of the Sun from it, its axis (tilted 26.7° and
 * leaning towards the Sun, so the rings are open to the light) and the ring plane's in-plane axes.
 */
export const SATURN = (() => {
  const pl = PLANETS[5];
  const c = onOrbit(pl.a, pl.ang, pl.incl);
  const toSun = c.clone().negate().normalize();
  const side = new THREE.Vector3(0, 1, 0).cross(toSun).normalize();
  const n = new THREE.Vector3(0, 1, 0).applyAxisAngle(side, (26.7 * Math.PI) / 180).normalize();
  // The Sun's direction laid in the ring plane, and the axis across it.
  const u = toSun.clone().addScaledVector(n, -toSun.dot(n)).normalize();
  const v = n.clone().cross(u);
  /** A direction from Saturn: `az` round the axis from the Sun's side, `el` above the rings. */
  const dir = (az: number, el: number) =>
    u.clone().multiplyScalar(Math.cos(az) * Math.cos(el)).addScaledVector(v, Math.sin(az) * Math.cos(el)).addScaledVector(n, Math.sin(el));
  return { c, toSun, n, u, v, dir, R: 58232 * KM };
})();

export const SOLAR = (() => {
  const earth = PLANETS[2];
  const earthPos = onOrbit(earth.a, earth.ang, earth.incl);
  // Turn the Earth's frame so its sun direction points at the Sun, its axis tilted 23.4° from
  // ecliptic north (two-vector alignment).
  const toSun = earthPos.clone().negate().normalize();
  const tilt = (23.4 * Math.PI) / 180;
  const axis = new THREE.Vector3(0, Math.cos(tilt), Math.sin(tilt));
  const basis = (a: THREE.Vector3, b: THREE.Vector3) => {
    const x = a.clone().normalize();
    const y = b.clone().sub(x.clone().multiplyScalar(b.dot(x))).normalize();
    const z = x.clone().cross(y);
    return new THREE.Matrix4().makeBasis(x, y, z);
  };
  const from = basis(SUN_DIR, new THREE.Vector3(0, 1, 0));
  const to = basis(toSun, axis);
  const earthRot = new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.invert()));
  return { earthPos, earthRot };
})();

export function solar(): WorldModule {
  return {
    spec: {
      id: 'solar',
      territory: 'Sistema Solar',
      name: 'El Sistema Solar',
      fact: 'La luz del Sol tarda ocho minutos en llegar a la Tierra, y más de cuatro horas en llegar a Neptuno.',
      label: 'Sistema Solar',
      unitExp: 11,
      frame: 26,
      frameCenter: new THREE.Vector3(0, 0, 0),
      view: [0.35, 0, 0],
      // Early: the Sun should shine as soon as we leave the Moon.
      fade: [-3.3, -2.5, 1.6, 2.2],
      tint: 0xffe2a8,
      // The planets named at the system's scale; Saturn's rings at Saturn's.
      notes: (() => {
        const near: [number, number] = [12.66, 14.16];
        const ring = (km: number, a: number) =>
          SATURN.c.clone().addScaledVector(SATURN.u, Math.cos(a) * km * KM).addScaledVector(SATURN.v, Math.sin(a) * km * KM).toArray();
        const close: [number, number] = [8.45, 9.3];
        return [
          { at: [0, 0, 0] as [number, number, number], text: 'el Sol', e: near },
          ...PLANETS.map((p) => ({ at: onOrbit(p.a, p.ang, p.incl).toArray(), text: p.name, e: near })),
          { at: ring(130000, -0.95), text: 'anillo A', e: close },
          { at: ring(119900, -1.15), text: 'división de Cassini', e: close },
          { at: ring(104000, -1.6), text: 'anillo B', e: close },
          { at: ring(98000, 2.95), text: 'sombra de Saturno', e: close },
        ];
      })(),
      noteSpan: 5.2,
      generate() {
        const r = rng(161);
        const main = cloudBuilder(162);
        const b = main;
        const EP = SOLAR.earthPos;
        const delayOfA = (a: number) => Math.min(1, Math.abs(Math.log(a)) / Math.log(30)) * 0.85;

        // The Sun.
        for (let k = 0; k < 600; k++) b.push(gauss(r) * 0.005, gauss(r) * 0.005, gauss(r) * 0.005, 0xfff0c0, 0.004, 0, 0.9, { delay: 0.15, star: true });
        for (let k = 0; k < 4000; k++) {
          const [x, y, z] = b.onSphere();
          const rr = Math.abs(gauss(r)) * 0.08;
          b.push(x * rr, y * rr, z * rr, 0xffc070, 0.02, 0, 0.06, { delay: 0.15 });
        }

        // The orbits are lines of the plate, not things: their own cloud, so a moment can quiet
        // them (looking back from Voyager 1, only the planets themselves should show).
        const ob = cloudBuilder(163);
        // Saturn larger than life, as the others, in its own cloud: it gives way to the real one.
        const sd = cloudBuilder(164);
        for (const pl of PLANETS) {
          const isEarth = pl.name === 'Tierra';
          const b = pl.name === 'Saturno' ? sd : main;
          // Orbit.
          const n = Math.round(2600 * Math.sqrt(pl.a));
          for (let k = 0; k < n; k++) {
            const ang = r() * Math.PI * 2;
            const p = onOrbit(pl.a * (1 + gauss(r) * 0.0008), ang, pl.incl);
            let da = ang - pl.ang;
            da = Math.atan2(Math.sin(da), Math.cos(da));
            const d = isEarth ? (Math.abs(da) / Math.PI) * 0.4 : delayOfA(pl.a) + (Math.abs(da) / Math.PI) * 0.12;
            // Near the Earth, where the camera comes from, our orbit is drawn finer: seen up close
            // it would otherwise be a string of blots.
            const near = isEarth ? Math.min(1, 0.08 + p.distanceTo(EP) * 1.5) : 1;
            ob.push(p.x, p.y, p.z, isEarth ? 0x9fc4ff : 0xd8d0c0, (0.004 * pl.a + 0.002) * near, 0, isEarth ? 0.3 * (0.5 + 0.5 * near) : 0.18, { delay: d });
          }
          // The planet: a bright core and a halo.
          const c = onOrbit(pl.a, pl.ang, pl.incl);
          for (let k = 0; k < 40; k++) {
            b.push(c.x + gauss(r) * pl.size * 0.4, c.y + gauss(r) * pl.size * 0.4, c.z + gauss(r) * pl.size * 0.4, pl.hex, pl.size * 0.5, 0, 0.5, { delay: delayOfA(pl.a), flag: isEarth, star: true });
          }
          for (let k = 0; k < 260; k++) {
            const [x, y, z] = b.onSphere();
            const rr = Math.abs(gauss(r)) * pl.size * 6;
            b.push(c.x + x * rr, c.y + y * rr, c.z + z * rr, pl.hex, pl.size * 2, 0, 0.05, { delay: delayOfA(pl.a), flag: isEarth });
          }
          if (pl.name === 'Saturno') {
            for (let k = 0; k < 1500; k++) {
              const ang = r() * Math.PI * 2;
              const rr = pl.size * (1.6 + r() * 1.1);
              const x = Math.cos(ang) * rr;
              const y = Math.sin(ang) * rr;
              b.push(c.x + x, c.y + y * Math.sin(0.47), c.z + y * Math.cos(0.47), 0xe8d8b0, pl.size * 0.25, 0, 0.35, { delay: delayOfA(pl.a) });
            }
          }
        }
        // Saturn to scale (see SATURN): a banded, slightly flattened globe lit by the Sun, darkened
        // where the rings shade it; and the rings, sampled by their real profile (C, B, the Cassini
        // division, A with the Encke gap, the thin F ring), darkened where the planet shades them.
        const S = SATURN;
        const ringOpacity = (km: number) => {
          if (km < 66900 || km > 140600) return 0;
          if (km < 74500) return 0.04;
          if (km < 92000) return 0.12 + 0.1 * ((km - 74500) / 17500);
          if (km < 117580) return 0.75 + 0.25 * Math.sin(((km - 92000) / 25580) * Math.PI);
          if (km < 122170) return 0.06;
          if (km > 133420 && km < 133750) return 0;
          if (km < 136775) return 0.5;
          if (km > 140000 && km < 140400) return 0.35;
          return 0;
        };
        const sat = cloudBuilder(165);
        const p = new THREE.Vector3();
        const w = new THREE.Vector3();
        for (let k = 0; k < 70000; k++) {
          const [x, y, z] = sat.onSphere();
          // The planet's own frame: u, n (its axis, flattened 10 %), v.
          p.copy(S.u).multiplyScalar(x * S.R).addScaledVector(S.n, y * S.R * 0.902).addScaledVector(S.v, z * S.R);
          const nrm = w.copy(S.u).multiplyScalar(x).addScaledVector(S.n, y).addScaledVector(S.v, z);
          const sun = nrm.dot(S.toSun);
          let l = smoothstep(-0.06, 0.22, sun) * (0.3 + 0.7 * Math.max(0, sun));
          // The rings' shadow: follow the light back to the ring plane.
          const along = -p.dot(S.n) / S.toSun.dot(S.n);
          if (along > 0) {
            const q = p.clone().addScaledVector(S.toSun, along);
            l *= 1 - 0.8 * ringOpacity(q.length() / KM);
          }
          const lat = Math.abs(y);
          const band = Math.sin(lat * 26 + Math.sin(lat * 7) * 1.5);
          const hex = lat > 0.92 ? 0xb8b4a4 : band > 0.55 ? 0xc8a06a : band < -0.6 ? 0xf0e0b8 : 0xe2c896;
          sat.push(S.c.x + p.x, S.c.y + p.y, S.c.z + p.z, hex, S.R * 0.026, 0, 0.003 + 0.17 * l);
        }
        const rings = cloudBuilder(166);
        for (let k = 0; k < 340000; k++) {
          const km = 66900 + r() * (140600 - 66900);
          const o = ringOpacity(km);
          if (r() > 0.08 + o) continue;
          const ang = r() * Math.PI * 2;
          p.copy(S.u).multiplyScalar(Math.cos(ang) * km * KM).addScaledVector(S.v, Math.sin(ang) * km * KM);
          // The planet's shadow falls across the rings behind it.
          const t = p.dot(S.toSun);
          const shade = t < 0 && p.lengthSq() - t * t < S.R * S.R ? 0.08 : 1;
          const hex = km < 92000 ? 0xa89c88 : km < 117580 ? 0xeadcbc : 0xd6c8aa;
          rings.push(S.c.x + p.x, S.c.y + p.y, S.c.z + p.z, hex, 1100 * KM, 0, (0.002 + 0.048 * o) * shade);
        }

        // Asteroid belt and Kuiper belt.
        for (let k = 0; k < 18000; k++) {
          const a = (2.1 + r() * 1.2) * AU;
          const ang = r() * Math.PI * 2;
          b.push(Math.cos(ang) * a, gauss(r) * 0.08, Math.sin(ang) * a, 0xb0a090, 0.012, 0, 0.07, { delay: delayOfA(2.7) });
        }
        for (let k = 0; k < 16000; k++) {
          const a = (30 + r() * 20) * AU;
          const ang = r() * Math.PI * 2;
          b.push(Math.cos(ang) * a, gauss(r) * 2.2, Math.sin(ang) * a, 0x9fb4d0, 0.12, 0, 0.05, { delay: 0.9 });
        }
        // The Sun's light, plate style: a ring in the planets' plane, scaled out at a steady pace
        // (past the Earth almost at once, hours on to Neptune).
        const front = lineSet();
        front.circle(new THREE.Vector3(), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), 1, 200, 0.42);
        return { main: main.data(), orbits: ob.data(), front: front.data(), satDot: sd.data(), saturn: sat.data(), rings: rings.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 1, 1);
        const orbits = cloudFromData(data.orbits as PointsData, 1, 1);
        const front = linesFromData(data.front as LinesData, 0xffe2b0);
        const satDot = cloudFromData(data.satDot as PointsData, 1, 1);
        const saturn = cloudFromData(data.saturn as PointsData, 1, 1);
        const rings = cloudFromData(data.rings as PointsData, 1, 1);
        // The globe hides what lies behind it (the far side, the rings beyond it), as the Earth does.
        const core = new THREE.Mesh(new THREE.SphereGeometry(SATURN.R * 0.95, 64, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        core.position.copy(SATURN.c);
        core.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), SATURN.n);
        core.scale.set(1, 0.902, 1);
        core.renderOrder = -2;
        for (const c of [saturn, rings]) (c.points.material as THREE.ShaderMaterial).depthTest = true;
        // Rings a few tens of metres thick: seen edge on, they all but vanish.
        rings.u.uSurface.value.set(SATURN.n.x, SATURN.n.y, SATURN.n.z, 0.97);
        const object = new THREE.Group();
        object.add(core, cloud.points, orbits.points, front.mesh, satDot.points, saturn.points, rings.points);
        return {
          object,
          clouds: [cloud, orbits, satDot, saturn, rings],
          update(f) {
            const form = f.tl.get('solar.form', f.p);
            cloud.u.uReveal.value = form;
            orbits.u.uReveal.value = form;
            satDot.u.uReveal.value = form;
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('luna'), f.e, f.home);
            // Diving to Saturn the orbits (lines, not things) go, and the larger-than-life Saturn
            // gives way to the real one.
            const dive = f.tl.get('sat', f.p);
            orbits.u.uGain.value = (1 - 0.9 * f.tl.get('pbd', f.p)) * (1 - dive);
            const real = dive * (1 - smoothstep(f.home - 2.4, f.home - 1.7, f.e));
            satDot.u.uGain.value = 1 - real;
            saturn.u.uGain.value = real;
            rings.u.uGain.value = real;
            // Not drawn at all the rest of the time.
            saturn.points.visible = rings.points.visible = real > 0.001;
            // Only once Saturn is large on screen: a few pixels across, its own points would lose
            // the depth test against it.
            core.visible = real > 0.01 && f.e < f.home - 3.8;
            // The light front: from the Sun out past Neptune (about 31 AU).
            const light = f.tl.get('solar.light', f.p);
            front.mesh.scale.setScalar(Math.max(1e-4, light * 31 * AU));
            front.uniforms.uAlpha.value = f.alpha * smoothstep(0, 0.02, light) * (1 - smoothstep(0.7, 1, light));
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'solar.form': 0 });
      // Our orbit draws first, then the others outward; the Sun appears at the centre.
      tl.to(4.8, { e: w.home - 0.15, 'solar.form': 1, yaw: 0, pitch: 0.2, roll: 0, fov: 40 });
      tl.label('solar');
      // Rise above the ecliptic, while the Sun's light spreads out through the planets.
      tl.set({ 'solar.light': 0 });
      tl.with(3.4, { 'solar.light': 1 }, (t) => t);
      tl.to(3.4, { yaw: 0.6, pitch: 0.55, e: w.home + 0.15, fov: 46 });

      // Saturn. Below this world's home the Moon's world (and, closer still, the Earth's) frames
      // the view too, so each travels to the same point in its own units.
      const lunaCenter = new THREE.Vector3(LUNA.pos.x * 0.42, 0, LUNA.pos.z * 0.42);
      const inLuna = SATURN.c.clone().sub(SOLAR.earthPos).applyQuaternion(SOLAR.earthRot.clone().invert()).multiplyScalar(1000);
      const travel = (k: number) => ({
        'solar.tx': SATURN.c.x * k,
        'solar.ty': SATURN.c.y * k,
        'solar.tz': SATURN.c.z * k,
        'luna.tx': (inLuna.x - lunaCenter.x) * k,
        'luna.ty': (inLuna.y - lunaCenter.y) * k,
        'luna.tz': (inLuna.z - lunaCenter.z) * k,
        'tierra.tx': inLuna.x * 100 * k,
        'tierra.ty': inLuna.y * 100 * k,
        'tierra.tz': inLuna.z * 100 * k,
      });
      // At Saturn the scale is that of the Moon's orbit, far below this world's own: it is kept in view.
      // Glide over to Saturn while the view is still wide, then dive straight down to it: moving
      // the focus while the view is already small would sweep the planet out of frame.
      tl.set({ sat: 0, 'solar.keep': 0 });
      tl.to(2.4, { ...travel(1), e: 12.4, sat: 1, 'solar.keep': 1, fov: 40 });
      tl.caption(7.2, 'Saturno', 'Sus anillos miden 280 000 km de punta a punta y apenas unas decenas de metros de grosor: de canto, casi desaparecen.');
      tl.to(2.8, { e: SAT_E, ...SAT_VIEW, fov: 36 });
      tl.to(2.6, { e: SAT_E + 0.02, ...SAT_EDGE });
      // Back up, still on Saturn, then glide back to the whole system.
      tl.to(1.8, { e: 12.2 });
      tl.to(2.6, { ...travel(0), e: w.home + 0.15, sat: 0, 'solar.keep': 0, yaw: 0.6, pitch: 0.55, roll: 0, fov: 46 });
    },
  };
}

/**
 * The Saturn shots (yaw, pitch, roll on top of the chain's own view there), solved in the page like
 * the Earthrise: the camera at SATURN.dir(-1.35, 0.42) (the Sun to one side: half lit, the
 * planet's shadow across the rings), its south up (SAT_VIEW); then in the ring plane at
 * SATURN.dir(-1.2, 0.012) (SAT_EDGE). SAT_E puts the rings across half the screen.
 */
const SAT_E = 8.72;
const SAT_VIEW = { yaw: 2.4136, pitch: 0.7305, roll: -0.4528 };
const SAT_EDGE = { yaw: 2.7234, pitch: 0.4035, roll: -0.16 };
