import * as THREE from 'three';
import { MITOS, NUCLEOLUS, NUCLEUS, STRETCH_X } from '../../lib/cell';
import { LIFT } from '../stage';
import type { Style } from '../types';

/**
 * Style 4: a living painting. One full-screen shader: ink currents, bioluminescent filaments,
 * soft glows. Depth is faked by moving each layer at its own rate with the mouse.
 */

const FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime, uScale, uLift;
  uniform vec2 uRes, uMouse;
  uniform vec4 uMito[7];
  uniform vec3 uNucleus, uNucleolus;
  varying vec2 vUv;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dot(hash2(i), f), dot(hash2(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
               mix(dot(hash2(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash2(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
    return v;
  }
  float membraneR(float th) {
    return 1.0 + 0.045 * sin(3.0 * th + 0.6) + 0.03 * sin(5.0 * th - 1.1) + 0.015 * sin(9.0 * th + 2.0);
  }
  float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main() {
    vec2 frag = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    float scale = uScale;
    frag.y -= uLift / uScale;
    float t = uTime;

    // Each layer slides by its own amount: far haze, cell, nucleus, foreground dust.
    vec2 pFar = frag * scale + uMouse * 0.05;
    vec2 p = frag * scale + uMouse * 0.12;
    vec2 pNear = frag * scale + uMouse * 0.2;

    // Background: slow, dark currents.
    float haze = fbm(pFar * 0.7 + vec2(t * 0.01, -t * 0.013));
    vec3 col = mix(vec3(0.008, 0.012, 0.03), vec3(0.02, 0.05, 0.08), smoothstep(-0.2, 0.5, haze));

    // Cell signed distance.
    vec2 q = vec2(p.x / ${STRETCH_X.toFixed(2)}, p.y);
    float th = atan(q.y, q.x);
    float wob = 0.012 * sin(t * 0.7 + th * 4.0);
    float sd = length(q) - membraneR(th) - wob;

    // Ink inside: domain-warped currents with bright filaments along the ridges.
    vec2 w = p * 1.6;
    vec2 warp = vec2(fbm(w + vec2(0.0, t * 0.05)), fbm(w + vec2(5.2, 1.3) - t * 0.04));
    float ink = fbm(w + 2.6 * warp + t * 0.03);
    float ridge = 1.0 - abs(ink * 2.0);
    ridge = pow(clamp(ridge, 0.0, 1.0), 9.0);
    float inside = 1.0 - smoothstep(-0.02, 0.01, sd);
    vec3 cyto = mix(vec3(0.02, 0.10, 0.12), vec3(0.04, 0.22, 0.22), smoothstep(-0.3, 0.4, ink));
    cyto += ridge * mix(vec3(0.2, 0.95, 0.8), vec3(1.0, 0.75, 0.35), smoothstep(-0.2, 0.3, warp.x)) * 0.55;
    col = mix(col, cyto, inside);

    // Membrane: a glowing rim that breathes, and a halo outside.
    float rimN = 0.6 + 0.4 * fbm(vec2(th * 3.0, t * 0.2));
    col += vec3(1.0, 0.62, 0.3) * exp(-abs(sd) * 70.0) * 1.1 * rimN;
    col += vec3(1.0, 0.45, 0.2) * exp(-max(sd, 0.0) * 5.0) * 0.12 * (1.0 - inside);

    // Mitochondria: warm capsules with folded light inside.
    for (int i = 0; i < 7; i++) {
      vec4 m = uMito[i];
      vec2 dir = vec2(cos(m.z), sin(m.z));
      vec2 a = m.xy - dir * m.w * 0.5;
      vec2 b = m.xy + dir * m.w * 0.5;
      float d = sdSegment(p, a, b) - 0.055;
      float body = 1.0 - smoothstep(-0.005, 0.005, d);
      vec2 lp = p - m.xy;
      float u = dot(lp, dir);
      float v = dot(lp, vec2(-dir.y, dir.x));
      float folds = smoothstep(0.75, 1.0, sin(u * 70.0 + sin(v * 40.0 + t) * 0.6));
      vec3 mc = mix(vec3(0.35, 0.08, 0.06), vec3(1.0, 0.45, 0.25), 0.5 + 0.5 * fbm(lp * 18.0 + t * 0.2));
      mc += folds * vec3(1.0, 0.8, 0.55) * 0.6;
      col = mix(col, mc, body * 0.92);
      col += vec3(1.0, 0.5, 0.25) * exp(-abs(d) * 90.0) * 0.6;
    }

    // Nucleus: a deeper pool with speckled chromatin and its own envelope.
    vec2 pn = frag * scale + uMouse * 0.16;
    float dn = length(pn - uNucleus.xy) - uNucleus.z - 0.01 * sin(atan(pn.y - uNucleus.y, pn.x - uNucleus.x) * 6.0 + t * 0.5);
    float inN = 1.0 - smoothstep(-0.01, 0.01, dn);
    float chrom = fbm(pn * 14.0 + warp * 0.6 + t * 0.02);
    vec3 nc = mix(vec3(0.01, 0.03, 0.08), vec3(0.08, 0.22, 0.45), smoothstep(-0.1, 0.4, chrom));
    nc += pow(clamp(1.0 - abs(chrom * 3.0), 0.0, 1.0), 6.0) * vec3(0.3, 0.7, 1.0) * 0.5;
    col = mix(col, nc, inN);
    col += vec3(0.35, 0.8, 1.0) * exp(-abs(dn) * 80.0) * 0.9;
    float dnl = length(pn - uNucleolus.xy) - uNucleolus.z;
    col += vec3(0.75, 0.95, 1.0) * (exp(-max(dnl, 0.0) * 30.0) * 0.7 + (1.0 - smoothstep(-0.01, 0.01, dnl)) * 0.3);

    // Foreground dust drifting past.
    vec2 g = pNear * 9.0 + vec2(t * 0.05, t * 0.03);
    vec2 cellId = floor(g);
    vec2 h = hash2(cellId) * 0.5 + 0.5;
    float dust = smoothstep(0.08, 0.0, length(fract(g) - h)) * step(0.82, h.x);
    col += dust * vec3(0.6, 0.9, 1.0) * 0.25;

    // Colours above were picked by eye in display space; the pipeline expects linear.
    gl_FragColor = vec4(pow(max(col, 0.0), vec3(2.2)), 1.0);
  }
`;

export const tinta: Style = {
  id: 'tinta',
  name: 'Tinta viva',
  blurb: 'Una pintura que se mueve: corrientes de tinta, filamentos bioluminiscentes y brillos suaves. Orgánico y onírico.',
  mount(stage) {
    const uniforms = {
      uTime: { value: 0 },
      uScale: { value: 3 },
      uLift: { value: LIFT },
      uRes: { value: stage.size.clone() },
      uMouse: { value: new THREE.Vector2() },
      uMito: { value: MITOS.map((m) => new THREE.Vector4(m.x, m.y, m.angle, m.len)) },
      uNucleus: { value: new THREE.Vector3(NUCLEUS.x, NUCLEUS.y, NUCLEUS.r) },
      uNucleolus: { value: new THREE.Vector3(NUCLEOLUS.x, NUCLEOLUS.y, NUCLEOLUS.r) },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
      `,
      fragmentShader: FRAG,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    quad.frustumCulled = false;
    stage.rig.add(quad);

    stage.scene.background = new THREE.Color(0x000000);
    stage.renderer.toneMapping = THREE.NoToneMapping;
    stage.bloom.strength = 0.55;
    stage.bloom.radius = 0.6;
    stage.bloom.threshold = 0.25;
    stage.finish.uniforms.uGrain.value = 0.05;
    stage.finish.uniforms.uFringe.value = 0.015;

    return {
      update(f) {
        uniforms.uTime.value = f.time;
        uniforms.uScale.value = f.viewHeight;
        uniforms.uMouse.value.set(f.mouse.x, -f.mouse.y);
      },
      resize() {
        uniforms.uRes.value.copy(stage.size);
      },
    };
  },
};
