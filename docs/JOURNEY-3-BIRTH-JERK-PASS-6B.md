# Journey 3 BIRTH jerk diagnosis — Pass 6B

Protected GREEN: `94c6c7e3a07ad59f058d4b01e45390c32803f2ad`.
Pass 6 and 6A remain uncommitted. User physical verdict: **RED — visible jerk / double movement at BIRTH**.

**PASS 6B PHYSICAL VERDICT: RED.**
The user still observes a double movement at TRAVEL -> EXPLORE, with grey reveal,
darkening and a brighter stable view. This historical camera/CPU diagnosis is
supplemented by the browser-confirmed curtain defect in
[JOURNEY-3-RENDER-BOUNDARY-PASS-6C.md](JOURNEY-3-RENDER-BOUNDARY-PASS-6C.md).
Pass 6C awaits physical GREEN.
No physical acceptance is claimed. No preview, commit, push or new effect.

## Instrumentation and limits

The new frame-sequence characterization runs the production Loop.tick, extracted
App.update/updateCamera and actual journey callbacks, real CameraDirector,
JourneyDirector, ExploreDirector, SolarSystem/EnvironmentTheme and Renderer.render/
renderScene methods. It advances deterministic 30/60/120 FPS clocks and maps,
then observes the camera at both production main scene render passes. A WebGL
boundary stub invokes mesh onBeforeRender callbacks and records render samples;
no browser/WebGL rendering or OBS capture is performed.

The previously stubbed App.updateCamera is now exercised. ExploreDirector's actual
update does not write camera transforms. Both normal renderer passes read the same
main camera; two render passes are not two camera updates.

All requested fields are recorded per frame: phase, theme, CameraDirector mode,
position/quaternion/FOV, displacement and velocity vector, angular speed/vector,
owner/flight, physical write kind/value/order, update/callback order, veil opacity,
and Earth world position/scale. Additional fields include timeline sample,
Earth-relative motion, group visibility, surface rotation, Sun and day-map identity.

Full sequences through 12 seconds were analyzed in memory. The saved artifacts
retain every frame within three frames of 6.5, 7.5, 10 and 11 seconds at each rate:

- [Before](traces/JOURNEY-3-PASS-6B-before.json): captured before any runtime fix.
- [After](traces/JOURNEY-3-PASS-6B-after.json): identical instrumentation after fixes.

These identify exact reproduced code-level boundary frames. No supplied OBS frame
numbers/video were available, so they cannot establish which OBS frame exhibited
the reported physical jerk. GPU upload stalls, compositor timing and subjective
motion remain outside these CPU traces. No new large visible C0 mismatch was
reproduced; the confirmed findings below are not proof that every physical symptom
has been eliminated.

## Confirmed root causes and exact frames

### 1. Camera/veil sample skew and callback re-application

Before: App advanced the live theme, applied the camera using the **previous**
EarthJourney.elapsed/phaseTime, then advanced JourneyDirector and the atmospheric
opacity to the current frame. Camera and veil were one sample apart throughout
BIRTH. On completion, the callback applied the final endpoint a second time after
the old-clock camera update, compressing two pose intervals into one rendered
interval. This is an ordering defect even when the absolute C0 correction is small.

At 60 FPS:

- Frame **450 / 7.500 s**: source camera position+quaternion applied, then onBirth
  called updateTravel(0), applying destination position+quaternion again. Four
  physical writes, two position applications, one CameraDirector.update.
- Frame **451 / 7.516667 s**: veil was already fading at BIRTH time 0.016667, while
  camera still sampled time 0.0. A held camera sample at the beginning of reveal.
- Frame **599 / 9.983333 s**: rendered BIRTH pose still sampled 2.466667 seconds.
- Frame **600 / 10.000 s**: main camera update sampled 2.483333, then completion
  forced the 2.5 endpoint. Four physical writes, two position applications.

Equivalent handoff/completion frames are 225/300 at 30 FPS and 900/1200 at 120 FPS.
No destination flight was active: 6A had already removed it. BIRTH easing was not
reset mid-reveal. Theme activation prepared state, but the explicit callback pose
application supplied the second physical write path.

### 2. Idle-entry clock changes at exploration restoration

6A's idle-entry envelope used CameraDirector.time, which advances by the existing
0.016-per-frame exploration delta after Journey 3's measured clock ends. At the
first normal frame, the envelope therefore progressed by the same amount at all
refresh rates, making estimated physical velocity increase with FPS.

At the first normal frame before this fix, speed was approximately 0.000694,
0.001387 and 0.002775 units/s at 30/60/120 FPS. This is a confirmed clock mismatch,
not another large position replacement. The ordinary flight clock/physics remains
protected; only the transient idle-entry envelope needs measured elapsed time.

## Before/after frame trace excerpts

60 FPS. Speed is finite-difference world-position speed, angular speed rad/s.
P/Q counts are physical position/quaternion writes, not update-call counts.

| Frame / time | State | Before P/Q | After P/Q | Before speed | After speed | Before angular speed | After angular speed |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 449 / 7.483333 | VOID, planetary | 1/1 | 1/1 | 0.567671 | 0.567671 | 0 | 0 |
| 450 / 7.500000 | BIRTH handoff | 2/2 | 1/1 | 1320* | 1320* | 0 | 0 |
| 451 / 7.516667 | First fading BIRTH | 1/1 | 1/1 | 0 | 0.0007256 | 0 | 0.0007193 |
| 599 / 9.983333 | Last BIRTH | 1/1 | 1/1 | 0.0139133 | 0.0051928 | 0.0008082 | 0.0003016 |
| 600 / 10.000000 | COMPLETE / EXPLORE | 2/2 | 1/2 | 0.0059433 | 0.0007504 | 0.0003452 | 0.0000436 |
| 601 / 10.016667 | First normal frame | 1/2 | 1/2 | 0.0013875 | 0.0000857 | 0 | 0 |
| 602 / 10.033333 | Second normal frame | 1/2 | 1/2 | 0.0038971 | 0.0005583 | 0 | 0 |

*The 1320 value is the intentional approximately 22-unit world-coordinate change
between themes divided by 1/60 s. Veil opacity is exactly 1; Earth-relative pose
and quaternion are continuous. It is not a visible camera-velocity spike and is
not treated as a C1 failure. The same coordinate remapping remains in the fix.

Normal exploration calls applyLookTarget once to obtain travel axes and once at
final pose application; these two quaternion writes belong to the same update
and match in the no-input fixture. That established GREEN path is unchanged.
Every after-frame has one authoritative position application and one
CameraDirector.update, including callback boundaries.

At completion, after-speed converges approximately quadratically toward zero:
0.0029716 / 0.0007504 / 0.0001886 units/s at 30/60/120 FPS. Angular velocity shows
the same convergence. The remaining finite last-frame difference is the correct
sample of the quintic endpoint, not an extra correction path. Exact endpoint
position is (0,0,6.5), quaternion (0,0,0,1), FOV 60 in this fixture.

## Other hypotheses checked

- No duplicate CameraDirector.update calls were found before or after; the defect
  was callback pose application in addition to that single update.
- Source/end-of-descent orbit tracking and exterior path remain as 6A. World
  movement during VOID reflects live orbit, not residual camera descent.
- BIRTH transitions once, activates environment once and completes once.
- FOV/zoom do not jump. The existing 320-to-100 far-plane change happens under
  opaque veil and does not affect apparent angular scale.
- Destination flight is absent, and no Earth position/scale changes occur during
  visible reveal. Earth spin does not reset. Sun direction changes continuously.
- Temporary fallback-to-shared-map assignment and group visibility happen under
  full opacity. The visible baseline day-map identity stays constant in these runs.
  Existing optional 8K behavior is checked by separate GREEN regression suites;
  real asynchronous upload/frame-time stalls have not been measured here.
- There was no new source/destination C0 scale discontinuity to fix in this pass.

## Exact changes — confirmed causes only

App gives Journey 3 this order:

1. Advance the source theme's live transform once.
2. Advance JourneyDirector clock/callbacks to the current sample.
3. Apply CameraDirector once using that prepared sample.
4. Run environment/theme work and render.

All other journeys retain their camera-first ordering. Ordinary gateway detection
retains its established order. Active Journey 3 gateway processing now precedes
its camera, while the live source transform still precedes both.

onBirth now prepares the destination pose without calling updateTravel(0).
The one main camera update establishes it in the same fully opaque frame.
onJourneyFinished adopts/reset state through finishTravel(false), deferring
physical application to the same main camera update. The completion frame uses
camera delta zero to render the exact home before idle time advances. All default
finishTravel callers retain their existing behavior.

The scoped idle-entry envelope now uses measured performance time and a quintic
smootherstep, with zero velocity/acceleration at its endpoints. Normal camera time,
flight integration, controls and idle-motion formulas are untouched. Adapter
switch/reset isolation from 6A remains.

EarthJourney, approach/reveal curve geometry, phase durations and lighting behavior
are unchanged by 6B. No new visual layer, fade, effect or camera system is added.
Total schedule remains 10 seconds and full veil 6.5–7.5 seconds. Loading holds and
severe-frame clamps retain their documented exceptional-duration behavior.

## Regression results

- Frame-sequence suite: **15,591 checks**. One update/position write per frame,
  camera/veil sample identity, C0 framing/rotation at masked handoff, exact home,
  finite-difference linear/angular endpoint velocity convergence, render-pass
  invariance, Earth transform/texture/light continuity and exactly-once activation.
- Actual journey integration: **2,256 checks**. 10.000 s at 30/60/120 FPS and
  30.000 s in existing slow motion; every-phase ESC cleanup, saved F/G and Journey 2.
- Cinematic timing/path: **97,151 checks**.
- BIRTH continuity: **7,231 checks**.
- Atmosphere/path/loading/cancellation: **20,039 checks**.
- Earth visual/sharing: **4,166 checks**; Earth detail: **64 checks**.
- Gateway: **236 checks**; Universal ESC: **316 checks**.
- Space/Galaxy Traveller flight characterization passed.
- Production build passed: 86 modules, bundle **849.14 kB / gzip 224.05 kB**.
- Git whitespace check and new-file whitespace checks passed.

Tests compare the non-authorized portions of App/CameraDirector to protected
GREEN. Journey 2, EarthGlobe, SolarSystem, licensed assets, other themes, flight,
GUI/storage and renderer code are unchanged. Fixture assertions now inspect the
rendered destination after the single main camera update, not transient callback
state before application; the prior camera-first test tick was corrected to match
production Journey 3 order.

Warnings separately: existing Vite bundle-size advisory, Git LF-to-CRLF advisory
for App.js and intentional Earth failure-path messages. No remaining test failure.

## Physical instructions

1. Replay with slow motion off and no mouse steering during the journey. Record
   OBS at a known refresh/capture rate. Confirm the one-second opaque veil and
   approximately 10 seconds to restored exploration.
2. Examine first BIRTH motion and the last BIRTH/first exploration frames. Check
   velocity and rotation flow, rather than just matching positions. The veil and
   camera should advance together; no held sample followed by endpoint correction.
3. Watch the first second of idle motion, especially at 30/60/120 Hz. Check for a
   second start or direction kick. Try the same directions used in RED captures.
4. ESC in every phase; verify current-theme home, saved F/G, clean veil, released
   mouse states and normal light. Repeat completion/cancel and theme switches.
5. Replay Journey 2 unchanged. If the physical jerk persists, retain OBS frames
   with timestamps and investigate browser/GPU upload/compositor timing against
   these frame traces before changing another camera path.

These changes correct demonstrated scheduling/rate defects. Physical RED is not
superseded until the user confirms GREEN; no claim that CPU traces reproduce the
entire OBS symptom is made.

## Files / Git

6B runtime edits: `src/core/App.js`, `src/systems/cinematic/CameraDirector.js`.
Regression edits: journey integration, cinematic, BIRTH continuity, atmosphere and
gateway characterization files. New frame-sequence suite, this report, before/after
JSON trace artifacts; the historical 6A report is marked RED/superseded.

The combined uncommitted 6/6A/6B scope contains 15 intended files. All remain
unstaged, index empty, protected HEAD unchanged. No preview, commit or push.
