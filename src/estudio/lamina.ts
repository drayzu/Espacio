import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LABELS, MITOS, NUCLEOLUS, NUCLEUS, golgiPaths, membranePoint, mitoOutline } from '../lib/cell';
import { clamp } from '../lib/math';
import type { Stage } from './stage';

/**
 * The scientific plate as a layer: thin outlines, leaders and labels drawn over any style,
 * and undrawn in reverse when switched off.
 */

const INK = 0xece7db;
const ACCENT = 0xff5b2e;
const SHOW_SECONDS = 2.4;

type P2 = [number, number];

export function createLaminaLayer(stage: Stage, overlay: HTMLElement) {
  const group = new THREE.Group();
  stage.rig.add(group);
  const materials: LineMaterial[] = [];
  const strokes: { geo: LineGeometry; segs: number; delay: number; dur: number }[] = [];
  const labels: { el: HTMLElement; at: THREE.Vector3; delay: number }[] = [];

  const stroke = (pts: P2[], color: number, width: number, opacity: number, delay: number, dashed = false) => {
    const flat: number[] = [];
    for (const [x, y] of pts) flat.push(x, y, 0);
    const geo = new LineGeometry();
    geo.setPositions(flat);
    geo.instanceCount = 0;
    const mat = new LineMaterial({ color, linewidth: width, transparent: true, opacity, dashed, depthTest: false, depthWrite: false });
    if (dashed) {
      mat.dashSize = 0.02;
      mat.gapSize = 0.016;
    }
    mat.resolution.copy(stage.size);
    materials.push(mat);
    const l = new Line2(geo, mat);
    l.renderOrder = 10;
    if (dashed) l.computeLineDistances();
    group.add(l);
    strokes.push({ geo, segs: pts.length - 1, delay, dur: 0.9 });
  };

  const loop = (f: (t: number) => P2, n: number) => {
    const pts: P2[] = [];
    for (let i = 0; i <= n; i++) pts.push(f((i / n) * Math.PI * 2));
    return pts;
  };
  const circle = (x: number, y: number, r: number, n = 96) => loop((t) => [x + Math.cos(t) * r, y + Math.sin(t) * r], n);

  // Outlines that trace the structures underneath.
  stroke(loop((t) => membranePoint(t, 1.0), 360), INK, 0.9, 0.5, 0, true);
  stroke(circle(NUCLEUS.x, NUCLEUS.y, NUCLEUS.r * 1.03), INK, 1.1, 0.75, 0.25);
  stroke(circle(NUCLEOLUS.x, NUCLEOLUS.y, NUCLEOLUS.r * 1.25, 48), ACCENT, 1.1, 0.9, 0.45);
  MITOS.forEach((m, i) => stroke(loop((t) => mitoOutline(m, t, 1.35), 64), INK, 0.8, 0.55, 0.35 + i * 0.05));
  golgiPaths().forEach((p, i) => stroke(p, INK, 0.8, 0.5, 0.5 + i * 0.04));

  // Leaders, anchors and labels.
  LABELS.forEach((lab, i) => {
    const [ax, ay] = lab.at;
    const [tx, ty] = lab.to;
    const side = Math.sign(tx) || 1;
    const d = 0.9 + i * 0.1;
    stroke([[ax, ay], [tx - side * 0.22, ty], [tx, ty]], INK, 0.8, 0.6, d);
    stroke(circle(ax, ay, 0.014, 16), ACCENT, 1.5, 1, d);
    const el = document.createElement('div');
    el.className = `annot ${side > 0 ? 'annot--r' : 'annot--l'}`;
    el.style.transition = 'none';
    el.innerHTML = `<span class="annot-n">${String(i + 1).padStart(2, '0')}</span>${lab.text}`;
    overlay.appendChild(el);
    labels.push({ el, at: new THREE.Vector3(tx, ty, 0), delay: d + 0.5 });
  });

  // Scale bar: the cell is about 20 µm across.
  stroke([[-2.05, -0.98], [-1.55, -0.98]], INK, 1.2, 0.9, 1.4);
  const scale = document.createElement('div');
  scale.className = 'annot annot--scale';
  scale.style.transition = 'none';
  scale.textContent = '5 µm';
  overlay.appendChild(scale);
  labels.push({ el: scale, at: new THREE.Vector3(-1.8, -1.05, 0), delay: 1.6 });

  const fig = document.createElement('div');
  fig.className = 'fig fig--live';
  fig.innerHTML = '<em>Fig. 1</em> Célula eucariota · 10⁻⁵ m';
  overlay.appendChild(fig);

  let on = false;
  let t = 0;
  const v = new THREE.Vector3();

  return {
    get on() {
      return on;
    },
    toggle(value = !on) {
      on = value;
    },
    update(dt: number) {
      // Draw in at normal speed, undraw twice as fast.
      t = clamp(t + (on ? dt : -dt * 2), 0, SHOW_SECONDS);
      for (const s of strokes) {
        const p = clamp((t - s.delay) / s.dur, 0, 1);
        s.geo.instanceCount = Math.ceil(s.segs * (1 - Math.pow(1 - p, 3)));
      }
      group.visible = t > 0;
      group.updateMatrixWorld();
      for (const { el, at, delay } of labels) {
        el.style.opacity = String(clamp((t - delay) / 0.4, 0, 1));
        v.copy(at).applyMatrix4(group.matrixWorld).project(stage.camera);
        el.style.transform = `translate(${((v.x + 1) / 2) * stage.size.x}px, ${((1 - v.y) / 2) * stage.size.y}px)`;
      }
      fig.style.opacity = String(clamp((t - 1.2) / 0.6, 0, 1));
    },
    resize() {
      for (const m of materials) m.resolution.copy(stage.size);
    },
  };
}
