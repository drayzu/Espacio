<p align="center">
  <a href="https://drayzu.github.io/Potencias/"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/header-dark.svg"><img src="docs/media/header-light.svg" width="100%" alt="Potencias — Everything is made of something smaller."></picture></a>
</p>

<p align="center">
  <a href="https://drayzu.github.io/Potencias/"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/start-dark.svg"><img src="docs/media/start-light.svg" height="52" alt="Start the journey"></picture></a>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/hero-dark.webp"><img src="docs/media/hero-light.webp" width="100%" alt="One scroll: a cell, the tissue around it, a leaf, a tree, a valley, the Earth."></picture>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/quark-dark.webp"><img src="docs/media/quark-light.webp" width="100%" alt="Nobody has seen a quark alone"></picture>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/division-dark.webp"><img src="docs/media/division-light.webp" width="100%" alt="A cell divides"></picture>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/earthrise-dark.webp"><img src="docs/media/earthrise-light.webp" width="100%" alt="Earthrise"></picture>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/saturn-dark.webp"><img src="docs/media/saturn-light.webp" width="100%" alt="Saturn, edge on"></picture>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/sgr-dark.webp"><img src="docs/media/sgr-light.webp" width="100%" alt="The heart of the galaxy"></picture>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/deep-dark.webp"><img src="docs/media/deep-light.webp" width="100%" alt="A grain of sand of sky"></picture>
</p>

<p align="center">
  <a href="https://drayzu.github.io/Potencias/"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/start-dark.svg"><img src="docs/media/start-light.svg" height="52" alt="Start the journey"></picture></a>
</p>

<br>

<details>
<summary><sub>How it's made</sub></summary>
<br>

- 31 nested worlds at their real positions, kept in double precision relative to a pivot world, so no raw 10⁶⁰ ever reaches the GPU.
- Everything is particles: worlds are generated in Web Workers and drawn as point clouds, with adaptive resolution to hold the frame rate.
- Real data where it counts: star positions, the S stars' orbits around Sagittarius A*, Saturn's ring profile, Andromeda's direction and distance.
- A plate layer with scientific notes and a scale bar that stays true at every scale. Sound is synthesized in the browser.
- English and Spanish. Keys: `I` plates, `S` sound, `A` autoplay, `L` language.
- TypeScript, Three.js and Vite, no framework. `npm install`, `npm run dev`; pushing to `main` deploys to GitHub Pages.

After *Powers of Ten*, by Charles and Ray Eames (1977).

</details>
