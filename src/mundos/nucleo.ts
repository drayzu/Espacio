import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';

/**
 * A carbon-12 nucleus. 1 unit = 1 fm. Six protons and six neutrons packed on an icosahedron,
 * jostling. Our proton keeps glowing for a while after the zoom leaves it.
 * Moment: a swing around the nucleus. All the while the nucleons throw mesons at each other, like
 * the one just born in the proton: that exchange is the nuclear force that holds them together.
 */

/**
 * The exchange: along each pair of neighbours a meson hops from one nucleon to the other, now and
 * then (`aPhase`), a bright point with a short tail (`aLag` behind it) so the motion reads.
 */
const PION_VERT = /* glsl */ `
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute float aPhase, aLag;
  uniform float uTime, uAlpha;
  varying float vL;
  void main() {
    // Each pair throws one about every two and a half seconds; a hop takes a fifth of that.
    float c = fract(aPhase + uTime * 0.4);
    float u = c * 5.0 - aLag;
    float k = smoothstep(0.0, 1.0, clamp(u, 0.0, 1.0));
    // Lifted a little off the straight line, so the hops arc round the nucleons' glow.
    vec3 mid = (aFrom + aTo) * 0.5;
    vec3 p = mix(aFrom, aTo, k) + normalize(mid + vec3(1e-4)) * sin(k * 3.14159) * 0.8;
    vL = uAlpha * step(0.0, u) * step(u, 1.0) * smoothstep(0.0, 0.15, u) * (1.0 - smoothstep(0.85, 1.0, u)) * (1.0 - aLag * 9.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = 4.6 - aLag * 20.0;
    if (vL < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;
const PION_FRAG = /* glsl */ `
  varying float vL;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    gl_FragColor = vec4(vec3(1.0, 0.82, 0.29) * vL * exp(-dot(c, c) * 9.0), 1.0);
  }
`;

const PHI = (1 + Math.sqrt(5)) / 2;

export const NUCLEO = (() => {
  const verts: [number, number, number][] = [];
  for (const a of [-1, 1]) {
    for (const b of [-PHI, PHI]) {
      verts.push([0, a, b], [a, b, 0], [b, 0, a]);
    }
  }
  const nucleons = verts.map(([x, y, z], i) => ({
    p: new THREE.Vector3(x, y, z).normalize().multiplyScalar(1.35),
    proton: i % 2 === 0,
  }));
  // Ours: the proton nearest the viewer.
  let ours = 0;
  nucleons.forEach((n, i) => {
    if (n.proton && n.p.z > nucleons[ours].p.z) ours = i;
  });
  return { nucleons, ours };
})();

/** The nucleon of a kind nearest the viewer (largest z), for the plate's notes. */
const nearest = (ok: (n: (typeof NUCLEO.nucleons)[number], i: number) => boolean) =>
  NUCLEO.nucleons.filter(ok).reduce((a, b) => (b.p.z > a.p.z ? b : a)).p.toArray();

export function nucleo(): WorldModule {
  return {
    spec: {
      id: 'nucleo',
      territory: 'subatómico',
      name: 'Núcleo de carbono',
      fact: 'Seis protones y seis neutrones: casi toda la masa del átomo cabe aquí.',
      label: 'núcleo',
      unitExp: -15,
      frame: 9,
      anchor: new THREE.Vector3(),
      frameCenter: new THREE.Vector3(),
      view: [0.6, 0.8, 0],
      // The other nucleons arrive only as the proton's moment ends. On the way out the nucleus
      // stays lit, a point in the dark, until the atom's own nucleus takes over.
      fade: [-0.5, -0.15, 2.3, 3.0],
      tint: 0xff8fb0,
      notes: [
        { at: NUCLEO.nucleons[NUCLEO.ours].p.toArray(), text: 'nuestro protón' },
        { at: nearest((n, i) => n.proton && i !== NUCLEO.ours), text: 'protón' },
        { at: nearest((n) => !n.proton), text: 'neutrón' },
      ],
      generate() {
        const b = cloudBuilder(91);
        const { r } = b;
        const quarkColors = [0xff4a5e, 0x4aff9a, 0x4a8cff];
        NUCLEO.nucleons.forEach((n, i) => {
          const flag = i === NUCLEO.ours;
          const hue = n.proton ? 0xff6f9a : 0x9fbcff;
          for (let k = 0; k < 2600; k++) {
            b.push(n.p.x + gauss(r) * 0.36, n.p.y + gauss(r) * 0.36, n.p.z + gauss(r) * 0.36, hue, 1, 0.02, 0.4, { flag });
          }
          // Three faint quark hot spots inside each nucleon.
          for (let q = 0; q < 3; q++) {
            const a = (q / 3) * Math.PI * 2 + i;
            const qx = n.p.x + Math.cos(a) * 0.3;
            const qy = n.p.y + Math.sin(a) * 0.3;
            for (let k = 0; k < 140; k++) {
              b.push(qx + gauss(r) * 0.08, qy + gauss(r) * 0.08, n.p.z + gauss(r) * 0.08, quarkColors[q], 1, 0.02, 0.5, { flag });
            }
          }
        });
        // The strong force's haze holding them together.
        for (let k = 0; k < 3000; k++) {
          const [x, y, z] = b.onSphere();
          const rad = Math.cbrt(r()) * 2.6;
          b.push(x * rad, y * rad, z * rad, 0xffe6b0, 1, 0.05, 0.06);
        }
        // A beacon: on the way out, the nucleus stays a small bright point in the emptiness of the
        // atom instead of dimming to nothing as it shrinks below a pixel.
        const beacon = cloudBuilder(92);
        for (let k = 0; k < 6; k++) beacon.push(gauss(r) * 0.4, gauss(r) * 0.4, gauss(r) * 0.4, 0xffe6cc, 1, 0, 0.6, { star: true });
        // The mesons: one per pair of neighbours (the icosahedron's edges), each way at random.
        const pr = rng(93);
        const from: number[] = [];
        const to: number[] = [];
        const phase: number[] = [];
        const lag: number[] = [];
        const N = NUCLEO.nucleons;
        for (let i = 0; i < N.length; i++) {
          for (let j = i + 1; j < N.length; j++) {
            if (N[i].p.distanceTo(N[j].p) > 1.6) continue;
            const [a, c] = pr() < 0.5 ? [N[i].p, N[j].p] : [N[j].p, N[i].p];
            const ph = pr();
            for (const l of [0, 0.03, 0.06]) {
              from.push(a.x, a.y, a.z);
              to.push(c.x, c.y, c.z);
              phase.push(ph);
              lag.push(l);
            }
          }
        }
        return {
          main: b.data(),
          beacon: beacon.data(),
          pions: { aFrom: new Float32Array(from), aTo: new Float32Array(to), aPhase: new Float32Array(phase), aLag: new Float32Array(lag) },
        };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 0.0275, 1);
        const beacon = cloudFromData(data.beacon as PointsData, 0.0275, 1);
        const pd = data.pions as Record<'aFrom' | 'aTo' | 'aPhase' | 'aLag', Float32Array>;
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pd.aFrom, 3));
        geo.setAttribute('aFrom', new THREE.BufferAttribute(pd.aFrom, 3));
        geo.setAttribute('aTo', new THREE.BufferAttribute(pd.aTo, 3));
        geo.setAttribute('aPhase', new THREE.BufferAttribute(pd.aPhase, 1));
        geo.setAttribute('aLag', new THREE.BufferAttribute(pd.aLag, 1));
        const pionU = { uTime: { value: 0 }, uAlpha: { value: 0 } };
        const pions = new THREE.Points(
          geo,
          new THREE.ShaderMaterial({ vertexShader: PION_VERT, fragmentShader: PION_FRAG, uniforms: pionU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
        );
        pions.frustumCulled = false;
        const object = new THREE.Group();
        object.add(cloud.points, beacon.points, pions);
        return {
          object,
          clouds: [cloud, beacon],
          update(f) {
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('proton'), f.e, f.home);
            beacon.u.uGain.value = smoothstep(f.home + 0.7, f.home + 1.6, f.e);
            // At the nucleus's own scale, once the other nucleons are in.
            pionU.uTime.value = f.time;
            pionU.uAlpha.value = 1.6 * f.alpha * smoothstep(f.home - 0.3, f.home - 0.1, f.e) * (1 - smoothstep(f.home + 0.3, f.home + 0.6, f.e));
            pions.visible = pionU.uAlpha.value > 0.002;
          },
        };
      },
    },
    choreo(tl, w) {
      tl.to(2.8, { e: w.home - 0.05, yaw: 0.2, pitch: 0.1 });
      tl.label('nucleo');
      tl.to(2.2, { yaw: -0.5, pitch: 0.25, e: w.home + 0.1 });
    },
  };
}
