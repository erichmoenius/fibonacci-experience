# OUR WORLD — Earth detail pass 2

Protected physical GREEN checkpoint: `981562083ad1ac9110920cd9f68c61c08ca26b06`.
Prepared on `main`, 8 October 2026. Physical GREEN confirmed by Erich for the checkpoint "Checkpoint GREEN — Earth 8K detail and atmosphere". The checklist and automated-test limitations below document the validation process; physical acceptance is now complete.

## Findings: close-up softness

The five baseline maps are 4096 x 2048: day/night/clouds JPEG, normal/ocean PNG.
Trilinear mipmaps, linear magnification, horizontal repeat, vertical clamp, and
anisotropy up to the hardware-supported value capped at 8 are already correct.
There is no explicit blur in the Earth surface shader. Disabling mipmaps or using
nearest filtering would increase shimmer/pixelation rather than recover detail.

The leading explanation is source texel density when a small part of the globe
fills the screen: 4K equirectangular longitude spacing is about 9.8 km at the
equator; 8K approximately halves that spacing. This is a code/asset diagnosis,
not a measured visual root cause. The clouds also deliberately obscure terrain
and reduce its contrast; night lighting intentionally hides terrain. Normal and
ocean detail remain at 4K. The renderer caps pixel ratio at 2, so high-DPI output
can also limit apparent sharpness. None of these protected behaviors is changed.

Installed Three.js uses sRGB output and no tone mapping by default. Day/night
textures use sRGB storage/decoding; data maps are linear. Earth shaders keep the
existing tone-mapping/output chunks and existing mild saturation correction.

## Optional local day map

Added `public/textures/earth/day-8k.jpg`, an unmodified 8192 x 4096 RGB JPEG,
4,565,076 bytes (~4.35 MiB). Original source:
https://www.solarsystemscope.com/textures/download/8k_earth_daymap.jpg

Solar System Scope / INOVE, based on NASA imagery/data, CC BY 4.0:
https://www.solarsystemscope.com/textures/
https://creativecommons.org/licenses/by/4.0/

The original has the same orientation, projection, and geography as the GREEN
4K derivative. A Lanczos downsample compared against that derivative has mean
absolute RGB errors of 0.619 / 0.523 / 0.817 on an 8-bit scale, consistent with
JPEG recompression. The source image was inspected directly; runtime visual
alignment still requires physical testing. Attribution and manifest include the
new original and its SHA-256. All five 4K files are byte-identical to GREEN.
No runtime remote dependency. Night/clouds/normal/ocean stay 4096 x 2048.

## Memory and rendering cost

Estimates assume installed renderer RGBA8 or sRGB8_ALPHA8 GPU storage, with
the complete mip chain (roughly one-third additional storage).

| Mode | Day map | Other four maps | Earth texture GPU estimate | Decoded RGBA CPU estimate |
| --- | --- | --- | --- | --- |
| Standard | 4096 x 2048 | 4096 x 2048 each | 213.33 MiB | 160 MiB |
| High | 8192 x 4096 | 4096 x 2048 each | 341.33 MiB | 256 MiB |
| Switching peak | old and new day maps temporarily coexist | unchanged | ~384 MiB | ~288 MiB |

The Earth-only switching budget is 400 MiB, including a margin for exact mip
rounding. High requires renderer `maxTextureSize >= 8192` and the estimated
switching peak to fit the budget. WebGL cannot report available VRAM; this is
not a guarantee about total application memory. Other themes, render targets,
driver overhead, decode/upload copies and browser caches are outside these
estimates. On the target 8 GB RTX 4070 Laptop, Standard remains the default.
An 8K upload/mipmap generation can cause a brief hitch; steady-state FPS must be
measured physically. No compressed GPU texture format is introduced.

Geometry remains 3 meshes, 60,736 triangles and 3 draw calls per scene pass.
The existing renderer performs an offscreen and a screen scene pass, so Earth
can account for 6 draws / 121,472 triangles across those two passes. Neither
pass is changed. Quality changes add no draw calls, geometry, or shader variants.
Atmosphere adds six bounded density samples in its existing fragment shader;
there is no new render target, full-screen pass, or separate volume system.

## G quality selection and resource lifetime

Theme 4 adds an `Earth` folder to G with `Earth surface detail`:
`Standard (4K)` and `High (8K)`, plus live surface status. Each new Earth starts
Standard. Manual G Save/Load uses the existing `hero-core-gui-environment` key;
explicitly saving High lets G Load (including the existing ESC settings restore)
request High again, subject to capability checks. F controls and their separate
`fibonacci-flight-v1-environment` key are untouched. Other themes have no Earth
folder; the folder is destroyed when leaving Theme 4. Saved diagnostic text
cannot overwrite live status.

Switching replaces only the day-map uniform. The active texture remains until
the replacement loads, passes dimension checks, and uploads. Replaced textures
are disposed, not cached on the globe; returning to Standard reloads the local
4K map. Requests are serialized and versioned: rapid changes discard stale
results, and callbacks arriving after destruction dispose their textures.
Unsupported High, decode/load failure, dimension mismatch, synchronous loader
failure, or upload exceptions retain the active map and reset the selection.
Driver errors that do not throw, context loss, or total VRAM exhaustion cannot
be fully certified by these automated tests. Initial neutral-map handling and
complete-composition reveal remain as in GREEN.

## Atmosphere

Replaced the normal-only rim power curve with a short ray-path density integral
inside the same 1.018-radius shell. Exponential density decreases rapidly with
altitude and reaches zero at the outer boundary, intended to hide the geometric
outline. A ground intersection truncates the path; six midpoint samples use
solar-altitude falloff and a Rayleigh-inspired phase factor. The blue is less
saturated, and the existing close-camera fade is retained. This aims for a
delicate sunlit edge and a subdued night-side falloff. Near/far appearance and
possible sampling artifacts need physical acceptance. It remains an artistic
single-scattering approximation with static weather, not scientific atmosphere.

## Preservation and automated validation

- `EarthGlobe` vertex, surface and cloud shaders match GREEN exactly.
- All Earth geometry, tilt, surface/cloud rotation rates, day/night gating,
  city lights, glint and cloud layering remain unchanged.
- `CameraDirector`, cinematic/flight systems, F controls, other themes,
  renderer/camera far plane, App, journeys and gateways remain unchanged.
- `EnvironmentTheme` changes are limited to its G folder and folder disposal;
  orbit target, starting composition and particle restoration are retained.
- Production build passed: 84 modules; main bundle 834.02 kB / gzip 220.23 kB.
- `git diff --check` passed. Existing >500 kB bundle and LF/CRLF notices remain.
- Existing Space/Galaxy Traveller characterization passed.
- New `node experiments/earth-detail-characterization.mjs` passed 64 checks:
  mip estimates, capabilities/budget, local loading, replacement/disposal,
  color space/filtering, errors, rapid changes, late callbacks, repeated Earth
  activation, GREEN assets/shaders/protected paths, geometry/rotation/framing,
  G ownership/diagnostic isolation, F storage key and Earth orbit hook.

The tests use real Three.js objects with a controllable texture loader and stub
renderer/GUI. They do not run WebGL, compile GLSL on the GPU, exercise a real G
Save/Load UI, measure FPS/VRAM, or certify rendered colors/seams/atmosphere.

## Physical acceptance checklist

1. In Theme 4 Standard, verify the full starting globe, preserved day/night,
   city lights, clouds/ocean, rotation and acceptable surface colors.
2. In G > Earth, select High; wait for `High (8K)`, approach exposed terrain,
   compare sharpness/alignment, and check FPS and any upload hitch.
3. Check the refined rim on sunlit and night limbs at full-globe and near range;
   look for harsh edges, neon color, banding or near-camera haze.
4. Toggle Standard/High repeatedly; switch themes during a pending load and
   repeatedly reactivate Earth. Check memory recovery and no console errors.
5. Verify RMB Earth orbit, LMB flight, ESC Return Home and complete composition.
6. Test G Save/Load with Standard and High. Verify F values/Save/Load and other
   themes are unaffected. Restore Standard for testing unless High is accepted.

## Files and final state

Modified: `src/systems/EarthGlobe.js`, `src/themes/EnvironmentTheme.js`,
`public/textures/earth/ATTRIBUTION.md`, `public/textures/earth/manifest.json`.
New: `public/textures/earth/day-8k.jpg`,
`experiments/earth-detail-characterization.mjs`, `docs/EARTH-DETAIL-PASS-2.md`.

The seven files above form the physically accepted Earth Detail Pass 2 checkpoint.
The previous GREEN checkpoint remains protected in Git history.
