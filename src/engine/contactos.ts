import type { World } from './cadena';

/**
 * A contact sheet of the journey (debug only): renders the film at many beats into one image laid
 * over the page, so the whole journey can be reviewed at a glance. Waits at each beat for the
 * worlds it needs to arrive from the workers. Uses message-channel yields, not timers, so it
 * runs at full speed in a background tab.
 */

export interface SheetHost {
  freeze(beat: number | null): void;
  held(): number | null;
  step(now: number): void;
  worlds: World[];
  canvas: HTMLCanvasElement;
  labelOf(beat: number): string;
}

const tick = () =>
  new Promise<void>((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(0);
  });

export function contactSheet(host: SheetHost) {
  let shown: HTMLElement | null = null;
  return async (beats: number[], cols = 5, width = 1000) => {
    const tw = Math.floor(width / cols);
    const th = Math.round((tw * host.canvas.height) / host.canvas.width);
    const out = document.createElement('canvas');
    out.width = cols * tw;
    out.height = Math.ceil(beats.length / cols) * th;
    const g = out.getContext('2d')!;
    g.fillStyle = '#000';
    g.fillRect(0, 0, out.width, out.height);
    g.font = '12px monospace';
    const before = host.held();
    for (const [k, b] of beats.entries()) {
      host.freeze(b);
      const t0 = performance.now();
      // Step until no world is on its way, then once more with the arrival fades skipped.
      for (let i = 0; performance.now() - t0 < 20000; i++) {
        host.step(performance.now());
        if (i > 1 && !host.worlds.some((w) => w.pending)) break;
        const until = performance.now() + 40;
        while (performance.now() < until) await tick();
      }
      for (const w of host.worlds) w.born = -1e9;
      host.step(performance.now());
      host.step(performance.now());
      const x = (k % cols) * tw;
      const y = Math.floor(k / cols) * th;
      g.drawImage(host.canvas, x, y, tw, th);
      g.fillStyle = '#000a';
      g.fillRect(x, y, 150, 16);
      g.fillStyle = '#fff';
      g.fillText(`${b.toFixed(1)} ${host.labelOf(b)}`, x + 3, y + 12);
      g.strokeStyle = '#333';
      g.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1);
    }
    host.freeze(before);
    shown?.remove();
    const img = document.createElement('img');
    img.src = out.toDataURL('image/jpeg', 0.85);
    img.style.cssText = 'position:fixed;inset:0;width:100vw;height:auto;z-index:999;background:#000';
    img.onclick = () => img.remove();
    document.body.append(img);
    shown = img;
    return beats.length;
  };
}
