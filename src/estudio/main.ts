import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './style.css';
import { clearRig, createStage } from './stage';
import { clamp } from '../lib/math';
import { startLoop } from './loop';
import type { Style, StyleInstance } from './types';
import { particulas } from './styles/particulas';
import { linea } from './styles/linea';
import { capas } from './styles/capas';
import { tinta } from './styles/tinta';
import { luzTinta } from './styles/luz-tinta';

const STYLES: Style[] = [particulas, linea, capas, tinta, luzTinta];

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const overlay = document.querySelector<HTMLElement>('#overlay')!;
const tabs = document.querySelector<HTMLElement>('#tabs')!;
const blurb = document.querySelector<HTMLElement>('#blurb')!;
const stage = createStage(canvas);

let current: StyleInstance | null = null;
let currentIndex = -1;

STYLES.forEach((s, i) => {
  const b = document.createElement('button');
  b.className = 'tab';
  b.innerHTML = `<span class="tab-n">0${i + 1}</span>${s.name}`;
  b.addEventListener('click', () => select(i));
  tabs.appendChild(b);
});

function select(i: number) {
  if (i === currentIndex) return;
  current?.dispose?.();
  clearRig(stage.rig);
  overlay.replaceChildren();
  overlay.classList.remove('is-in');
  stage.renderer.toneMappingExposure = 1;
  currentIndex = i;
  current = STYLES[i].mount(stage, overlay);
  [...tabs.children].forEach((el, k) => el.classList.toggle('is-active', k === i));
  blurb.textContent = STYLES[i].blurb;
  history.replaceState(null, '', `#${i + 1}`);
  document.body.dataset.style = STYLES[i].id;
}

addEventListener('keydown', (e) => {
  const n = Number(e.key);
  if (n >= 1 && n <= STYLES.length) select(n - 1);
});

select(clamp(Number(location.hash.slice(1)) - 1 || 0, 0, STYLES.length - 1));
startLoop(stage, () => current);
