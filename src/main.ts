import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './style.css';
import * as THREE from 'three';
import { damp } from './lib/math';
import { Chain, type WorldData, type WorldModule } from './engine/cadena';
import { Timeline } from './engine/timeline';
import { createPost } from './engine/post';
import { createScroll } from './engine/scroll';
import { createScaleDust } from './engine/polvo';
import { createHud } from './engine/hud';
import { createSound } from './engine/sonido';
import { createLamina } from './engine/lamina';
import { contactSheet } from './engine/contactos';
import { crearMundos } from './mundos';
import { lang, switchLang, tx } from './i18n';

/**
 * Potencias. The journey is a chain of world modules, smallest first. Each brings its own
 * choreography; together they form one timeline that the page scroll moves through.
 */

const MODULES: WorldModule[] = crearMundos();

/** Scene units visible vertically at the focus, whatever the field of view (dolly zoom keeps it). */
const VIEW_H = 2;

const post = createPost(document.querySelector<HTMLCanvasElement>('#scene')!);
const { renderer, scene, camera } = post;
const root = new THREE.Group();
scene.add(root);

/**
 * Two workers generate the worlds off the main thread (the heaviest take over a second), so the
 * journey never stalls. Without workers, worlds are generated in place.
 */
function workshop(): ((id: string) => Promise<WorldData>) | undefined {
  try {
    const pending = new Map<number, { resolve: (d: WorldData) => void; reject: (e: unknown) => void }>();
    const workers = [0, 1].map(() => {
      const w = new Worker(new URL('./engine/taller.ts', import.meta.url), { type: 'module' });
      w.onmessage = (ev: MessageEvent<{ ticket: number; data?: WorldData; error?: string }>) => {
        const job = pending.get(ev.data.ticket);
        pending.delete(ev.data.ticket);
        if (ev.data.error !== undefined) job?.reject(ev.data.error);
        else job?.resolve(ev.data.data!);
      };
      w.onerror = () => {
        for (const job of pending.values()) job.reject('worker');
        pending.clear();
      };
      return w;
    });
    let ticket = 0;
    return (id) =>
      new Promise((resolve, reject) => {
        const t = ++ticket;
        pending.set(t, { resolve, reject });
        workers[t % workers.length].postMessage({ id, ticket: t });
      });
  } catch {
    return undefined;
  }
}

const chain = new Chain(
  MODULES.map((m) => m.spec),
  root,
  workshop(),
);
// The worlds' words in the visitor's language (the page's own copy too).
for (const w of chain.worlds) {
  w.name = tx(w.name);
  w.fact = tx(w.fact);
  w.label = tx(w.label);
  w.territory = tx(w.territory);
  for (const n of w.notes ?? []) n.text = tx(n.text);
  if (w.scaleLabel) w.scaleLabel = { ...w.scaleLabel, unit: tx(w.scaleLabel.unit) };
}
document.documentElement.lang = lang;
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
  const text = [...el.childNodes].find((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim());
  if (text) text.textContent = tx(text.textContent!.trim());
}
for (const el of document.querySelectorAll<HTMLElement>('[data-i18n-label]')) el.setAttribute('aria-label', tx(el.getAttribute('aria-label')!));
document.querySelector('meta[name="description"]')?.setAttribute('content', tx(document.querySelector('meta[name="description"]')!.getAttribute('content')!));
const langBtn = document.querySelector<HTMLButtonElement>('#lang')!;
langBtn.querySelector('.chip-t')!.textContent = lang === 'en' ? 'Español' : 'English';
// (On phones only the key shows: the language it switches to.)
langBtn.querySelector('.chip-k')!.textContent = lang === 'en' ? 'ES' : 'EN';
langBtn.setAttribute('aria-label', lang === 'en' ? 'Ver en español' : 'View in English');
langBtn.addEventListener('click', switchLang);

const tl = new Timeline({ e: chain.worlds[0].home, yaw: 0, pitch: 0, roll: 0, fov: 36 });
// Where each world's stretch of the journey begins (its arrival), for the ruler.
const starts = new Map<string, number>();
MODULES.forEach((m, i) => {
  starts.set(chain.worlds[i].id, tl.length);
  m.choreo(tl, chain.worlds[i]);
});
// A last breath on the final world, for the closing line.
tl.wait(1.2);

const scroll = createScroll(document.querySelector<HTMLElement>('#spacer')!, tl.length);
const dust = createScaleDust(post.dpr);
scene.add(dust.points);
const sound = createSound();
const lamina = createLamina(chain.worlds, camera);
// `?lamina` opens the page with the plate layer on.
if (new URLSearchParams(location.search).has('lamina')) queueMicrotask(() => hud.showPlate(lamina.toggle()));
// Past this exponent the scale is symbolic (the hypothetical worlds): no scale bar there.
const scaleBreaks = (() => {
  const w = chain.worlds.find((x) => x.scaleLabel);
  return w ? w.home - (w.nameSpan ?? 0.4) : Infinity;
})();
const hud = createHud(chain.worlds, (w) => tl.at(w.id), tl.length, {
  jump: (b) => scroll.jump(b),
  togglePlay: () => scroll.togglePlay(),
  toggleSound: () => sound.toggle(),
  arrive: () => sound.chime(),
  togglePlate: () => lamina.toggle(),
}, (p) => tl.captionAt(p), (w) => starts.get(w.id) ?? 0);
chain.prebuild(tl.get('e', 0));

/**
 * Worlds are framed by height. On a portrait screen that would crop them at the sides, so the
 * camera shows a little more (and the readout says so).
 */
let fit = 1;
const refit = () => {
  fit = Math.max(1, Math.min(1.7, 0.78 / (innerWidth / innerHeight)));
};
refit();
addEventListener('resize', () => {
  post.resize();
  refit();
});

const mouse = new THREE.Vector2();
const mouseTarget = new THREE.Vector2();
addEventListener('pointermove', (ev) => mouseTarget.set((ev.clientX / innerWidth) * 2 - 1, -((ev.clientY / innerHeight) * 2 - 1)));
addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const k = ev.key.toLowerCase();
  if (k === 'a') scroll.togglePlay();
  if (k === 's') hud.showSound(sound.toggle());
  if (k === 'i') hud.showPlate(lamina.toggle());
  if (k === 'l') switchLang();
});

// Reduced motion: the view does not lean with the pointer.
const calm = matchMedia('(prefers-reduced-motion: reduce)');
const travel = new THREE.Vector3();
const aimAt = new THREE.Vector3();
const orbit = new THREE.Quaternion();
const look = new THREE.Quaternion();
const euler = new THREE.Euler(0, 0, 0, 'YXZ');
const tint = new THREE.Color();
const tintB = new THREE.Color();
const alphas = new Map<string, number>();
const alphaOf = (id: string) => alphas.get(id) ?? 0;

let last = performance.now();
let prevE = tl.get('e', 0);
let prevP = 0;
function step(now: number) {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  // Reduced motion: the ambient motions (trembling particles, turning figures, pulses) hold still;
  // the journey itself still follows the scroll.
  const time = calm.matches ? 0 : now / 1000;

  const p = scroll.update(dt);
  const e = tl.get('e', p);
  const zoomSpeed = (e - prevE) / Math.max(dt, 1e-3);
  prevE = e;

  // Dolly zoom: the field of view changes, the scale at the focus does not.
  const fov = tl.get('fov', p);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  camera.fov = fov;
  camera.position.set(0, 0, VIEW_H / 2 / tanHalf);
  // A long lens sets the camera far back (the deep field's is 0.06°): the far plane follows it.
  camera.far = Math.max(200, camera.position.z * 4);
  camera.near = Math.max(0.001, camera.position.z * 1e-5);
  camera.updateProjectionMatrix();

  chain.place(
    e,
    VIEW_H / fit,
    (i) => {
      const id = chain.worlds[i].id;
      travel.set(tl.get(`${id}.tx`, p), tl.get(`${id}.ty`, p), tl.get(`${id}.tz`, p));
      return travel.lengthSq() > 0 ? travel : null;
    },
    (i) => tl.get(`${chain.worlds[i].id}.keep`, p),
    (i) => {
      const id = chain.worlds[i].id;
      const k = tl.get(`${id}.aim`, p);
      if (k <= 0) return null;
      aimAt.set(tl.get(`${id}.ax`, p), tl.get(`${id}.ay`, p), tl.get(`${id}.az`, p));
      return { k, at: aimAt };
    },
  );

  chain.warm(e);

  // Camera: the chain's view of the current worlds, the choreography's orbit, a little mouse.
  mouse.x = damp(mouse.x, mouseTarget.x, 3, dt);
  mouse.y = damp(mouse.y, mouseTarget.y, 3, dt);
  orbit.setFromEuler(euler.set(tl.get('pitch', p), tl.get('yaw', p), tl.get('roll', p), 'YXZ'));
  look.setFromEuler(euler.set(calm.matches ? 0 : -mouse.y * 0.12, calm.matches ? 0 : mouse.x * 0.2, 0, 'YXZ'));
  root.quaternion.copy(look).multiply(orbit).multiply(chain.view);

  // Worlds.
  const focal = renderer.domElement.height / 2 / tanHalf;
  for (const w of chain.worlds) alphas.set(w.id, w.alpha);
  for (const w of chain.worlds) {
    if (!w.content || !w.group.visible) continue;
    for (const c of w.content.clouds) {
      c.u.uTime.value = time;
      c.u.uFocal.value = focal;
      c.u.uMinPx.value = 1.6 * post.dpr;
      c.u.uMaxPx.value = 22 * post.dpr;
      c.u.uAlpha.value = w.alpha;
      c.u.uCamDist.value = camera.position.z;
    }
    w.content.update?.({ time, p, e, home: w.home, tl, alpha: w.alpha, alphaOf });
  }

  const a = chain.worlds[chain.segment];
  const b = chain.worlds[chain.segment + 1];
  tint.setHex(a.tint).lerp(tintB.setHex(b.tint), chain.blend);
  const scrollSpeed = (p - prevP) / Math.max(dt, 1e-3);
  prevP = p;
  dust.update(e + 0.4 * p, Math.abs(zoomSpeed) + 0.9 * Math.abs(scrollSpeed), innerWidth / innerHeight, tint);
  hud.update(e, p, scroll.playing, e + Math.log10(fit));
  sound.update(e, zoomSpeed, chain.segment + (chain.blend > 0.5 ? 1 : 0));

  post.render(time, zoomSpeed);
  lamina.update(e, e + Math.log10(fit), e > scaleBreaks);
}
/**
 * Adaptive quality: if frames run slow for a couple of seconds, render fewer pixels (down to 60%
 * of the density); with room to spare for a while, step back up. Only while the page is visible,
 * after the first seconds (worlds being built), and ignoring stalls (a hidden tab, a long pause).
 */
let quality = 1;
let avg = 1 / 60;
let slow = 0;
let fast = 0;
let lastRaw = performance.now();
function adapt(now: number) {
  const raw = (now - lastRaw) / 1000;
  lastRaw = now;
  if (now < 4000 || raw > 0.1 || document.visibilityState !== 'visible') return;
  avg += (raw - avg) * 0.05;
  if (avg > 1 / 40) {
    slow += raw;
    fast = 0;
  } else if (avg < 1 / 57) {
    fast += raw;
    slow = 0;
  } else {
    slow = fast = 0;
  }
  if (slow > 2 && quality > 0.6) {
    quality = Math.max(0.6, quality * 0.85);
    post.setQuality(quality);
    slow = 0;
    avg = 1 / 50;
  } else if (fast > 8 && quality < 1) {
    quality = Math.min(1, quality * 1.12);
    post.setQuality(quality);
    fast = 0;
  }
}

function frame(now: number) {
  adapt(now);
  step(now);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debugging aid: `?debug` exposes the chain and timeline in the console, and
// `potencias.sheet([beats])` lays a contact sheet of the journey over the page.
if (new URLSearchParams(location.search).has('debug')) {
  const sheet = contactSheet({
    freeze: (b) => scroll.freeze(b),
    held: () => scroll.held,
    step,
    worlds: chain.worlds,
    canvas: renderer.domElement,
    labelOf: (b) => {
      let id = '';
      for (const w of chain.worlds) if (tl.at(w.id) <= b + 1e-6) id = w.id;
      return id;
    },
  });
  Object.assign(window, { potencias: { chain, tl, camera, root, sound, post, renderer, sheet, step, seek: (b: number | null) => scroll.freeze(b) } });
}
