import * as THREE from 'three';
import type { WorldModule } from '../engine/cadena';
import { rng } from '../lib/math';
import { paso } from './paso';

/**
 * Between the grand unification and what the LHC has seen: fourteen orders of magnitude with
 * nothing we know of (physicists call it the desert). The journey races across them; the
 * emptiness is the point. The only things here are the powers of ten themselves: a thin dashed
 * ring, plate style, at every power from 10⁻³¹ m to 10⁻¹⁹ m, so the race reads as a tunnel of
 * measures rushing past.
 */

const UNIT = -26;
const FIRST = -31;
const LAST = -19;
const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const power = (k: number) => `10${String(k).replace(/./g, (c) => SUP[c])} m`;

/**
 * Rings drawn one pixel wide whatever their size, faded by how big they look: a ring comes in
 * from beyond the frame and fades as it shrinks towards a point (it would otherwise pile up into
 * a bright dot).
 */
const RING_VERT = /* glsl */ `
  attribute float aR;
  varying float vLight;
  void main() {
    vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    // The ring's radius on screen, in half screen heights.
    float rr = aR * length(modelMatrix[0].xyz) * projectionMatrix[1][1] / max(-c.z, 1e-6);
    vLight = smoothstep(0.03, 0.25, rr) * (1.0 - smoothstep(2.5, 6.0, rr));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const RING_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vLight;
  void main() {
    gl_FragColor = vec4(uColor * vLight * uAlpha * 0.32, 1.0);
  }
`;

export function desierto(): WorldModule {
  const base = paso({
    id: 'desierto',
    territory: 'desconocido',
    name: 'El desierto',
    fact: 'Entre la unificación y lo que hemos visto: catorce órdenes de magnitud de los que no sabemos nada.',
    label: 'desierto',
    unitExp: UNIT,
    anchor: new THREE.Vector3(),
    tint: 0x9a96b0,
    nameSpan: 4.4,
  });
  const rings: number[] = [];
  for (let k = FIRST; k <= LAST; k++) rings.push(k);
  return {
    spec: {
      ...base,
      // The rings span the whole desert, from where the unification fades to the collider.
      fade: [-4.5, -3.6, 4.9, 5.6],
      // Each ring is named while it looks a good size (between about a fifth and nine tenths of
      // the half-height of the screen).
      notes: rings.map((k) => ({ at: [0, Math.pow(10, k - UNIT), 0] as [number, number, number], text: power(k), e: [k + 0.35, k + 1.0] as [number, number], always: true })),
      noteSpan: 6,
      generate() {
        const r = rng(41);
        const pos: number[] = [];
        const rad: number[] = [];
        const seg = (R: number, a0: number, a1: number, r0 = R, r1 = R) => {
          pos.push(Math.cos(a0) * r0, Math.sin(a0) * r0, 0, Math.cos(a1) * r1, Math.sin(a1) * r1, 0);
          rad.push(R, R);
        };
        for (const k of rings) {
          const R = Math.pow(10, k - UNIT);
          const phase = r() * Math.PI * 2;
          // Dashed: 72 dashes, each filling 55% of its slot, drawn as short arcs.
          const DASHES = 72;
          for (let d = 0; d < DASHES; d++) {
            const a = phase + (d / DASHES) * Math.PI * 2;
            const len = (0.55 / DASHES) * Math.PI * 2;
            for (let j = 0; j < 3; j++) seg(R, a + (len * j) / 3, a + (len * (j + 1)) / 3);
          }
          // A tick at the top of the ring, where the plate writes its power.
          seg(R, Math.PI / 2, Math.PI / 2, R * 0.96, R * 1.04);
        }
        return { position: new Float32Array(pos), aR: new Float32Array(rad) };
      },
      assemble(data) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(data.position as Float32Array, 3));
        geo.setAttribute('aR', new THREE.BufferAttribute(data.aR as Float32Array, 1));
        const uniforms = { uColor: { value: new THREE.Color(0xece7db) }, uAlpha: { value: 0 } };
        const mesh = new THREE.LineSegments(
          geo,
          new THREE.ShaderMaterial({ vertexShader: RING_VERT, fragmentShader: RING_FRAG, uniforms, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
        );
        mesh.frustumCulled = false;
        return {
          object: mesh,
          clouds: [],
          update(f) {
            uniforms.uAlpha.value = f.alpha;
          },
        };
      },
    },
    choreo(tl) {
      tl.label('desierto');
      // The race: ten orders of magnitude in a few beats.
      tl.to(4.0, { e: -20.75, fov: 54, roll: 0.15, yaw: 0.2, pitch: 0.1 });
    },
  };
}
