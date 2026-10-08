# Universal ESC — Return Home and restore saved F/G

Protected checkpoint: `0b8e2cb7c96bd9d9b4551298b557c2b6329581a0`.
Physical verdict: **GREEN (6/6 tests)**, confirmed by Erich.
Accepted for checkpoint: "Checkpoint GREEN — Universal ESC saved-state restoration".
The physical test procedure below is retained as a regression checklist.

## Existing contract and integration point

`App.setupThemeSwitching` owns the only application ESC keyboard branch. ESC
already works from input/select/contenteditable targets; other theme hotkeys are
suppressed there. There is no separate application ESC overlay handler.

The existing order is: resolve the active theme's home pose, reset inspection,
call `CameraDirector.returnHome`, stop/cancel the active JourneyDirector journey,
then disarm the invitation. Camera return stops FlightSystem, resets FreeFlight
and the theme flight adapter, clears yaw, selects RETURN mode and preserves the
theme's home position/look target. Completion selects EXPLORE and invokes
`onReturnHome`. Before this pass the callback loaded only G.

G is one shared Visual Lab containing current theme folders plus shared Cinematic
and Audio folders. G Save writes `hero-core-gui-<active-theme>`; G Load uses that
key and lil-gui's load callbacks to apply runtime changes. Obsolete Space Plasma
saves retain their existing baseline-version filtering. There is no App-level G
Reset action; this pass adds none.

F is a separate GUI and ThemeFlightControls instance for each active theme.
Defaults, ranges and flight adapters belong to the theme. F Save stores version 1
and its declared parameters under `fibonacci-flight-v1-<theme>`. F Load applies
clamped finite values to both settings and live flight parameters, updates the
theme's session runtime values, and refreshes controls. F Reset applies the
theme's defaults without saving. On activation, existing session F runtime takes
priority over saved F, otherwise the loader reads saved F. That remains unchanged.

## New behavior

An initial ESC keydown records the current theme instance before starting the
unchanged Return Home/cancellation sequence. Repeated keyboard events are ignored.
After Return Home completes, the App consumes that request and loads the theme's
saved F through its existing loader. It then performs the existing independent
G load and explicitly refreshes all G controls. F load is silent to avoid adding
a second notification; existing G notifications remain.

Settings are not restored during the return animation or active journey
cancellation. If the theme instance has been replaced meanwhile, its pending F
request is discarded. Other Return Home callers, including immediate development
theme switches, retain their existing G-only completion behavior. No second ESC
handler is added. CameraDirector, JourneyDirector, ThemeManager, flight adapters,
input release handling, gateway READY/proximity logic, home/orbit references and
theme switching code are unchanged.

BaseTheme's F load wrapper now accepts an optional `notify` argument, defaulting
to true. Existing F Load button behavior remains unchanged.

## Independent presets and missing-preset behavior

All seven registered themes use independent keys:

| Theme | F key | G key |
| --- | --- | --- |
| Space | fibonacci-flight-v1-space | hero-core-gui-space |
| Galaxy | fibonacci-flight-v1-galaxy | hero-core-gui-galaxy |
| Planetary | fibonacci-flight-v1-planetary | hero-core-gui-planetary |
| Environment | fibonacci-flight-v1-environment | hero-core-gui-environment |
| Human | fibonacci-flight-v1-human | hero-core-gui-human |
| Molecular | fibonacci-flight-v1-molecular | hero-core-gui-molecular |
| Movies | fibonacci-flight-v1-movies | hero-core-gui-movies |

F and G are read separately; their save times do not need to match. ESC never
calls Save, Reset, setItem or removeItem. It does not access another theme's
preset. Existing shared G controls are restored from the active theme's G preset.

If a category has no saved preset, its existing load semantics are preserved:
that category's current runtime values remain unchanged. ESC does not force
defaults over unsaved experiments when no saved value exists. Fresh baseline
values therefore stay at baseline unless the user has changed them. This is the
safest compatible fallback and does not invent or write a preset. F-only and
G-only saves work independently. Corrupt/unavailable storage is caught separately;
the other category still loads. Existing partial F preset/clamping behavior and
legacy G compatibility are retained.

Galaxy example verified: saved speed 6 and saved G scale 2.5 restore after unsaved
speed 10 and scale 3.5, with both displays synchronized and preset bytes unchanged.

## Automated validation

- Production build passed (84 modules; 834.37 kB main bundle / gzip 220.34 kB).
- `git diff --check` passed.
- `node experiments/universal-esc-characterization.mjs`: 316 checks passed.
  Tests exercise actual App method bodies, BaseTheme/ThemeFlightControls and
  lil-gui Controller/GUI load methods without constructing the application.
  Coverage includes every theme schema, all four F/G saved/missing combinations,
  movement parameter application, GUI synchronization, cancellation order,
  deferred restoration, repeats, replaced themes, normal theme-switch completion,
  corrupt/denied storage, input routing and zero persistence writes.
- Earth detail characterization: 64 checks passed. Its broad App-file freeze was
  removed because App is the authorized integration point for this pass; its
  camera/flight/rendering/asset checks remain unchanged.
- Existing Space/Galaxy Traveller characterization passed.
- No Earth shaders/assets, other theme implementations, journeys, camera or
  renderer files changed. No generated files are included.

These tests stub the event surface, return completion and GUI display output.
They do not certify physical input cleanup, rendered controls or live journey
transitions. The existing >500 kB bundle warning and LF/CRLF notices remain.

## Physical test

For each theme, explicitly save F and G at different times, change both, then
press ESC while exploring. Confirm home position, movement values and both GUIs.
Repeat with F-only/G-only/no saves; the missing category should stay unchanged.
Check ESC during a journey, held/released LMB/RMB, a focused GUI input and a theme
switch during Return Home. Confirm one restoration after safe completion, no
unexpected gateway activation and no saved-preset changes. In Environment also
test G's saved Standard/High surface selection and asynchronous texture status.

Changed files: `src/core/App.js`, `src/themes/BaseTheme.js`,
`experiments/earth-detail-characterization.mjs`, new
`experiments/universal-esc-characterization.mjs`, and this report.
