import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { membraneR, STRETCH_X } from '../lib/cell';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { HOJA } from './hoja';

/**
 * Leaf epidermis: cells like ours packed edge to edge, with green chloroplasts, and here and there
 * a stoma (two guard cells around a pore, where the leaf breathes). 1 unit = 10 µm, the cell's own
 * unit, in the leaf's plane (x, y), facing +z.
 * Arrival: the tissue crystallises outward from our cell. Moment: the camera tilts to show the sheet,
 * and the leaf breathing: from every stoma water vapour rises in a soft plume while carbon dioxide
 * drifts down into the pore.
 */

/**
 * The breath of the stomata: screen-sized points that loop for ever (a physical motion, not a
 * flicker), each from its pore (`position`) along its own direction (`aDir`: lateral xy, speed z),
 * on the side the camera tilts away from, so it reads as rising (the underside, where most stomata are).
 * Outgoing water vapour (`aKind` 0) rises and spreads; incoming carbon dioxide (1) converges on the
 * pore from above.
 */
const BREATH_VERT = /* glsl */ `
  attribute vec3 aDir;
  attribute float aPhase, aKind;
  uniform float uTime, uAlpha;
  varying vec3 vC;
  void main() {
    float t = fract(aPhase + uTime * 0.07 * (0.7 + 0.6 * aDir.z));
    vec3 p = position;
    float a;
    if (aKind < 0.5) {
      float h = t * 2.2;
      p += vec3(aDir.xy * (0.12 + h * 0.55), -h);
      a = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.45, 1.0, t));
      vC = vec3(0.72, 0.86, 1.0);
    } else {
      float u = 1.0 - t;
      p += vec3(aDir.xy * u * 1.3, -u * 1.9);
      a = smoothstep(0.0, 0.5, t) * (1.0 - smoothstep(0.9, 1.0, t)) * 0.7;
      vC = vec3(1.0, 0.78, 0.55);
    }
    vC *= a * uAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = 2.2;
    if (vC.r + vC.g + vC.b < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;
const BREATH_FRAG = /* glsl */ `
  varying vec3 vC;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    gl_FragColor = vec4(vC * exp(-dot(c, c) * 12.0), 1.0);
  }
`;

const SPACING = 2.25;
const RADIUS = 9.5;

export const TEJIDO = (() => {
  const r = rng(101);
  const cells: { c: THREE.Vector3; rot: number; ph: number; stoma: boolean }[] = [];
  const rows = Math.ceil(RADIUS / (SPACING * 0.866)) + 1;
  for (let j = -rows; j <= rows; j++) {
    for (let i = -rows; i <= rows; i++) {
      const x = (i + (j % 2 ? 0.5 : 0)) * SPACING;
      const y = j * SPACING * 0.866;
      if (Math.hypot(x, y) > RADIUS) continue;
      // Ours sits at the origin and is drawn by the cell world itself.
      if (i === 0 && j === 0) continue;
      const jx = (r() - 0.5) * 0.25;
      const jy = (r() - 0.5) * 0.25;
      cells.push({ c: new THREE.Vector3(x + jx, y + jy, (r() - 0.5) * 0.2), rot: r() * Math.PI, ph: r() * 6.28, stoma: r() < 0.09 });
    }
  }
  return { cells };
})();

export function tejido(): WorldModule {
  return {
    spec: {
      id: 'tejido',
      territory: 'vida',
      name: 'Una hoja respira',
      fact: 'Por estos poros respira la hoja. El carbono que seguías entró por aquí, en el aire. Quizá lo exhalaste tú.',
      label: 'tejido',
      unitExp: -5,
      frame: 14,
      anchor: HOJA.anchor,
      anchorRot: HOJA.anchorRot,
      frameCenter: new THREE.Vector3(),
      view: 'continue',
      fade: [-0.9, -0.45, 1.0, 1.5],
      tint: 0x9fe08a,
      notes: [
        { at: [0, 0, 0], text: 'nuestra célula' },
        { at: TEJIDO.cells.filter((c) => c.stoma).reduce((a, b) => (b.c.length() < a.c.length() ? b : a)).c.toArray(), text: 'estoma' },
        { at: TEJIDO.cells.reduce((a, b) => (Math.abs(b.c.length() - 2.2 * SPACING) < Math.abs(a.c.length() - 2.2 * SPACING) ? b : a)).c.toArray(), text: 'célula epidérmica' },
      ],
      generate() {
        const b = cloudBuilder(102);
        const { r } = b;
        const delayOf = (x: number, y: number) => Math.min(1, Math.hypot(x, y) / RADIUS) * 0.88 + r() * 0.06;

        // Our cell's outline: the stand-in once the cell world has gone.
        for (let k = 0; k < 2400; k++) {
          const th = r() * Math.PI * 2;
          const rad = membraneR(th) * (1 + gauss(r) * 0.01);
          b.push(Math.cos(th) * rad * STRETCH_X, Math.sin(th) * rad, gauss(r) * 0.08, 0xffa24a, 1, 0.002, 0.4, { flag: true });
        }
        for (let k = 0; k < 500; k++) {
          b.push(-0.16 + gauss(r) * 0.12, 0.06 + gauss(r) * 0.12, gauss(r) * 0.06, 0x47e6c8, 1, 0.002, 0.45, { flag: true });
        }

        for (const cell of TEJIDO.cells) {
          const { c, rot, ph } = cell;
          const d = delayOf(c.x, c.y);
          const cr = Math.cos(rot);
          const sr = Math.sin(rot);
          const at = (lx: number, ly: number, lz: number, hex: number, light: number, size = 1) =>
            b.push(c.x + lx * cr - ly * sr, c.y + lx * sr + ly * cr, c.z + lz, hex, size, 0.003, light, { delay: d });
          if (cell.stoma) {
            // Two kidney-shaped guard cells around a dark pore.
            for (const side of [-1, 1]) {
              for (let k = 0; k < 900; k++) {
                const th = r() * Math.PI * 2;
                const lx = Math.cos(th) * 0.95;
                const ly = side * (0.42 + Math.sin(th) * 0.32) - side * 0.12 * Math.cos(th) * Math.cos(th);
                at(lx + gauss(r) * 0.02, ly + gauss(r) * 0.02, gauss(r) * 0.06, 0x8fe07a, 0.38);
              }
              for (let k = 0; k < 220; k++) at(gauss(r) * 0.4, side * 0.42 + gauss(r) * 0.12, gauss(r) * 0.08, 0x5fd06a, 0.5);
            }
            continue;
          }
          // Cell wall and membrane: a rounded, slightly irregular hexagon.
          for (let k = 0; k < 1300; k++) {
            const th = r() * Math.PI * 2;
            const rad = 1.04 * (1 + 0.05 * Math.sin(6 * th + ph) + 0.035 * Math.sin(3 * th + ph * 2)) * (1 + gauss(r) * 0.012);
            at(Math.cos(th) * rad, Math.sin(th) * rad, gauss(r) * 0.08, 0xffa24a, 0.32);
          }
          for (let k = 0; k < 300; k++) {
            const th = r() * Math.PI * 2;
            at(Math.cos(th) * 1.1, Math.sin(th) * 1.1, gauss(r) * 0.1, 0xffc78a, 0.12);
          }
          // Nucleus, off centre.
          const nx = (r() - 0.5) * 0.6;
          const ny = (r() - 0.5) * 0.6;
          for (let k = 0; k < 260; k++) at(nx + gauss(r) * 0.13, ny + gauss(r) * 0.13, gauss(r) * 0.07, 0x47e6c8, 0.42);
          // Chloroplasts along the edge.
          const n = 4 + Math.floor(r() * 4);
          for (let q = 0; q < n; q++) {
            const th = r() * Math.PI * 2;
            const px = Math.cos(th) * 0.72;
            const py = Math.sin(th) * 0.72;
            for (let k = 0; k < 60; k++) at(px + gauss(r) * 0.07, py + gauss(r) * 0.045, gauss(r) * 0.05, 0x7cf08a, 0.5);
          }
        }
        // The breath: from each pore, vapour out and carbon dioxide in.
        const bpos: number[] = [];
        const bdir: number[] = [];
        const bphase: number[] = [];
        const bkind: number[] = [];
        for (const cell of TEJIDO.cells) {
          if (!cell.stoma) continue;
          for (let k = 0; k < 520; k++) {
            const kind = k % 3 === 2 ? 1 : 0;
            const th = r() * Math.PI * 2;
            const spread = kind ? 0.3 + r() * 0.7 : Math.abs(gauss(r)) * 0.6;
            bpos.push(cell.c.x + gauss(r) * 0.12, cell.c.y + gauss(r) * 0.12, cell.c.z);
            bdir.push(Math.cos(th) * spread, Math.sin(th) * spread, r());
            bphase.push(r());
            bkind.push(kind);
          }
        }
        return { main: b.data(), breath: { position: new Float32Array(bpos), aDir: new Float32Array(bdir), aPhase: new Float32Array(bphase), aKind: new Float32Array(bkind) } };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 0.035, 0.9);
        cloud.u.uSurface.value.set(0, 0, 1, 0.85);
        const bd = data.breath as Record<'position' | 'aDir' | 'aPhase' | 'aKind', Float32Array>;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(bd.position, 3));
        geo.setAttribute('aDir', new THREE.BufferAttribute(bd.aDir, 3));
        geo.setAttribute('aPhase', new THREE.BufferAttribute(bd.aPhase, 1));
        geo.setAttribute('aKind', new THREE.BufferAttribute(bd.aKind, 1));
        const breathU = { uTime: { value: 0 }, uAlpha: { value: 0 } };
        const breath = new THREE.Points(
          geo,
          new THREE.ShaderMaterial({ vertexShader: BREATH_VERT, fragmentShader: BREATH_FRAG, uniforms: breathU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
        );
        breath.frustumCulled = false;
        const object = new THREE.Group();
        object.add(cloud.points, breath);
        return {
          object,
          clouds: [cloud],
          update(f) {
            cloud.u.uReveal.value = f.tl.get('tej.form', f.p);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('celula'), f.e, f.home);
            // Once the stomata are in place, and only at this scale.
            breathU.uTime.value = f.time;
            breathU.uAlpha.value = 0.5 * f.alpha * smoothstep(0.75, 1, f.tl.get('tej.form', f.p)) * (1 - smoothstep(f.home + 0.45, f.home + 0.8, f.e));
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'tej.form': 0 });
      // Zoom out as the neighbouring cells crystallise around ours.
      tl.to(3.2, { e: w.home - 0.1, 'tej.form': 1, yaw: 0, pitch: 0.1, fov: 38 });
      tl.label('tejido');
      // Tilt: the tissue is a living sheet.
      tl.to(2.4, { pitch: 0.75, yaw: 0.35, fov: 50, e: w.home + 0.05 });
      // GUION.md 20 · Halfway: between the foam (10⁻³⁵ m) and the edge of what we see (10²⁷ m), the
      // middle is here, about a tenth of a millimetre. The camera all but stops, and you are back:
      // that is the size you were as a single cell.
      tl.caption(
        5.4,
        'A mitad de camino',
        'Entre lo más pequeño y el borde de lo que vemos, la mitad del camino cae aquí: un décimo de milímetro. Ese tamaño tenías cuando eras una sola célula.',
        'la mitad',
        ['entre la longitud de Planck (1,6 × 10⁻³⁵ m) y el universo observable (8,8 × 10²⁶ m), la media geométrica es 1,2 × 10⁻⁴ m', 'un óvulo humano mide unos 0,1 mm'],
      );
      tl.with(1.2, { tu: 1 });
      tl.to(4.2, { e: w.home + 0.09, yaw: 0.42 });
      tl.to(1.2, { tu: 0, e: w.home + 0.1, yaw: 0.45 });
    },
  };
}
