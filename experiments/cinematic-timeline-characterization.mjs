import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import * as THREE from 'three';
const cache = new Map();
async function moduleURL(path) {
  path = resolve(path); if (cache.has(path)) return cache.get(path);
  let source = readFileSync(path, 'utf8').replaceAll('import.meta.env.BASE_URL', '"/"').replaceAll('import.meta.env.DEV', 'true');
  for (const match of [...source.matchAll(/from\s+["']([^"']+)["']/g)]) {
    const spec = match[1]; const url = spec.startsWith('.') ? await moduleURL(resolve(dirname(path), spec + (extname(spec) ? '' : '.js'))) : import.meta.resolve(spec);
    source = source.replace(match[0], `from ${JSON.stringify(url)}`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`; cache.set(path, url); return url;
}
const { default: JourneyDirector } = await import(await moduleURL('src/systems/cinematic/JourneyDirector.js'));
const { Journey2 } = await import(await moduleURL('src/systems/cinematic/Journey2.js'));
const { EngineJourney } = await import(await moduleURL('src/systems/cinematic/EngineJourney.js'));
const { EarthJourney } = await import(await moduleURL('src/systems/cinematic/EarthJourney.js'));
const { Journey } = await import(await moduleURL('src/systems/cinematic/Journey.js'));
const { SolarWaltz } = await import(await moduleURL('src/systems/cinematic/SolarWaltz.js'));
const { CinematicTimeline, formatTimelineTime } = await import(await moduleURL('src/systems/cinematic/CinematicTimeline.js'));
const { cinematicSection } = await import(await moduleURL('src/core/DevHUDTelemetry.js'));
const source = readFileSync('src/core/App.js', 'utf8');
function method(name) {
  const start = source.indexOf('\n  ' + name + '(') + 1, tail = source.slice(start);
  const next = tail.slice(1).search(/\n  [a-zA-Z]\w*\(/) + 1;
  return new Function('THREE', 'SolarWaltz', 'return ({' + source.slice(start, start + next) + '}).' + name)(THREE, SolarWaltz);
}
function callback(app, name) {
  const marker = 'this.journeyDirector.' + name + ' = ', start = source.indexOf(marker) + marker.length, end = source.indexOf('\n    };', start) + 6;
  return new Function('return ' + source.slice(start, end) + ';').call(app);
}
let checks = 0; const check = (v, m) => { assert.ok(v, m); checks++; };
const close = (a, b, message) => check(Math.abs(a - b) < 1e-8, message);
const originalLog = console.log; console.log = () => {};
try {
  check(formatTimelineTime(0) === '00:00.000', 'acceptance time zero');
  check(formatTimelineTime(59.9996) === '01:00.000', 'millisecond rounding carries through minute');
  check(formatTimelineTime(6000.125) === '100:00.125', 'long timelines never wrap');
  const originClock = new CinematicTimeline(), reusedClock = { id: 'reused', elapsed: 40, phase: 'START' };
  originClock.start(reusedClock); reusedClock.elapsed = 40.375; originClock.sampleJourney(reusedClock);
  close(originClock.elapsed, .375, 'acceptance origin stays zero even for a reused nonzero source clock');
  for (const fps of [30, 60, 120]) {
    const camera = new THREE.PerspectiveCamera(); camera.position.set(10, 10, 48); camera.lookAt(0, 0, 0);
    const sun = new THREE.Object3D(), theme = { solarSystem: { sun }, getHomePose: () => ({ position: camera.position.clone() }) };
    const cd = { camera, position: camera.position, currentTarget: new THREE.Vector3(), mode: 'explore',
      beginJourney(j) { this.journey = j; this.mode = 'travel'; }, finishTravel() { this.journey = null; this.mode = 'explore'; }, update() {}, returnHome() { this.mode = 'return'; } };
    const jd = new JourneyDirector(cd);
    const app = { time: 0, cameraDirector: cd, journeyDirector: jd, themeManager: { activeTheme: theme, activeThemeName: 'planetary' },
      renderer: { clearJourney2Dissolve() {}, fadeIn() {} }, resetAcceptanceClick() {}, disarmArmedInvitation() {} };
    for (const name of ['beginGatewayJourney', 'startSolarWaltz', 'updateSolarWaltz', 'stopSolarWaltz']) app[name] = method(name);
    let birth = null, arrival = null;
    jd.onBirth = () => { birth = jd.timeline.elapsed; };
    jd.onJourneyFinished = () => { arrival = jd.timeline.elapsed; callback(app, 'onJourneyFinished')(); };
    const j = new Journey2(); app.beginGatewayJourney({ journey: j, target: sun });
    check(jd.timeline.elapsed === 0 && jd.timeline.state === 'RUNNING', 'production acceptance resets timeline synchronously');
    let previous = 0;
    for (let frame = 1; frame <= fps * 30; frame++) {
      app.time = frame / fps;
      app.updateSolarWaltz();
      jd.timeline.samplePresentation(cd.journey);
      if (app.solarWaltz?.completed) app.stopSolarWaltz();
      jd.update(cd.position, 1 / fps);
      check(jd.timeline.elapsed + 1e-8 >= previous, 'one monotonic timeline through all phases and presentation');
      previous = jd.timeline.elapsed;
      if (frame === 12 * fps) close(jd.timeline.elapsed, 12, 'Waltz starts without time reset');
    }
    close(birth, 10, 'BIRTH exact timeline visible inside production callback');
    close(arrival, 12, 'completion callback exact timeline');
    close(jd.timeline.elapsed, 30, '18-second Waltz finishes at T=30');
    check(jd.timeline.state === 'COMPLETE' && !jd.timeline.segment && !app.solarWaltz, 'final time retained, provider references released');
    jd.update(cd.position, 5); jd.timeline.samplePresentation(null); close(jd.timeline.elapsed, 30, 'idle frames cannot advance completed timeline');
    check(cinematicSection(app, false).timecode.includes('00:30.000 [COMPLETE]'), 'compact HUD retains final timecode');
    // New accepted journey resets; the production ESC handler cancels it.
    app.beginGatewayJourney({ journey: new Journey2(), target: sun }); close(jd.timeline.elapsed, 0, 'new acceptance resets completed timeline');
    jd.update(cd.position, .25);
    const escStart = source.indexOf('if (e.code === "Escape" && !e.repeat) {'); let depth = 0, escEnd = escStart;
    for (let i = source.indexOf('{', escStart); i < source.length; i++) { if (source[i] === '{') depth++; if (source[i] === '}' && --depth === 0) { escEnd = i + 1; break; } }
    new Function('e', source.slice(escStart, escEnd)).call(app, { code: 'Escape', repeat: false });
    check(jd.timeline.state === 'CANCELLED' && !jd.timeline.segment, 'production ESC cancels timeline');
    close(jd.timeline.elapsed, .25, 'cancel retains exact diagnostic point');
  }
  // Unrelated journey/presentation: no Planetary identity or Solar Waltz needed.
  class OtherJourney extends Journey { constructor() { super('other'); this.phase = 'START'; this.elapsed = 0; } start() { this.elapsed = 0; } update(dt) { this.elapsed += dt; this.phase = 'BIRTH'; if (this.elapsed >= 2) { this.complete(); this.emit('complete'); } } }
  const cd = { position: new THREE.Vector3(), journey: null, mode: 'travel' }, jd = new JourneyDirector(cd);
  const presentation = { id: 'human-presentation', elapsed: 0, completed: false };
  jd.onJourneyFinished = () => { cd.journey = presentation; };
  jd.begin(new OtherJourney()); jd.update(cd.position, 2);
  presentation.elapsed = 3.456; jd.timeline.samplePresentation(presentation);
  close(jd.timeline.elapsed, 5.456, 'arbitrary journey/presentation continuation');
  const telemetry = cinematicSection({ journeyDirector: jd, cameraDirector: cd, renderer: {} }, true);
  check(telemetry.timecode.includes('00:05.456') && !telemetry.rows.some(r => /^(Journey time|Phase time|Presentation time)$/.test(r.label)), 'one universal clock, no competing elapsed rows');
  presentation.completed = true; cd.journey = null; jd.timeline.samplePresentation(null); close(jd.timeline.elapsed, 5.456, 'generic final time retained after camera releases provider');
  check(jd.timeline.state === 'COMPLETE', 'released completed presentation finishes rather than cancels');
  jd.begin(new EngineJourney()); jd.update(cd.position, .75); close(jd.timeline.elapsed, .75, 'legacy journey uses existing delivered delta');
  jd.toggleSlowMotion(); jd.update(cd.position, .3); close(jd.timeline.elapsed, .85, 'legacy slow motion follows director scaling'); jd.stop();
  const earth = new EarthJourney(); earth.updateAtmosphere = () => {}; jd.toggleSlowMotion(); jd.begin(earth); jd.update(cd.position, 7.5);
  close(jd.timeline.elapsed, 7.5, 'Journey 3 handoff clock');
  earth.arrived = true; earth.arrivalReady = false; jd.update(cd.position, 1);
  close(jd.timeline.elapsed, 7.5, 'authoritative readiness hold freezes timeline'); jd.stop();
  console.log = originalLog; console.log(`Universal cinematic timeline: PASS (${checks} checks: production acceptance/completion/ESC, 30/60/120 FPS, T=10/12/30, generic providers, legacy clock, slow-mo, readiness hold, final retention).`);
} finally { console.log = originalLog; }
