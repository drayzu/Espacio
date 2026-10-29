import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { lineSet, linesFromData, type LinesData } from './lineas';
import { PAISAJE } from './paisaje';

/**
 * The hypothetical end of the journey, drawn in the plate's language.
 *
 * Beyond the horizon (Tegmark's level I): if space goes on without end, it is tiled by regions
 * like our observable universe; far enough away, one of them holds an exact copy of you. Its
 * distance, about 10^(10^29) m, no longer fits a power of ten: the readout breaks.
 *
 * The inflationary multiverse (level II): our universe as one bubble among countless others,
 * each with its own laws.
 *
 * Their scale exponents here are symbolic: the camera keeps zooming, the readout tells the truth.
 */

const INK = 0xece7db;
const ACCENT = 0xff5b2e;

export function masAlla(): WorldModule {
  return {
    spec: {
      id: 'masAlla',
      territory: 'hipotético',
      name: 'Más allá del horizonte',
      fact: 'Si el espacio no se acaba, muy lejos de aquí habría una copia exacta de ti.',
      ficha: ['Tegmark (2003): la copia más cercana, a unos 10^(10^29) m'],
      label: 'más allá',
      unitExp: 27,
      frame: 14,
      frameCenter: new THREE.Vector3(),
      view: [0.35, 0.25, 0],
      fade: [-1.6, -1.1, 0.9, 1.4],
      tint: INK,
      notes: [
        { at: [0, 0.44, 0], text: 'nuestro universo observable' },
        { at: [7 * 1.25, 0.44, -4 * 1.25], text: 'una copia exacta' },
      ],
      nameSpan: 0.55,
      scaleLabel: { exp: '10<sup>10<sup>29</sup></sup><span class="m"> m</span>', unit: 'hipótesis · la distancia a otra copia exacta de ti' },
      generate() {
        const r = rng(231);
        const ink = lineSet();
        const accent = lineSet();
        const R = 0.44;
        const SPACING = 1.25;
        const copy = new THREE.Vector3(7 * SPACING, 0, -4 * SPACING);
        // Regions like ours, tiling space without end (here, a slab of them fading into the distance).
        for (let i = -8; i <= 8; i++) {
          for (let j = -1; j <= 1; j++) {
            for (let k = -8; k <= 8; k++) {
              if (i === 0 && j === 0 && k === 0) continue;
              const c = new THREE.Vector3(i * SPACING + gauss(r) * 0.08, j * SPACING + gauss(r) * 0.08, k * SPACING + gauss(r) * 0.08);
              const d = c.length();
              if (d > 11.5) continue;
              const isCopy = i === 7 && j === 0 && k === -4;
              (isCopy ? accent : ink).sphere(isCopy ? copy : c, R, 40, isCopy ? 0.9 : 0.16 * Math.pow(1 - d / 12, 1.5), r() * 0.5);
            }
          }
        }
        // Ours, in accent.
        accent.sphere(new THREE.Vector3(), R, 64, 1);

        // Our universe's edge and its centre: the stand-in for everything before.
        const pts = cloudBuilder(232);
        for (let k = 0; k < 3000; k++) {
          const [x, y, z] = pts.onSphere();
          pts.push(x * R, y * R, z * R, k % 2 ? 0xff8a3f : 0x3f7fff, 0.01, 0, 0.18, { flag: true });
        }
        for (let k = 0; k < 30; k++) pts.push(gauss(r) * 0.003, gauss(r) * 0.003, gauss(r) * 0.003, 0xfff0e0, 0.005, 0, 0.8, { star: true });
        // The copy: the same edge of light, the same point at its centre.
        for (let k = 0; k < 3000; k++) {
          const [x, y, z] = pts.onSphere();
          pts.push(copy.x + x * R, copy.y + y * R, copy.z + z * R, k % 2 ? 0xff8a3f : 0x3f7fff, 0.01, 0, 0.18);
        }
        for (let k = 0; k < 30; k++) pts.push(copy.x + gauss(r) * 0.003, copy.y + gauss(r) * 0.003, copy.z + gauss(r) * 0.003, 0xfff0e0, 0.005, 0, 0.8, { star: true });
        return { ink: ink.data(), accent: accent.data(), pts: pts.data() };
      },
      assemble(data) {
        const a = linesFromData(data.ink as LinesData, INK);
        const b2 = linesFromData(data.accent as LinesData, ACCENT);
        const cloud = cloudFromData(data.pts as PointsData, 1, 1);

        const object = new THREE.Group();
        object.add(a.mesh, b2.mesh, cloud.points);
        return {
          object,
          clouds: [cloud],
          update(f) {
            const reveal = f.tl.get('mas.form', f.p);
            a.uniforms.uAlpha.value = f.alpha * reveal;
            b2.uniforms.uAlpha.value = f.alpha * Math.min(1, reveal * 2);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('universo'), f.e, f.home);
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'mas.form': 0 });
      tl.to(4.6, { e: w.home - 0.1, 'mas.form': 1, yaw: 0, pitch: 0.1, roll: 0, fov: 44 });
      tl.label('masAlla');
      // Across to the copy: a region like ours, edge for edge. Below this world's home the
      // universe still frames the view, so it travels too (in its own units).
      const COPY = new THREE.Vector3(7 * 1.25, 0, -4 * 1.25);
      const at = (k: number) => ({
        'masAlla.tx': COPY.x * k,
        'masAlla.ty': COPY.y * k,
        'masAlla.tz': COPY.z * k,
        'universo.tx': COPY.x * 100 * k,
        'universo.ty': COPY.y * 100 * k,
        'universo.tz': COPY.z * 100 * k,
      });
      tl.to(3.0, { ...at(1), e: w.home - 0.45, yaw: 0.5, pitch: 0.24, fov: 46 });
      tl.to(2.0, { e: w.home - 0.4, yaw: 0.62 });
      // And back out over the tiling of regions, towards the multiverse.
      tl.to(2.8, { ...at(0), yaw: 0.7, pitch: 0.28, e: w.home + 0.1, fov: 50 });
    },
  };
}

export function multiverso(): WorldModule {
  return {
    spec: {
      id: 'multiverso',
      territory: 'hipotético',
      name: 'El multiverso',
      fact: 'Y nuestro universo sería una burbuja entre infinitas, cada una con sus propias leyes.',
      label: 'multiverso',
      unitExp: 29,
      frame: 30,
      // At the bottom of a valley of the string landscape.
      anchor: PAISAJE.valley,
      frameCenter: new THREE.Vector3(),
      view: [0.3, 0.2, 0],
      fade: [-1.6, -1.1, 1.8, 2.6],
      tint: ACCENT,
      notes: [{ at: [0, 0.12, 0], text: 'nuestro universo' }],
      nameSpan: 1.6,
      scaleLabel: { exp: '∞<span class="m"> ?</span>', unit: 'hipótesis · multiverso inflacionario' },
      generate() {
        const r = rng(241);
        const ink = lineSet();
        const accent = lineSet();
        const blue = lineSet();
        const far = lineSet();
        const farBlue = lineSet();
        const pts = cloudBuilder(242);
        const bubbles: { c: THREE.Vector3; rad: number }[] = [];
        let guard = 0;
        while (bubbles.length < 150 && guard++ < 6000) {
          const [x, y, z] = pts.onSphere();
          const c = new THREE.Vector3(x, y * 0.6, z).multiplyScalar(2 + Math.cbrt(r()) * 13);
          const rad = 0.3 + Math.pow(r(), 2.2) * 3.6;
          if (c.length() < rad + 0.6) continue;
          if (bubbles.some((b) => b.c.distanceTo(c) < b.rad + rad + 0.15)) continue;
          bubbles.push({ c, rad });
        }
        for (const { c, rad } of bubbles) {
          const roll = r();
          const set = roll < 0.75 ? ink : roll < 0.9 ? blue : accent;
          const fade = 1 - c.length() / 17;
          set.sphere(c, rad, Math.round(24 + rad * 16), 0.35 * fade, r() * 1.5);
          // Each with its own physics: some full of structure, some nearly empty.
          const kind = r();
          const n = Math.round(Math.min(900, rad * rad * rad * 60) * (kind < 0.3 ? 0.1 : 1));
          for (let k = 0; k < n; k++) {
            const [x, y, z] = pts.onSphere();
            const rr = (kind < 0.6 ? Math.cbrt(r()) : 0.85 + r() * 0.12) * rad * 0.95;
            pts.push(c.x + x * rr, c.y + y * rr, c.z + z * rr, kind < 0.6 ? 0xd8d0c0 : 0x9fb8ff, 0.04 + rad * 0.01, 0, 0.12 * fade);
          }
        }
        // And the foam goes on: fainter bubbles far out, found only as the camera pulls back.
        const outer: { c: THREE.Vector3; rad: number }[] = [];
        guard = 0;
        while (outer.length < 320 && guard++ < 8000) {
          const [x, y, z] = pts.onSphere();
          const c = new THREE.Vector3(x, y * 0.7, z).multiplyScalar(17 + Math.pow(r(), 0.8) * 70);
          const rad = 0.6 + Math.pow(r(), 2) * 7;
          if ([...bubbles, ...outer].some((b) => b.c.distanceTo(c) < b.rad + rad + 0.3)) continue;
          outer.push({ c, rad });
          const roll = r();
          (roll < 0.85 ? far : roll < 0.95 ? farBlue : accent).sphere(c, rad, Math.round(24 + rad * 6), 0.22 * Math.pow(1 - c.length() / 95, 1.5), r() * 1.5);
        }
        // Ours: a tiny bubble at the origin (everything before fits inside it).
        accent.sphere(new THREE.Vector3(), 0.12, 48, 1);
        for (let k = 0; k < 30; k++) pts.push(gauss(r) * 0.004, gauss(r) * 0.004, gauss(r) * 0.004, 0xfff0e0, 0.01, 0, 0.8, { star: true, flag: true });
        return { ink: ink.data(), blue: blue.data(), accent: accent.data(), far: far.data(), farBlue: farBlue.data(), pts: pts.data() };
      },
      assemble(data) {
        const lines = [linesFromData(data.ink as LinesData, INK), linesFromData(data.blue as LinesData, 0x7fa8ff), linesFromData(data.accent as LinesData, ACCENT)];
        const farLines = [linesFromData(data.far as LinesData, INK), linesFromData(data.farBlue as LinesData, 0x7fa8ff)];
        const cloud = cloudFromData(data.pts as PointsData, 1, 1);
        const object = new THREE.Group();
        for (const l of [...lines, ...farLines]) object.add(l.mesh);
        object.add(cloud.points);
        return {
          object,
          clouds: [cloud],
          update(f) {
            const reveal = f.tl.get('multi.form', f.p);
            // Pulling back, the near foam crowds into fewer pixels: thin it so it never burns white,
            // while the far foam comes in.
            const back = smoothstep(f.home + 0.1, f.home + 0.75, f.e);
            for (const l of lines) l.uniforms.uAlpha.value = f.alpha * reveal * (1 - 0.55 * back);
            for (const l of farLines) l.uniforms.uAlpha.value = f.alpha * reveal * smoothstep(f.home - 0.1, f.home + 0.5, f.e);
            cloud.u.uGain.value = 1 - 0.5 * back;
            cloud.u.uReveal.value = reveal;
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('masAlla'), f.e, f.home);
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'multi.form': 0 });
      tl.to(5.0, { e: w.home - 0.1, 'multi.form': 1, yaw: 0, pitch: 0.1, roll: 0, fov: 46 });
      tl.label('multiverso');
      tl.to(4.0, { yaw: 1.2, pitch: 0.3, e: w.home + 0.15, fov: 52 });
      // Pull back: the foam goes on.
      tl.to(2.6, { yaw: 1.6, pitch: 0.2, e: w.home + 0.75, fov: 48 });
    },
  };
}
