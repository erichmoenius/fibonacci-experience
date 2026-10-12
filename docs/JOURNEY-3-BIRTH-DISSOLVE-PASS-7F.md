# Journey 3 seamless BIRTH dissolve - Pass 7F

Implemented; focused checks and final build PASS. Physical visual approval pending.
Continued from the existing uncommitted state. Grey SVG remains disabled.

## Exact changes

- src/core/App.js: Journey 3 source-texture readiness preflight; capture source at the 7.5-second callback before Theme 3 destruction; bind destination Earth to the dissolve. Return unsuccessful acceptance when the readiness preflight declines the trip.
- src/graphics/Renderer.js: opt-in Journey 3 capture using a temporary camera copy at the existing source boundary pose. Recapture the existing render pipeline including selective bloom, copy its final framebuffer on GPU, restore camera/render target/portal/bloom-camera state. Draw the temporary dissolve after the live destination pipeline. Normal rendering is unchanged when no dissolve exists.
- src/systems/cinematic/JourneyBirthDissolve.js (new): two framebuffer textures and one full-screen composite. Source weight uses the existing journey clock with quintic fade from 7.5 to 7.95 seconds. Captured display-encoded premultiplied pixels are unpremultiplied, decoded, mixed in linear light and correctly re-encoded/premultiplied. No grey/white colour backing or DOM curtain.
- src/systems/cinematic/EarthJourney.js: update visual dissolve from elapsed time; dispose on completion, cancellation and theme exit. Camera methods, phase schedule and existing readiness gate are exactly unchanged.
- Two new focused fixtures: experiments/journey3-dissolve-characterization.mjs and experiments/journey3-dissolve-browser-characterization.mjs.

## Readiness and lifetime

Before Journey 3 starts, production checks that all five source Earth maps are loaded, source Earth is visible and no map load errors exist. Theme 4 constructs synchronously using the same reference-counted 4K cache before source texture retirement. Real asset testing confirms destination map identity and readiness, with no new downloads required at handoff. Destination visibility/load-error state also gates the blend; until ready, only the outgoing image is displayed.

No readiness delay or new clock is introduced. Standard cached readiness settles in microtasks before the following frame. The pre-existing exceptional readiness hold remains unchanged; the implementation does not claim to solve cold/missing assets by extending the journey. An incomplete/failed source texture set declines Journey 3 before it starts, with a notification.

Source starts at weight 1 and reaches 0 at 7.95 seconds; the camera continues its established BIRTH path. Source/live GPU textures and composite resources are disposed after blending, or on ESC/completion/theme exit. Renderer drops the disposed reference on its next render. One active theme throughout.

## Validation

- Dissolve-enabled Journey 3 integration: PASS, 2,289 checks, including capture before destruction at exactly 7.5 seconds, one handoff, completion at 10 seconds at 30/60/120 FPS, every-phase ESC disposal, saved controls and Journey 2 replay.
- Before/after BIRTH boundary camera traces and measured durations: identical against preserved pre-Pass-7F App/EarthJourney sources.
- Existing BIRTH continuity suite: PASS, 7,231 checks.
- Isolated headless GPU fixture: PASS, 16 checks, no shader errors. Actual production capture methods, source endpoint including bloom, linear-light midpoint, live endpoint, premultiplied alpha, hidden unready destination, real shared Earth cache transfer, and idempotent resource disposal.
- Preservation: all existing changed files outside the three edited runtime files are byte-for-byte unchanged. CameraDirector, ThemeManager, EarthGlobe, both themes, plasma/cloud geometry and grey-curtain isolation untouched.
- Whitespace: PASS.
- One final build: PASS, 88 modules, 2.26 s; dist/assets/index-D2ENaO-H.js 861.92 kB, gzip 228.39 kB. Existing Vite bundle-size advisory remains.

## Limits and physical review

This is a short captured-image dissolve, not simultaneous moving-theme rendering. The frozen source may produce brief ghosting of mismatched geography/background while the live BIRTH camera moves. Captured image includes GPU scene/bloom; existing CSS atmosphere and UI remain outside the capture and continue independently. No new atmospheric effect or spatial-cloud redesign.

Two RGBA8 framebuffer copies use about 15.8 MiB at 1920x1080 or 63.3 MiB at 3840x2160, without mipmaps/depth. Source recapture adds a one-time source render/bloom cost; destination framebuffer copy and one composite draw last approximately 0.45 seconds. Actual RTX frame time requires physical review. Resize during the dissolve scales the retained source image and resizes the live copy.

Physically check the 7.5-second transition for hard cut, colour/brightness pulse, frozen-frame ghosting and GPU hitch; confirm smooth BIRTH and exploration at 10 seconds. ESC during early BIRTH, replay and theme exit should leave no retained image. No physical GREEN claim.

No Web preview, commit or push. STOP for physical visual approval.
