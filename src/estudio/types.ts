import type { Stage } from './stage';

export interface Frame {
  time: number;
  dt: number;
  /** Mouse in [-1, 1], smoothed. */
  mouse: { x: number; y: number };
  /** Magnification: 1 shows the whole cell, larger dives in. */
  zoom: number;
  /** World units visible vertically at the cell's plane. */
  viewHeight: number;
}

export interface StyleInstance {
  update(f: Frame): void;
  resize?(): void;
  dispose?(): void;
}

export interface Style {
  id: string;
  name: string;
  blurb: string;
  mount(stage: Stage, overlay: HTMLElement): StyleInstance;
}
