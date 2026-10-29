import * as THREE from 'three';
import { fromEquatorial } from '../lib/astro';
import type { WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { lineSet, linesFromData, type LinesData } from './lineas';
import { SOLAR } from './solar';
import { LUNA } from './luna';

/**
 * The farthest we have reached. 1 unit = 10¹³ m (about 67 AU), the ecliptic in (x, z) as in the
 * Solar System. The paths of Voyager 1 and 2, drawn in the plate's language: out from the Earth's
 * orbit, bent by Jupiter and Saturn (and, for Voyager 2, Uranus and Neptune) where those planets
 * were at each flyby, then straight out of the plane to where they are now, past the heliopause
 * (the edge of the solar wind, which Voyager 1 crossed in 2012).
 * Arrival: the paths draw themselves, launch to today. Moment: a turn to see them leave the plane.
 */

const AU = 1.496e11 / 1e13;
const INK = 0xece7db;
const ACCENT = 0xff5b2e;

/** A point in the ecliptic at heliocentric longitude `lon` (degrees) and distance `a` (AU). */
const ecl = (lon: number, a: number) => {
  const l = (lon * Math.PI) / 180;
  return new THREE.Vector3(Math.cos(l) * a * AU, 0, -Math.sin(l) * a * AU);
};

/** Flybys as [longitude (unwrapped, prograde), distance], then today's position (late 2026). */
const V1 = { legs: [[343, 1], [488, 5.2], [542, 9.5]], now: fromEquatorial(17.22, 12.05, 171 * AU) };
const V2 = { legs: [[327, 1], [495, 5.2], [554, 9.6], [619, 19.2], [642, 30.1]], now: fromEquatorial(20.15, -59.4, 143 * AU) };

/**
 * The Pale Blue Dot: where Voyager 1 was on 14 February 1990 (about 40 AU out, on its straight
 * run above the planets' plane) when it turned round and photographed the Earth. The shot looks
 * from there at the point halfway between the Sun and the Earth, with a long lens.
 */
export const PALE_BLUE_DOT = (() => {
  const last = ecl(542, 9.5);
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 50; k++) {
    const m = (lo + hi) / 2;
    if (last.clone().lerp(V1.now, m).length() < 40 * AU) lo = m;
    else hi = m;
  }
  const probe = last.clone().lerp(V1.now, lo);
  // The focus, in the Solar System's units (the Sun at its origin, as in this world).
  const focus = SOLAR.earthPos.clone().multiplyScalar(0.5);
  return { probe, focus };
})();

/** The path: spirals between flybys (longitude even, distance geometric), then a straight run. */
function path(v: { legs: number[][]; now: THREE.Vector3 }) {
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k + 1 < v.legs.length; k++) {
    const [l0, a0] = v.legs[k];
    const [l1, a1] = v.legs[k + 1];
    for (let j = 0; j < 60; j++) {
      const t = j / 60;
      pts.push(ecl(l0 + (l1 - l0) * t, a0 * Math.pow(a1 / a0, t)));
    }
  }
  const [lf, af] = v.legs[v.legs.length - 1];
  const last = ecl(lf, af);
  for (let j = 0; j <= 120; j++) pts.push(last.clone().lerp(v.now, j / 120));
  return pts;
}

export function voyager(): WorldModule {
  return {
    spec: {
      id: 'voyager',
      territory: 'Sistema Solar',
      name: 'Voyager 1',
      fact: 'Lo más lejos que ha llegado algo nuestro. Salió hace casi cincuenta años y sigue.',
      ficha: ['lanzada en 1977; salió del viento solar en 2012', 'hoy, a casi un día luz'],
      label: 'Voyager',
      unitExp: 13,
      frame: 6,
      frameCenter: new THREE.Vector3(),
      view: [0.35, 0, 0],
      fade: [-1.4, -0.8, 0.9, 1.5],
      tint: 0xffc8a8,
      notes: [
        { at: V1.now.toArray(), text: 'Voyager 1' },
        { at: V2.now.toArray(), text: 'Voyager 2' },
        { at: [0, 0, -121 * AU], text: 'heliopausa' },
        { at: [0, 0, 0], text: 'el Sol' },
      ],
      generate() {
        const hot = lineSet();
        const ink = lineSet();
        // The paths, drawn launch to today as the arrival goes.
        hot.path(path(V1), 0.95, 0, 1);
        hot.path(path(V2), 0.5, 0, 1);
        // The heliopause, where the solar wind gives way (about 120 AU), and the termination
        // shock inside it: faint great circles, which the Oort cloud's bubble will fill.
        const X = new THREE.Vector3(1, 0, 0);
        const Y = new THREE.Vector3(0, 1, 0);
        const Z = new THREE.Vector3(0, 0, 1);
        ink.circle(new THREE.Vector3(), X, Z, 121 * AU, 160, 0.3);
        ink.circle(new THREE.Vector3(), X, Y, 121 * AU, 160, 0.14);
        ink.circle(new THREE.Vector3(), Y, Z, 121 * AU, 160, 0.14);
        ink.circle(new THREE.Vector3(), X, Z, 94 * AU, 140, 0.12);
        // One light-day from the Sun: where Voyager 1 is about to be.
        ink.circle(new THREE.Vector3(), X, Z, 173 * AU, 200, 0.07);

        // The two probes: points of light at today's positions.
        const pts = cloudBuilder(272);
        for (const [p, l] of [
          [V1.now, 0.9],
          [V2.now, 0.5],
        ] as const) {
          for (let k = 0; k < 12; k++) pts.push(p.x, p.y, p.z, 0xffd8c0, 0.001, 0, l, { star: true, delay: 0.95 });
        }
        return { hot: hot.data(), ink: ink.data(), pts: pts.data() };
      },
      assemble(data) {
        const hot = linesFromData(data.hot as LinesData, ACCENT);
        const ink = linesFromData(data.ink as LinesData, INK);
        const cloud = cloudFromData(data.pts as PointsData, 1, 1);
        const object = new THREE.Group();
        object.add(ink.mesh, hot.mesh, cloud.points);
        return {
          object,
          clouds: [cloud],
          update(f) {
            const form = f.tl.get('voy.form', f.p);
            hot.uniforms.uAlpha.value = f.alpha;
            hot.uniforms.uReveal.value = form;
            ink.uniforms.uAlpha.value = f.alpha * form;
            cloud.u.uReveal.value = form;
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'voy.form': 0 });
      // Out past the planets, the two paths drawing themselves from launch to today.
      tl.to(4.2, { e: w.home - 0.1, 'voy.form': 1, yaw: 0.2, pitch: 0.3, roll: 0, fov: 42 });
      tl.label('voyager');
      // Turn to see them leave the plane of the planets, one north, one south.
      tl.to(2.8, { yaw: -0.35, pitch: 0.12, e: w.home + 0.25, fov: 46 });

      // Looking back. From where Voyager 1 was in 1990 the camera turns to the Sun with a long
      // lens (the dolly zoom takes it out to the probe's distance): beside the Sun, the Earth.
      // The same point as a travel of each world framing it, each in its own units.
      const M = PALE_BLUE_DOT.focus;
      const lunaCenter = new THREE.Vector3(LUNA.pos.x * 0.42, 0, LUNA.pos.z * 0.42);
      const toLuna = M.clone().sub(SOLAR.earthPos).applyQuaternion(SOLAR.earthRot.clone().invert()).multiplyScalar(1000).sub(lunaCenter);
      const toVoyager = M.clone().multiplyScalar(0.01);
      const travel = (k: number) => ({
        'solar.tx': M.x * k,
        'solar.ty': M.y * k,
        'solar.tz': M.z * k,
        'luna.tx': toLuna.x * k,
        'luna.ty': toLuna.y * k,
        'luna.tz': toLuna.z * k,
        'voyager.tx': toVoyager.x * k,
        'voyager.ty': toVoyager.y * k,
        'voyager.tz': toVoyager.z * k,
      });
      tl.caption(6.8, 'Un punto azul pálido', 'Así vio la Tierra la Voyager, desde seis mil millones de kilómetros. Todo lo que conoces cabe en un píxel.');
      tl.to(3.2, { e: PBD_E, fov: 6, ...PBD_VIEW, ...travel(1), pbd: 1 });
      // A long look (GUION.md 32).
      tl.to(3.6, { e: PBD_E - 0.02, ...PBD_VIEW_END });
      // Back out: the framing returns to the Sun as the Oort cloud's arrival pulls away.
      tl.with(3.0, { ...travel(0), pbd: 0 });
    },
  };
}

/**
 * The Pale Blue Dot shot (yaw, pitch, roll on top of the chain's own view there, and the scale
 * that puts the camera at the probe's distance with a 6° lens), solved in the page like the
 * Earthrise. If the views of the Moon, the Solar System or the Earth change, solve again.
 */
const PBD_E = 11.796;
const PBD_VIEW = { yaw: 0.3813, pitch: -0.3019, roll: 0.3217 };
const PBD_VIEW_END = { yaw: 0.3952, pitch: -0.2829, roll: 0.2734 };
