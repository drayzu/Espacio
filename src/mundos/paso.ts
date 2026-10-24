import * as THREE from 'three';
import type { WorldSpec } from '../engine/cadena';

/**
 * A stretch of the journey with nothing in it but scale: the zoom crosses it, the dust streams,
 * the numbers run, and its one sentence stays on screen for a while (`nameSpan`). Emptiness is
 * part of the show.
 */
export function paso(spec: Pick<WorldSpec, 'id' | 'territory' | 'name' | 'fact' | 'label' | 'unitExp' | 'anchor' | 'tint' | 'nameSpan'>): WorldSpec {
  return {
    frame: 1,
    frameCenter: new THREE.Vector3(),
    view: 'continue',
    fade: [-1, -0.5, 0.5, 1],
    ...spec,
    generate: () => ({}),
    assemble: () => ({ object: new THREE.Group(), clouds: [] }),
  };
}
