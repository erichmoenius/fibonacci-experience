# Theme 4 / OUR WORLD — first Earth visual pass

Baseline verified: clean `main`, HEAD and `origin/main` both
`efcfb9dd2424876d4e63d0499d07307442bf9e87`.

## Implementation

- `src/themes/EnvironmentTheme.js`: replaces the development label, transporter,
  and ring with Earth; hides ShaderWorld, portal glass, legacy stars, and local
  particles for this theme; restores particles on destruction. The existing
  renderer-owned distant Environment sky is retained.
- `src/systems/EarthGlobe.js`: three shells (surface, clouds, thin atmosphere),
  23.44-degree tilt, gentle 0.018 rad/s surface spin (~349 seconds/revolution),
  slightly faster 0.019 rad/s cloud motion, world-space directional sunlight,
  day/night city-light gating, aligned terrain normals, ocean-only solar glint,
  cloud dimming of surface/cities, and restrained Rayleigh-inspired limb glow.
  The initial longitude favors Africa/Europe. The entire composition is revealed
  after local maps settle, avoiding partial-map loading flashes.
- `src/systems/cinematic/CameraDirector.js`: four-line optional theme-owned orbit
  look-target hook. Only Environment supplies the hook; it keeps Earth framed
  during RMB orbit and retains that heading on release. Existing flight formulas,
  inputs, shared wheel behavior, and the Planetary camera branch remain unchanged.
- `public/textures/earth/`: five 4096 x 2048 maps, `ATTRIBUTION.md`, `manifest.json`.

Home framing fits the complete atmosphere to the smaller viewport dimension at
the shared 60-degree FOV. Orbit center is Earth's transformed world position,
including the stage's -0.01 Z translation, refreshed during theme updates.

Day and night maps use sRGB texture decoding; cloud density, tangent normal, and
ocean-mask data remain linear. Shader output uses the renderer's tone-mapping and
output-color-space chunks. Cotangent normals follow actual surface/UV derivatives,
tilt and rotation. All surface maps share orientation, seam wrapping, and UVs.
Cloud-shadow lookup tracks the relative cloud rotation.

Materials, geometry, fallback textures, and loaded textures are disposed once.
Late texture loads after a theme switch are disposed without reattaching objects.
Failed downloads retain neutral maps and log warnings. Delta time is measured
from theme state, rejects invalid values, and clamps long pauses to 0.1 seconds.

Environment F defaults, ranges, preset storage key, runtime tuning, Save/Load and
Reset are retained. F/G plumbing, journeys, Galaxy composition, other theme
files, Planetary implementation, and Special Star/wheel WIP are unchanged.
No added music effects, extra objects, or journey features.

## Assets and license

Textures: Solar System Scope / INOVE, based on NASA imagery/elevation data,
licensed **CC BY 4.0**. Collection: https://www.solarsystemscope.com/textures/
License: https://creativecommons.org/licenses/by/4.0/

All five are downsampled from genuine aligned 8192 x 4096 source maps, never
upscaled. Color/cloud maps use JPEG quality 95 without chroma subsampling;
normal and ocean maps use lossless PNG after downsampling. Normal source was
retrieved from Wikimedia's mirror after publisher delivery errors. Exact sources,
modifications, file sizes and SHA-256 hashes are in `manifest.json`. Retain the
asset attribution on distribution. Source saturation is slightly reduced in the
surface shader; source weather and seasonal data remain static.

## Validation and performance

Production build passed (84 modules, main bundle 830.00 kB / gzip 218.96 kB).
The pre-existing >500 kB bundle warning remains. `git diff --check` passed.
34 automated checks passed: local paths, checksum verification, color spaces,
seam wrapping, transformed orbit center/radius, tilt, clamped time, cloud drift,
full-composition reveal, fallback and late-load handling, idempotent resource
disposal, portrait/landscape framing, F defaults/key, particle visibility restore,
and opt-in orbit heading/release behavior with unchanged non-opted-in headings.

Earth adds **3 draw calls and 60,736 triangles**. Five assets total approximately
10.0 MiB on disk. Estimated texture VRAM is **213 MiB including mipmaps**, assuming
RGBA8 GPU storage; decoded CPU images can occupy another ~160 MiB, with temporary
upload/decode peaks. Device/driver behavior varies. Anisotropy is capped at the
hardware-supported value up to 8. Textures load only on Theme 4 activation and
are disposed on leaving it. No runtime network texture dependencies.

8K is deliberately not shipped/enabled: the same five maps could consume roughly
853 MiB of texture VRAM with mipmaps, plus CPU decoded images. There is no quality
selector in this isolated pass; hardware with max texture size below 4096 may be
resized by Three.js. No frame-rate or GPU-memory measurement was performed.

## Limitations / physical GREEN

No browser preview or application launch was performed. Build validation does
not compile the GLSL on the user's GPU. Runtime shader compilation, visual seams,
normal orientation, city/land alignment, terminator and glint quality, cloud/limb
appearance, initial framing, orbit feel, switches/ESC/F/G, and device performance
require physical acceptance. The source maps are aligned by construction; their
appearance under actual rendering has not been certified.

Atmosphere is a thin-shell optical-path approximation, not volumetric multiple
scattering. Clouds are a static satellite-style density layer with slow drift;
cloud dimming is an approximation, not projected volumetric shadows. There is
no live weather, seasonal simulation, scientific solar ephemeris, or added
collision/surface navigation system. Existing travel permits entering the globe.
Idle camera motion and the existing shared wheel semantics remain in place.
This pass makes no GREEN claim for wheel targeting or Journey 2.

Stopped for physical GREEN. No preview, commit, or push.
