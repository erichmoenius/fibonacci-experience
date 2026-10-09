import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

import { Loop } from '../src/core/Loop.js';
import { Renderer } from '../src/graphics/Renderer.js';
import { ExploreDirector } from '../src/systems/cinematic/ExploreDirector.js';
const originalPerformance = globalThis.performance, originalRAF = globalThis.requestAnimationFrame;
let milliseconds = 0;
globalThis.performance = { now: () => milliseconds };
globalThis.requestAnimationFrame = () => {};
const record = process.argv.find(arg => arg.startsWith('--record='))?.split('=')[1];
const all = [], summaries = [];
try {
  for (const fps of [30, 60, 120]) {
    milliseconds = 0;
    const a = fixture();
    const frame = method('update'); a.updateCamera = method('updateCamera');
    a.mouse = { x: 0, y: 0 }; a.cinematic = { parallaxStrength: 0 };
    Object.assign(a, { stats: { begin() {}, end() {} }, scroll: { updateScroll() {} }, intensity: 0,
      buildState() { return { time: this.time }; }, interactionManager: { update() {} },
      exploreDirector: new ExploreDirector(a.cameraDirector), devHUD: { update() {} },
      points: { rotation: { x: 0, y: 0 } }, wheel: { delta: 0 },
      updateEnvironment() { this.camera.far = this.themeManager.activeTheme.getCameraFar?.() ?? 100; this.camera.updateProjectionMatrix(); } });
    a.transitSystem.update = () => {};
    a.renderer.camera = a.camera; a.renderer.scene = a.themeManager.container;
    a.renderer.portal = null; a.renderer.bloomEnabled = false;
    a.renderer.celestialStarfield = { active: false };
    a.renderer.renderTarget = {};
    a.renderer.renderScene = Renderer.prototype.renderScene;
    const order = [], writes = [], passes = [];
    let scope = 'input', births = 0, j;
    const wrap = (object, name, label) => {
      const original = object[name];
      object[name] = function(...args) { const previous = scope; scope = label; order.push(label); try { return original.apply(this, args); } finally { scope = previous; } };
    };
    for (const name of ['update', 'updateTravel', 'finishTravel', 'applyComputedPosition', 'applyLookTarget']) wrap(a.cameraDirector, name, `CameraDirector.${name}`);
    wrap(a, 'updateCamera', 'App.updateCamera'); wrap(a.themeManager, 'update', 'theme.update');
    wrap(a.journeyDirector, 'update', 'JourneyDirector.update');
    for (const name of ['onBirth','onJourneyFinished','onVoidStart']) wrap(a.journeyDirector, name, name);
    const activate = a.themeManager.activate.bind(a.themeManager);
    a.themeManager.activate = name => { births++; order.push(`activate:${name}`); activate(name); };
    const set = a.camera.position.set;
    a.camera.position.set = function(...args) { const result = set.apply(this,args); writes.push({ kind: 'position', scope, journeyClock: j?.elapsed, birthTime: j?.phaseTime, value: this.toArray() }); return result; };
    const lookAt = a.camera.lookAt;
    a.camera.lookAt = function(...args) { const result = lookAt.apply(this,args); writes.push({ kind: 'quaternion', scope, value: this.quaternion.toArray() }); return result; };
    const gpu = a.renderer.renderer;
    Object.assign(gpu, { autoClear: true, setRenderTarget(target) { this.target = target; }, clear() {},
      capabilities: { maxTextureSize: 16384, getMaxAnisotropy: () => 8 }, initTexture() {},
      render(scene, camera) {
        camera.updateMatrixWorld(true); scene.updateMatrixWorld(true);
        scene.traverseVisible(object => { if (object.isMesh) object.onBeforeRender?.(this, scene, camera); });
        passes.push({ pass: this.target ? 'target' : 'screen', position: camera.position.toArray(), quaternion: camera.quaternion.toArray() });
      } });
    const loop = new Loop(() => frame.call(a), () => Renderer.prototype.render.call(a.renderer)); loop.isRunning = true;
    const click = { button: 0, clientX: 50, clientY: 50 };
    check(a.acceptReadyProximityGateway(click), 'real App acceptance begins instrumented journey');
    j = a.journeyDirector.getJourney();
    const frames = []; let previousPosition = a.camera.position.clone(), previousQuaternion = a.camera.quaternion.clone(), previousRelative;
    for (let n = 1; n <= fps * 12; n++) {
      order.length = 0; writes.length = 0; passes.length = 0;
      const phaseBefore = j.phase, timeBefore = j.elapsed;
      milliseconds = n * 1000 / fps; loop.tick(milliseconds);
      const globe = a.themeManager.activeTheme.earth ?? a.themeManager.activeTheme.solarSystem.earthGlobe;
      const center = globe.getWorldCenter(new THREE.Vector3()), relative = a.camera.position.clone().sub(center);
      const displacement = a.camera.position.clone().sub(previousPosition);
      const rotation = a.camera.quaternion.clone().multiply(previousQuaternion.clone().invert());
      if (rotation.w < 0) rotation.set(-rotation.x, -rotation.y, -rotation.z, -rotation.w);
      const angle = 2 * Math.acos(THREE.MathUtils.clamp(rotation.w, -1, 1));
      const sin = Math.sqrt(Math.max(0, 1 - rotation.w * rotation.w));
      const omega = sin < 1e-10 ? [0,0,0] : [rotation.x,rotation.y,rotation.z].map(v => v / sin * angle * fps);
      const item = { fps, frame: n, seconds: n / fps, phaseBefore, phase: j.completed ? 'COMPLETE' : j.phase,
        phaseTime: j.phaseTime, timeline: j.elapsed, timeBefore, theme: a.themeManager.activeThemeName, mode: a.cameraDirector.mode,
        position: a.camera.position.toArray(), quaternion: a.camera.quaternion.toArray(), fov: a.camera.fov,
        displacement: displacement.length(), velocity: displacement.multiplyScalar(fps).toArray(), angularSpeed: angle * fps, angularVelocity: omega,
        earthRelativePosition: relative.toArray(),
        earthRelativeVelocity: previousRelative && n !== Math.round(7.5 * fps) ? relative.clone().sub(previousRelative).multiplyScalar(fps).toArray() : null,
        owner: a.cameraDirector.journey?.id ?? 'exploration', flight: Boolean(a.cameraDirector.flightSystem.flight),
        writes: [...writes], order: [...order], passes: [...passes], veil: j.atmosphere?.whiteout ?? 0,
        earth: { position: center.toArray(), scale: globe.surface.getWorldScale(new THREE.Vector3()).toArray(), visible: globe.group.visible,
          sun: globe.uniforms.sunDirection.value.toArray(), rotation: globe.surface.rotation.y, texture: globe.uniforms.dayMap.value.uuid } };
      frames.push(item);
      previousPosition.copy(a.camera.position); previousQuaternion.copy(a.camera.quaternion); previousRelative = relative;
      for (let i = 0; i < 12; i++) await Promise.resolve();
    }
    check(births === 1 && j.completed && !a.cameraDirector.flightSystem.flight, 'single activation and no destination flight');
    check(frames.every(f => f.passes.length === 2 && JSON.stringify(f.passes[0]) .replace('target','screen') === JSON.stringify(f.passes[1])), 'render passes observe identical main camera');
    if (record !== 'before') {
      for (const f of frames) {
        const positionWrites = f.writes.filter(w => w.kind === 'position');
        check(f.order.filter(v => v === 'CameraDirector.update').length === 1, 'one CameraDirector update per loop frame');
        check(positionWrites.length === 1, 'one authoritative main-camera position application per frame');
        check(f.writes.every(w => w.scope.startsWith('CameraDirector.')), 'all physical writes owned by CameraDirector');
        check(f.flight === false && f.fov === 60, 'no competing flight or projection discontinuity');
        check(f.earth.scale.every(v => Math.abs(v - 1) < 1e-12), 'Earth scale unchanged throughout');
        if (f.phase === 'BIRTH') {
          check(Math.abs(positionWrites[0].journeyClock - f.timeline) < 1e-9, 'render camera and veil use same timeline sample');
          check(f.order.indexOf('JourneyDirector.update') < f.order.indexOf('CameraDirector.update'), 'clock/callbacks before single pose application');
        }
      }
      const handoff = frames.find(f => f.theme === 'environment');
      const preceding = frames[handoff.frame - 2];
      const sourceRelative = new THREE.Vector3(...preceding.position).sub(new THREE.Vector3(...preceding.earth.position));
      check(sourceRelative.distanceTo(new THREE.Vector3(...handoff.earthRelativePosition)) < 1e-6, 'C0 Earth-relative framing preserved across masked coordinate handoff');
      check(new THREE.Quaternion(...preceding.quaternion).angleTo(new THREE.Quaternion(...handoff.quaternion)) < 1e-6, 'C0 orientation at handoff');
      const environmentFrames = frames.filter(f => f.theme === 'environment');
      check(new Set(environmentFrames.filter(f => f.veil < 1 && f.earth.visible).map(f => f.earth.texture)).size === 1, 'no unexpected baseline texture replacement in reveal');
      for (let i = 1; i < environmentFrames.length; i++) {
        const f = environmentFrames[i], previous = environmentFrames[i-1];
        check(new THREE.Vector3(...f.earth.sun).angleTo(new THREE.Vector3(...previous.earth.sun)) < 0.05, 'continuous Theme 4 lighting through render boundary');
        check(Math.abs(f.earth.rotation - previous.earth.rotation) < 0.002, 'no Earth spin reset during reveal or release');
      }
      const completed = frames.find(f => f.phase === 'COMPLETE');
      const firstBirth = frames.find(f => f.phase === 'BIRTH' && f.phaseTime > 1e-9);
      const firstNormal = frames.find(f => f.frame === completed.frame + 1);
      const dt = 1 / fps;
      check(Math.abs(completed.seconds - 10) < 1e-9, 'exact ten-second completion');
      check(completed.position.every((v,i) => Math.abs(v - [0,0,6.5][i]) < 1e-12), 'exact C0 home endpoint');
      for (const f of [firstBirth, completed, firstNormal]) {
        check(Math.hypot(...f.velocity) < 4 * dt * dt, 'endpoint finite-difference velocity converges quadratically to zero');
        check(f.angularSpeed < 4 * dt * dt, 'endpoint angular velocity converges quadratically to zero');
      }
      check(completed.quaternion.every((v,i) => Math.abs(v - [0,0,0,1][i]) < 1e-12), 'exact orientation endpoint');
      check(firstNormal.quaternion.every((v,i) => Math.abs(v - [0,0,0,1][i]) < 1e-12), 'orientation retained into exploration');
      const fullVeil = frames.filter(f => f.seconds >= 6.5 - 1e-9 && f.seconds <= 7.5 + 1e-9);
      check(fullVeil.every(f => f.veil === 1), 'one-second opaque veil preserved');
    }
    const windows = frames.filter(f => [6.5,7.5,10,11].some(t => Math.abs(f.seconds - t) <= 3 / fps + 1e-8));
    summaries.push({ fps, completion: frames.find(f => f.phase === 'COMPLETE').seconds,
      windows: windows.map(f => ({ frame:f.frame,t:f.seconds,phase:f.phase,phaseTime:f.phaseTime,timeline:f.timeline,timeBefore:f.timeBefore,
        writes:f.writes.length,order:f.order,displacement:f.displacement,speed:Math.hypot(...f.velocity),angularSpeed:f.angularSpeed,veil:f.veil,mode:f.mode })) });
    all.push({ fps, frames }); a.themeManager.activeTheme.destroy();
  }
  if (record) {
    mkdirSync('docs/traces', { recursive: true });
    writeFileSync(`docs/traces/JOURNEY-3-PASS-6B-${record}.json`, JSON.stringify({ kind:'CPU production Loop/App/CameraDirector/Renderer methods with deterministic loader and WebGL boundary stub',summaries,runs:all.map(run => ({fps:run.fps, frames:run.frames.filter(f => [6.5,7.5,10,11].some(t => Math.abs(f.seconds-t) <= 3/run.fps + 1e-8))})) },null,2)+'\n');
  }
} finally {
  globalThis.performance = originalPerformance; globalThis.requestAnimationFrame = originalRAF;
  THREE.TextureLoader.prototype.load = textureLoad;
  delete globalThis.document; delete globalThis.window; delete globalThis.localStorage;
  console.log = originalLog; console.warn = originalWarn; console.trace = originalTrace;
}
console.log(JSON.stringify(summaries.map(s => ({fps:s.fps,completion:s.completion,boundaries:s.windows.filter(f => [7.5,10].includes(f.t)).map(f=>({frame:f.frame,t:f.t,writes:f.writes,speed:f.speed,angularSpeed:f.angularSpeed}))}))));
console.log(`Frame sequence characterization: PASS (${checks} checks). CPU render boundary only; no physical/GPU claim.`);
