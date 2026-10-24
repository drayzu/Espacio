import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './style.css';
import { clearRig, createStage } from './stage';
import { startLoop } from './loop';
import type { Style, StyleInstance } from './types';
import { particulas } from './styles/particulas';
import { tinta } from './styles/tinta';
import { atomoPuntos, atomoTinta } from './mundos/atomo';
import { tierraPuntos, tierraTinta } from './mundos/tierra';
import { galaxiaPuntos, galaxiaTinta } from './mundos/galaxia';

type Mode = 'tinta' | 'puntos';

const WORLDS: { id: string; name: string; exp: string; tinta: Style; puntos: Style }[] = [
  { id: 'atomo', name: 'Átomo', exp: '10⁻¹⁰', tinta: atomoTinta, puntos: atomoPuntos },
  { id: 'celula', name: 'Célula', exp: '10⁻⁵', tinta, puntos: particulas },
  { id: 'tierra', name: 'Tierra', exp: '10⁷', tinta: tierraTinta, puntos: tierraPuntos },
  { id: 'galaxia', name: 'Galaxia', exp: '10²¹', tinta: galaxiaTinta, puntos: galaxiaPuntos },
];
const MODES: { id: Mode; name: string }[] = [
  { id: 'tinta', name: 'Tinta viva' },
  { id: 'puntos', name: 'Partículas de luz' },
];

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const overlay = document.querySelector<HTMLElement>('#overlay')!;
const tabs = document.querySelector<HTMLElement>('#tabs')!;
const modes = document.querySelector<HTMLElement>('#modes')!;
const blurb = document.querySelector<HTMLElement>('#blurb')!;
const stage = createStage(canvas);

let current: StyleInstance | null = null;
let world = 0;
let mode: Mode = 'tinta';

WORLDS.forEach((w, i) => {
  const b = document.createElement('button');
  b.className = 'tab';
  b.innerHTML = `<span class="tab-n">${w.exp} m</span>${w.name}`;
  b.addEventListener('click', () => show(i, mode));
  tabs.appendChild(b);
});
MODES.forEach((m) => {
  const b = document.createElement('button');
  b.className = 'tab';
  b.textContent = m.name;
  b.addEventListener('click', () => show(world, m.id));
  modes.appendChild(b);
});

function show(w: number, m: Mode) {
  current?.dispose?.();
  clearRig(stage.rig);
  overlay.replaceChildren();
  stage.renderer.toneMappingExposure = 1;
  world = w;
  mode = m;
  const style = WORLDS[w][m];
  current = style.mount(stage, overlay);
  [...tabs.children].forEach((el, k) => el.classList.toggle('is-active', k === w));
  [...modes.children].forEach((el, k) => el.classList.toggle('is-active', MODES[k].id === m));
  blurb.textContent = style.blurb;
  history.replaceState(null, '', `#${WORLDS[w].id}/${m}`);
}

addEventListener('keydown', (e) => {
  const n = Number(e.key);
  if (n >= 1 && n <= WORLDS.length) show(n - 1, mode);
  if (e.key.toLowerCase() === 't') show(world, mode === 'tinta' ? 'puntos' : 'tinta');
});

const [hashWorld, hashMode] = location.hash.slice(1).split('/');
show(Math.max(0, WORLDS.findIndex((w) => w.id === hashWorld)), hashMode === 'puntos' ? 'puntos' : 'tinta');
startLoop(stage, () => current);
