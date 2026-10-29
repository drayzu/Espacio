import * as THREE from 'three';
import { gauss, smoothstep } from '../lib/math';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { lineSet, linesFromData, type LinesData } from './lineas';
import { ADN } from './adn';

/**
 * A carbon atom. 1 unit = 10⁻¹⁰ m. A 1s core and four sp³ lobes on a tetrahedron, sampled from
 * their probability densities (sharpened so the lobes stay legible).
 * Arrival (out of the void): the electron cloud condenses around the nucleus, which keeps glowing
 * at the centre. Moment: the camera swings around it while its sentence draws itself, plate style:
 * the four bonds leave along the lobes to where each neighbour would sit (1.54 Å, a carbon-carbon
 * bond), and the angle between two of them, 109.5°: the tetrahedron behind the chemistry
 * of life.
 */

/** A carbon-carbon bond, in this world's units (Å). */
const BOND = 1.54;

const LOBES: [[number, number, number], number][] = [
  [[1, 1, 1], 0xff4fb0],
  [[1, -1, -1], 0x4f8cff],
  [[-1, 1, -1], 0x33e6d9],
  [[-1, -1, 1], 0xad6bff],
];

export function atomo(): WorldModule {
  return {
    spec: {
      id: 'atomo',
      territory: 'atómico',
      name: 'Un átomo de carbono',
      fact: 'Sigue a este. Con sus cuatro brazos se agarra a otros átomos, y así se arma todo lo vivo.',
      label: 'átomo',
      unitExp: -10,
      frame: 3.4,
      anchor: ADN.anchor,
      frameCenter: new THREE.Vector3(),
      view: 'continue',
      fade: [-2.0, -1.2, 0.55, 0.85],
      tint: 0xb27cff,
      notes: [
        { at: [0, 0, 0], text: 'núcleo' },
        { at: [0.45, 0.45, 0.45], text: 'orbital sp³' },
        { at: [-0.45, -0.45, 0.45], text: 'nube de electrones' },
        { at: new THREE.Vector3(1, 0, 0).multiplyScalar(0.62).toArray(), text: '109,5°' },
        { at: new THREE.Vector3(-1, 1, -1).normalize().multiplyScalar(BOND).toArray(), text: 'un vecino: 1,54 Å' },
      ],
      generate() {
        const b = cloudBuilder(3);
        const { r } = b;
        const S = 0.13;
        const gamma = (k: number) => {
          let s = 0;
          for (let i = 0; i < k; i++) s -= Math.log(1 - r());
          return s;
        };
        const scattered = (): [number, number, number] => {
          const [x, y, z] = b.onSphere();
          const k = 2.5 + r() * 4;
          return [x * k, y * k, z * k];
        };
        for (let i = 0; i < 4000; i++) {
          const [x, y, z] = b.onSphere();
          const rad = (gamma(3) / 2) * S;
          b.push(x * rad, y * rad, z * rad, 0xe9dcff, 1, 0.01, 0.5, { from: scattered(), delay: r() });
        }
        const k3 = Math.sqrt(3);
        for (const [[dx, dy, dz], color] of LOBES) {
          const n = Math.hypot(dx, dy, dz);
          for (let i = 0; i < 12000; i++) {
            let u: [number, number, number];
            let c = 0;
            do {
              u = b.onSphere();
              c = (u[0] * dx + u[1] * dy + u[2] * dz) / n;
            } while (r() > ((1 + k3 * c) / (1 + k3)) ** 6);
            const rad = (gamma(9) / 1.8) * S;
            const front = 1 + k3 * c > 0;
            b.push(u[0] * rad, u[1] * rad, u[2] * rad, front ? color : 0xffa060, 1, 0.012, front ? 0.7 : 0.5, { from: scattered(), delay: r() });
          }
        }
        // The nucleus: the stand-in for the world we came from.
        for (let i = 0; i < 40; i++) b.push(gauss(r) * 0.0006, gauss(r) * 0.0006, gauss(r) * 0.0006, 0xffe2c0, 1.5, 0, 1.2, { flag: true });

        // The bonds, plate style: dashed from the core along each lobe to a neighbour's place
        // (a small sphere), drawn outward; then the angle between the first two, in the accent.
        const ink = lineSet();
        const mark = lineSet();
        const dirs = LOBES.map(([d]) => new THREE.Vector3(...d).normalize());
        const a = new THREE.Vector3();
        const c = new THREE.Vector3();
        for (const d of dirs) {
          const DASHES = 9;
          for (let k = 0; k < DASHES; k++) {
            const r0 = 0.3 + ((BOND - 0.45) * k) / DASHES;
            const r1 = r0 + ((BOND - 0.45) / DASHES) * 0.55;
            ink.segment(a.copy(d).multiplyScalar(r0), c.copy(d).multiplyScalar(r1), 0.5, (r0 / BOND) * 0.6, (r1 / BOND) * 0.6);
          }
          const end = d.clone().multiplyScalar(BOND);
          const u = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0.3).normalize()).normalize();
          const v = new THREE.Vector3().crossVectors(d, u);
          // The neighbour's place: a small ring, drawn round once the bond reaches it.
          const ring: THREE.Vector3[] = [];
          for (let k = 0; k <= 32; k++) {
            const t = (k / 32) * Math.PI * 2;
            ring.push(end.clone().addScaledVector(u, Math.cos(t) * 0.15).addScaledVector(v, Math.sin(t) * 0.15));
          }
          ink.path(ring, 0.4, 0.6, 0.75);
        }
        const arc: THREE.Vector3[] = [];
        for (let k = 0; k <= 40; k++) arc.push(new THREE.Vector3().copy(dirs[0]).lerp(dirs[1], k / 40).normalize().multiplyScalar(0.55));
        mark.path(arc, 0.9, 0.75, 1);
        return { main: b.data(), ink: ink.data(), mark: mark.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 0.007, 0.6);
        cloud.u.uSpread.value = 1.2;
        // Scattered electrons glow faintly before they condense: the intro's starfield.
        cloud.u.uFlyFade.value = 0.7;
        const ink = linesFromData(data.ink as LinesData, 0xece7db);
        const mark = linesFromData(data.mark as LinesData, 0xff5b2e);
        const object = new THREE.Group();
        object.add(cloud.points, ink.mesh, mark.mesh);
        return {
          object,
          clouds: [cloud],
          update(f) {
            cloud.u.uAssemble.value = f.tl.get('atomo.assemble', f.p);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('nucleo'), f.e, f.home);
            // Drawn during the moment, gone before the molecule comes in.
            const bonds = f.tl.get('atomo.bonds', f.p);
            const alpha = f.alpha * smoothstep(0, 0.05, bonds) * (1 - smoothstep(f.home + 0.12, f.home + 0.35, f.e));
            for (const l of [ink, mark]) {
              l.uniforms.uReveal.value = bonds;
              l.uniforms.uAlpha.value = alpha;
            }
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'atomo.assemble': 0 });
      // Out of the void, the electron cloud condenses around the nucleus.
      tl.to(3.4, { 'atomo.assemble': 1, yaw: 0.1, pitch: 0.1, e: w.home - 0.02, fov: 36 });
      tl.label('atomo');
      // Swing around it: the tetrahedron opens up and its bonds draw themselves. (The next zoom
      // swings back.)
      tl.set({ 'atomo.bonds': 0 });
      tl.to(3.2, { yaw: 1.1, pitch: 0.35, e: w.home + 0.06, 'atomo.bonds': 1 });
    },
  };
}
