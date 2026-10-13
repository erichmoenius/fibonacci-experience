import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import * as THREE from 'three';

const cache = new Map();
async function moduleURL(path) {
  path = resolve(path);
  if (cache.has(path)) return cache.get(path);
  let source = readFileSync(path, 'utf8').replaceAll('import.meta.env.BASE_URL', '"/"').replaceAll('import.meta.env.DEV', 'true');
  for (const match of [...source.matchAll(/from\s+["']([^"']+)["']/g)]) {
    const spec = match[1];
    const url = spec.startsWith('.') ? await moduleURL(resolve(dirname(path), spec + (extname(spec) ? '' : '.js'))) : import.meta.resolve(spec);
    source = source.replace(match[0], `from ${JSON.stringify(url)}`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  cache.set(path, url); return url;
}
const { DevHUD, formatCinematicTime } = await import(await moduleURL('src/core/DevHUD.js'));
const { Journey2 } = await import(await moduleURL('src/systems/cinematic/Journey2.js'));
const { EarthJourney } = await import(await moduleURL('src/systems/cinematic/EarthJourney.js'));
const { EngineJourney } = await import(await moduleURL('src/systems/cinematic/EngineJourney.js'));
const { default: JourneyDirector } = await import(await moduleURL('src/systems/cinematic/JourneyDirector.js'));
const { PlanetaryTheme } = await import(await moduleURL('src/themes/PlanetaryTheme.js'));
const { SolarWaltz } = await import(await moduleURL('src/systems/cinematic/SolarWaltz.js'));
let checks = 0, writes = 0, now = 1000;
const check = (v, m) => { assert.ok(v, m); checks++; };
const originalDocument = globalThis.document, originalPerformance = globalThis.performance, originalLog = console.log;
const elements = [];
globalThis.performance = { now: () => now };
globalThis.document = { createElement() { let text = ''; return { style: {}, setAttribute() {}, get textContent() { return text; }, set textContent(value) { text = value; writes++; } }; }, body: { appendChild(e) { elements.push(e); } } };
console.log = () => {};
try {
  check(formatCinematicTime(0) === '00.000', 'zero seconds padded');
  check(formatCinematicTime(10.125) === '10.125', 'seconds/milliseconds timecode');
  check(formatCinematicTime(123.456) === '123.456', 'long elapsed clocks do not wrap');
  check([undefined, NaN, Infinity, -1].every(t => formatCinematicTime(t) === '--.---'), 'unavailable clocks marked honestly');
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 320); camera.position.set(10, 10, 48); camera.lookAt(0, 0, 0);
  const cd = { camera, position: camera.position, mode: 'explore', freeFlight: { active: true }, returnHome() { this.mode = 'return'; } };
  const jd = new JourneyDirector(cd);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 40), new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } } }));
  const group = new THREE.Group(); group.add(sun);
  const theme = { getDevDiagnostics: PlanetaryTheme.prototype.getDevDiagnostics, solarSystem: { sun }, getHomePose: () => ({ position: camera.position.clone() }) };
  const app = { cameraDirector: cd, journeyDirector: jd, themeManager: { activeThemeName: 'planetary', activeTheme: theme },
    renderer: { clearJourney2Dissolve() { this.journey2Dissolve = null; }, fadeIn() {} },
    stopSolarWaltz() { this.solarWaltz?.cancel(); this.solarWaltz?.dispose(); this.solarWaltz = null; }, disarmArmedInvitation() {} };
  const hud = new DevHUD(app); hud.toggleMode();
  const text = () => hud.element.textContent;
  const refresh = () => { jd.timeline.sampleJourney(jd.getJourney()); now += 1; hud.update(); };
  hud.update(); check(writes === 0, 'hidden HUD does no DOM work');
  hud.toggle();
  check(elements.length === 1 && hud.visible && text().includes('Phase:        IDLE'), 'D HUD toggles the original single element');
  check(text().includes('Sun:          ACTIVE / IN VIEW') && text().includes('T = 00:00.000 [IDLE]'), 'idle timeline, Sun camera visibility available');
  const savedWrites = writes; hud.update(true); refresh(); check(writes === savedWrites, 'forced and normal identical updates avoid DOM writes');
  const journey = new Journey2(); jd.begin(journey);
  journey.update(9.999); refresh();
  check(text().includes('Journey ID:   galaxy-planetary') && text().includes('00:09.999') && text().includes('Journey duration: 12.000'), 'authoritative timeline and scheduled total');
  check(text().includes('Phase:        VOID') && !text().includes('Phase time:'), 'phase shown without competing clock');
  journey.update(.001); app.renderer.journey2Dissolve = { journey, startTime: journey.elapsed, disposed: false }; refresh();
  check(text().includes('Phase:        BIRTH') && text().includes('00:10.000') && text().includes('BIRTH:        ACTIVE'), 'BIRTH continues the one timeline');
  check(text().includes('Composite:    J2 LIVE'), 'J2 reveal state separate from the one timeline');
  journey.update(.125); refresh(); check(text().includes('00:10.125') && text().includes('J2 LIVE'), 'millisecond timeline/reveal diagnostics agree');
  app.renderer.journey2Dissolve.disposed = true; refresh(); check(text().includes('Composite:    NONE'), 'disposed composite excluded');
  journey.elapsed = 10.125; const frozen = writes; now += 500; hud.update(); check(writes === frozen, 'unchanged clock never rewrites text after throttle expires');
  const cameraBefore = camera.position.clone(), rotationBefore = sun.rotation.clone();
  group.visible = false; now += 201; refresh(); check(text().includes('ACTIVE / HIDDEN'), 'parent visibility checked');
  group.visible = true; sun.position.z = 1000; now += 201; refresh(); check(text().includes('ACTIVE / OFFSCREEN'), 'camera frustum checked');
  sun.position.z = 0; sun.material.visible = false; now += 201; refresh(); check(text().includes('ACTIVE / HIDDEN'), 'material visibility checked');
  sun.material.visible = true; sun.layers.set(3); now += 201; refresh(); check(text().includes('ACTIVE / HIDDEN'), 'camera layer eligibility checked');
  sun.layers.set(0); refresh();
  check(camera.position.equals(cameraBefore) && sun.rotation.equals(rotationBefore), 'diagnostics never alter camera or Sun transforms');
  journey.cancel(); refresh(); check(text().includes('CANCELLED') && text().includes('BIRTH:        OFF'), 'cancelled journey retains frozen diagnostic time');
  jd.stop();
  const waltz = new SolarWaltz(sun, { position: camera.position.clone(), lookTarget: new THREE.Vector3() }, 100);
  app.solarWaltz = waltz; app.solarWaltzTheme = theme; cd.journey = waltz; cd.mode = "travel";
  journey.cancelled = false; journey.elapsed = 0; jd.timeline.start(journey); journey.elapsed = 12; jd.timeline.sampleJourney(journey); jd.timeline.continueWith(waltz);
  waltz.update(109); jd.timeline.samplePresentation(waltz); refresh();
  check(text().includes('SOLAR WALTZ') && text().includes('00:21.000') && text().includes('50.0%'), 'Waltz continues timeline at journey offset');
  check(!text().includes('Journey time:') && !text().includes('Presentation time:'), 'one cinematic timecode only');
  // Execute the production ESC handler, with only unrelated side effects stubbed.
  const appSource = readFileSync('src/core/App.js', 'utf8');
  const start = appSource.indexOf('if (e.code === "Escape" && !e.repeat) {');
  let depth = 0, end = start;
  for (let i = appSource.indexOf('{', start); i < appSource.length; i++) { if (appSource[i] === '{') depth++; if (appSource[i] === '}' && --depth === 0) { end = i + 1; break; } }
  new Function('e', appSource.slice(start, end)).call(app, { code: 'Escape', repeat: false }); refresh();
  check(text().includes('00:21.000 [CANCELLED]'), 'actual ESC handler cancels continuous timeline');
  app.solarWaltz = new SolarWaltz(sun, { position: camera.position.clone(), lookTarget: new THREE.Vector3() }, 0); app.solarWaltzTheme = theme;
  app.themeManager.activeThemeName = 'environment'; app.themeManager.activeTheme = {}; refresh();
  check(!text().includes('Presentation time:') && !text().includes('Sun:') && text().includes('Theme:        ENVIRONMENT'), 'theme change discards stale Waltz/Sun immediately');
  app.stopSolarWaltz();
  const earth = new EarthJourney(); earth.updateAtmosphere = () => {}; jd.begin(earth); earth.update(7.5); refresh();
  check(text().includes('00:07.500') && text().includes('Phase:        BIRTH') && text().includes('Journey duration: 10.000'), 'Journey 3 timeline without modifying its effects');
  app.renderer.journey3Dissolve = { disposed: false, dispose() { this.disposed = true; } }; earth.birthDissolve = app.renderer.journey3Dissolve; refresh(); check(text().includes('Composite:    J3 LIVE'), 'Journey 3 composite state exposed');
  earth.cancel(); refresh(); check(text().includes('Composite:    NONE'), 'cancel hides lingering Journey 3 composite'); jd.stop();
  const engine = new EngineJourney(); jd.begin(engine); jd.update(cd.position, .375); refresh();
  check(text().includes('00:00.375') && text().includes('Journey duration: --.---'), 'legacy timeline uses already delivered deltas');
  jd.stop(); const replay = new Journey2(); jd.begin(replay); refresh(); check(text().includes('00:00.000'), 'replay starts at zero');
  jd.toggleSlowMotion(); jd.update(cd.position, .3); refresh(); check(text().includes('00:00.100') && text().includes('JOURNEY SLOW-MO: 3x'), 'HUD follows scaled journey time and preserves slow-mo label');
  hud.toggle(); jd.update(cd.position, .75); const hiddenWrites = writes; now += 500; hud.update(); check(writes === hiddenWrites, 'hidden HUD stops writes while journey advances');
  hud.toggle(); check(text().includes('00:00.350'), 'reopening reads current authoritative time');
  jd.stop(); refresh(); check(text().includes('00:00.350 [CANCELLED]'), 'director stop cancels and freezes timeline');
  check(['Camera:', 'FreeFlight:', 'Core dist:', 'Gateway:', 'Armed:', 'JOURNEY SLOW-MO:'].every(label => text().includes(label)), 'existing HUD functions retained');
  sun.geometry.dispose(); sun.material.dispose();
  console.log = originalLog; console.log(`DEV HUD D1: PASS (${checks} checks: clocks, BIRTH/Waltz/J3, visibility, actual ESC, cancellation, theme switch, replay, slow-mo, hidden/unchanged DOM).`);
} finally {
  globalThis.document = originalDocument; globalThis.performance = originalPerformance; console.log = originalLog;
}
