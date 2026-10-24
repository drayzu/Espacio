import * as THREE from 'three';
import { NOISE_GLSL, SIMPLEX3_GLSL } from '../lib/glsl';
import { LIFT, type Stage } from './stage';
import type { StyleInstance } from './types';

/**
 * A full-screen "living ink" canvas. Each world supplies only `vec3 shade(vec2 p, vec2 m)`:
 * p is in world units with the subject at the origin (radius about 1), m is the smoothed mouse.
 * Colours are chosen by eye in display space and converted to linear here.
 */

export interface Look {
  bloom: [strength: number, radius: number, threshold: number];
  grain: number;
  fringe: number;
}

export function mountScreen(stage: Stage, shade: string, look: Look, extra: Record<string, THREE.IUniform> = {}) {
  const uniforms = {
    uTime: { value: 0 },
    uScale: { value: 3 },
    uLift: { value: LIFT },
    uMouse: { value: new THREE.Vector2() },
    uRes: { value: stage.size.clone() },
    ...extra,
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uScale, uLift;
      uniform vec2 uMouse, uRes;
      varying vec2 vUv;
      ${NOISE_GLSL}
      ${SIMPLEX3_GLSL}
      ${shade}
      void main() {
        vec2 frag = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
        vec2 p = frag * uScale - vec2(0.0, uLift);
        vec3 col = shade(p, uMouse);
        gl_FragColor = vec4(pow(max(col, 0.0), vec3(2.2)), 1.0);
      }
    `,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false;
  stage.rig.add(quad);

  stage.scene.background = new THREE.Color(0x000000);
  stage.renderer.toneMapping = THREE.NoToneMapping;
  [stage.bloom.strength, stage.bloom.radius, stage.bloom.threshold] = look.bloom;
  stage.finish.uniforms.uGrain.value = look.grain;
  stage.finish.uniforms.uFringe.value = look.fringe;

  const instance: StyleInstance & { uniforms: typeof uniforms } = {
    uniforms,
    update(f) {
      uniforms.uTime.value = f.time;
      uniforms.uScale.value = f.viewHeight;
      uniforms.uMouse.value.set(f.mouse.x, f.mouse.y);
    },
    resize() {
      uniforms.uRes.value.copy(stage.size);
    },
  };
  return instance;
}

/** Look shared by the particle worlds. */
export function particleLook(stage: Stage) {
  stage.scene.background = new THREE.Color(0x030308);
  stage.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  stage.renderer.toneMappingExposure = 1.1;
  stage.bloom.strength = 1.05;
  stage.bloom.radius = 0.7;
  stage.bloom.threshold = 0.05;
  stage.finish.uniforms.uGrain.value = 0.035;
  stage.finish.uniforms.uFringe.value = 0.02;
}
