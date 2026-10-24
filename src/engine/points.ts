import * as THREE from 'three';
import { rng } from '../lib/math';

/**
 * Particles of light with a physical size, which can assemble and reveal.
 *
 * - Size: a point is `size * uSizeUnit` world units across, so it scales with its world. Below the
 *   minimum it keeps the minimum and dims by the area it lost; above the maximum it stays there
 *   (bokeh). A world keeps the same surface brightness at any scale, and nothing flickers.
 * - Assembly: each point travels from `aFrom` to its place as `uAssemble` goes 0 -> 1, starting
 *   after its own `aDelay` (0..1). Delays laid out by distance make waves.
 * - Reveal: a point appears once `uReveal` passes its `aDelay`. Delays laid along a path draw it.
 * - Light sources (stars, sunlit planets) are seen however small they are: they keep their
 *   brightness below a pixel instead of dimming by area.
 * - Flat worlds (a leaf, a landscape) can declare their surface normal (`uSurface`): seen edge on,
 *   their points would pile up into a glaring line, so they fade as the view grazes the surface.
 * - In a volume the camera flies through (a cloud of comets, the web of galaxies), points that come
 *   very close to the camera can fade away instead of swelling into a fog of discs (`uNear`, opt in:
 *   a surface seen from close above must not vanish). `uCamDist` is the camera's distance to the focus.
 */

const VERT = /* glsl */ `
  attribute vec3 color;
  attribute vec3 aFrom;
  attribute float size, seed, drift, flag, aDelay, aStar;
  uniform float uTime, uFocal, uMinPx, uMaxPx, uSizeUnit, uAlpha, uFlagAlpha, uGain, uCamDist, uNear;
  uniform float uAssemble, uReveal, uSpread, uFlyFade;
  uniform vec4 uSurface;
  varying vec3 vColor;
  void main() {
    float k = clamp((uAssemble * (1.0 + uSpread) - aDelay * uSpread), 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    vec3 p = mix(aFrom, position, k);
    p += drift * vec3(sin(uTime * 1.3 + seed * 17.0), cos(uTime * 1.1 + seed * 23.0), sin(uTime * 0.9 + seed * 31.0));

    float scale = length(modelMatrix[0].xyz);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float sz = size * uSizeUnit * scale * uFocal / max(-mv.z, 1e-4);
    float px = clamp(sz, uMinPx, uMaxPx);
    gl_PointSize = px;

    float dim = mix(min(1.0, (sz * sz) / (uMinPx * uMinPx)), 1.0, aStar);
    float shown = smoothstep(aDelay, aDelay + 0.04, uReveal * 1.04);
    float arrive = mix(1.0, smoothstep(0.0, 0.35, k), uFlyFade);
    if (uNear > 0.0 && uCamDist > 0.0) arrive *= mix(1.0, smoothstep(0.1, 0.4, -mv.z / uCamDist), uNear);
    if (uSurface.w > 0.0) {
      float facing = abs(dot(normalize(normalMatrix * uSurface.xyz), normalize(-mv.xyz)));
      arrive *= mix(1.0, smoothstep(0.04, 0.4, facing), uSurface.w);
    }
    vColor = color * uGain * dim * uAlpha * mix(1.0, uFlagAlpha, flag) * shown * arrive;
    // Nothing to draw: park it off screen so it costs no fill.
    if (vColor.r + vColor.g + vColor.b < 1e-4) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    gl_FragColor = vec4(vColor * exp(-dot(c, c) * 14.0), 1.0);
  }
`;

export interface CloudUniforms {
  uTime: THREE.IUniform<number>;
  uFocal: THREE.IUniform<number>;
  uMinPx: THREE.IUniform<number>;
  uMaxPx: THREE.IUniform<number>;
  uSizeUnit: THREE.IUniform<number>;
  uAlpha: THREE.IUniform<number>;
  uFlagAlpha: THREE.IUniform<number>;
  uGain: THREE.IUniform<number>;
  uAssemble: THREE.IUniform<number>;
  uReveal: THREE.IUniform<number>;
  /** How staggered assembly is: 0 all at once, larger spreads the delays further apart. */
  uSpread: THREE.IUniform<number>;
  /** 1: points fade in as they arrive (they come from nowhere). 0: always visible (they were already here). */
  uFlyFade: THREE.IUniform<number>;
  /** Local surface normal (xyz) and how strongly to fade at grazing angles (w, 0 = off). */
  uSurface: THREE.IUniform<THREE.Vector4>;
  /** The camera's distance to the focus. */
  uCamDist: THREE.IUniform<number>;
  /** 1: points very near the camera fade (for volumes flown through); 0: off. */
  uNear: THREE.IUniform<number>;
}

export interface Cloud {
  points: THREE.Points;
  u: CloudUniforms;
}

export interface PushOptions {
  /** Where the point starts before assembly. Defaults to its own place. */
  from?: [number, number, number];
  /** 0..1: when it assembles / appears. */
  delay?: number;
  /** Marks a stand-in a world can hide (see uFlagAlpha). */
  flag?: boolean;
  /** A light source: stays visible below a pixel. */
  star?: boolean;
}

/**
 * A cloud's raw data: plain typed arrays, so it can be generated in a worker and handed over
 * (transferred, not copied) to the main thread, which only wraps it in a geometry and a material.
 */
export interface PointsData {
  position: Float32Array;
  aFrom: Float32Array;
  color: Float32Array;
  size: Float32Array;
  seed: Float32Array;
  drift: Float32Array;
  flag: Float32Array;
  aDelay: Float32Array;
  aStar: Float32Array;
}

const ITEM: Record<keyof PointsData, number> = { position: 3, aFrom: 3, color: 3, size: 1, seed: 1, drift: 1, flag: 1, aDelay: 1, aStar: 1 };

/** Wraps generated data into a cloud (cheap: no per-point work). */
export function cloudFromData(data: PointsData, sizeUnit: number, gain: number): Cloud {
  const geo = new THREE.BufferGeometry();
  for (const key of Object.keys(ITEM) as (keyof PointsData)[]) geo.setAttribute(key, new THREE.BufferAttribute(data[key], ITEM[key]));
  const u: CloudUniforms = {
    uTime: { value: 0 },
    uFocal: { value: 1000 },
    uMinPx: { value: 1.6 },
    uMaxPx: { value: 22 },
    uSizeUnit: { value: sizeUnit },
    uAlpha: { value: 1 },
    uFlagAlpha: { value: 1 },
    uGain: { value: gain },
    uAssemble: { value: 1 },
    uReveal: { value: 1 },
    uSpread: { value: 1.5 },
    uFlyFade: { value: 0 },
    uSurface: { value: new THREE.Vector4(0, 0, 1, 0) },
    uCamDist: { value: 0 },
    uNear: { value: 0 },
  };
  const points = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: u as unknown as Record<string, THREE.IUniform>,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  points.frustumCulled = false;
  return { points, u };
}

/**
 * Adds a displacement to a cloud's points: `glsl` runs on the point's position `p` (after
 * assembly, before projection) and may read `uTime` and the float `uniforms` it declares here.
 * For motion with a physical reason, like a crown swaying in the wind.
 */
export function warp(cloud: Cloud, glsl: string, uniforms: Record<string, THREE.IUniform<number>>) {
  const mat = cloud.points.material as THREE.ShaderMaterial;
  const decl = Object.keys(uniforms)
    .map((k) => `uniform float ${k};`)
    .join('\n');
  mat.vertexShader = mat.vertexShader
    .replace('varying vec3 vColor;', `varying vec3 vColor;\n${decl}`)
    .replace('vec3 p = mix(aFrom, position, k);', `vec3 p = mix(aFrom, position, k);\n${glsl}`);
  Object.assign(mat.uniforms, uniforms);
}

/** Collects points; `data()` hands them over as typed arrays. */
export function cloudBuilder(seed: number) {
  const r = rng(seed);
  const pos: number[] = [];
  const from: number[] = [];
  const col: number[] = [];
  const size: number[] = [];
  const seeds: number[] = [];
  const drift: number[] = [];
  const flags: number[] = [];
  const delay: number[] = [];
  const star: number[] = [];
  const c = new THREE.Color();

  return {
    r,
    get count() {
      return pos.length / 3;
    },
    onSphere(): [number, number, number] {
      const u = r() * 2 - 1;
      const a = r() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      return [Math.cos(a) * s, Math.sin(a) * s, u];
    },
    /** `light` scales the colour, with ±25 % natural variation; `s` the size, with ±40 %. */
    push(x: number, y: number, z: number, hex: number, s: number, d: number, light = 1, o: PushOptions = {}) {
      pos.push(x, y, z);
      const f = o.from ?? [x, y, z];
      from.push(f[0], f[1], f[2]);
      c.setHex(hex).multiplyScalar(light * (0.75 + r() * 0.5));
      col.push(c.r, c.g, c.b);
      size.push(s * (0.6 + r() * 0.8));
      seeds.push(r());
      drift.push(d);
      flags.push(o.flag ? 1 : 0);
      delay.push(o.delay ?? 0);
      star.push(o.star ? 1 : 0);
    },
    data(): PointsData {
      const f = (a: number[]) => new Float32Array(a);
      return { position: f(pos), aFrom: f(from), color: f(col), size: f(size), seed: f(seeds), drift: f(drift), flag: f(flags), aDelay: f(delay), aStar: f(star) };
    },
  };
}
