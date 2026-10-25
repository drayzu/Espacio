<p align="center">
  <a href="https://drayzu.github.io/Potencias/"><img src="docs/media/header.svg" width="100%" alt="Potencias — Everything is made of something smaller."></a>
</p>

<p align="center">
  <a href="https://drayzu.github.io/Potencias/"><img src="docs/media/start.svg" height="52" alt="Start the journey"></a>
</p>

<p align="center">
  <img src="docs/media/hero.webp" width="100%" alt="One scroll: a cell, the tissue around it, a leaf, a tree, a valley, the Earth.">
</p>

<p align="center"><i>One scroll, sixty orders of magnitude. Every world is built from the particles of the one before.</i></p>

<table>
  <tr>
    <td width="33%"><img src="docs/media/quark.webp" width="100%"><br><sub><b>10⁻¹⁵ m</b> · A quark pulled until its flux tube snaps</sub></td>
    <td width="33%"><img src="docs/media/division.webp" width="100%"><br><sub><b>10⁻⁵ m</b> · A plant cell dividing</sub></td>
    <td width="33%"><img src="docs/media/earthrise.webp" width="100%"><br><sub><b>10⁸ m</b> · Earthrise over the Moon</sub></td>
  </tr>
  <tr>
    <td width="33%"><img src="docs/media/saturn.webp" width="100%"><br><sub><b>10⁹ m</b> · Saturn, edge on</sub></td>
    <td width="33%"><img src="docs/media/sgr.webp" width="100%"><br><sub><b>10²¹ → 10¹⁵ m</b> · Into the heart of the Milky Way</sub></td>
    <td width="33%"><img src="docs/media/deep.webp" width="100%"><br><sub><b>10²⁶ m</b> · A grain of sand of sky, full of galaxies</sub></td>
  </tr>
</table>

<p align="center">
  <sub>English · Español &nbsp;—&nbsp; <code>I</code> plates &nbsp;·&nbsp; <code>S</code> sound &nbsp;·&nbsp; <code>A</code> autoplay &nbsp;·&nbsp; <code>L</code> language</sub>
</p>

<details>
<summary><sub>How it's made</sub></summary>
<br>

- 31 nested worlds at their real positions, kept in double precision relative to a pivot world, so no raw 10⁶⁰ ever reaches the GPU.
- Everything is particles: worlds are generated in Web Workers and drawn as point clouds, with adaptive resolution to hold the frame rate.
- Real data where it counts: star positions, the S stars' orbits around Sagittarius A*, Saturn's ring profile, Andromeda's direction and distance.
- A plate layer with scientific notes and a scale bar that stays true at every scale. Sound is synthesized in the browser.
- TypeScript, Three.js and Vite, no framework. `npm install`, `npm run dev`; pushing to `main` deploys to GitHub Pages.

After *Powers of Ten*, by Charles and Ray Eames (1977).

</details>
