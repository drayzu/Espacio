import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import type { Pass } from 'three/addons/postprocessing/Pass.js';

/** The subject sits a little above centre, clear of the dock. */
export const LIFT = 0.14;

/** Grain, vignette and a touch of lens fringing, applied after tone mapping. */
const FinishShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uGrain: { value: 0.05 },
    uVignette: { value: 0.6 },
    uFringe: { value: 0.012 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uFringe;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec2 c = vUv - 0.5;
      vec2 off = c * dot(c, c) * uFringe;
      vec3 col = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      float v = smoothstep(0.95, 0.2, length(c * vec2(uRes.x / uRes.y, 1.0)));
      col *= mix(1.0, v, uVignette);
      col += (hash(vUv * uRes + fract(uTime * 7.0) * 311.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Everything a style draws goes in here; it tilts with the mouse. */
  rig: THREE.Group;
  bloom: UnrealBloomPass;
  finish: ShaderPass;
  size: THREE.Vector2;
  render(time: number): void;
  resize(): void;
}

/** `prePasses` run on the scene in linear light, before bloom. */
export function createStage(canvas: HTMLCanvasElement, { prePasses = [] as Pass[] } = {}): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio, 1.75);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
  camera.position.set(0, 0, 4.2);
  const rig = new THREE.Group();
  rig.position.y = LIFT;
  scene.add(rig);

  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(dpr);
  composer.addPass(new RenderPass(scene, camera));
  for (const p of prePasses) composer.addPass(p);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.6, 0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FinishShader);
  composer.addPass(finish);

  const size = new THREE.Vector2();

  function resize() {
    size.set(innerWidth, innerHeight);
    renderer.setSize(size.x, size.y, false);
    composer.setSize(size.x, size.y);
    camera.aspect = size.x / size.y;
    camera.updateProjectionMatrix();
    finish.uniforms.uRes.value.set(size.x * dpr, size.y * dpr);
  }
  resize();

  return {
    renderer,
    scene,
    camera,
    rig,
    bloom,
    finish,
    size,
    resize,
    render(time) {
      finish.uniforms.uTime.value = time;
      composer.render();
    },
  };
}

/** Frees everything a style left in the rig. */
export function clearRig(rig: THREE.Group) {
  rig.traverse((o) => {
    const mesh = o as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
  rig.clear();
}
