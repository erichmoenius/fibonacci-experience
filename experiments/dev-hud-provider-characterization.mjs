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
const { DevHUD } = await import(await moduleURL('src/core/DevHUD.js'));
const { PlanetaryTheme } = await import(await moduleURL('src/themes/PlanetaryTheme.js'));
const { BaseTheme } = await import(await moduleURL('src/themes/BaseTheme.js'));
const originalDocument = globalThis.document, originalPerformance = globalThis.performance;
let now = 1000, writes = 0, appended = 0, samples = 0, providerCalls = 0, checks = 0;
const check = (v, m) => { assert.ok(v, m); checks++; };
globalThis.performance = { now: () => now };
globalThis.document = { createElement() { let text = ''; return { style: {}, setAttribute() {}, get textContent() { return text; }, set textContent(v) { writes++; text = v; } }; }, body: { appendChild() { appended++; } } };
try {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 320); camera.position.set(10, 10, 48); camera.lookAt(0, 0, 0);
  const jd = { getJourney: () => null, isSlowMotionEnabled: () => false, gateways: [], gatewayReady: false };
  const app = { cameraDirector: { camera, position: camera.position, currentTarget: new THREE.Vector3(), mode: 'explore', freeFlight: { active: true } }, journeyDirector: jd,
    themeManager: {}, renderer: { renderer: { info: { render: { calls: 4, triangles: 400 }, memory: { geometries: 2, textures: 3 } } } },
    audio: { source: {}, audioContext: { state: 'running' }, getState() { samples++; throw Error('HUD must never resample audio'); } }, audioState: { bass: .2, mid: .3, high: .4, energy: .3, kick: true } };
  const hud = new DevHUD(app), text = () => hud.element.textContent;
  const theme = { getDevDiagnostics(context) {
    providerCalls++; check(Object.isFrozen(context) && Object.isFrozen(context.cameraPosition), 'provider receives a read-only context');
    return [{ title: 'Experimental detail', rows: [{ label: 'Activity', value: 'LIVE' }, { label: 'Coordinates', value: '1, 2, 3', fullOnly: true }] }];
  } };
  app.themeManager.activeTheme = theme; app.themeManager.activeThemeName = 'human'; hud.toggle();
  check(hud.mode === 'COMPACT' && appended === 1, 'one original HUD, COMPACT default');
  check(text().includes('[Experimental detail]') && text().includes('LIVE') && !text().includes('Coordinates:'), 'optional sections render without core edits, details hidden in compact');
  check(text().includes('[Audio]') && text().includes('RUNNING') && text().includes('[Performance (renderer)]'), 'existing audio and renderer telemetry exposed');
  const calls = providerCalls, stableWrites = writes; for (let frame = 0; frame < 10; frame++) { now += 16; hud.update(); }
  check(providerCalls === calls && writes === stableWrites, 'provider throttled and unchanged text never rewritten');
  hud.toggleMode(); check(hud.visible && text().includes('FULL') && text().includes('Coordinates:') && text().includes('0.200 / 0.300 / 0.400'), 'FULL expands providers, coordinates and cached audio');
  check(samples === 0, 'AudioManager getState never called by diagnostics');
  app.audio.source = null; hud.update(true); check(text().includes('Audio:        OFF') && text().includes('Bass / Mid / High: -'), 'audio OFF clears cached bands');
  for (const name of ['space', 'galaxy', 'planetary', 'environment', 'human', 'molecular', 'movies']) {
    app.themeManager.activeThemeName = name; app.themeManager.activeTheme = Object.create(BaseTheme.prototype); now++;
    hud.update(); check(text().includes(`Theme:        ${name.toUpperCase()}`) && !text().includes('Experimental detail'), 'no provider required and no old sections after switch to ' + name);
  }
  app.themeManager.activeTheme = { getDevDiagnostics() { throw Error('broken provider'); } }; hud.update();
  check(text().includes('Provider:     UNAVAILABLE'), 'provider failure isolated from main frame');
  app.themeManager.activeTheme = { getDevDiagnostics: () => [{ title: 'Valid', rows: [{ label: 'A', value: 0 }, null] }, null, { title: 'Malformed' }] }; hud.update();
  check(text().includes('[Valid]') && text().includes('A:            0') && !text().includes('Malformed'), 'zero values survive, malformed sections/rows ignored');
  // A new presentation in any theme: no Solar Waltz/app/theme-specific fields.
  const presentation = { id: 'molecular-orbit', elapsed: 1.234, duration: 8, cancelled: false, completed: false };
  app.cameraDirector.mode = 'travel'; app.cameraDirector.journey = presentation; now++; hud.update();
  check(text().includes('MOLECULAR ORBIT') && text().includes('15.4%') && text().includes('Presentation duration: 08.000'), 'generic presentation uses CameraDirector provider in any theme');
  presentation.elapsed = 2.345; now++; hud.update(); check(text().includes('29.3%') && !text().includes('Presentation time:'), 'presentation progress updates without second clock');
  presentation.cancelled = true; now++; hud.update(); check(text().includes('IDLE') && !text().includes('Presentation time'), 'cancelled generic provider has no stale times');
  // Strict read-only check: neither cached matrices nor gateway position change.
  const sun = new THREE.Mesh(new THREE.SphereGeometry(5), new THREE.ShaderMaterial({ uniforms: { uTime: { value: 3.456 } } }));
  const parent = new THREE.Group(); parent.add(sun);
  const earth = new THREE.Object3D(); earth.position.x = 22; parent.add(earth);
  const gateway = { target: earth, position: new THREE.Vector3(9, 8, 7), radius: 10, enabled: true, intentCount: 2,
    resolvePosition() { throw Error('mutating gateway lookup'); }, contains() { throw Error('mutating gateway contains'); } };
  const planet = { solarSystem: { sun }, earthGateway: gateway, getDevDiagnostics: PlanetaryTheme.prototype.getDevDiagnostics };
  const objects = [sun, earth, parent, camera];
  const snapshot = () => JSON.stringify(objects.map(o => ({ matrix: o.matrix.toArray(), world: o.matrixWorld.toArray(), inverse: o.matrixWorldInverse?.toArray(), position: o.position.toArray(), quaternion: o.quaternion.toArray(), flags: o.matrixWorldNeedsUpdate })));
  const before = snapshot(), gatewayPosition = gateway.position.toArray();
  for (const o of objects) { o.updateWorldMatrix = o.updateMatrixWorld = o.updateMatrix = () => { throw Error('diagnostic state mutation'); }; }
  sun.geometry.computeBoundingSphere = () => { throw Error('diagnostic bounds mutation'); };
  app.cameraDirector.mode = 'explore'; app.themeManager.activeThemeName = 'planetary'; app.themeManager.activeTheme = planet; jd.gateways = [gateway]; hud.update(true);
  check(text().includes('Sun:          ACTIVE / IN VIEW') && text().includes('Sun clock:    03.456'), 'Planetary provider preserves D1 Sun diagnostics');
  check(text().includes('Earth world:  22.00, 0.00, 0.00') && text().includes('REGISTERED'), 'Planetary full details read transforms without resolving gateway');
  check(snapshot() === before && sun.geometry.boundingSphere === null, 'scene/camera matrices and geometry cache untouched');
  assert.deepEqual(gateway.position.toArray(), gatewayPosition); checks++;
  hud.toggle(); const hiddenCalls = providerCalls, hiddenWrites = writes; now += 1000; hud.update(true);
  check(providerCalls === hiddenCalls && writes === hiddenWrites, 'hidden HUD performs no reads/writes');
  // Production key handler keeps D show/hide and adds Shift+D mode only.
  const source = readFileSync('src/core/App.js', 'utf8');
  const start = source.indexOf('if (e.code === "KeyD" && !e.repeat) {'), end = source.indexOf('\n        }', start) + 10;
  const key = new Function('e', source.slice(start, end));
  key.call({ devHUD: hud }, { code: 'KeyD', repeat: false, shiftKey: true }); check(!hud.visible && hud.mode === 'COMPACT', 'Shift+D changes mode without showing hidden HUD');
  key.call({ devHUD: hud }, { code: 'KeyD', repeat: false, shiftKey: false }); check(hud.visible, 'plain D still toggles visibility');
  const keyWrites = writes; key.call({ devHUD: hud }, { code: 'KeyD', repeat: true }); check(writes === keyWrites && hud.visible, 'repeated D ignored');
  sun.geometry.dispose(); sun.material.dispose();
  console.log(`DEV HUD D2 foundation: PASS (${checks} checks: optional providers, all seven themes, mode/key contract, audio reuse, presentation clocks, read-only matrices/gateways, DOM lifecycle).`);
} finally { globalThis.document = originalDocument; globalThis.performance = originalPerformance; }
