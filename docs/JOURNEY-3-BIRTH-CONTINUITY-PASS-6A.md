# Journey 3 BIRTH continuity — Pass 6A

Protected GREEN: `94c6c7e3a07ad59f058d4b01e45390c32803f2ad`.
Pass 6 remains uncommitted. User physical verdict: **RED — double visual jump at BIRTH**.

**PASS 6A PHYSICAL VERDICT: RED — visible jerk / double movement at BIRTH.**
This document records the historical 6A implementation. Its update/write ordering
and idle-entry clock are superseded by uncommitted Pass 6B; see
[JOURNEY-3-BIRTH-JERK-PASS-6B.md](JOURNEY-3-BIRTH-JERK-PASS-6B.md).
Pass 6B awaits a new physical GREEN verdict.
The supplied OBS observation was used as evidence; no OBS file or browser preview
was opened. Diagnosis combines source inspection and actual scene/camera-class
boundary traces with deterministic loader/clock fixtures.

## Both discontinuities

1. **Source horizon to undersized destination globe.** Pass 6's source camera
   finished at about 2.40 units from radius-2 Earth, looking at the upper tangent
   horizon. setArrivalPose replaced this with 94% of Theme 4 home distance:
   6.11 units for its 6.5-unit home, looking at Earth center. At unchanged 60-degree
   FOV, angular radius drops from asin(2/2.4), about 56.4 degrees, to asin(2/6.11),
   about 19.1 degrees. Whiteout concealed the coordinate switch but revealed a
   different apparent scale/composition. Theme 4 activation also changes Earth's
   axial orientation/spin and its live-source Sun direction to fixed illumination.
   No FOV or exposure write caused the size drop.

2. **BIRTH to normal exploration.** The App started an independent three-second
   CameraDirector flight from the retained Theme 3 currentPose, while the Journey 3
   pose hook controlled a 2.5-second BIRTH animation. The hook overwrote the flight's
   interpolated pose each frame, but finishTravel still copied that flight's target
   on completion. Even when the endpoint difference was tiny, the first normal
   update immediately added the existing approximately 0.2-unit idle offsets and
   cinematic bob. Earlier Pass 6 tests stopped at the completion callback rather
   than rendering the next exploration frame, so they missed this displacement.
   setMode already captures the exploration heading; a stale exploreForward was
   not the primary cause. The fixes address both competing flight state and idle
   entry without changing ordinary flight physics.

## Exact fix

EarthJourney.captureArrival snapshots the live Earth-relative eye position,
look target, conservative solid radius and world Sun direction **before**
Planetary is detached/disposed. The destination starting position/look target are
translated to its center and scaled by the solid-radius ratio. Their relative
orientation is preserved; no camera-axis remapping occurs at the switch.
This preserves screen-space horizon framing, apparent scale and camera quaternion.

The App uses the existing CameraDirector.updateTravel(0) pose hook to establish
that destination camera immediately while the existing veil is opaque. Journey 3
no longer starts the separate three-second destination flight. All non-Earth
journeys retain their original travel call, timing, wormhole and callbacks.

Over BIRTH's unchanged 2.5 seconds, the existing quintic progress drives a radial
pull-back and shortest spherical rotation toward the established home direction.
The eye stays outside the globe even for opposite-side arrivals; a straight
world-position lerp could cross solid Earth in those cases. The horizon look
offset eases toward the unchanged home look target. Exact zero/full-progress
vectors prevent tiny endpoint roundoff changes. The final pose is the original
OUR WORLD home, with its original FOV/projection policy.

EarthJourney temporarily drives only the destination instance's existing
sunDirection uniform, continuously rotating from the captured source illumination
to Theme 4's original fixed direction. No EarthGlobe source/shader, exposure,
texture, material or render pass is changed. The default light is reached by the
last BIRTH frame and restored on completion or cancellation; the temporary globe
reference is released. Geography/axial orientation still follow Theme 4's existing
setup and are not synchronized in this correction.

CameraDirector.finishTravel opt-ins to the completed Journey 3 endpoint and applies
it before releasing ownership. It then uses the existing mode/heading capture and
normal input reset. Existing idle displacement enters from zero over one second,
without a fade or extra veil. This is a small displacement envelope on the existing
idle motion, not a flight-physics change or new camera system. Switching flight
adapters clears the scoped idle-entry state. CameraDirector remains the sole
writer of camera position/orientation.

## Five boundary trace points

Representative actual App-flow fixture at 60 FPS, aspect 1, radius 2, near 0.1;
values rounded here. The integration suite emits full-precision camera position,
look target, quaternion, Earth center/rotations, lighting, projection and owner.
The source orbit continues normally during the one-second veil.

| Boundary | Time | Theme / owner | Eye world position | Look world target | Earth-relative distance |
| --- | ---: | --- | --- | --- | ---: |
| Last frame before full veil | 6.483333 | planetary / TRAVEL | (22.124114, 0, -1.292696) | (21.992824, 1.105546, -2.014189) | 2.400005 |
| Handoff: source | 7.500000 | planetary / TRAVEL | (22.020805, 0, -1.860495) | (21.889517, 1.105542, -2.581980) | 2.400000 |
| Handoff: established destination | 7.500000 | environment / TRAVEL | (0.429671, 0, 2.361225) | (0.298383, 1.105542, 1.639739) | 2.400000 |
| First visible BIRTH frame | 7.516667 | environment / TRAVEL | (0.429671, 0, 2.361225) | (0.298383, 1.105542, 1.639739) | 2.400000 |
| Last BIRTH frame | 9.983333 | environment / TRAVEL | (0.00002718, 0, 6.49990475) | (0, 0.00002568, 0.00003872) | 6.499905 |
| Exact completion endpoint | 10.000000 | environment / EXPLORE | (0, 0, 6.5) | (0, 0, 0) | 6.500000 |
| First normal exploration frame | 10.016667 | environment / EXPLORE | (0.00002072, 0.00001026, 6.5) | (0, 0, 0) | 6.500000 |

Source center at handoff: (21.59113439, 0, -4.22171953). Destination center: (0,0,0).
Source Earth's tilt remains +23.4 degrees in its parent, orbit tracks the live
center, and surface spin is about 3.536162 radians in this fixture. Destination
retains -23.44-degree group tilt and 4.9-radian initial surface spin, advancing to
about 4.945 radians at completion. Radius, orbit and assets are unchanged.

Source handoff quaternion, established destination quaternion and first-visible
quaternion match: approximately (0.47096519, 0.07919445, -0.04250168, 0.87756119).
The last BIRTH quaternion is approximately (0.000001976, 0.000002091, 0, 1), then
exact (0,0,0,1) at home and in the first normal frame. The first normal displacement
is about **0.0000231 units** rather than an immediate approximately 0.2-unit idle
step. The rendered last-BIRTH pose and completion endpoint differ only by the
small final eased increment, verified at each tested refresh rate.

FOV remains 60, zoom 1, aspect unchanged and near 0.1. The existing far plane
changes from Planetary's 320 to environment's 100 during the opaque handoff update;
this changes depth clipping, not apparent angular scale. The actual CameraDirector
continues applying both position and look throughout TRAVEL and EXPLORE. Renderer
exposure/tone-mapping policy is untouched; no exposure step is introduced.

The source/first-destination Sun vector is approximately (-0.98141520,0,0.19189634).
Last BIRTH approaches (-0.75500478,0.31087444,0.57734294), and completion/normal
exploration use the exact existing normalized Theme 4 default
(-0.75499651,0.31088091,0.57735027). The change is continuous during visible reveal.

## Timing and preservation

The Pass 6 phase IDs/schedule are unchanged: 0–2 PULL, 2–4.5 FIRE, 4.5–6.5 CLOUDS,
6.5–7.5 full VEIL, 7.5–10 REVEAL. No second veil or additional fade is added.
Actual App-flow tests still measure **10.000 seconds** at simulated 30/60/120 FPS
and 30.000 seconds with the existing 1/3 slow motion. Severe frame clamps or the
existing base-map loading hold may extend real elapsed time, as documented in Pass 6.

Journey 2, EarthGlobe, SolarSystem, gateway READY 10.0 and fresh LMB surface hits,
live orbit tracking, registered handoff, independent F/G, flight, Universal ESC,
other themes, renderer, GUI/storage and licensed textures remain protected.
CameraDirector changes are narrowly opt-in to the completed Journey 3 endpoint
and idle entry; the tests strip exactly those additions and compare the rest to
protected GREEN. App tests similarly isolate the Journey 3 clock/BIRTH additions.

## Tests

- Production build passed: 86 modules, bundle **848.93 kB**, gzip **224.01 kB**.
- Git whitespace check passed; new reports/tests separately checked for trailing
  whitespace. Index remains empty.
- New BIRTH continuity suite: **7,231 checks**, including source-parent disposal,
  matched angular scale/horizon projection, scaled/oblique/polar source framing,
  continuous exterior eye movement and rotation, constant FOV/zoom, continuous
  unit light direction, exact home/default-light endpoint and CameraDirector isolation.
- Actual journey integration: **2,256 checks**, including full boundary snapshots,
  actual destination camera established before reveal, no competing flight, first
  and second real exploration frames, adapter-state cleanup, 30/60/120 FPS timing,
  single handoff, Journey 2 replay, saved F/G and ESC in every phase. BIRTH ESC also
  restores the original destination light.
- Cinematic timing/path suite: **97,151 checks** passed.
- Atmosphere/path/cancellation/loading suite: **20,039 checks** passed.
- Planetary Earth visual/sharing: **4,166 checks** passed.
- Theme 4 Earth detail: **64 checks** passed.
- Gateway: **236 checks** passed.
- Universal ESC: **316 checks** passed.
- Space/Galaxy Traveller flight characterization passed.

The tests exercise production scene/camera/journey classes with model DOM,
deterministic maps and clocks. They do not constitute a physical visual verdict
or execute browser GPU shader rendering. No unexpected failures remain.

Warnings separately: existing Vite greater-than-500-kB bundle advisory; Git's
configured LF-to-CRLF advisory for App.js; deliberate Earth failure-test messages.

## Physical test instructions / remaining limitations

1. With slow motion off, accept a fresh Earth hit and time restored exploration:
   about 10 seconds, including the same one-second full veil.
2. Compare the last source horizon and first visible destination horizon in OBS.
   Earth should reappear at the same apparent scale and framing, then shrink
   deliberately during the visible continuous move to home.
3. Inspect the entire 2.5-second reveal for lighting pops, sudden look changes,
   clipping or unintended roll. Try opposite-side, oblique, close and polar starts.
4. Watch the exact frame where exploration resumes and the following second.
   Position, rotation and FOV should remain continuous; idle movement enters
   smoothly. Confirm normal LMB/RMB flight and established home afterward.
5. ESC in every phase, especially mid-reveal/loading. Confirm cleared curtain,
   normal light, current-theme Return Home, independent saved F/G and released
   mouse/camera state. Repeat completion, cancellation and theme switching.
6. Replay Journey 2 and recheck Planetary Earth gateway/flight. Check 30/60/120 Hz
   where available; measure hardware frame-time behavior independently.

The required move from a close horizon to the full-globe home is now visible and
continuous, but its speed/composition remains subject to physical review. Earth
geography, tilt and spin still differ at theme switch; no globe alignment or new
visual effects were added. Clouds/haze remain the existing screen-space gradients.
Polar/framing extremes, source near-plane cropping and subjective lighting balance
still need physical acceptance. Quantitative continuity checks are not GREEN.

## Files and Git state

Runtime changes across uncommitted Pass 6/6A:

- `src/core/App.js`
- `src/systems/cinematic/EarthJourney.js`
- `src/systems/cinematic/CameraDirector.js` (6A only)

Modified regression fixtures:

- `experiments/journey3-characterization.mjs`
- `experiments/journey3-atmosphere-characterization.mjs`
- `experiments/planetary-earth-visual-characterization.mjs`

New/untracked tests and reports:

- `experiments/journey3-cinematic-characterization.mjs`
- `experiments/journey3-birth-continuity-characterization.mjs`
- `docs/JOURNEY-3-CINEMATIC-PASS-6.md` (original Pass 6 RED marked)
- `docs/JOURNEY-3-BIRTH-CONTINUITY-PASS-6A.md`

Ten files comprise the full current Pass 6/6A working tree. All are unstaged; HEAD
remains protected GREEN. No commit, push, preview or synced reference-file change.
