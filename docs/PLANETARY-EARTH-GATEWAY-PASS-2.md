# Planetary Earth moving gateway — Pass 2

Protected GREEN: `80c2757470e66a43e956178aa3629a077fb0bcdc`.
Readiness and intent observation only. No Journey 3, automatic Theme 4 transition,
preview, commit or push. Stop for physical GREEN.

## Inspected contracts

Theme 3 previously registered no gateways. SolarSystem owns Earth's orbital
group and rendered mesh. Its hierarchy is stage content -> SolarSystem group ->
earthOrbit -> earthSystem (local X = 22) -> earthTilt -> earth. Earth has radius 2,
clouds radius 2.024 and atmosphere radius 2.09. SolarSystem.update advances the
orbit by `2*pi*delta*1.5/365.256` and spins the existing mesh. Stage content adds
the existing -0.01 world Z offset. No visual object or orbital formula changed.

Gateway already supports a target Object3D. `resolvePosition()` calls its
`getWorldPosition` into the gateway's reusable Vector3, updating ancestor world
matrices; `contains` measures world-space distance. JourneyDirector.findGateway
already resolves live target positions and checks enabled gateways. Its update
uses CameraDirector.position (the established Traveller convention), then updates
READY and sends the existing invitation callback. No Gateway or JourneyDirector
extension is needed.

App uses one existing capture-phase proximity LMB acceptance route. Galaxy's
Special Star additionally requires its existing rendered-hit hook before starting
its assigned journey. Target-hit/core acceptance is a separate existing route
within the same input setup. CameraDirector and FreeFlight own input/flight;
this pass does not add handlers or change either class.

## Registration and threshold

PlanetaryTheme now registers exactly one `Gateway` targeting
`this.solarSystem.earth`, the actual rendered Earth mesh (also stored as the Earth
planet body's reference). `journey` remains null; `destinationTheme = environment`
is metadata only. `readinessOnly = true` distinguishes this non-executing gateway.

`PLANETARY_EARTH_GATEWAY_RADIUS` in PlanetaryTheme is the centralized tuning point:
**10 world units**, explicitly tuned from the initial 3-unit threshold at the
user's request. Boundary is inclusive: 11 = NOT READY, 10 = READY, 9 = READY.
Moving back to 11 clears both READY and ARMED. Only this Earth gateway threshold
changes; the Galaxy Special Star remains at 2.5 and all other gateway radii stay
unchanged.

The wider Earth zone includes the Moon (center distance 4.2), and can overlap
Venus or Mars when their orbits align nearby. Readiness there still belongs only
to Earth and is determined solely by distance to Earth's live center. No planet
exclusion filter is added because this tuning preserves the existing proximity
logic. Planetary home remains outside the zone throughout Earth's orbit.

The position incorporates live orbit, parent rotation/translation/scale and stage
transforms. The radius is an explicit world-unit threshold, not dynamically
rescaled with hypothetical scene scaling. Current production parents use unit
scale. There are no per-frame gateway Vector3 allocations or duplicate bodies.

## Update synchronization

Before this pass, App updated CameraDirector, then JourneyDirector/gateway
proximity, then the active theme/SolarSystem. This made moving target detection
one orbital update behind the rendered scene.

PlanetaryTheme opts into `updateBeforeGatewayDetection`. App advances that active
theme once after camera/explore updates and before JourneyDirector proximity.
It skips its former later theme update. Other themes retain their previous order;
if a journey changes themes during the frame, the newly active theme still gets
its usual later update. No camera, flight, Sun reference, frame phase or orbital
timing is redesigned. Earth getWorldPosition updates matrix ancestry before the
proximity comparison even though render traversal has not happened yet.

## READY and LMB

READY uses the existing JourneyDirector contract: an enabled Earth gateway within
10 units of CameraDirector.position is selected and armed. Moving outside clears
READY and the Earth-only armed reference via the existing callback. No visual
invitation, portal artwork, sound, focus change or scene transition is added.

The existing proximity-LMB route accepts the readiness-only gateway into its
eligibility checks. It rechecks live distance, enabled state, EXPLORE mode, GUI
exclusion, left button, matching active/armed gateway and absence of an active
journey. It increments `intentCount` and returns false. Therefore the event is
not prevented/stopped, boosting/flight state is untouched, and neither journey
start nor theme switching occurs. Ordinary LMB exploration continues. A left
press within the zone is an observed intent candidate, not certified consent
to any future journey. Holding LMB before entering does not automatically count.
The null journey also keeps existing pointer-release/core acceptance from running.
Galaxy's live journey and rendered-hit branch remain unchanged.

## Debug visibility and lifecycle

In a development build, the existing **D = KNOW** HUD adds Earth gateway fields
only while Theme 3 is active: registered state, live world XYZ, distance, radius,
READY/NOT READY and intent count since activation. The HUD retains its hidden
default and existing 200 ms throttle. The new fields are absent in production.
No new shortcut, permanent overlay or F/G controls are introduced.

On destruction, PlanetaryTheme disables the gateway, releases its target, clears
its owned registration and READY state, sends the existing NOT READY callback
to clear App references, and empties its gateway list. It only unregisters when
JourneyDirector still holds that exact owned list, so it cannot remove another
theme's gateways. Re-entry constructs one new instance.

Development switching already supplies the director and clears App/gateway state.
The existing Journey 2 birth-to-Planetary path now also supplies the Earth theme's
lifecycle references and clears inherited READY before new detection. This small
branch applies only when the destination has the Earth gateway. Journey 2 itself
is not modified. Universal ESC code and all persistence paths remain unchanged.

## Validation

- Build passed: 84 modules, main bundle 835.44 kB / gzip 220.65 kB.
- `git diff --check` passed.
- New gateway characterization passed **235 checks**, using the real Planetary
  scene, SolarSystem, Gateway, ThemeManager, JourneyDirector and actual extracted
  App methods without launching the application. Checks cover registration,
  live orbit, matrix ancestry, vector reuse, explicit 11/10/9 boundaries and
  departure, home and other
  planets, non-consuming LMB, GUI/RMB/return exclusion, stale distance, no journey
  or transition, same-frame detection, one theme update, other-theme order,
  Galaxy hit/acceptance, destruction/re-entry and Journey 2 entry cleanup.
- Universal ESC characterization: **316 checks passed**.
- Earth detail characterization: **64 checks passed**. Its PlanetaryTheme whole-file
  freeze was removed for the authorized gateway addition; the new gateway tests
  assert unchanged Planetary F schema, home pose, far plane and environment, and
  unchanged flight, SolarSystem, journey, Galaxy, Theme 4, textures and renderer.
- Existing Space/Galaxy Traveller characterization passed.
- No generated files, texture/visual edits or extra journey implementation.

Remaining warnings: existing >500 kB bundle warning, Git LF/CRLF notices; Earth
test failure-path messages are expected simulated warnings. Automated tests do
not claim visual, FPS or physical input GREEN.

## Physical test and limits

Enter Theme 3 and open D. Confirm one registered Earth gateway, radius 10 and NOT
READY at home. Approach the moving Earth: verify its reported position follows
the globe. Check 11 units = NOT READY, 10 and 9 = READY, and retreat to 11 clears
READY/ARMED. Press LMB within the zone: the
intent count should increment while normal navigation continues, with no journey
or theme switch. Leave the zone, approach other planets, press ESC, switch away
and re-enter; verify READY/armed cleanup and no duplicates. Recheck Galaxy's
Special Star gateway and existing wheel WIP without changing it.

Physical approach feel and the tuned 10-unit threshold require GREEN acceptance.
Expect Earth READY around the Moon and near other planets inside its wider zone.
There is no hysteresis, so boundary crossings can toggle READY; this follows the
existing gateway contract. Existing navigation permits travel inside bodies and
does not add collision protection. No Journey 3 acceptance behavior is specified
or executable in this pass.

## Files and final state

Modified: `src/themes/PlanetaryTheme.js`, `src/core/App.js`, `src/core/DevHUD.js`,
`experiments/earth-detail-characterization.mjs`.
New: `experiments/planetary-earth-gateway-characterization.mjs` and this report.

`main` remains at the protected checkpoint. These six files are intentionally
uncommitted. No preview, commit or push. Await physical GREEN.

## Radius tuning scope

This follow-up changes only PlanetaryTheme's Earth threshold to 10 world units,
this existing report, and the gateway characterization tests. The preceding
Pass 2 changes remain uncommitted. Live tracking, update order, READY/ARMED logic,
LMB intent, Sun-centered navigation, flight, ESC and other themes are unchanged.
Build and whitespace checks passed; 235 gateway, 316 ESC, 64 Earth checks and
existing Space/Galaxy flight tests passed. No preview, commit or push.

## Pass 3 continuation

The tuned 10-unit physical READY test was confirmed GREEN by the user.
The preceding readiness-only report is retained as implementation history.
Journey 3 now uses this same gateway with intentional rendered-Earth LMB
acceptance; see `JOURNEY-3-PASS-3.md`. The live target, threshold and lifecycle
work are preserved. Physical GREEN now confirms Journey 3 completion and arrival
in OUR WORLD. ESC cancellation during transit and cinematic quality remain
physically unconfirmed; see the Pass 3 report for the checkpoint verdict and WIP.
