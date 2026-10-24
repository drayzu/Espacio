import * as THREE from 'three';
import { clamp, damp } from '../lib/math';
import type { Stage } from './stage';
import type { StyleInstance } from './types';

/** Mouse tilt, wheel zoom and the frame loop shared by both study pages. */
export function startLoop(stage: Stage, current: () => StyleInstance | null) {
  const mouse = { x: 0, y: 0 };
  const mouseTarget = { x: 0, y: 0 };
  let zoomLog = 0;
  let zoomLogTarget = 0;

  addEventListener('pointermove', (e) => {
    mouseTarget.x = (e.clientX / innerWidth) * 2 - 1;
    mouseTarget.y = -((e.clientY / innerHeight) * 2 - 1);
  });
  addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoomLogTarget = clamp(zoomLogTarget - e.deltaY * 0.0012, 0, 1.4);
    },
    { passive: false },
  );
  addEventListener('resize', () => {
    stage.resize();
    current()?.resize?.();
  });

  /** Distance at which the subject and its annotations fit any aspect ratio. */
  const tanHalf = () => Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2));
  const fitDistance = () => Math.max(1.6 / tanHalf(), 2.2 / (tanHalf() * stage.camera.aspect));

  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const time = now / 1000;
    mouse.x = damp(mouse.x, mouseTarget.x, 3, dt);
    mouse.y = damp(mouse.y, mouseTarget.y, 3, dt);
    zoomLog = damp(zoomLog, zoomLogTarget, 4, dt);
    const zoom = Math.pow(10, zoomLog);

    const dist = fitDistance() / zoom;
    stage.camera.position.z = dist;
    stage.rig.rotation.y = mouse.x * 0.16;
    stage.rig.rotation.x = -mouse.y * 0.1;

    current()?.update({ time, dt, mouse, zoom, viewHeight: 2 * dist * tanHalf() });
    stage.render(time);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    resetZoom() {
      zoomLogTarget = 0;
    },
  };
}
