import * as THREE from 'three';
import { MITOS, NUCLEOLUS, NUCLEUS, VESICLES, erPaths, golgiPaths, membranePoint, mitoCristae, mitoOutline } from '../../lib/cell';
import { rng } from '../../lib/math';
import type { Style } from '../types';

/**
 * Style 3: flat illustrated cut-outs stacked in depth, like a paper diorama.
 * Soft gradients and print grain; the parallax between layers carries the depth.
 */

const VERT = /* glsl */ `
  uniform float uTime, uWobble;
  varying vec2 vP;
  void main() {
    vec3 p = position;
    p.xy += uWobble * vec2(sin(uTime * 0.9 + p.y * 9.0), cos(uTime * 0.8 + p.x * 9.0));
    vP = p.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const FRAG = /* glsl */ `
  uniform vec3 uInner, uOuter;
  uniform vec2 uCenter;
  uniform float uRadius, uOpacity, uSoft;
  varying vec2 vP;
  void main() {
    float d = clamp(length(vP - uCenter) / uRadius, 0.0, 1.0);
    vec3 c = mix(uInner, uOuter, pow(d, 1.6));
    float a = uOpacity * (1.0 - smoothstep(1.0 - uSoft, 1.0, d) * step(0.001, uSoft));
    gl_FragColor = vec4(c, a);
  }
`;

type P2 = [number, number];

export const capas: Style = {
  id: 'capas',
  name: 'Capas ilustradas',
  blurb: 'Recortes planos con degradados suaves, apilados en profundidad como un diorama de papel. Cálido y editorial.',
  mount(stage) {
    const r = rng(5);
    const mats: THREE.ShaderMaterial[] = [];

    const mat = (inner: number, outer: number, center: P2, radius: number, opacity = 1, soft = 0, wobble = 0.004) => {
      const m = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: {
          uTime: { value: 0 },
          uWobble: { value: wobble },
          uInner: { value: new THREE.Color(inner) },
          uOuter: { value: new THREE.Color(outer) },
          uCenter: { value: new THREE.Vector2(...center) },
          uRadius: { value: radius },
          uOpacity: { value: opacity },
          uSoft: { value: soft },
        },
        transparent: true,
        depthWrite: false,
      });
      mats.push(m);
      return m;
    };

    let order = 0;
    const shape = (pts: P2[], z: number, m: THREE.Material) => {
      const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
      const mesh = new THREE.Mesh(new THREE.ShapeGeometry(s, 4), m);
      mesh.position.z = z;
      mesh.renderOrder = order++;
      stage.rig.add(mesh);
      return mesh;
    };

    /** A tapered ribbon along a polyline. */
    const ribbon = (pts: P2[], width: number, z: number, m: THREE.Material) => {
      const pos: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[Math.max(0, i - 1)];
        const b = pts[Math.min(pts.length - 1, i + 1)];
        let nx = -(b[1] - a[1]);
        let ny = b[0] - a[0];
        const l = Math.hypot(nx, ny) || 1;
        nx /= l;
        ny /= l;
        const w = (width / 2) * Math.pow(Math.sin((Math.PI * i) / (pts.length - 1)), 0.4);
        pos.push(pts[i][0] + nx * w, pts[i][1] + ny * w, 0, pts[i][0] - nx * w, pts[i][1] - ny * w, 0);
        if (i > 0) {
          const k = i * 2;
          idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.z = z;
      mesh.renderOrder = order++;
      stage.rig.add(mesh);
    };

    const loop = (f: (t: number) => P2, n: number) => {
      const pts: P2[] = [];
      for (let i = 0; i < n; i++) pts.push(f((i / n) * Math.PI * 2));
      return pts;
    };
    const circle = (x: number, y: number, rad: number, n = 48) => loop((t) => [x + Math.cos(t) * rad, y + Math.sin(t) * rad], n);
    const offset = (pts: P2[], dx: number, dy: number) => pts.map(([x, y]) => [x + dx, y + dy] as P2);
    const SHADOW = 0x0d0718;

    // Far halo.
    shape(circle(0, 0, 2.2, 96), -0.7, mat(0xff7a59, 0x0f0c1f, [0, 0], 2.2, 0.55, 0.6, 0));

    // Cell body: drop shadow, rim, cytoplasm.
    const body = loop((t) => membranePoint(t), 240);
    shape(offset(loop((t) => membranePoint(t, 1.02), 240), 0.05, -0.07), -0.32, mat(SHADOW, SHADOW, [0, 0], 1.2, 0.55, 0.15, 0.003));
    shape(loop((t) => membranePoint(t, 1.035), 240), -0.3, mat(0xffc2a0, 0xff8b6a, [-0.3, 0.4], 1.6, 1, 0, 0.003));
    shape(body, -0.28, mat(0x4a2550, 0x2a1638, [0.1, -0.1], 1.25, 1, 0, 0.003));

    // Reticulum and Golgi as soft ribbons.
    erPaths().forEach((p, i) => ribbon(p, 0.026, -0.2 + i * 0.01, mat(0x6fe3cf, 0x3fc1b0, [NUCLEUS.x, NUCLEUS.y], 0.7, 0.85)));
    golgiPaths().forEach((p, i) => ribbon(p, 0.032, -0.12 + i * 0.01, mat(0xffd977, 0xf2b84e, [0.3, -0.1], 0.4, 0.95)));

    // Mitochondria: shadow, body, cristae.
    MITOS.forEach((m, i) => {
      const z = -0.05 + (i % 3) * 0.04;
      shape(offset(loop((t) => mitoOutline(m, t, 1.05), 64), 0.02, -0.03), z - 0.005, mat(SHADOW, SHADOW, [m.x, m.y], 0.3, 0.4, 0.3));
      shape(loop((t) => mitoOutline(m, t), 64), z, mat(0xffb08a, 0xff7f5c, [m.x - 0.04, m.y + 0.04], 0.22));
      ribbon(mitoCristae(m), 0.014, z + 0.003, mat(0xfff0dd, 0xffe1c4, [m.x, m.y], 0.2, 0.95));
    });

    // Nucleus: shadow, envelope, body, nucleolus.
    shape(offset(circle(NUCLEUS.x, NUCLEUS.y, NUCLEUS.r * 1.02, 96), 0.03, -0.045), 0.06, mat(SHADOW, SHADOW, [NUCLEUS.x, NUCLEUS.y], 0.4, 0.5, 0.25));
    shape(circle(NUCLEUS.x, NUCLEUS.y, NUCLEUS.r * 1.04, 96), 0.07, mat(0xb9b2ff, 0x8a82f0, [NUCLEUS.x, NUCLEUS.y], 0.36));
    shape(circle(NUCLEUS.x, NUCLEUS.y, NUCLEUS.r, 96), 0.075, mat(0x5b5bd6, 0x2c2c7a, [NUCLEUS.x - 0.08, NUCLEUS.y + 0.08], 0.42));
    for (let i = 0; i < 14; i++) {
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * NUCLEUS.r * 0.75;
      const x = NUCLEUS.x + Math.cos(a) * d;
      const y = NUCLEUS.y + Math.sin(a) * d;
      if (Math.hypot(x - NUCLEOLUS.x, y - NUCLEOLUS.y) < NUCLEOLUS.r * 1.4) continue;
      const rad = 0.02 + r() * 0.03;
      shape(circle(x, y, rad, 24), 0.08, mat(0x7c7cf0, 0x5b5bd6, [x, y], rad, 0.6));
    }
    shape(circle(NUCLEOLUS.x, NUCLEOLUS.y, NUCLEOLUS.r, 48), 0.09, mat(0xefe8ff, 0xc9b8ff, [NUCLEOLUS.x - 0.02, NUCLEOLUS.y + 0.02], NUCLEOLUS.r));

    // Vesicles, closest to us.
    VESICLES.forEach((v, i) => {
      const z = 0.12 + (i % 4) * 0.03;
      const hex = i % 3 === 0 ? 0x6fe3cf : 0xfff1d6;
      shape(offset(circle(v.x, v.y, v.r, 24), 0.01, -0.014), z - 0.004, mat(SHADOW, SHADOW, [v.x, v.y], v.r, 0.4));
      shape(circle(v.x, v.y, v.r, 24), z, mat(0xffffff, hex, [v.x - v.r * 0.3, v.y + v.r * 0.3], v.r * 1.3));
    });

    // Out-of-focus motes in front for depth.
    for (let i = 0; i < 9; i++) {
      const x = (r() - 0.5) * 4;
      const y = (r() - 0.5) * 2.4;
      const rad = 0.06 + r() * 0.12;
      shape(circle(x, y, rad, 40), 0.9 + r() * 0.5, mat(0xffd6c0, 0xffd6c0, [x, y], rad, 0.1, 0.9, 0));
    }

    stage.scene.background = new THREE.Color(0x0f0c1f);
    stage.renderer.toneMapping = THREE.NoToneMapping;
    stage.bloom.strength = 0.18;
    stage.bloom.radius = 0.5;
    stage.bloom.threshold = 0.55;
    stage.finish.uniforms.uGrain.value = 0.085;
    stage.finish.uniforms.uFringe.value = 0.004;

    return {
      update(f) {
        for (const m of mats) m.uniforms.uTime.value = f.time;
      },
    };
  },
};
