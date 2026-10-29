import * as THREE from 'three';
import { rng, smoothstep } from '../lib/math';
import { type WorldModule } from '../engine/cadena';
import { lineSet, linesFromData, type LinesData } from './lineas';
import { height, PAISAJE_SIZE } from './paisaje';
import * as F from '../lib/figuras';

/**
 * The mathematical universe (hypothesis, Tegmark's level IV): every consistent mathematical
 * structure would exist as a universe; ours would be one among them. Drawn as what this page has
 * been all along, a plate: pulling back from the string landscape, it turns out to be one drawing
 * in one panel of an endless plate of panels, each holding another structure (a strange
 * attractor, the Mandelbrot set, a knot, a fractal, a four-dimensional cube...). The scale is
 * symbolic.
 */

const INK = 0xece7db;
const ACCENT = 0xff5b2e;
const BLUE = 0x7fa8ff;
/** One unit = one panel. */
const UNIT = 34.5;
/** The landscape's units in a panel (its 220 units fill about 0.7 of the panel). */
const FROM_LANDSCAPE = Math.pow(10, 32 - UNIT);
const REACH = 12.5;

type Fig = { name: string; segs: F.Segs; flat: boolean };

/**
 * The panels' lines, each figure turning slowly about its own upright axis (the 3D ones; the flat
 * ones lie still), so the plate at the end of the journey is alive. Like the plate's other lines:
 * additive, faded as a whole, drawn as `uReveal` passes each vertex's moment.
 */
const SPIN_VERT = /* glsl */ `
  attribute float aLight;
  attribute float aT;
  attribute vec4 aSpin;
  uniform float uReveal;
  uniform float uTime;
  varying float vLight;
  void main() {
    vLight = aLight * smoothstep(aT, aT + 0.02, uReveal * 1.02);
    float a = uTime * aSpin.w;
    vec3 d = position - aSpin.xyz;
    vec3 p = aSpin.xyz + vec3(d.x * cos(a) + d.z * sin(a), d.y, -d.x * sin(a) + d.z * cos(a));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const SPIN_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vLight;
  void main() {
    gl_FragColor = vec4(uColor * vLight * uAlpha, 1.0);
  }
`;

function spinSet() {
  const pos: number[] = [];
  const light: number[] = [];
  const when: number[] = [];
  const spin: number[] = [];
  return {
    segment(a: THREE.Vector3, b: THREE.Vector3, l: number, t: number, cx: number, cz: number, w: number) {
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      light.push(l, l);
      when.push(t, t + 0.002);
      spin.push(cx, 0, cz, w, cx, 0, cz, w);
    },
    data() {
      return { position: new Float32Array(pos), aLight: new Float32Array(light), aT: new Float32Array(when), aSpin: new Float32Array(spin) };
    },
  };
}

function spinLines(data: Record<string, Float32Array>, color: number) {
  const uniforms = { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 0 }, uReveal: { value: 1 }, uTime: { value: 0 } };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
  geo.setAttribute('aLight', new THREE.BufferAttribute(data.aLight, 1));
  geo.setAttribute('aT', new THREE.BufferAttribute(data.aT, 1));
  geo.setAttribute('aSpin', new THREE.BufferAttribute(data.aSpin, 4));
  const mesh = new THREE.LineSegments(
    geo,
    new THREE.ShaderMaterial({ vertexShader: SPIN_VERT, fragmentShader: SPIN_FRAG, uniforms, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

export function matematico(): WorldModule {
  return {
    spec: {
      id: 'matematico',
      territory: 'hipotético',
      name: 'El universo matemático',
      fact: 'Quizá todo lo que se puede describir existe. El nuestro sería un dibujo más en una lámina sin fin.',
      ficha: ['Tegmark, la hipótesis del universo matemático (2007)'],
      label: 'matemático',
      unitExp: UNIT,
      frame: 9,
      frameCenter: new THREE.Vector3(),
      // From above at a slant: a plate on a table.
      view: [1.05, 0, 0],
      fade: [-2.2, -1.5, 99, 100],
      tint: INK,
      nameSpan: 1.6,
      scaleLabel: { exp: '∞<sup>∞</sup>', unit: 'hipótesis · todas las estructuras matemáticas' },
      notes: [
        { at: [0, 0, -0.42], text: 'nuestro paisaje' },
        { at: [1, 0, -0.36], text: 'atractor de Lorenz' },
        { at: [-1, 0, -0.36], text: 'conjunto de Mandelbrot' },
        { at: [0, 0, -1.36], text: 'nudo de trébol' },
        { at: [0, 0, 0.64], text: 'triángulo de Sierpinski' },
        { at: [1, 0, -1.36], text: 'hipercubo' },
        { at: [-1, 0, 0.64], text: 'curva del dragón' },
      ],
      generate() {
        const r = rng(261);
        const figs: Fig[] = [
          { name: 'lorenz', segs: F.lorenz(), flat: false },
          { name: 'mandelbrot', segs: F.mandelbrot(), flat: true },
          { name: 'trefoil', segs: F.trefoil(), flat: false },
          { name: 'sierpinski', segs: F.sierpinski(), flat: true },
          { name: 'hypercube', segs: F.hypercube(), flat: false },
          { name: 'dragon', segs: F.dragon(), flat: true },
          { name: 'apollonius', segs: F.apollonius(), flat: true },
          { name: 'torus', segs: F.torus(), flat: false },
          { name: 'koch', segs: F.koch(), flat: true },
          { name: 'mobius', segs: F.mobius(), flat: false },
          { name: 'fibonacci', segs: F.fibonacci(), flat: true },
          { name: 'lissajous', segs: F.lissajous(), flat: false },
          { name: 'hexagons', segs: F.hexagons(), flat: true },
          { name: 'graph', segs: F.graph(r), flat: false },
          { name: 'icosphere', segs: F.icosphere(), flat: false },
          { name: 'hilbert', segs: F.hilbert(), flat: true },
          { name: 'rose', segs: F.rose(), flat: true },
          { name: 'rule30', segs: F.rule30(), flat: true },
        ];
        const byName = new Map(figs.map((f) => [f.name, f]));
        // The panels around ours, fixed (the plate names them); the rest by chance.
        const ring = new Map<string, string>([
          ['1,0', 'lorenz'],
          ['-1,0', 'mandelbrot'],
          ['0,-1', 'trefoil'],
          ['0,1', 'sierpinski'],
          ['1,-1', 'hypercube'],
          ['-1,1', 'dragon'],
          ['1,1', 'apollonius'],
          ['-1,-1', 'torus'],
        ]);

        const sets = { ink: spinSet(), blue: spinSet(), accent: spinSet(), frames: lineSet(), centre: lineSet(), ours: lineSet() };
        const a = new THREE.Vector3();
        const b = new THREE.Vector3();
        const q = new THREE.Quaternion();
        const e = new THREE.Euler();
        const S = 0.64;

        for (let i = -13; i <= 13; i++) {
          for (let j = -13; j <= 13; j++) {
            const d = Math.hypot(i, j);
            if (d > REACH) continue;
            const fade = Math.pow(1 - smoothstep(4, REACH, d), 1.4);
            const t0 = (d / REACH) * 0.82;
            const cx = i + (r() - 0.5) * 0.05;
            const cz = j + (r() - 0.5) * 0.05;
            // The panel's frame: a thin rectangle, as on a specimen plate.
            const w = 0.46;
            const corners = [
              [i - w, j - w],
              [i + w, j - w],
              [i + w, j + w],
              [i - w, j + w],
            ];
            for (let k = 0; k < 4; k++) {
              const [x0, z0] = corners[k];
              const [x1, z1] = corners[(k + 1) % 4];
              (d === 0 ? sets.centre : sets.frames).segment(a.set(x0, 0, z0), b.set(x1, 0, z1), (d === 0 ? 0.5 : 0.06) * fade, t0, t0 + 0.04);
            }
            if (d === 0) continue;

            const fig = byName.get(ring.get(`${i},${j}`) ?? '') ?? figs[Math.floor(r() * figs.length)];
            const roll = r();
            const set = d < 1.5 ? sets.ink : roll < 0.84 ? sets.ink : roll < 0.95 ? sets.blue : sets.accent;
            if (fig.flat) q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
            else q.setFromEuler(e.set(r() * Math.PI * 2, r() * Math.PI * 2, r() * Math.PI * 2));
            const segs = fig.segs;
            const n = segs.length / 6;
            // Far panels draw fewer of their lines (they are small there), and dense figures
            // are fainter, so every panel reads about as bright.
            const keep = d > 7 ? 4 : d > 3.5 ? 2 : 1;
            // The 3D figures turn, slowly, one way or the other.
            const spinRate = fig.flat ? 0 : (0.1 + r() * 0.18) * (r() < 0.5 ? -1 : 1);
            const l = 0.3 * Math.min(1, Math.sqrt(350 / n)) * fade * Math.sqrt(keep);
            if (l < 0.004) continue;
            for (let k = 0; k < n; k += keep) {
              const o = k * 6;
              a.set(segs[o], segs[o + 1], segs[o + 2]).applyQuaternion(q).multiplyScalar(S);
              b.set(segs[o + 3], segs[o + 4], segs[o + 5]).applyQuaternion(q).multiplyScalar(S);
              a.x += cx;
              a.z += cz;
              b.x += cx;
              b.z += cz;
              // Each figure draws itself along its own line.
              const t = t0 + 0.1 * (k / n);
              set.segment(a, b, l, t, cx, cz, spinRate);
            }
          }
        }

        // Ours: the string landscape, redrawn plainly in its panel (it takes over from the
        // landscape world as that one fades).
        const L = PAISAJE_SIZE / 2;
        const c = F.contours((x, z) => height(x, z), -L, L, -L, L, 60, Array.from({ length: 16 }, (_, k) => -20 + k * 2.94));
        for (let o = 0; o < c.length; o += 6) {
          const x0 = c[o];
          const z0 = c[o + 2];
          const x1 = c[o + 3];
          const z1 = c[o + 5];
          const dd = Math.hypot((x0 + x1) / 2, (z0 + z1) / 2) / L;
          if (dd > 1) continue;
          const y0 = height(x0, z0);
          const y1 = height(x1, z1);
          sets.ours.segment(a.set(x0, y0, z0).multiplyScalar(FROM_LANDSCAPE), b.set(x1, y1, z1).multiplyScalar(FROM_LANDSCAPE), 0.3 * (1 - smoothstep(0.4, 1, dd)), 0, 0);
        }
        return {
          ink: sets.ink.data(),
          blue: sets.blue.data(),
          accent: sets.accent.data(),
          frames: sets.frames.data(),
          centre: sets.centre.data(),
          ours: sets.ours.data(),
        };
      },
      assemble(data) {
        const ink = spinLines(data.ink as Record<string, Float32Array>, INK);
        const blue = spinLines(data.blue as Record<string, Float32Array>, BLUE);
        const accent = spinLines(data.accent as Record<string, Float32Array>, ACCENT);
        const frames = linesFromData(data.frames as LinesData, INK);
        const centre = linesFromData(data.centre as LinesData, ACCENT);
        const ours = linesFromData(data.ours as LinesData, INK);
        const spinning = [ink, blue, accent];
        const all = [ink, blue, accent, frames, centre];
        const object = new THREE.Group();
        for (const l of [...all, ours]) object.add(l.mesh);
        return {
          object,
          clouds: [],
          update(f) {
            const form = f.tl.get('mat.form', f.p);
            // Pulling back, the panels crowd into fewer pixels: thin them so the plate never
            // washes white.
            const back = 1 - 0.45 * smoothstep(f.home - 0.9, f.home, f.e);
            for (const l of all) {
              l.uniforms.uAlpha.value = f.alpha * back;
              l.uniforms.uReveal.value = form;
            }
            for (const l of spinning) l.uniforms.uTime.value = f.time;
            // Our panel holds the landscape we came from, once that world has gone.
            ours.uniforms.uAlpha.value = f.alpha * back * (1 - f.alphaOf('paisaje'));
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'mat.form': 0 });
      // Rising out of the landscape: it turns out to be one drawing on a plate, among countless
      // others, drawing themselves outward.
      tl.to(6.0, { e: w.home - 0.5, 'mat.form': 1, yaw: 0, pitch: 0, roll: 0, fov: 40 });
      tl.label('matematico');
      // A slow drift over the plate.
      tl.to(4.0, { yaw: 0.22, pitch: 0.08, e: w.home - 0.25, fov: 44 });
    },
  };
}
