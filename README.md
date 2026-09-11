# Aetherium

The Solar System on real orbits, in illustrative or true scale, with cosmic events — all seen
through an old film camera whose lens and emulsion react to what you look at.
React 19, TypeScript, Vite, Three.js. The interface is in Russian.

## Run

**Windows:** double-click `Run.bat`. It installs dependencies on first launch, builds the app and
opens it in your browser.

**Any system:**

1. Node.js 20.19+ or 22.12+.
2. `npm install`
3. `npm start` — builds and opens http://127.0.0.1:5178
   (or `npm run dev` for development at http://127.0.0.1:5177)

`npm run build` produces a single self-contained `dist/index.html` with all scripts, styles and
fonts inlined. It opens straight from disk, no network needed. Requires WebGL 2 with hardware
acceleration.

## Controls

| Action | Input |
|---|---|
| Rotate view | left mouse button / one finger |
| Zoom | wheel / pinch |
| Move view centre | right mouse button |
| Body details | click a body, its label or its entry in the list |
| Fly to a body | list on the left, or the button in the details card |
| Pause | Space |
| Reverse time | rewind button next to pause |
| Speed | slider: from real time to 1000 years per second |
| Close panel | Esc |

## What is modelled faithfully

- **Orbits.** JPL Keplerian elements (Standish, table 1) with secular rates: ellipses,
  inclinations, precession of perihelia and nodes. Orbit lines are rebuilt as time passes, so at
  high speed you can watch them slowly turn. Checked against observed dates: oppositions of Mars
  (2025-01-16), Jupiter (2026-01-10), Saturn (2025-09-21) and Venus's inferior conjunction match
  within 0.2°. Outside 1800–2050 the elements are extrapolated and the interface says so.
- **The Moon** follows Schlyter's elements with nodal regression (18.6 years) and apsidal precession.
- **Rotation axes** use IAU pole positions and rotation rates (Archinal et al. 2018): Uranus lies
  on its side, Venus spins backwards.
- **Rings** follow real radial profiles: Saturn's D, C and B rings, the Cassini Division, the A ring
  with the Encke gap and the narrow F ring; Uranus's nine narrow dark rings. Rings are backlit from
  their shadowed side, and the planet and its rings cast shadows on each other.
- **The sky** is real: 41 411 stars down to magnitude 8.5 coloured by their B−V index, IAU
  constellation lines and names, the Milky Way from brightness contours, and nebulae and galaxies
  at their true positions.
- **The asteroid belt** is 7000 bodies with individual orbits and the Kirkwood gaps; the GPU solves
  Kepler's equation for them.
- **True scale** puts distances and sizes in one unit (1 unit = 100 000 km). Earth seen from Mars's
  orbit is smaller than a pixel, so bodies are marked with rings.

## What is illustrative

- **Illustrative scale** compresses distances (∝ r^0.5) and radii (∝ R^0.42) so the whole system
  fits on screen. Orbit shapes are preserved.
- **Planet surfaces** are procedural and generated on the GPU into cube maps (no pole pinching).
  Features are recognisable — lunar maria, Martian polar caps, the Great Red Spot, Saturn's
  hexagon, Neptune's Great Dark Spot — but they are not maps.
- **Deep-sky objects** are drawn procedurally and enlarged about twice so they read on screen.
- **Events** are artistic scenarios. The Sun is not massive enough to go supernova, and no alien
  fleets have been observed. The gravitational wave has the correct strain pattern, amplified
  about 10²⁰ times.

## Lens and film

Artefacts are applied by a single shader over the rendered scene and depend on what happens:

| Situation | What happens to the image |
|---|---|
| Sun in frame | overexposure, halation, heat shimmer, hot pixels |
| Close to Jupiter | radiation sparkles, grain |
| Uranus, Neptune | frost creeping over the lens, cold tint |
| Far from the Sun | underexposure, grain, focus hunting, weak signal at the system's edge |
| Flying between bodies | defocus, gate weave, chromatic aberration |
| Fast-forward | flicker and scratches |
| From time to time | lasting scratches, dust and hairs, light leaks, reel-change cue marks, a torn frame |

In strong moments the failure takes over the whole window, interface included: the film burns
through, blows out to white, tears, loses signal, or a new frame rolls in over the perforations.
The switch between scales is hidden behind such a frame change. Artefact strength can be lowered
or turned off with the film button.

## Project layout

```
src/
  data/        body facts, orbital elements, event catalogue, generated sky catalogue
  physics/     Kepler's equation, time, scale mapping
  engine/      Observatory (frame loop, commands), camera, clock, quality, state store
  scene/       bodies, orbits, asteroid belt, labels
    planets/   GPU surface generators and baker, planet and ring materials, thumbnails
    sky/       stars, Milky Way, deep-sky objects, constellations
  lens/        lens shader, bloom, artefact director, full-window film overlay
  events/      event director and 12 scenarios, one file each
  ui/          interface components
  audio/       synthesised ambience
  styles/      styling
tools/         sky catalogue builder, performance and screenshot scripts
tests/         physics check and end-to-end browser test
```

Per-frame values (date, event progress, distances) are written to the DOM directly, bypassing
React: the interface re-renders only on user actions. Surfaces are baked a couple of cube faces
per frame and shaders compile in parallel, so the main thread stays free while the intro plays.

## Checks

```bash
npm run typecheck
npm test                      # orbits against observed dates
npm run test:e2e              # end-to-end browser test (needs npm run dev)
node tools/measure-fps.cjs http://127.0.0.1:5177/ 8 weak
node tools/measure-startup.cjs http://127.0.0.1:5178/
node tools/shoot.cjs          # screenshots of key states into tools/shots
npm run sky                   # rebuild the sky catalogue from d3-celestial
```

## Data and credits

- Planetary orbital elements: E. M. Standish, JPL Solar System Dynamics.
- Lunar orbit: P. Schlyter, *How to compute planetary positions*.
- Rotation elements: Archinal et al. (2018), IAU Working Group on Cartographic Coordinates and
  Rotational Elements.
- Stars, constellations, Milky Way outlines and deep-sky objects come from the data files of
  [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn (BSD-3-Clause), which compile:
  XHIP, an extended Hipparcos compilation (Anderson & Francis 2012); IAU constellation lines and
  names; the Milky Way Outline Catalog by J. R. Vieira; Messier data by H. Frommert (SEDS) and the
  Saguaro Astronomy Club deep-sky database.
- 3D simplex noise: Ashima Arts and Stefan Gustavson (MIT).
