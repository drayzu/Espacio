import { clamp, smoothstep } from '../lib/math';
import type { World } from './cadena';
import { lang } from '../i18n';

/**
 * The quiet interface: the title (which arrives with the foam, after the opening), world name + one
 * sentence, the scale exponent, and a ruler of the whole journey grouped by territory. The ruler measures the journey (progress), not the scale:
 * otherwise 17 empty orders of magnitude would take most of it. Clicking a world travels there.
 */

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = (n: number) => [...String(n)].map((ch) => SUP[ch] ?? ch).join('');
const EN = lang === 'en';
const nf = new Intl.NumberFormat(EN ? 'en-US' : 'es-CL', { maximumSignificantDigits: 2 });
const UNITS: [number, string][] = [
  [9.461e24, EN ? 'billion light-years' : 'mil millones de años luz'],
  [9.461e21, EN ? 'million light-years' : 'millones de años luz'],
  [9.461e15, EN ? 'light-years' : 'años luz'],
  [1.496e11, EN ? 'AU' : 'UA'],
  [1e3, 'km'],
  [1, 'm'],
  [1e-3, 'mm'],
  [1e-6, 'µm'],
  [1e-9, 'nm'],
  [1e-12, 'pm'],
  [1e-15, 'fm'],
];

const PLANCK = -34.79; // log10 of the Planck length in metres

/**
 * A round length for a scale bar about `target` metres long, in the unit a reader would use:
 * returns the length in metres and how to write it ("200 km", "5 años luz", "10⁻¹⁸ m").
 */
export function roundLength(target: number): { m: number; text: string } {
  const nice = (v: number) => {
    const k = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / k;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * k;
  };
  const e = Math.log10(target);
  if (e < -30) {
    const n = nice(target / Math.pow(10, PLANCK));
    return { m: n * Math.pow(10, PLANCK), text: `${nf.format(n)} ${EN ? 'Planck lengths' : 'longitudes de Planck'}` };
  }
  if (e < -15) {
    const k = Math.round(e);
    return { m: Math.pow(10, k), text: `10${sup(k)} m` };
  }
  const [u, name] = UNITS.find(([u]) => target >= u) ?? UNITS[UNITS.length - 1];
  const n = nice(target / u);
  return { m: n * u, text: `${nf.format(n)} ${name}` };
}

function human(e: number) {
  const tall = EN ? 'across' : 'de alto';
  if (e < -30) return `≈ ${nf.format(Math.pow(10, e - PLANCK))} ${EN ? 'Planck lengths' : 'longitudes de Planck'} ${tall}`;
  if (e < -15) return `≈ 10${sup(Math.round(e + 15))} fm ${tall}`;
  const v = Math.pow(10, e);
  const [u, name] = UNITS.find(([u]) => v >= u) ?? UNITS[UNITS.length - 1];
  return `≈ ${nf.format(v / u)} ${name} ${tall}`;
}

export interface HudActions {
  jump(beat: number): void;
  togglePlay(): void;
  /** Returns whether sound is now on. */
  toggleSound(): boolean;
  /** A world's name has just appeared. */
  arrive(): void;
  /** Returns whether the plate layer is now on. */
  togglePlate(): boolean;
}

/** What the name and sentence lines show: a world, or a moment's own caption. */
type Named = { name: string; fact: string; escala?: string; ficha?: string[] };

/** The opening's share of the interface: the title (0 → 1 comes, 1 → 2 goes) and the chrome around the film (0..1). */
export interface Portada {
  titulo: number;
  cromo: number;
  /** The card that hands on to Tiempo, at the end (0..1). */
  relevo?: number;
}

export function createHud(
  worlds: World[],
  beatOf: (w: World) => number,
  length: number,
  act: HudActions,
  captionAt: (p: number) => Named | null = () => null,
  startOf: (w: World) => number = beatOf,
) {
  const { jump, togglePlay } = act;
  const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
  const intro = $('#intro');
  const cue = $('.cue');
  const brand = $('.brand');
  const hud = $('.hud');
  const nameEl = $('#name');
  const factEl = $('#fact');
  const fichaEl = $('#ficha');
  const expEl = $('#exp');
  const unitEl = $('#unit');
  const ruler = $('#ruler');
  const marker = $('#marker');
  const playBtn = $<HTMLButtonElement>('#play');
  const outro = $('#outro');
  playBtn.addEventListener('click', togglePlay);
  const soundBtn = $<HTMLButtonElement>('#sound');
  const showSound = (on: boolean) => {
    soundBtn.classList.toggle('is-on', on);
    soundBtn.setAttribute('aria-pressed', String(on));
  };
  soundBtn.addEventListener('click', () => showSound(act.toggleSound()));
  const plateBtn = $<HTMLButtonElement>('#plate');
  const showPlate = (on: boolean) => {
    plateBtn.classList.toggle('is-on', on);
    plateBtn.setAttribute('aria-pressed', String(on));
    // With the plate on, the figures the sentence leaves out show under it.
    hud.classList.toggle('con-lamina', on);
  };
  plateBtn.addEventListener('click', () => showPlate(act.togglePlate()));

  const at = (beat: number) => `${clamp(beat / length, 0, 1) * 100}%`;
  const pad = length * 0.012;

  // Territory bands (one per run of neighbouring worlds: the hypothetical comes back at the
  // end), then one tick per world.
  const territories: { name: string; a: number; b: number }[] = [];
  for (const w of worlds) {
    const b = beatOf(w);
    const last = territories[territories.length - 1];
    if (last?.name === w.territory) last.b = b;
    else territories.push({ name: w.territory, a: b, b });
  }
  const bands = territories.map(({ name, a, b }) => {
    const band = document.createElement('div');
    band.className = 'band';
    band.style.top = at(a - pad);
    band.style.height = `calc(${at(b + pad)} - ${at(a - pad)})`;
    band.innerHTML = `<span>${name}</span>`;
    ruler.appendChild(band);
    return band;
  });
  // A band's name only shows where it fits (on a short screen the small territories would
  // write over each other).
  const fitBands = () => {
    for (const band of bands) {
      const span = band.firstElementChild as HTMLElement;
      span.style.visibility = span.offsetHeight + 6 <= band.offsetHeight ? '' : 'hidden';
    }
  };
  fitBands();
  void document.fonts?.ready.then(fitBands);
  addEventListener('resize', fitBands);
  const ticks = worlds.map((w) => {
    const t = document.createElement('button');
    t.className = 'tick';
    t.style.top = at(beatOf(w));
    t.innerHTML = `<span>${w.label}</span>`;
    t.setAttribute('aria-label', w.name);
    t.addEventListener('click', () => jump(beatOf(w)));
    ruler.appendChild(t);
    return t;
  });

  let shown: Named | null | undefined;
  return {
    /**
     * `seen`: log10 of the height actually on screen, when the framing shows more than `e`.
     * `portada`: the title and the chrome, as the opening has them at this point.
     */
    update(e: number, p: number, playing: boolean, seen = e, portada: Portada = { titulo: 0, cromo: 1 }) {
      // The title comes (0 → 1) and goes (1 → 2), rising a little all the while.
      const t = portada.titulo;
      intro.style.opacity = String(smoothstep(0, 1, t) * (1 - smoothstep(1, 2, t)));
      intro.style.transform = `translateY(${t < 1 ? (1 - t) * 16 : -(t - 1) * 24}px)`;
      cue.style.opacity = String(1 - smoothstep(0.05, 0.6, p));
      brand.style.opacity = String(portada.cromo);
      ruler.style.opacity = String(portada.cromo);
      outro.classList.toggle('is-in', (portada.relevo ?? 0) > 0.5);

      const special = worlds.find((w) => w.scaleLabel && Math.abs(e - w.home) < (w.nameSpan ?? 0.4));
      if (special?.scaleLabel) {
        expEl.innerHTML = special.scaleLabel.exp;
        unitEl.textContent = special.scaleLabel.unit;
      } else {
        expEl.innerHTML = `10${sup(Math.round(seen))}<span class="m"> m</span>`;
        unitEl.textContent = human(seen);
      }
      marker.style.top = at(p);

      // A moment's caption takes the place of the world's name while it lasts.
      const caption = captionAt(p);
      // Some moments say whose scale this is: «tú · ≈ 1 m de alto».
      if (caption?.escala && !special) unitEl.textContent = `${caption.escala} · ${human(seen)}`;
      const near: Named | null = caption ?? worlds.find((w) => Math.abs(e - w.home) < (w.nameSpan ?? 0.4)) ?? null;
      // The ruler names only where you are (and what the pointer is on): the world whose stretch
      // of the journey (from its arrival on) you are in.
      let closest = 0;
      worlds.forEach((w, i) => {
        if (startOf(w) <= p + 1e-6) closest = i;
      });
      ticks.forEach((t, i) => t.classList.toggle('is-here', i === closest));
      if (near !== shown) {
        shown = near;
        nameEl.classList.remove('is-in');
        factEl.classList.remove('is-in');
        fichaEl.classList.remove('is-in');
        setTimeout(() => {
          nameEl.textContent = near?.name ?? '';
          factEl.textContent = near?.fact ?? '';
          fichaEl.replaceChildren(...(near?.ficha ?? []).map((t) => Object.assign(document.createElement('p'), { textContent: t })));
          if (near) {
            nameEl.classList.add('is-in');
            factEl.classList.add('is-in');
            fichaEl.classList.add('is-in');
            act.arrive();
          }
        }, 250);
      }
      playBtn.classList.toggle('is-on', playing);
    },
    /** Reflect a change made elsewhere (the S and I keys). */
    showSound,
    showPlate,
  };
}
