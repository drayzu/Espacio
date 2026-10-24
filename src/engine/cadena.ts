import * as THREE from 'three';
import { smoothstep } from '../lib/math';
import type { Cloud } from './points';
import type { Timeline } from './timeline';

/**
 * A chain of worlds, smallest first, each sitting inside the next at its real place and size.
 *
 * Precision: world matrices are composed in double precision *relative to the pivot world* (the
 * smaller end of the current segment), and only for worlds near it. Ratios between visible worlds
 * stay within a few orders of magnitude, so the full 10⁻³⁵ … 10²⁷ m range never reaches the GPU raw.
 * Orientation is tracked separately as absolute quaternions, which lose nothing over any range.
 *
 * Built for a long journey: a world builds its particles only when the journey comes near it and
 * frees them once it is far behind or ahead, so dozens of worlds cost what a handful do.
 * Building is split in two: `generate` (heavy, pure, runs in a worker when one is given) and
 * `assemble` (cheap, on the main thread), so the frame never stalls while a world is made.
 */

export interface WorldFrame {
  time: number;
  /** Scroll progress in beats. */
  p: number;
  tl: Timeline;
  /** Current scale exponent, and the one at which this world is framed. */
  e: number;
  home: number;
  /** This world's visibility, 0..1. */
  alpha: number;
  /** Another world's visibility (to hide a stand-in while the real thing shows). */
  alphaOf(id: string): number;
}

/** An annotation of the plate layer (key I): a point in the world's own units, and its name. */
export interface Note {
  at: [number, number, number];
  text: string;
  /** Only between these scale exponents (e.g. a ring named only while it looks a good size). */
  e?: [number, number];
  /**
   * Shown even with the plate layer off, sitting on its point without a leader (a measure that is
   * the content itself, like the powers of ten across the desert).
   */
  always?: boolean;
}

/** What `generate` returns: plain objects and typed arrays (it may cross to a worker and back). */
export type WorldData = Record<string, unknown>;

/** The heavy part of a world, built on demand. */
export interface WorldContent {
  object: THREE.Object3D;
  clouds: Cloud[];
  update?(f: WorldFrame): void;
}

export interface WorldSpec {
  id: string;
  /** Territory it belongs to (for the ruler and navigation). */
  territory: string;
  name: string;
  /** One sentence. */
  fact: string;
  /** Short label for the scale ruler. */
  label: string;
  /** log10 of metres per local unit. */
  unitExp: number;
  /** Local units visible vertically when the world is framed. */
  frame: number;
  /** Where this world's origin sits inside the next world, in that world's units. */
  anchor?: THREE.Vector3;
  /** The next world's direction this world's x axis follows. */
  anchorDir?: THREE.Vector3;
  /** Full orientation inside the next world (overrides anchorDir): e.g. a leaf on its twig. */
  anchorRot?: THREE.Quaternion;
  /** What the camera frames, in local units. */
  frameCenter: THREE.Vector3;
  /**
   * Preferred viewing angle (Euler, radians), or 'continue' to keep looking the way the previous
   * (smaller) world was seen: the zoom out then needs no turn at all.
   */
  view: [number, number, number] | 'continue';
  /** Fade in from..to, fade out from..to, as exponents relative to home. */
  fade: [number, number, number, number];
  /** Colour of the scale dust while this world is in view. */
  tint: number;
  /** How far (in orders of magnitude) from home its name and sentence stay on screen. Default 0.4. */
  nameSpan?: number;
  /**
   * For hypothetical worlds whose scale no longer fits a power of ten: what the readout shows
   * instead (HTML), and the line under it.
   */
  scaleLabel?: { exp: string; unit: string };
  /** Annotations for the plate layer: points in local units and what they are. */
  notes?: Note[];
  /** How far from home (orders of magnitude) its notes stay. Default 0.75. */
  noteSpan?: number;
  /** Heavy and pure: computes the world's particles. May run in a worker. */
  generate(): WorldData;
  /** Cheap: wraps the data into objects, materials and the per-frame update. */
  assemble(data: WorldData): WorldContent;
}

/**
 * A world as a self-contained module: its spec, plus its own part of the choreography
 * (arrival from the previous world, then its moment). Adding a world never touches the others.
 * The choreography should `label` the world's id where its moment starts (the ruler jumps there).
 */
export interface WorldModule {
  spec: WorldSpec;
  choreo(tl: Timeline, w: World): void;
}

export interface World extends WorldSpec {
  /** Exponent at which the world is framed. */
  home: number;
  group: THREE.Group;
  alpha: number;
  content: WorldContent | null;
  /** A generation request is in flight. */
  pending: boolean;
  /** When its content arrived (ms), for a short fade-in if it arrives while already in view. */
  born: number;
}

/** `?debug` in the URL logs how long each world takes to build. */
const DEBUG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug');

/** Worlds this many steps from the pivot are placed (and may show). */
const MAX_REACH = 3;
/** Content is kept a little beyond that, so turning back doesn't rebuild. */
const KEEP = MAX_REACH + 2;
/** A world whose content arrives late (a jump along the ruler) fades in over this long, never pops. */
const ARRIVE_MS = 900;

export class Chain {
  readonly worlds: World[];
  private L: THREE.Matrix4[] = [];
  private Linv: THREE.Matrix4[] = [];
  private qAbs: THREE.Quaternion[] = [];
  private tilt: THREE.Quaternion[] = [];
  private relP: THREE.Matrix4[];
  private screen = new THREE.Matrix4();
  private shift = new THREE.Matrix4();
  private ca = new THREE.Vector3();
  private cb = new THREE.Vector3();
  private va = new THREE.Quaternion();
  private vb = new THREE.Quaternion();
  private inv = new THREE.Quaternion();

  /** Focus in pivot units, the view orientation, and the segment, after `place`. */
  readonly focus = new THREE.Vector3();
  readonly view = new THREE.Quaternion();
  segment = 0;
  blend = 0;

  /** Asks a worker to generate a world's data; without one, generation runs here. */
  private request?: (id: string) => Promise<WorldData>;

  constructor(specs: WorldSpec[], root: THREE.Object3D, request?: (id: string) => Promise<WorldData>) {
    this.request = request;
    this.worlds = specs.map((s) => {
      const group = new THREE.Group();
      group.matrixAutoUpdate = false;
      group.visible = false;
      root.add(group);
      return { ...s, home: s.unitExp + Math.log10(s.frame), group, alpha: 0, content: null, pending: false, born: 0 };
    });
    const n = this.worlds.length;
    const X = new THREE.Vector3(1, 0, 0);
    for (let i = 0; i < n - 1; i++) {
      const w = this.worlds[i];
      const ratio = Math.pow(10, w.unitExp - this.worlds[i + 1].unitExp);
      const q = w.anchorRot
        ? w.anchorRot.clone()
        : w.anchorDir
          ? new THREE.Quaternion().setFromUnitVectors(X, w.anchorDir.clone().normalize())
          : new THREE.Quaternion();
      this.L[i] = new THREE.Matrix4().compose(w.anchor ?? new THREE.Vector3(), q, new THREE.Vector3(ratio, ratio, ratio));
      this.Linv[i] = this.L[i].clone().invert();
    }
    this.qAbs[n - 1] = new THREE.Quaternion();
    for (let i = n - 2; i >= 0; i--) {
      const q = new THREE.Quaternion();
      this.L[i].decompose(new THREE.Vector3(), q, new THREE.Vector3());
      this.qAbs[i] = this.qAbs[i + 1].clone().multiply(q);
    }
    this.worlds.forEach((w, i) => {
      if (w.view !== 'continue') this.tilt[i] = new THREE.Quaternion().setFromEuler(new THREE.Euler(...w.view));
      else {
        // Seen at the end of the previous segment, the child's view expressed for this world.
        const q = new THREE.Quaternion();
        this.L[i - 1].decompose(new THREE.Vector3(), q, new THREE.Vector3());
        this.tilt[i] = this.tilt[i - 1].clone().multiply(q.invert());
      }
    });
    this.relP = this.worlds.map(() => new THREE.Matrix4());
  }

  /**
   * Places every world for scale exponent `e`. `travel(i)` returns an offset of the framing
   * centre in world i's own units (to fly along a structure), or null. `keep(i)` (0..1) holds a
   * nearby world in view beyond its own fade, for a moment that dives far into it (Saturn, seen
   * at the scale of the Moon's orbit); negative (-1..0), it hides the world. `aim(i)` (weight 0..1 and a point in world i's units) pulls
   * the framing to that point whatever the segment, and the view to world i's own: a dive through
   * many orders of magnitude inside one world (to the centre of the galaxy) without the framing
   * and the angle wandering with every world it passes.
   */
  place(
    e: number,
    viewH: number,
    travel: (i: number) => THREE.Vector3 | null,
    keep?: (i: number) => number,
    aim?: (i: number) => { k: number; at: THREE.Vector3 } | null,
  ) {
    const W = this.worlds;
    const n = W.length;
    let a = 0;
    while (a < n - 2 && e > W[a + 1].home) a++;
    const x = THREE.MathUtils.clamp((e - W[a].home) / (W[a + 1].home - W[a].home), 0, 1);
    // The camera stays on the shrinking world well into the segment, so you watch it become part
    // of the larger one before the frame moves on.
    const w = smoothstep(0.4, 1, x);
    this.segment = a;
    this.blend = w;

    // Every nearby world relative to the pivot.
    const lo = Math.max(0, a - MAX_REACH);
    const hi = Math.min(n - 1, a + 1 + MAX_REACH);
    this.relP[a].identity();
    for (let i = a - 1; i >= lo; i--) this.relP[i].multiplyMatrices(this.relP[i + 1], this.L[i]);
    for (let i = a + 1; i <= hi; i++) this.relP[i].multiplyMatrices(this.relP[i - 1], this.Linv[i - 1]);

    // Focus drifts from the smaller world's frame to the larger one's.
    const center = (i: number, out: THREE.Vector3) => {
      out.copy(W[i].frameCenter);
      const t = travel(i);
      if (t) out.add(t);
      return out.applyMatrix4(this.relP[i]);
    };
    this.focus.copy(center(a, this.ca)).lerp(center(a + 1, this.cb), w);
    let aimed = -1;
    let aimK = 0;
    if (aim) {
      for (let i = lo; i <= hi; i++) {
        const t = aim(i);
        if (!t || t.k <= 0) continue;
        this.focus.lerp(this.ca.copy(t.at).applyMatrix4(this.relP[i]), t.k);
        aimed = i;
        aimK = t.k;
        break;
      }
    }

    // Screen: pivot units -> scene units, focus at the origin.
    const s = viewH * Math.pow(10, W[a].unitExp - e);
    this.screen.makeScale(s, s, s).multiply(this.shift.makeTranslation(-this.focus.x, -this.focus.y, -this.focus.z));

    const now = performance.now();
    for (let i = 0; i < n; i++) {
      const wd = W[i];
      if (Math.abs(i - a) > KEEP && (wd.content || wd.pending)) this.release(wd);
      const [fa, fb, fc, fd] = wd.fade;
      // A positive keep holds the world in view; a negative one hides it (a moment that looks
      // out from inside it).
      const fadeIn = smoothstep(wd.home + fa, wd.home + fb, e) * (1 - smoothstep(wd.home + fc, wd.home + fd, e));
      const k = keep?.(i) ?? 0;
      const want = i >= lo && i <= hi ? (k >= 0 ? Math.max(fadeIn, k) : fadeIn * (1 + k)) : 0;
      if (want > 0.002) this.ensure(wd);
      // Until its content is here the world counts as unseen, so a parent keeps showing its stand-in.
      wd.alpha = wd.content ? want * smoothstep(0, ARRIVE_MS, now - wd.born) : 0;
      wd.group.visible = wd.alpha > 0.002;
      if (!wd.group.visible) continue;
      wd.group.matrix.multiplyMatrices(this.screen, this.relP[i]);
      wd.group.matrixWorldNeedsUpdate = true;
    }

    // View: each world's preferred angle, expressed in the pivot's frame, slerped across the segment.
    this.inv.copy(this.qAbs[a + 1]).invert();
    this.va.copy(this.tilt[a]);
    this.vb.copy(this.tilt[a + 1]).multiply(this.inv).multiply(this.qAbs[a]);
    this.view.slerpQuaternions(this.va, this.vb, w);
    if (aimed >= 0) {
      this.inv.copy(this.qAbs[aimed]).invert();
      this.vb.copy(this.tilt[aimed]).multiply(this.inv).multiply(this.qAbs[a]);
      this.view.slerp(this.vb, aimK);
    }
  }

  /**
   * Builds, ahead of time, at most one world that the journey is about to need (within reach of
   * the pivot and near `e`). Call it every frame: building is spread out, one world per frame,
   * well before the world fades in, instead of stalling the frame where it appears.
   */
  warm(e: number) {
    const a = this.segment;
    let best: World | null = null;
    let bestD = Infinity;
    this.worlds.forEach((wd, i) => {
      if (wd.content || wd.pending || Math.abs(i - a) > MAX_REACH) return;
      const d = Math.abs(e - wd.home);
      if (d < 3.2 && d < bestD) {
        best = wd;
        bestD = d;
      }
    });
    const wd = best as World | null;
    if (wd) this.ensure(wd);
  }

  /** Builds the worlds near exponent `e` ahead of time (e.g. while the intro is on screen). */
  prebuild(e: number) {
    this.worlds.forEach((wd) => {
      if (Math.abs(e - wd.home) < 2.5) this.ensure(wd);
    });
  }

  private ensure(wd: World) {
    if (wd.content || wd.pending) return;
    const t0 = performance.now();
    if (!this.request) {
      this.adopt(wd, wd.generate(), t0);
      return;
    }
    wd.pending = true;
    this.request(wd.id).then(
      (data) => {
        // Released (or rebuilt) while the worker was busy: drop it.
        if (!wd.pending) return;
        wd.pending = false;
        this.adopt(wd, data, t0);
      },
      () => {
        // The worker failed: make it here instead.
        wd.pending = false;
        this.adopt(wd, wd.generate(), t0);
      },
    );
  }

  private adopt(wd: World, data: WorldData, t0: number) {
    wd.content = wd.assemble(data);
    wd.group.add(wd.content.object);
    wd.born = performance.now();
    if (DEBUG) console.info(`[potencias] ${wd.id}: ready after ${(performance.now() - t0).toFixed(0)} ms`);
  }

  private release(wd: World) {
    wd.pending = false;
    if (!wd.content) return;
    const c = wd.content;
    c.object.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    wd.group.remove(c.object);
    wd.content = null;
  }
}

/**
 * Visibility for a parent's stand-in of its child (the points flagged in the parent): hidden while
 * the child itself shows, then glowing for a while so the eye can follow where it went.
 */
export function standIn(childAlpha: number, e: number, home: number) {
  return (1 - childAlpha) * (1 + 1.6 * (1 - smoothstep(home - 0.5, home + 0.4, e)));
}
