import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, extname } from 'node:path';
import * as THREE from 'three';
import { ThemeManager } from '../src/engine/ThemeManager.js';

// Load production ES modules with the extension resolution Vite supplies.
const cache = new Map();
async function moduleURL(path) {
  path = resolve(path); if (cache.has(path)) return cache.get(path);
  let source = readFileSync(path, 'utf8').replaceAll('import.meta.env.BASE_URL', '"/"').replaceAll('import.meta.env.DEV', 'false');
  for (const match of [...source.matchAll(/from\s+["']([^"']+)["']/g)]) {
    const spec = match[1];
    if (!spec.startsWith('.')) continue;
    const target = resolve(dirname(path), spec + (extname(spec) ? '' : '.js'));
    source = source.replace(match[0], `from ${JSON.stringify(await moduleURL(target))}`);
  }
  source = source.replaceAll('from "three"', `from ${JSON.stringify(import.meta.resolve('three'))}`)
    .replaceAll('from "lil-gui"', `from ${JSON.stringify(import.meta.resolve('lil-gui'))}`);
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`; cache.set(path, url); return url;
}
const load = async path => import(await moduleURL(path));
const { default: CameraDirector, CameraMode } = await load('src/systems/cinematic/CameraDirector.js');
const { default: JourneyDirector } = await load('src/systems/cinematic/JourneyDirector.js');
const { GalaxyJourney } = await load('src/systems/cinematic/GalaxyJourney.js');
const { EarthJourney } = await load('src/systems/cinematic/EarthJourney.js');
const { PlanetaryTheme } = await load('src/themes/PlanetaryTheme.js');
const { EnvironmentTheme } = await load('src/themes/EnvironmentTheme.js');
const appSource = readFileSync('src/core/App.js', 'utf8');
function method(name) {
  const start = appSource.indexOf(`\n  ${name}(`) + 1; const rest = appSource.slice(start);
  const next = rest.slice(1).search(/\n  [a-zA-Z]\w*\(/) + 1;
  const source = appSource.slice(start, next > 0 ? start + next : appSource.lastIndexOf('\n}')).replaceAll('import.meta.env.DEV', 'false');
  return new Function('THREE', 'CameraMode', 'SPACE_PLASMA_GUI_BASELINE', `return ({${source}\n}).${name};`)(THREE, CameraMode, 'blob-pass-2');
}
function callback(app, name) {
  const start = appSource.indexOf(`this.journeyDirector.${name} = `) + `this.journeyDirector.${name} = `.length;
  const end = appSource.indexOf('\n    };', start) + 6;
  return new Function(`return ${appSource.slice(start, end)};`).call(app);
}
const originalLog = console.log, originalWarn = console.warn, originalTrace = console.trace;
console.log = console.warn = console.trace = () => {};
const eventSurface = { addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
function element() {
  return { style: { background: "black", transition: "opacity 1s linear", opacity: "0" }, children: [],
    appendChild(child) { this.children.push(child); child.parent = this; },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); } };
}
globalThis.document = { ...eventSurface, createElement: element };
globalThis.window = { ...eventSurface, devicePixelRatio: 1, innerWidth: 1000, innerHeight: 1000 };
const storage = new Map(); let writes = 0;
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem() { writes++; throw new Error('No writes allowed'); } };
const textureLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function(url, onLoad) { onLoad(new THREE.Texture({ width: url.includes('8k') ? 8192 : 4096, height: url.includes('8k') ? 4096 : 2048 })); };
let checks = 0; const check = (v, message) => { assert.ok(v, message); checks++; };
function gui() {
  const root = { controllers: [], folders: [], addFolder(title) {
    const folder = { title, controllers: [], add(object, property) {
      const c = { object, property, label: property, name(name) { this.label = name; return this; }, listen() { return this; }, disable() { return this; }, onChange(fn) { this.change = fn; return this; }, updateDisplay() {} };
      this.controllers.push(c); return c;
    }, destroy() { root.folders = root.folders.filter(f => f !== this); } };
    this.folders.push(folder); return folder;
  }, controllersRecursive() { return this.folders.flatMap(f => f.controllers); }, load(data) {
    for (const folder of this.folders) for (const c of folder.controllers) {
      const saved = data.folders?.[folder.title]?.controllers;
      if (saved && c.label in saved) { c.object[c.property] = saved[c.label]; c.change?.(saved[c.label]); }
    }
  } }; return root;
}
function fixture() {
  const app = { gui: gui(), renderer: { renderer: { domElement: eventSurface }, fades: [], fadeIn(t) { this.fades.push(['in', t]); }, fadeOut(t) { this.fades.push(['out', t]); } },
    transitSystem: { active: false, start() { this.active = true; }, stop() { this.active = false; } },
    acceptancePointer: new THREE.Vector2(), acceptanceRaycaster: new THREE.Raycaster(), acceptanceClick: {},
    isGUIEvent: e => Boolean(e.gui), showNotification() {}, isBoosting: true,
  };
  app.renderer.fadeOverlay = element();
  app.look = { scale: 1 }; app.gui.addFolder("LOOK").add(app.look, "scale").name("Scale");
  app.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  app.cameraDirector = new CameraDirector(app.camera, eventSurface);
  app.journeyDirector = new JourneyDirector(app.cameraDirector);
  app.themeManager = new ThemeManager(new THREE.Group(), app.gui);
  app.themeManager.register('planetary', PlanetaryTheme); app.themeManager.register('environment', EnvironmentTheme);
  for (const name of ['initializeActiveTheme', 'applyActiveThemeFlight', 'loadGUISettings', 'restoreSavedSettingsAfterReturn', 'disarmArmedInvitation', 'resetAcceptanceClick', 'beginGatewayJourney', 'acceptReadyProximityGateway']) app[name] = method(name);
  for (const name of ['onApproach', 'onHorizon', 'onSingularity', 'onTransit', 'onGatewayReady', 'onTransitEnd', 'onJourneyFinished', 'onVoidStart', 'onBirth']) app.journeyDirector[name] = callback(app, name);
  app.cameraDirector.onReturnHome = () => app.restoreSavedSettingsAfterReturn();
  app.themeManager.activate('planetary'); app.applyActiveThemeFlight(); app.initializeActiveTheme();
  app.journeyDirector.setGateways(app.themeManager.activeTheme.getGateways());
  const target = app.themeManager.activeTheme.solarSystem.earth;
  const center = target.getWorldPosition(new THREE.Vector3());
  app.cameraDirector.returnHome({ position: center.clone().add(new THREE.Vector3(0, 0, 10)), lookTarget: center }, true);
  app.camera.updateMatrixWorld(true); app.journeyDirector.update();
  return app;
}
const click = { button: 0, clientX: 50, clientY: 50 };
storage.set('fibonacci-flight-v1-planetary', JSON.stringify({ version: 1, settings: { thrustMaxSpeed: 7 } }));
storage.set('fibonacci-flight-v1-environment', JSON.stringify({ version: 1, settings: { rmbMaxSpeed: 2.5 } }));
storage.set('hero-core-gui-environment', JSON.stringify({ folders: { Earth: { controllers: { 'Earth surface detail': 'high' } } } }));
storage.set("hero-core-gui-planetary", JSON.stringify({ folders: { LOOK: { controllers: { Scale: 2.5 } } } }));
const presetBefore = JSON.stringify([...storage]);
const app = fixture(); const sourceTheme = app.themeManager.activeTheme; const gateway = sourceTheme.earthGateway;
check(app.journeyDirector.gatewayReady && gateway.radius === 10 && !app.journeyDirector.isActive(), '10 READY without proximity start');
check(!app.acceptReadyProximityGateway({ ...click, clientX: 0, clientY: 0 }) && !app.journeyDirector.isActive(), 'ordinary LMB miss does not start');
check(app.acceptReadyProximityGateway(click), 'rendered Earth hit starts Journey 3');
const journey = app.journeyDirector.getJourney();
check(journey.id === 'planetary-environment' && !app.cameraDirector.freeFlight.active && app.cameraDirector.mode === CameraMode.TRAVEL, 'unique journey takes camera ownership');
check(!app.acceptReadyProximityGateway(click) && app.journeyDirector.getJourney() === journey, 'duplicate start rejected');
let activations = 0; let maskedActivation = false; const activate = app.themeManager.activate.bind(app.themeManager);
app.themeManager.activate = name => {
  activations++;
  maskedActivation = journey.atmosphere.whiteout === 1 && app.renderer.fadeOverlay.children[2].style.opacity === "1";
  activate(name);
};
function tick(app, delta) {
  app.themeManager.update({ time: (app.time = (app.time ?? 0) + delta) });
  const earth = app.journeyDirector.getJourney()?.id === 'planetary-environment' ? app.journeyDirector.getJourney() : null;
  if (earth) app.journeyDirector.update(app.cameraDirector.position, delta);
  app.cameraDirector.update(earth?.completed ? 0 : delta);
  if (!earth) app.journeyDirector.update(app.cameraDirector.position, delta);
}
const phases = ['APPROACH', 'HORIZON', 'SINGULARITY', 'WORMHOLE', 'VOID', 'BIRTH'];
for (const [index, duration] of [2, 1.25, 1.25, 1, 1, 1].entries()) {
  // Camera callbacks follow the same clock; small steps avoid jumping phases.
  for (let frame = 0; frame < duration * 100 + 2 && journey.phase !== phases[index]; frame++) tick(app, 0.01);
  check(journey.phase === phases[index], `phase ${phases[index]}`);
  check(app.themeManager.activeThemeName === (index < 5 ? 'planetary' : 'environment'), 'destination activates only at BIRTH');
}
check(activations === 1 && maskedActivation && app.journeyDirector.activeJourneyDestinationTheme === 'environment', 'single registered destination activation');
check(!gateway.enabled && gateway.target === null && app.journeyDirector.gateways.length === 0 && !app.activeGateway && !app.armedGateway, 'source gateway released');
check(!app.cameraDirector.approachCoreObject && !app.cameraDirector.crossingCoreObject && !app.journeyDirector.activeJourneyTarget, 'source camera/director references released');
const home = app.themeManager.activeTheme.getHomePose();
check(!app.cameraDirector.flightSystem.flight && app.cameraDirector.position.equals(journey.arrivalStart), 'actual arrival pose established under whiteout without a parallel flight');
tick(app, 0.01);
check(app.cameraDirector.position.equals(journey.arrivalStart) && journey.atmosphere.whiteout > 0.999,
  'masked arrival camera is established before destination reveal');
check(!app.transitSystem.active && !app.renderer.fades.some(([type]) => type === 'out'),
  'Journey 3 never starts wormhole transit or black fade');
check(app.themeManager.activeTheme.flight.rmbMaxSpeed === 2.5, 'saved destination F restored');
await app.themeManager.activeTheme.earth.ready; await Promise.resolve();
check(app.themeManager.activeTheme.earth.surfaceDetail === 'high', 'saved destination G requests existing High mode');
for (let i = 0; i < 310 && app.journeyDirector.isActive(); i++) tick(app, 0.01);
check(journey.completed && !app.journeyDirector.isActive() && !app.cameraDirector.journey && app.cameraDirector.freeFlight.active && app.cameraDirector.mode === CameraMode.EXPLORE, 'completion releases journey to normal exploration');
check(app.cameraDirector.position.distanceTo(home.position) < 1e-8 && !app.transitSystem.active, 'home arrival and transit cleanup');
check(app.cameraDirector.exploreTravel === app.themeManager.activeTheme.flight, 'normal Earth flight adapter restored');
check(app.renderer.fadeOverlay.children.length === 0 && app.renderer.fadeOverlay.style.background === 'black'
  && app.renderer.fadeOverlay.style.opacity === '0', 'completion clears atmospheric layers and restores curtain');
check(writes === 0 && JSON.stringify([...storage]) === presetBefore, 'destination transition never writes presets');

// Replay the unchanged Journey 2 phase logic against the protected version.
const baselineGalaxy = execFileSync('git', ['show', '80c2757470e66a43e956178aa3629a077fb0bcdc:src/systems/cinematic/GalaxyJourney.js'], { encoding: 'utf8' })
  .replace('"./Journey"', JSON.stringify(await moduleURL('src/systems/cinematic/Journey.js')));
const { GalaxyJourney: OldGalaxy } = await import(`data:text/javascript;base64,${Buffer.from(baselineGalaxy).toString('base64')}`);
const old = new OldGalaxy(), current = new GalaxyJourney(); const oldEvents = [], currentEvents = [];
old.onEvent = e => oldEvents.push(e); current.onEvent = e => currentEvents.push(e);
for (let i = 0; i < 2100; i++) { old.update(0.01); current.update(0.01); check(old.phase === current.phase && old.phaseTime === current.phaseTime && old.completed === current.completed, 'Journey 2 timing unchanged'); }
check(current.id === old.id && JSON.stringify(oldEvents) === JSON.stringify(currentEvents), 'Journey 2 identity and events unchanged');

for (const cancelPhase of ['START', 'APPROACH', 'HORIZON', 'SINGULARITY', 'WORMHOLE', 'VOID', 'BIRTH']) {
  const cancelAfterBirth = cancelPhase === 'BIRTH';
  const a = fixture(); a.acceptReadyProximityGateway(click); const active = a.journeyDirector.getJourney();
  if (cancelAfterBirth) for (let i = 0; i < 1800 && a.themeManager.activeThemeName !== 'environment'; i++) tick(a, 0.01);
  else { for (let i = 0; i < 1700 && active.phase !== cancelPhase; i++) tick(a, 0.01); }
  a.look.scale = 3.5;
  a.cameraDirector.freeFlight.pointer.active = true; a.cameraDirector.freeFlight.pointer.rmbActive = true;
  let keydown; window.addEventListener = (name, listener) => { if (name === 'keydown') keydown = listener; };
  method('setupThemeSwitching').call(a); keydown({ code: 'Escape', repeat: false });
  check(active.cancelled && !a.journeyDirector.isActive() && a.cameraDirector.mode === CameraMode.RETURN && !a.transitSystem.active, 'ESC cancels and returns safely');
  check(!a.cameraDirector.journey && !a.cameraDirector.approachCoreObject && !a.cameraDirector.crossingCoreObject, 'ESC clears camera journey references');
  a.cameraDirector.finishReturn();
  check(a.themeManager.activeThemeName === (cancelAfterBirth ? 'environment' : 'planetary'), 'ESC stays in current active theme');
  check(cancelAfterBirth ? a.themeManager.activeTheme.flight.rmbMaxSpeed === 2.5 : a.themeManager.activeTheme.flight.thrustMaxSpeed === 7, 'ESC restores active saved F');
  check(cancelAfterBirth ? a.themeManager.activeTheme.earth.surfaceDetail === "high" : a.look.scale === 2.5, "ESC restores active saved G independently");
  check(a.renderer.fades.some(([type, duration]) => type === 'in' && duration === 0.3), 'ESC clears curtain');
  check(!a.cameraDirector.freeFlight.pointer.active && !a.cameraDirector.freeFlight.pointer.rmbActive, "ESC resets both mouse buttons");
  if (cancelAfterBirth) check(a.themeManager.activeTheme.earth.uniforms.sunDirection.value.equals(new THREE.Vector3(-0.85, 0.35, 0.65).normalize()), 'ESC restores temporary destination illumination');
  check(active.atmosphere.cleared && active.target === null && a.renderer.fadeOverlay.children.length === 0
    && a.renderer.fadeOverlay.style.opacity === '0', 'ESC clears all atmospheric effects and references');
  a.themeManager.activeTheme.destroy();
}
const unavailable = fixture(); unavailable.themeManager.themes.delete('environment');
check(!unavailable.acceptReadyProximityGateway(click) && !unavailable.journeyDirector.isActive(), 'unavailable destination rejected before start');
unavailable.themeManager.activeTheme.destroy();
const lostDestination = fixture(); lostDestination.acceptReadyProximityGateway(click);
const failedJourney = lostDestination.journeyDirector.getJourney();
lostDestination.themeManager.themes.delete('environment');
const originalError = console.error; console.error = () => {};
for (let i = 0; i < 1800 && lostDestination.journeyDirector.isActive(); i++) tick(lostDestination, 0.01);
console.error = originalError;
check(failedJourney.cancelled && !lostDestination.journeyDirector.isActive() && lostDestination.cameraDirector.mode === CameraMode.RETURN, 'destination removed mid-journey returns safely');
check(lostDestination.themeManager.activeThemeName === 'planetary' && !lostDestination.transitSystem.active && !lostDestination.cameraDirector.journey, 'failed transition releases source control');
lostDestination.cameraDirector.finishReturn(); lostDestination.themeManager.activeTheme.destroy();

// Run the actual App frame method at different refresh rates. Only Journey 3
// receives measured elapsed time; its camera and phase clock share that delta.
const originalPerformance = globalThis.performance;
let frameMilliseconds = 0;
globalThis.performance = { now: () => frameMilliseconds };
const durations = []; let birthTrace;
try {
  for (const [fps, timeScale] of [[30, 1], [60, 1], [120, 1], [60, 1 / 3]]) {
    frameMilliseconds = 0;
    const a = fixture(); a.journeyDirector.timeScale = timeScale;
    Object.assign(a, { stats: { begin() {}, end() {} }, scroll: { updateScroll() {} }, intensity: 0,
      buildState() { return { time: this.time }; }, interactionManager: { update() {} }, updateCamera() {},
      exploreDirector: { update() {} }, updateEnvironment() {
        this.camera.far = this.themeManager.activeTheme.getCameraFar?.() ?? 100;
        this.camera.updateProjectionMatrix();
      }, devHUD: { update() {} },
      points: { rotation: { x: 0, y: 0 } }, wheel: { delta: 0 } });
    a.transitSystem.update = () => {};
    check(a.acceptReadyProximityGateway(click), 'frame-clock fixture accepts real surface hit');
    const active = a.journeyDirector.getJourney();
    const frame = method('update');
    let births = 0; const activate = a.themeManager.activate.bind(a.themeManager);
    a.themeManager.activate = name => { births++; activate(name); };
    let lastPosition, lastQuaternion;
    const trace = [];
    const snapshot = (label) => {
      const theme = a.themeManager.activeTheme;
      const globe = theme.earth ?? theme.solarSystem.earthGlobe;
      a.camera.updateMatrixWorld(true);
      const center = globe.getWorldCenter(new THREE.Vector3());
      trace.push({ label, seconds: frameMilliseconds / 1000, center: center.toArray(), groupRotation: globe.group.rotation.toArray().slice(0, 3), surfaceRotation: globe.surface.rotation.toArray().slice(0, 3), theme: a.themeManager.activeThemeName, position: a.camera.position.toArray(),
        target: a.cameraDirector.currentTarget.toArray(), quaternion: a.camera.quaternion.toArray(),
        fov: a.camera.fov, aspect: a.camera.aspect, near: a.camera.near, far: a.camera.far,
        radius: 2, distance: a.camera.position.distanceTo(center),
        angularRadius: Math.asin(2 / a.camera.position.distanceTo(center)),
        sun: globe.uniforms.sunDirection.value.toArray(), owner: a.cameraDirector.mode });
    };
    const birthCallback = a.journeyDirector.onBirth;
    a.journeyDirector.onBirth = theme => { snapshot('handoff-source'); birthCallback(theme); };
    let destinationApplied = false;
    let preVeil = false, firstBirth = false, lastBirth = false;
    for (let count = 0; count < fps * 32 && a.journeyDirector.isActive(); count++) {
      lastPosition = a.cameraDirector.position.clone();
      lastQuaternion = a.camera.quaternion.clone();
      if (!lastBirth && active.phase === 'BIRTH' && active.phaseTime >= 2.5 - timeScale / fps - 1e-8) {
        snapshot('last-birth'); lastBirth = true;
      }
      frameMilliseconds += 1000 / fps;
      frame.call(a);
      if (active.arrived && !destinationApplied) { snapshot('handoff-destination'); destinationApplied = true; }
      if (!preVeil && active.elapsed >= 6.5 - 1 / fps * timeScale) { snapshot('last-pre-veil'); preVeil = true; }
      if (!firstBirth && active.arrived && active.phaseTime > 0 && active.atmosphere.whiteout < 1) { snapshot('first-visible-birth'); firstBirth = true; }
      // Browser task boundary: allow the existing shared-map readiness to settle.
      for (let i = 0; i < 8; i++) await Promise.resolve();
    }
    const duration = frameMilliseconds / 1000;
    durations.push({ fps, timeScale, seconds: Number(duration.toFixed(6)) });
    check(Math.abs(duration - 10 / timeScale) <= 2 / fps + 1e-8, 'click-to-exploration duration is frame-rate independent');
    check(active.completed && !a.journeyDirector.isActive() && a.cameraDirector.freeFlight.active
      && a.cameraDirector.mode === CameraMode.EXPLORE && !a.cameraDirector.journey, 'measured-clock completion restores exploration');
    check(births === 1 && a.renderer.fadeOverlay.children.length === 0, 'single handoff and no lingering layers');
    check(a.cameraDirector.position.distanceTo(lastPosition) < 0.002, 'reveal-to-exploration camera has no abrupt jump');
    check(a.cameraDirector.position.equals(a.themeManager.activeTheme.getHomePose().position), 'reveal finishes exactly at established home');
    snapshot('birth-complete');
    check(a.camera.quaternion.angleTo(lastQuaternion) < 0.002, 'last rendered BIRTH rotation adopted at completion');
    check(!a.cameraDirector.flightSystem.flight, 'no competing or lingering destination flight');
    const source = trace.find(t => t.label === 'handoff-source');
    const destination = trace.find(t => t.label === 'handoff-destination');
    const visible = trace.find(t => t.label === 'first-visible-birth');
    check(Math.abs(Math.asin(active.sourceRadius / active.sourceRelative.length()) - destination.angularRadius) < 1e-7, 'destination immediately preserves source apparent scale');
    check(Math.abs(visible.angularRadius - destination.angularRadius) < 0.002, 'first visible BIRTH starts at established horizon scale');
    check(source.fov === destination.fov && destination.fov === visible.fov, 'FOV continuous through masked handoff');
    const completedPosition = a.camera.position.clone(), completedRotation = a.camera.quaternion.clone();
    frameMilliseconds += 1000 / fps; frame.call(a); snapshot('first-normal-exploration');
    check(a.camera.position.distanceTo(completedPosition) < 0.002, 'first real exploration frame has no idle position step');
    check(a.camera.quaternion.angleTo(completedRotation) < 0.002, 'first real exploration frame has no rotation step');
    check(trace.at(-1).fov === visible.fov && a.renderer.fadeOverlay.children.length === 0, 'normal exploration projection and curtain continuous');
    const nearPose = a.camera.position.clone();
    frameMilliseconds += 1000 / fps; frame.call(a);
    check(a.camera.position.distanceTo(nearPose) < 0.006, 'second exploration frame continues idle entry smoothly');
    a.cameraDirector.setExploreTravel(a.themeManager.activeTheme.flight);
    check(a.cameraDirector.arrivalIdleStart === undefined, 'adapter switch clears scoped idle entry state');
    if (fps === 60 && timeScale === 1) birthTrace = trace;
    a.themeManager.activeTheme.destroy();
  }
} finally { globalThis.performance = originalPerformance; }
app.themeManager.activeTheme.destroy();
check(writes === 0 && JSON.stringify([...storage]) === presetBefore, 'ESC and completion preserve all presets');
THREE.TextureLoader.prototype.load = textureLoad;
delete globalThis.document; delete globalThis.window; delete globalThis.localStorage;
console.log = originalLog; console.warn = originalWarn; console.trace = originalTrace;
console.log(`BIRTH boundary trace: ${JSON.stringify(birthTrace)}`);
console.log(`Measured App durations: ${JSON.stringify(durations)}`);
console.log(`Journey 3 characterization: PASS (${checks} checks including Journey 2 replay). No physical GREEN claim.`);
