# Journey 3 — Planetary to OUR WORLD, Pass 3

Protected committed GREEN: `80c2757470e66a43e956178aa3629a077fb0bcdc`.
## Physical verdict — technical arrival GREEN

Confirmed by Erich: Journey 3 successfully transports the Traveller from Theme 3
(Planetary) into Theme 4 (OUR WORLD). Physical confirmation covers Earth gateway
READY at 10.0 world units, intentional LMB acceptance, Journey 3 completion and
arrival in OUR WORLD. The preceding gateway work is included in this checkpoint.

Physical ESC cancellation during transit and full cinematic quality are **not
yet confirmed**. Automated cancellation tests below are not physical acceptance.

Known WIP: Journey 3 cinematic choreography; Planetary Earth approach framing;
horizon/crossing visual quality; physical ESC cancellation testing; Journey 2/3
fine-tuning. This checkpoint protects the working technical connection only.

## Reused architecture

Journey 2 is GalaxyJourney (`galaxy-planetary`), a Journey subclass whose events
drive JourneyDirector and App callbacks. CameraDirector stops free exploration
at journey start, tracks the live gateway target during approach/horizon/crossing,
and runs its existing FlightSystem toward the new theme's home at BIRTH. App
activates the registered destination through ThemeManager; completion releases
CameraDirector back to EXPLORE. TransitSystem and existing fade callbacks provide
the existing wormhole/void/birth behavior.

GalaxyJourney now accepts an optional identity parameter, defaulting to its
original ID. Its phase machine, timings and events are unchanged. EarthJourney
extends it with ID `planetary-environment` and an explicit restart reset; no
parallel director, camera controller or duplicated phase machine is introduced.

## Entry and gateway preservation

PlanetaryTheme assigns one EarthJourney to its existing moving Earth gateway,
with destination registered ID `environment`. Radius remains 10 world units,
inclusive. Live target world-space resolution, update synchronization, Sun-centered
navigation, planetary home, flight parameters and other gateways are preserved.

Proximity only arms READY; it never starts a journey. The existing capture-phase
proximity LMB route now requires an EXPLORE-mode, enabled, currently armed Earth
gateway within live range, a registered destination, no active journey, and a
ray hit on the actual rendered Earth mesh. GUI events and other mouse buttons
are excluded. A fresh press elsewhere continues ordinary flight. Holding LMB
before entering the zone does not start Journey 3. Only successful acceptance
increments Earth intent and consumes the pointer event using the existing handler.
Duplicate pointer presses cannot start another journey while one is active.

The wider READY zone can include the Moon/nearby planets. The rendered Earth hit
requirement prevents their ordinary clicks from accepting this Earth journey.
The readiness-only observer path remains available for other non-executing
gateways; Earth is now explicitly executable. Galaxy's Special Star hit and
acceptance behavior, including its wheel WIP, is retained.

## Phases and timing

| Phase | Duration in simulation seconds | Event on entering next phase |
| --- | --- | --- |
| START | 2 | approach |
| APPROACH | 3 | horizon |
| HORIZON | 3 | singularity |
| SINGULARITY | 4 | wormhole |
| WORMHOLE | 4 | void |
| VOID | 1 | birth |
| BIRTH | 3 | complete |

Total approximately 20 simulation seconds. BIRTH occurs at approximately 17.
No new phases or cinematic retuning. The existing developer slow-motion control
and existing fixed frame delta behavior are retained; these are simulation
durations, not a promise of exact wall-clock duration on every device.

## Destination and camera handoff

At BIRTH only, App recognizes Journey 3 and releases source-object camera
references with the existing `finishTravel` method, then retains journey camera
ownership via `beginJourney` before disposing Planetary. JourneyDirector's source
target/crossing references are cleared. ThemeManager activates `environment` once.
Its existing EnvironmentTheme/EarthGlobe is used; no second renderer is created.

The existing destination flight adapter is installed. Journey 3 initializes
destination lifecycle references, silently loads its explicitly saved F preset,
and independently loads G through the existing App loader. Presets are read, not
written. Missing presets keep existing loader semantics. Saved G Standard/High
selection uses existing asynchronous texture loading, capability fallback and
disposal; Earth textures/shaders/clouds/atmosphere are unchanged.

CameraDirector travels to EnvironmentTheme.getHomePose(), using its existing
three-second journey flight. The BIRTH fade uses existing fadeIn(3). Completion
stops transit, releases journey state and source references, resets flight input
through existing CameraDirector methods, and restores EXPLORE with the normal
Theme 4 flight adapter and Earth orbit hook. FreeFlight stays inactive while the
journey controls the camera.

## ESC, switching and failure safety

Journey 3 adds only scoped cleanup before the existing ESC sequence: finish the
journey camera operation, stop transit, and clear the curtain with fadeIn(0.3).
Existing Return Home, JourneyDirector.stop/cancel, disarming and Universal ESC's
deferred independent F/G restoration then run unchanged.

Before BIRTH, Planetary remains active, so ESC restores Planetary home/F/G. After
BIRTH, OUR WORLD remains active and its own home/F/G are restored. Cancellation
marks EarthJourney cancelled; its updates cannot emit a late BIRTH or complete.
The same source journey can be restarted after cancellation through its reset.

Manual development theme switching also clears the Journey 3 curtain, while its
existing cancel/finish/stop lifecycle handles the transition. Missing destination
registration is rejected before acceptance. If registration disappears before
BIRTH, the callback cancels Journey 3, stops transit, returns to the still-active
source home, restores its saved settings and clears the fade. Existing texture
failures retain EarthGlobe's established neutral/4K fallback behavior.

No new event listeners are installed. Planetary destruction still disables its
gateway, clears owned registration/READY/armed state and releases mesh references.

## Observability

Existing D = KNOW reports the current phase; development HUD also reports the
active journey ID. Existing Earth registration/radius/distance/intent fields
remain. Logs identify Journey 3 START, BIRTH/OUR WORLD activation, COMPLETE and ESC
CANCEL. Intermediate phase logs are inherited from GalaxyJourney. No permanent
overlay or new keyboard shortcut.

## Automated validation

- Build passed: 85 modules, main bundle 837.63 kB / gzip 221.04 kB.
- `git diff --check` passed.
- Journey 3 characterization: **2144 checks passed**, using production Journey,
  JourneyDirector, CameraDirector, FreeFlight, Planetary/Environment scene objects,
  ThemeManager and App callbacks with stubbed event surfaces and texture uploads.
  Coverage: READY without start, actual ray-hit acceptance/miss, duplicate
  rejection, phase progression, single destination activation at BIRTH, home
  target/arrival, camera ownership/release, F/G restoration, source cleanup,
  ESC before/after transition, missing destinations and zero storage writes.
- Journey 2 replay compares 2100 timed updates against the protected GalaxyJourney:
  default identity, phase, phase time, completion and event sequence match.
- Moving gateway regression: **235 checks passed**. Tracking, radius boundaries,
  lifecycle and ordinary LMB miss behavior are retained; historical readiness-only
  expectations are updated for the explicitly requested Journey 3 registration.
- Universal ESC: **316 checks passed**; Earth detail: **64 checks passed**;
  existing Space/Galaxy Traveller characterization passed.
- Rendering/protected-path guards exempt only the authorized GalaxyJourney
  identity parameter and new EarthJourney. CameraDirector, FreeFlight, SolarSystem,
  PlanetaryFlight, Theme 4 implementation, texture assets, renderer and F controls
  are unchanged.

These tests do not launch the application, compile GPU shaders, render the
transition or claim physical/FPS GREEN. Existing bundle-size and LF/CRLF warnings
remain. Texture-loader failure messages in the Earth suite are simulated checks.

## Known limitations and physical test

This is a functional technical slice, not the final cinema. Reused CameraDirector
approach/horizon distances are 8 and 0.75 units; the crossing endpoint is 0.75
units on the opposite side. Horizon/crossing can enter the radius-2 source Earth.
Existing timing and global-Z approach direction are deliberately not retuned.
Review clipping, framing, orientation and perceived camera jumps physically.
ESC's existing finishTravel cleanup can finish an in-progress destination flight
before returning home; cancellation feel also requires acceptance. Real pointer
cleanup and target visibility/occlusion cannot be certified by headless tests.
Saved 8K upload can hitch; no Earth visual or texture behavior is changed.

1. In Theme 3, use D and confirm moving Earth READY at 10 and NOT READY at 11.
2. Enter READY while already holding LMB: flight must continue without a journey.
   Release, press elsewhere, then press the rendered Earth intentionally.
3. Confirm Journey 3 starts once; free exploration is suspended; inspect phases.
4. Confirm Planetary stays active until BIRTH, then arrives at the existing full
   OUR WORLD home view. Check saved F/G and Standard/High behavior.
5. After completion, check LMB flight, RMB Earth orbit and ESC saved-state return.
6. Cancel during approach, VOID and destination BIRTH; confirm home/current-theme
   settings, no black curtain, stuck input or later unexpected activation.
7. Re-enter Planetary, verify no duplicate gateway, and recheck Journey 2/Galaxy.

## Changed files and state

Checkpoint scope: App, DevHUD, PlanetaryTheme, GalaxyJourney identity reuse,
EarthJourney, Earth guard tests, moving-gateway tests, Journey 3 tests, Pass 2 report
and this report. The preceding gateway implementation and prior GREEN history are
preserved. Checkpoint: "Checkpoint GREEN — Journey 3 technical arrival".
No choreography, flight, texture or visual tuning is part of checkpoint creation.
