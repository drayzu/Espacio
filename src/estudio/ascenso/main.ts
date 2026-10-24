import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../style.css';
import '../transicion/transicion.css';
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createStage } from '../stage';
import { clamp, damp, smoothstep } from '../../lib/math';
import { NUCLEUS } from '../../lib/cell';
import { createCellPoints } from '../styles/particulas';
import { MEDIUM_FRAG } from '../../lib/tinta';
import { buildAtom, buildDNA, buildFiber, buildTerritories } from './mundos';
import { worldPoints, type WorldPointUniforms } from './material';

/**
 * Trial run 2: the ascent. Atom -> DNA -> nucleosomes -> chromatin -> cell, each world nested
 * inside the next at its real place and size. Everything is a function of e = log10(viewport
 * height in metres). Scrolling down makes things bigger.
 *
 * Nesting: every world's transform to cell units is composed once in double precision; each frame
 * only multiplies by the screen transform, so the scale ratios (10⁵ here) never reach the GPU raw.
 */

interface World {
  name: string;
  fact: string;
  home: number;
  group: THREE.Group;
  u: WorldPointUniforms;
  /** Local units -> cell units. */
  rel: THREE.Matrix4;
  /** Framing centre, in cell units. */
  center: THREE.Vector3;
  fade: [number, number, number, number];
  alpha: number;
}

const ZoomBlurShader = {
  uniforms: { tDiffuse: { value: null }, uStrength: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    varying vec2 vUv;
    void main() {
      vec2 c = vUv - 0.5;
      vec3 acc = vec3(0.0);
      float wsum = 0.0;
      for (int i = 0; i < 12; i++) {
        float t = float(i) / 11.0;
        float w = 1.0 - t * 0.6;
        acc += texture2D(tDiffuse, 0.5 + c * (1.0 - uStrength * t)).rgb * w;
        wsum += w;
      }
      gl_FragColor = vec4(acc / wsum, 1.0);
    }
  `,
};

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const zoomBlur = new ShaderPass(ZoomBlurShader);
const stage = createStage(canvas, { prePasses: [zoomBlur] });
const { renderer, scene, camera } = stage;
scene.background = new THREE.Color(0x000000);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
stage.bloom.strength = 0.7;
stage.bloom.radius = 0.55;
stage.bloom.threshold = 0.12;
stage.finish.uniforms.uGrain.value = 0.035;
stage.finish.uniforms.uFringe.value = 0.014;

const DIST = 3;
camera.position.set(0, 0, DIST);
const tanHalf = () => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
const viewH = () => 2 * DIST * tanHalf();

// ---------- Worlds ----------
const root = new THREE.Group();
scene.add(root);

const X = new THREE.Vector3(1, 0, 0);
const local = (anchor: THREE.Vector3, dir: THREE.Vector3 | undefined, ratio: number) =>
  new THREE.Matrix4().compose(
    anchor,
    dir ? new THREE.Quaternion().setFromUnitVectors(X, dir.clone().normalize()) : new THREE.Quaternion(),
    new THREE.Vector3(ratio, ratio, ratio),
  );

const atomB = buildAtom();
const dnaB = buildDNA();
const fiberB = buildFiber();
const terrB = buildTerritories();
const cellSrc = createCellPoints(1, { dust: false });
(cellSrc.points.material as THREE.Material).dispose();

const relCell = new THREE.Matrix4();
const relTerr = local(new THREE.Vector3(NUCLEUS.x, NUCLEUS.y, 0), undefined, 0.1);
const relFiber = relTerr.clone().multiply(local(terrB.anchor!, terrB.anchorDir, 0.01));
const relDna = relFiber.clone().multiply(local(fiberB.anchor!, fiberB.anchorDir, 0.1));
const relAtom = relDna.clone().multiply(local(dnaB.anchor!, undefined, 0.1));

function world(
  name: string,
  fact: string,
  unitExp: number,
  frame: number,
  geometry: THREE.BufferGeometry,
  sizeUnit: number,
  gain: number,
  rel: THREE.Matrix4,
  frameCenter: THREE.Vector3,
  fade: [number, number, number, number],
): World {
  const home = unitExp + Math.log10(frame);
  const { points, uniforms } = worldPoints(geometry, sizeUnit, gain);
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  group.add(points);
  root.add(group);
  return {
    name,
    fact,
    home,
    group,
    u: uniforms,
    rel,
    center: frameCenter.clone().applyMatrix4(rel),
    fade: fade.map((v) => home + v) as World['fade'],
    alpha: 0,
  };
}

const atom = world(
  'Átomo de carbono',
  'Cuatro nubes de probabilidad: así se enlaza el carbono.',
  -10, 3.4, atomB.geometry, 0.007, 0.6, relAtom, atomB.frameCenter, [-99, -98, 0.75, 1.15],
);
const dna = world(
  'ADN · doble hélice',
  'Cada punto de luz es un átomo. Nuestro carbono es uno de ellos.',
  -9, 6, dnaB.geometry, 0.02, 1, relDna, dnaB.frameCenter, [-1.35, -0.85, 0.6, 1.0],
);
const fiber = world(
  'Nucleosomas',
  'El ADN se enrolla en proteínas: dos metros caben en cada núcleo.',
  -8, 8, fiberB.geometry, 0.025, 1, relFiber, fiberB.frameCenter, [-1.0, -0.55, 0.75, 1.15],
);
const terr = world(
  'Cromatina',
  'Cada hebra es ADN plegado una y otra vez.',
  -6, 3, terrB.geometry, 0.009, 1, relTerr, terrB.frameCenter, [-1.25, -0.8, 0.55, 0.95],
);
const cell = world(
  'Célula eucariota',
  'Unos cien billones de átomos.',
  -5, 2.7, cellSrc.points.geometry, 0.005, 0.38, relCell, new THREE.Vector3(), [-0.75, -0.35, 99, 100],
);
const WORLDS = [atom, dna, fiber, terr, cell];

// Ink: the cytoplasm as a medium, only in the cell.
const ink = new THREE.Mesh(
  new THREE.PlaneGeometry(12, 8),
  new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: MEDIUM_FRAG,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uNucleus: { value: new THREE.Vector3(NUCLEUS.x, NUCLEUS.y, NUCLEUS.r) } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }),
);
ink.position.z = -0.32;
ink.renderOrder = -1;
cell.group.add(ink);
const inkU = (ink.material as THREE.ShaderMaterial).uniforms;

// ---------- Scale dust ----------
const DUST_N = 2400;
const dust = (() => {
  const dir = new Float32Array(DUST_N);
  const r0 = new Float32Array(DUST_N);
  const phase = new Float32Array(DUST_N);
  const size = new Float32Array(DUST_N);
  for (let i = 0; i < DUST_N; i++) {
    dir[i] = Math.random() * Math.PI * 2;
    r0[i] = 0.15 + Math.random() * 0.85;
    phase[i] = Math.random();
    size[i] = 0.8 + Math.random() * 1.6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST_N * 3), 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 1));
  geo.setAttribute('aR0', new THREE.BufferAttribute(r0, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const uniforms = {
    uE: { value: 0 },
    uAspect: { value: 1 },
    uPR: { value: renderer.getPixelRatio() },
    uGain: { value: 0 },
    uColor: { value: new THREE.Color() },
  };
  const pts = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float aDir, aR0, aPhase, aSize;
        uniform float uE, uAspect, uPR;
        varying float vA;
        void main() {
          // Zooming out, motes fall inward: one decade of radius per cycle, tied to the scale.
          float s = fract(aPhase + uE * 0.55);
          float R = aR0 * exp((1.0 - s) * 3.2) * 0.06;
          vec2 pos = vec2(cos(aDir), sin(aDir)) * R;
          pos.x /= uAspect;
          gl_Position = vec4(pos, 0.0, 1.0);
          gl_PointSize = aSize * uPR * (0.6 + (1.0 - s) * 2.4);
          vA = sin(3.14159 * s);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uGain;
        uniform vec3 uColor;
        varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          gl_FragColor = vec4(uColor * exp(-dot(c, c) * 16.0) * vA * uGain, 1.0);
        }
      `,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  pts.frustumCulled = false;
  pts.renderOrder = 3;
  scene.add(pts);
  return uniforms;
})();
const TINTS = [0xb27cff, 0xd9ccff, 0xffc79a, 0x5ab8ff, 0x6fe0a0].map((h) => new THREE.Color(h));

function resize() {
  stage.resize();
  const dpr = renderer.getPixelRatio();
  const focal = (renderer.domElement.height / 2) / tanHalf();
  for (const w of WORLDS) {
    w.u.uFocal.value = focal;
    w.u.uMinPx.value = 1.6 * dpr;
    w.u.uMaxPx.value = 22 * dpr;
  }
}
addEventListener('resize', resize);
resize();

// ---------- Journey ----------
const E_START = -9.6;
const E_END = -4.45;

/**
 * Each world has a preferred viewing angle. The camera's orientation for world w is the rotation
 * that turns w's own axes into that angle; between worlds it slerps, so the view turns as you zoom.
 */
const VIEW_TILT: [number, number, number][] = [
  [0.6, 0.8, 0], // atom: the tetrahedron spread open
  [0.25, 0, -0.45], // DNA: helix seen from the side, on a diagonal
  [0.3, 0, -0.3], // nucleosomes: the zigzag in depth
  [0, 0, 0], // chromatin
  [0, 0, 0], // cell: face on
];
const views = WORLDS.map((w, i) => {
  const q = new THREE.Quaternion();
  w.rel.decompose(new THREE.Vector3(), q, new THREE.Vector3());
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(...VIEW_TILT[i])).multiply(q.invert());
});
function viewAt(e: number, out: THREE.Quaternion) {
  if (e <= WORLDS[0].home) return out.copy(views[0]);
  for (let i = 0; i < WORLDS.length - 1; i++) {
    const a = WORLDS[i];
    const b = WORLDS[i + 1];
    if (e <= b.home) return out.slerpQuaternions(views[i], views[i + 1], smoothstep(0.25, 1, (e - a.home) / (b.home - a.home)));
  }
  return out.copy(views[views.length - 1]);
}

function focusAt(e: number, out: THREE.Vector3) {
  if (e <= WORLDS[0].home) return out.copy(WORLDS[0].center);
  for (let i = 0; i < WORLDS.length - 1; i++) {
    const a = WORLDS[i];
    const b = WORLDS[i + 1];
    if (e <= b.home) return out.copy(a.center).lerp(b.center, smoothstep(0.25, 1, (e - a.home) / (b.home - a.home)));
  }
  return out.copy(WORLDS[WORLDS.length - 1].center);
}

// ---------- Input ----------
const params = new URLSearchParams(location.search);
let eTarget = clamp(Number(params.get('e') ?? E_START), E_START, E_END);
let e = eTarget;
let autoplay = params.has('play');
const mouse = new THREE.Vector2();
const mouseTarget = new THREE.Vector2();
const playBtn = document.querySelector<HTMLButtonElement>('#play')!;

const nudge = (d: number) => {
  autoplay = false;
  eTarget = clamp(eTarget + d, E_START, E_END);
  document.body.classList.add('touched');
};
addEventListener(
  'wheel',
  (ev) => {
    ev.preventDefault();
    nudge(ev.deltaY * 0.0011);
  },
  { passive: false },
);
addEventListener('keydown', (ev) => {
  if (ev.key === 'ArrowDown' || ev.key === 'PageDown' || ev.key === ' ') nudge(0.5);
  if (ev.key === 'ArrowUp' || ev.key === 'PageUp') nudge(-0.5);
  if (ev.key === 'Home') nudge(E_START - eTarget);
  if (ev.key.toLowerCase() === 'a') togglePlay();
});
let dragY: number | null = null;
addEventListener('pointerdown', (ev) => (dragY = ev.clientY));
addEventListener('pointerup', () => (dragY = null));
addEventListener('pointermove', (ev) => {
  mouseTarget.set((ev.clientX / innerWidth) * 2 - 1, -((ev.clientY / innerHeight) * 2 - 1));
  if (dragY !== null && ev.pointerType === 'touch') {
    nudge((dragY - ev.clientY) * 0.006);
    dragY = ev.clientY;
  }
});
function togglePlay() {
  if (autoplay) autoplay = false;
  else {
    if (eTarget >= E_END - 0.05) e = eTarget = E_START;
    autoplay = true;
    document.body.classList.add('touched');
  }
}
playBtn.addEventListener('click', togglePlay);

// ---------- HUD ----------
const expEl = document.querySelector<HTMLElement>('#exp')!;
const unitEl = document.querySelector<HTMLElement>('#unit')!;
const nameEl = document.querySelector<HTMLElement>('#name')!;
const factEl = document.querySelector<HTMLElement>('#fact')!;
const marker = document.querySelector<HTMLElement>('#marker')!;
const ruler = document.querySelector<HTMLElement>('#ruler')!;
const hint = document.querySelector<HTMLElement>('.hint')!;
const rulerPos = (v: number) => `${((v - E_START) / (E_END - E_START)) * 100}%`;
for (let v = -9; v <= -5; v++) {
  const t = document.createElement('div');
  t.className = 'tick';
  t.style.top = rulerPos(v);
  ruler.appendChild(t);
}
const LABELS = ['átomo', 'ADN', 'nucleosomas', 'cromatina', 'célula'];
WORLDS.forEach((w, i) => {
  const t = document.createElement('div');
  t.className = 'tick tick--named';
  t.style.top = rulerPos(w.home);
  t.innerHTML = `<span>${LABELS[i]}</span>`;
  t.addEventListener('click', () => nudge(w.home - eTarget));
  ruler.appendChild(t);
});
const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = (n: number) => [...String(n)].map((ch) => SUP[ch] ?? ch).join('');
const nf = new Intl.NumberFormat('es-CL', { maximumSignificantDigits: 2 });
function human(ex: number) {
  const v = Math.pow(10, ex);
  const units: [number, string][] = [
    [1e-3, 'mm'],
    [1e-6, 'µm'],
    [1e-9, 'nm'],
    [1e-12, 'pm'],
  ];
  const [u, name] = units.find(([u]) => v >= u) ?? units[units.length - 1];
  return `≈ ${nf.format(v / u)} ${name} de alto`;
}
let shown: World | null | undefined;

// ---------- Frame ----------
const F = new THREE.Vector3();
const screen = new THREE.Matrix4();
const shift = new THREE.Matrix4();
const tint = new THREE.Color();
const view = new THREE.Quaternion();
const look = new THREE.Quaternion();
const lookE = new THREE.Euler();
let last = performance.now();
let prevE = e;
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const time = now / 1000;
  if (autoplay) {
    eTarget = Math.min(E_END, eTarget + dt * 0.4);
    if (eTarget >= E_END) autoplay = false;
  }
  e = damp(e, eTarget, 3, dt);
  const vel = (e - prevE) / Math.max(dt, 1e-3);
  prevE = e;
  mouse.x = damp(mouse.x, mouseTarget.x, 3, dt);
  mouse.y = damp(mouse.y, mouseTarget.y, 3, dt);

  // Place every world: screen = scale(cell units -> scene) * translate(-focus).
  const s = viewH() * Math.pow(10, -5 - e);
  focusAt(e, F);
  screen.makeScale(s, s, s).multiply(shift.makeTranslation(-F.x, -F.y, -F.z));
  for (const w of WORLDS) {
    const [a, b, c, d] = w.fade;
    w.alpha = smoothstep(a, b, e) * (1 - smoothstep(c, d, e));
    w.group.visible = w.alpha > 0.002;
    if (!w.group.visible) continue;
    w.group.matrix.multiplyMatrices(screen, w.rel);
    w.group.matrixWorldNeedsUpdate = true;
    w.u.uAlpha.value = w.alpha;
    w.u.uTime.value = time;
  }
  // A parent hides its stand-in for the child while the child itself is showing.
  dna.u.uFlagAlpha.value = 1 - atom.alpha;
  fiber.u.uFlagAlpha.value = 1 - dna.alpha;
  terr.u.uFlagAlpha.value = 1 - fiber.alpha;
  inkU.uTime.value = time;
  inkU.uOpacity.value = smoothstep(-5.5, -4.75, e);
  ink.visible = inkU.uOpacity.value > 0.002;

  viewAt(e, view);
  look.setFromEuler(lookE.set(-mouse.y * 0.15, mouse.x * 0.25 + 0.15 * Math.sin(time * 0.06), 0));
  root.quaternion.multiplyQuaternions(look, view);

  zoomBlur.uniforms.uStrength.value = clamp(Math.abs(vel) * 0.05, 0, 0.12);
  dust.uE.value = e;
  dust.uAspect.value = innerWidth / innerHeight;
  dust.uGain.value = 0.05 + Math.min(Math.abs(vel), 3) * 0.12;
  const k = clamp(WORLDS.findIndex((w) => e < w.home), 1, WORLDS.length - 1);
  const t = clamp((e - WORLDS[k - 1].home) / (WORLDS[k].home - WORLDS[k - 1].home), 0, 1);
  dust.uColor.value.copy(tint.copy(TINTS[k - 1]).lerp(TINTS[k], t));

  // HUD.
  expEl.innerHTML = `10${sup(Math.round(e))}<span class="m"> m</span>`;
  unitEl.textContent = human(e);
  marker.style.top = rulerPos(e);
  const near = WORLDS.find((w) => Math.abs(e - w.home) < 0.45) ?? null;
  if (near !== shown) {
    shown = near;
    nameEl.classList.remove('is-in');
    factEl.classList.remove('is-in');
    setTimeout(() => {
      nameEl.textContent = near?.name ?? '';
      factEl.textContent = near?.fact ?? '';
      if (near) {
        nameEl.classList.add('is-in');
        factEl.classList.add('is-in');
      }
    }, 250);
  }
  playBtn.classList.toggle('is-on', autoplay);
  hint.classList.toggle('is-gone', document.body.classList.contains('touched'));

  stage.render(time);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
