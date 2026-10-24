import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { perlin3 } from '../lib/puntos';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { R_EARTH, SUN_DIR, TIERRA } from './tierra';
import { SOLAR } from './solar';

/**
 * The Earth and the Moon. 1 unit = 100 000 km; the Earth at the origin, the Moon on its orbit
 * 384 400 km away, lit by the same sun (so its phase is right: here a little past the quarter, so
 * each, seen from the other, is mostly lit).
 * Arrival: the Earthrise. Leaving the Earth the camera flies out to the Moon and looks back from
 * beyond it: the Earth rising over the lunar horizon, as Apollo 8 saw it in 1968. Then it pulls
 * back until both fit, the orbit drawing itself.
 */

export const LUNA = (() => {
  const angle = 3.287;
  const pos = new THREE.Vector3(Math.cos(angle) * 3.844, 0.12, Math.sin(angle) * 3.844);
  return { angle, pos };
})();

const Rm = 0.01737;

/**
 * The Earthrise shot, in the Earth's units (Mm): sunlight from the right of the frame, the frame's
 * centre a little above the Moon (its horizon low, the Earth above it).
 */
export const EARTHRISE = (() => {
  const moon = LUNA.pos.clone().multiplyScalar(100);
  const toEarth = moon.clone().negate().normalize();
  const right = SUN_DIR.clone().sub(toEarth.clone().multiplyScalar(SUN_DIR.dot(toEarth))).normalize();
  const up = toEarth.clone().negate().cross(right).normalize();
  const focus = moon.clone().addScaledVector(up, 2.2);
  return { moon, toEarth, right, up, focus };
})();

/** The Earthrise focus as a travel of each world it is framed from (each in its own units). */
const travelTo = (() => {
  const F = EARTHRISE.focus;
  const valle = F.clone().sub(TIERRA.anchor).applyQuaternion(TIERRA.anchorRot.clone().invert()).multiplyScalar(1000).sub(new THREE.Vector3(0.6, 0, -1.2));
  const tierra = F.clone();
  return { valle, tierra };
})();

export function luna(): WorldModule {
  const frameCenter = new THREE.Vector3(LUNA.pos.x * 0.42, 0, LUNA.pos.z * 0.42);
  return {
    spec: {
      id: 'luna',
      territory: 'Sistema Solar',
      name: 'La Tierra y la Luna',
      fact: 'Entre ambas cabrían todos los demás planetas del Sistema Solar, uno junto a otro.',
      label: 'Luna',
      unitExp: 8,
      anchor: SOLAR.earthPos,
      anchorRot: SOLAR.earthRot,
      frame: 11,
      frameCenter,
      view: 'continue',
      // Early: the Moon must be there, whole, for the Earthrise.
      fade: [-2.8, -2.3, 1.3, 1.9],
      tint: 0xd8dce8,
      notes: [
        { at: [0, 0, 0], text: 'la Tierra' },
        { at: LUNA.pos.toArray(), text: 'la Luna' },
      ],
      generate() {
        const r = rng(151);
        const noise = perlin3(152);
        const b = cloudBuilder(153);
        const Re = R_EARTH / 100;

        // The Earth as seen from here: a small lit sphere, the stand-in for the Earth world.
        for (let k = 0; k < 4000; k++) {
          const [x, y, z] = b.onSphere();
          const l = Math.max(0, x * SUN_DIR.x + y * SUN_DIR.y + z * SUN_DIR.z);
          b.push(x * Re, y * Re, z * Re, k % 3 ? 0x3f7fd0 : 0x6fbf6a, 0.006, 0, 0.05 + 0.6 * l, { flag: true });
        }
        for (let k = 0; k < 900; k++) {
          const [x, y, z] = b.onSphere();
          const re = Math.abs(gauss(r)) * 0.09;
          b.push(x * re, y * re, z * re, 0x6fa8ff, 0.012, 0, 0.05, { flag: true });
        }
        // The orbit, drawn from the Moon's side outward.
        const o = cloudBuilder(156);
        for (let k = 0; k < 9000; k++) {
          const a = r() * Math.PI * 2;
          const rad = 3.844 * (1 + gauss(r) * 0.0015);
          let da = a - LUNA.angle;
          da = Math.atan2(Math.sin(da), Math.cos(da));
          o.push(Math.cos(a) * rad, 0.12 * Math.cos(a - LUNA.angle), Math.sin(a) * rad, 0xd8dce8, 0.008, 0, 0.06, { delay: 0.1 + (Math.abs(da) / Math.PI) * 0.6 });
        }
        // The Earth as the Moon sees it: its day side, bright enough to stand out from 400 000 km
        // (the Earth world's own points are far below a pixel there). Shown only for the Earthrise.
        const ea = cloudBuilder(157);
        for (let k = 0; k < 9000; k++) {
          const [x, y, z] = ea.onSphere();
          const sun = x * SUN_DIR.x + y * SUN_DIR.y + z * SUN_DIR.z;
          if (sun < -0.05) continue;
          const land = noise(x * 1.6 + 9, y * 1.6, z * 1.6, 3) > 0.12;
          const cloud = noise(x * 4 + 3, y * 4, z * 4, 3) > 0.25;
          const hex = cloud ? 0xf4f6ff : land ? 0x8fae6a : 0x3f7fd0;
          const l = smoothstep(-0.05, 0.3, sun) * (0.5 + 0.5 * sun);
          ea.push(x * Re * 1.004, y * Re * 1.004, z * Re * 1.004, hex, 0.012, 0, (cloud ? 0.26 : 0.2) * l);
        }

        // The Moon, fine enough to be seen up close: maria and highlands, and craters (bright rims,
        // darker floors), lit by the same sun with a soft terminator.
        const m = cloudBuilder(154);
        const M = LUNA.pos;
        const craters: { c: THREE.Vector3; r: number }[] = [];
        for (let k = 0; k < 260; k++) {
          const [x, y, z] = m.onSphere();
          craters.push({ c: new THREE.Vector3(x, y, z), r: 0.015 + Math.pow(r(), 3) * 0.22 });
        }
        const n = new THREE.Vector3();
        for (let k = 0; k < 70000; k++) {
          const [x, y, z] = m.onSphere();
          n.set(x, y, z);
          let albedo = noise(x * 2.2, y * 2.2, z * 2.2, 3) > 0.1 ? 0.55 : 1;
          let rim = 0;
          for (const cr of craters) {
            const d = n.distanceTo(cr.c);
            if (d > cr.r * 1.25) continue;
            const t = d / cr.r;
            if (t < 0.85) albedo *= 0.8;
            else rim = Math.max(rim, 1 - Math.abs(t - 1) / 0.25);
          }
          const sun = x * SUN_DIR.x + y * SUN_DIR.y + z * SUN_DIR.z;
          const l = smoothstep(-0.08, 0.35, sun) * (0.55 + 0.45 * Math.max(0, sun)) * (albedo + rim * 0.5);
          const hex = albedo < 0.7 ? 0xa8a8b0 : 0xe4e4ea;
          m.push(M.x + x * Rm, M.y + y * Rm, M.z + z * Rm, hex, 0.0009, 0, 0.006 + 0.05 * l, { delay: 0.5 });
        }
        // Soft halo, so a Moon a pixel wide can still be found.
        const h = cloudBuilder(155);
        for (let k = 0; k < 900; k++) {
          const [x, y, z] = h.onSphere();
          const rr = Math.abs(gauss(r)) * 0.035;
          h.push(M.x + x * rr, M.y + y * rr, M.z + z * rr, 0xe8e8ee, 0.01, 0, 0.05, { delay: 0.55 });
        }
        // Beacons: pulling back, the Earth and the Moon stay in sight as points of light (a pale
        // blue dot and a fainter grey one) instead of dimming away below a pixel.
        const bc = cloudBuilder(158);
        for (let k = 0; k < 5; k++) bc.push(gauss(r) * 0.01, gauss(r) * 0.01, gauss(r) * 0.01, 0x5f94ff, 0.006, 0, 0.32, { star: true });
        for (let k = 0; k < 3; k++) bc.push(M.x + gauss(r) * 0.003, M.y + gauss(r) * 0.003, M.z + gauss(r) * 0.003, 0xdcdce4, 0.002, 0, 0.3, { star: true });
        // Its sentence drawn: every other planet, side by side, fits between the Earth and the
        // Moon. To scale (radii in units of 100 000 km), lit by the same sun, from the Earth's
        // surface out (shrunk by a hair so Neptune clears the Moon at this mean distance).
        const row = cloudBuilder(159);
        const PL: [number, number[], number][] = [
          [0.0244, [0xa8a29a], 400],
          [0.0605, [0xe8d8a8], 900],
          [0.0339, [0xc8603a], 600],
          [0.6991, [0xe0c49a, 0xc8986a, 0xf0e4d0], 9000],
          [0.5823, [0xe6d2a0, 0xd4bc88], 7500],
          [0.2536, [0xa6dce4], 3200],
          [0.2462, [0x6a8cf0, 0x5070d8], 3200],
        ];
        const u = LUNA.pos.clone().normalize();
        const gap = LUNA.pos.length() - Re - Rm;
        const fit = gap / PL.reduce((acc, [rad]) => acc + 2 * rad, 0) * 0.995;
        let along = Re;
        for (const [rad0, hexes, n] of PL) {
          const rad = rad0 * fit;
          const c = u.clone().multiplyScalar(along + rad);
          along += 2 * rad;
          for (let k = 0; k < n; k++) {
            const [x, y, z] = row.onSphere();
            const sun = x * SUN_DIR.x + y * SUN_DIR.y + z * SUN_DIR.z;
            if (sun < -0.1) continue;
            // Bands for the giants: the colour follows latitude.
            const hex = hexes[Math.floor(Math.abs(Math.sin(y * 9 + noise(x * 3, y * 3, z * 3, 2) * 1.5)) * hexes.length) % hexes.length];
            const l = smoothstep(-0.1, 0.35, sun) * (0.5 + 0.5 * Math.max(0, sun));
            row.push(c.x + x * rad, c.y + y * rad, c.z + z * rad, hex, rad * 0.05, 0, 0.1 * l, { delay: (along / LUNA.pos.length()) * 0.85 });
          }
        }
        return { main: b.data(), moon: m.data(), halo: h.data(), orbit: o.data(), earth: ea.data(), beacon: bc.data(), row: row.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 1, 1);
        const moon = cloudFromData(data.moon as PointsData, 1, 1);
        const halo = cloudFromData(data.halo as PointsData, 1, 1);
        const orbit = cloudFromData(data.orbit as PointsData, 1, 1);
        const earth = cloudFromData(data.earth as PointsData, 1, 1);
        const beacon = cloudFromData(data.beacon as PointsData, 1, 1);
        const row = cloudFromData(data.row as PointsData, 1, 1);
        // Only the near sides show: the Moon's points test depth against its dark core, the
        // Earth's against the Earth world's.
        (moon.points.material as THREE.ShaderMaterial).depthTest = true;
        (earth.points.material as THREE.ShaderMaterial).depthTest = true;
        const core = new THREE.Mesh(new THREE.SphereGeometry(Rm * 0.99, 64, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        core.position.copy(LUNA.pos);
        core.renderOrder = -2;
        const object = new THREE.Group();
        object.add(core, cloud.points, moon.points, halo.points, orbit.points, earth.points, beacon.points, row.points);
        return {
          object,
          clouds: [cloud, moon, halo, orbit, earth, beacon, row],
          update(f) {
            const form = f.tl.get('luna.form', f.p);
            for (const c of [cloud, moon, halo, orbit]) c.u.uReveal.value = form;
            // Close to the Moon its orbit would cut the frame (and pass by the camera): it comes
            // in as the camera pulls back.
            orbit.u.uGain.value = smoothstep(f.home - 1.3, f.home - 0.6, f.e);
            earth.u.uGain.value = f.tl.get('luna.rise', f.p);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('tierra'), f.e, f.home);
            // The halo is for finding a Moon a pixel wide: gone when it is close.
            halo.u.uGain.value = smoothstep(f.home - 1.2, f.home - 0.5, f.e);
            beacon.u.uGain.value = smoothstep(f.home + 0.15, f.home + 0.7, f.e);
            // The planets in a row: drawn from the Earth out, gone before the Solar System.
            row.u.uReveal.value = f.tl.get('luna.row', f.p);
            row.u.uGain.value = 1 - smoothstep(f.home + 0.12, f.home + 0.4, f.e);
            core.visible = f.alpha > 0.05;
          },
        };
      },
    },
    choreo(tl, w) {
      const T = travelTo;
      // The same point for the Moon world: halfway, then at the Earthrise focus.
      const mid = EARTHRISE.focus.clone().multiplyScalar(0.005).sub(frameCenter);
      const L = EARTHRISE.focus.clone().multiplyScalar(0.01).sub(frameCenter);
      tl.set({ 'luna.form': 0, 'luna.rise': 0 });
      // Off to the Moon: the camera pulls back until the Earth and the Moon both fit, their orbit
      // drawing itself between them...
      tl.to(2.8, {
        e: 8.6,
        'luna.form': 1,
        'tierra.tx': T.tierra.x * 0.5,
        'tierra.ty': T.tierra.y * 0.5,
        'tierra.tz': T.tierra.z * 0.5,
        'valle.tx': T.valle.x,
        'valle.ty': T.valle.y,
        'valle.tz': T.valle.z,
        'luna.tx': mid.x,
        'luna.ty': mid.y,
        'luna.tz': mid.z,
        fov: 36,
      });
      // ...and falls towards the Moon, coming in from beyond it and looking back: the Earth rises
      // over the lunar horizon. The Moon comes to the centre first, so it stays in sight while the
      // camera swings round behind it.
      tl.with(1.6, {
        'tierra.tx': T.tierra.x,
        'tierra.ty': T.tierra.y,
        'tierra.tz': T.tierra.z,
        'luna.tx': L.x,
        'luna.ty': L.y,
        'luna.tz': L.z,
      });
      tl.to(3.2, { e: 7.0, 'luna.rise': 1, ...EARTHRISE_VIEW, fov: 16 });
      tl.label('luna');
      tl.caption(2.8, 'La salida de la Tierra', 'Apollo 8, Nochebuena de 1968: la primera vez que alguien vio la Tierra asomar sobre el horizonte de otro mundo.');
      tl.to(2.6, { e: 6.96, ...EARTHRISE_VIEW_END, fov: 15 });
      // Then back, until the Earth and the Moon both fit, the orbit around them.
      // (Solved like the Earthrise: the orbit seen from 50° above its plane, the pair level.)
      tl.set({ 'luna.row': 0 });
      tl.to(4.4, { e: w.home - 0.05, 'luna.tx': 0, 'luna.ty': 0, 'luna.tz': 0, 'luna.rise': 0, yaw: 0.506, pitch: -0.568, roll: -0.145, fov: 42 });
      // Every other planet, side by side, between the two: closer in, framed on the row (the
      // Earth's world still weighs in the framing here, so it travels to the same point).
      const row = LUNA.pos.clone().multiplyScalar(0.5).sub(frameCenter);
      const rowT = LUNA.pos.clone().multiplyScalar(50);
      tl.to(2.6, {
        'luna.row': 1,
        e: w.home - 0.2,
        'luna.tx': row.x,
        'luna.ty': row.y,
        'luna.tz': row.z,
        'tierra.tx': rowT.x,
        'tierra.ty': rowT.y,
        'tierra.tz': rowT.z,
      });
      // And back to the pair as the Solar System arrives.
      tl.with(2.6, { 'luna.tx': 0, 'luna.ty': 0, 'luna.tz': 0, 'tierra.tx': 0, 'tierra.ty': 0, 'tierra.tz': 0 });
    },
  };
}

/**
 * Camera angles for the Earthrise (yaw, pitch, roll on top of the chain's own view there), solved
 * in the page for the frame of EARTHRISE: looking from beyond the Moon towards the Earth, tilted
 * down by 0.6° (the Earth just clearing the horizon) and then by 3.4° (risen). If the views of the
 * valley or the Earth change, solve them again.
 */
const EARTHRISE_VIEW = { yaw: 2.0738, pitch: 0.5737, roll: 0.4113 };
const EARTHRISE_VIEW_END = { yaw: 2.1006, pitch: 0.5496, roll: 0.4615 };
