import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import type { WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { lineSet, linesFromData, type LinesData } from './lineas';
import { PROTON } from './proton';

/**
 * The limit of what has been seen. 1 unit = 10⁻²⁰ m. Smashing protons together, the LHC probes
 * distances down to about 10⁻¹⁹ m, and its event displays are how we see there. Drawn as one, in
 * the plate's language (a diagram, not a photograph: the real detector is metres across): tracks
 * curling out of the collision in the magnetic field, two jets back to back, two muons crossing
 * every layer, energy piling up in the calorimeter.
 * Arrival: the collision happens, tracks growing outward. Moment: the camera tilts to show they
 * are helices wound along the beam.
 */

const INK = 0xece7db;
const ACCENT = 0xff5b2e;
/** Radii of the detector's layers: tracker, calorimeter, muon chambers. */
const TRACKER = [0.35, 0.6, 0.85, 1.1, 1.4];
const CALO = [2.0, 2.75];
const MUON = [3.5, 4.3];
const HALF = 4.5;

export function colisionador(): WorldModule {
  return {
    spec: {
      id: 'colisionador',
      territory: 'subatómico',
      name: 'El límite de lo visto',
      fact: 'Aquí termina lo que hemos visto. Más abajo, todo es suposición; de aquí hacia arriba, todo es real.',
      ficha: ['el LHC distingue hasta unos 10⁻¹⁹ m'],
      label: 'LHC',
      unitExp: -20,
      frame: 9,
      anchor: PROTON.quarks[0].p,
      frameCenter: new THREE.Vector3(),
      view: [0, 0, 0],
      // Out late: the collision stays a point of light until the proton around it comes in.
      fade: [-1.6, -1.0, 1.5, 2.3],
      tint: 0xffb08a,
      notes: [
        { at: [0, 0, 0], text: 'choque' },
        { at: [0, TRACKER[3], 0], text: 'detector de trazas' },
        { at: [CALO[1] * 0.7071, -CALO[1] * 0.7071, 0], text: 'calorímetro' },
        { at: [-MUON[1], 0, 0], text: 'cámaras de muones' },
        { at: [0, 0, HALF * 1.6], text: 'haz de protones' },
      ],
      generate() {
        const r = rng(261);
        const ink = lineSet();
        const hot = lineSet();
        const Z = new THREE.Vector3(0, 0, 1);
        const X = new THREE.Vector3(1, 0, 0);
        const Y = new THREE.Vector3(0, 1, 0);

        // The detector: cylinders drawn as rings along the beam and a few lines along it.
        const cylinder = (rad: number, rings: number, staves: number, l: number) => {
          for (let k = 0; k < rings; k++) {
            const z = -HALF + (2 * HALF * k) / (rings - 1);
            ink.circle(new THREE.Vector3(0, 0, z), X, Y, rad, 96, l * (k === (rings - 1) / 2 ? 1.6 : 1));
          }
          for (let k = 0; k < staves; k++) {
            const a = (k / staves) * Math.PI * 2;
            const x = Math.cos(a) * rad;
            const y = Math.sin(a) * rad;
            ink.segment(new THREE.Vector3(x, y, -HALF), new THREE.Vector3(x, y, HALF), l * 0.6);
          }
        };
        for (const rad of TRACKER) cylinder(rad, 3, 0, 0.1);
        for (const rad of CALO) cylinder(rad, 5, 24, 0.12);
        for (const rad of MUON) cylinder(rad, 5, 12, 0.07);
        // The beam pipe and the beams coming in.
        ink.circle(new THREE.Vector3(), X, Y, 0.12, 48, 0.35);
        ink.segment(new THREE.Vector3(0, 0, -HALF * 2.5), new THREE.Vector3(0, 0, -0.05), 0.3);
        ink.segment(new THREE.Vector3(0, 0, 0.05), new THREE.Vector3(0, 0, HALF * 2.5), 0.3);

        // Tracks: circles through the collision point (radius ∝ momentum), wound along the beam.
        const jet = r() * Math.PI * 2;
        const exits: { phi: number; e: number }[] = [];
        const track = (phi: number, radius: number, charge: number, pitch: number, stop: number, set: ReturnType<typeof lineSet>, l: number, delay: number) => {
          const centre = new THREE.Vector3(-Math.sin(phi), Math.cos(phi), 0).multiplyScalar(radius * charge);
          const pts: THREE.Vector3[] = [];
          const ds = 0.025;
          let rad = radius;
          let turn = 0;
          for (let s = 0; s < 40; s += ds) {
            // Loopers lose energy and spiral in.
            if (2 * radius < stop) rad = radius * Math.exp(-turn * 0.05);
            const ang = (charge * s) / radius;
            turn = Math.abs(ang) / (Math.PI * 2);
            const v = new THREE.Vector3().subVectors(new THREE.Vector3(), centre).normalize().multiplyScalar(rad).applyAxisAngle(Z, ang);
            const p = centre.clone().add(v);
            p.z = pitch * s;
            if (Math.hypot(p.x, p.y) > stop || Math.abs(p.z) > HALF || turn > 1.25) break;
            pts.push(p);
          }
          if (pts.length < 2) return;
          // Drawn outward from the collision: each point's moment follows its distance. Dimmer
          // near the point itself, where every track meets, and dimmer for the curling loopers.
          const looper = 2 * radius < stop ? 0.55 : 1;
          for (let k = 0; k + 1 < pts.length; k++) {
            const ta = delay + Math.min(1, pts[k].length() / MUON[1]) * 0.75;
            const tb = delay + Math.min(1, pts[k + 1].length() / MUON[1]) * 0.75;
            const near = 0.3 + 0.7 * smoothstep(0.04, 0.45, Math.hypot(pts[k].x, pts[k].y));
            set.segment(pts[k], pts[k + 1], l * looper * near, ta, tb);
          }
          const end = pts[pts.length - 1];
          if (Math.hypot(end.x, end.y) > stop * 0.97) exits.push({ phi: Math.atan2(end.y, end.x), e: radius });
        };
        for (let k = 0; k < 54; k++) {
          const inJet = r() < 0.62;
          const phi = inJet ? jet + (r() < 0.5 ? 0 : Math.PI) + gauss(r) * 0.22 : r() * Math.PI * 2;
          const radius = (inJet ? 2.2 : 0.55) / Math.pow(r(), inJet ? 0.9 : 0.6);
          const charge = r() < 0.5 ? -1 : 1;
          const hard = radius > 9;
          track(phi, Math.min(radius, 80), charge, gauss(r) * 0.45, CALO[0], hard ? hot : ink, hard ? 0.85 : 0.5, r() * 0.06);
        }
        // Two muons: straight and hard, through every layer.
        for (const phi of [jet + 1.4 + gauss(r) * 0.2, jet + 1.4 + Math.PI + gauss(r) * 0.2]) {
          track(phi, 60, r() < 0.5 ? -1 : 1, gauss(r) * 0.2, MUON[1] + 0.25, hot, 1, 0);
        }
        // Energy in the calorimeter: towers where the tracks arrive, tallest in the jets.
        for (const { phi, e } of exits) {
          const h = Math.min(0.75, 0.12 + e * 0.03);
          const u = new THREE.Vector3(Math.cos(phi), Math.sin(phi), 0);
          const w = new THREE.Vector3(-u.y, u.x, 0);
          for (let j = -2; j <= 2; j++) {
            const a = u.clone().multiplyScalar(CALO[0]).addScaledVector(w, j * 0.025);
            const b = u.clone().multiplyScalar(CALO[0] + h).addScaledVector(w, j * 0.025);
            hot.segment(a, b, 0.5, 0.8, 0.8 + h * 0.2);
          }
        }

        // The collision itself: a point of light.
        const pts = cloudBuilder(262);
        for (let k = 0; k < 30; k++) pts.push(gauss(r) * 0.01, gauss(r) * 0.01, gauss(r) * 0.01, 0xfff0e0, 0.02, 0, 0.7, { star: true });
        return { ink: ink.data(), hot: hot.data(), pts: pts.data() };
      },
      assemble(data) {
        const ink = linesFromData(data.ink as LinesData, INK);
        const hot = linesFromData(data.hot as LinesData, ACCENT);
        const cloud = cloudFromData(data.pts as PointsData, 1, 1);
        const object = new THREE.Group();
        object.add(ink.mesh, hot.mesh, cloud.points);
        return {
          object,
          clouds: [cloud],
          update(f) {
            const form = f.tl.get('col.form', f.p);
            ink.uniforms.uAlpha.value = f.alpha;
            hot.uniforms.uAlpha.value = f.alpha;
            ink.uniforms.uReveal.value = form;
            hot.uniforms.uReveal.value = form;
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'col.form': 0 });
      // The collision: tracks burst out of the point as the detector comes into view.
      tl.to(2.8, { e: w.home - 0.1, 'col.form': 1, roll: 0, yaw: 0, pitch: 0, fov: 44 });
      tl.label('colisionador');
      // Tilt: they are helices, wound along the beam.
      tl.to(2.8, { pitch: 0.9, yaw: 0.55, e: w.home + 0.15, fov: 50 });
    },
  };
}
