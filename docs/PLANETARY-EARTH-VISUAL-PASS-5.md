# Planetary Earth visual fidelity — Pass 5

Protected GREEN: `341103139b875e72b8b923aa64a05a6155b20863`.

**PHYSICAL GREEN — approved for checkpoint by the user on 2026-10-09.**
The user supplied the explicit verdict: "USER PHYSICAL VERDICT: GREEN" and
approved Pass 5 for the checkpoint "Checkpoint GREEN — Planetary Earth visual fidelity".
This records the user's acceptance of the implemented Planetary Earth visual pass;
no quantitative FPS, VRAM measurements or separate shader-compilation results were supplied.

Checkpoint scope preserves the current Earth rendering, shared licensed 4K maps,
orbit/size/speed/tilt, READY radius 10.0, LMB acceptance, Journey 3 technical arrival,
Journey 2, Universal ESC, independent F/G and other themes/flight systems.
Journey 3 timing/effects are unchanged; no 10-second descent, new transition effect,
stable-system refactor or web preview is included.

## Existing versus new rendering

Planetary previously generated synthetic continent masses and cloud swirls into
512 x 256 RGBA DataTextures. Its solid surface and weather used standard materials,
with a broad translucent back-face shell. The three spheres used 64 x 40 segments.

Planetary now instantiates the existing EarthGlobe infrastructure inside its
original earthTilt hierarchy. The visible solid mesh remains `solarSystem.earth`;
clouds and atmosphere are sibling meshes inside a zero-tilt visual group.
EarthGlobe supplies its existing 128 x 96 solid/cloud meshes and 96 x 64 rim mesh.
Its five shader strings are unchanged from the protected GREEN checkpoint.

The original Earth solid radius remains 2.0, orbit radius 22.0, initial orbital
phase zero, initial solid/cloud rotation zero, axial tilt +23.4 degrees, simulation
rate, orbital period, spin period and visual spin multiplier. SolarSystem still
updates the solid mesh and cloud rotations with the original formulas. It does
not call EarthGlobe's independent Theme 4 spin update. All other planet, Moon and
Sun generation, orbit and update code remains as before.

The thinner reused weather shell is at 2.006 and atmosphere shell at 2.036 world
units, replacing 2.024 and 2.090. These are visual shells; the physical Earth,
gateway center and descent solid-radius measurement stay unchanged.

## Reused assets, shaders and lighting

Reuses only existing local assets under `public/textures/earth/`:

- `day-4k.jpg`: real continental outlines, coastline and ocean/terrain imagery.
- `normal-4k.png`: derivative-based terrain normal detail.
- `ocean-4k.png`: ocean mask for the existing restrained Fresnel specular glint.
- `night-4k.jpg`: night-side city illumination, attenuated under cloud cover.
- `clouds-4k.jpg`: existing cloud shader plus aligned surface cloud shadows.

All are aligned 4096 x 2048 maps. Color imagery retains sRGB; data maps retain
linear sampling, longitudinal repeat wrapping and mipmaps. Anisotropy stays
hardware-capped at eight. Existing shader saturation correction, terminator,
cloud shading and six-sample blue atmospheric rim are reused unchanged.

The maps are Solar System Scope / INOVE works based on NASA data under CC BY 4.0.
Existing `ATTRIBUTION.md` and manifest remain unchanged and must accompany
redistribution. No asset was downloaded, copied, modified or upscaled.

Planetary's solar direction is the normalized live world-space vector from Earth
center to Sun center. It refreshes after orbital updates and before rendering,
including parent transforms. Earth center and relative cloud UV offset use reused
vectors/uniforms; no additional light or render pass is introduced.
Theme 4 retains its original fixed directional illumination, -23.44-degree tilt,
4.9-radian initial texture rotation, independent slow spin, home pose, F/G controls
and optional High detail behavior. Sharing the geography and shading gives visual
continuity; this pass does not synchronize orientation or change Journey 3 poses.

## Texture ownership and GPU implications

EarthGlobe uses one default TextureLoader and a reference-counted cache keyed by
local URL. Shared texture objects own one GPU allocation per renderer. Instance
uniforms, materials, meshes, motion and lighting remain separate. Injected test
loaders are isolated. Loaded maps are configured once, avoiding redundant upload
flags at the normal 4K handoff.

Final release is deferred by one microtask. ThemeManager synchronously destroys
the old theme and constructs the destination, so the destination acquires the
same maps before their final release. No second decode, request or map allocation
is needed at the usual Planetary -> OUR WORLD handoff. Pending requests are also
shared. A disposed source cannot dispose maps still owned by the arrival theme.
Leaving Earth releases all loaded maps; late results release themselves. There
is no permanent texture retention, timer, new renderer, or global cache setting.
Failed maps retain existing neutral fallbacks; optional detail replacement still
retains the active map until successful validation/upload.

Estimated texture residency, RGBA8 plus complete mip chains:

| Configuration | Estimated bytes | MiB |
| --- | ---: | ---: |
| Five reused 4K maps | 223,696,220 | 213.33 |
| Existing optional 8K day plus four 4K maps | 357,913,948 | 341.33 |
| Existing High replacement peak including old 4K day | 402,653,192 | 384.00 |

These are Earth-only estimates, not measured VRAM. CPU decoded images, compressed
files, driver staging, render targets and the rest of the scene add memory costs.
The prior two 512 x 256 RGBA DataTextures cost about 1 MiB combined without mips;
the intentional fidelity increase therefore materially increases Theme 3 residency.
Sharing avoids paying for another full Earth set during handoff or concurrent use.

Solid/cloud/atmosphere triangles increase from 14,976 to 60,736 combined; geometry
attribute/index buffers increase from about 345,696 to 1,367,008 bytes. Draw calls
remain three for Earth. Fragment work is heavier: terrain normals, additional map
samples, night lights, ocean glints and six-sample atmosphere integration. Other
planet resources and the global renderer/postprocessing configuration are unchanged.

4K is the Planetary baseline. The existing 8K day map would add 128 MiB of steady
residency and a 384 MiB Earth-only swap peak. No measured close-up/FPS evidence
justifies enabling it in Planetary in this pass. Theme 4's existing optional High
control and capability/budget guard remain available and tested.

## Gateway and Journey 3 compatibility

PlanetaryTheme and App acceptance code are unchanged. Gateway.target and
crossing.target still reference the actual visible solid Earth Mesh. Fresh LMB
acceptance continues raycasting that mesh non-recursively; it does not target the
new parent group or accept cloud/rim-only hits. A center ray hits and an off-Earth
ray misses in the new integration characterization.

READY stays at 10.0 world units from the live center. World position still follows
the orbit and all parent transforms. EarthJourney reads the same solid mesh's
bounding sphere, still approximately radius 2, and uses the existing exterior
approach and arrival path. Its phase timing, atmospheric overlays, start, BIRTH,
map-ready hold, arrival, completion and ESC behavior are unchanged. No cinematic
or transition source files were edited.

## Verification

All checks below passed with DOM-free scene/loader fixtures; no browser was opened:

- Production build: 86 modules, main bundle 844.56 kB / gzip 222.96 kB. Existing
  greater-than-500-kB bundle advisory remains.
- Whitespace: `git diff --check` passed; new files also checked for trailing spaces.
- Planetary Earth visual characterization: **4,166 checks**. Compares the actual
  prior SolarSystem implementation against the new system over multiple time
  steps for all planet positions/spins, cloud/Moon/Sun timing and non-Earth maps.
  Checks live Sun direction, home frustum inclusion, actual surface ray hits/misses,
  gateway targets, 4K-only baseline, unchanged five shaders and protected source.
  Checks handoff texture identity/no reload/no reupload, multiple owners, pending
  handoff, optional shared 8K, failure fallback, early disposal and repeated cleanup.
- Planetary gateway: **236 checks**, including radius 10 and live frame ordering.
- Journey 3 integration: **2,159 checks**, including Journey 2 replay, fresh LMB
  acceptance, completion/arrival, saved F/G and existing ESC cleanup paths.
- Journey 3 atmosphere: **43,341 checks** for exterior path geometry and unchanged
  approach/cancellation/arrival/overlay behavior.
- Theme 4 Earth detail: **64 checks**, including 4K/8K capability, failures, upload,
  superseded requests, disposal, asset hashes and Theme 4 GUI/flight integration.
- Universal ESC: **316 checks** across seven themes.
- Existing Space/Galaxy Traveller characterization: passed.

Existing test updates are limited to a deterministic map loader in the gateway
fixture, awaiting the actual destination ready promise in the journey fixture,
normalizing line endings in byte-level shader comparison, and removing authorized
EarthGlobe/SolarSystem visual files from old whole-file protection lists. The new
Pass 5 suite separately verifies unchanged shaders, orbital behavior and protected
flight, gateway, cinematic, Theme 4 integration, UI, renderer and assets against
this pass's GREEN. Failure-path warnings are intentional test simulations.

## Physical GREEN verdict and verification reference

The user has approved physical GREEN. The following checklist documents the
review scope and remains useful for later regression checks; it does not imply
that individual measurements were separately reported.

1. Enter Planetary and confirm detailed Earth is visible from home once maps load.
2. Approach closely; inspect coastlines, terrain/ocean detail, cloud softness,
   ocean glint, city lights, terminator and subtle atmospheric rim at several
   orbital phases. Confirm the illuminated side faces the Sun.
3. Confirm READY at 10.0 and NOT READY at 11.0. Accept with a fresh LMB surface hit;
   misses and cloud/rim-only hits must preserve ordinary flight behavior.
4. Complete Journey 3 and confirm OUR WORLD arrival, existing Standard/High,
   saved F/G, flight and ESC behavior. Recheck Journey 2 and other planets/Sun.
5. Measure steady and close-up FPS, loading stutter and memory on target hardware
   and at high DPI. Repeat theme switches, completion and cancellation; look for
   accumulating GPU resources or stale textures.

Build and fixture tests do not execute GPU shaders or measure physical inputs,
visual quality, frame time or real GPU memory. Higher shader cost/residency and
initial local-map loading remain performance considerations; quantitative
measurements were not supplied with the physical GREEN verdict. Earth remains hidden until the
base composition settles; failed maps reveal neutral fallbacks. The existing rim
shader assumes an unscaled world radius, correct for the production unit-scale
Planetary and Theme 4 hierarchy; arbitrary scaled/sheared debug ancestors do not
make its scattering physically accurate. Gateway/solid geometry tracking still
handles those transforms. Static source imagery is not current weather.

## Checkpoint file scope

Modified:

- `src/systems/EarthGlobe.js`
- `src/systems/SolarSystem.js`
- `experiments/earth-detail-characterization.mjs`
- `experiments/planetary-earth-gateway-characterization.mjs`
- `experiments/journey3-characterization.mjs`
- `experiments/journey3-atmosphere-characterization.mjs`

Added:

- `experiments/planetary-earth-visual-characterization.mjs`
- `docs/PLANETARY-EARTH-VISUAL-PASS-5.md`

The repository was clean before Pass 5. Checkpoint preflight verified that the
working tree contained exactly these eight intended files and that the index was
empty, on main at the protected GREEN. Production build, whitespace and all listed
Earth/gateway/journey/ESC/flight suites were rerun for this approved checkpoint.
Only these files are included in the authorized checkpoint commit and normal
(non-force) push to origin/main. Final commit/push/clean-tree verification is
reported in the checkpoint chat; no preview was opened.
