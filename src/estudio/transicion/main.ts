import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../style.css';
import './transicion.css';
import * as THREE from 'three';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createStage } from '../stage';
import { clamp, damp, smoothstep } from '../../lib/math';
import { ATOMO_SHADE } from '../mundos/atomo';
import { CELL_SHADE, CELL_UNIFORMS, inkQuad } from './shaders';
import { createDissolve } from './disolucion';

/**
 * Trial run: cell (ink) -> dissolves into particles -> particles assemble -> atom (ink).
 * Everything is a pure function of the scale exponent e = log10(viewport height in metres),
 * so the journey runs the same both ways.
 */

// Timeline, in orders of magnitude.
const E_START = -4.5; // the whole cell, about 30 µm across the screen
const E_END = -9.6; // a carbon atom fills the screen
const CELL_DIVE = 1; // zoom 10x into the nucleus before it breaks up
const A_START = E_START - CELL_DIVE; // the cell starts dissolving
const A_SPAN = 2.3;
const B_END = -8.9; // the atom has assembled
const B_SPAN = 1.9;
const ATOM_BASE_ZOOM = 0.3;
const FOCUS = new THREE.Vector2(-0.02, -0.12); // a point in the chromatin, clear of the nucleolus, in cell units

const RULER: [number, string][] = [
  [-4.5, 'célula'],
  [-5.5, 'núcleo'],
  [-7, 'cromatina'],
  [-8.3, 'ADN'],
  [-9.4, 'átomo'],
];

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
renderer.toneMapping = THREE.NoToneMapping;
stage.bloom.strength = 0.65;
stage.bloom.radius = 0.6;
stage.bloom.threshold = 0.22;
stage.finish.uniforms.uGrain.value = 0.04;
stage.finish.uniforms.uFringe.value = 0.016;

const DIST = 3;
camera.position.set(0, 0, DIST);
const viewH = () => 2 * DIST * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

// The two worlds as they appear on screen.
const cell = inkQuad(CELL_SHADE, CELL_UNIFORMS(), false);
const atom = inkQuad(ATOMO_SHADE, {}, false);
cell.mesh.renderOrder = 0;
atom.mesh.renderOrder = 1;
scene.add(cell.mesh, atom.mesh);

// Their particle doubles.
const cellDust = createDissolve(CELL_SHADE, CELL_UNIFORMS(), 31);
const atomDust = createDissolve(ATOMO_SHADE, {}, 32);
cellDust.world.uZoom.value = Math.pow(10, CELL_DIVE);
cellDust.world.uCenter.value.copy(FOCUS);
cellDust.uniforms.uK.value = Math.LN10 * A_SPAN;
atomDust.world.uZoom.value = ATOM_BASE_ZOOM;
atomDust.uniforms.uK.value = Math.LN10 * B_SPAN;
scene.add(cellDust.points, atomDust.points);

// Scale dust: motes that stream outward as you zoom in, so the journey never feels parked.
const DUST_N = 2600;
const dust = (() => {
  const dir = new Float32Array(DUST_N);
  const r0 = new Float32Array(DUST_N);
  const phase = new Float32Array(DUST_N);
  const size = new Float32Array(DUST_N);
  for (let i = 0; i < DUST_N; i++) {
    dir[i] = Math.random() * Math.PI * 2;
    r0[i] = 0.15 + Math.random() * 0.85;
    phase[i] = Math.random();
    size[i] = 0.8 + Math.random() * 1.8;
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
          // Each mote climbs one decade of radius per cycle; the cycle follows the scale itself.
          float s = fract(aPhase - uE * 0.55);
          float R = aR0 * exp(s * 3.2) * 0.06;
          vec2 pos = vec2(cos(aDir), sin(aDir)) * R;
          pos.x /= uAspect;
          gl_Position = vec4(pos, 0.0, 1.0);
          gl_PointSize = aSize * uPR * (0.6 + s * 2.4);
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
  return { pts, uniforms };
})();
scene.add(dust.pts);
const CELL_TINT = new THREE.Color(0x4fb8ff);
const ATOM_TINT = new THREE.Color(0xb27cff);

function resize() {
  stage.resize();
  const dpr = renderer.getPixelRatio();
  for (const d of [cellDust, atomDust]) {
    d.resize(innerWidth, innerHeight, dpr);
    d.uniforms.uViewH.value = viewH();
    d.uniforms.uDist.value = DIST;
  }
  for (const w of [cell, atom]) w.uniforms.uRes.value.set(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();

// ---------- Input ----------
const params = new URLSearchParams(location.search);
let eTarget = clamp(Number(params.get('e') ?? E_START), E_END, E_START);
let e = eTarget;
let autoplay = params.has('play');
const mouse = new THREE.Vector2();
const mouseTarget = new THREE.Vector2();
const hint = document.querySelector<HTMLElement>('.hint')!;
const playBtn = document.querySelector<HTMLButtonElement>('#play')!;

const nudge = (d: number) => {
  autoplay = false;
  eTarget = clamp(eTarget + d, E_END, E_START);
  document.body.classList.add('touched');
};
addEventListener('wheel', (ev) => (ev.preventDefault(), nudge(-ev.deltaY * 0.0011)), { passive: false });
addEventListener('keydown', (ev) => {
  if (ev.key === 'ArrowDown' || ev.key === 'PageDown' || ev.key === ' ') nudge(-0.5);
  if (ev.key === 'ArrowUp' || ev.key === 'PageUp') nudge(0.5);
  if (ev.key === 'Home') nudge(E_START - eTarget);
  if (ev.key.toLowerCase() === 'a') togglePlay();
});
let dragY: number | null = null;
addEventListener('pointerdown', (ev) => (dragY = ev.clientY));
addEventListener('pointerup', () => (dragY = null));
addEventListener('pointermove', (ev) => {
  mouseTarget.set((ev.clientX / innerWidth) * 2 - 1, -((ev.clientY / innerHeight) * 2 - 1));
  if (dragY !== null && ev.pointerType === 'touch') {
    nudge((ev.clientY - dragY) * -0.006);
    dragY = ev.clientY;
  }
});
function togglePlay() {
  if (autoplay) {
    autoplay = false;
  } else {
    if (eTarget <= E_END + 0.05) e = eTarget = E_START;
    autoplay = true;
    document.body.classList.add('touched');
  }
}
playBtn.addEventListener('click', togglePlay);

// ---------- HUD ----------
const expEl = document.querySelector<HTMLElement>('#exp')!;
const unitEl = document.querySelector<HTMLElement>('#unit')!;
const nameEl = document.querySelector<HTMLElement>('#name')!;
const marker = document.querySelector<HTMLElement>('#marker')!;
const ruler = document.querySelector<HTMLElement>('#ruler')!;
const rulerPos = (v: number) => `${((E_START - v) / (E_START - E_END)) * 100}%`;
for (let v = -5; v >= -9; v--) {
  const t = document.createElement('div');
  t.className = 'tick';
  t.style.top = rulerPos(v);
  ruler.appendChild(t);
}
for (const [v, label] of RULER) {
  const t = document.createElement('div');
  t.className = 'tick tick--named';
  t.style.top = rulerPos(v);
  t.innerHTML = `<span>${label}</span>`;
  t.addEventListener('click', () => nudge(v - eTarget));
  ruler.appendChild(t);
}
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
function nameFor(ex: number) {
  if (ex > -5.0) return 'Célula eucariota';
  if (ex > -6.1) return 'Núcleo · cromatina';
  if (ex > -8.7) return '';
  return 'Átomo de carbono';
}
let shownName = '';

// ---------- Frame ----------
let last = performance.now();
let prevE = e;
function frame(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  const time = now / 1000;
  if (autoplay) {
    eTarget = Math.max(E_END, eTarget - dt * 0.42);
    if (eTarget <= E_END) autoplay = false;
  }
  e = damp(e, eTarget, 3, dt);
  const vel = (e - prevE) / Math.max(dt, 1e-3);
  prevE = e;
  mouse.x = damp(mouse.x, mouseTarget.x, 3, dt);
  mouse.y = damp(mouse.y, mouseTarget.y, 3, dt);

  // Cell: zoom into the chromatin, drifting the focus to the centre, then hand over to its particles.
  const dive = clamp(E_START - e, 0, CELL_DIVE);
  const P = clamp((A_START - e) / A_SPAN, 0, 1);
  cell.uniforms.uZoom.value = Math.pow(10, dive);
  cell.uniforms.uCenter.value.copy(FOCUS).multiplyScalar(smoothstep(0, CELL_DIVE, dive));
  cell.uniforms.uOpacity.value = 1 - smoothstep(0.01, 0.06, P);
  cell.mesh.visible = cell.uniforms.uOpacity.value > 0.001;
  cellDust.uniforms.uS.value = clamp((A_START - e) / A_SPAN, -1, 1);
  cellDust.uniforms.uFade.value = smoothstep(0, 0.015, P);
  cellDust.points.visible = P > 0 && P < 1;

  // Atom: its particles arrive from the depth, settle, then hand over to the ink.
  const Q = clamp((e - B_END) / B_SPAN, 0, 1);
  const atomIn = smoothstep(B_END + 0.04, B_END - 0.12, e);
  atom.uniforms.uZoom.value = ATOM_BASE_ZOOM * Math.pow(10, Math.max(0, B_END - e));
  atom.uniforms.uOpacity.value = atomIn;
  atom.mesh.visible = atomIn > 0.001;
  atomDust.uniforms.uS.value = clamp((B_END - e) / B_SPAN, -1, 0.3);
  atomDust.uniforms.uFade.value = 1 - atomIn;
  atomDust.points.visible = Q < 1 && atomIn < 0.999;

  for (const w of [cell.uniforms, atom.uniforms, cellDust.world, atomDust.world]) {
    w.uTime.value = time;
    w.uMouse.value.copy(mouse);
  }
  for (const d of [cellDust, atomDust]) {
    d.uniforms.uTime.value = time;
    d.uniforms.uMouse.value.copy(mouse);
    if (d.points.visible) d.capture(renderer);
  }
  zoomBlur.uniforms.uStrength.value = clamp(Math.abs(vel) * 0.05, 0, 0.14);
  const between = smoothstep(-5.6, -6.4, e) * (1 - smoothstep(-8.3, -8.95, e));
  dust.uniforms.uE.value = e;
  dust.uniforms.uAspect.value = innerWidth / innerHeight;
  dust.uniforms.uGain.value = (0.08 + 0.55 * between) * (1 + Math.min(Math.abs(vel), 3) * 0.5);
  dust.uniforms.uColor.value.copy(CELL_TINT).lerp(ATOM_TINT, smoothstep(-6.8, -8.4, e));

  // HUD.
  expEl.innerHTML = `10${sup(Math.round(e))}<span class="m"> m</span>`;
  unitEl.textContent = human(e);
  marker.style.top = rulerPos(e);
  const name = nameFor(e);
  if (name !== shownName) {
    shownName = name;
    nameEl.classList.remove('is-in');
    setTimeout(() => {
      nameEl.textContent = name;
      if (name) nameEl.classList.add('is-in');
    }, 250);
  }
  playBtn.classList.toggle('is-on', autoplay);
  hint.classList.toggle('is-gone', document.body.classList.contains('touched'));

  stage.render(time);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
