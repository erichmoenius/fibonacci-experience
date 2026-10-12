# Atmospheric plasma rework — Pass 7A.1

Protected GREEN: `78f72485b05b68be116ea4d11faaf1e9848e788d`.
Pass 7A remains uncommitted; user physical verdict: **RED**.
OBS review: plasma barely visible, decorative flares, no convincing entry energy.

**Same component reworked and regression-checked. STOPPED FOR PHYSICAL GREEN.**
No camera/choreography/timing-system change, cloud system, preview, commit or push.

## Root cause: why 7A was weak

Inspection and real WebGL/browser measurements found correct projection, shader
compilation, premultiplied output and layer visibility. Tone mapping was disabled
locally, so no global exposure reduction was responsible. The weakness was the
spatial/intensity design and its normal compositing:

- A 0.16 alpha ceiling was multiplied by a squared noise threshold, separate
  breakup gate, corner-patch mask and edge mask. Few pixels approached that ceiling.
- Isolated patches supplied no sustained sheath behind the sparse filaments.
- Normal blending only mixed a small fraction of plasma color into the underlying
  image, rather than contributing luminous energy on top of Earth's radiance.
- Original colors already reached near-white in core pixels; brightness scaling
  alone would not repair the very low average contribution/coverage.
- The existing haze layer sits above the scene and further attenuates the effect.
  At 3.2 seconds its logical opacity is 0.46254; its gradient has varying alpha.
- Flow was relatively slow (`0.7*time + 2*progress`), and warm tint was too rare and
  weak to register in the original peak's measured blue-dominant pixels.
- The old GPU check required only nonzero fragments and a maximum-alpha bound.
  It did not require a meaningful composited signal beneath the actual haze.

The original effect at 3.2 seconds had only **0.82% mean whole-frame alpha**, **1.22%
mean edge alpha**, and **1.11% of screen pixels** above alpha 0.1. Despite a maximum
of 41/255, its actual browser-composited average edge change was just **2.65 / 255**.
That matches the physical assessment of faint flares.

## Rendering changes

The existing JourneyPlasma mesh is reused: one two-triangle plane, one material,
one program, four scalar uniforms, no textures/particles/render targets. There
is no second effect, extra camera or independent render/update loop.

Sparse corner patches are replaced with a connected lateral sheath and a broken
upper crown. Turbulence bends primary ribbons and narrower branching filaments.
Noise-driven width, detail and shifting hot zones make shape/thickness change
through the crescendo, rather than merely changing global opacity. No closed
bottom ring or radial tunnel is introduced. The central horizon corridor stays
open, and the shader still discards its protected center before expensive work.

The density now contains sustained sheath energy supporting brighter filaments,
instead of multiplying several sparse gates. Blue-white cores, cyan/violet lower
energy regions and occasional amber/orange hot zones share the same procedural
field. The warm regions are spatially gated to the stronger structures, not a
rainbow color cycle. In the representative 3.2-second sample, about **6.1% of
visible plasma pixels** meet the warm-color test; blue-white remains dominant.

Local blending changes to **premultiplied additive**. The alpha ceiling is **0.68**,
with the center still exactly zero. Output color-space conversion precedes
premultiplication. The opaque-reference compositing test confirms no underlying
horizon pixel is darkened. Bright edges can wash detail and need physical review;
central Earth/horizon visibility is explicitly protected by the open corridor.

Tone mapping/exposure, bloom settings, Earth shading and curtain layers are
unchanged. Layer 0 continues excluding selective bloom; the material stays
transparent with no depth test/write. It renders through the existing two main
scene passes beneath the established HTML haze/curtain.

Backward drift becomes `2.4*time + 4*descentProgress`, compared with `0.7*time +
2*descentProgress`. Both inputs are still the existing authoritative Journey 3
values. Drift is monotonic, faster and varies with descent acceleration. No new
clock, animation timer or motion input is introduced.

No temporary intensity control was necessary: fixed bounded parameters are
measured by the strengthened visibility checks. No F/G controller, storage value
or global development override was added.

## Visual timing — existing journey unchanged

All visual segments use quintic smootherstep; the original phase IDs/durations
and 10-second journey remain untouched.

| Journey time | Reworked plasma intensity |
| --- | --- |
| 0–2.0 s | Zero, no draw |
| 2.0–3.4 s | Smooth ignition from 0 to 1 |
| 3.4–3.8 s | Strong short crescendo at 1; filaments keep flowing/changing |
| 3.8–4.35 s | Controlled decay from 1 to 0.55 |
| 4.35–5.0 s | Dissolution from 0.55 to 0 |
| 5.0–10.0 s | Zero, mesh removed and GPU resources disposed |

At 3.2 intensity is 0.976736; at 4.5 it is 0.503645; at 4.99 it is 0.000019568
and the sampled 8-bit alpha is already zero. Resource release moves from 6.5 to
**5.0 seconds**, before the opaque veil and BIRTH. The existing haze/cloud phase
provides the background dissolution; no cloud system is added.

## Measured visible contribution before/after

Real headless Chromium WebGL2/SwiftShader renders the production shader at
320x180. The browser comparison uses an opaque synthetic horizon swatch beneath
the effect and the **actual production JourneyAtmosphere haze** at 3.2 seconds.
The same scene/haze is captured with the effect hidden and shown, then pixel
changes are measured. This verifies composited contribution, not merely shader
maximum values. It is not a full Earth GPU or physical acceptance test.

| Metric at 3.2 s | 7A RED | 7A.1 |
| --- | ---: | ---: |
| Intensity envelope | 1.000000 | 0.976736 |
| Maximum sampled alpha | 41/255 | 169/255 |
| Mean whole-frame alpha | 0.008184 | 0.141659 |
| Mean edge alpha | 0.012244 | 0.220647 |
| Screen fraction with alpha >= 0.1 | 1.11% | 40.89% |
| Mean composited edge channel change | 2.65/255 | **50.53/255** |
| Edge fraction with channel change >= 26/255 | 1.03% | **62.48%** |
| Protected-center composited change | 0 | **0** |
| Underlying reference pixels darkened | not previously checked | **0** |

The comparable edge signal is about **19 times stronger**, even though the new
envelope is slightly below peak at this sample. The improvement comes from
coverage/coherence and luminous compositing as well as the bounded alpha change.

The tests now require significant average edge signal and strong-pixel coverage,
unchanged central pixels, no darkening, visible occasional warm regions and
changing alpha shapes at two times with identical crescendo intensity (3.4/3.7).
Changing image/alpha hashes during that plateau confirms more than an opacity
fade. Static isolated/composited images were visually inspected during QA.

Recorded measurements: [before](PLASMA-7A1-before.json),
[after](PLASMA-7A1-after.json). The before capture was recorded before source rework;
it is archival RED evidence, not a second runtime component.

## Performance / lifecycle

- Same 140-byte geometry data estimate, two triangles, one material/program and
  no texture allocation. Driver program/metadata overhead remains unmeasured.
- Same one extra draw per existing main scene pass, normally two per active frame;
  no selective-bloom draw and no added postprocessing.
- The procedural budget remains fixed: seven value-noise calls (28 hashes) plus
  five Gaussian ridge evaluations and a few sinusoidal bends. Compared with the
  original eight noise calls/32 hashes, ridge work replaces sparse gating.
- More edge pixels contribute visibly, but early center/empty-support discard is
  retained. Actual fill/SFU cost at high resolution requires hardware measurement.
- Active duration shrinks from 4.5 to 3 seconds. There are one-third fewer active
  effect frames/draws at the same frame rate; this is not a guaranteed total-frame
  speedup or GPU timing measurement.
- Isolated real WebGL geometry/program counts return to zero at 5 seconds and
  stay zero in veil/BIRTH samples. Every-phase ESC, manual theme exit, repeat
  completion and late-update cleanup remain idempotent.
- First-use shader compilation can still hitch. RTX 4070 Laptop 8 GB frame-time,
  full-scene Earth readability and high-DPI behavior require physical review.

No extra image assets, loaders, renderer or global render-state mutation are used.
CameraDirector, EarthGlobe, curtain cleanup, destination home, Journey 2, gateway,
flight and independent F/G remain unchanged from protected GREEN.

## Regression results

- Plasma envelope/lifecycle: **23,391 checks** passed, with the new 5-second cutoff,
  smooth segment boundaries, source-clock publishing, blending/resource policy,
  cancellation in every phase, repeated completion and protected-runtime guards.
- Actual shader/browser test passed: compile/link, premultiplied output, alpha cap,
  open center, warm fraction, flowing/changing field at constant intensity,
  significant post-haze signal, non-darkening compositing and resource release.
- Actual journey integration: **2,267 checks**, including actual App ESC and theme
  exits, single registered handoff, saved F/G and Journey 2 replay.
- Timing remains **10.000 s at simulated 30/60/120 FPS**, one-second full veil and
  the existing 30-second debug slow motion.
- Cinematic: **97,151**; atmosphere/path: **20,039**; BIRTH continuity: **7,231**;
  frame sequence: **15,591**; visual render boundary: **18,858** checks passed.
- Actual browser curtain cleanup regression passed unchanged.
- Earth visual/sharing: **4,166**; Earth detail: **64**; gateway: **236**;
  Universal ESC: **316**; Space/Galaxy Traveller characterization passed.
- Production build: **87 modules, 854.34 kB / gzip 225.80 kB**.
- Git whitespace and new-file whitespace checks passed.

Existing warnings: Vite bundle-size advisory and intentional Earth failure-test
messages. No unresolved shader/build/test failure. These quantitative/software
checks do not override physical RED or claim RTX performance GREEN.

## Physical instructions

1. Replay Journey 3 with slow motion off and watch 2–4 seconds. Plasma should form
   a clearly visible blue-white edge sheath with turbulent backward flow and a
   recognizable crescendo, rather than faint stationary decorative flares.
2. Check that the Earth horizon/coastlines remain recognizable in the open center.
   Inspect side illumination and occasional orange/amber hot zones; report any
   excessive whitening, portal/frame impression or laser/tunnel appearance.
3. Watch thickness and shape changes during 3.4–3.8 seconds. Confirm continuous
   dissolution into the atmosphere and **no plasma after 5.0 seconds**, including
   veil, BIRTH and normal exploration.
4. Confirm the original camera path, 10-second journey, one-second full veil,
   unchanged BIRTH continuity and correct curtain cleanup. The already accepted
   minimal rightward slide is not retuned.
5. ESC in every phase and switch themes during the peak. Repeat journeys; check
   no leftover glow, input state, curtain or growing resources. Verify saved F/G.
6. Compare frame time/FPS at the same settings on RTX 4070 Laptop, regular/high DPI
   and Standard/High Earth quality. Check first-use compilation and bright-edge
   blending with the actual local Earth textures. Replay Journey 2 unchanged.

Subjective high-speed-entry energy, actual Earth readability and hardware budget
remain pending physical acceptance. The effect is still a screen-space visual
approximation with a protected corridor, not volumetric atmosphere or a cloud system.

## Exact changed files / Git

7A.1 edits to existing uncommitted files:

- `src/systems/cinematic/JourneyPlasma.js` — sheath, blending, flow and envelope.
- `experiments/journey3-plasma-characterization.mjs` — revised timing/blend/cap tests.
- `experiments/journey3-plasma-browser-characterization.mjs` — average/strong-pixel,
  warm/shape checks and actual post-haze browser compositing comparison.
- `docs/JOURNEY-3-PLASMA-PASS-7A.md` — mark original physical RED and superseded status.

Added:

- `docs/JOURNEY-3-PLASMA-PASS-7A1.md`
- `docs/PLASMA-7A1-before.json`
- `docs/PLASMA-7A1-after.json`

The other pending 7A files remain its existing lifecycle integration and narrow
regression guard/cleanup additions; no new changes to camera/timing/curtain systems.
The combined 7A/7A.1 working tree contains **13 intended files**, all unstaged;
index empty and HEAD still protected GREEN. No commit, push or application preview.
