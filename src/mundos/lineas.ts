import * as THREE from 'three';

/**
 * Thin lines for the plate's language (hypothesis): additive, faded as a whole with the world.
 * Each vertex carries its own brightness, so far structures can fade into the distance, and its
 * own moment (`aT`, 0..1): as `uReveal` passes it the line is drawn, so a drawing can grow.
 */

const VERT = /* glsl */ `
  attribute float aLight;
  attribute float aT;
  uniform float uReveal;
  varying float vLight;
  void main() {
    vLight = aLight * smoothstep(aT, aT + 0.02, uReveal * 1.02);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vLight;
  void main() {
    gl_FragColor = vec4(uColor * vLight * uAlpha, 1.0);
  }
`;

export interface LinesData {
  position: Float32Array;
  aLight: Float32Array;
  aT: Float32Array;
}

/** Wraps generated line data into an additive line set; `uAlpha` fades it as a whole. */
export function linesFromData(data: LinesData, color: number) {
  const uniforms = { uColor: { value: new THREE.Color(color) }, uAlpha: { value: 0 }, uReveal: { value: 1 } };
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
  geo.setAttribute('aLight', new THREE.BufferAttribute(data.aLight, 1));
  geo.setAttribute('aT', new THREE.BufferAttribute(data.aT, 1));
  const mesh = new THREE.LineSegments(
    geo,
    new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  mesh.frustumCulled = false;
  return { mesh, uniforms };
}

/** Collects line segments; `data()` hands them over as typed arrays. */
export function lineSet() {
  const pos: number[] = [];
  const light: number[] = [];
  const when: number[] = [];
  return {
    /** One segment from a to b, with its brightness and the moments its ends are drawn. */
    segment(a: THREE.Vector3, b: THREE.Vector3, l: number, ta = 0, tb = ta) {
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      light.push(l, l);
      when.push(ta, tb);
    },
    /** A polyline through `pts`, drawn from start to end between moments `t0` and `t1`. */
    path(pts: THREE.Vector3[], l: number, t0 = 0, t1 = t0) {
      for (let k = 0; k + 1 < pts.length; k++) {
        this.segment(pts[k], pts[k + 1], l, t0 + ((t1 - t0) * k) / (pts.length - 1), t0 + ((t1 - t0) * (k + 1)) / (pts.length - 1));
      }
    },
    /** A circle of `n` segments around `c`, in the plane of `u`, `v`. */
    circle(c: THREE.Vector3, u: THREE.Vector3, v: THREE.Vector3, r: number, n: number, l: number) {
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const b = ((k + 1) / n) * Math.PI * 2;
        pos.push(
          c.x + (u.x * Math.cos(a) + v.x * Math.sin(a)) * r,
          c.y + (u.y * Math.cos(a) + v.y * Math.sin(a)) * r,
          c.z + (u.z * Math.cos(a) + v.z * Math.sin(a)) * r,
          c.x + (u.x * Math.cos(b) + v.x * Math.sin(b)) * r,
          c.y + (u.y * Math.cos(b) + v.y * Math.sin(b)) * r,
          c.z + (u.z * Math.cos(b) + v.z * Math.sin(b)) * r,
        );
        light.push(l, l);
        when.push(0, 0);
      }
    },
    /** A sphere as three great circles. */
    sphere(c: THREE.Vector3, r: number, n: number, l: number, tilt = 0) {
      const X = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), tilt);
      const Y = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), tilt);
      const Z = new THREE.Vector3(0, 0, 1);
      this.circle(c, X, Z, r, n, l);
      this.circle(c, X, Y, r, n, l);
      this.circle(c, Y, Z, r, n, l);
    },
    data(): LinesData {
      return { position: new Float32Array(pos), aLight: new Float32Array(light), aT: new Float32Array(when) };
    },
  };
}
