# Journey 3 atmospheric descent — Pass 4

Protected GREEN: `2e8aa06f3557107b9468c3a83f57e183c52ab9ed`.
First cinematic prototype. Technical Planetary -> OUR WORLD connection preserved.
## Checkpoint verdict

**PHYSICAL GREEN:** Atmospheric Journey 3 completes and arrives successfully in
OUR WORLD, confirmed by Erich.

**CREATIVE WIP:** Current transition feels visually boring. Visuals are not yet
satisfying; more cinematic development and fine-tuning are required.

**NOT PHYSICALLY CONFIRMED:** Mid-journey ESC cancellation and detailed performance
measurements. Automated checks below do not constitute physical verification of
those behaviors. This checkpoint preserves the functional atmospheric prototype.

## Inspection and preservation

The technical arrival inherited GalaxyJourney's seven-phase machine, fixed-Z
8-unit approach, 0.75-unit horizon/crossing, wormhole TransitSystem and black
curtain. CameraDirector was already the sole camera writer. BIRTH used the existing
ThemeManager `environment` activation, independent saved F/G loads and home flight.

This pass retains the phase IDs, JourneyDirector events, source gateway/acceptance,
registered destination, saved-state restoration and normal completion/cancellation
contracts. GalaxyJourney/Journey 2 and its choreography are unchanged. Theme 4's
EarthGlobe, EnvironmentTheme, 4K/8K assets, shaders, clouds and atmosphere are
unchanged. No flight adapter, FreeFlight, GUI, persistence or solar visual changes.

## Phase mapping

| Internal phase | Simulation time | Journey 3 presentation |
| --- | --- | --- |
| START | 0–2 s | Capture accepted Earth, camera direction and initial look target; lock onto live orbital motion. |
| APPROACH | 2–5 s | Begin a smooth continuous radial approach; Earth gradually grows. |
| HORIZON | 5–8 s | Ease focus toward the measured visible limb; introduce subtle blue/cyan haze. |
| SINGULARITY | 8–12 s | Pale atmospheric haze and luminous cloud diffusion increase; no inward crossing. |
| WORMHOLE | 12–16 s | Cloud passage and blue-white immersion; no wormhole tunnel. Whiteout builds during 14–16 s. |
| VOID | 16–17 s | Fully opaque pale blue-white curtain masks the source. |
| BIRTH | 17 s onward | Activate OUR WORLD once; establish its existing home pose under whiteout. Hold for its local base maps, then reveal over 3 s. |
| COMPLETE event | After reveal | Remove the temporary layers, restore the curtain and release normal exploration. |

There are no renamed/new shared phases. Durations before BIRTH remain inherited
from Journey 2. BIRTH retains a three-second reveal, with a possible loading hold
inside the same phase. Existing simulation delta and slow-motion conventions apply;
these are not guaranteed wall-clock timings on a slow device.

## Camera path and Earth geometry

On accepted LMB, EarthJourney.prepareDescent reads the actual `solarSystem.earth`
geometry bounding sphere, current world center, camera position/current target and
camera near plane. It captures an outward approach direction and an orthogonal
tangent axis, with a polar fallback. There is no fixed global-Z approach reset.

The world solid-radius bound is the geometry radius multiplied by the product of
ancestor maximum absolute local scales. It is exact for the current unit-scaled
sphere and conservative for rotated/nonuniform parents. Explicit manual shear
matrices use a conservative Gram-matrix row bound. This avoids underestimating
solid geometry and avoids artificial radius changes merely from Earth spin.
The present Earth has radius approximately **2 world units**.

One quintic smootherstep over simulation seconds 2–16 blends the accepted distance
toward `R * 1.08 + 2 * camera.near`, approximately **2.36 units** with the current
radius and near plane. If the accepted camera was already closer, the endpoint
retains that distance; the path still enforces an exterior `R + 0.001` lower bound.
Very close starts can retain existing near-plane cropping and need physical review.
The prototype never intentionally enters the solid sphere, even under whiteout;
there is no literal landing.

A small continuous 0.12-radian arc accompanies the radial movement. Look direction
starts from the actual accepted target and eases toward Earth's visible tangent
point, calculated from the measured radius and current eye distance. For eye
distance D, tangent-point radial/lateral components are `R²/D` and
`sqrt(R² - (R²/D)²)`. Focus becomes limb-oriented by 12 seconds. No unrelated pose
is introduced at phase boundaries. All working vectors/pose objects are reused.

During source-side Journey 3 only, App advances Planetary once before updating the
camera, so getWorldPosition samples the orbit/parent transform rendered that frame.
The later gateway/theme update is skipped for that instance. Ordinary exploration
and all other theme orders remain unchanged.

CameraDirector receives the optional getAtmosphericPose result in its existing
updateTravel path and copies/applies it using the established camera API. This is
the only CameraDirector change. EarthJourney computes geometry; it never writes
to the camera. All non-descent camera/flight code is unchanged.

## Atmospheric layer

New JourneyAtmosphere borrows the existing Renderer.fadeOverlay and temporarily
adds three clipped, pointer-transparent child layers:

1. A restrained static deep-blue/cyan radial haze.
2. Static pale cloud-like gradient diffusion with a very slow, small transform.
3. An opaque pale blue-white whiteout.

Only opacity and the cloud transform animate; gradients are not regenerated each
frame. Quintic easing progressively raises haze from 5–12 s, clouds from 8–16 s,
and whiteout from 14–16 s. No rainbow palette, strobe, black hole, tunnel, particles,
new image assets, scene shader, render target or postprocessing pass is introduced.
The existing source Earth rim is viewed closer; its material is not modified.

Journey 3 alone bypasses App's inherited core-approach/horizon/crossing callbacks,
wormhole transit start and black VOID/BIRTH fade. Other journeys still execute
those callbacks exactly as before. Internal WORMHOLE/SINGULARITY labels remain
for compatibility and debug phase tracking.

## Handoff and reveal

VOID makes the existing curtain fully opaque; BIRTH asserts that whiteout before
disposing Planetary and activating `environment`. The established saved F/G loads
and theme activation remain. EarthJourney releases the source mesh and fixes its
pose to EnvironmentTheme.getHomePose while the curtain is opaque. The existing
CameraDirector home flight still runs, but the Journey 3 pose holds the visible
camera at home throughout reveal, avoiding an exposed flight across unrelated
world coordinates.

BIRTH waits for the existing EarthGlobe.ready promise to settle before its reveal
clock advances. That promise covers the original local 4K/fallback composition;
the existing optional High request can load normally afterward. No loader, texture
selection, shader or scene visibility implementation is changed. Failed maps keep
EarthGlobe's existing neutral fallback. ESC remains available during a loading hold.

Once maps settle, all three opacities decrease smoothly over three simulation
seconds. Completion restores the curtain's background/transition/overflow, sets
its opacity to zero, removes all added children and drops source/overlay references.
The normal OUR WORLD flight and Earth orbit hook are released by existing lifecycle.

## ESC and cleanup

Universal ESC routing and restoration code are unchanged. Its existing Journey 3
cleanup calls finishTravel/stop transit/fadeIn, then Return Home and JourneyDirector
cancel. EarthJourney.cancel now removes the atmospheric layers immediately and
restores the borrowed curtain. Before BIRTH, Planetary home and saved F/G restore;
after BIRTH, OUR WORLD home and its saved F/G restore. Both mouse states are reset
by the existing camera/free-flight cleanup.

The same disposal runs on completion, manual theme switching and existing failed
destination cancellation. Late map-ready callbacks cannot recreate cancelled
effects. Starting again clears a prior layer and resets its state. No event
listeners, timers or keyboard shortcuts are added.

## Performance

- No extra Three.js draw calls, GPU textures, shader programs or scene render passes.
- Three temporary browser compositor layers; static backgrounds with small
  transform/opacity changes, clipped overscan and no blur/filter simulation.
- Geometry/path work is small scalar/vector math with reusable objects each frame.
- Browser compositor surfaces still cost memory. A rough RGBA8 estimate for three
  6%-overscanned 1920x1080 physical-pixel layers is **27 MiB**, or approximately
  **107 MiB** for that CSS resolution at DPR 2. Browser/driver caching varies;
  these are estimates, not measured allocations or a guaranteed GPU memory cap.
- Existing Earth 4K/8K texture budgets remain unchanged. Layers are removed on exit.
- Approximately 60 FPS is the target, not an automated claim. Physical testing on
  the RTX 4070 Laptop is required, especially at high DPI and during 8K upload.

## Validation

- Build passed: 86 modules; main bundle 844.16 kB / gzip 222.81 kB.
- `git diff --check` passed.
- Atmosphere characterization: **43,341 checks passed**, covering sampled exterior
  geometry, live orbit and parent transforms, pose reuse, bounded continuous
  movement, monotonic haze/reveal, tangent focus, masking, effect removal in five
  cancellation phases, map-loading hold/release/late cancellation, explicit shear
  vertex bounds and unchanged non-descent camera/Journey 2/rendering systems.
- Journey integration: **2,159 checks passed**, including Journey 2 replay,
  unchanged acceptance, single activation, full whiteout at handoff, home before
  reveal, no wormhole/black fade, F/G preservation, completion, and real existing
  ESC cleanup in APPROACH, WORMHOLE and BIRTH with both mouse states reset.
- Gateway: **236 checks passed**, including radius 10, live tracking and actual
  frame order with one Planetary update before the descent camera.
- Universal ESC: **316 checks passed**; Earth detail: **64 checks passed**;
  existing Space/Galaxy Traveller characterization passed.
- Existing protection guards exempt only the authorized pose hook and new layer;
  the new test strips that hook and asserts the rest of CameraDirector is exactly
  the protected version. GalaxyJourney, JourneyDirector, FreeFlight, theme files,
  SolarSystem, flight adapters, renderer, F/G and Earth assets remain unchanged.

Tests use real scene/camera/journey classes and model DOM surfaces, not a browser
render. No claim of visual quality, compositor timing, physical input or FPS GREEN.
Existing bundle-size/LF-to-CRLF warnings remain; Earth failure-path messages are
intentional simulations. No generated assets are included.

## Physical test / remaining risks

Approach framing, limb selection, haze strength, cloud diffusion, perceived phase
continuity and reveal brightness remain creative WIP. The physical verdict confirms
functional completion/arrival, not cinematic satisfaction or detailed performance. The CSS layer
is stylized screen-space atmosphere rather than depth-aware scattering; very wide
or portrait displays may need later balance. Nonuniform-transform radius bounds
are conservative; very close starts can retain near clipping. Map loading can
extend the BIRTH hold. Physical ESC during transit remains to be confirmed.

1. Enter Planetary; D should show Earth READY at 10, NOT READY at 11.
2. Accept with a fresh LMB hit on Earth. Confirm ordinary misses still fly normally.
3. Watch Earth's growth and limb approach: no camera snapping or visible solid
   crossing. Check one continuous movement through the unchanged phase labels.
4. Confirm blue haze/cloud immersion, no tunnel, and a gradual whiteout.
5. Confirm no exposed theme switch or en-route destination pose: OUR WORLD reveals
   from its established full-globe home with saved Standard/High/F/G behavior.
6. Test ESC in approach, immersion, whiteout/loading hold and after BIRTH: correct
   theme/home/settings, no remaining veil or stuck mouse input.
7. Repeat activation/cancellation/completion and switch themes during the journey;
   check no accumulating layers or stale state. Recheck Journey 2 and normal flight.
8. Measure FPS and compositor memory at normal and high DPI on the target hardware.

## Files / final state

Modified: `src/core/App.js`, `src/systems/cinematic/CameraDirector.js`,
`src/systems/cinematic/EarthJourney.js`, `experiments/journey3-characterization.mjs`,
`experiments/planetary-earth-gateway-characterization.mjs`,
`experiments/earth-detail-characterization.mjs`.
New: `src/systems/cinematic/JourneyAtmosphere.js`,
`experiments/journey3-atmosphere-characterization.mjs`, and this report.

These nine files form "Checkpoint GREEN — Journey 3 atmospheric prototype".
The previous protected checkpoint remains in Git history. Checkpoint creation
adds no visual effects, cinematic tuning, architecture changes or preview.
