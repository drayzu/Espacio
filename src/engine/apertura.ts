import * as THREE from 'three';
import { smoothstep } from '../lib/math';
import type { Timeline } from './timeline';

/**
 * The opening (GUION.md 1–4). Black, and a teal point that breathes: you, the same point and colour
 * as Infinito's «tú». «Estás aquí.» Then the camera falls into it: the powers of ten open like a
 * tunnel and the scale drops from 10⁰ m to the Planck foam with no world in sight (the `velo` track
 * hides them all), only the numbers. Out of the black the foam blooms, and only then the title.
 *
 * The point is a thing about a centimetre across seen from 10⁰ m: as the scale falls it grows by the
 * same factor, swallows the screen and thins out, so the dive begins inside it.
 *
 * Tracks: `velo` (1 hides every world), `anillos` (the tunnel), `titulo` (0 → 1 the title comes,
 * 1 → 2 it goes) and `cromo` (the brand and the ruler).
 *
 * The point comes back later at its resting size, wherever the journey passes through you (the
 * pauses of GUION.md 20, 23 and 47) and at the end, where the whole universe fits in it (the coda):
 * track `tu` (0..1), and `tono` for its colour (0 you, 1 white-hot, 2 Tiempo's blue).
 */

/** Infinito's «tú» (infinito/estudios/comun.ts, TU). */
const TU = new THREE.Color(0.45, 1.0, 0.85);
const INK = new THREE.Color(0xece7db);
const BLANCO = new THREE.Color(1.0, 0.96, 0.9);
/** Tiempo's accent (#8fb4ff): the point the coda hands on to it. */
const AZUL = new THREE.Color(0x8fb4ff);
/** The point's size, in metres. */
const PUNTO = 0.012;
/** The powers of ten of the tunnel, in metres. */
const PRIMERO = 0;
const ULTIMO = -35;

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const potencia = (k: number) => `10${String(k).replace(/./g, (c) => SUP[c])} m`;

/** The opening's part of the journey, before the first world. `fondo`: the foam's scale exponent. */
export function aperturaChoreo(tl: Timeline, fondo: number) {
  // The camera's angle is the foam's from the start (nothing else is in view until it shows).
  tl.set({ e: 0, velo: 1, anillos: 0, titulo: 0, cromo: 0, yaw: -0.3, pitch: 0.15, roll: 0, fov: 40 });
  tl.label('aqui');
  tl.caption(2.4, 'Aquí', 'Estás aquí.', 'tú');
  tl.wait(2.4);
  tl.caption(3.0, 'Hecho de algo', 'Todo lo que ves, y tú también, está hecho de algo más pequeño.', 'tú');
  tl.to(3.0, { e: -0.3 });
  // The fall: slow while the point swallows the screen, fast through the empty powers, slow again
  // as the foam comes.
  tl.caption(6.2, 'Más adentro', 'Y eso, de algo más pequeño todavía. Vamos a bajar hasta donde ya no se puede más.');
  tl.with(1.2, { anillos: 1 });
  tl.to(1.4, { e: -1.6 });
  tl.to(3.4, { e: fondo + 1.6 });
  tl.with(1.4, { anillos: 0, velo: 0 });
  tl.to(1.4, { e: fondo + 0.05 });
  // The foam, and the title over it.
  tl.caption(5.8, 'El fondo', 'Aquí el espacio deja de ser liso.');
  tl.with(1.4, { titulo: 1, cromo: 1 });
  tl.with(5.8, { e: fondo + 0.1, yaw: -0.15, pitch: 0.2 });
  tl.wait(4.2);
  tl.to(1.6, { titulo: 2 });
}

const PUNTO_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv * 2.0 - 1.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const PUNTO_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uCore;
  varying vec2 vUv;
  void main() {
    float r = length(vUv);
    // A bright core and a wide soft halo; the halo is what fills the screen as we fall in.
    float core = exp(-r * r / (uCore * uCore));
    float halo = exp(-r * r * 9.0) * 0.35;
    gl_FragColor = vec4(uColor * (core * 1.6 + halo) * uAlpha, 1.0);
  }
`;

/**
 * Dashed rings, one pixel wide whatever their size (the desert's language: a plate measure, not a
 * thing). Unit radius; each ring is scaled to its power of ten.
 */
function anillo(fase: number) {
  const pos: number[] = [];
  const DASHES = 72;
  for (let d = 0; d < DASHES; d++) {
    const a = fase + (d / DASHES) * Math.PI * 2;
    const len = (0.55 / DASHES) * Math.PI * 2;
    for (let j = 0; j < 3; j++) {
      const a0 = a + (len * j) / 3;
      const a1 = a + (len * (j + 1)) / 3;
      pos.push(Math.cos(a0), Math.sin(a0), 0, Math.cos(a1), Math.sin(a1), 0);
    }
  }
  // The tick at the top, where its power is written.
  pos.push(0, 0.96, 0, 0, 1.04, 0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return geo;
}

export function createApertura(scene: THREE.Scene, viewH: number) {
  const group = new THREE.Group();
  scene.add(group);

  // You.
  const pu = { uColor: { value: TU.clone() }, uAlpha: { value: 0 }, uCore: { value: 0.12 } };
  const punto = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ vertexShader: PUNTO_VERT, fragmentShader: PUNTO_FRAG, uniforms: pu, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  punto.frustumCulled = false;
  punto.renderOrder = 5;
  group.add(punto);

  // The tunnel: a ring at every power of ten, with its name, and fainter ones at 2 and 5 between.
  const anillos: { k: number; luz: number; mesh: THREE.LineSegments; u: { uColor: { value: THREE.Color }; uAlpha: { value: number } }; label: HTMLElement | null }[] = [];
  const capa = document.createElement('div');
  capa.className = 'potencias';
  capa.setAttribute('aria-hidden', 'true');
  document.body.appendChild(capa);
  const pasos: { k: number; luz: number; nombre: boolean }[] = [];
  for (let k = PRIMERO; k >= ULTIMO; k--) {
    pasos.push({ k, luz: 1, nombre: true });
    if (k > ULTIMO) pasos.push({ k: k - 1 + Math.log10(5), luz: 0.4, nombre: false }, { k: k - 1 + Math.log10(2), luz: 0.4, nombre: false });
  }
  for (const { k, luz, nombre } of pasos) {
    const u = { uColor: { value: INK.clone() }, uAlpha: { value: 0 } };
    const mesh = new THREE.LineSegments(
      anillo(k * 2.39996),
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `uniform vec3 uColor; uniform float uAlpha; void main() { gl_FragColor = vec4(uColor * uAlpha, 1.0); }`,
        uniforms: u,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    mesh.frustumCulled = false;
    mesh.visible = false;
    group.add(mesh);
    let label: HTMLElement | null = null;
    if (nombre) {
      label = document.createElement('span');
      label.textContent = potencia(k);
      capa.appendChild(label);
    }
    anillos.push({ k, luz, mesh, u, label });
  }

  return {
    /**
     * `fit`: how much more than the frame a portrait screen shows. `time` in seconds (0 when the
     * visitor asks for less motion: the point holds its breath).
     */
    update(tl: Timeline, p: number, e: number, fit: number, time: number) {
      const velo = tl.get('velo', p);
      const tunel = tl.get('anillos', p);
      const tu = tl.get('tu', p);
      group.visible = velo > 0.001 || tunel > 0.001 || tu > 0.001;
      capa.style.opacity = String(tunel);
      if (!group.visible) return;
      // Scene units for a length of 10^k m: the frame is viewH/fit tall and shows 10^e m.
      const escena = (k: number) => (viewH / fit) * Math.pow(10, k - e);
      // On screen, in half screen heights.
      const pantalla = (k: number) => (2 * Math.pow(10, k - e)) / fit;

      // The point: a centimetre, breathing. Growing, it spreads its light (dimmer the larger it
      // looks), so falling into it is a teal haze, never a white screen; then it thins out.
      const r = escena(Math.log10(PUNTO / 2));
      const enPantalla = pantalla(Math.log10(PUNTO / 2));
      const respira = 0.86 + 0.14 * Math.sin(time * 1.5);
      const reposo = 0.012;
      if (velo > 0.001) {
        punto.scale.setScalar(Math.max(r, viewH * 0.004) * 6 * (0.96 + 0.04 * respira));
        pu.uAlpha.value = velo * respira * Math.sqrt((2 * reposo) / (reposo + enPantalla)) * (1 - smoothstep(0.35, 2.2, enPantalla));
      } else {
        // Later on: the size it had when the journey began, whatever the scale.
        punto.scale.setScalar((viewH / fit) * (PUNTO / 2) * 6 * (0.96 + 0.04 * respira));
        pu.uAlpha.value = tu * respira;
      }
      const tono = tl.get('tono', p);
      pu.uColor.value.copy(TU).lerp(BLANCO, Math.min(1, Math.max(0, tono)));
      if (tono > 1) pu.uColor.value.lerp(AZUL, Math.min(1, tono - 1));

      // The rings: each fades in from a point and out past the frame.
      const W = innerWidth;
      const H = innerHeight;
      for (const a of anillos) {
        const rr = pantalla(a.k);
        const luz = smoothstep(0.03, 0.25, rr) * (1 - smoothstep(2.5, 6, rr)) * tunel * a.luz;
        a.mesh.visible = luz > 0.002;
        a.u.uAlpha.value = luz * 0.34;
        if (a.mesh.visible) a.mesh.scale.setScalar(escena(a.k));
        if (!a.label) continue;
        // Its power, over the tick, while it looks a good size.
        const nombre = smoothstep(0.18, 0.3, rr) * (1 - smoothstep(0.75, 0.95, rr));
        a.label.style.opacity = String(nombre);
        if (nombre > 0.002) a.label.style.transform = `translate(${W / 2}px, ${H / 2 - rr * (H / 2) - 10}px) translate(-50%, -100%)`;
      }
    },
  };
}
