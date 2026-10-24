import * as THREE from 'three';
import { gauss } from '../../lib/math';
import { mountScreen, particleLook } from '../pantalla';
import { pointBuilder } from '../../lib/puntos';
import type { Style } from '../types';

/**
 * A carbon atom: a tight 1s core and four sp³ hybrid orbitals pointing to the corners of a
 * tetrahedron, as in methane or diamond. (Three full p orbitals would add up to a sphere.)
 * The nucleus is a hundred-thousandth of the atom, so it is drawn as barely a point.
 */

export const ATOMO_SHADE = /* glsl */ `
  vec3 lobeColor(int i) {
    if (i == 0) return vec3(1.0, 0.3, 0.7);
    if (i == 1) return vec3(0.3, 0.55, 1.0);
    if (i == 2) return vec3(0.2, 0.9, 0.85);
    return vec3(0.68, 0.42, 1.0);
  }

  vec3 shade(vec2 p, vec2 m) {
    float t = uTime;
    vec2 q = (p + m * 0.1) * 0.66;
    float r = length(q);

    // Far field: dark violet with a faint drifting haze and a few stars.
    float field = fbm(p * 0.8 + m * 0.03 + vec2(t * 0.01, 0.0));
    vec3 col = mix(vec3(0.012, 0.006, 0.028), vec3(0.04, 0.014, 0.075), smoothstep(-0.3, 0.6, field));
    col += vec3(0.7, 0.75, 1.0) * starField((p + m * 0.03) * 24.0, 0.05, t) * 0.25;

    // Wisps make the cloud read as ink; a fast fine shimmer says the electron is never still.
    vec2 w = q * 3.2;
    vec2 warp = vec2(fbm(w + t * 0.06), fbm(w + vec2(4.1, 2.7) - t * 0.05));
    float wisps = 0.45 + 1.0 * smoothstep(-0.35, 0.45, fbm(w * 1.4 + warp * 2.0));
    float shimmer = 0.8 + 0.4 * noise(q * 60.0 + vec2(t * 4.0, -t * 3.0));

    vec3 cloud = vec3(0.92, 0.85, 1.0) * exp(-r / 0.06) * 1.2;

    // Four sp³ lobes on a slowly tumbling tetrahedron, each with a small back lobe of opposite phase.
    vec3 dirs[4];
    dirs[0] = normalize(vec3(1.0, 1.0, 1.0));
    dirs[1] = normalize(vec3(1.0, -1.0, -1.0));
    dirs[2] = normalize(vec3(-1.0, 1.0, -1.0));
    dirs[3] = normalize(vec3(-1.0, -1.0, 1.0));
    float tilt = 0.4 + 0.25 * sin(t * 0.07);
    for (int i = 0; i < 4; i++) {
      vec3 d = rotX(rotY(dirs[i], t * 0.12), tilt);
      float L = length(d.xy);
      vec2 dn = L > 1e-3 ? d.xy / L : vec2(1.0, 0.0);
      vec2 dp = vec2(-dn.y, dn.x);
      // Foreshortening: a lobe pointing at us looks round and short.
      vec2 c = d.xy * 0.42;
      float sa = mix(0.13, 0.24, L);
      float along = dot(q - c, dn);
      float perp = dot(q - c, dp);
      float main = exp(-(along * along / (sa * sa) + perp * perp / (0.135 * 0.135)));
      vec2 cb = -d.xy * 0.1;
      float back = exp(-dot(q - cb, q - cb) / (0.06 * 0.06)) * 0.3;
      float facing = 1.0 + 0.35 * d.z;
      cloud += lobeColor(i) * main * 0.85 * facing + vec3(1.0, 0.6, 0.35) * back;
    }
    col += cloud * wisps * shimmer;

    // The nucleus.
    col += vec3(1.0, 0.92, 0.8) * exp(-r / 0.005) * 2.5;
    return col;
  }
`;

export const atomoTinta: Style = {
  id: 'atomo-tinta',
  name: 'Átomo',
  blurb: 'Un átomo de carbono pintado: cuatro nubes de probabilidad apuntan a las esquinas de un tetraedro, como en el diamante.',
  mount(stage) {
    return mountScreen(stage, ATOMO_SHADE, { bloom: [0.75, 0.6, 0.25], grain: 0.045, fringe: 0.016 });
  },
};

const LOBES: [dir: [number, number, number], color: number][] = [
  [[1, 1, 1], 0xff4fb0],
  [[1, -1, -1], 0x4f8cff],
  [[-1, 1, -1], 0x33e6d9],
  [[-1, -1, 1], 0xad6bff],
];

export const atomoPuntos: Style = {
  id: 'atomo-puntos',
  name: 'Átomo',
  blurb: 'Cada punto es una posición posible del electrón, muestreada de su orbital sp³. Por eso tiemblan.',
  mount(stage) {
    const b = pointBuilder(3);
    const { r } = b;
    const S = 0.13;
    const gamma = (k: number) => {
      let s = 0;
      for (let i = 0; i < k; i++) s -= Math.log(1 - r());
      return s;
    };

    // 1s: radial density r² e^{-2r}.
    for (let i = 0; i < 4000; i++) {
      const [x, y, z] = b.onSphere();
      const rad = (gamma(3) / 2) * S;
      b.push(x * rad, y * rad, z * rad, 0xe9dcff, 1.3, 0.01, 0.5);
    }
    // sp³: ψ ∝ ψ2s + √3 ψ2p along the lobe, sampled by rejection on the angular part.
    const k3 = Math.sqrt(3);
    for (const [[dx, dy, dz], color] of LOBES) {
      const n = Math.hypot(dx, dy, dz);
      for (let i = 0; i < 12000; i++) {
        let u: [number, number, number];
        let c = 0;
        do {
          u = b.onSphere();
          c = (u[0] * dx + u[1] * dy + u[2] * dz) / n;
          // Sharpened beyond the textbook shape so the four lobes stay legible.
        } while (r() > ((1 + k3 * c) / (1 + k3)) ** 6);
        const rad = (gamma(9) / 1.8) * S;
        const front = 1 + k3 * c > 0;
        b.push(u[0] * rad, u[1] * rad, u[2] * rad, front ? color : 0xffa060, 1.3, 0.014, front ? 0.7 : 0.5);
      }
    }
    // The nucleus.
    for (let i = 0; i < 40; i++) b.push(gauss(r) * 0.004, gauss(r) * 0.004, gauss(r) * 0.004, 0xffe2c0, 2.2, 0.0005, 1.2);

    const { points, mat } = b.build(stage.renderer.getPixelRatio());
    const group = new THREE.Group();
    group.add(points);
    stage.rig.add(group);

    // Background dust, outside the tumbling group.
    const bg = pointBuilder(4);
    for (let i = 0; i < 3000; i++) {
      const [x, y, z] = bg.onSphere();
      const k = 1.8 + bg.r() * 3;
      bg.push(x * k * 1.6, y * k, z * k - 1, 0x8f7bff, 1.1, 0.02, 0.15);
    }
    const dust = bg.build(stage.renderer.getPixelRatio());
    stage.rig.add(dust.points);

    particleLook(stage);
    return {
      update(f) {
        mat.uniforms.uTime.value = f.time;
        dust.mat.uniforms.uTime.value = f.time;
        group.rotation.y = f.time * 0.12;
        group.rotation.x = 0.4 + 0.25 * Math.sin(f.time * 0.07);
      },
    };
  },
};
