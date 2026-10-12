# Journey 3 dynamic atmospheric descent - Pass 7H

Focused visual experiment implemented. Automated checks and one final build PASS. STOP for physical visual approval; no GREEN claim.

## Exact changed files

- src/systems/cinematic/JourneyPlasma.js: existing fire shader gains accelerating advection and localized irregular heating modulation. Existing amber colour, alpha cap, central Earth window, fire timing, mesh and lifecycle retained. No new plasma, flares or overlay.
- src/systems/cinematic/JourneySpatialClouds.js: existing three banks gain nonlinear depth-dependent flow, independent smooth gusts, slight bank rotation, evolving soft silhouettes, limited lighting variation and a late dark storm envelope. Same 12x8 curved geometry, path anchors, borrowed cloudMap, perspective/depth settings and mesh ownership.
- experiments/journey3-dynamics-browser-characterization.mjs (new focused fixture).
- docs/JOURNEY-3-DYNAMIC-DESCENT-PASS-7H.md (this report).

## Progression within the frozen journey

0-2 seconds: existing quiet approach; no fire or spatial clouds.
2-4.5 seconds: localized amber ignition, irregular brightness and increasing flow in the existing fire material.
4.5-5.85 seconds: spatial banks enter with increasing flow. Near bank moves faster than far banks; each gust has a different rate.
5.85-6.65 seconds: turbulence and storm density build; bank silhouettes evolve and the corridor narrows.
6.65-7.12 seconds: brief surrounding blue-grey storm, increased optical density, restrained sunlight and modest bank scaling. Distant space is concealed by actual depth-tested cloud geometry.
7.12-7.45 seconds: storm intensity clears smoothly; bank resources are disposed at 7.45 before BIRTH.
7.5-7.95 seconds: existing Pass 7F dissolve, unchanged. Journey still completes at 10 seconds.

The bank visual lifetime intentionally extends from the prior 6.5-second cutoff to 7.45 seconds to carry storm immersion up to the handoff. This changes only the cloud envelope, not journey phases, camera sampling or BIRTH timing. All dynamics use the authoritative journey clock. No camera shake, new independent clock, new textures, mesh system or curtain.

## Preservation and validation

Hash checks preserve every existing changed file outside the two atmospheric runtime edits. EarthJourney, CameraDirector, App, Renderer, JourneyBirthDissolve, JourneyAtmosphere grey isolation, themes, Earth systems and older fixtures/reports are byte-for-byte unchanged. Curved geometry generation is exactly Pass 7G. No modifications to Journey 1/2, LMB flight, ESC or F/G.

- Atmospheric dynamics GPU fixture: PASS, 60 checks, no shader errors. Nonlinear acceleration, evolving spatial projection/parallax, actual Earth depth occlusion, transparent mesh corners, pre-BIRTH release, six geometry/material disposals and borrowed texture survival.
- Over the isolated actual-path reference, substantial cloud coverage of distant space increases from approximately 18.2% at 4.85 seconds to 100% at sampled storm times 6.5/6.8/7.05 seconds, then drops to approximately 12.2% by 7.3 seconds. This measures pixels with cloud alpha above 0.25 in regions without Earth, not an opaque flat curtain.
- Existing fire GPU/compositor regression: PASS, including warm dominance, actual shader compilation, alpha cap, central horizon clearance and lifecycle. Initial modulation made ignition too dim; restoring the warm emission baseline corrected the affected check without removing localized variation.
- Spatial integration: PASS, 2,299 checks including 10-second timing at 30/60/120 FPS, handoff, every-phase ESC, manual theme exits, completion and Journey 2 replay.
- Whitespace: PASS.
- One final production build: PASS, 89 modules, 2.77 seconds. dist/assets/index-B1oeevaj.js: 868.32 kB, gzip 230.35 kB. Existing Vite bundle-size advisory remains.

## Performance and remaining limitations

Still three banks, 576 triangles and one borrowed weather lookup per fragment. No new GPU texture allocation or render pass. Added shader work consists of small procedural silhouette fields; CPU transforms use smooth deterministic gusts. Storm scaling and longer lifetime increase transparent fill/overdraw during the late crescendo; actual RTX 4070 Laptop performance remains unmeasured.

These are curved surfaces, not volumetric clouds. The unmodified camera slows near the end, so cloud movement supplies the added momentum. Dense storm coverage may still read too uniform, too close or too strong in the full scene; bank intersections, portrait framing, near-plane fading and subjective light intensity require physical review. Automated pixel coverage does not establish artistic success.

Physically review anticipation versus ignition, progressively rushing banks, asymmetric turbulence, the short dark immersion and clearing before the unchanged BIRTH dissolve. Check for clipping/transparency flashes or an apparent flat grey fill, and watch GPU frame pacing. ESC during storm immersion and repeat/theme exit must leave no resources or residual cloud image.

No Web preview, commit or push. All work remains uncommitted. STOP for physical visual approval.
