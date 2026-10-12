# Journey 3 organic drama and dark occlusion - Pass 7C

Implemented and focused validation PASS. STOPPED FOR PHYSICAL VISUAL REVIEW; GREEN requires the user's approval.
Date: 2026-10-10. Protected HEAD: 78f72485b05b68be116ea4d11faaf1e9848e788d.
Continued from the existing uncommitted Pass 7B state; no restart.

## Visual changes

Plasma: replaced the clean diagonal field with advected, domain-warped eddies. Independent broad/detail/lifetime fields fragment brightness, opacity and shape at different scales and speeds. Asymmetric field variation, amber/orange illumination, restrained warm highlights and a clear central Earth window. Existing fire envelope, material, main-scene plane and authoritative journey clock retained.

Cloud canyon: three existing projected layers now form unequal weather banks around a winding corridor. Texture density and procedural variation break the silhouettes; foreground banks are denser and darker. Existing distinct drift/expansion speeds provide parallax; shifted texture samples provide shaded bodies and subtle sun-facing warm edges. Earth cloudMap and sunDirection remain borrowed. Texture distortion is restrained to preserve the existing weather structures.

Dark occlusion: replaced the pale curtain background with a small opaque procedural blue-grey cloud image and subtle warm scattering gradients. The static 192px SVG noise uses explicit sRGB interpolation so it stays dark rather than rendering as a pale cloud. Only transform and opacity change per frame. No new downloaded asset, dependency, independent clock or competing effect system. Existing handoff-opacity names remain for compatibility; they now control dark clouds, not whiteout.

## Protected behavior and preservation

EarthJourney is byte-for-byte unchanged from Pass 7B: duration remains 10 s, BIRTH starts at 7.5 s, camera choreography/alignment, loading and handoff envelopes are preserved. Dense occlusion uses the existing 7.18-7.82 s envelope and is fully opaque at handoff. Proven clear() and cancellation behavior are unchanged.

SHA-256 comparison against the pre-edit manifest confirms every existing changed/untracked file outside the two runtime spectacle files and three focused test fixtures is byte-for-byte preserved. CameraDirector, gateway/READY radius, Journey 1/2, FreeFlight/LMB, ESC/F/G implementation, Planetary/OUR WORLD Earth, assets and renderer are unchanged. HEAD unchanged, index empty; accumulated work remains uncommitted.

## Changed files in this pass

- src/systems/cinematic/JourneyPlasma.js
- src/systems/cinematic/JourneyAtmosphere.js
- experiments/journey3-spectacle-characterization.mjs
- experiments/journey3-plasma-browser-characterization.mjs
- experiments/journey3-curtain-browser-characterization.mjs
- docs/JOURNEY-3-ORGANIC-DRAMA-PASS-7C.md (this report)

## Focused validation

- Spectacle: PASS, 2,016 checks. Same 10-second schedule, exclusive fire/cloud windows, borrowed-map ownership, camera/lighting and cleanup preservation. Dense-mask opacity >0.9 for approximately 0.335 s; this is dark occlusion, not near-white imagery.
- Journey 3 integration: PASS, 2,267 checks including Journey 2 replay, 30/60/120 FPS duration, every-phase ESC, theme-exit cleanup and preset restoration.
- BIRTH continuity: PASS, 7,231 checks.
- Isolated headless shader/compositor fixture: PASS. Real shader compilation with no errors, warm fire, unchanged camera, central composited horizon, animated clouds, alpha cap 0.68, one geometry/program/draw per existing scene pass, borrowed texture preserved, own resources released before BIRTH. Cloud side-bank mean alpha was approximately 4.6x and 6.2x the corridor at the two main samples.
- Isolated CSS compositor fixture: PASS. No near-white interval over the atmospheric reference; handoff mean RGB brightness approximately 0.265, spatial shading, exact opaque source/destination concealment using two contrasting backdrops, no black frame in the sampled reference, cancellation and transparent cleanup/style restoration.
- Initial dark-mask brightness check caught SVG linear interpolation making it too pale; explicit sRGB fixed it. Only affected visual fixtures were repeated after that correction and the cloud distortion adjustment.
- One final production build: PASS, 87 modules, 3.46 s. Bundle dist/assets/index-Dt7pVeD5.js: 858.20 kB, gzip 227.22 kB.
- Git diff and changed-file whitespace: PASS. Existing Vite large-bundle advisory and Git line-ending advisory remain; no automated failure remains.

## GPU cost and limitations

Retains one screen plane/material/program and three projected banks; up to six Earth cloud-map samples per cloud fragment. Extra fixed-budget procedural fields replace ribbon structure; no volumetric march or particle system. The small procedural SVG cloud background is static; compositor transform/opacity supplies movement without animated filters. No large texture allocations or new render passes.

Cloud volume remains a projected approximation. Full-scene depth, turbulence feel, edge repetition, HDR/browser variation and RTX 4070 Laptop frame time require physical observation. Isolated SwiftShader/CSS fixtures establish pixels and lifecycle, not subjective GREEN or real RTX performance. No claim that every full-scene frame is free of flashes is made from isolated reference samples alone.

## Physical review

Record with slow motion off. Look for broken turbulent amber structures rather than uniform ribbons, unequal moving cloud banks with a recessed travel corridor, a brief dense blue-grey handoff without flash/black pulse, then smooth BIRTH into the aligned Earth and exploration at 10 s. Check ESC during fire/clouds/occlusion/BIRTH, restored LMB FreeFlight and F/G, Journey 1/2, and both Earth themes. Pay attention to bank repetition, masked handoff and any GPU hitch.

No Web preview, broad refactoring, commit or push. STOP for physical visual approval.
