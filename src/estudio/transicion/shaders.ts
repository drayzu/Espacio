import * as THREE from 'three';
import { MITOS, NUCLEOLUS, NUCLEUS, STRETCH_X } from '../../lib/cell';
import { NOISE_GLSL, SIMPLEX3_GLSL } from '../../lib/glsl';

/**
 * Living-ink worlds that can be zoomed: p = uCenter + frag * uView / uZoom.
 * The same shader renders on screen (additive, faded by uOpacity) and into a small target that
 * the dissolve particles sample their colours from.
 */

export const CELL_SHADE = /* glsl */ `
  uniform vec4 uMito[7];
  uniform vec3 uNucleus, uNucleolus;

  float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }

  vec3 shade(vec2 P, vec2 m) {
    float t = uTime;
    vec2 pFar = P + m * 0.05;
    vec2 p = P + m * 0.12;
    vec2 pNear = P + m * 0.2;
    vec2 pn = P + m * 0.16;

    float haze = fbm(pFar * 0.7 + vec2(t * 0.01, -t * 0.013));
    vec3 col = mix(vec3(0.008, 0.012, 0.03), vec3(0.02, 0.05, 0.08), smoothstep(-0.2, 0.5, haze));

    vec2 q = vec2(p.x / ${STRETCH_X.toFixed(2)}, p.y);
    float th = atan(q.y, q.x);
    float sd = length(q) - membraneR(th) - 0.012 * sin(t * 0.7 + th * 4.0);

    vec2 w = p * 1.6;
    vec2 warp = vec2(fbm(w + vec2(0.0, t * 0.05)), fbm(w + vec2(5.2, 1.3) - t * 0.04));
    float ink = fbm(w + 2.6 * warp + t * 0.03);
    float ridge = pow(clamp(1.0 - abs(ink * 2.0), 0.0, 1.0), 9.0);
    float inside = 1.0 - smoothstep(-0.02, 0.01, sd);
    vec3 cyto = mix(vec3(0.02, 0.10, 0.12), vec3(0.04, 0.22, 0.22), smoothstep(-0.3, 0.4, ink));
    cyto += ridge * mix(vec3(0.2, 0.95, 0.8), vec3(1.0, 0.75, 0.35), smoothstep(-0.2, 0.3, warp.x)) * 0.55;
    col = mix(col, cyto, inside);

    float rimN = 0.6 + 0.4 * fbm(vec2(th * 3.0, t * 0.2));
    col += vec3(1.0, 0.62, 0.3) * exp(-abs(sd) * 70.0) * 1.1 * rimN;
    col += vec3(1.0, 0.45, 0.2) * exp(-max(sd, 0.0) * 5.0) * 0.12 * (1.0 - inside);

    for (int i = 0; i < 7; i++) {
      vec4 mi = uMito[i];
      vec2 dir = vec2(cos(mi.z), sin(mi.z));
      float d = sdSegment(p, mi.xy - dir * mi.w * 0.5, mi.xy + dir * mi.w * 0.5) - 0.055;
      float body = 1.0 - smoothstep(-0.005, 0.005, d);
      vec2 lp = p - mi.xy;
      float u = dot(lp, dir);
      float v = dot(lp, vec2(-dir.y, dir.x));
      float folds = smoothstep(0.75, 1.0, sin(u * 70.0 + sin(v * 40.0 + t) * 0.6));
      vec3 mc = mix(vec3(0.35, 0.08, 0.06), vec3(1.0, 0.45, 0.25), 0.5 + 0.5 * fbm(lp * 18.0 + t * 0.2));
      mc += folds * vec3(1.0, 0.8, 0.55) * 0.6;
      col = mix(col, mc, body * 0.92);
      col += vec3(1.0, 0.5, 0.25) * exp(-abs(d) * 90.0) * 0.6;
    }

    // Nucleus. Closer in, the chromatin resolves into fine threads: detail appears as you zoom.
    // Glows are tuned for the whole cell; zoomed in they would swallow the screen.
    float gz = mix(1.0, 0.3, smoothstep(1.0, 8.0, uZoom));
    float na = atan(pn.y - uNucleus.y, pn.x - uNucleus.x);
    float dn = length(pn - uNucleus.xy) - uNucleus.z - 0.014 * fbm(vec2(na * 1.5, t * 0.15));
    float inN = 1.0 - smoothstep(-0.01, 0.01, dn);
    float chrom = fbm(pn * 14.0 + warp * 0.6 + t * 0.02);
    vec3 nc = mix(vec3(0.01, 0.03, 0.08), mix(vec3(0.08, 0.22, 0.45), vec3(0.04, 0.12, 0.27), smoothstep(1.5, 6.0, uZoom)), smoothstep(-0.1, 0.4, chrom));
    nc += pow(clamp(1.0 - abs(chrom * 3.0), 0.0, 1.0), 6.0) * vec3(0.3, 0.7, 1.0) * 0.5;
    float fine = smoothstep(1.5, 6.0, uZoom);
    vec2 wf = vec2(fbm(pn * 30.0 + t * 0.04), fbm(pn * 30.0 + vec2(3.1, 7.7) - t * 0.03));
    float threads = pow(clamp(1.0 - abs(fbm(pn * 55.0 + wf * 1.6) * 2.4), 0.0, 1.0), 7.0);
    float speck = smoothstep(0.2, 0.55, fbm(pn * 170.0 - t * 0.05));
    nc += (threads * vec3(0.35, 0.8, 1.0) * 0.45 + speck * vec3(0.55, 0.85, 1.0) * 0.12) * fine;
    col = mix(col, nc, inN);
    col += vec3(0.35, 0.8, 1.0) * exp(-abs(dn) * 80.0 * (1.0 + 0.4 * uZoom)) * 0.9;
    float dnl = length(pn - uNucleolus.xy) - uNucleolus.z;
    col += vec3(0.75, 0.95, 1.0) * (exp(-max(dnl, 0.0) * 30.0 * (1.0 + 0.6 * uZoom)) * 0.7 * gz + (1.0 - smoothstep(-0.01, 0.01, dnl)) * 0.3);

    vec2 g = pNear * 9.0 + vec2(t * 0.05, t * 0.03);
    vec2 h = hash2(floor(g)) * 0.5 + 0.5;
    col += smoothstep(0.08, 0.0, length(fract(g) - h)) * step(0.82, h.x) * vec3(0.6, 0.9, 1.0) * 0.25;
    return col;
  }
`;

export const CELL_UNIFORMS = () => ({
  uMito: { value: MITOS.map((m) => new THREE.Vector4(m.x, m.y, m.angle, m.len)) },
  uNucleus: { value: new THREE.Vector3(NUCLEUS.x, NUCLEUS.y, NUCLEUS.r) },
  uNucleolus: { value: new THREE.Vector3(NUCLEOLUS.x, NUCLEOLUS.y, NUCLEOLUS.r) },
});

export type InkUniforms = {
  uTime: THREE.IUniform<number>;
  uRes: THREE.IUniform<THREE.Vector2>;
  uMouse: THREE.IUniform<THREE.Vector2>;
  uView: THREE.IUniform<number>;
  uZoom: THREE.IUniform<number>;
  uCenter: THREE.IUniform<THREE.Vector2>;
  uOpacity: THREE.IUniform<number>;
};

/** A full-screen quad running one ink world. `capture` renders opaque into a target instead of adding to the screen. */
export function inkQuad(shade: string, extra: Record<string, THREE.IUniform>, capture: boolean) {
  const uniforms: InkUniforms & Record<string, THREE.IUniform> = {
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2() },
    uView: { value: 3 },
    uZoom: { value: 1 },
    uCenter: { value: new THREE.Vector2() },
    uOpacity: { value: 1 },
    ...extra,
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uView, uZoom, uOpacity;
      uniform vec2 uRes, uMouse, uCenter;
      varying vec2 vUv;
      ${NOISE_GLSL}
      ${SIMPLEX3_GLSL}
      ${shade}
      void main() {
        vec2 frag = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
        vec2 p = uCenter + frag * uView / uZoom;
        vec3 col = shade(p, uMouse / uZoom);
        gl_FragColor = vec4(pow(max(col, 0.0), vec3(2.2)) * uOpacity, 1.0);
      }
    `,
    uniforms,
    depthTest: false,
    depthWrite: false,
    blending: capture ? THREE.NoBlending : THREE.AdditiveBlending,
    transparent: !capture,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}
