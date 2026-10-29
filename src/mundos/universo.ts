import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { perlin3 } from '../lib/puntos';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';

/**
 * The observable universe. 1 unit = 10²⁵ m (about 1.06 billion light-years); we are at the centre
 * of a sphere about 46.5 billion light-years in radius. The web at its largest scale, galaxies
 * redder and fainter with distance (redshift), and at the edge the cosmic microwave background:
 * the oldest light, mottled hot and cold.
 * The web is drawn bright in a thin slice through us, as in the maps of the great galaxy surveys,
 * and faint in the rest of the volume.
 * Arrival: the web, then the edge. Moments: a grain of sand of sky (from where we are, a telescope
 * narrows to a patch of dark sky 0.06° across, as the Hubble Ultra Deep Field, and it fills with
 * thousands of galaxies, redder the farther), then the oldest light (the wall of the microwave
 * background, faced from inside).
 */

const RADIUS = 44;
/** Where the moment faces the wall of the oldest light: a point on it, in the bright slice. */
export const WALL = new THREE.Vector3(Math.cos(4.71), 0, Math.sin(4.71)).multiplyScalar(RADIUS * 0.985);

/**
 * The deep field: straight ahead of where the camera already looks when the moment begins, so it
 * dives through the centre and keeps going without turning (the bright slice it crosses is dimmed
 * while the telescope looks).
 */
const DEEP = new THREE.Vector3(0, -0.6423, -0.7665).normalize();
/** How far the telescope's focus reaches (units), and its field at the end (degrees). */
const DEEP_FAR = 15;
const DEEP_FOV = 0.06;
/** The scale exponent that puts the camera at our place: focus `f` units out, field `fov`. */
const deepE = (f: number, fov: number) => Math.log10(2 * f * 1e25 * Math.tan((fov * Math.PI) / 360));

export function universo(): WorldModule {
  return {
    spec: {
      id: 'universo',
      territory: 'universo',
      name: 'El universo observable',
      fact: 'Todo lo que podrás ver jamás. Más allá, la luz no ha tenido tiempo de llegar.',
      ficha: ['radio: 46 000 millones de años luz', 'el fondo de microondas: luz de cuando el universo tenía 380 000 años'],
      label: 'universo',
      unitExp: 25,
      frame: 105,
      frameCenter: new THREE.Vector3(),
      // From well above the bright slice, so the web in it reads as a map.
      view: [0.55, 0, 0],
      fade: [-2.2, -1.6, 0.9, 1.5],
      tint: 0xffb878,
      notes: [
        { at: [0, 0, 0], text: 'nosotros' },
        { at: [RADIUS * 0.72, 0, -RADIUS * 0.69], text: 'fondo de microondas' },
        { at: [-RADIUS * 0.45, 0, RADIUS * 0.3], text: 'red cósmica' },
      ],
      generate() {
        const r = rng(221);
        const noise = perlin3(222);
        const b = cloudBuilder(223);
        const red = new THREE.Color(0xff7a4a);
        const near = new THREE.Color(0xd8e0ff);
        const c = new THREE.Color();

        // The web at the largest scale: points kept along the ridges of a noise field. Seen through
        // the whole sphere it would average out into noise, so, as in the great galaxy surveys'
        // maps, a thin slice through us is drawn bright and the rest of the volume faint.
        let made = 0;
        while (made < 170000) {
          const slab = r() < 0.55;
          let px: number, py: number, pz: number, d: number;
          if (slab) {
            d = Math.sqrt(r()) * RADIUS;
            const th = r() * Math.PI * 2;
            px = Math.cos(th) * d;
            py = gauss(r) * 0.8;
            pz = Math.sin(th) * d;
          } else {
            const [x, y, z] = b.onSphere();
            // Denser near us, so the cosmic web we come from grows into this one (smoothly: a
            // hard inner edge would show as a ring).
            d = r() < 0.1 ? r() * r() * RADIUS : Math.cbrt(r()) * RADIUS;
            px = x * d;
            py = y * d;
            pz = z * d;
          }
          const f = 1 - Math.abs(noise(px * 0.08, py * 0.08, pz * 0.08, 2) * 2);
          if (r() > Math.pow(f, slab ? 6 : 4)) continue;
          made++;
          const t = Math.min(1, Math.hypot(px, py, pz) / RADIUS);
          c.copy(near).lerp(red, Math.pow(t, 0.8));
          // Close to us the points are smaller (drawn nearer a galaxy's size), so the arrival from
          // the cosmic web resolves into points instead of blots; and dimmer, so the centre never
          // gathers into a glare.
          const light = (slab ? 0.2 * (1 - t * 0.45) : 0.05 * (1 - t * 0.6)) * Math.min(1, 0.15 + d / 6);
          b.push(px, py, pz, c.getHex(), 0.012 + t * 0.24, 0, light, { delay: t * 0.75 });
        }
        // The cosmic microwave background (its own cloud: the moment facing it brightens it).
        const hot = new THREE.Color(0xff8a3f);
        const cold = new THREE.Color(0x3f7fff);
        const cmb = cloudBuilder(225);
        for (let k = 0; k < 140000; k++) {
          const [x, y, z] = b.onSphere();
          const v = noise(x * 3, y * 3, z * 3, 5) + 0.4 * noise(x * 11, y * 11, z * 11, 3);
          c.copy(cold).lerp(hot, THREE.MathUtils.clamp(0.5 + v * 1.4, 0, 1));
          const rr = RADIUS * (1 + gauss(r) * 0.003);
          // Faint: seen face on it lets the web show through; at the rim it adds up into an edge.
          cmb.push(x * rr, y * rr, z * rr, c.getHex(), 0.5, 0, 0.02, { delay: 0.82 + r() * 0.08 });
        }
        // Us: the stand-in for the cosmic web we came from.
        for (let k = 0; k < 40; k++) b.push(gauss(r) * 0.05, gauss(r) * 0.05, gauss(r) * 0.05, 0xe8ecff, 0.05, 0, 0.6, { flag: true, star: true });

        // The web around us at an in-between scale (cells a few hundred million light-years
        // across): shown only on the way out of the cosmic web, where the universe's own web is
        // still too coarse and too dim near us to be seen, so there is always web around the
        // shrinking box we came from.
        const nb = cloudBuilder(224);
        let around = 0;
        while (around < 45000) {
          // In the same thin slice as the bright web (seen through a whole ball, the filaments
          // would average out into an even scatter).
          const d = Math.sqrt(r()) * 7;
          const th = r() * Math.PI * 2;
          const px = Math.cos(th) * d;
          const py = gauss(r) * 0.3;
          const pz = Math.sin(th) * d;
          const f = 1 - Math.abs(noise(px * 0.45 + 17, py * 0.45, pz * 0.45, 2) * 2);
          if (r() > Math.pow(f, 7)) continue;
          around++;
          nb.push(px, py, pz, 0xd8e0ff, 0.014, 0, 0.45 * (1 - d / 7));
        }

        // The deep field: some twelve thousand galaxies in a thin cone out along DEEP, evenly in
        // volume out to 31 units (redshifted, smaller and fainter the farther): spirals, ellipticals
        // and irregulars, each a handful of points at its real size (10 to 30 thousand parsecs).
        const deep = cloudBuilder(226);
        const X = new THREE.Vector3().crossVectors(DEEP, new THREE.Vector3(0, 1, 0)).normalize();
        const Y = new THREE.Vector3().crossVectors(X, DEEP);
        const half = Math.tan((0.075 * Math.PI) / 180);
        const n = new THREE.Vector3();
        const u = new THREE.Vector3();
        const v = new THREE.Vector3();
        const gc = new THREE.Color();
        for (let g = 0; g < 12000; g++) {
          const d = 0.4 + 30.6 * Math.cbrt(r());
          let a = 0;
          let bb = 0;
          do {
            a = r() * 2 - 1;
            bb = r() * 2 - 1;
          } while (a * a + bb * bb > 1);
          const c = DEEP.clone().addScaledVector(X, a * half).addScaledVector(Y, bb * half).multiplyScalar(d);
          const t = d / 31;
          const R = (1.0e-4 + r() * 1.8e-4) * (1 - 0.45 * t);
          const [nx, ny, nz] = deep.onSphere();
          n.set(nx, ny, nz);
          u.crossVectors(n, Math.abs(ny) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize();
          v.crossVectors(n, u);
          const kind = r();
          const light = 0.55 * (1 - 0.55 * t);
          // Redder with distance, but never all the way: the deep fields are a mix of colours.
          const tint = (hex: number) => gc.setHex(hex).lerp(red, Math.min(1, t * 0.8) * 0.75).getHex();
          const at = (x: number, y: number, h: number) => c.clone().addScaledVector(u, x * R).addScaledVector(v, y * R).addScaledVector(n, h * R);
          if (kind < 0.5) {
            // A spiral: a bright core and two arms.
            const core = at(0, 0, 0);
            deep.push(core.x, core.y, core.z, tint(0xffe2b0), R * 0.5, 0, light * 1.3);
            const ph = r() * Math.PI * 2;
            for (let k = 0; k < 12; k++) {
              const s0 = 0.25 + (k % 6) * 0.15;
              const th = ph + (k < 6 ? 0 : Math.PI) + s0 * 3.2;
              const p = at(Math.cos(th) * s0, Math.sin(th) * s0, gauss(r) * 0.05);
              deep.push(p.x, p.y, p.z, tint(r() < 0.6 ? 0xb8ccff : 0xffe6c8), R * 0.38, 0, light * 0.7);
            }
          } else if (kind < 0.8) {
            // An elliptical: a smooth, warm blob.
            for (let k = 0; k < 8; k++) {
              const p = at(gauss(r) * 0.35, gauss(r) * 0.22, gauss(r) * 0.25);
              deep.push(p.x, p.y, p.z, tint(0xffd8a0), R * 0.5, 0, light * 0.9);
            }
          } else {
            // An irregular: blue clumps of young stars.
            for (let k = 0; k < 6; k++) {
              const p = at(gauss(r) * 0.5, gauss(r) * 0.5, gauss(r) * 0.3);
              deep.push(p.x, p.y, p.z, tint(r() < 0.5 ? 0xa8c4ff : 0xff9ad8), R * 0.32, 0, light * 0.8);
            }
          }
        }

        return { main: b.data(), near: nb.data(), cmb: cmb.data(), deep: deep.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 1, 1);
        const near = cloudFromData(data.near as PointsData, 1, 1);
        const cmb = cloudFromData(data.cmb as PointsData, 1, 1);
        const deep = cloudFromData(data.deep as PointsData, 1, 1);
        // A volume the camera flies through: galaxies passing close fade instead of blurring.
        cloud.u.uNear.value = 1;
        near.u.uNear.value = 1;
        const object = new THREE.Group();
        object.add(cloud.points, near.points, cmb.points, deep.points);
        return {
          object,
          clouds: [cloud, near, cmb, deep],
          update(f) {
            const form = f.tl.get('uni.form', f.p);
            cloud.u.uReveal.value = form;
            cmb.u.uReveal.value = form;
            // Facing the wall of the oldest light, its points swell until they merge into a
            // mottled surface (dimmed as they grow, so the overlap does not wash it out).
            const wall = f.tl.get('uni.wall', f.p);
            cmb.u.uSizeUnit.value = 1 + 3 * wall;
            cmb.u.uMaxPx.value *= 1 + 4 * wall;
            cmb.u.uGain.value = 1 - 0.25 * wall;
            // Looking through the telescope only the deep field shows (and not our own stand-in,
            // which sits where the camera does).
            const looking = f.tl.get('uni.deep', f.p);
            deep.u.uGain.value = looking;
            deep.points.visible = looking > 0.001;
            // The web stays while the lens is still wide (it streams past as the field narrows) and
            // goes as it closes, with the wall of light behind it.
            const narrow = looking * (1 - smoothstep(0.5, 3, f.tl.get('fov', f.p)));
            // (Brighter while it streams: out of the bright slice, the volume is faint.)
            cloud.u.uGain.value = (1 + 2.5 * (looking - narrow)) * (1 - 0.92 * narrow);
            cmb.u.uGain.value *= 1 - narrow;
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('redCosmica'), f.e, f.home) * (1 - smoothstep(0, 0.35, looking));
            near.u.uGain.value = smoothstep(f.home - 2.0, f.home - 1.5, f.e) * (1 - smoothstep(f.home - 1.1, f.home - 0.4, f.e));
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'uni.form': 0 });
      tl.to(5.2, { e: w.home - 0.1, 'uni.form': 1, yaw: 0, pitch: 0.15, roll: 0, fov: 44 });
      tl.label('universo');
      // A grain of sand of sky. Down to where we are, facing a dark patch out of the bright slice;
      // then the field narrows (a dolly zoom: the focus moves out as the lens closes, the camera
      // staying at our place) until it is 0.06° across, and fills with galaxies. The worlds around
      // us are hidden: we look out from inside them.
      const aimAt = (f: number) => ({ 'universo.ax': DEEP.x * f, 'universo.ay': DEEP.y * f, 'universo.az': DEEP.z * f });
      tl.set({ 'uni.deep': 0, 'universo.aim': 0, 'universo.keep': 0, 'grupoLocal.keep': 0, 'redCosmica.keep': 0, ...aimAt(0.3) });
      tl.caption(13.2, 'Un grano de arena de cielo', 'Un trocito de cielo oscuro, del tamaño de un grano de arena a un brazo de distancia: diez mil galaxias.');
      tl.to(2.6, { e: deepE(0.3, 46), fov: 46, 'universo.aim': 1, 'universo.keep': 1, 'grupoLocal.keep': -1, 'redCosmica.keep': -1, 'uni.deep': 1, ...DEEP_VIEW });
      const STEPS = 8;
      for (let k = 1; k <= STEPS; k++) {
        const t = k / STEPS;
        const f = 0.3 * Math.pow(DEEP_FAR / 0.3, t);
        const fov = 46 * Math.pow(DEEP_FOV / 46, t);
        tl.to(5.2 / STEPS, { e: deepE(f, fov), fov, ...aimAt(f) });
      }
      tl.to(2.6, { e: deepE(DEEP_FAR, DEEP_FOV) - 0.01, ...DEEP_VIEW_END });
      // And back out: the lens opens again, the camera leaves our place for the whole sphere.
      for (let k = STEPS - 2; k >= 0; k -= 2) {
        const t = k / STEPS;
        const f = 0.3 * Math.pow(DEEP_FAR / 0.3, t);
        const fov = 46 * Math.pow(DEEP_FOV / 46, t);
        tl.to(2.4 / (STEPS / 2), { e: deepE(f, fov), fov, ...aimAt(f) });
      }
      tl.to(2.8, { e: w.home + 0.05, fov: 46, yaw: 0, pitch: 0.15, roll: 0, 'universo.aim': 0, 'universo.keep': 0, 'grupoLocal.keep': 0, 'redCosmica.keep': 0, 'uni.deep': 0 });
      // Facing the edge from inside: the wall of the oldest light, mottled hot and cold, the
      // bright slice of galaxies across it like the Milky Way across our sky. Below this world's
      // home the cosmic web still frames the view, so it travels too.
      const at = (k: number) => ({
        'universo.tx': WALL.x * k,
        'universo.ty': WALL.y * k,
        'universo.tz': WALL.z * k,
        'redCosmica.tx': WALL.x * 100 * k,
        'redCosmica.ty': WALL.y * 100 * k,
        'redCosmica.tz': WALL.z * 100 * k,
      });
      tl.set({ 'uni.wall': 0 });
      tl.caption(5.4, 'La luz más antigua', 'Luz que salió cuando el universo tenía 380 000 años, y que te llega ahora.');
      tl.to(3.0, { ...at(1), e: w.home - 0.6, ...WALL_VIEW, fov: 52, 'uni.wall': 1 });
      tl.to(2.4, { e: w.home - 0.57, ...WALL_VIEW_END });
      // Then back out to the whole sphere, turning slowly.
      tl.to(3.6, { ...at(0), yaw: 1.0, pitch: 0.4, roll: 0, e: w.home + 0.05, fov: 48, 'uni.wall': 0 });
      // GUION.md 47 · At the centre: the whole sphere, and you at its centre, where whoever looks always is.
      tl.caption(5.4, 'En el centro', 'Y en el centro de todo esto estás tú. No porque seas especial: el centro de lo que se ve siempre es quien mira.');
      tl.with(1.2, { tu: 1 });
      tl.to(4.2, { yaw: 1.25, pitch: 0.42, e: w.home + 0.08 });
      tl.to(1.2, { tu: 0, yaw: 1.32, e: w.home + 0.09 });
    },
  };
}

/**
 * Facing the wall (yaw, pitch, roll on top of the chain's view there), solved in the page: the
 * camera inside the sphere looking out at WALL, the bright slice level across the frame.
 */
const WALL_VIEW = { yaw: -0.0024, pitch: -0.4841, roll: 0 };
const WALL_VIEW_END = { yaw: 0.0295, pitch: -0.4884, roll: -0.068 };

/**
 * Facing the deep field from our place (on top of this world's own view, which the aim holds): the
 * angle the moment starts with, since DEEP is straight ahead; at the end a slow roll.
 */
const DEEP_VIEW = { yaw: 0, pitch: 0.15, roll: 0 };
const DEEP_VIEW_END = { yaw: 0, pitch: 0.15, roll: 0.06 };
