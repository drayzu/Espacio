import * as THREE from 'three';

/**
 * Points with a physical size. A point is `size * uSizeUnit` world units across, so it grows and
 * shrinks with its world. Below the minimum it stays at the minimum and dims by the area it lost;
 * above the maximum it stays at the maximum (bokeh). Either way a world keeps the same surface
 * brightness at any scale, and nothing flickers as it shrinks.
 */

const VERT = /* glsl */ `
  attribute vec3 color;
  attribute float size;
  attribute float seed;
  attribute float drift;
  attribute float flag;
  uniform float uTime, uFocal, uMinPx, uMaxPx, uSizeUnit, uAlpha, uFlagAlpha, uGain;
  varying vec3 vColor;
  void main() {
    float scale = length(modelMatrix[0].xyz);
    vec3 p = position + drift * vec3(sin(uTime * 1.3 + seed * 17.0), cos(uTime * 1.1 + seed * 23.0), sin(uTime * 0.9 + seed * 31.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float sz = size * uSizeUnit * scale * uFocal / max(-mv.z, 1e-4);
    float px = clamp(sz, uMinPx, uMaxPx);
    gl_PointSize = px;
    float dim = min(1.0, (sz * sz) / (uMinPx * uMinPx));
    vColor = color * uGain * dim * uAlpha * mix(1.0, uFlagAlpha, flag);
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    gl_FragColor = vec4(vColor * exp(-dot(c, c) * 14.0), 1.0);
  }
`;

export interface WorldPointUniforms {
  uTime: THREE.IUniform<number>;
  uFocal: THREE.IUniform<number>;
  uMinPx: THREE.IUniform<number>;
  uMaxPx: THREE.IUniform<number>;
  uSizeUnit: THREE.IUniform<number>;
  uAlpha: THREE.IUniform<number>;
  uFlagAlpha: THREE.IUniform<number>;
  uGain: THREE.IUniform<number>;
}

export function worldPoints(geometry: THREE.BufferGeometry, sizeUnit: number, gain: number) {
  const uniforms: WorldPointUniforms = {
    uTime: { value: 0 },
    uFocal: { value: 1000 },
    uMinPx: { value: 1.6 },
    uMaxPx: { value: 22 },
    uSizeUnit: { value: sizeUnit },
    uAlpha: { value: 1 },
    uFlagAlpha: { value: 1 },
    uGain: { value: gain },
  };
  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  points.frustumCulled = false;
  return { points, uniforms };
}
