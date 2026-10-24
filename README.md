# Potencias

**Everything is made of something smaller.**

A continuous, scroll-driven journey through more than sixty orders of magnitude: from the Planck foam, through quarks, atoms, DNA, cells, leaves, the Earth, the Solar System and the Milky Way, out to the observable universe and the hypotheses beyond it. Every world is built from the particles of the one before.

Available in English and Spanish.

## Highlights

- **31 nested worlds** placed at their real physical positions, with double-precision matrices relative to a pivot world, so the 60+ orders of magnitude never reach the GPU raw.
- **Named moments**: a quark pulled until its flux tube snaps, a plant cell dividing, Earthrise, Saturn seen edge on, the Pale Blue Dot, the S stars orbiting Sagittarius A*, a Hubble-style deep field, and the cosmic microwave background as a wall.
- **Real data** where it matters: star positions, orbital elements of the S stars, Saturn's ring profile, galactic orientation, Andromeda's direction and distance.
- **Plate layer** (key `I`): scientific annotations and a scale bar that is true at every scale.
- **Procedural sound** (key `S`), autoplay (key `A`), language switch (key `L`).
- Worlds are generated in Web Workers; adaptive resolution keeps the frame rate.

## Stack

TypeScript, Three.js and Vite. No framework.

## Run locally

```bash
npm install
npm run dev
```

`npm run build` writes the static site to `dist/`. Pushing to `main` deploys it to GitHub Pages through the included workflow.

## Inspiration

*Powers of Ten* by Charles and Ray Eames (1977).
