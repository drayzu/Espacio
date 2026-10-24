import * as THREE from 'three';
import { MITOS, NUCLEOLUS, NUCLEUS, STRETCH_X, VESICLES, erPaths, golgiPaths, membraneR } from '../../lib/cell';
import { gauss, rng } from '../../lib/math';
import { POINT_FRAG as FRAG, POINT_VERT as VERT } from '../../lib/puntos';
import type { Style } from '../types';

/**
 * Style 1: everything is made of points of light.
 * The same grammar works at every scale: a probability cloud, a cell, a galaxy, the cosmic web.
 */

/** The whole cell as one cloud of points. Shared by the particle styles. */
export function createCellPoints(pixelRatio: number, { dust = true } = {}) {
  const r = rng(11);
  const pos: number[] = [];
  const col: number[] = [];
  const size: number[] = [];
  const seed: number[] = [];
  const drift: number[] = [];
  const c = new THREE.Color();

  const push = (x: number, y: number, z: number, hex: number, s: number, d: number, light = 1) => {
    pos.push(x, y, z);
    c.setHex(hex).multiplyScalar(light * (0.75 + r() * 0.5));
    col.push(c.r, c.g, c.b);
    size.push(s * (0.6 + r() * 0.8));
    seed.push(r());
    drift.push(d);
  };

  const onSphere = () => {
    const u = r() * 2 - 1;
    const a = r() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return [Math.cos(a) * s, Math.sin(a) * s, u] as const;
  };

  // Membrane: a flattened, slightly lumpy shell, dense at the rim.
  for (let i = 0; i < 70000; i++) {
    const [x, y, z] = onSphere();
    const th = Math.atan2(y, x);
    const rad = membraneR(th) * (1 - Math.abs(gauss(r)) * 0.014);
    push(x * rad * STRETCH_X, y * rad, z * rad * 0.42, 0xffa24a, 1.5, 0.002, 0.42);
  }
  // Outer glycocalyx haze.
  for (let i = 0; i < 9000; i++) {
    const [x, y, z] = onSphere();
    const rad = membraneR(Math.atan2(y, x)) * (1.02 + Math.abs(gauss(r)) * 0.05);
    push(x * rad * STRETCH_X, y * rad, z * rad * 0.42, 0xff7a3a, 1.1, 0.006, 0.25);
  }
  // Cytoplasm: sparse drifting dust.
  for (let i = 0; i < 16000; i++) {
    const [x, y, z] = onSphere();
    const k = Math.cbrt(r()) * 0.94 * membraneR(Math.atan2(y, x));
    push(x * k * STRETCH_X, y * k, z * k * 0.4, 0x6fe0a0, 1.0, 0.012, 0.22);
  }
  // Nucleus: envelope plus clumped chromatin.
  for (let i = 0; i < 22000; i++) {
    const [x, y, z] = onSphere();
    const k = NUCLEUS.r * (1 + gauss(r) * 0.008);
    push(NUCLEUS.x + x * k, NUCLEUS.y + y * k, z * k * 0.75, 0x47e6c8, 1.4, 0.0015, 0.45);
  }
  for (let cl = 0; cl < 70; cl++) {
    const [x, y, z] = onSphere();
    const k = Math.cbrt(r()) * NUCLEUS.r * 0.85;
    const cx = NUCLEUS.x + x * k;
    const cy = NUCLEUS.y + y * k;
    const cz = z * k * 0.75;
    for (let i = 0; i < 160; i++) {
      push(cx + gauss(r) * 0.028, cy + gauss(r) * 0.028, cz + gauss(r) * 0.02, 0x2fb8d6, 1.1, 0.003, 0.4);
    }
  }
  for (let i = 0; i < 3000; i++) {
    const [x, y, z] = onSphere();
    const k = Math.cbrt(r()) * NUCLEOLUS.r;
    push(NUCLEOLUS.x + x * k, NUCLEOLUS.y + y * k, z * k, 0xd8fff6, 1.4, 0.002, 0.28);
  }
  // Mitochondria: shells with a folded core.
  for (const m of MITOS) {
    const ca = Math.cos(m.angle);
    const sa = Math.sin(m.angle);
    const mz = (r() - 0.5) * 0.3;
    const put = (lx: number, ly: number, lz: number, hex: number, s: number, light: number) =>
      push(m.x + lx * ca - ly * sa, m.y + lx * sa + ly * ca, mz + lz, hex, s, 0.002, light);
    for (let i = 0; i < 3200; i++) {
      const [x, y, z] = onSphere();
      put((x * m.len) / 2, y * m.r, z * m.r, 0xff6a4d, 1.2, 0.5);
    }
    for (let i = 0; i < 900; i++) {
      const u = r() - 0.5;
      const half = Math.sqrt(Math.max(0, 1 - (u / 0.5) ** 2)) * m.r * 0.8;
      const ly = Math.sin(u * 48) * half;
      put(u * m.len * 0.92, ly, gauss(r) * m.r * 0.4, 0xffc39a, 1.1, 0.55);
    }
  }
  // Endoplasmic reticulum and Golgi: thin sheets sampled along their curves.
  const sheet = (paths: [number, number][][], n: number, hex: number, light: number, depth: number) => {
    for (const path of paths) {
      for (let i = 0; i < n; i++) {
        const f = r() * (path.length - 1);
        const j = Math.floor(f);
        const t = f - j;
        const a = path[j];
        const b = path[Math.min(j + 1, path.length - 1)];
        const zz = gauss(r) * depth;
        push(a[0] + (b[0] - a[0]) * t + gauss(r) * 0.004, a[1] + (b[1] - a[1]) * t + gauss(r) * 0.004, zz, hex, 1.1, 0.002, light);
      }
    }
  };
  sheet(erPaths(), 3000, 0x7cf08a, 0.38, 0.12);
  sheet(golgiPaths(), 1400, 0xffd36a, 0.45, 0.025);
  // Vesicles.
  for (const v of VESICLES) {
    const vz = (r() - 0.5) * 0.4;
    for (let i = 0; i < 260; i++) {
      const [x, y, z] = onSphere();
      push(v.x + x * v.r, v.y + y * v.r, vz + z * v.r, 0xfff0c2, 1.2, 0.003, 0.6);
    }
  }
  // Far dust for depth.
  for (let i = 0; i < (dust ? 4000 : 0); i++) {
    const [x, y, z] = onSphere();
    const k = 1.6 + r() * 3;
    push(x * k * 1.6, y * k, z * k - 1, 0x9fb4ff, 1.2, 0.02, 0.18);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.Float32BufferAttribute(size, 1));
  geo.setAttribute('seed', new THREE.Float32BufferAttribute(seed, 1));
  geo.setAttribute('drift', new THREE.Float32BufferAttribute(drift, 1));
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 0 },
      uPR: { value: pixelRatio },
      uScale: { value: 3.2 },
      uGain: { value: 1 },
      uTwinkle: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat };
}

export const particulas: Style = {
  id: 'particulas',
  name: 'Partículas de luz',
  blurb: 'Todo está hecho de puntos de luz. La misma gramática sirve para un átomo, una célula y una galaxia.',
  mount(stage) {
    const { points, mat } = createCellPoints(stage.renderer.getPixelRatio());
    stage.rig.add(points);

    stage.scene.background = new THREE.Color(0x030308);
    stage.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    stage.renderer.toneMappingExposure = 1.1;
    stage.bloom.strength = 1.05;
    stage.bloom.radius = 0.7;
    stage.bloom.threshold = 0.05;
    stage.finish.uniforms.uGrain.value = 0.035;
    stage.finish.uniforms.uFringe.value = 0.02;

    return {
      update(f) {
        mat.uniforms.uTime.value = f.time;
        points.rotation.z = f.time * 0.012;
      },
    };
  },
};
