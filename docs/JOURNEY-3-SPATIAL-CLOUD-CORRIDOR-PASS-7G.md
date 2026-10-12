# Journey 3 spatial cloud corridor - Pass 7G

Prototype implemented; focused checks and one final build PASS. STOP for physical visual review. No physical GREEN claim.

## Implementation and files

- src/systems/cinematic/JourneySpatialClouds.js (new): three curved world-space cloud banks. Each mesh has a 12x8 segmented surface (192 triangles); total 576 triangles. Alternate sides of the corridor, staggered view depths, and distinct weather-map patches.
- src/systems/cinematic/EarthJourney.js: sample the existing atmospheric pose at 4.65, 5.1 and 5.65 seconds to place banks, restoring elapsed time and cached pose after sampling. Follow live Earth translation; retain fixed world orientations rather than camera attachment/billboarding. Update from the existing journey clock. Dispose before BIRTH at 6.5 seconds and on cancellation/restart/theme exit.
- src/systems/cinematic/JourneyPlasma.js: optional screenClouds switch, defaulting to the prior behavior. This Journey 3 prototype passes false to suppress the former flat sheets; plasma shader and fire envelope remain unchanged.
- New focused fixtures: experiments/journey3-spatial-clouds-characterization.mjs and experiments/journey3-spatial-clouds-browser-characterization.mjs.

The banks use real model/view/projection transforms. Existing Earth cloudMap is borrowed without downloads, cloning or disposal. Soft irregular silhouettes, transparent mesh borders, near-plane alpha fading and restrained normal-based sunlight. Normal premultiplied blending, depth testing enabled, depth writing disabled; banks render after Earth's transparent cloud/rim layers while still respecting the solid Earth's depth. Low-amplitude wind uses the same journey clock. Existing haze/tint remains; no additional screen-space clouds, plasma or flares.

The active cloud window remains 4.5-6.5 seconds. Three temporary curved surfaces approximate cloud masses; they are not volumetric clouds. The meshes can be removed and the default flat-cloud option restored without changing protected camera or dissolve code.

## Frozen systems

Pass 7F App, Renderer and JourneyBirthDissolve are byte-for-byte unchanged: 7.5-7.95 second dissolve, readiness behavior and ownership preserved. Grey SVG stays disabled. CameraDirector, ThemeManager, EarthGlobe, Planetary/OUR WORLD, gateway, Journey 1/2 and controls untouched. Existing EarthJourney camera/BIRTH/alignment methods unchanged, handoff 7.5 seconds and total schedule 10 seconds.

Hash verification preserves every existing changed file outside the two authorized runtime edits. All older fixtures and reports are untouched; HEAD unchanged and all work remains uncommitted.

## Validation

- Spatial integration: PASS, 2,299 checks including Journey 2 replay, 30/60/120 FPS timing, single handoff, completion, every-phase ESC, manual theme exit, spatial resource removal and saved controls.
- Pass 7F versus 7G camera boundary traces and measured durations: identical.
- Existing BIRTH continuity: PASS, 7,231 checks.
- Isolated production geometry/shader GPU fixture: PASS, 53 checks, no shader errors. Real Earth texture and actual Journey 3 path; visible banks at 4.85, 5.1 and 5.7 seconds; staggered view depths; camera translation changes projection at fixed time; near/far banks have different perspective movement; Earth depth occludes a bank and disabling depth testing exposes it; dense-texture mesh corners stay transparent; six geometry/material resources disposed at 6.5 seconds; borrowed texture survives with references cleared.
- Sample near/far view depths at 5.1 seconds: approximately 0.396 / 0.690 / 0.911 units. Between 4.85 and 5.7 seconds, near-bank horizontal projection changes by about -1.534 NDC units versus -0.308 for the far bank. This is spatial passage, not merely texture scrolling.
- The GPU fixture caught a reserved shader identifier; it was renamed and the affected check passed.
- Whitespace: PASS.
- One final production build: PASS, 89 modules, 3.06 seconds. dist/assets/index-BqXnBLAb.js: 866.23 kB, gzip 229.59 kB. Existing Vite bundle-size advisory remains.

## Performance, limitations and physical review

No new texture allocations or volumetric raymarching. At most three bank draws per existing main-scene pass (six across the normal two passes); no extra selective-bloom draws. One weather lookup per bank fragment with modest geometry. Transparent overdraw is the principal cost. RTX 4070 Laptop GPU timing has not been measured; headless SwiftShader verifies rendering correctness, not real-device performance.

Near bank moves out of the viewport faster as the camera passes its side. The unchanged camera slows near the end of descent, limiting late-stage forward motion. Curved patches still approximate volume; object-level transparency sorting, alternate arrival directions, portrait framing, silhouettes and GPU frame pacing need physical assessment. Soft borders and near-plane fading prevent hard patch edges by construction, but isolated corner/occlusion checks do not prove every viewpoint is artifact-free.

Review the 4.5-6.5 second corridor: near/far perspective separation, camera appearing between banks, Earth horizon occlusion, no rectangle edges or clipping flashes, then complete cloud removal before the frozen Pass 7F BIRTH dissolve. Test ESC in the cloud window, repeat Journey 3 and theme exits. Confirm Journey 1/2, LMB flight and F/G after return.

No Web preview, commit or push. STOP for physical visual approval.
