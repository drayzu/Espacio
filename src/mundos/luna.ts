import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { GIRO_TIERRA, R_EARTH, SUN_DIR, TIERRA } from './tierra';
import { SOLAR } from './solar';
import { TEXTURAS, mover, puntos, unaVez } from '../engine/cuerpos';
import { luna as lunaH, mercurio, venus, marte, jupiter, saturno, urano, neptuno } from '../horizontes';

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

/**
 * Its sentence drawn: every other planet, side by side, fits between the Earth and the Moon. To
 * scale (radii in units of 100 000 km), from the Earth's surface out (shrunk by a hair so Neptune
 * clears the Moon at this mean distance); `delay` is when each appears as the row draws itself.
 */
const ROW = (() => {
  const RADII: [number, number][] = [
    [0.0244, 0],
    [0.0605, 0],
    [0.0339, 0],
    [0.6991, 0.05],
    [0.5823, 0.47],
    [0.2536, 0],
    [0.2462, 0.49],
  ];
  const Re = R_EARTH / 100;
  const u = LUNA.pos.clone().normalize();
  const gap = LUNA.pos.length() - Re - Rm;
  const fit = (gap / RADII.reduce((acc, [rad]) => acc + 2 * rad, 0)) * 0.995;
  let along = Re;
  return RADII.map(([rad0, tilt]) => {
    const r = rad0 * fit;
    const c = u.clone().multiplyScalar(along + r);
    along += 2 * r;
    return { c, r, tilt, delay: (along / LUNA.pos.length()) * 0.85 };
  });
})();

/**
 * The Moon and the planets of the row as Horizontes draws them, from real maps, made once. The
 * planets of the row are small on screen: fewer points than the Horizontes defaults.
 */
const lunaReal = unaVez(() => lunaH(TEXTURAS, { puntos: puntos(320000) }));
const filaReal = unaVez(() => [
  mercurio(TEXTURAS, { puntos: puntos(40000) }),
  venus(TEXTURAS, { puntos: puntos(60000) }),
  marte(TEXTURAS, { puntos: puntos(50000) }),
  jupiter(TEXTURAS, { puntos: puntos(220000) }),
  saturno(TEXTURAS, { puntos: puntos(180000), puntosAnillos: puntos(220000) }),
  urano(TEXTURAS, { puntos: puntos(110000) }),
  neptuno(TEXTURAS, { puntos: puntos(110000) }),
]);

export function luna(): WorldModule {
  const frameCenter = new THREE.Vector3(LUNA.pos.x * 0.42, 0, LUNA.pos.z * 0.42);
  return {
    spec: {
      id: 'luna',
      territory: 'Sistema Solar',
      name: 'La Tierra y la Luna',
      fact: 'Entre las dos cabrían todos los demás planetas, uno junto a otro.',
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
        const b = cloudBuilder(153);
        const Re = R_EARTH / 100;

        // The Earth as seen from here: a small lit sphere, the stand-in for the Earth world.
        for (let k = 0; k < 4000; k++) {
          const [x, y, z] = b.onSphere();
          const l = Math.max(0, x * SUN_DIR.x + y * SUN_DIR.y + z * SUN_DIR.z);
          b.push(x * Re, y * Re, z * Re, k % 3 ? 0x3f7fd0 : 0x6fbf6a, 0.006, 0, 0.05 + 0.6 * l, { flag: true });
        }
        // Its soft halo, so an Earth a few pixels wide can still be found (as the Moon's, below).
        const eh = cloudBuilder(159);
        for (let k = 0; k < 900; k++) {
          const [x, y, z] = eh.onSphere();
          const re = Math.abs(gauss(r)) * 0.09;
          eh.push(x * re, y * re, z * re, 0x6fa8ff, 0.012, 0, 0.05);
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
        const M = LUNA.pos;
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
        return { main: b.data(), halo: h.data(), earthHalo: eh.data(), orbit: o.data(), beacon: bc.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 1, 1);
        const halo = cloudFromData(data.halo as PointsData, 1, 1);
        const earthHalo = cloudFromData(data.earthHalo as PointsData, 1, 1);
        const orbit = cloudFromData(data.orbit as PointsData, 1, 1);
        const beacon = cloudFromData(data.beacon as PointsData, 1, 1);
        // The Moon from its real map, its near side towards the Earth (Horizontes puts longitude 0,
        // the sub-Earth point, on +x).
        const moon = lunaReal();
        moon.group.position.copy(LUNA.pos);
        const toEarth = LUNA.pos.clone().negate().normalize();
        moon.group.rotation.set(0, Math.atan2(-toEarth.z, toEarth.x), 0);
        moon.group.scale.setScalar(Rm);
        // The planets in a row, each where ROW puts it.
        const row = filaReal();
        ROW.forEach((pl, k) => {
          const b = row[k];
          b.group.position.copy(pl.c);
          b.group.scale.setScalar(pl.r);
          b.group.rotation.set(0, 0, 0);
          if (pl.tilt) b.group.rotateX(pl.tilt);
        });
        const object = new THREE.Group();
        object.add(cloud.points, moon.group, halo.points, earthHalo.points, orbit.points, beacon.points, ...row.map((b) => b.group));
        return {
          object,
          clouds: [cloud, halo, earthHalo, orbit, beacon],
          update(f) {
            const form = f.tl.get('luna.form', f.p);
            for (const c of [cloud, halo, orbit]) c.u.uReveal.value = form;
            mover(moon, f, SUN_DIR, smoothstep(0.45, 0.6, form) * f.alpha);
            // Close to the Moon its orbit would cut the frame (and pass by the camera): it comes
            // in as the camera pulls back.
            orbit.u.uGain.value = smoothstep(f.home - 1.3, f.home - 0.6, f.e);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('tierra'), f.e, f.home);
            // The halo is for finding a Moon a pixel wide: gone when it is close.
            halo.u.uGain.value = smoothstep(f.home - 1.2, f.home - 0.5, f.e);
            earthHalo.u.uGain.value = halo.u.uGain.value;
            beacon.u.uGain.value = smoothstep(f.home + 0.15, f.home + 0.7, f.e);
            // The planets in a row: they appear from the Earth out, gone before the Solar System.
            const reveal = f.tl.get('luna.row', f.p);
            const gone = 1 - smoothstep(f.home + 0.12, f.home + 0.4, f.e);
            ROW.forEach((pl, k) => mover(row[k], f, SUN_DIR, smoothstep(pl.delay - 0.02, pl.delay + 0.08, reveal) * gone * f.alpha));
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
      // (The picture, turned to show the Earth north up, turns back as the camera swings round.)
      tl.set({ giro: GIRO_TIERRA });
      tl.to(3.2, { e: 7.0, 'luna.rise': 1, ...EARTHRISE_VIEW, fov: 16, giro: 0 });
      tl.label('luna');
      tl.caption(2.8, 'La salida de la Tierra', 'Nochebuena de 1968: por primera vez, alguien vio la Tierra asomar sobre el horizonte de otro mundo.');
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
