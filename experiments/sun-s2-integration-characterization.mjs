import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, extname } from 'node:path';
import * as THREE from 'three';
import { SolarSystem } from '../src/systems/SolarSystem.js';
import { SolarWaltz } from '../src/systems/cinematic/SolarWaltz.js';
import { Journey2BirthComposite } from '../src/systems/transit/Journey2BirthComposite.js';

// Same isolated Vite-module loader as the existing Journey 2/Waltz checks.
const cache = new Map();
async function moduleURL(path) {
  path = resolve(path);
  if (cache.has(path)) return cache.get(path);
  let source = readFileSync(path, 'utf8').replaceAll('import.meta.env.BASE_URL', '"/"').replaceAll('import.meta.env.DEV', 'false');
  for (const match of [...source.matchAll(/from\s+["']([^"']+)["']/g)]) {
    const spec = match[1];
    const url = spec.startsWith('.') ? await moduleURL(resolve(dirname(path), spec + (extname(spec) ? '' : '.js'))) : import.meta.resolve(spec);
    source = source.replace(match[0], `from ${JSON.stringify(url)}`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  cache.set(path, url); return url;
}
const { default: CameraDirector } = await import(await moduleURL('src/systems/cinematic/CameraDirector.js'));
const { default: JourneyDirector } = await import(await moduleURL('src/systems/cinematic/JourneyDirector.js'));
const { Journey2 } = await import(await moduleURL('src/systems/cinematic/Journey2.js'));
const appSource = readFileSync('src/core/App.js', 'utf8');
const planetarySource = readFileSync('src/themes/PlanetaryTheme.js', 'utf8');
function callback(app, name) {
  const marker = 'this.journeyDirector.' + name + ' = ';
  const start = appSource.indexOf(marker) + marker.length, end = appSource.indexOf('\n    };', start) + 6;
  return new Function('return ' + appSource.slice(start, end) + ';').call(app);
}
function method(name) {
  const start = appSource.indexOf('\n  ' + name + '(') + 1, tail = appSource.slice(start);
  const next = tail.slice(1).search(/\n  [a-zA-Z]\w*\(/) + 1;
  return new Function('THREE', 'SolarWaltz', 'return ({' + appSource.slice(start, start + next) + '}).' + name)(THREE, SolarWaltz);
}
const themeUpdate = new Function('return ({' + planetarySource.slice(planetarySource.indexOf('  update(state)'), planetarySource.indexOf('  getEnvironment()')) + '}).update')();
// Execute the production App frame ordering, including the BIRTH theme swap.
const frame = new Function('state', appSource.slice(appSource.indexOf('    const activeJourney = this.journeyDirector.getJourney?.();', appSource.indexOf('const state = this.buildState()')), appSource.indexOf('    this.themeManager.activeTheme?.updateFlightGUI();')));
const surface = { addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) };
globalThis.window = { ...surface, innerWidth: 1000, innerHeight: 1000 };
globalThis.document = { ...surface };
const originalLoad = THREE.TextureLoader.prototype.load, originalLog = console.log, originalWarn = console.warn, originalTrace = console.trace;
THREE.TextureLoader.prototype.load = function (_url, ready) { const t = new THREE.Texture({ width: 1, height: 1 }); ready(t); return t; };
console.log = console.warn = console.trace = () => {};
let checks = 0; const check = (v, m) => { assert.ok(v, m); checks++; };
const results = [];
try {
  for (const fps of [30, 60, 120]) {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 320);
    scene.add(camera);
    const cd = new CameraDirector(camera, surface), jd = new JourneyDirector(cd);
    cd.returnHome({ position: new THREE.Vector3(0, 0, 10), lookTarget: new THREE.Vector3() }, true);
    const galaxy = { update() {} };
    let system, boundSun, births = 0, copies = 0;
    const gpu = { autoClear: true, getDrawingBufferSize: v => v.set(640, 360), copyFramebufferToTexture() { copies++; }, render() {} };
    const app = { time: 0, cameraDirector: cd, journeyDirector: jd, exploreDirector: { update() {} },
      transitSystem: { start() {}, stop() {}, update() {} }, applyActiveThemeFlight() {}, initializeActiveTheme() {},
      resetAcceptanceClick() {}, disarmArmedInvitation() {}, updateEnvironment() {},
      renderer: { captureJourney2Dissolve(j) { this.journey2Dissolve = new Journey2BirthComposite(gpu, j); }, clearJourney2Dissolve() { this.journey2Dissolve?.dispose(); this.journey2Dissolve = null; } },
      themeManager: { activeTheme: galaxy, themes: new Map([['planetary', true]]),
        activate(name) {
          births++; system = new SolarSystem(scene);
          this.activeThemeName = name;
          this.activeTheme = { solarSystem: system, updateBeforeGatewayDetection: true, lastUpdateTime: null, update: themeUpdate,
            getHomePose: () => ({ position: new THREE.Vector3(10, 10, 48), lookTarget: new THREE.Vector3(10, 0, 0) }), getGateways: () => [] };
        }, update(state) { this.activeTheme.update(state); } } };
    for (const name of ['startSolarWaltz', 'updateSolarWaltz', 'stopSolarWaltz']) app[name] = method(name);
    for (const name of ['onApproach', 'onHorizon', 'onSingularity', 'onTransit', 'onVoidStart', 'onBirth', 'onTransitEnd', 'onJourneyFinished']) jd[name] = callback(app, name);
    const target = new THREE.Object3D(); scene.add(target);
    const journey = new Journey2(); cd.beginJourney(journey); jd.begin(journey, target, { target, direction: new THREE.Vector3(0, 0, 1), endpointDistance: .75 }, 'planetary');
    journey.getFrameDelta(0);
    let birthTime = null, waltzTime = null, exploreTime = null, lastClock = null, minDiameter = Infinity;
    for (let n = 1; n <= 32 * fps; n++) {
      app.time = n / fps; frame.call(app, { time: app.time });
      if (!system) continue;
      const sun = system.sun, clock = sun.material.uniforms.uTime.value;
      if (!boundSun) boundSun = sun;
      check(sun === boundSun, 'one live Sun across BIRTH/Waltz/exploration');
      if (lastClock !== null) check(Math.abs(clock - lastClock - 1 / fps) < 1e-8, 'surface advances once per real App frame');
      lastClock = clock;
      if (app.renderer.journey2Dissolve) {
        check(app.renderer.journey2Dissolve.sun === sun, 'BIRTH composite bound to the current Sun');
        app.renderer.journey2Dissolve.render(camera);
        birthTime = clock;
        if (app.renderer.journey2Dissolve.disposed) app.renderer.journey2Dissolve = null;
      }
      if (app.solarWaltz) {
        check(app.solarWaltz.sun === sun, 'Waltz bound to the same live Sun'); waltzTime = clock;
        const pose = app.solarWaltz.pose;
        const distance = pose.position.distanceTo(sun.getWorldPosition(new THREE.Vector3()));
        minDiameter = Math.min(minDiameter, 360 * 5 / Math.sqrt(distance * distance - 25) / Math.tan(Math.PI / 6));
      } else if (app.time > 30) exploreTime = clock;
    }
    check(births === 1 && journey.completed && Math.abs(journey.elapsed - 12) < 1e-8, 'Journey 2 stays 12 seconds with one handoff');
    check(birthTime > 1.4 && waltzTime > 19.9 && exploreTime > 21.9, 'clock progresses through all three phases');
    check(copies > fps, 'BIRTH framebuffer repeatedly refreshed, never a frozen Sun snapshot');
    check(!app.solarWaltz && !app.renderer.journey2Dissolve, 'Waltz and reveal cleanly finish');
    results.push({ fps, birthTime, waltzTime, exploreTime, minSunDiameterAt360p: minDiameter });
    system.dispose();
  }
  // Approved HUD files may differ. Mixed runtime files are checked separately
  // after stripping only the exact diagnostic additions, preserving their full
  // checkpoint comparisons rather than exempting camera/journey/flight logic.
  const diagnosticFiles = [
    'src/core/DevHUD.js', 'src/core/DevHUDTelemetry.js',
    'src/systems/cinematic/CinematicTimeline.js',
    'src/core/App.js', 'src/systems/cinematic/JourneyDirector.js',
    'src/themes/BaseTheme.js', 'src/themes/PlanetaryTheme.js',
  ];
  const stripDiagnostics = (path, source) => {
    if (path === 'src/core/App.js') return source
      .replace('          if (e.shiftKey) this.devHUD.toggleMode();\n          else this.devHUD.toggle();', '          this.devHUD.toggle();')
      .replace('    this.audioState = audio; // Reuse the existing sample for read-only diagnostics.\n', '')
      .replace('    this.journeyDirector.timeline?.samplePresentation(this.cameraDirector.journey);\n', '');
    if (path === 'src/systems/cinematic/JourneyDirector.js') return source
      .replace('import { CinematicTimeline } from "./CinematicTimeline.js";\n', '')
      .replace('    this.timeline = new CinematicTimeline();\n', '')
      .replace('      this.timeline.sampleJourney(this.activeJourney);\n', '')
      .replace('        this.timeline.continueWith(this.cameraDirector.journey);\n', '')
      .replace('    this.timeline.start(this.activeJourney);\n', '')
      .replace('    this.timeline.cancel();\n', '')
      .replace('    const journey = this.activeJourney;\n    const scaledDelta = this.getScaledDelta(delta);\n    this.timeline.advanceLegacy(journey, scaledDelta);\n    journey.update(scaledDelta);\n    this.timeline.sampleJourney(journey);',
        '    this.activeJourney.update(this.getScaledDelta(delta));');
    if (path === 'src/themes/BaseTheme.js') return source.replace(/  \/\/ Optional synchronous, read-only HUD provider\.[\s\S]*?  getDevDiagnostics\(_context\) \{ return \[\]; \}\n\n/, '');
    if (path === 'src/themes/PlanetaryTheme.js') return source.replace(/^  getDevDiagnostics\(context\) \{[\s\S]*?^  \}\n\n/m, '');
    return source;
  };
  for (const path of diagnosticFiles.slice(3)) {
    const current = readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
    const protectedSource = execFileSync('git', ['show', `eab53517740c8512392a04a632b42aedc284e16c:${path}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
    check(stripDiagnostics(path, current) === protectedSource, `${path}: all non-diagnostic behavior exactly matches checkpoint`);
  }
  const protectedDiff = execFileSync('git', ['diff', 'eab53517740c8512392a04a632b42aedc284e16c', '--', 'src', 'public', ':(exclude)src/systems/SolarSystem.js', ':(exclude)src/systems/SunSurface.js', ...diagnosticFiles.map(path => ':(exclude)' + path)], { encoding: 'utf8' });
  check(protectedDiff === '', 'all other non-Sun/non-diagnostic runtime files exactly match checkpoint');
  const renderSource = readFileSync('src/graphics/Renderer.js', 'utf8').slice(readFileSync('src/graphics/Renderer.js', 'utf8').lastIndexOf('  render()'));
  check(renderSource.indexOf('this.renderScene();', renderSource.indexOf('setRenderTarget(null)')) < renderSource.indexOf('this.journey2Dissolve?.render(this.camera)'), 'composite captures the live destination after scene render');
  console.log = originalLog;
  console.log(JSON.stringify({ checks, results }));
  console.log('Sun S2 integration: PASS (production callbacks/frame order, live Sun identity, continuous clocks, reveal refresh, protected runtime).');
} finally {
  THREE.TextureLoader.prototype.load = originalLoad; console.log = originalLog; console.warn = originalWarn; console.trace = originalTrace;
  delete globalThis.window; delete globalThis.document;
}
