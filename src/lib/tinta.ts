import { NOISE_GLSL } from './glsl';

/**
 * The ink medium of a cell: deep background currents, cytoplasm with faint bioluminescent ridges
 * and a darker nucleoplasm. Drawn on a plane in cell units (vP), soft-edged so particles own the
 * outlines. Uniforms: uTime, uOpacity, uNucleus (x, y, r).
 */
export const MEDIUM_FRAG = /* glsl */ `
  uniform float uTime, uOpacity;
  uniform vec3 uNucleus;
  varying vec2 vP;
  ${NOISE_GLSL}
  void main() {
    vec2 p = vP;
    float t = uTime;

    // Deep background currents.
    float haze = fbm(p * 0.6 + vec2(t * 0.01, -t * 0.012));
    vec3 col = mix(vec3(0.006, 0.01, 0.025), vec3(0.02, 0.045, 0.07), smoothstep(-0.2, 0.5, haze));

    // Cytoplasm: domain-warped ink with faint bioluminescent ridges. Soft-edged, so the points own the outline.
    vec2 q = vec2(p.x / 1.08, p.y);
    float sd = length(q) - membraneR(atan(q.y, q.x));
    vec2 w = p * 1.6;
    vec2 warp = vec2(fbm(w + vec2(0.0, t * 0.05)), fbm(w + vec2(5.2, 1.3) - t * 0.04));
    float ink = fbm(w + 2.6 * warp + t * 0.03);
    float ridge = pow(clamp(1.0 - abs(ink * 2.0), 0.0, 1.0), 9.0);
    float inside = 1.0 - smoothstep(-0.12, 0.02, sd);
    vec3 cyto = mix(vec3(0.015, 0.07, 0.085), vec3(0.03, 0.17, 0.18), smoothstep(-0.3, 0.4, ink));
    cyto += ridge * mix(vec3(0.15, 0.8, 0.68), vec3(0.95, 0.62, 0.3), smoothstep(-0.2, 0.3, warp.x)) * 0.3;
    col = mix(col, cyto, inside);
    col += vec3(1.0, 0.5, 0.22) * exp(-max(sd, 0.0) * 4.0) * 0.08 * (1.0 - inside);

    // Nucleoplasm: a darker pool with slow chromatin currents.
    float dn = length(p - uNucleus.xy) - uNucleus.z;
    float inN = 1.0 - smoothstep(-0.07, 0.01, dn);
    float chrom = fbm(p * 12.0 + warp * 0.6 + t * 0.02);
    vec3 nc = mix(vec3(0.01, 0.03, 0.07), vec3(0.05, 0.16, 0.32), smoothstep(-0.1, 0.4, chrom));
    nc += pow(clamp(1.0 - abs(chrom * 3.0), 0.0, 1.0), 6.0) * vec3(0.25, 0.6, 1.0) * 0.25;
    col = mix(col, nc, inN * 0.9);

    gl_FragColor = vec4(pow(col, vec3(2.2)) * 0.85 * uOpacity, 1.0);
  }
`;
