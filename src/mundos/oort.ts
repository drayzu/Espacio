import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { lineSet, linesFromData, type LinesData } from './lineas';

/**
 * The heliosphere and the Oort cloud. 1 unit = 10¹⁴ m (about 670 AU; 1 light-year ≈ 94.6), the
 * ecliptic in (x, z). The Sun's wind blows a bubble about 120 AU across, swept back into a tail by
 * the interstellar wind; far beyond, a flattened inner cloud and a spherical shell of perhaps a
 * trillion icy bodies reaching to about 1.5 light-years.
 * Arrival: the bubble, then the cloud, from the inside out. Moment: a slow turn, while a front of
 * the Sun's light, plate style, spreads out through the cloud: it takes a year and a half to
 * cross it.
 */

const AU = 1.496e11 / 1e14;

export function oort(): WorldModule {
  return {
    spec: {
      id: 'oort',
      territory: 'Sistema Solar',
      name: 'La nube de Oort',
      fact: 'Un billón de cometas helados. Hasta aquí llega el Sol.',
      ficha: ['la luz del Sol tarda un año y medio en atravesarla'],
      label: 'Oort',
      unitExp: 14,
      frame: 420,
      frameCenter: new THREE.Vector3(),
      view: [0.45, 0, 0],
      fade: [-2.0, -1.3, 1.2, 1.7],
      tint: 0x9fc4ff,
      notes: [
        { at: [0, 120 * AU, 0], text: 'heliosfera' },
        { at: [9000 * AU, 0, 0], text: 'nube de Oort interior' },
        { at: [0, 60000 * AU, 0], text: 'nube de Oort exterior' },
      ],
      generate() {
        const r = rng(171);
        const b = cloudBuilder(172);

        // The Sun, a single light at the centre (the stand-in for the whole Solar System).
        for (let k = 0; k < 60; k++) b.push(gauss(r) * 0.002, gauss(r) * 0.002, gauss(r) * 0.002, 0xfff0c0, 0.5, 0, 1.2, { star: true, flag: true });

        // The heliosphere: a bubble about 120 AU across, its tail swept back by the interstellar wind.
        const wind = new THREE.Vector3(-1, -0.15, 0.3).normalize();
        for (let k = 0; k < 14000; k++) {
          const [x, y, z] = b.onSphere();
          const d = new THREE.Vector3(x, y, z);
          const back = Math.max(0, d.dot(wind));
          const rad = 120 * AU * (1 + back * back * 1.8) * (1 + gauss(r) * 0.02);
          b.push(x * rad, y * rad, z * rad, 0x8fb8ff, 0.012, 0, 0.1 * (1 - back * 0.6), { delay: 0.1 + r() * 0.1 });
        }
        // Inner (Hills) cloud: a thick disc, 2 000 to 20 000 AU.
        for (let k = 0; k < 30000; k++) {
          const a = (2000 + Math.pow(r(), 0.7) * 18000) * AU;
          const ang = r() * Math.PI * 2;
          b.push(Math.cos(ang) * a, gauss(r) * a * 0.18, Math.sin(ang) * a, 0xc8d8ff, 0.5, 0, 0.12, { delay: 0.3 + (a / (100000 * AU)) * 0.5 });
        }
        // Outer cloud: a spherical shell out to 100 000 AU.
        for (let k = 0; k < 60000; k++) {
          const [x, y, z] = b.onSphere();
          const a = (20000 + Math.pow(r(), 0.8) * 80000) * AU;
          b.push(x * a, y * a, z * a, 0xb8ccf0, 1.2, 0, 0.09, { delay: 0.35 + (a / (100000 * AU)) * 0.55 });
        }
        // The light front: a unit sphere as three great circles (the ecliptic one brighter),
        // scaled out as the moment goes.
        const front = lineSet();
        const X = new THREE.Vector3(1, 0, 0);
        const Y = new THREE.Vector3(0, 1, 0);
        const Z = new THREE.Vector3(0, 0, 1);
        front.circle(new THREE.Vector3(), X, Z, 1, 160, 0.7);
        front.circle(new THREE.Vector3(), X, Y, 1, 160, 0.3);
        front.circle(new THREE.Vector3(), Y, Z, 1, 160, 0.3);
        return { main: b.data(), front: front.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 1, 1);
        const front = linesFromData(data.front as LinesData, 0xffe2b0);
        // A volume the camera flies through: comets passing close fade instead of blurring.
        cloud.u.uNear.value = 1;
        const object = new THREE.Group();
        object.add(cloud.points, front.mesh);
        return {
          object,
          clouds: [cloud],
          update(f) {
            cloud.u.uReveal.value = f.tl.get('oort.form', f.p);
            // While the camera is still inside the cloud, thousands of comets overlap into a white
            // fog: dim it there, and let it come up to full as the cloud is seen from outside.
            cloud.u.uGain.value = 0.25 + 0.75 * smoothstep(f.home - 1.4, f.home - 0.3, f.e);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('solar'), f.e, f.home);
            // The light front, from the heliosphere out to the cloud's edge (about 1.6 light-years).
            const light = f.tl.get('oort.light', f.p);
            front.mesh.scale.setScalar((120 + light * 100000) * AU);
            front.uniforms.uAlpha.value = f.alpha * smoothstep(0, 0.04, light) * (1 - smoothstep(0.65, 1, light));
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'oort.form': 0 });
      // Out through the bubble of the solar wind, into the cloud of comets.
      tl.to(5.0, { e: w.home - 0.15, 'oort.form': 1, yaw: 0.2, pitch: 0.15, roll: 0, fov: 42 });
      tl.label('oort');
      // Light travels at its own steady pace, whatever the camera does.
      tl.set({ 'oort.light': 0 });
      tl.with(3.6, { 'oort.light': 1 }, (t) => t);
      tl.to(3.6, { yaw: -0.5, pitch: 0.4, e: w.home + 0.1, fov: 46 });
    },
  };
}
