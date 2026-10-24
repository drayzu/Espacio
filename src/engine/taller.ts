import { crearMundos } from '../mundos';
import type { WorldData } from './cadena';

/**
 * The workshop: a worker that generates worlds' data off the main thread. It knows every world
 * (the same registry the page uses) and answers `{ id, ticket }` with `{ ticket, data }`, handing
 * the typed arrays over without copying them.
 */

const specs = new Map(crearMundos().map((m) => [m.spec.id, m.spec]));

function buffers(v: unknown, out = new Set<ArrayBuffer>()) {
  if (ArrayBuffer.isView(v)) out.add(v.buffer as ArrayBuffer);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) buffers(x, out);
  return out;
}

// The worker's own scope (typed minimally, so the page's DOM typings don't get in the way).
const scope = self as unknown as {
  onmessage: (ev: MessageEvent<{ id: string; ticket: number }>) => void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};

scope.onmessage = (ev) => {
  const { id, ticket } = ev.data;
  try {
    const data: WorldData = specs.get(id)!.generate();
    scope.postMessage({ ticket, data }, [...buffers(data)]);
  } catch (err) {
    scope.postMessage({ ticket, error: String(err) });
  }
};
