import * as THREE from 'three';
import type { WorldFrame } from './cadena';
import type { Marco } from '../horizontes';

/**
 * The bodies of Horizontes (src/horizontes, a copy of horizontes-cuerpos: the Sun and the planets
 * in points, coloured from real maps) inside the worlds of the chain.
 *
 * A body is made once, the first time its world is assembled, and kept: its points are built on the
 * main thread from the maps (they cannot go to the workers), in chunks, so rebuilding it every time
 * the journey passes by would cost more than keeping it. When its world is released the chain
 * disposes of its GPU buffers and programs; they come back on the next frame it is drawn.
 *
 * Its points test depth against its own dimmed photograph, which also hides what lies behind it
 * (the far side, a ring, an orbit drawn with depth test). The photograph sits a hair below the
 * points (0.3 % of the radius), finer than this piece's depth buffer resolves at a planet's
 * distance (its near plane is tiny, for flights through clouds): it is pushed back a few steps of
 * the depth buffer, or it would hide part of the ground's own points.
 */

/** Where the maps are served from. */
export const TEXTURAS = `${import.meta.env.BASE_URL}texturas/`;

/**
 * How many points a body gets: half on phones and small touch screens (as post.ts renders them
 * fewer pixels). Asked when the body is made, on the main thread (the worlds' modules also load
 * in the workers, where there is no window).
 */
export function puntos(n: number) {
  const ligero = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 600;
  return ligero ? Math.round(n / 2) : n;
}

/** A body made on first use and kept. */
export function unaVez<T>(make: () => T) {
  let v: T | null = null;
  return () => (v ??= make());
}

/**
 * How bright the bodies are in this piece: Horizontes is graded for a gentler bloom than Espacio's
 * (threshold 0.12), where at full strength they glare.
 */
export const AJUSTE = { brillo: 0.3 };

interface Cuerpo {
  group: THREE.Object3D;
  update(m: Marco): void;
}

const afinados = new WeakSet<object>();
function afinar(b: Cuerpo) {
  afinados.add(b);
  b.group.traverse((o) => {
    // The photograph (Horizontes draws it first, at render order -50).
    const m = o as THREE.Mesh;
    if (!m.isMesh || m.renderOrder !== -50) return;
    const mat = m.material as THREE.Material;
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = 1;
    mat.polygonOffsetUnits = 4;
  });
}

const inv = new THREE.Matrix4();
const q = new THREE.Quaternion();
const cam = new THREE.Vector3();
const sol = new THREE.Vector3();

/**
 * Per frame: the camera and the Sun's direction (given in the frame of the body's parent) into
 * the body's own frame, in its radii, and how present it is. Hidden altogether when absent.
 */
export function mover(b: Cuerpo, f: WorldFrame, sunDir: THREE.Vector3, presencia: number) {
  b.group.visible = presencia > 0.001;
  if (!b.group.visible) return;
  if (!afinados.has(b)) afinar(b);
  b.group.updateWorldMatrix(true, false);
  cam.copy(f.camera.position).applyMatrix4(inv.copy(b.group.matrixWorld).invert());
  sol.copy(sunDir).applyQuaternion(q.copy(b.group.quaternion).invert()).normalize();
  b.update({ sol, camara: cam, focal: f.focal, dpr: f.dpr, tiempo: f.time, presencia: presencia * AJUSTE.brillo });
}
