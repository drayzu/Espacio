<p align="center">
  <a href="https://drayzu.github.io/Potencias/"><picture><source media="(prefers-color-scheme: dark)" type="image/avif" srcset="docs/media/cover-dark.avif"><source media="(prefers-color-scheme: dark)" srcset="docs/media/cover-dark.webp"><source type="image/avif" srcset="docs/media/cover-light.avif"><img src="docs/media/cover-light.webp" width="100%" alt="Potencias — Everything is made of something smaller. One scroll: a cell, the tissue around it, a leaf, a tree, a valley, the Earth."></picture></a>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" type="image/avif" srcset="docs/media/quark-dark-v4.avif"><source media="(prefers-color-scheme: dark)" srcset="docs/media/quark-dark-v4.webp"><source type="image/avif" srcset="docs/media/quark-light-v4.avif"><img src="docs/media/quark-light-v4.webp" width="100%" alt="Nobody has seen a quark alone"></picture>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" type="image/avif" srcset="docs/media/division-dark-v4.avif"><source media="(prefers-color-scheme: dark)" srcset="docs/media/division-dark-v4.webp"><source type="image/avif" srcset="docs/media/division-light-v4.avif"><img src="docs/media/division-light-v4.webp" width="100%" alt="A cell divides"></picture>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" type="image/avif" srcset="docs/media/earthrise-dark-v4.avif"><source media="(prefers-color-scheme: dark)" srcset="docs/media/earthrise-dark-v4.webp"><source type="image/avif" srcset="docs/media/earthrise-light-v4.avif"><img src="docs/media/earthrise-light-v4.webp" width="100%" alt="Earthrise"></picture>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" type="image/avif" srcset="docs/media/saturn-dark-v4.avif"><source media="(prefers-color-scheme: dark)" srcset="docs/media/saturn-dark-v4.webp"><source type="image/avif" srcset="docs/media/saturn-light-v4.avif"><img src="docs/media/saturn-light-v4.webp" width="100%" alt="Saturn, edge on"></picture>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" type="image/avif" srcset="docs/media/sgr-dark-v4.avif"><source media="(prefers-color-scheme: dark)" srcset="docs/media/sgr-dark-v4.webp"><source type="image/avif" srcset="docs/media/sgr-light-v4.avif"><img src="docs/media/sgr-light-v4.webp" width="100%" alt="The heart of the galaxy"></picture>
</p>

<p align="center">
  <picture><source media="(prefers-color-scheme: dark)" type="image/avif" srcset="docs/media/deep-dark-v4.avif"><source media="(prefers-color-scheme: dark)" srcset="docs/media/deep-dark-v4.webp"><source type="image/avif" srcset="docs/media/deep-light-v4.avif"><img src="docs/media/deep-light-v4.webp" width="100%" alt="A grain of sand of sky"></picture>
</p>

<p align="center">
  <a href="https://drayzu.github.io/Potencias/"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/media/enter-dark.svg"><img src="docs/media/enter-light.svg" width="500" alt="Open drayzu.github.io/Potencias"></picture></a>
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
