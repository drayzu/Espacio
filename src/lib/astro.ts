import * as THREE from 'three';

const OBLIQUITY = (23.44 * Math.PI) / 180;

/**
 * Equatorial coordinates (right ascension in hours, declination in degrees) to the Solar System's
 * frame used by the worlds: ecliptic in (x, z), y towards ecliptic north.
 */
export function fromEquatorial(raH: number, decD: number, dist: number) {
  const ra = (raH / 24) * Math.PI * 2;
  const dec = (decD * Math.PI) / 180;
  const X = Math.cos(dec) * Math.cos(ra);
  const Y = Math.cos(dec) * Math.sin(ra);
  const Z = Math.sin(dec);
  const ye = Y * Math.cos(OBLIQUITY) + Z * Math.sin(OBLIQUITY);
  const ze = -Y * Math.sin(OBLIQUITY) + Z * Math.cos(OBLIQUITY);
  return new THREE.Vector3(X, ze, -ye).multiplyScalar(dist);
}
