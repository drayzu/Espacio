import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import {
  LABELS,
  MITOS,
  NUCLEOLUS,
  NUCLEUS,
  VESICLES,
  erPaths,
  golgiPaths,
  membranePoint,
  mitoCristae,
  mitoOutline,
} from '../../lib/cell';
import { clamp, gauss, rng } from '../../lib/math';
import type { Style } from '../types';

/**
 * Style 2: a living scientific plate. Fine ink lines on near-black, drawn in as you arrive,
 * annotated like a figure in a paper. Depth comes from layering the lines at different heights.
 */

const INK = 0xece7db;
const ACCENT = 0xff5b2e;

const DOT_VERT = /* glsl */ `
  uniform float uPR;
  attribute float alpha;
  varying float vA;
  void main() {
    vA = alpha;
    gl_PointSize = 2.2 * uPR;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const DOT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vA;
  void main() {
    float a = smoothstep(0.5, 0.2, length(gl_PointCoord - 0.5));
    gl_FragColor = vec4(uColor, a * vA * uOpacity);
  }
`;

type P2 = [number, number];

export const linea: Style = {
  id: 'linea',
  name: 'Lámina científica',
  blurb: 'Líneas finas que se dibujan solas, anotadas como una figura de un paper. Sobrio, nítido y atemporal.',
  mount(stage, overlay) {
    const r = rng(23);
    const materials: LineMaterial[] = [];
    const reveals: { geo: { instanceCount: number }; segs: number; delay: number; dur: number }[] = [];

    const material = (color: number, width: number, opacity: number, dashed = false) => {
      const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity, dashed, depthWrite: false });
      if (dashed) {
        m.dashSize = 0.018;
        m.gapSize = 0.014;
      }
      m.resolution.copy(stage.size);
      materials.push(m);
      return m;
    };

    const line = (pts: P2[], z: number, color: number, width: number, opacity: number, delay: number, dashed = false) => {
      const flat: number[] = [];
      for (const [x, y] of pts) flat.push(x, y, z);
      const geo = new LineGeometry();
      geo.setPositions(flat);
      const l = new Line2(geo, material(color, width, opacity, dashed));
      if (dashed) l.computeLineDistances();
      stage.rig.add(l);
      reveals.push({ geo, segs: pts.length - 1, delay, dur: 1.6 });
      return l;
    };

    const segments = (pairs: number[], color: number, width: number, opacity: number, delay: number) => {
      const geo = new LineSegmentsGeometry();
      geo.setPositions(pairs);
      stage.rig.add(new LineSegments2(geo, material(color, width, opacity)));
      reveals.push({ geo, segs: pairs.length / 6, delay, dur: 1.8 });
    };

    const loop = (f: (t: number) => P2, n: number) => {
      const pts: P2[] = [];
      for (let i = 0; i <= n; i++) pts.push(f((i / n) * Math.PI * 2));
      return pts;
    };
    const circle = (x: number, y: number, rad: number, n = 64) => loop((t) => [x + Math.cos(t) * rad, y + Math.sin(t) * rad], n);

    // Background dot grid, far behind: it is what makes the tilt read as depth.
    {
      const pos: number[] = [];
      const alpha: number[] = [];
      for (let x = -3.2; x <= 3.2; x += 0.1) {
        for (let y = -2; y <= 2; y += 0.1) {
          pos.push(x, y, -0.45);
          alpha.push(0.5 + 0.5 * Math.max(0, 1 - Math.hypot(x, y) / 3));
        }
      }
      // Ribosomes sprinkled along the reticulum, in the foreground layer.
      for (const path of erPaths()) {
        for (let i = 0; i < 70; i++) {
          const [px, py] = path[Math.floor(r() * path.length)];
          pos.push(px + gauss(r) * 0.012, py + gauss(r) * 0.012, 0.03);
          alpha.push(2.2);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('alpha', new THREE.Float32BufferAttribute(alpha, 1));
      const mat = new THREE.ShaderMaterial({
        vertexShader: DOT_VERT,
        fragmentShader: DOT_FRAG,
        uniforms: { uPR: { value: stage.renderer.getPixelRatio() }, uColor: { value: new THREE.Color(INK) }, uOpacity: { value: 0.16 } },
        transparent: true,
        depthWrite: false,
      });
      stage.rig.add(new THREE.Points(geo, mat));
    }

    // Membrane: a firm outer line and a dashed inner leaflet.
    line(loop((t) => membranePoint(t), 360), 0, INK, 1.6, 0.95, 0);
    line(loop((t) => membranePoint(t, 0.972), 360), -0.02, INK, 0.9, 0.45, 0.15, true);

    // Cytoskeleton: faint curves from the centrosome out to the membrane.
    {
      const pairs: number[] = [];
      const cx = 0.22;
      const cy = 0.24;
      for (let k = 0; k < 30; k++) {
        const th = (k / 30) * Math.PI * 2 + r() * 0.2;
        const [ex, ey] = membranePoint(th, 0.96);
        const bend = (r() - 0.5) * 0.5;
        const mx = (cx + ex) / 2 - (ey - cy) * bend * 0.4;
        const my = (cy + ey) / 2 + (ex - cx) * bend * 0.4;
        let px = cx;
        let py = cy;
        for (let i = 1; i <= 24; i++) {
          const t = i / 24;
          const qx = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * mx + t * t * ex;
          const qy = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * my + t * t * ey;
          // Microtubules run around the nucleus, not through it.
          if (Math.hypot((px + qx) / 2 - NUCLEUS.x, (py + qy) / 2 - NUCLEUS.y) > NUCLEUS.r * 1.06) pairs.push(px, py, -0.06, qx, qy, -0.06);
          px = qx;
          py = qy;
        }
      }
      segments(pairs, INK, 0.6, 0.08, 0.5);
    }

    // Nucleus: double envelope, pores, hatched chromatin, and the nucleolus in accent.
    line(circle(NUCLEUS.x, NUCLEUS.y, NUCLEUS.r, 128), 0.05, INK, 1.3, 0.95, 0.3);
    line(circle(NUCLEUS.x, NUCLEUS.y, NUCLEUS.r * 0.955, 128), 0.05, INK, 0.8, 0.55, 0.4);
    {
      const pairs: number[] = [];
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2 + 0.2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        pairs.push(NUCLEUS.x + c * NUCLEUS.r * 0.93, NUCLEUS.y + s * NUCLEUS.r * 0.93, 0.06);
        pairs.push(NUCLEUS.x + c * NUCLEUS.r * 1.025, NUCLEUS.y + s * NUCLEUS.r * 1.025, 0.06);
      }
      segments(pairs, ACCENT, 1.2, 0.9, 0.9);
      const hatch: number[] = [];
      const inner = NUCLEUS.r * 0.9;
      const dx = Math.SQRT1_2;
      for (let d = -inner; d <= inner; d += 0.026) {
        const half = Math.sqrt(inner * inner - d * d);
        const cx = NUCLEUS.x - dx * d;
        const cy = NUCLEUS.y + dx * d;
        // Leave the nucleolus clear.
        const t0 = -half;
        const t1 = half;
        const steps = 8;
        for (let i = 0; i < steps; i++) {
          const a = t0 + ((t1 - t0) * i) / steps;
          const b = t0 + ((t1 - t0) * (i + 1)) / steps;
          const ax = cx + dx * a;
          const ay = cy + dx * a;
          const bx = cx + dx * b;
          const by = cy + dx * b;
          if (Math.hypot((ax + bx) / 2 - NUCLEOLUS.x, (ay + by) / 2 - NUCLEOLUS.y) < NUCLEOLUS.r * 1.3) continue;
          hatch.push(ax, ay, 0.04, bx, by, 0.04);
        }
      }
      segments(hatch, INK, 0.7, 0.2, 0.7);
      const spiral: P2[] = [];
      for (let i = 0; i <= 220; i++) {
        const t = i / 220;
        const a = t * Math.PI * 12;
        const rad = NUCLEOLUS.r * t;
        spiral.push([NUCLEOLUS.x + Math.cos(a) * rad, NUCLEOLUS.y + Math.sin(a) * rad]);
      }
      line(spiral, 0.07, ACCENT, 1.1, 0.95, 0.8);
    }

    // Mitochondria: outer membrane, inner membrane, cristae.
    MITOS.forEach((m, i) => {
      const z = 0.02 + (i % 3) * 0.03;
      line(loop((t) => mitoOutline(m, t, 1.16), 72), z, INK, 0.7, 0.4, 0.5 + i * 0.06);
      line(loop((t) => mitoOutline(m, t), 72), z, INK, 1.2, 0.95, 0.55 + i * 0.06);
      line(mitoCristae(m), z, INK, 0.9, 0.75, 0.8 + i * 0.06);
    });

    erPaths().forEach((p, i) => line(p, 0.01 + i * 0.008, INK, 0.85, 0.6, 0.6 + i * 0.08));
    golgiPaths().forEach((p, i) => line(p, 0.03 + i * 0.01, INK, 1.2, 0.85, 0.9 + i * 0.07));
    VESICLES.forEach((v, i) => line(circle(v.x, v.y, v.r, 40), 0.08 + (i % 4) * 0.02, INK, 0.9, 0.8, 1.1 + i * 0.02));

    // Annotations: leader lines in the scene, labels in the DOM.
    const labelEls: { el: HTMLElement; at: THREE.Vector3 }[] = [];
    LABELS.forEach((lab, i) => {
      const [ax, ay] = lab.at;
      const [tx, ty] = lab.to;
      const side = Math.sign(tx) || 1;
      const elbow: P2 = [tx - side * 0.22, ty];
      line([[ax, ay], elbow, [tx, ty]], 0.12, INK, 0.7, 0.55, 1.6 + i * 0.12);
      line(circle(ax, ay, 0.012, 16), 0.12, ACCENT, 1.4, 1, 1.6 + i * 0.12);
      const el = document.createElement('div');
      el.className = `annot ${side > 0 ? 'annot--r' : 'annot--l'}`;
      el.innerHTML = `<span class="annot-n">${String(i + 1).padStart(2, '0')}</span>${lab.text}`;
      el.style.transitionDelay = `${1.9 + i * 0.12}s`;
      overlay.appendChild(el);
      labelEls.push({ el, at: new THREE.Vector3(tx, ty, 0.12) });
    });
    // Scale bar: the cell is about 20 µm across, so half a unit is 5 µm.
    line([[-2.05, -0.98], [-1.55, -0.98]], 0.12, INK, 1.2, 0.9, 2.2);
    segments([-2.05, -1.005, 0.12, -2.05, -0.955, 0.12, -1.55, -1.005, 0.12, -1.55, -0.955, 0.12], INK, 1.2, 0.9, 2.2);
    {
      const el = document.createElement('div');
      el.className = 'annot annot--scale';
      el.textContent = '5 µm';
      el.style.transitionDelay = '2.4s';
      overlay.appendChild(el);
      labelEls.push({ el, at: new THREE.Vector3(-1.8, -1.05, 0.12) });
    }
    const fig = document.createElement('div');
    fig.className = 'fig';
    fig.innerHTML = '<em>Fig. 1</em> Célula eucariota, corte ecuatorial.';
    overlay.appendChild(fig);
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-in')));

    stage.scene.background = new THREE.Color(0x0b0b0c);
    stage.renderer.toneMapping = THREE.NoToneMapping;
    stage.bloom.strength = 0.28;
    stage.bloom.radius = 0.35;
    stage.bloom.threshold = 0.2;
    stage.finish.uniforms.uGrain.value = 0.04;
    stage.finish.uniforms.uFringe.value = 0.006;

    let start = -1;
    const v = new THREE.Vector3();
    return {
      update(f) {
        if (start < 0) start = f.time;
        const t = f.time - start;
        for (const rv of reveals) {
          const p = clamp((t - rv.delay) / rv.dur, 0, 1);
          const e = 1 - Math.pow(1 - p, 3);
          rv.geo.instanceCount = Math.ceil(rv.segs * e);
        }
        stage.rig.updateMatrixWorld();
        for (const { el, at } of labelEls) {
          v.copy(at).applyMatrix4(stage.rig.matrixWorld).project(stage.camera);
          el.style.transform = `translate(${((v.x + 1) / 2) * stage.size.x}px, ${((1 - v.y) / 2) * stage.size.y}px)`;
        }
      },
      resize() {
        for (const m of materials) m.resolution.copy(stage.size);
      },
    };
  },
};
