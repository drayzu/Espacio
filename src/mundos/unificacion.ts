import * as THREE from 'three';
import type { WorldModule } from '../engine/cadena';

/**
 * The grand unification, in the plate's language because it is hypothesis. 1 unit = 10⁻³² m.
 * If the strong, weak and electromagnetic forces are one at the smallest scales, they part as the
 * scale grows. Drawn as arms of light on logarithmic spirals: each arm leaves the Planck foam as a
 * single white strand and splits into three (orange, blue, white) that drift apart. A logarithmic
 * spiral looks the same at every zoom, so the parting goes on while the camera pulls back; only
 * the part of the drawing near the scale on screen is lit, and light runs outward along it.
 * Arrival: the strands grow out of the foam. Moment: they part.
 */

const UNIT = -32;
const ARMS = 7;
/** log10 of the radius, from deep inside the foam to far past the frame. */
const U0 = -3.2;
const U1 = 1.6;
/** Where the single strand splits. */
const US = -0.6;
const PER_DECADE = 70;

const VERT = /* glsl */ `
  attribute float aLogR;
  attribute float aLight;
  attribute vec3 aColor;
  uniform float uLogView, uTime, uAlpha;
  varying vec3 vColor;
  void main() {
    // Lit only near the scale on screen (a band about one decade wide).
    float d = aLogR - uLogView;
    float vis = exp(-d * d / 0.5);
    // Light running outward along the arms.
    float pulse = 0.6 + 0.4 * sin(6.2832 * (aLogR * 2.5 - uTime * 0.18));
    vColor = aColor * aLight * vis * pulse * uAlpha;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0);
  }
`;

/** The strong force, the weak force, electromagnetism; and the single force before them. */
const STRANDS = [0xff5b2e, 0x7fa8ff, 0xece7db];
const ONE = 0xfff4e6;

export function unificacion(): WorldModule {
  return {
    spec: {
      id: 'unificacion',
      territory: 'hipotético',
      name: 'La gran unificación',
      fact: 'Un poco más arriba, quizá, tres de las fuerzas de la naturaleza son una sola.',
      label: 'unificación',
      unitExp: UNIT,
      frame: 3,
      anchor: new THREE.Vector3(),
      frameCenter: new THREE.Vector3(),
      view: 'continue',
      fade: [-2.2, -1.4, 1.3, 2.1],
      tint: 0xece7db,
      notes: (() => {
        // On arm 0 at the home scale: the single strand before the split, the three after.
        const at = (u: number, off: number): [number, number, number] => {
          const r = Math.pow(10, u);
          const th = 1.05 * u + off;
          return [r * Math.cos(th), r * Math.sin(th), r * 0.18 * Math.sin(u * 2.2)];
        };
        const spread = (k: number, u: number) => (k - 1) * 0.16 * Math.pow(Math.max(0, u - US), 1.3);
        return [
          { at: at(-0.9, 0), text: 'una sola fuerza' },
          { at: at(0.15, spread(0, 0.15)), text: 'fuerte' },
          { at: at(0.15, spread(1, 0.15)), text: 'débil' },
          { at: at(0.15, spread(2, 0.15)), text: 'electromagnética' },
        ];
      })(),
      generate() {
        const pos: number[] = [];
        const logR: number[] = [];
        const light: number[] = [];
        const color: number[] = [];
        const c = new THREE.Color();
        const at = (u: number, theta: number, arm: number) => {
          const r = Math.pow(10, u);
          // A gentle swell out of the plane, so the arms have depth when the camera tilts.
          const z = r * 0.18 * Math.sin(u * 2.2 + arm * 1.3);
          return [r * Math.cos(theta), r * Math.sin(theta), z];
        };
        const strand = (arm: number, from: number, to: number, offset: (u: number) => number, hex: number, l: number) => {
          const n = Math.ceil((to - from) * PER_DECADE);
          c.setHex(hex);
          const theta0 = (arm / ARMS) * Math.PI * 2;
          for (let k = 0; k < n; k++) {
            const ua = from + ((to - from) * k) / n;
            const ub = from + ((to - from) * (k + 1)) / n;
            // A logarithmic spiral: 1.05 rad of turn per decade.
            pos.push(...at(ua, theta0 + 1.05 * ua + offset(ua), arm), ...at(ub, theta0 + 1.05 * ub + offset(ub), arm));
            logR.push(ua, ub);
            // The single strand brightens towards the split; the three fade far out.
            const fa = l * Math.min(1, (U1 - ua) / 0.6);
            const fb = l * Math.min(1, (U1 - ub) / 0.6);
            light.push(fa, fb);
            color.push(c.r, c.g, c.b, c.r, c.g, c.b);
          }
        };
        for (let arm = 0; arm < ARMS; arm++) {
          strand(arm, U0, US, () => 0, ONE, 0.9);
          STRANDS.forEach((hex, k) => {
            // They part slowly at first, then steadily: the angle between them grows with the scale.
            const spread = (u: number) => (k - 1) * 0.16 * Math.pow(Math.max(0, u - US), 1.3);
            strand(arm, US, U1, spread, hex, 0.75);
          });
        }
        return {
          position: new Float32Array(pos),
          aLogR: new Float32Array(logR),
          aLight: new Float32Array(light),
          aColor: new Float32Array(color),
        };
      },
      assemble(data) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(data.position as Float32Array, 3));
        geo.setAttribute('aLogR', new THREE.BufferAttribute(data.aLogR as Float32Array, 1));
        geo.setAttribute('aLight', new THREE.BufferAttribute(data.aLight as Float32Array, 1));
        geo.setAttribute('aColor', new THREE.BufferAttribute(data.aColor as Float32Array, 3));
        const uniforms = { uLogView: { value: 0 }, uTime: { value: 0 }, uAlpha: { value: 0 } };
        const lines = new THREE.LineSegments(
          geo,
          new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
        );
        lines.frustumCulled = false;
        return {
          object: lines,
          clouds: [],
          update(f) {
            // The radius at about a third of the screen's height, in this world's units.
            uniforms.uLogView.value = f.e - UNIT - 0.5;
            uniforms.uTime.value = f.time;
            uniforms.uAlpha.value = f.alpha * f.tl.get('gut.form', f.p);
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'gut.form': 0 });
      // The strands grow out of the foam as it falls away.
      tl.to(3.2, { e: w.home - 0.15, 'gut.form': 1, roll: 0.35, yaw: 0.2, pitch: 0.25, fov: 44 });
      tl.label('unificacion');
      // They part: a slow pull back, rolling with the spiral.
      tl.to(2.8, { e: w.home + 0.45, roll: 0.75, yaw: 0.05, pitch: 0.4, fov: 48 });
    },
  };
}
