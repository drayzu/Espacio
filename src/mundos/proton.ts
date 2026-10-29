import * as THREE from 'three';
import { gauss, smoothstep } from '../lib/math';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { NUCLEO } from './nucleo';

/**
 * A proton. 1 unit = 0.1 fm. Three valence quarks (two up, one down) carrying the three colour
 * charges, held by gluon flux tubes meeting in a Y, inside a sea of virtual quarks and gluons
 * that never sits still (here trembling has a physical reason).
 * Moment: confinement, «nobody has ever seen a lone quark». One quark is pulled out: its flux tube
 * stretches, glowing hotter (its energy grows with its length, the force does not weaken), until it
 * snaps in a flash and the energy becomes a new quark and antiquark. The new quark takes the old
 * one's place in the proton; the old one flies off with the antiquark, a meson. Then the camera
 * swings around the triad.
 */

/** The quark pulled out in the moment: the down quark. */
const PULLED = 2;
/** How far it is pulled (units) before the tube snaps. */
const EXT = 9;

/**
 * The moment's pieces, moved by `uPull` (0..1): the pulled quark (role 0), its flux tube (1, `aDelay`
 * is the place along it), the new quark (2), the antiquark (3) and the flash where the tube broke
 * (4). `aFrom` holds each point's offset from its piece. At `uPull` 0 it is exactly the still
 * proton. Sizes as in the points shader.
 */
const PULL_VERT = /* glsl */ `
  attribute vec3 color;
  attribute vec3 aFrom;
  attribute float size, seed, drift, aDelay, aRole;
  uniform float uTime, uFocal, uMinPx, uMaxPx, uSizeUnit, uAlpha, uGain, uPull;
  uniform vec3 uJ, uQ;
  varying vec3 vColor;
  vec3 tube(vec3 a, vec3 b, float t, float k) {
    vec3 d = b - a;
    vec3 side = normalize(cross(vec3(0.0, 0.0, 1.0), normalize(d)));
    return a + d * t + side * sin(t * 9.42478 + k) * 0.35 * sin(t * 3.14159);
  }
  void main() {
    vec3 D = normalize(uQ - uJ);
    float L0 = length(uQ - uJ);
    float stretch = smoothstep(0.0, 0.52, uPull);
    float snap = step(0.55, uPull);
    float after = smoothstep(0.55, 1.0, uPull);
    vec3 far = uQ + D * ${EXT.toFixed(1)};
    vec3 B = mix(uJ, far, 0.5);
    // After the snap the old quark leaves with the antiquark, gathering speed; the new quark
    // settles into the proton.
    vec3 away = D * 26.0 * after * after;
    vec3 oldQ = mix(uQ + D * ${EXT.toFixed(1)} * stretch, far + away, snap);
    float settle = smoothstep(0.0, 0.45, after);
    vec3 newQ = mix(B, uQ, settle);
    vec3 anti = mix(B, far - D * 3.0, settle) + away;
    float meson = 1.0 - smoothstep(0.55, 1.0, after);
    float born = snap * smoothstep(0.55, 0.6, uPull);

    vec3 p;
    float light = 1.0;
    if (aRole < 0.5) {
      p = oldQ + aFrom;
      light = mix(1.0, meson, snap);
    } else if (aRole < 1.5) {
      float t = aDelay;
      if (snap < 0.5) {
        p = tube(uJ, oldQ, t, 2.0) + aFrom;
        // The same light per length as it stretches (its energy grows with it), and hotter
        // just before it gives.
        light = (length(oldQ - uJ) / L0) * (1.0 + 1.2 * smoothstep(0.36, 0.55, uPull));
      } else if (t < 0.5) {
        p = tube(uJ, newQ, t * 2.0, 2.0) + aFrom;
        light = mix(length(B - uJ) / L0, 1.0, settle);
      } else {
        p = tube(anti, oldQ, t * 2.0 - 1.0, 5.0) + aFrom;
        light = meson * mix(length(far - B) / L0, 1.0, settle);
      }
    } else if (aRole < 2.5) {
      p = newQ + aFrom;
      light = born;
    } else if (aRole < 3.5) {
      p = anti + aFrom;
      light = born * meson;
    } else {
      float k = smoothstep(0.55, 0.7, uPull);
      p = B + aFrom * (0.3 + 6.0 * k);
      light = snap * (1.0 - k);
    }
    p += drift * vec3(sin(uTime * 1.3 + seed * 17.0), cos(uTime * 1.1 + seed * 23.0), sin(uTime * 0.9 + seed * 31.0));
    float scale = length(modelMatrix[0].xyz);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float sz = size * uSizeUnit * scale * uFocal / max(-mv.z, 1e-4);
    gl_PointSize = clamp(sz, uMinPx, uMaxPx);
    float dim = min(1.0, (sz * sz) / (uMinPx * uMinPx));
    vColor = color * uGain * dim * uAlpha * light;
    if (vColor.r + vColor.g + vColor.b < 1e-4) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;

export const PROTON = (() => {
  const quarks = [
    { p: new THREE.Vector3(3.3, 0.6, 0.5), color: 0xff4a5e, up: true },
    { p: new THREE.Vector3(-2.1, 2.5, -0.4), color: 0x4aff9a, up: true },
    { p: new THREE.Vector3(-1.4, -2.9, 0.3), color: 0x4a8cff, up: false },
  ];
  const junction = new THREE.Vector3(0.1, 0.05, 0.1);
  return { quarks, junction };
})();

export function proton(): WorldModule {
  return {
    spec: {
      id: 'proton',
      territory: 'subatómico',
      name: 'Protón',
      fact: 'Tres quarks atados por la fuerza más intensa que conocemos. En tu cuerpo hay más de estos que estrellas en todo lo que se ve.',
      ficha: ['unos 2 × 10²⁸ protones en un cuerpo de 70 kg', 'de 10²² a 10²⁴ estrellas en el universo observable'],
      label: 'protón',
      unitExp: -16,
      frame: 28,
      anchor: NUCLEO.nucleons[NUCLEO.ours].p,
      frameCenter: new THREE.Vector3(),
      view: [0.2, -0.3, 0],
      // In early, from the collision, and dim while the camera is still inside its glow.
      fade: [-2.6, -1.6, 0.55, 0.95],
      tint: 0xff9ac0,
      notes: [
        { at: PROTON.quarks[0].p.toArray(), text: 'quark up' },
        { at: PROTON.quarks[1].p.toArray(), text: 'quark up' },
        { at: PROTON.quarks[2].p.toArray(), text: 'quark down' },
        { at: PROTON.junction.toArray(), text: 'gluones' },
      ],
      generate() {
        const b = cloudBuilder(81);
        const { r } = b;
        const { quarks, junction } = PROTON;

        // The moment's pieces (see PULL_VERT), placed as offsets from their piece.
        const pb = cloudBuilder(82);
        const roles: number[] = [];
        const piece = (role: number, at: THREE.Vector3, sd: number, hex: number, d: number, light: number, n: number) => {
          for (let k = 0; k < n; k++) {
            const o: [number, number, number] = [gauss(r) * sd, gauss(r) * sd, gauss(r) * sd];
            pb.push(at.x + o[0], at.y + o[1], at.z + o[2], hex, 1, d, light, { from: o });
            roles.push(role);
          }
        };

        quarks.forEach((q, i) => {
          // Valence quark: a bright core and its glow. The first one holds everything smaller.
          if (i === PULLED) {
            piece(0, q.p, 0.35, q.color, 0.03, 0.75, 2600);
            piece(0, q.p, 1.1, q.color, 0.08, 0.13, 2600);
          } else {
            for (let k = 0; k < 2600; k++) {
              b.push(q.p.x + gauss(r) * 0.35, q.p.y + gauss(r) * 0.35, q.p.z + gauss(r) * 0.35, q.color, 1, 0.03, 0.75, { flag: i === 0 });
            }
            for (let k = 0; k < 2600; k++) {
              b.push(q.p.x + gauss(r) * 1.1, q.p.y + gauss(r) * 1.1, q.p.z + gauss(r) * 1.1, q.color, 1, 0.08, 0.13);
            }
          }
          // Its flux tube from the junction, gently undulating.
          const dir = q.p.clone().sub(junction);
          const len = dir.length();
          dir.normalize();
          const side = new THREE.Vector3(0, 0, 1).cross(dir).normalize();
          for (let k = 0; k < 2000; k++) {
            const t = r();
            const wave = Math.sin(t * Math.PI * 3 + 2) * 0.35 * Math.sin(t * Math.PI);
            const o: [number, number, number] = [gauss(r) * 0.22, gauss(r) * 0.22, gauss(r) * 0.22];
            const x = junction.x + dir.x * len * t + side.x * wave + o[0];
            const y = junction.y + dir.y * len * t + side.y * wave + o[1];
            const z = junction.z + dir.z * len * t + side.z * wave + o[2];
            if (i === PULLED) {
              pb.push(x, y, z, 0xffe6b0, 1, 0.05, 0.14, { from: o, delay: t });
              roles.push(1);
            } else b.push(x, y, z, 0xffe6b0, 1, 0.05, 0.14);
          }
        });
        // Born where the tube breaks: a new quark of the same colour and its antiquark (anti-blue,
        // drawn in the complementary yellow), and the flash of the break.
        const q = quarks[PULLED];
        piece(2, q.p, 0.35, q.color, 0.03, 0.75, 2000);
        piece(2, q.p, 1.1, q.color, 0.08, 0.13, 2000);
        piece(3, q.p, 0.35, 0xffd24a, 0.03, 0.75, 2000);
        piece(3, q.p, 1.1, 0xffd24a, 0.08, 0.13, 2000);
        piece(4, q.p, 0.5, 0xfff0d0, 0.02, 0.5, 900);
        // The sea: virtual quark pairs and gluons, flickering in and out of existence.
        for (let k = 0; k < 6000; k++) {
          const [x, y, z] = b.onSphere();
          const rad = Math.cbrt(r()) * 7.2;
          const c = [0xff4a5e, 0x4aff9a, 0x4a8cff, 0xffe6b0][k % 4];
          b.push(x * rad, y * rad, z * rad, c, 0.8, 0.35, 0.1);
        }
        // Its edge, about 0.84 fm out.
        for (let k = 0; k < 7000; k++) {
          const [x, y, z] = b.onSphere();
          const rad = 8.4 + gauss(r) * 0.35;
          b.push(x * rad, y * rad, z * rad, 0xff9ac0, 0.9, 0.04, 0.07);
        }
        return { main: b.data(), pull: pb.data(), roles: new Float32Array(roles) };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 0.085, 1);
        const pull = cloudFromData(data.pull as PointsData, 0.085, 1);
        pull.points.geometry.setAttribute('aRole', new THREE.BufferAttribute(data.roles as Float32Array, 1));
        const mat = pull.points.material as THREE.ShaderMaterial;
        mat.vertexShader = PULL_VERT;
        const pullU = { value: 0 };
        Object.assign(mat.uniforms, { uPull: pullU, uJ: { value: PROTON.junction }, uQ: { value: PROTON.quarks[PULLED].p } });
        const object = new THREE.Group();
        object.add(cloud.points, pull.points);
        return {
          object,
          clouds: [cloud, pull],
          update(f) {
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('colisionador'), f.e, f.home);
            cloud.u.uGain.value = 0.22 + 0.78 * smoothstep(f.home - 1.1, f.home - 0.3, f.e);
            pull.u.uGain.value = cloud.u.uGain.value;
            pullU.value = f.tl.get('pro.pull', f.p);
          },
        };
      },
    },
    choreo(tl, w) {
      // Out of the desert, the proton swims into view.
      tl.to(3.0, { e: w.home - 0.15, fov: 42, roll: 0, yaw: 0, pitch: 0.05 });
      tl.label('proton');
      // Confinement: one quark pulled out until its tube snaps into a new pair. The camera
      // follows the pull, then the meson flying off, keeping the proton in frame.
      const along = (k: number) => {
        const d = PROTON.quarks[PULLED].p.clone().sub(PROTON.junction).normalize().multiplyScalar(k);
        return { 'proton.tx': d.x, 'proton.ty': d.y, 'proton.tz': d.z };
      };
      tl.set({ 'pro.pull': 0 });
      tl.caption(7.4, 'Nadie ha visto un quark solo', 'Si tiras de uno, la cuerda no se afloja: se rompe, y de su energía nacen dos quarks nuevos. Nunca quedan solos.');
      tl.to(1.2, { ...along(2.5), e: w.home - 0.08 });
      tl.to(3.0, { ...along(5), 'pro.pull': 0.56, e: w.home - 0.02 });
      // The meson leaves the frame; the camera stays with the proton, whole again.
      tl.to(3.2, { ...along(2), 'pro.pull': 1, e: w.home });
      // Then swing around the three quarks, whole again.
      tl.to(2.6, { ...along(0), yaw: 0.9, pitch: 0.3, e: w.home + 0.08 });
    },
  };
}
