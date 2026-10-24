import * as THREE from 'three';
import { gauss } from '../../lib/math';
import { mountScreen, particleLook } from '../pantalla';
import { pointBuilder } from '../../lib/puntos';
import type { Style } from '../types';

/**
 * A two-armed spiral galaxy seen at an angle. Arms follow the same logarithmic spiral in both
 * versions: θ = 1.7 ln r + kπ.
 */

const SHADE = /* glsl */ `
  vec3 shade(vec2 p, vec2 m) {
    float t = uTime;
    vec2 sp = p + m * 0.03;
    vec3 col = vec3(0.004, 0.005, 0.012);
    col += vec3(0.75, 0.82, 1.0) * starField(sp * 22.0, 0.08, t) * 0.5;
    col += vec3(1.0, 0.9, 0.8) * starField(sp * 9.0 + 3.1, 0.03, t) * 0.7;

    // Into the galaxy's plane: rotate to its position angle, then undo the inclination.
    vec2 g0 = (p + m * 0.1) * 0.74;
    float pa = 0.45;
    vec2 g = vec2(cos(pa) * g0.x + sin(pa) * g0.y, -sin(pa) * g0.x + cos(pa) * g0.y);
    g.y /= 0.6;
    float r = length(g);
    float th = atan(g.y, g.x) - t * 0.015;

    // Two logarithmic arms, roughened by noise.
    float rough = fbm(g * 3.0) * 0.9 + fbm(g * 9.0) * 0.35;
    float phase = 2.0 * th - 3.4 * log(r + 0.03) + rough;
    // Flocculent: the arms break into clumps and spurs.
    float arms = pow(0.5 + 0.5 * cos(phase), 3.0) * (0.55 + 0.9 * smoothstep(-0.25, 0.4, fbm(g * 6.0 + vec2(th, 0.0))));
    float disk = exp(-r / 0.42);
    // The bulge is a puffy ellipsoid, so it stays nearly round on screen.
    float bulge = exp(-dot(g0, g0) / 0.005);

    vec3 light = vec3(1.0, 0.84, 0.62) * disk * 0.22
               + vec3(0.55, 0.72, 1.0) * disk * arms * 1.3
               + vec3(1.0, 0.92, 0.75) * bulge * 0.95;
    // Unresolved stars give the disk its grain.
    light *= 0.7 + 0.6 * (noise(g * 120.0) * 0.5 + 0.5);

    // Dust lanes trail the arms on their inner edge.
    float lane = pow(0.5 + 0.5 * cos(phase - 0.7), 6.0);
    float dust = lane * smoothstep(0.14, 0.35, r) * exp(-r / 0.7) * (0.6 + 0.8 * fbm(g * 7.0));
    light *= 1.0 - clamp(dust * 1.6, 0.0, 0.9);
    light *= 0.8 + 0.4 * smoothstep(-0.3, 0.3, fbm(g * 11.0 - 2.0));

    // Star-forming knots strung along the arms.
    float knots = smoothstep(0.5, 0.85, fbm(g * 16.0 + 3.0) + 0.3) * arms * smoothstep(0.12, 0.3, r) * exp(-r / 0.55);
    light += vec3(1.0, 0.35, 0.6) * knots * 1.2 + vec3(0.5, 0.75, 1.0) * knots * 0.6;

    return col + light;
  }
`;

export const galaxiaTinta: Style = {
  id: 'galaxia-tinta',
  name: 'Galaxia',
  blurb: 'Brazos espirales, polvo oscuro y cúmulos de estrellas jóvenes, como una astrofotografía. Sin una sola imagen.',
  mount(stage) {
    return mountScreen(stage, SHADE, { bloom: [0.7, 0.6, 0.35], grain: 0.04, fringe: 0.014 });
  },
};

export const galaxiaPuntos: Style = {
  id: 'galaxia-puntos',
  name: 'Galaxia',
  blurb: 'Ciento cincuenta mil estrellas siguiendo una espiral logarítmica. Al acercarte, la galaxia se vuelve un enjambre.',
  mount(stage) {
    const b = pointBuilder(9);
    const { r } = b;

    // Bulge.
    for (let i = 0; i < 22000; i++) {
      b.push(gauss(r) * 0.09, gauss(r) * 0.06, gauss(r) * 0.09, 0xffe2b0, 1.3, 0.002, 0.5);
    }
    // Disk: exponential in radius, most stars on the two arms.
    for (let i = 0; i < 130000; i++) {
      const rad = -Math.log(1 - r() * 0.985) * 0.3;
      const onArm = r() < 0.72;
      const th = onArm ? 1.7 * Math.log(rad + 0.03) + Math.floor(r() * 2) * Math.PI + gauss(r) * 0.28 : r() * Math.PI * 2;
      const y = gauss(r) * 0.02 * (1 + rad);
      const warm = rad < 0.15 || !onArm;
      b.push(Math.cos(th) * rad, y, Math.sin(th) * rad, warm ? 0xffd6a0 : 0xa9c4ff, 1.1, 0.002, warm ? 0.26 : 0.4);
    }
    // Star-forming knots along the arms.
    for (let k = 0; k < 60; k++) {
      const rad = 0.2 + r() * 0.7;
      const th = 1.7 * Math.log(rad + 0.03) + Math.floor(r() * 2) * Math.PI + gauss(r) * 0.12;
      const cx = Math.cos(th) * rad;
      const cz = Math.sin(th) * rad;
      for (let i = 0; i < 90; i++) {
        b.push(cx + gauss(r) * 0.016, gauss(r) * 0.008, cz + gauss(r) * 0.016, i % 3 ? 0xff6fa8 : 0x9fd0ff, 1.3, 0.002, 0.6);
      }
    }
    const { points, mat } = b.build(stage.renderer.getPixelRatio());
    const spin = new THREE.Group();
    spin.add(points);
    const tilt = new THREE.Group();
    tilt.rotation.set(1.05, 0, 0.45);
    tilt.add(spin);
    stage.rig.add(tilt);

    const bg = pointBuilder(10);
    for (let i = 0; i < 3500; i++) {
      const [x, y, z] = bg.onSphere();
      const k = 2 + bg.r() * 3;
      bg.push(x * k * 1.6, y * k, z * k - 1.5, bg.r() < 0.8 ? 0xbcd0ff : 0xffe0c0, 1.2, 0.0, 0.25);
    }
    const stars = bg.build(stage.renderer.getPixelRatio());
    stage.rig.add(stars.points);

    particleLook(stage);
    return {
      update(f) {
        mat.uniforms.uTime.value = f.time;
        stars.mat.uniforms.uTime.value = f.time;
        spin.rotation.y = -f.time * 0.03;
      },
    };
  },
};
