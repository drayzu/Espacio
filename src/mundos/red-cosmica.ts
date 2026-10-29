import * as THREE from 'three';
import { gauss, rng, smoothstep } from '../lib/math';
import { fromEquatorial } from '../lib/astro';
import { standIn, type WorldModule } from '../engine/cadena';
import { cloudBuilder, cloudFromData, type PointsData } from '../engine/points';
import { GALAXIA } from './galaxia';
import { lineSet, linesFromData, type LinesData } from './lineas';

/**
 * The cosmic web. 1 unit = 10²³ m (about 10.6 million light-years), in the Milky Way's frame.
 * Clusters joined by filaments of galaxies around great voids. The Local Group sits on a filament
 * that runs to the Virgo cluster (real direction, 54 million light-years), inside a flattened
 * Local Sheet of nearby galaxies.
 * Arrival: the web lights up outward along its filaments. Moment: Laniakea (found in 2014), the
 * basin of some hundred thousand galaxies all falling towards the Great Attractor (near the Norma
 * cluster, about 220 million light-years away): its flow lines draw themselves, ours from the
 * Local Group at one edge.
 */

const MLY = 1 / 10.57;
const at = (raH: number, decD: number, mly: number) => fromEquatorial(raH, decD, 1).applyQuaternion(GALAXIA.sunRot).normalize().multiplyScalar(mly * MLY);
export const VIRGO = at(12.45, 12.7, 54);
/** The Great Attractor, at the Norma cluster (Abell 3627). */
export const ATTRACTOR = at(16.25, -60.9, 220);

export function redCosmica(): WorldModule {
  return {
    spec: {
      id: 'redCosmica',
      territory: 'galaxias',
      name: 'La red cósmica',
      fact: 'Las galaxias no están repartidas al azar: forman hilos alrededor de vacíos inmensos.',
      label: 'red cósmica',
      unitExp: 23,
      frame: 70,
      frameCenter: new THREE.Vector3(),
      view: [0.4, 0, 0],
      fade: [-2.1, -1.5, 0.8, 1.3],
      tint: 0xd8c8ff,
      notes: [
        { at: [0, 0, 0], text: 'Grupo Local' },
        { at: VIRGO.toArray(), text: 'cúmulo de Virgo' },
        { at: ATTRACTOR.toArray(), text: 'Gran Atractor' },
      ],
      generate() {
        const r = rng(211);
        const b = cloudBuilder(212);
        const virgo = VIRGO;
        const delayOf = (p: THREE.Vector3) => Math.min(1, p.length() / 45) * 0.9;

        // Cluster nodes, Virgo and the Great Attractor among them.
        const nodes: THREE.Vector3[] = [virgo, ATTRACTOR];
        while (nodes.length < 140) {
          const [x, y, z] = b.onSphere();
          nodes.push(new THREE.Vector3(x, y, z).multiplyScalar(Math.cbrt(r()) * 48));
        }
        // Filaments: each node to its three nearest neighbours, and ours through the origin to Virgo.
        const edges: [THREE.Vector3, THREE.Vector3][] = [[virgo.clone().multiplyScalar(-2.2), virgo]];
        nodes.forEach((a, i) => {
          const closest = nodes
            .map((n, j) => ({ j, d: n.distanceToSquared(a) }))
            .filter((x) => x.j !== i)
            .sort((x, y) => x.d - y.d)
            .slice(0, 3);
          for (const { j } of closest) if (j > i || r() < 0.3) edges.push([a, nodes[j]]);
        });
        // Arriving from the Local Group, the camera starts close to us: there galaxies are drawn
        // nearer their real size (and dimmer), so the web resolves into points instead of glare.
        const near = (q: THREE.Vector3) => 0.2 + 0.8 * smoothstep(0.5, 7, q.length());
        const p = new THREE.Vector3();
        for (const [a, c] of edges) {
          const len = a.distanceTo(c);
          const n = Math.round(len * 55);
          for (let k = 0; k < n; k++) {
            const t = r();
            p.copy(a).lerp(c, t);
            const w = 0.35 + 0.5 * Math.sin(Math.PI * t);
            p.x += gauss(r) * w;
            p.y += gauss(r) * w;
            p.z += gauss(r) * w;
            const f = near(p);
            b.push(p.x, p.y, p.z, r() < 0.8 ? 0xc8d4ff : 0xffe2c0, 0.12 * f, 0, 0.11 * f, { delay: delayOf(p) });
          }
        }
        // Clusters: dense knots of galaxies, golden.
        for (const c of nodes) {
          const rich = c === virgo || c === ATTRACTOR ? 1500 : 200 + Math.floor(r() * 500);
          // Rich clusters get more galaxies, not proportionally more light: seen from inside the
          // web, one ahead of the camera would otherwise burn into a glaring knot.
          const f = near(c) * Math.min(1, Math.sqrt(350 / rich));
          for (let k = 0; k < rich; k++) {
            b.push(c.x + gauss(r) * 0.6, c.y + gauss(r) * 0.6, c.z + gauss(r) * 0.6, k % 4 ? 0xffe2b0 : 0xd8e0ff, 0.1, 0, 0.16 * f, { delay: delayOf(c) });
          }
        }
        // The Local Sheet: nearby galaxies in a flattened layer around us, denser close in.
        for (let k = 0; k < 7000; k++) {
          const d = 0.4 + Math.sqrt(r()) * 11.6;
          const th = r() * Math.PI * 2;
          const q = new THREE.Vector3(Math.cos(th) * d, gauss(r) * 0.25, Math.sin(th) * d);
          const f = near(q);
          b.push(q.x, q.y, q.z, 0xd8e0ff, 0.06 * f, 0, 0.1 * f, { delay: Math.min(1, d / 45) * 0.9 });
        }
        // The Local Group: stand-in.
        for (let k = 0; k < 40; k++) b.push(gauss(r) * 0.04, gauss(r) * 0.04, gauss(r) * 0.04, 0xe8ecff, 0.04, 0, 0.3, { flag: true, star: true });

        // Laniakea: flow lines down the pull of the clusters (the Great Attractor heaviest, Virgo
        // next), from galaxies all through its basin; each draws itself from its start, so the
        // whole basin seems to flow. Ours starts at the Local Group.
        const mass = nodes.map((n) => (n === ATTRACTOR ? 14 : n === virgo ? 5 : 1.3));
        const pull = (x: THREE.Vector3, out: THREE.Vector3) => {
          out.set(0, 0, 0);
          nodes.forEach((n, i) => {
            const dx = n.x - x.x;
            const dy = n.y - x.y;
            const dz = n.z - x.z;
            const d2 = dx * dx + dy * dy + dz * dz + 4;
            const k = mass[i] / (d2 * Math.sqrt(d2));
            out.x += dx * k;
            out.y += dy * k;
            out.z += dz * k;
          });
          return out;
        };
        const flow = lineSet();
        const ours = lineSet();
        const g = new THREE.Vector3();
        const a = new THREE.Vector3();
        const c = new THREE.Vector3();
        const flowFrom = (start: THREE.Vector3, set: typeof flow, light: number) => {
          const x = start.clone();
          const pts = [x.clone()];
          const prev = new THREE.Vector3();
          for (let k = 0; k < 260; k++) {
            pull(x, g).normalize();
            // Settled into a cluster (the step turns back on itself): the line ends there.
            if (k > 0 && g.dot(prev) < 0) break;
            prev.copy(g);
            x.addScaledVector(g, 0.3);
            pts.push(x.clone());
            if (x.distanceTo(ATTRACTOR) < 2.6) break;
          }
          if (pts.length < 4) return;
          const n = pts.length - 1;
          for (let k = 0; k < n; k++) {
            // Faint where it starts, brighter as the flows gather.
            const t = k / n;
            set.segment(a.copy(pts[k]), c.copy(pts[k + 1]), light * (0.35 + 0.65 * t), t * 0.9, ((k + 1) / n) * 0.9);
          }
        };
        const basin = ATTRACTOR.clone().multiplyScalar(0.55);
        for (let k = 0; k < 170; k++) {
          const [x, y, z] = b.onSphere();
          const start = new THREE.Vector3(x * 1.3, y * 0.7, z).multiplyScalar(Math.cbrt(r()) * 26).add(basin);
          flowFrom(start, flow, 0.1);
        }
        // Ours: from the Local Group, past Virgo (which is falling too), on to the Great Attractor.
        {
          const q = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), VIRGO.clone().multiplyScalar(1.15), ATTRACTOR.clone().multiplyScalar(0.88));
          const pts = q.getPoints(120);
          for (let k = 0; k + 1 < pts.length; k++) {
            const t = k / (pts.length - 1);
            ours.segment(pts[k], pts[k + 1], 0.55 * (0.5 + 0.5 * t), t * 0.9, ((k + 1) / (pts.length - 1)) * 0.9);
          }
        }

        return { main: b.data(), flow: flow.data(), ours: ours.data() };
      },
      assemble(data) {
        const cloud = cloudFromData(data.main as PointsData, 1, 1);
        // A volume the camera flies through: galaxies passing close fade instead of blurring.
        cloud.u.uNear.value = 1;
        const flow = linesFromData(data.flow as LinesData, 0xffe2c0);
        const ours = linesFromData(data.ours as LinesData, 0xff5b2e);
        const object = new THREE.Group();
        object.add(cloud.points, flow.mesh, ours.mesh);
        return {
          object,
          clouds: [cloud],
          update(f) {
            cloud.u.uReveal.value = f.tl.get('web.form', f.p);
            cloud.u.uFlagAlpha.value = standIn(f.alphaOf('grupoLocal'), f.e, f.home);
            const lan = f.tl.get('lan.form', f.p);
            for (const l of [flow, ours]) {
              l.uniforms.uReveal.value = lan;
              // The flow fades in as it starts, and away as the camera leaves the web.
              l.uniforms.uAlpha.value = f.alpha * smoothstep(0, 0.15, lan) * (1 - smoothstep(f.home + 0.3, f.home + 0.8, f.e));
            }
          },
        };
      },
    },
    choreo(tl, w) {
      tl.set({ 'web.form': 0 });
      tl.to(5.0, { e: w.home - 0.12, 'web.form': 1, yaw: 0, pitch: 0.1, roll: 0, fov: 44 });
      tl.label('redCosmica');
      // Laniakea: the flow of the galaxies draws itself towards the Great Attractor.
      tl.set({ 'lan.form': 0 });
      tl.caption(6.6, 'Laniakea', '«Cielo inmenso»: cien mil galaxias que caen juntas. La nuestra va en un borde.');
      // Seen side on (the Great Attractor to one side, Virgo above), framed between us and it.
      const mid = ATTRACTOR.clone().multiplyScalar(0.4);
      tl.to(3.8, { 'lan.form': 1, yaw: -0.9, pitch: 0.35, e: w.home - 0.02, fov: 48, 'redCosmica.tx': mid.x, 'redCosmica.ty': mid.y, 'redCosmica.tz': mid.z });
      tl.to(2.8, { yaw: -0.6, pitch: 0.3, e: w.home + 0.08, fov: 50, 'redCosmica.tx': 0, 'redCosmica.ty': 0, 'redCosmica.tz': 0 });
    },
  };
}
