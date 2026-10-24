import * as THREE from 'three';
import { NUCLEUS } from '../../lib/cell';
import { MEDIUM_FRAG } from '../../lib/tinta';
import { createLaminaLayer } from '../lamina';
import type { Style } from '../types';
import { createCellPoints } from './particulas';

/**
 * Style 5, the proposal: points of light are the matter, ink is the medium between them,
 * and the scientific plate is a layer you can switch on over anything.
 */


export const luzTinta: Style = {
  id: 'luz-tinta',
  name: 'Luz y tinta',
  blurb: 'Propuesta: la materia es luz, el medio es tinta, y la lámina es una capa que se enciende encima (tecla i).',
  mount(stage, overlay) {
    const medium = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 8),
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          varying vec2 vP;
          void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: MEDIUM_FRAG,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uNucleus: { value: new THREE.Vector3(NUCLEUS.x, NUCLEUS.y, NUCLEUS.r) } },
        depthWrite: false,
      }),
    );
    medium.position.z = -0.32;
    medium.renderOrder = -1;
    stage.rig.add(medium);

    const { points, mat } = createCellPoints(stage.renderer.getPixelRatio());
    mat.uniforms.uGain.value = 1;
    stage.rig.add(points);

    const lamina = createLaminaLayer(stage, overlay);
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.innerHTML = '<span class="chip-k">i</span>Lámina';
    const sync = () => chip.classList.toggle('is-on', lamina.on);
    chip.addEventListener('click', () => {
      lamina.toggle();
      sync();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'i') return;
      lamina.toggle();
      sync();
    };
    addEventListener('keydown', onKey);
    document.body.appendChild(chip);
    if (new URLSearchParams(location.search).has('lamina')) {
      lamina.toggle(true);
      sync();
    }

    stage.scene.background = new THREE.Color(0x020306);
    stage.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    stage.renderer.toneMappingExposure = 1.15;
    stage.bloom.strength = 0.95;
    stage.bloom.radius = 0.7;
    stage.bloom.threshold = 0.12;
    stage.finish.uniforms.uGrain.value = 0.04;
    stage.finish.uniforms.uFringe.value = 0.018;

    const mediumMat = medium.material;
    return {
      update(f) {
        mat.uniforms.uTime.value = f.time;
        mediumMat.uniforms.uTime.value = f.time;
        lamina.update(f.dt);
      },
      resize() {
        lamina.resize();
      },
      dispose() {
        removeEventListener('keydown', onKey);
        chip.remove();
      },
    };
  },
};
