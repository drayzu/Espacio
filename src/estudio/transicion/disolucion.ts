import * as THREE from 'three';
import { rng } from '../../lib/math';
import { inkQuad } from './shaders';

/**
 * Turns an ink world into particles. The world is captured into a small target; one particle per
 * texel takes its colour. A signed progress drives the motion:
 *   uS = 0      the particles lie exactly on the image, so swapping image for particles is invisible;
 *   uS -> +1    they keep expanding at the zoom's own rate and rise past the camera (dissolve);
 *   uS -> -1    they wait contracted and far behind, then arrive and settle into the image (assemble).
 */

const VERT = /* glsl */ `
  attribute vec2 aUv;
  attribute vec4 aRand;
  uniform sampler2D uTex;
  uniform float uS, uK, uViewH, uAspect, uDist, uPx, uTime, uGain, uFade;
  uniform vec2 uMouse;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 col = texture2D(uTex, aUv).rgb;
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float a = abs(uS);

    vec2 base = (aUv - 0.5) * vec2(uViewH * uAspect, uViewH);
    // Each particle zooms at its own speed around the true rate: that spread is what reads as depth.
    float speed = 0.75 + 0.5 * aRand.x;
    vec2 xy;
    float z;
    if (uS >= 0.0) {
      xy = base * exp(uS * uK * speed);
      z = uS * uDist * (0.12 + 0.85 * aRand.y);
    } else {
      // Arriving: scattered far behind, they rush forward (spreading out in perspective, like the zoom)
      // and gather into the image.
      float g = pow(a, 1.5);
      vec2 dir = vec2(cos(aRand.z * 6.2831 + 1.7), sin(aRand.z * 6.2831 + 1.7));
      xy = base * exp(uS * uK * speed * 0.35) + dir * g * uViewH * (0.6 + 2.4 * aRand.w);
      z = uS * uDist * (2.0 + 7.0 * aRand.y);
    }
    float ang = aRand.z * 6.2831 + uTime * (0.2 + 0.5 * aRand.w);
    xy += a * vec2(cos(ang), sin(ang)) * uViewH * 0.05 * (0.4 + aRand.w);
    xy += uMouse * z * 0.15;

    vec4 mv = modelViewMatrix * vec4(xy, z, 1.0);
    gl_Position = projectionMatrix * mv;
    float persp = uDist / max(-mv.z, 0.02);
    gl_PointSize = clamp(uPx * persp, 1.0, 90.0);

    // Dim particles drop out first, so the image breaks up into its brightest grains.
    float keep = smoothstep(a * 0.2, a * 0.2 + 0.06, sqrt(lum) * (0.8 + 0.4 * aRand.y));
    vColor = col * (uGain + a * 2.2);
    vAlpha = keep * (1.0 - smoothstep(0.82, 1.0, a)) * smoothstep(0.0, 0.25 * uDist, -mv.z) * uFade;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    gl_FragColor = vec4(vColor * exp(-dot(c, c) * 18.0) * vAlpha, 1.0);
  }
`;

export function createDissolve(shade: string, extra: Record<string, THREE.IUniform>, seed: number, rows = 170) {
  const capture = inkQuad(shade, extra, true);
  const captureScene = new THREE.Scene();
  captureScene.add(capture.mesh);
  const captureCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let rt: THREE.WebGLRenderTarget | null = null;
  let cols = 0;

  const uniforms = {
    uTex: { value: null as THREE.Texture | null },
    uS: { value: 0 },
    uK: { value: 1 },
    uViewH: { value: 2 },
    uAspect: { value: 1 },
    uDist: { value: 3 },
    uPx: { value: 4 },
    uTime: { value: 0 },
    uGain: { value: 1 },
    uFade: { value: 1 },
    uMouse: { value: new THREE.Vector2() },
  };
  const points = new THREE.Points(
    new THREE.BufferGeometry(),
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  points.frustumCulled = false;
  points.renderOrder = 2;

  function build(aspect: number) {
    const c = Math.round(rows * aspect);
    if (c === cols) return;
    cols = c;
    rt?.dispose();
    rt = new THREE.WebGLRenderTarget(cols * 2, rows * 2, { type: THREE.HalfFloatType, depthBuffer: false });
    uniforms.uTex.value = rt.texture;
    const n = rows * cols;
    const r = rng(seed);
    const uv = new Float32Array(n * 2);
    const rand = new Float32Array(n * 4);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        uv[k * 2] = (i + 0.5) / cols;
        uv[k * 2 + 1] = (j + 0.5) / rows;
      }
    }
    for (let k = 0; k < n * 4; k++) rand[k] = r();
    points.geometry.dispose();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 4));
    points.geometry = geo;
  }

  return {
    points,
    uniforms,
    /** The capture copy of the world: set its zoom and centre to the frame being dissolved. */
    world: capture.uniforms,
    resize(width: number, height: number, pixelRatio: number) {
      build(width / height);
      uniforms.uAspect.value = width / height;
      // Points overlap so that, at rest, their soft discs add back up to the image.
      uniforms.uPx.value = ((height * pixelRatio) / rows) * 2.4;
      capture.uniforms.uRes.value.set(width, height);
    },
    capture(renderer: THREE.WebGLRenderer) {
      if (!rt) return;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(captureScene, captureCam);
      renderer.setRenderTarget(prev);
    },
  };
}
