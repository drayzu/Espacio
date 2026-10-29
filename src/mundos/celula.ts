import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { LABELS, MITOS, NUCLEOLUS, NUCLEUS, STRETCH_X, VESICLES, erPaths, golgiPaths, membranePoint, membraneR } from '../lib/cell';
import { MEDIUM_FRAG } from '../lib/tinta';
import type { WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { EASE } from '../engine/timeline';

/**
 * A eukaryotic cell. 1 unit = 10 µm (radius about 1). Particles for its matter, living ink for
 * the cytoplasm. Arrival: the cell crystallises outward from the nucleus while the ink seeps in.
 * Moment: it tilts to show its thickness, then settles face on. All along, a steady traffic of
 * vesicles leaves the Golgi apparatus for the membrane, where they fuse. Then a named moment: the
 * cell divides, the way a plant cell does. The chromatin condenses into chromosomes and the
 * nuclear envelope dissolves; the chromosomes line up on the spindle, their sister chromatids are
 * pulled to the poles; two nuclei form, and a new wall (the cell plate) grows across the middle.
 */

/**
 * The division, moved by `uDiv` (0..1): chromatids (role 0: `aT` along it, `aSide` which sister,
 * scattered at `aFrom` in the nucleus before they condense at `aC`, then lined up at height `aY`
 * on the plate and pulled apart), spindle fibres (1: from the pole to the chromatid's
 * centromere, `aT` along it), the daughter nuclei (2) and the cell plate (3). Sizes as in the
 * points shader.
 */
const MITOSIS_VERT = /* glsl */ `
  attribute vec3 color;
  attribute vec3 aFrom;
  attribute vec3 aC;
  attribute vec3 aOff;
  attribute float size, seed, drift, aRole, aT, aSide, aLen, aY, aAng;
  uniform float uTime, uFocal, uMinPx, uMaxPx, uSizeUnit, uAlpha, uGain, uDiv;
  uniform vec3 uN;
  varying vec3 vColor;
  vec3 chromatid(float t) {
    float k1 = smoothstep(0.0, 0.22, uDiv);
    float k2 = smoothstep(0.2, 0.42, uDiv);
    float k3 = smoothstep(0.48, 0.72, uDiv);
    // Condensed where it was, an X with its sister...
    vec2 dir = vec2(cos(aAng + aSide * 0.35), sin(aAng + aSide * 0.35));
    vec3 pro = aC + vec3(dir * t * aLen, 0.0);
    // ...lined up on the plate, then pulled by its centromere to a pole, the arms trailing in a V.
    float cx = uN.x + aSide * (0.014 + 0.36 * k3);
    vec3 ana = vec3(cx - aSide * k3 * abs(t) * aLen * 0.8, uN.y + aY + t * aLen * (1.0 - 0.55 * k3), aC.z * (1.0 - k2));
    return mix(mix(aFrom, pro, k1), ana, k2);
  }
  void main() {
    float k2 = smoothstep(0.2, 0.42, uDiv);
    float k4 = smoothstep(0.72, 0.88, uDiv);
    float k5 = smoothstep(0.8, 1.0, uDiv);
    vec3 daughter = vec3(uN.x + aSide * 0.4, uN.y, 0.0);
    vec3 p;
    float light = 1.0;
    if (aRole < 0.5) {
      p = chromatid(aT) + aOff;
      // Gathered into the new nuclei, unwinding again.
      p = mix(p, daughter + aOff * 6.0 + (aFrom - vec3(uN.xy, 0.0)) * 0.35, k4);
      light = smoothstep(0.0, 0.08, uDiv) * (1.0 - 0.65 * k4);
    } else if (aRole < 1.5) {
      vec3 pole = vec3(uN.x + aSide * 0.5, uN.y, 0.0);
      p = mix(pole, chromatid(0.0), aT) + aOff;
      light = k2 * (1.0 - k4);
    } else if (aRole < 2.5) {
      p = daughter + aOff;
      light = k4;
    } else {
      p = vec3(uN.x + aOff.x, uN.y + aT * 0.92, aOff.z);
      light = 1.0 - smoothstep(k5 - 0.08, k5, abs(aT));
      light *= step(0.001, k5);
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

/**
 * The traffic: each vesicle (a few points round `aOff`) buds at `aFrom`, rides out to `aTo` on
 * the membrane and fuses there, over and over at its own phase. Screen-sized points.
 */
const TRAFFIC_VERT = /* glsl */ `
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute vec3 aOff;
  attribute float aPhase;
  uniform float uTime, uAlpha;
  varying float vL;
  void main() {
    float t = fract(aPhase + uTime * 0.12);
    float k = smoothstep(0.0, 1.0, t);
    vec3 d = aTo - aFrom;
    vec3 side = normalize(vec3(-d.y, d.x, 0.0));
    vec3 p = aFrom + d * k + side * sin(t * 6.2832 + aPhase * 17.0) * 0.025 + aOff;
    // Budding, the ride, and fusion: a brief brightening as it merges into the membrane.
    vL = uAlpha * smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.93, 1.0, t)) * (1.0 + 1.5 * smoothstep(0.85, 0.95, t));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = 2.4;
    if (vL < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  }
`;
const TRAFFIC_FRAG = /* glsl */ `
  varying float vL;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    gl_FragColor = vec4(vec3(1.0, 0.92, 0.7) * vL * exp(-dot(c, c) * 12.0), 1.0);
  }
`;

export function celula(): WorldModule {
  return {
    spec: {
      id: 'celula',
      territory: 'vida',
      name: 'Una célula',
      fact: 'Cien billones de átomos que trabajan juntos. Y están vivos.',
      ficha: ['unos 10¹⁴ átomos en una célula'],
      label: 'célula',
      unitExp: -5,
      frame: 2.7,
      anchor: new THREE.Vector3(),
      frameCenter: new THREE.Vector3(),
      view: [0, 0, 0],
      fade: [-0.75, -0.35, 1.0, 1.5],
      tint: 0x6fe0a0,
      notes: [
        ...LABELS.map((l) => ({ at: [l.at[0], l.at[1], 0] as [number, number, number], text: l.text })),
        { at: [NUCLEOLUS.x, NUCLEOLUS.y, 0], text: 'nucléolo' },
      ],
      generate() {
        const b = cloudBuilder(11);
        const { r } = b;
        // Built outward from the nucleus: delay grows with distance from it.
        const put = (x: number, y: number, z: number, hex: number, s: number, d: number, light: number) => {
          const dist = Math.hypot(x - NUCLEUS.x, y - NUCLEUS.y, z);
          b.push(x, y, z, hex, s, d, light, { delay: Math.min(1, Math.max(0, (dist - NUCLEUS.r * 0.9) / 1.1)) * 0.9 + r() * 0.08 });
        };

        for (let i = 0; i < 70000; i++) {
          const [x, y, z] = b.onSphere();
          const rad = membraneR(Math.atan2(y, x)) * (1 - Math.abs(gauss(r)) * 0.014);
          put(x * rad * STRETCH_X, y * rad, z * rad * 0.42, 0xffa24a, 1.5, 0.002, 0.42);
        }
        for (let i = 0; i < 9000; i++) {
          const [x, y, z] = b.onSphere();
          const rad = membraneR(Math.atan2(y, x)) * (1.02 + Math.abs(gauss(r)) * 0.05);
          put(x * rad * STRETCH_X, y * rad, z * rad * 0.42, 0xff7a3a, 1.1, 0.006, 0.25);
        }
        for (let i = 0; i < 16000; i++) {
          const [x, y, z] = b.onSphere();
          const k = Math.cbrt(r()) * 0.94 * membraneR(Math.atan2(y, x));
          put(x * k * STRETCH_X, y * k, z * k * 0.4, 0x6fe0a0, 1.0, 0.012, 0.22);
        }
        // The nucleus in its own cloud: during the division its envelope and chromatin dissolve.
        const nb = cloudBuilder(13);
        const putN = (x: number, y: number, z: number, hex: number, sz: number, d: number, light: number) =>
          nb.push(x, y, z, hex, sz, d, light, { delay: Math.min(1, Math.max(0, (Math.hypot(x - NUCLEUS.x, y - NUCLEUS.y, z) - NUCLEUS.r * 0.9) / 1.1)) * 0.9 + r() * 0.08 });
        for (let i = 0; i < 22000; i++) {
          const [x, y, z] = b.onSphere();
          const k = NUCLEUS.r * (1 + gauss(r) * 0.008);
          putN(NUCLEUS.x + x * k, NUCLEUS.y + y * k, z * k * 0.75, 0x47e6c8, 1.4, 0.0015, 0.45);
        }
        for (let cl = 0; cl < 70; cl++) {
          const [x, y, z] = b.onSphere();
          const k = Math.cbrt(r()) * NUCLEUS.r * 0.85;
          const cx = NUCLEUS.x + x * k;
          const cy = NUCLEUS.y + y * k;
          const cz = z * k * 0.75;
          for (let i = 0; i < 160; i++) putN(cx + gauss(r) * 0.028, cy + gauss(r) * 0.028, cz + gauss(r) * 0.02, 0x2fb8d6, 1.1, 0.003, 0.4);
        }
        for (let i = 0; i < 3000; i++) {
          const [x, y, z] = b.onSphere();
          const k = Math.cbrt(r()) * NUCLEOLUS.r;
          putN(NUCLEOLUS.x + x * k, NUCLEOLUS.y + y * k, z * k, 0xd8fff6, 1.4, 0.002, 0.28);
        }
        for (const m of MITOS) {
          const ca = Math.cos(m.angle);
          const sa = Math.sin(m.angle);
          const mz = (r() - 0.5) * 0.3;
          const at = (lx: number, ly: number, lz: number, hex: number, s: number, light: number) =>
            put(m.x + lx * ca - ly * sa, m.y + lx * sa + ly * ca, mz + lz, hex, s, 0.002, light);
          for (let i = 0; i < 3200; i++) {
            const [x, y, z] = b.onSphere();
            at((x * m.len) / 2, y * m.r, z * m.r, 0xff6a4d, 1.2, 0.5);
          }
          for (let i = 0; i < 900; i++) {
            const u = r() - 0.5;
            const half = Math.sqrt(Math.max(0, 1 - (u / 0.5) ** 2)) * m.r * 0.8;
            at(u * m.len * 0.92, Math.sin(u * 48) * half, gauss(r) * m.r * 0.4, 0xffc39a, 1.1, 0.55);
          }
        }
        const sheet = (paths: [number, number][][], n: number, hex: number, light: number, depth: number) => {
          for (const path of paths) {
            for (let i = 0; i < n; i++) {
              const f = r() * (path.length - 1);
              const j = Math.floor(f);
              const t = f - j;
              const a = path[j];
              const c = path[Math.min(j + 1, path.length - 1)];
              put(a[0] + (c[0] - a[0]) * t + gauss(r) * 0.004, a[1] + (c[1] - a[1]) * t + gauss(r) * 0.004, gauss(r) * depth, hex, 1.1, 0.002, light);
            }
          }
        };
        sheet(erPaths(), 3000, 0x7cf08a, 0.38, 0.12);
        sheet(golgiPaths(), 1400, 0xffd36a, 0.45, 0.025);
        for (const v of VESICLES) {
          const vz = (r() - 0.5) * 0.4;
          for (let i = 0; i < 260; i++) {
            const [x, y, z] = b.onSphere();
            put(v.x + x * v.r, v.y + y * v.r, vz + z * v.r, 0xfff0c2, 1.2, 0.003, 0.6);
          }
        }

        // The vesicle traffic, from the Golgi's outer face out to the membrane.
        const tr = rng(12);
        const from: number[] = [];
        const to: number[] = [];
        const off: number[] = [];
        const phase: number[] = [];
        for (let v = 0; v < 40; v++) {
          const a = -1.7 + tr() * 2.3;
          const sx = 0.3 + Math.cos(a) * 0.33;
          const sy = -0.1 + Math.sin(a) * 0.33;
          const [ex, ey] = membranePoint(Math.atan2(sy, sx) + (tr() - 0.5) * 0.5, 0.96);
          const z = (tr() - 0.5) * 0.16;
          const ph = tr();
          for (let k = 0; k < 14; k++) {
            from.push(sx, sy, z);
            to.push(ex, ey, z * 0.6);
            off.push(gauss(tr) * 0.009, gauss(tr) * 0.009, gauss(tr) * 0.009);
            phase.push(ph);
          }
        }
        // The division: eight chromosomes (two sister chromatids each), their spindle fibres, the
        // two daughter nuclei and the cell plate.
        const mb = cloudBuilder(14);
        const mit = { role: [] as number[], t: [] as number[], side: [] as number[], len: [] as number[], y: [] as number[], ang: [] as number[], c: [] as number[], off: [] as number[] };
        const add = (x: number, y: number, z: number, hex: number, sz: number, light: number, role: number, t: number, side: number, len: number, yy: number, ang: number, c: number[], off: number[]) => {
          mb.push(x, y, z, hex, sz, 0.002, light);
          mit.role.push(role);
          mit.t.push(t);
          mit.side.push(side);
          mit.len.push(len);
          mit.y.push(yy);
          mit.ang.push(ang);
          mit.c.push(c[0], c[1], c[2]);
          mit.off.push(off[0], off[1], off[2]);
        };
        const inNucleus = () => {
          const [x, y, z] = mb.onSphere();
          const k = Math.cbrt(r()) * NUCLEUS.r * 0.8;
          return [NUCLEUS.x + x * k, NUCLEUS.y + y * k, z * k * 0.6];
        };
        for (let c = 0; c < 8; c++) {
          const centre = inNucleus();
          const len = 0.06 + r() * 0.06;
          const yy = (c - 3.5) * 0.06 + (r() - 0.5) * 0.015;
          const ang = r() * Math.PI;
          for (const side of [-1, 1]) {
            for (let k = 0; k < 700; k++) {
              const [fx, fy, fz] = inNucleus();
              add(fx, fy, fz, 0x6fe8ff, 1.1, 0.5, 0, r() * 2 - 1, side, len, yy, ang, centre, [gauss(r) * 0.009, gauss(r) * 0.009, gauss(r) * 0.009]);
            }
            for (let k = 0; k < 140; k++) {
              add(NUCLEUS.x, NUCLEUS.y, 0, 0xe0ecff, 0.8, 0.22, 1, r(), side, len, yy, ang, centre, [gauss(r) * 0.003, gauss(r) * 0.003, gauss(r) * 0.003]);
            }
          }
        }
        for (const side of [-1, 1]) {
          for (let k = 0; k < 7000; k++) {
            const [x, y, z] = mb.onSphere();
            const rr = 0.19 * (1 + gauss(r) * 0.01);
            add(NUCLEUS.x + side * 0.4, NUCLEUS.y, 0, 0x47e6c8, 1.3, 0.42, 2, 0, side, 0, 0, 0, [0, 0, 0], [x * rr, y * rr, z * rr * 0.75]);
          }
        }
        for (let k = 0; k < 6000; k++) {
          const t = r() * 2 - 1;
          add(NUCLEUS.x, NUCLEUS.y + t, 0, 0xffa24a, 1.4, 0.42, 3, t, 0, 0, 0, 0, [0, 0, 0], [gauss(r) * 0.006, 0, gauss(r) * 0.12]);
        }
        const f32 = (a: number[]) => new Float32Array(a);

        return {
          main: b.data(),
          nucleus: nb.data(),
          mitosis: { points: mb.data(), role: f32(mit.role), t: f32(mit.t), side: f32(mit.side), len: f32(mit.len), y: f32(mit.y), ang: f32(mit.ang), c: f32(mit.c), off: f32(mit.off) },
          traffic: { aFrom: new Float32Array(from), aTo: new Float32Array(to), aOff: new Float32Array(off), aPhase: new Float32Array(phase) },
        };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 0.005, 0.38);
        const nucleus = cloudFromData(data.nucleus as PointsData, 0.005, 0.38);
        const md = data.mitosis as { points: PointsData } & Record<'role' | 't' | 'side' | 'len' | 'y' | 'ang' | 'c' | 'off', Float32Array>;
        const mitosis = cloudFromData(md.points, 0.005, 0.38);
        const mg = mitosis.points.geometry;
        for (const [name, arr, n] of [['aRole', md.role, 1], ['aT', md.t, 1], ['aSide', md.side, 1], ['aLen', md.len, 1], ['aY', md.y, 1], ['aAng', md.ang, 1], ['aC', md.c, 3], ['aOff', md.off, 3]] as [string, Float32Array, number][]) {
          mg.setAttribute(name, new THREE.BufferAttribute(arr, n));
        }
        const mmat = mitosis.points.material as THREE.ShaderMaterial;
        mmat.vertexShader = MITOSIS_VERT;
        const divU = { value: 0 };
        Object.assign(mmat.uniforms, { uDiv: divU, uN: { value: new THREE.Vector3(NUCLEUS.x, NUCLEUS.y, NUCLEUS.r) } });

        const td = data.traffic as Record<'aFrom' | 'aTo' | 'aOff' | 'aPhase', Float32Array>;
        const tgeo = new THREE.BufferGeometry();
        tgeo.setAttribute('position', new THREE.BufferAttribute(td.aFrom, 3));
        tgeo.setAttribute('aFrom', new THREE.BufferAttribute(td.aFrom, 3));
        tgeo.setAttribute('aTo', new THREE.BufferAttribute(td.aTo, 3));
        tgeo.setAttribute('aOff', new THREE.BufferAttribute(td.aOff, 3));
        tgeo.setAttribute('aPhase', new THREE.BufferAttribute(td.aPhase, 1));
        const trafficU = { uTime: { value: 0 }, uAlpha: { value: 0 } };
        const traffic = new THREE.Points(
          tgeo,
          new THREE.ShaderMaterial({ vertexShader: TRAFFIC_VERT, fragmentShader: TRAFFIC_FRAG, uniforms: trafficU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
        );
        traffic.frustumCulled = false;

        // The cytoplasm as living ink, behind the particles.
        const inkU = { uTime: { value: 0 }, uOpacity: { value: 0 }, uNucleus: { value: new THREE.Vector3(NUCLEUS.x, NUCLEUS.y, NUCLEUS.r) } };
        const ink = new THREE.Mesh(
          new THREE.PlaneGeometry(12, 8),
          new THREE.ShaderMaterial({
            vertexShader: /* glsl */ `
              varying vec2 vP;
              void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
            `,
            fragmentShader: MEDIUM_FRAG,
            uniforms: inkU,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        ink.position.z = -0.32;
        ink.renderOrder = -1;
        ink.frustumCulled = false;

        const object = new THREE.Group();
        object.add(ink, cloud.points, nucleus.points, mitosis.points, traffic);
        return {
          object,
          clouds: [cloud, nucleus, mitosis],
          update(f) {
            cloud.u.uReveal.value = f.tl.get('cel.form', f.p);
            nucleus.u.uReveal.value = cloud.u.uReveal.value;
            // The division: the envelope and the chromatin dissolve as the chromosomes condense.
            const div = f.tl.get('cel.div', f.p);
            divU.value = div;
            nucleus.u.uGain.value = 0.38 * (1 - smoothstep(0.06, 0.3, div));
            // The ink's pool of nucleoplasm goes with the envelope.
            inkU.uNucleus.value.z = NUCLEUS.r - (NUCLEUS.r + 0.1) * smoothstep(0.08, 0.45, div);
            mitosis.points.visible = div > 0.001;
            inkU.uTime.value = f.time;
            // The ink lives on a finite plane: gone before the plane's edge could show.
            inkU.uOpacity.value = f.tl.get('cel.ink', f.p) * f.alpha * (1 - smoothstep(f.home + 0.25, f.home + 0.6, f.e));
            ink.visible = inkU.uOpacity.value > 0.002;
            // The traffic once the cell has formed, at the cell's own scale.
            trafficU.uTime.value = f.time;
            trafficU.uAlpha.value = 0.42 * f.alpha * smoothstep(0.85, 1, f.tl.get('cel.form', f.p)) * (1 - smoothstep(f.home + 0.3, f.home + 0.7, f.e));
            traffic.visible = trafficU.uAlpha.value > 0.002;
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'cel.form': 0, 'cel.ink': 0 });
      // The cell crystallises outward from the nucleus; the ink seeps in during the second half.
      tl.with(3.4, { 'cel.ink': 1 }, EASE.in);
      tl.to(3.4, { e: w.home, 'cel.form': 1, yaw: 0, pitch: 0, fov: 36 });
      tl.label('celula');
      // Tilt to show its thickness, then settle face on.
      tl.to(2.2, { pitch: 0.45, yaw: 0.5, e: w.home + 0.08 });
      tl.to(2.0, { pitch: 0, yaw: 0, e: w.home + 0.15 });
      // It divides. Closer to the nucleus while the chromosomes form and part, then back out to
      // see the new wall cross the cell.
      tl.set({ 'cel.div': 0, 'celula.aim': 0, 'celula.ax': NUCLEUS.x, 'celula.ay': NUCLEUS.y, 'celula.az': 0 });
      tl.caption(9.4, 'Una célula se divide', 'Así nació cada célula de esta hoja, y cada una de las tuyas: de otra que se partió en dos.');
      tl.to(2.2, { 'celula.aim': 1, 'cel.div': 0.2, e: w.home - 0.32 });
      tl.to(3.8, { 'cel.div': 0.76, e: w.home - 0.36 });
      // (The aim holds until the cell's own scale: below it, the chromatin's view would tilt it.)
      tl.to(2.0, { 'cel.div': 0.93, e: w.home + 0.02 });
      tl.to(1.4, { 'celula.aim': 0, 'cel.div': 1, e: w.home + 0.12 });
    },
  };
}
