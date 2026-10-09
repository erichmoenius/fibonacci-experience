# Journey 3 cinematic timing and camera — Pass 6

Protected GREEN: `94c6c7e3a07ad59f058d4b01e45390c32803f2ad`.

**PASS 6 PHYSICAL VERDICT: RED — double visual jump at BIRTH.**
The user reported an apparent-scale drop during reveal and a second change at
exploration restoration. The original Pass 6 implementation described below is
historical; its BIRTH/ownership behavior is superseded by the uncommitted Pass 6A
correction in [JOURNEY-3-BIRTH-CONTINUITY-PASS-6A.md](JOURNEY-3-BIRTH-CONTINUITY-PASS-6A.md).
Pass 6A retains the 10-second schedule and waits for a new physical GREEN verdict.
This pass changes Journey 3 timing and camera choreography only. No new effects,
shaders, plasma, particles, audio-reactive behavior, preview, commit or push.

## Timeline: old versus new

Journey 3 previously inherited GalaxyJourney's approximately 20-second schedule.
It now owns a schedule while keeping the same existing phase IDs and events.
GalaxyJourney / Journey 2 remains unchanged.

| Existing phase ID | Previous interval / duration | New interval / duration | Creative beat |
| --- | --- | --- | --- |
| START | 0–2 / 2 s | 0–2 / 2 s | THE PULL |
| APPROACH | 2–5 / 3 s | 2–3.25 / 1.25 s | THE FIRE, first half |
| HORIZON | 5–8 / 3 s | 3.25–4.5 / 1.25 s | THE FIRE, second half |
| SINGULARITY | 8–12 / 4 s | 4.5–5.5 / 1 s | THE CLOUDS, first half |
| WORMHOLE | 12–16 / 4 s | 5.5–6.5 / 1 s | THE CLOUDS, second half |
| VOID | 16–17 / 1 s | 6.5–7.5 / 1 s | THE VEIL |
| BIRTH | 17–20 / 3 s | 7.5–10 / 2.5 s | THE REVEAL |
| Total | 20 s nominal | **10 s nominal** | Accepted click to exploration |

START retains its two seconds but the camera now moves immediately. The named
FIRE beat only describes pacing/horizon emphasis and existing haze activation;
it introduces no literal fire or plasma. WORMHOLE remains an internal phase ID;
Journey 3 still bypasses Journey 2's tunnel and related callbacks.

The Journey 3 loop carries excess frame time across boundaries instead of dropping
it each time a timer expires. Existing approach/horizon/singularity/wormhole/void/
birth/complete events occur once and in order. Transition callbacks run only after
the outgoing atmospheric state reaches the boundary, preserving opaque handoff.

## Actual duration and clock

The actual App frame method was exercised with real CameraDirector,
JourneyDirector, theme activation, existing saved F/G, a deterministic local-map
loader and a simulated browser clock/task boundary:

| Simulated refresh rate | Normal-mode click to restored exploration |
| --- | ---: |
| 30 FPS | 10.000000 s |
| 60 FPS | 10.000000 s |
| 120 FPS | 10.000000 s |
| 60 FPS with existing 1/3 slow motion | 30.000000 s |

These are automated flow measurements, not physical stopwatch measurements.
Journey 3 alone now receives elapsed time measured from performance.now(), starting
at accepted journey start. Its camera and phase clocks receive the same delta and
existing time scale. Previously the App advanced journeys by 0.016 per rendered
frame, making real duration depend on frame rate. Other journeys, ordinary flight,
transit and exploration updates retain their existing timing.

A frame over 100 ms is clamped to preserve readable choreography rather than jump
across the veil on tab return or a severe stall. Such stalls extend wall time.
The existing BIRTH map-ready hold is also preserved: cold/unavailable map work can
extend the fully masked interval and total time. The normal shared-4K handoff
settles without a second download. Existing optional High remains independent;
BIRTH still waits only on the existing base-map readiness promise. Normal operation
therefore targets 10 seconds, subject to frame quantization and exceptional holds.

## Camera path and framing

Before this pass the camera remained stationary relative to Earth for START,
then used a 14-second quintic envelope with linear radius interpolation, a
0.12-radian shallow arc and lateral limb focus. Arrival held the destination home
pose stationary through reveal.

The new source path uses one quintic envelope over 0–6.5 seconds:
`p = smootherstep(0, 6.5, elapsed)` and
`distance = safeStart * (safeEnd / safeStart)^p`.
This logarithmic radius interpolation gives deliberate apparent-scale growth,
smooth acceleration from rest and deceleration into the veil. It does not restart
or insert a stop at intermediate phase boundaries. The live world center is
recomputed for every pose, so Earth stays anchored while it orbits.

The shallow arc increases to 0.18 radians (about 10.3 degrees). Camera focus blends
from the actual accepted look offset to Earth over 0–2 seconds. Upper-limb framing
blends in over 1.5–4.5 seconds. The target is a true visible tangent point of the
measured sphere, using radial component R²/D and tangent component
sqrt(R² - (R²/D)²). The tangent points toward the projected approach up-axis, placing
the globe below the horizon instead of selecting its sideways limb. Polar starts
retain the existing axis fallback. No FOV, roll system or lens effects are added.

The endpoint is min(startDistance, R * 1.10 + 2 * camera.near), approximately
**2.40 world units** for R=2 and near=0.1, versus 2.36 previously. Both start and
endpoint are bounded outside R+0.001, including unsafe already-inside starts in
the tests. Existing conservative bounds for rotated/nonuniform ancestors and
explicit shear are unchanged. The camera never intentionally crosses solid Earth.
It is still an exterior limb approach, not a literal landing.

The registered environment handoff remains under full whiteout. Arrival starts at
94% of the established home distance from its look target, then eases back to the
exact existing home over the 2.5-second reveal. Focus stays on the destination
look target. This six-percent pull-back supplies subtle readable motion without
exposing the unrelated world-coordinate switch. It finishes at the existing home
pose, avoiding a camera jump when exploration resumes.

EarthJourney supplies reusable pose/vector data only. CameraDirector remains the
sole camera owner, and its source is byte-for-byte unchanged. The existing
CameraDirector pose hook and normal travel/finishTravel lifecycle apply the poses.
No flight physics, saved home pose, Earth orientation or rendering is changed.

## Existing atmospheric layers, retimed

JourneyAtmosphere is unchanged: the same three borrowed-curtain compositor layers
and their original gradients/transform behavior remain.

- Haze increases from 2.0 to 4.5 seconds.
- Existing cloud diffusion increases from 4.5 to 6.5 seconds.
- Whiteout increases from 6.0 to 6.5 seconds.
- Full opaque veil lasts 6.5–7.5 seconds: **1.0 second nominal**.
- The same layers fade together over BIRTH, 7.5–10.0 seconds, with quintic easing.

Pending destination maps retain the opaque BIRTH hold. No additional overlay,
texture, render target, shader, particle, audio event or postprocessing pass is used.

## Preservation and cancellation

READY remains 10.0 from Planetary Earth's live world center, and fresh LMB still
must hit its actual solid Earth mesh. Gateway, Earth radius/orbit/spin/tilt and
shared licensed 4K/8K infrastructure are unchanged. Registered environment
activation, exactly-once handoff and independent saved F/G restoration are intact.

ESC was exercised through the actual existing App keyboard route in all seven
phases: START, APPROACH, HORIZON, SINGULARITY, WORMHOLE, VOID and BIRTH. It cancels
the journey, clears all curtain children, releases camera/source references,
stops transit, resets both mouse states and returns within the currently active
theme with its saved F/G. Pending readiness after cancellation cannot recreate
overlays. Completion releases cinematic ownership and restores exploration.

Journey 2's source, durations, tunnel, callbacks and global timing remain unchanged.
The new suite strips only the scoped App clock addition and asserts the remainder
matches protected GREEN exactly. All other src/public files are protected, including
CameraDirector, JourneyDirector, JourneyAtmosphere, Earth rendering, themes,
flight, GUI, storage, gateway code, renderer and licensed textures.

## Regression results

- Production build passed: 86 modules; main bundle **846.03 kB**, gzip **223.37 kB**.
- `git diff --check` passed; new files also checked for trailing whitespace.
- Cinematic characterization: **97,151 checks**, covering exact phase/event times,
  carried overshoot at several frame steps, single handoff masking, increasing
  apparent size, opening movement, acceleration/deceleration, upper tangent framing,
  polar and close/inside starts, exterior geometry, reveal continuity/home endpoint,
  clock clamp and exact protection of all other source systems.
- Journey integration: **2,215 checks**, including real App flow at 30/60/120 FPS,
  30-second slow motion, complete camera/curtain release, single handoff, saved F/G,
  ESC in every phase and unchanged Journey 2 timing/event replay.
- Atmosphere/path: **20,039 checks**, including live orbital/parent transforms,
  conservative scale/shear bounds, monotonic movement/opacity, loading hold,
  cancellation and late readiness. The lower count than Pass 4 reflects sampling
  the shorter source approach, not removal of geometry checks.
- Planetary gateway: **236 checks** passed.
- Planetary Earth visual/resource sharing: **4,166 checks** passed.
- Theme 4 Earth detail: **64 checks** passed, including asset checksums and quality.
- Universal ESC: **316 checks** passed across seven themes.
- Existing Space/Galaxy Traveller characterization passed.

Existing fixture updates align phase-duration bounds and arrival assertions with
this pass and expand cancellation coverage. The Pass 5 protection guard exempts
only the authorized EarthJourney/App timing files; the new Pass 6 suite separately
verifies App's remaining code exactly and protects every other src/public file.
The App's original LF format is retained for its existing exact callback guard.

Existing warnings, separate from results: Vite's greater-than-500-kB bundle advisory
remains. Earth failure-path suites intentionally print fallback/download/dimension/
upload messages; their checks pass. Git also reports its configured LF-to-CRLF
conversion advisory for App.js; the whitespace check succeeds and its original
working-copy LF format preserves the existing callback guard. No unexpected build
or test failure remains.

## Physical test instructions and remaining visual limitations

1. Disable debug slow motion. Approach Earth; confirm READY at 10.0 and accept a
   fresh solid-surface LMB hit. Time from click to restored exploration: about 10 s.
2. Check immediate smooth PULL, increasing Earth size, stable live-orbit anchoring
   and upper horizon framing. Check several approach directions and close starts
   for clipping, abrupt turns or unwanted horizon composition.
3. Observe haze through FIRE, existing cloud diffusion through CLOUDS, half-second
   whiteout ramp, roughly one-second opaque VEIL and 2.5-second REVEAL. There should
   be no tunnel, black fade or visible world-coordinate jump.
4. During reveal, check the small pull-back stays smooth and finishes at OUR WORLD
   home without a final snap. Verify existing Standard/High and saved F/G behavior.
5. Press ESC in each phase, including loading/reveal. Confirm correct active theme,
   Return Home, restored settings, cleared curtain and neither mouse button stuck.
6. Replay Journey 2; verify original duration, wormhole and callbacks. Recheck
   Planetary Earth READY/live tracking, ordinary flight and other themes.
7. Repeat completion/cancellation and theme changes. Check FPS/loading behavior at
   different refresh rates and high DPI; severe stalls/loading may extend duration.

No physical visual or stopwatch GREEN is claimed yet. FIRE has no new flame,
plasma or thermal shader. Clouds/haze remain static screen-space gradients rather
than volumetric/depth-aware weather. Atmospheric scattering and globe rendering
are unchanged. Matching geography does not synchronize source/destination Earth
orientation or illumination. Horizon composition and subjective intensity need
physical review, particularly from polar/very close approaches. Near-plane
cropping can remain at extremely close starts despite solid-surface safety.

## Changed files and Git status

Modified:

- `src/systems/cinematic/EarthJourney.js`
- `src/core/App.js` (Journey 3 clock routing only)
- `experiments/journey3-characterization.mjs`
- `experiments/journey3-atmosphere-characterization.mjs`
- `experiments/planetary-earth-visual-characterization.mjs`

New/untracked:

- `experiments/journey3-cinematic-characterization.mjs`
- `docs/JOURNEY-3-CINEMATIC-PASS-6.md`

Working tree was clean before this pass. These seven files are the complete Pass 6
scope; changes remain unstaged. HEAD remains the protected GREEN. No commit, push,
web preview or changes to synced ChatGPT project reference files.
