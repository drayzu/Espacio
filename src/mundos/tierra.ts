import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import type { WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { lineSet, linesFromData, type LinesData } from './lineas';
import { TEXTURAS, mover, puntos, unaVez } from '../engine/cuerpos';
import { tierra as tierraH, type Planeta } from '../horizontes';

/**
 * The Earth. 1 unit = 1 Mm (1000 km), y towards the north pole. Our valley lies in southern
 * Chile (40° S, 72° W), between the Pacific and the Andes.
 * The planet is the Horizontes Earth (src/horizontes): points coloured from the real map, its
 * clouds from the real cloud map (cleared over our valley), the dimmed photograph underneath (it
 * hides the far side), ever finer points under the camera, the haze beyond the limb. On top, this
 * piece's own: city lights on the night side, and the arrival, the planet assembling outward
 * from our valley, which keeps its patch of ground (6 to 12 km out, where the valley fades into
 * its haze, the Earth takes over).
 * This chain's frame has east towards +z, a mirror of the real one: `realAt` is where a real place
 * falls in it (the real map turned about the axis so that Chile lies under our valley).
 * Moment: a slow orbit, while the orbit of the International Space Station draws itself round the
 * globe (400 km up, inclined 51.6°): the farthest place where people live today.
 */

export const R_EARTH = 6.371;
const LAT0 = (-40 * Math.PI) / 180;
const LON0 = (-72 * Math.PI) / 180;
const normalAt = (lat: number, lon: number) => new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
/** Where a real place (latitude, longitude east) lies on this Earth: the real map, turned. */
export const realAt = (lat: number, lon: number) => normalAt(lat, 2 * LON0 - lon);
/** The turn that lays the real map (Horizontes: east towards −z) with Chile under our valley. */
const GIRO = -2 * LON0;

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

// Morning over the valley: the sun is 40° to its north-east (east is −z on the real map).
export const SUN_DIR = normalAt(LAT0 + 0.35, LON0 - 0.55).normalize();

/**
 * The real cloud map with the sky over our valley cleared (soft, about 500 km across), so the
 * valley is seen from above and the Earth assembles round it in the clear.
 */
async function nubesSinValle() {
  const img = await createImageBitmap(await (await fetch(`${TEXTURAS}4k_earth_clouds.jpg`)).blob());
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0);
  const x = (LON0 / (Math.PI * 2) + 0.5) * c.width;
  const y = (0.5 - LAT0 / Math.PI) * c.height;
  const px = c.height / 180;
  g.save();
  g.translate(x, y);
  // Equirectangular: a degree of longitude is shorter by cos(latitude).
  g.scale(1 / Math.cos(LAT0), 1);
  const grad = g.createRadialGradient(0, 0, 3 * px, 0, 0, 8 * px);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(-8 * px, -8 * px, 16 * px, 16 * px);
  g.restore();
  const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.92));
  return URL.createObjectURL(blob);
}

/** Its own GLSL, run on every point and on every pixel of the photograph (see src/horizontes/planeta.ts). */
const SUPERFICIE = /* glsl */ `
  // Our valley, and how far the planet has assembled outward from it; its patch of ground stays the
  // valley's while the valley shows (uHueco).
  float angV = acos(clamp(dot(n, uValle), -1.0, 1.0));
  float dV = angV / 3.14159265 * 0.92;
  // (Not in the photograph, hp = 0.5: it lies 19 km down and would show the hole off to one side.)
  float hueco = abs(hp - 0.5) < 1e-6 ? 0.0 : uHueco;
  float on = smoothstep(dV, dV + 0.06, uForm) * mix(1.0, smoothstep(6.0, 12.0, angV * 6371.0), hueco);
  // City lights on the night side: clustered, on land only (not on the sea, the ice or the clouds).
  float lumA = dot(alb, vec3(0.2126, 0.7152, 0.0722));
  float firme = (1.0 - esMar(alb)) * (1.0 - smoothstep(0.3, 0.45, lumA)) * step(abs(n.y), 0.88);
  float noche = smoothstep(0.08, -0.2, dot(n, uSun));
  float luces = smoothstep(0.6, 0.72, fbm(n * 90.0)) * firme * noche;
  extra += vec3(1.0, 0.6, 0.28) * luces * 0.3;
  alb *= on;
  sombra *= on;
  extra *= on;`;

/**
 * The Earth as Horizontes draws it, made once: the body arrives when its cloud map is ready. Its
 * uniforms (where our valley is in the real map's frame, how far it has assembled) are shared by
 * every layer.
 */
const tierraReal = unaVez(() => {
  const u = {
    // Chile in the real map's own frame (Horizontes: east towards −z).
    uValle: { value: new THREE.Vector3(Math.cos(LAT0) * Math.cos(LON0), Math.sin(LAT0), -Math.cos(LAT0) * Math.sin(LON0)) },
    uForm: { value: 0 },
    uHueco: { value: 1 },
  };
  const t = { u, body: null as Planeta | null, nubes: null as THREE.ShaderMaterial | null };
  nubesSinValle().then((url) => {
    const b = tierraH(TEXTURAS, {
      // The 8K maps reduced to 4K (about 5 km a pixel): the ground stays sharp down to the valley.
      mapa: `${TEXTURAS}4k_earth_daymap.jpg`,
      puntos: puntos(520000),
      nubes: url,
      superficie: { pre: 'uniform vec3 uValle; uniform float uForm, uHueco;', glsl: SUPERFICIE, uniforms: u },
    });
    b.group.rotation.y = GIRO;
    b.group.scale.setScalar(R_EARTH);
    b.listo.then(() => {
      // The cloud shell: the points lifted to 1.01.
      b.cuerpo.traverse((o) => {
        const m = (o as THREE.Points).material as THREE.ShaderMaterial | undefined;
        if (m?.vertexShader?.includes('p *= 1.01')) t.nubes = m;
      });
    });
    t.body = b;
  });
  return t;
});

/**
 * The chain's view, carried up from our valley, sees the Earth with its south up (north is about
 * 172° from the top of the screen through the whole moment, measured in the page). Pulling back
 * from the valley, the picture turns about the line of sight by this much: the Earth north up.
 * It turns back on the way to the Earthrise (luna.ts), whose shot is solved without it.
 */
export const GIRO_TIERRA = -3.0;

export function tierra(): WorldModule {
  return {
    spec: {
      id: 'tierra',
      territory: 'Tierra',
      name: 'La Tierra',
      fact: 'Todos los que has conocido están aquí. Y todos los que no.',
      ficha: ['unos 8 200 millones de personas', 'la Estación Espacial: a 400 km, una vuelta cada hora y media'],
      label: 'Tierra',
      unitExp: 6,
      frame: 20,
      frameCenter: new THREE.Vector3(),
      view: 'continue',
      fade: [-3.5, -2.7, 1.4, 2.0],
      tint: 0x7fb4ff,
      notes: [
        { at: TIERRA.anchor.toArray(), text: 'nuestro valle' },
        { at: realAt((-28 * Math.PI) / 180, (-69.5 * Math.PI) / 180).multiplyScalar(R_EARTH).toArray(), text: 'los Andes' },
        { at: realAt((-35 * Math.PI) / 180, (-95 * Math.PI) / 180).multiplyScalar(R_EARTH).toArray(), text: 'océano Pacífico' },
        { at: issAt(0).toArray(), text: 'Estación Espacial', e: [7.0, 7.45] },
      ],
      generate() {
        const r = rng(141);
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
        return { iss: iss.data(), station: station.data() };
      },
      assemble(data) {
        // The station's orbit and the station hide behind the planet (its photograph writes depth).
        const iss = linesFromData(data.iss as LinesData, 0xff5b2e);
        (iss.mesh.material as THREE.ShaderMaterial).depthTest = true;
        const station = cloudFromData(data.station as PointsData, 1, 1);
        (station.points.material as THREE.ShaderMaterial).depthTest = true;
        const object = new THREE.Group();
        object.add(iss.mesh, station.points);
        const earth = tierraReal();
        return {
          object,
          clouds: [station],
          update(f) {
            const form = f.tl.get('tierra.form', f.p);
            const b = earth.body;
            if (b) {
              if (b.group.parent !== object) object.add(b.group);
              earth.u.uForm.value = form;
              earth.u.uHueco.value = f.alphaOf('valle');
              b.brilloHalo = smoothstep(0.5, 1, form);
              mover(b, f, SUN_DIR, f.alpha);
              // The clouds have no hook of their own: they come in with the last of the planet.
              if (earth.nubes) earth.nubes.uniforms.uGain.value *= smoothstep(0.55, 0.95, form);
            }
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
      tl.set({ 'tierra.tx': A.x, 'tierra.ty': A.y, 'tierra.tz': A.z, giro: 0 });
      // The ground curves away beneath us and becomes a planet, assembled outward from our valley,
      // turning as it does until its north is up.
      tl.with(5.0, { e: w.home - 0.2, 'tierra.form': 1, yaw: 0, pitch: 0, roll: 0, fov: 40, giro: GIRO_TIERRA });
      tl.wait(2.6);
      tl.to(2.4, { 'tierra.tx': 0, 'tierra.ty': 0, 'tierra.tz': 0 });
      tl.label('tierra');
      // A slow orbit; the Space Station's orbit draws itself round the globe.
      tl.set({ 'iss.form': 0, 'iss.away': 0 });
      tl.to(1.0, { yaw: 0.3, pitch: 0.06, e: w.home - 0.15 });
      tl.caption(3.0, 'La Estación Espacial', 'Lo más lejos de la Tierra que vive alguien hoy: a cuatrocientos kilómetros.');
      tl.to(3.0, { yaw: 0.9, pitch: 0.18, e: w.home + 0.05, 'iss.form': 1 });
      // It fades as the Moon's journey begins.
      tl.with(1.2, { 'iss.away': 1 });
    },
  };
}

