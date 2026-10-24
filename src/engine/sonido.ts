import { clamp } from '../lib/math';

/**
 * Sound: an ambient score made in the browser, with no files. Off until asked for (browsers need
 * a gesture first, and silence is the polite default).
 *
 * - A drone of four voices whose root follows the scale: glassy among quarks, deep among the
 *   galaxies (about 260 Hz at Planck's length, about 40 Hz at the multiverse).
 * - Each world has its own chord; the voices glide to it as the journey crosses into the world.
 * - Wind: filtered noise that rises with the speed of the zoom.
 * - A soft bell when a world's name appears.
 * - All of it through a long generated reverb, and every voice breathes slowly.
 */

/** Open voicings (semitones over the root), one per world in turn. */
const CHORDS = [
  [0, 7, 12, 19],
  [0, 5, 12, 17],
  [0, 7, 14, 19],
  [0, 3, 10, 15],
  [0, 7, 12, 16],
  [0, 5, 10, 15],
];

const LEVEL = 0.6;

function impulse(ctx: BaseAudioContext, seconds: number, decay: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function noise(ctx: BaseAudioContext, seconds: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** The drone's root for scale exponent `e`. */
const rootOf = (e: number) => 110 * Math.pow(2, (-e - 4) * 0.042);

interface Graph {
  ctx: BaseAudioContext;
  master: GainNode;
  /** Where sounds go: dry and into the reverb. */
  bus: GainNode;
  tone: BiquadFilterNode;
  voices: { oscs: OscillatorNode[]; gain: GainNode }[];
  wind: GainNode;
  windBand: BiquadFilterNode;
}

/** The whole graph, on any context (an offline one renders it for a check). */
export function buildSound(ctx: BaseAudioContext): Graph {
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 5, 3);
  const wet = ctx.createGain();
  wet.gain.value = 0.7;
  reverb.connect(wet).connect(master);
  const bus = ctx.createGain();
  bus.connect(master);
  bus.connect(reverb);

  // The drone, darkened by a low-pass that opens while zooming.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 900;
  tone.Q.value = 0.4;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.16;
  tone.connect(droneGain).connect(bus);

  const voices = CHORDS[0].map((_, i) => {
    const gain = ctx.createGain();
    gain.gain.value = i === 0 ? 0.32 : 0.2;
    gain.connect(tone);
    // Slow breathing, a different period per voice.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.045 + i * 0.017;
    const depth = ctx.createGain();
    depth.gain.value = 0.08;
    lfo.connect(depth).connect(gain.gain);
    lfo.start();
    // Two slightly detuned oscillators per voice.
    const oscs = [-4, 4].map((cents) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.detune.value = cents;
      o.connect(gain);
      o.start();
      return o;
    });
    return { oscs, gain };
  });

  // Wind.
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx, 2);
  src.loop = true;
  const windBand = ctx.createBiquadFilter();
  windBand.type = 'bandpass';
  windBand.frequency.value = 500;
  windBand.Q.value = 0.8;
  const wind = ctx.createGain();
  wind.gain.value = 0;
  src.connect(windBand).connect(wind).connect(bus);
  src.start();

  return { ctx, master, bus, tone, voices, wind, windBand };
}

export function createSound() {
  let g: Graph | null = null;
  let actx: AudioContext | null = null;
  let on = false;
  let chord = -1;
  let last = 0;
  let root = rootOf(0);

  const glide = (p: AudioParam, v: number, t: number) => g && p.setTargetAtTime(v, g.ctx.currentTime, t);

  document.addEventListener('visibilitychange', () => {
    if (!actx || !on) return;
    if (document.hidden) actx.suspend();
    else actx.resume();
  });

  return {
    get on() {
      return on;
    },
    /** For debugging: the audio context, once built. */
    get context() {
      return actx;
    },
    toggle() {
      on = !on;
      if (on) {
        actx ??= new AudioContext();
        g ??= buildSound(actx);
        actx.resume();
        glide(g.master.gain, LEVEL, 0.6);
      } else if (g && actx) {
        glide(g.master.gain, 0, 0.3);
        const ctx = actx;
        setTimeout(() => {
          if (!on) ctx.suspend();
        }, 1600);
      }
      return on;
    },
    /** `speed`: orders of magnitude per second; `world`: index of the world in view. */
    update(e: number, speed: number, world: number) {
      if (!g || !on) return;
      const now = performance.now();
      if (now - last < 50) return;
      last = now;
      root = rootOf(e);
      const k = world % CHORDS.length;
      const glideT = k !== chord ? 0.9 : 0.25;
      chord = k;
      g.voices.forEach((v, i) => {
        const f = root * Math.pow(2, CHORDS[k][i] / 12);
        for (const o of v.oscs) glide(o.frequency, f, glideT);
      });
      const s = Math.abs(speed);
      glide(g.tone.frequency, 700 + clamp(s, 0, 8) * 450, 0.2);
      glide(g.wind.gain, Math.pow(clamp(s / 6, 0, 1), 1.4) * 0.32, 0.15);
      glide(g.windBand.frequency, 350 + clamp(s, 0, 10) * 220, 0.2);
    },
    /** A soft bell, tuned to the chord, when a world arrives. */
    chime() {
      if (!g || !on) return;
      const { ctx } = g;
      const t = ctx.currentTime;
      const f = root * 4 * Math.pow(2, CHORDS[Math.max(chord, 0)][2] / 12);
      for (const [mult, level, decay] of [
        [1, 0.05, 3.2],
        [2.76, 0.018, 1.6],
        [5.4, 0.008, 0.8],
      ]) {
        const o = ctx.createOscillator();
        o.frequency.value = Math.min(f * mult, 9000);
        const a = ctx.createGain();
        a.gain.setValueAtTime(0, t);
        a.gain.linearRampToValueAtTime(level, t + 0.02);
        a.gain.exponentialRampToValueAtTime(0.0001, t + decay);
        o.connect(a).connect(g.bus);
        o.start(t);
        o.stop(t + decay + 0.1);
      }
    },
  };
}
