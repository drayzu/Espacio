import * as THREE from 'three';
import type { World } from './cadena';
import { roundLength } from './hud';

/**
 * The plate layer (key I): the scientific plate laid over the living worlds. A scale bar that is
 * true at every scale, and each world's parts named with thin leader lines, in the plate's own
 * language (mono capitals, fine lines, an accent dot on the thing itself). Off by default: the
 * journey is meant to be seen first, and read when one wants to.
 */

const SVG = 'http://www.w3.org/2000/svg';
/** How far from its home scale a world keeps its notes (orders of magnitude). */
const SPAN = 0.75;
/** Length of the leader lines, px. */
const LEAD = 54;

/** Height of a label row, px. */
const ROW = 15;

interface Placed {
  it: Item;
  /** The point itself, and where its leader ends. */
  x: number;
  y: number;
  lx: number;
  ly: number;
  left: boolean;
  /** The label's horizontal extent. */
  x0: number;
  x1: number;
}

interface Item {
  v: THREE.Vector3;
  e?: [number, number];
  always: boolean;
  label: HTMLDivElement;
  line: SVGLineElement;
  dot: SVGCircleElement;
}

export function createLamina(worlds: World[], camera: THREE.Camera) {
  const layer = document.querySelector<HTMLDivElement>('#lamina')!;
  const svg = layer.querySelector<SVGSVGElement>('svg')!;
  const bar = layer.querySelector<HTMLDivElement>('.bar')!;
  const barLine = bar.querySelector<HTMLDivElement>('.bar-line')!;
  const barText = bar.querySelector<HTMLDivElement>('.bar-text')!;
  let on = false;

  const items: Item[][] = worlds.map((w) =>
    (w.notes ?? []).map((n) => {
      const label = document.createElement('div');
      // A measure keeps its case (10⁻²⁴ m, not M).
      label.className = /[⁰¹²³⁴⁵⁶⁷⁸⁹]|\d\s*[µnk]?m\b/.test(n.text) ? 'note is-measure' : 'note';
      if (n.always) label.classList.add('is-always');
      label.textContent = n.text;
      layer.appendChild(label);
      const line = document.createElementNS(SVG, 'line');
      const dot = document.createElementNS(SVG, 'circle');
      dot.setAttribute('r', '2.2');
      svg.append(line, dot);
      return { v: new THREE.Vector3(...n.at), e: n.e, always: !!n.always, label, line, dot };
    }),
  );

  const hide = (it: Item) => {
    it.label.classList.remove('is-in');
    it.line.style.opacity = '0';
    it.dot.style.opacity = '0';
  };
  const p = new THREE.Vector3();

  return {
    get on() {
      return on;
    },
    toggle() {
      on = !on;
      layer.classList.toggle('is-on', on);
      return on;
    },
    /** After rendering (world matrices are current). `seen`: log10 of the height on screen. */
    update(e: number, seen: number, hypothetical: boolean) {
      const W = innerWidth;
      const H = innerHeight;

      // The scale bar: a round length about 120 px long. Where the scale itself breaks, none.
      bar.classList.toggle('is-off', hypothetical);
      if (on && !hypothetical) {
        const pxPerM = H / Math.pow(10, seen);
        const { m, text } = roundLength(120 / pxPerM);
        barLine.style.width = `${(m * pxPerM).toFixed(1)}px`;
        if (barText.textContent !== text) barText.textContent = text;
      }

      const placed: Placed[] = [];
      worlds.forEach((w, i) => {
        const show = w.group.visible && w.alpha > 0.45 && Math.abs(e - w.home) < (w.noteSpan ?? SPAN);
        for (const it of items[i]) {
          // With the layer off only the notes that are always shown are kept up to date.
          if (!on && !it.always) continue;
          if (!show || (it.e && (e < it.e[0] || e > it.e[1]))) {
            hide(it);
            continue;
          }
          p.copy(it.v).applyMatrix4(w.group.matrixWorld).project(camera);
          const x = ((p.x + 1) / 2) * W;
          const y = ((1 - p.y) / 2) * H;
          if (p.z > 1 || x < 24 || x > W - 24 || y < 24 || y > H - 24) {
            hide(it);
            continue;
          }
          if (it.always) {
            // Sitting on its point, just above it.
            it.label.style.transform = `translate(${x.toFixed(1)}px, ${(y - 8).toFixed(1)}px) translate(-50%, -100%)`;
            it.label.classList.add('is-in');
            it.line.style.opacity = '0';
            it.dot.style.opacity = '0';
            continue;
          }
          // The leader points away from the centre of the screen, so labels fan outward.
          let dx = x - W / 2;
          let dy = y - H / 2;
          const len = Math.hypot(dx, dy);
          if (len < 30) {
            dx = 0.7;
            dy = -0.7;
          } else {
            dx /= len;
            dy /= len;
          }
          const width = (it.label.textContent?.length ?? 0) * 7.4 + 16;
          // A label that would run off the screen (or under the ruler) goes to the other side.
          if (dx >= 0 && x + dx * LEAD + width > W - 72) dx = -Math.abs(dx) - 0.2;
          else if (dx < 0 && x + dx * LEAD - width < 12) dx = Math.abs(dx) + 0.2;
          const left = dx >= 0;
          const lx = x + Math.sign(dx) * Math.max(Math.abs(dx), 0.35) * LEAD;
          placed.push({ it, x, y, lx, ly: y + dy * LEAD * 0.75, left, x0: left ? lx : lx - width, x1: left ? lx + width : lx });
        }
      });

      // Labels that would overlap step down out of each other's way.
      placed.sort((a, b) => a.ly - b.ly);
      placed.forEach((a, k) => {
        for (let j = 0; j < k; j++) {
          const b = placed[j];
          if (a.x0 < b.x1 && b.x0 < a.x1 && a.ly < b.ly + ROW) a.ly = b.ly + ROW;
        }
      });
      for (const { it, x, y, lx, ly, left } of placed) {
        it.line.setAttribute('x1', x.toFixed(1));
        it.line.setAttribute('y1', y.toFixed(1));
        it.line.setAttribute('x2', lx.toFixed(1));
        it.line.setAttribute('y2', ly.toFixed(1));
        it.dot.setAttribute('cx', x.toFixed(1));
        it.dot.setAttribute('cy', y.toFixed(1));
        it.label.style.transform = `translate(${(lx + (left ? 6 : -6)).toFixed(1)}px, ${ly.toFixed(1)}px) translate(${left ? '0' : '-100%'}, -50%)`;
        it.label.classList.add('is-in');
        it.line.style.opacity = '';
        it.dot.style.opacity = '';
      }
    },
  };
}
