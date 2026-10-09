# Journey 3 TRAVEL -> EXPLORE rendering boundary — Pass 6C

Protected GREEN: `94c6c7e3a07ad59f058d4b01e45390c32803f2ad`.
**PHYSICAL GREEN — Passes 6, 6A, 6B and 6C accepted by the user on 2026-10-09.**
The user confirms that the previous double jerk and dark pulse are gone.
A minimal rightward slide at BIRTH -> EXPLORE remains and is **explicitly accepted
for now**. It is a recorded limitation, not work to implement in this checkpoint.

Approved checkpoint: "Checkpoint GREEN — Journey 3 cinematic descent".
The historical RED observation was grey reveal, darkening and brighter recovery;
the diagnosis and evidence below preserve that history. The current verdict is GREEN.
No new effect, unrelated refactor or application preview is included.

## Root cause with rendered evidence

The remaining confirmed cause is the existing curtain's CSS cleanup transition.
During JourneyAtmosphere, its parent stays at opacity 1 with transparent background;
the three children carry the haze, cloud diffusion and fading whiteout. Near the
end of BIRTH the children are almost transparent, so the scene is nearly revealed.

The previous clear() removed those children, restored the parent's **black**
background and **opacity 1s linear** transition, then assigned opacity 0. The browser
therefore transitioned the parent from its previous computed opacity 1 to 0 over
one second. Immediately after logical cleanup, the now-black parent was still
opaque. It covered the newly revealed scene and then faded away. This generates
the darken/brighten pulse independently of camera continuity.

Earlier DOM fixtures saw only `style.opacity = "0"`; they did not model the
browser's computed opacity or CSS transition. Those tests could pass while the
actual composited curtain was black and opaque.

A real headless Chromium test using the production JourneyAtmosphere reproduced
the discrepancy and captured an actual PNG pixel. This was an isolated curtain
fixture over a constant RGB(64,128,192) scene-color substitute, not an application
preview or Three.js Earth GPU render. The effect applies to arbitrary canvas
content beneath the same fullscreen parent.

| Browser sample | Before inline opacity | Before computed opacity | Before parent | After computed opacity |
| --- | --- | ---: | --- | ---: |
| Last TRAVEL | 1 | 1 | transparent; children fading | 1 |
| Completion cleanup | 0 | **1** | **black**, transition restored | **0** |
| First EXPLORE sample | 0 | **1** | black | **0** |
| Later EXPLORE sample | 0 | **0.849943** | black fading | **0** |
| Stable after one second | 0 | 0 | black but invisible | 0 |

Before, the first-exploration screenshot pixel was **RGB(2,4,6)** versus the stable
background **RGB(64,128,192)**. After, that same pixel is **RGB(64,128,192)** immediately
and remains unchanged. Sample timestamps in the JSON are browser performance times;
minor screenshot/protocol timing affects the intermediate alpha, not the finding.

This directly supports a rendering-state explanation for the darken/brighten
component of the latest OBS report. It does not establish that every subjective
movement symptom has been resolved. The earlier scheduling fixes remain, but no
additional camera mismatch was found or changed in 6C.

## Exact production change

Only `src/systems/cinematic/JourneyAtmosphere.js` changes at runtime in Pass 6C.
clear() now:

1. Disables the parent CSS transition.
2. Sets parent opacity to zero.
3. Reads offsetWidth to synchronously commit that transparent state in the browser.
4. Restores the original background, overflow and transition afterward.

The single style/layout flush is confined to cleanup, not each animation frame.
The borrowed curtain's normal transition is restored for its existing later use.
The same fix covers cancellation under full veil or midway through reveal.
Cleanup stays idempotent and removes the same three children.

No camera, Earth shader, exposure, scene background, clear color, phase schedule,
render target, texture, fade or effect is added/retimed. The existing 10-second
journey, 6.5–7.5-second full veil, approach, BIRTH path and OUR WORLD home remain.
Journey 2 still uses its original Renderer fade APIs unchanged.

## Actual App/render lifecycle comparison

A second fixture extends the production Loop/App/CameraDirector frame sequence
with actual App.updateEnvironment, CelestialStarfield and Renderer pass methods.
It logs both logical state and the values read at each render boundary after
mesh onBeforeRender callbacks, including camera state/offsets and Earth uniforms.
The WebGL boundary is stubbed; its clear/exposure defaults are checked against
local Three.js/Renderer source, not claimed as application GPU readbacks.
Browser-computed CSS and rendered pixels are verified separately above.

The destination render sequence remains:

1. Offscreen target: clear, celestial sky, clear depth, Earth/main scene.
2. Screen: clear, celestial sky, clear depth, Earth/main scene.

Both main passes consume the same camera and Earth uniforms. Destination bloom is
disabled throughout BIRTH and exploration. The two scene passes are unchanged and
do not introduce a completion-time brightness switch.

At the representative 60 FPS boundary:

| Value consumed at render | Last TRAVEL: frame 599 / 9.983333 s | COMPLETE: frame 600 / 10 s | First normal: frame 601 / 10.016667 s |
| --- | --- | --- | --- |
| Theme | environment | environment | environment |
| Camera owner/mode | CameraDirector / TRAVEL | CameraDirector / EXPLORE | CameraDirector / EXPLORE |
| Eye | (0.00000343,0,6.49998797) | (0,0,6.5) | (0.000001276,0.000000640,6.5) |
| Quaternion | approximately identity | identity | identity |
| FOV / near / far | 60 / 0.1 / 100 | same | same |
| Position applications | 1 | 1 | 1 |
| World / stage / legacy stars | false / false / false | same | same |
| Celestial sky / bloom | true / false | same | same |
| Scene background | null | null | null |
| Clear color / alpha | black / 0 | same | same |
| Tone mapping / exposure | NoToneMapping / 1 | same | same |
| Earth world position / scale | (0,0,0) / (1,1,1) | same | same |
| Surface/cloud/atmosphere Sun | approaches default continuously | exact existing default | same default |
| Clouds / atmosphere blending | normal / additive | same | same |
| Logical parent opacity | 1, children almost transparent | 0 | 0 |
| Browser parent opacity before fix | 1, transparent background | 1, **black background** | black fade in progress |
| Browser parent opacity after fix | 1, transparent background | **0** | **0** |

The clear alpha comes from the existing alpha:true renderer and black body;
there is no grey scene.background assignment. The grey backdrop during reveal is
consistent with the existing partly transparent pale overlay, not a newly switched
renderer clear color. Completion clears those children and previously substituted
an unintended black parent fade.

EarthGlobe's surface onBeforeRender updates center/cloud offset and capability
state; its lighting and atmosphere uniforms remain consistent between both main
passes. Shader/material blending policies are unchanged. The 6A Sun interpolation
reaches the default smoothly and restoring it does not produce a discrete exposure
step. EnvironmentTheme update runs once per normal destination frame; there is no
new activation or environment-policy change at completion. Camera state and idle
entry remain those verified in 6B, with no second position-write path.

## Before/after artifacts

- [Browser curtain before](traces/JOURNEY-3-PASS-6C-curtain-before.json)
- [Browser curtain after](traces/JOURNEY-3-PASS-6C-curtain-after.json)
- [App/render before](traces/JOURNEY-3-PASS-6C-render-before.json)
- [App/render after](traces/JOURNEY-3-PASS-6C-render-after.json)

App/render traces retain every frame within three frames of 6.5, 7.5, 10 and 11
seconds at 30/60/120 FPS. They include phase/timeline, theme, camera pose/mode,
velocity/angular velocity, current/base/look/target state, parallax/idle offsets,
callback/write order, environment flags, clears, all render passes, Earth uniforms,
material blend settings and logical curtain styles/layers. The after trace adds
`curtain.commit-zero-opacity` to completion before rendering. Logical opacity is
zero in both traces, which is precisely why computed CSS needed separate testing.

## Regression results

- Real Chromium CSS/compositor regression: passed computed opacity at cleanup,
  first/later/stable exploration samples, actual first-exploration pixel,
  full-veil/mid-reveal cancellation, idempotent removal and style restoration.
- Exact source guard verifies JourneyAtmosphere matches protected GREEN after
  stripping only the cleanup opacity-commit change. All gradients/layers remain.
- Visual render-boundary suite: **18,858 checks** passed.
- Frame ownership/C0/C1/angular sequence suite: **15,591 checks** passed.
- Journey integration: **2,256 checks** passed, including 10.000 seconds at
  30/60/120 FPS, existing slow motion, every-phase ESC, F/G and Journey 2 replay.
- Cinematic: **97,151**; BIRTH continuity: **7,231**; atmosphere/path: **20,039**.
- Earth visual/sharing: **4,166**; Earth detail: **64**; gateway: **236**.
- Universal ESC: **316**; Space/Galaxy Traveller characterization passed.
- Production build passed: 86 modules, **849.20 kB / gzip 224.06 kB**.
- Git whitespace and new-file whitespace checks passed.

Existing source-protection lists now exempt the authorized JourneyAtmosphere file;
its dedicated browser test separately protects everything except the exact clear()
fix. No renderer, EarthGlobe, flight, GUI/storage, textures or other themes changed
in this pass. Existing warnings: Vite bundle-size advisory, Git LF-to-CRLF advisory
for App.js, intentional Earth failure-test messages. No unresolved test failure.

The browser fixture proves the curtain defect with real computed styles and pixels,
not solely CPU camera continuity. It does not claim a full Earth GPU/OBS physical
GREEN, hardware performance or absence of unrelated asynchronous upload stalls.

## Physical test instructions

1. Replay Journey 3 with slow motion off. Time the accepted hit to exploration:
   about 10 seconds, with the same one-second full veil.
2. Capture the last second of BIRTH and the first two seconds of exploration.
   The pale/grey reveal should lead directly to the stable scene; there should be
   no black/dark pulse followed by a one-second brightness recovery at 10 seconds.
3. Compare camera motion separately: the 6B continuity behavior should be unchanged.
   Verify normal OUR WORLD home and LMB/RMB input after reveal.
4. ESC during full veil and mid-reveal, then in the other phases. Confirm no lingering
   black curtain/fade, current-theme Return Home, normal lighting and saved F/G.
5. Repeat journeys/theme switches and replay Journey 2's original tunnel/fades.
   Try Standard/High and normal/high-DPI settings. Report any remaining symptom
   with OBS timestamps and whether it is brightness, scene motion or both.

The user has accepted physical GREEN: the double jerk and dark pulse are gone.
The minimal rightward slide at BIRTH -> EXPLORE is accepted for now. No additional
motion tuning is included. No extra fade or veil was introduced to conceal a snap.

## Exact files added/changed for 6C

Modified:

- `src/systems/cinematic/JourneyAtmosphere.js` — only new runtime fix.
- `experiments/journey3-cinematic-characterization.mjs` — authorized guard exception.
- `experiments/planetary-earth-visual-characterization.mjs` — authorized guard exception.
- `docs/JOURNEY-3-BIRTH-JERK-PASS-6B.md` — mark historical physical RED and link 6C.

Added:

- `experiments/journey3-curtain-browser-characterization.mjs`
- `experiments/journey3-visual-render-boundary-characterization.mjs`
- `docs/JOURNEY-3-RENDER-BOUNDARY-PASS-6C.md`
- Four `docs/traces/JOURNEY-3-PASS-6C-*.json` artifacts listed above.

Checkpoint preflight verified exactly 23 intended Pass 6/6A/6B/6C files on main at
the protected baseline, with an empty index and no unrelated source/asset changes.
The build, whitespace and relevant regressions were rerun for this approved GREEN.
Only those files are included in the authorized checkpoint commit and normal
(non-force) origin/main push. Final hash/push/clean-tree verification is reported
in the checkpoint chat. No application preview or synced reference change.
