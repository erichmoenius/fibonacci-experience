# Journey 3 atmospheric plasma ignition — Pass 7A

Protected GREEN: `78f72485b05b68be116ea4d11faaf1e9848e788d`.

**PASS 7A PHYSICAL VERDICT: RED — faint decorative flares, insufficient entry energy.**
This report preserves the original 7A implementation and measurements. Its plasma
shader/envelope/blending are superseded by the uncommitted 7A.1 rework in
[JOURNEY-3-PLASMA-PASS-7A1.md](JOURNEY-3-PLASMA-PASS-7A1.md).
The existing camera/timing/curtain integration is preserved. Physical GREEN is pending.
No application preview, commit or push. No camera/timing/curtain change, new cloud
system or audio-reactive behavior. The accepted minor rightward slide remains as
in the protected checkpoint and is not tuned here.

## Inspection and integration

Journey 3 already owns the authoritative elapsed/phase clock and its atmospheric
state. Its updateAtmosphere() runs as part of that same phase progression before
the single CameraDirector update. JourneyAtmosphere owns the established borrowed
curtain; its cleanup commits opacity zero before restoring CSS transitions.
Completion/cancel clearAtmosphere(), and the existing development-theme switch
stops the journey before disposing the old theme. BIRTH activates environment at
7.5 seconds and releases the source; the full veil begins at 6.5 seconds.

Only a new JourneyPlasma component and visual lifecycle hooks were added to
EarthJourney: create on prepare, publish elapsed/descent progress during the
existing atmospheric update, dispose on cleanup. It attaches one mesh to the
source target's scene root. A previous instance is disposed before replacement.
The effect self-disposes at 6.5 seconds, before handoff, and cleanup remains
idempotent on completion, ESC or theme exit.

An exact source guard strips those hooks and verifies the rest of EarthJourney
matches protected GREEN. App, CameraDirector, JourneyDirector, JourneyAtmosphere,
EarthGlobe, SolarSystem, EnvironmentTheme, renderer, flight, F/G, textures and all
other runtime systems are unchanged. Journey 2 retains its timing/tunnel/callbacks.

## Rendering approach

One two-triangle screen-space PlaneGeometry with one ShaderMaterial participates
in the existing main scene passes. Its clip-space vertex shader does not read or
write camera transforms. It has no render() loop, independent clock or renderer.
No texture, render target, loader, DOM layer or new postprocessing pass is added.

The procedural fragment shader uses a bounded three-octave value-noise turbulence
field, anisotropic filament coordinates and separate breakup modulation. Left,
right and upper patches are asymmetric and open. They avoid a complete radial
ring, laser-line field or tunnel. A central radius of 0.27 in normalized UV is
fully transparent; patch/edge masking discards empty regions before turbulence.
The effect is visual screen-space entry plasma, not physical volumetric scattering.

Palette: blue-white cores, restrained cyan/violet lower-density edges and a rare
warm tint gated by a high noise threshold and limited to 12% color mixing.
Fragment alpha is capped at **0.16**, with normal premultiplied alpha blending.
Colors are converted to output color space before premultiplication. Depth test
and writes are disabled. The material is not tone mapped and changes no exposure.
It renders after scene transparencies, beneath the existing HTML curtain.

Mesh layer 0 excludes the Planetary selective-bloom layer. No extra bloom is
introduced. Flow uses the monotonic expression `0.7 * journeyTime + 2 * descentProgress`,
so streak drift varies with the existing approach and never reverses due to a
second timer. Descent progress is the existing quintic 0–6.5-second envelope.
Aspect comes from the existing renderer's drawing-buffer size during its normal
draw callback; this callback does not advance animation or alter renderer state.

## Exact visual envelope

The component uses Journey 3 elapsed seconds, including the existing slow-motion
scale and loading/stall conventions. The current 10-second schedule is unchanged.
Each segment uses quintic smootherstep, with zero slope at its boundaries.

| Journey time | Intensity / behavior |
| --- | --- |
| 0.0–2.0 | Exactly zero; mesh hidden, no plasma draw |
| 2.0–3.2 | Smooth ignition from 0 to 1 |
| 3.2 | Peak intensity 1 |
| 3.2–4.5 | Controlled decay from 1 to 0.24 |
| 4.5–6.5 | Residual decay from 0.24 to 0 |
| 6.5–10.0 | Exactly zero; resources disposed and mesh removed |

At 6.49 seconds intensity is approximately 0.000000298; sampled 8-bit alpha is
already zero. At 6.5 the mesh is removed and geometry/material are disposed.
No plasma exists during VOID, the one-second full veil or BIRTH. No new opacity
behavior is added to the curtain or its cleanup.

## GPU and resource lifecycle

- One geometry: two triangles; about **140 bytes** of position/normal/UV/index data
  before driver alignment/metadata. One local material/program and four scalar
  uniforms. No additional Earth maps or texture allocations.
- During the visual window: one additional draw per existing main scene pass,
  normally **two extra scene draws per frame** in this renderer. No plasma draw
  in the selective-bloom camera/pass. Existing pass count and renderer state stay
  unchanged. Before ignition and after removal, no plasma draw is submitted.
- Fragment work is bounded but not free: up to eight value-noise calls / 32 hash
  evaluations on supported edge pixels, with early discard in the open center
  and empty patches. Screen resolution and DPR govern fill cost.
- Geometry/material are allocated once per accepted journey. Shader/vertex upload
  occurs on first visible draw. A first-use compilation hitch remains possible.
- update(6.5) hides/removes the mesh and disposes GPU resources once. Later updates
  cannot revive it. Completion and cancel release the owner reference. Manual
  theme exits and repeated journeys do not leave a scene child or active resource.
- Actual isolated WebGL counters return to **zero geometry / zero program** at
  6.5 seconds and remain zero in the BIRTH sample.

The existing 4K Earth texture budget is unchanged. Actual program/driver overhead,
frame time and total VRAM on RTX 4070 Laptop 8 GB are not measured by these tests.
High-DPI/4K fragment cost and first-use compilation need physical testing. No claim
of a guaranteed 60 FPS or hardware GREEN is made.

## Regression and shader verification

- New plasma lifecycle/envelope suite: **21,360 checks**, including bounded and
  monotonic intensity, zero-slope ignition/peak/residual endpoints, authoritative
  time/progress publishing, main-layer/bloom isolation, alpha/depth policy, two
  triangles, every-phase cancellation, repeated completion, exactly-once disposal,
  late-update inertness and exact protected-choreography/source comparisons.
- Real headless Chromium WebGL2 / SwiftShader fixture: shader compiles and links;
  actual RGBA readback verifies premultiplied output, peak alpha at most 41/255
  (8-bit rounding of 0.16), clear center, flowing field, blue-dominant palette,
  one draw/geometry/program in the isolated scene and complete resource release.
  At peak, about 21,316 of 57,600 pixels have nonzero alpha; the center pixel is zero.
  PULL/6.5/BIRTH samples have zero alpha and zero effect draws.
- An isolated static peak image was visually inspected during QA. No application
  preview was opened. This is not a full Earth/curtain visual acceptance test.
- Actual Journey integration: **2,267 checks**, including plasma removal through
  the actual App ESC route in all seven phases and manual theme exit during
  ignition/BIRTH, plus registered handoff, saved F/G and unchanged Journey 2 replay.
- Actual App timing still measures **10.000 seconds at simulated 30/60/120 FPS**;
  existing 1/3 slow motion remains 30 seconds. The full veil remains one second.
- Cinematic path/timing: **97,151 checks**; atmosphere/path: **20,039**;
  BIRTH continuity: **7,231**; frame ownership/C0/C1: **15,591**;
  visual render-boundary: **18,858**.
- Real-browser curtain opacity/pixel/cancellation regression passed unchanged.
- Earth visual/sharing: **4,166**; Earth detail: **64**; gateway: **236**;
  Universal ESC: **316**. Space/Galaxy Traveller characterization passed.
- Production build passed: **87 modules**, bundle **853.50 kB / gzip 225.53 kB**.
- Git whitespace and new-file trailing-whitespace checks passed.

Only the newly authorized JourneyPlasma file is exempted from four older broad
source-protection guards. The new suite protects every other src/public file
against this pass's GREEN and verifies the EarthJourney hooks exactly. Existing
integration assertions now also require plasma removal on actual cancel/exit.

Warnings separately: existing Vite greater-than-500-kB bundle advisory and
intentional Earth failure-test messages. No unresolved build/shader/test failure.
The isolated browser fixture uses software WebGL, not the RTX 4070 or production
Earth textures; physical quality and frame-time acceptance remain pending.

## Physical test instructions

1. With slow motion off, accept a fresh Earth surface hit inside READY 10. Confirm
   no plasma during the initial two-second PULL.
2. Inspect ignition during 2–3.2 seconds, the brief peak and controlled decay to
   4.5. Look for blue-white turbulent edge streaks with subtle cyan/violet and rare
   warm hints. Earth/coastlines should remain recognizable through the open center.
3. Confirm residuals fade during 4.5–6.5 and disappear before the full veil.
   No plasma should return during BIRTH or exploration.
4. Verify the original approach, 10-second completion, one-second veil, smooth
   handoff and correct curtain cleanup. The accepted minor rightward slide is
   unchanged; plasma must not add motion, shake, brightness pulses or bloom.
5. ESC in every phase and switch themes during ignition/reveal. Confirm no residual
   glow, scene mesh, curtain, input lock or changed saved F/G. Repeat journeys.
6. Check regular/high-DPI FPS and first-use stutter on the RTX 4070 Laptop 8 GB;
   compare before/after at the same resolution. Check resource counts across
   repeated cancellation/completion and Standard/High Earth quality.
7. Replay Journey 2 and normal Planetary/OUR WORLD flight/gateway behavior.

Subjective intensity, edge placement and the blend with existing haze/cloud
curtain need physical review. This is an incremental procedural visual pass, not
an atmospheric simulator or new cloud system. No audio-reactive effects are added.

## Exact changed files / Git

Modified:

- `src/systems/cinematic/EarthJourney.js` — isolated visual lifecycle hooks only.
- `experiments/journey3-characterization.mjs` — actual ESC/theme-exit cleanup checks.
- `experiments/earth-detail-characterization.mjs` — authorized guard exception.
- `experiments/planetary-earth-gateway-characterization.mjs` — authorized guard exception.
- `experiments/planetary-earth-visual-characterization.mjs` — authorized guard exception.
- `experiments/journey3-cinematic-characterization.mjs` — authorized guard exception.

New/untracked:

- `src/systems/cinematic/JourneyPlasma.js`
- `experiments/journey3-plasma-characterization.mjs`
- `experiments/journey3-plasma-browser-characterization.mjs`
- `docs/JOURNEY-3-PLASMA-PASS-7A.md`

Repository was clean at inspection. Exactly ten intended Pass 7A files remain
unstaged; index empty. HEAD remains protected GREEN. No commit, push, application
preview, downloaded assets or synced project-reference changes.
