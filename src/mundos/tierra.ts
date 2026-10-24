import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { perlin3 } from '../lib/puntos';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { lineSet, linesFromData, type LinesData } from './lineas';

/**
 * The Earth. 1 unit = 1 Mm (1000 km), y towards the north pole. Our valley lies in southern
 * Chile (40° S, 72° W): ocean to the west, a long snowy range to the east. The rest is procedural.
 * More detail around the valley (log-polar on the sphere), baked sunlight with a terminator and
 * city lights on the night side, clouds that leave our valley clear, a glowing limb.
 * A black core hides the far hemisphere (additive points would otherwise see through the planet).
 * Arrival: the planet assembles outward from our valley. Moment: a slow orbit, while the orbit of
 * the International Space Station draws itself round the globe (400 km up, inclined 51.6°): the
 * farthest place where people live today.
 */

export const R_EARTH = 6.371;
const LAT0 = (-40 * Math.PI) / 180;
const LON0 = (-72 * Math.PI) / 180;
const normalAt = (lat: number, lon: number) => new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));

export const TIERRA = (() => {
  const n = normalAt(LAT0, LON0);
  return {
    normal: n,
    anchor: n.clone().multiplyScalar(R_EARTH),
    anchorRot: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n),
  };
})();

/**
 * The Space Station's orbit: 400 km up, inclined 51.6° to the equator; `t` (0..1) runs round it
 * from the station, placed where the camera sees it in front of the globe during the moment.
 */
const issAt = (() => {
  const incl = (51.6 * Math.PI) / 180;
  const node = LON0 + 0.9;
  const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(Math.cos(node), 0, Math.sin(node)), incl);
  const R_ISS = R_EARTH + 0.4;
  const T0 = 0.81;
  return (t: number, out = new THREE.Vector3()) => out.set(Math.cos((t + T0) * Math.PI * 2 + node), 0, Math.sin((t + T0) * Math.PI * 2 + node)).multiplyScalar(R_ISS).applyQuaternion(tilt);
})();

// Afternoon over the valley: the sun is 40° to its north-west.
export const SUN_DIR = normalAt(LAT0 + 0.35, LON0 - 0.55).normalize();

export function tierra(): WorldModule {
  return {
    spec: {
      id: 'tierra',
      territory: 'Tierra',
      name: 'La Tierra',
      fact: 'Ocho mil millones de personas, y todo lo vivo que conocemos, en una sola esfera.',
      label: 'Tierra',
      unitExp: 6,
      frame: 20,
      frameCenter: new THREE.Vector3(),
      view: 'continue',
      fade: [-3.5, -2.7, 1.4, 2.0],
      tint: 0x7fb4ff,
      notes: [
        { at: TIERRA.anchor.toArray(), text: 'nuestro valle' },
        { at: normalAt((-28 * Math.PI) / 180, (-69.5 * Math.PI) / 180).multiplyScalar(R_EARTH).toArray(), text: 'los Andes' },
        { at: normalAt((-35 * Math.PI) / 180, (-95 * Math.PI) / 180).multiplyScalar(R_EARTH).toArray(), text: 'océano Pacífico' },
        { at: issAt(0).toArray(), text: 'Estación Espacial', e: [7.0, 7.45] },
      ],
      generate() {
        const r = rng(141);
        const noise = perlin3(142);
        const b = cloudBuilder(143);
        const N0 = TIERRA.normal;

        const surface = (dir: THREE.Vector3) => {
          const lat = Math.asin(dir.y);
          const lon = Math.atan2(dir.z, dir.x);
          // Local frame around the valley, in radians.
          let dLon = lon - LON0;
          if (dLon > Math.PI) dLon -= Math.PI * 2;
          if (dLon < -Math.PI) dLon += Math.PI * 2;
          const east = dLon * Math.cos(LAT0);
          const north = lat - LAT0;
          const inChile = smoothstep(-0.75, -0.6, north) * (1 - smoothstep(0.75, 0.9, north));
          const coast = -0.012 + 0.006 * Math.sin(north * 40) + 0.004 * noise(north * 30, 1, 0, 2);
          // The range: broken, uneven, snow only in stretches.
          const range = Math.exp(-Math.pow((east - 0.026 - 0.004 * noise(north * 12, 2, 0, 2)) / 0.008, 2)) * inChile * (0.45 + 0.55 * noise(north * 25, 3, 0, 3) + 0.3);
          let h = noise(dir.x * 1.7, dir.y * 1.7, dir.z * 1.7, 5) + 0.25 * noise(dir.x * 5, dir.y * 5, dir.z * 5, 3);
          // Land along the valley's coast, ocean beyond it.
          h = h * (1 - inChile * smoothstep(-0.2, -0.05, east) * (1 - smoothstep(0.25, 0.5, east))) + inChile * (east > coast ? 0.18 : -0.25) * (1 - smoothstep(0.2, 0.5, Math.abs(east)));
          const land = h > 0.08;
          const polar = Math.abs(lat) > 1.15 + 0.08 * noise(dir.x * 4, dir.y * 4, dir.z * 4, 2);
          let hex = land ? (noise(dir.x * 3 + 5, dir.y * 3, dir.z * 3, 3) > 0.1 && Math.abs(lat) < 0.6 ? 0x9c8c6c : 0x2f6a3a) : h > -0.06 ? 0x174a85 : 0x0c2c62;
          if (land && range > 0.45) hex = range > 0.85 && noise(north * 60, 4, east * 60, 2) > 0.05 ? 0xeef4ff : 0x7a6f62;
          if (polar) hex = 0xe6eef6;
          return { land, hex, lat };
        };
        const light = (dir: THREE.Vector3) => Math.max(0, dir.dot(SUN_DIR));
        const delayOf = (dir: THREE.Vector3) => (Math.acos(THREE.MathUtils.clamp(dir.dot(N0), -1, 1)) / Math.PI) * 0.92;

        const put = (dir: THREE.Vector3, size: number, flag = false, gain = 1) => {
          const s = surface(dir);
          const l = light(dir);
          const day = smoothstep(-0.05, 0.2, dir.dot(SUN_DIR));
          b.push(dir.x * R_EARTH, dir.y * R_EARTH, dir.z * R_EARTH, s.hex, size, 0, (0.03 + 1.05 * Math.pow(l, 0.8)) * (s.hex === 0xeef4ff || s.hex === 0xe6eef6 ? 0.42 : 0.3) * gain, { delay: flag ? 0 : delayOf(dir), flag });
          // City lights on the night side.
          if (s.land && day < 0.6 && noise(dir.x * 22, dir.y * 22, dir.z * 22, 2) > 0.22 && Math.abs(s.lat) < 1.0) {
            b.push(dir.x * R_EARTH * 1.001, dir.y * R_EARTH * 1.001, dir.z * R_EARTH * 1.001, 0xffa050, size * 0.6, 0, 0.9 * (1 - day), { delay: delayOf(dir) });
          }
        };

        // Even coverage of the whole globe.
        const golden = Math.PI * (3 - Math.sqrt(5));
        const N = 260000;
        const dir = new THREE.Vector3();
        for (let i = 0; i < N; i++) {
          const y = 1 - (2 * (i + 0.5)) / N;
          const rr = Math.sqrt(1 - y * y);
          // A little disorder, so the lattice never shows.
          dir.set(Math.cos(i * golden) * rr + (r() - 0.5) * 0.008, y + (r() - 0.5) * 0.008, Math.sin(i * golden) * rr + (r() - 0.5) * 0.008).normalize();
          put(dir, 0.062);
        }
        // Extra detail around our valley, log-polar on the sphere.
        const t1 = new THREE.Vector3().crossVectors(N0, new THREE.Vector3(0, 1, 0)).normalize();
        const t2 = new THREE.Vector3().crossVectors(N0, t1);
        for (let i = 0; i < 74000; i++) {
          const ang = 0.0009 * Math.exp(r() * Math.log(0.45 / 0.0009));
          const th = r() * Math.PI * 2;
          dir.copy(N0).multiplyScalar(Math.cos(ang)).addScaledVector(t1, Math.sin(ang) * Math.cos(th)).addScaledVector(t2, Math.sin(ang) * Math.sin(th)).normalize();
          // Same coverage as the valley's own ground, so its patch of land blends in: it brightens
          // over the same 6 to 12 km where the valley fades into its haze, so there is no seam.
          const km = ang * R_EARTH * 1000;
          put(dir, R_EARTH * ang * 0.028, false, smoothstep(6, 12, km));
        }

        // Clouds, keeping our valley clear: swirls (noise bent by noise), most along the equator
        // and the mid-latitude storm tracks, few over the subtropical deserts. Many fine points,
        // so they read as veils rather than blots.
        for (let i = 0; i < 70000; i++) {
          const [x, y, z] = b.onSphere();
          dir.set(x, y, z);
          if (dir.dot(N0) > Math.cos(0.08)) continue;
          const lat = Math.abs(Math.asin(y));
          const belt = 0.55 * Math.exp(-((lat / 0.12) ** 2)) + 0.6 * Math.exp(-(((lat - 0.95) / 0.22) ** 2)) - 0.35 * Math.exp(-(((lat - 0.42) / 0.12) ** 2));
          const wx = noise(x * 1.3 + 3, y * 1.3, z * 1.3, 2) * 1.6;
          const wy = noise(x * 1.3, y * 1.3 + 5, z * 1.3, 2) * 1.6;
          const wz = noise(x * 1.3, y * 1.3, z * 1.3 + 7, 2) * 1.6;
          const c = noise(x * 2.6 + wx, y * 2.6 + wy, z * 2.6 + wz, 4) + 0.2 * noise(x * 10, y * 10, z * 10, 2) + belt * 0.35;
          if (c < 0.2) continue;
          const dens = smoothstep(0.2, 0.5, c);
          const k = R_EARTH * 1.008;
          b.push(x * k, y * k, z * k, 0xffffff, 0.07, 0.0, (0.02 + 0.8 * light(dir)) * 0.32 * (0.45 + 0.55 * dens), { delay: delayOf(dir) });
        }
        // Atmosphere: denser low, brighter on the day side; additive points brighten the limb by themselves.
        for (let i = 0; i < 30000; i++) {
          const [x, y, z] = b.onSphere();
          dir.set(x, y, z);
          const k = R_EARTH * (1.004 + Math.pow(r(), 2.2) * 0.05);
          b.push(x * k, y * k, z * k, 0x4f86ff, 0.1, 0, 0.07 * (0.25 + light(dir)), { delay: delayOf(dir) });
        }

        // The Space Station's orbit, plate style: a dashed ring 400 km up, inclined 51.6° to the
        // equator, drawn from the station onward; and the station, a point of light.
        const iss = lineSet();
        const ring = issAt;
        const a = new THREE.Vector3();
        const c = new THREE.Vector3();
        const DASHES = 90;
        for (let d = 0; d < DASHES; d++) {
          for (let j = 0; j < 2; j++) {
            const t0 = (d + j * 0.3) / DASHES;
            const t1 = (d + (j + 1) * 0.3) / DASHES;
            iss.segment(ring(t0, a), ring(t1, c), 0.8, t0 * 0.97, t1 * 0.97);
          }
        }
        const station = cloudBuilder(144);
        ring(0, a);
        for (let k = 0; k < 6; k++) station.push(a.x, a.y, a.z, 0xffffff, 0.01, 0, 0.8, { star: true });
        // A small glow, so the point can be found against the bright limb.
        for (let k = 0; k < 40; k++) {
          const [x, y, z] = station.onSphere();
          const rr = Math.abs(gauss(r)) * 0.06;
          station.push(a.x + x * rr, a.y + y * rr, a.z + z * rr, 0xfff4e8, 0.1, 0, 0.12);
        }
        return { main: b.data(), iss: iss.data(), station: station.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 1, 1);
        // Only the near side shows: points test depth against the dark core.
        (cloud.points.material as THREE.ShaderMaterial).depthTest = true;
        // The station's orbit and the station hide behind the planet too.
        const iss = linesFromData(data.iss as LinesData, 0xff5b2e);
        (iss.mesh.material as THREE.ShaderMaterial).depthTest = true;
        const station = cloudFromData(data.station as PointsData, 1, 1);
        (station.points.material as THREE.ShaderMaterial).depthTest = true;
        const core = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH * 0.995, 96, 48), new THREE.MeshBasicMaterial({ color: 0x000000 }));
        core.renderOrder = -2;
        const object = new THREE.Group();
        object.add(core, cloud.points, iss.mesh, station.points);
        return {
          object,
          clouds: [cloud, station],
          update(f) {
            cloud.u.uReveal.value = f.tl.get('tierra.form', f.p);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('valle'), f.e, f.home);
            core.visible = f.alpha > 0.05;
            const orbit = f.tl.get('iss.form', f.p);
            iss.uniforms.uReveal.value = orbit;
            iss.uniforms.uAlpha.value = f.alpha * smoothstep(0, 0.05, orbit) * (1 - f.tl.get('iss.away', f.p));
            station.u.uGain.value = smoothstep(0, 0.05, orbit) * (1 - f.tl.get('iss.away', f.p));
          },
        };
      },
    },
    choreo(tl, w) {
      // The framing starts on our valley and only settles on the planet's centre once the camera is
      // far out: drifting there sooner would take the camera through the Earth.
      const A = TIERRA.anchor;
      // (The planet has begun to assemble round the valley during the valley's moment.)
      tl.set({ 'tierra.tx': A.x, 'tierra.ty': A.y, 'tierra.tz': A.z });
      // The ground curves away beneath us and becomes a planet, assembled outward from our valley.
      tl.with(5.0, { e: w.home - 0.2, 'tierra.form': 1, yaw: 0, pitch: 0, roll: 0, fov: 40 });
      tl.wait(2.6);
      tl.to(2.4, { 'tierra.tx': 0, 'tierra.ty': 0, 'tierra.tz': 0 });
      tl.label('tierra');
      // A slow orbit; the Space Station's orbit draws itself round the globe.
      tl.set({ 'iss.form': 0, 'iss.away': 0 });
      tl.to(1.0, { yaw: 0.3, pitch: 0.06, e: w.home - 0.15 });
      tl.caption(3.0, 'La Estación Espacial', 'A 400 km de altura, una vuelta cada hora y media: lo más lejos de la Tierra que vive gente hoy.');
      tl.to(3.0, { yaw: 0.9, pitch: 0.18, e: w.home + 0.05, 'iss.form': 1 });
      // It fades as the Moon's journey begins.
      tl.with(1.2, { 'iss.away': 1 });
    },
  };
}

