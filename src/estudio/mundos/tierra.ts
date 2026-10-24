import * as THREE from 'three';
import { mountScreen, particleLook } from '../pantalla';
import { rng } from '../../lib/math';
import { perlin3, pointBuilder } from '../../lib/puntos';
import type { Style } from '../types';

/**
 * A procedural Earth-like planet: oceans, continents, ice, clouds, atmosphere and city lights
 * on the night side. No textures; real NASA maps can replace the noise later.
 */

const R = 0.82;
const SUN = new THREE.Vector3(-0.9, 0.35, 0.55).normalize();

const SHADE = /* glsl */ `
  uniform vec3 uSun;
  vec3 shade(vec2 p, vec2 m) {
    float t = uTime;
    vec3 col = vec3(0.003, 0.004, 0.01);
    vec2 sp = p + m * 0.03;
    col += vec3(0.8, 0.85, 1.0) * starField(sp * 26.0, 0.07, t) * 0.45;

    vec2 q = p + m * 0.08;
    float R = ${R.toFixed(2)};
    float r = length(q);
    vec3 sun = normalize(uSun);

    if (r < R) {
      vec3 n = vec3(q / R, sqrt(max(0.0, 1.0 - r * r / (R * R))));
      vec3 pn = rotY(rotZ(n, 0.41), t * 0.04);

      // Terrain.
      float h = fbm3(pn * 1.8) + 0.25 * fbm3lo(pn * 6.0);
      float land = smoothstep(0.06, 0.1, h);
      float lat = abs(pn.y);
      vec3 ocean = mix(vec3(0.01, 0.05, 0.16), vec3(0.03, 0.15, 0.32), smoothstep(-0.25, 0.08, h));
      float moist = fbm3lo(pn * 3.0 + 7.0);
      vec3 landC = mix(vec3(0.08, 0.2, 0.07), vec3(0.5, 0.4, 0.24), smoothstep(-0.1, 0.25, moist) * smoothstep(0.6, 0.15, lat));
      landC = mix(landC, vec3(0.3, 0.27, 0.22), smoothstep(0.28, 0.45, h));
      vec3 surf = mix(ocean, landC, land);
      float ice = smoothstep(0.8, 0.86, lat + 0.06 * h);
      surf = mix(surf, vec3(0.86, 0.9, 0.95), ice);

      // Light.
      float ndl = dot(n, sun);
      float day = smoothstep(-0.12, 0.25, ndl);
      vec3 lit = surf * max(ndl, 0.0) * 1.25;
      vec3 hv = normalize(sun + vec3(0.0, 0.0, 1.0));
      lit += vec3(1.0, 0.9, 0.75) * pow(max(dot(n, hv), 0.0), 60.0) * (1.0 - land) * (1.0 - ice) * 0.8;

      // Clouds drift a little faster than the ground.
      vec3 cp = rotY(rotZ(n, 0.41), t * 0.055);
      float cl = smoothstep(0.16, 0.55, fbm3(cp * 2.4 + vec3(0.0, t * 0.01, 0.0)) + 0.15 * fbm3lo(cp * 9.0));
      lit = mix(lit, vec3(0.92, 0.94, 0.97) * max(ndl, 0.0) * 1.0 + vec3(0.015, 0.02, 0.04), cl * 0.85);

      // City lights on the night side.
      float city = smoothstep(0.25, 0.55, fbm3lo(pn * 14.0)) * land * (1.0 - ice) * smoothstep(0.75, 0.25, lat);
      vec3 night = vec3(1.0, 0.62, 0.28) * city * 1.3 * (1.0 - cl * 0.8);
      col = mix(night, lit, day);

      // A warm terminator and blue scattering towards the limb.
      col += vec3(1.0, 0.45, 0.2) * exp(-abs(ndl - 0.02) * 18.0) * 0.05;
      col += vec3(0.25, 0.5, 1.0) * pow(1.0 - n.z, 3.0) * max(ndl + 0.2, 0.0) * 0.5;
    }

    // Atmosphere rim, brighter on the day side.
    float rim = exp(-max(r - R, 0.0) * 46.0) * smoothstep(R - 0.025, R, r) * 0.7;
    float sunSide = 0.25 + 0.75 * smoothstep(-0.6, 0.8, dot(q / max(r, 1e-4), normalize(sun.xy)));
    col += vec3(0.3, 0.6, 1.0) * rim * sunSide;
    return col;
  }
`;

export const tierraTinta: Style = {
  id: 'tierra-tinta',
  name: 'Tierra',
  blurb: 'Océanos, nubes, hielo, atmósfera y luces de ciudades, todo procedural. Con mapas reales de la NASA sería nuestra Tierra.',
  mount(stage) {
    return mountScreen(stage, SHADE, { bloom: [0.5, 0.5, 0.45], grain: 0.035, fringe: 0.012 }, { uSun: { value: SUN.clone() } });
  },
};

const EARTH_VERT = /* glsl */ `
  attribute vec3 color;
  attribute float night;
  attribute float size;
  uniform float uPR, uScale;
  uniform vec3 uSun;
  varying vec3 vColor;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec3 wn = normalize(mat3(modelMatrix) * position);
    float ndl = dot(wn, uSun);
    float day = smoothstep(-0.12, 0.25, ndl);
    vColor = color * (0.035 + max(ndl, 0.0) * 1.3) + vec3(1.0, 0.62, 0.28) * night * (1.0 - day) * 1.6;
    vec4 mv = viewMatrix * wp;
    gl_PointSize = min(size * uPR * uScale / -mv.z, 32.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const EARTH_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, smoothstep(0.5, 0.15, d) * uOpacity);
  }
`;

export const tierraPuntos: Style = {
  id: 'tierra-puntos',
  name: 'Tierra',
  blurb: 'Un planeta puntillista: de lejos parece sólido; al acercarte (rueda), se deshace en puntos.',
  mount(stage) {
    const noise = perlin3(21);
    const rand = rng(23);
    const c = new THREE.Color();
    const pr = stage.renderer.getPixelRatio();

    const layer = (
      n: number,
      radius: (i: number) => number,
      paint: (x: number, y: number, z: number) => [hex: number, night: number] | null,
      size: number,
      opacity: number,
      blending: THREE.Blending,
      depthWrite: boolean,
    ) => {
      const pos: number[] = [];
      const col: number[] = [];
      const night: number[] = [];
      const sizes: number[] = [];
      const golden = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < n; i++) {
        const y = 1 - (2 * (i + 0.5)) / n;
        const rr = Math.sqrt(1 - y * y);
        const x = Math.cos(i * golden) * rr;
        const z = Math.sin(i * golden) * rr;
        const res = paint(x, y, z);
        if (!res) continue;
        const k = radius(i);
        pos.push(x * k, y * k, z * k);
        c.setHex(res[0]);
        col.push(c.r, c.g, c.b);
        night.push(res[1]);
        sizes.push(size);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setAttribute('night', new THREE.Float32BufferAttribute(night, 1));
      geo.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
      const mat = new THREE.ShaderMaterial({
        vertexShader: EARTH_VERT,
        fragmentShader: EARTH_FRAG,
        uniforms: { uPR: { value: pr }, uScale: { value: 3.2 }, uSun: { value: SUN.clone() }, uOpacity: { value: opacity } },
        transparent: true,
        depthWrite,
        blending,
      });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      return pts;
    };

    const surface = layer(
      170000,
      () => R,
      (x, y, z) => {
        const h = noise(x * 1.8, y * 1.8, z * 1.8) + 0.25 * noise(x * 6, y * 6, z * 6, 3);
        const lat = Math.abs(y);
        if (lat + 0.06 * h > 0.83) return [0xdfe8f0, 0];
        if (h < 0.08) return [h > -0.05 ? 0x174a85 : 0x0c2c62, 0];
        const moist = noise(x * 3 + 7, y * 3 + 7, z * 3 + 7, 3);
        const hex = h > 0.32 ? 0x6b5d4a : moist > 0.08 && lat < 0.5 ? 0xb39060 : 0x2f5a22;
        const city = noise(x * 14, y * 14, z * 14, 3) > 0.22 && lat < 0.72 ? 0.6 + rand() * 0.4 : 0;
        return [hex, city];
      },
      1.5,
      1,
      THREE.NormalBlending,
      true,
    );
    const clouds = layer(
      70000,
      () => R * 1.018,
      (x, y, z) => (noise(x * 2.4 + 5, y * 2.4, z * 2.4) + 0.15 * noise(x * 9, y * 9, z * 9, 3) > 0.14 ? [0xffffff, 0] : null),
      1.7,
      0.75,
      THREE.NormalBlending,
      false,
    );
    const atmo = layer(
      26000,
      () => R * (1.012 + Math.pow(rand(), 2.5) * 0.11),
      () => [0x4f86ff, 0],
      1.3,
      0.55,
      THREE.AdditiveBlending,
      false,
    );

    // A dark core that hides the far side of the planet.
    const core = new THREE.Mesh(new THREE.SphereGeometry(R * 0.985, 64, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));

    const ground = new THREE.Group();
    ground.add(surface);
    const sky = new THREE.Group();
    sky.add(clouds);
    const planet = new THREE.Group();
    planet.rotation.z = 0.41;
    planet.add(core, ground, sky, atmo);
    stage.rig.add(planet);

    const bg = pointBuilder(22);
    for (let i = 0; i < 3500; i++) {
      const [x, y, z] = bg.onSphere();
      const k = 2 + bg.r() * 3;
      bg.push(x * k * 1.6, y * k, z * k - 1.5, 0xc8d6ff, 1.2, 0, 0.25);
    }
    const stars = bg.build(pr);
    stage.rig.add(stars.points);

    particleLook(stage);
    stage.bloom.strength = 0.7;
    stage.bloom.threshold = 0.2;
    return {
      update(f) {
        stars.mat.uniforms.uTime.value = f.time;
        ground.rotation.y = f.time * 0.04;
        sky.rotation.y = f.time * 0.055;
      },
    };
  },
};
