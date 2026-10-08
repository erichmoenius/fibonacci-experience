import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { GUI, Controller } from 'lil-gui';
import { BaseTheme } from '../src/themes/BaseTheme.js';
import { ThemeFlightControls } from '../src/ui/ThemeFlightControls.js';

const originalLog = console.log; console.log = () => {};
const source = readFileSync('src/core/App.js', 'utf8');
// Evaluate the actual App methods without constructing the renderer or opening
// a browser. Method boundaries are next class members, not copied logic.
function method(name) {
  const start = source.indexOf(`\n  ${name}(`) + 1;
  assert.ok(start > 0, `missing ${name}`);
  const rest = source.slice(start);
  const next = rest.slice(1).search(/\n  [a-zA-Z]\w*\(/) + 1;
  const text = rest.slice(0, next < 1 ? undefined : next).trim()
    .replaceAll('import.meta.env.DEV', 'false');
  return new Function('SPACE_PLASMA_GUI_BASELINE', `return ({ ${text}\n }).${name};`)('blob-pass-2');
}
const restore = method('restoreSavedSettingsAfterReturn');
const setup = method('setupThemeSwitching');
const loadG = method('loadGUISettings');
let checks = 0;
function check(condition, message) { assert.ok(condition, message); checks++; }
const storage = new Map(); const reads = []; let writes = 0;
globalThis.localStorage = {
  getItem(key) { reads.push(key); return storage.get(key) ?? null; },
  setItem(key, value) { writes++; storage.set(key, value); },
};
let keydown;
globalThis.window = { addEventListener(type, callback) { assert.equal(type, 'keydown'); keydown = callback; } };
function controller(object, property, name, onChange = () => {}) {
  const c = Object.create(Controller.prototype);
  Object.assign(c, { object, property, _name: name, displays: 0,
    _callOnChange() { onChange(this.getValue()); }, _callOnFinishChange() {},
    updateDisplay() { this.displays++; this.displayed = this.getValue(); return this; } });
  return c;
}
function makeApp(name) {
  const themeNames = { space: 'Space', galaxy: 'Galaxy', planetary: 'Planetary', environment: 'Environment',
    human: 'Human', molecular: 'Molecular', movies: 'Movies' };
  const themeSource = readFileSync(`src/themes/${themeNames[name]}Theme.js`, 'utf8');
  const config = new Function(`return (${themeSource.match(/const \w+_FLIGHT_GUI = (\{[\s\S]*?\n\});/)[1]});`)();
  const theme = new BaseTheme(null, null);
  theme.flight = Object.fromEntries(config.controls.map(([key, , min, max]) => [key, (min + max) / 2]));
  theme.flightControls = new ThemeFlightControls(theme, config, {});
  const fControllers = config.controls.map(([key]) => controller(theme.flightControls.settings, key, key));
  theme.flightControls.gui = { controllersRecursive: () => fControllers };
  const look = { scale: 1 }; const applied = { scale: 1 };
  const gController = controller(look, 'scale', 'Veil scale', value => { applied.scale = value; });
  const folder = Object.create(GUI.prototype);
  Object.assign(folder, { _title: 'Theme LOOK', controllers: [gController], folders: [] });
  const gui = Object.create(GUI.prototype);
  Object.assign(gui, { controllers: [], folders: [folder], controllersRecursive: () => [gController] });
  const calls = []; let journeyActive = true;
  theme.getHomePose = () => { calls.push('homePose'); return { theme: name }; };
  theme.resetInspection = () => calls.push('inspection');
  const app = { themeManager: { activeTheme: theme, activeThemeName: name }, gui,
    cameraDirector: { mode: 'TRAVEL', returnHome(pose) { calls.push('returnHome'); assert.equal(pose.theme, name); } },
    journeyDirector: { isActive: () => journeyActive, stop() { calls.push('cancelJourney'); journeyActive = false; } },
    disarmArmedInvitation() { calls.push('disarm'); }, showNotification() {},
    loadGUISettings: loadG, restoreSavedSettingsAfterReturn: restore };
  setup.call(app);
  return { app, theme, fControllers, gController, look, applied, calls, config,
    press(target = null, repeat = false) { keydown({ code: 'Escape', repeat, target }); },
    finish() { app.restoreSavedSettingsAfterReturn(); } };
}
const names = ['space', 'galaxy', 'planetary', 'environment', 'human', 'molecular', 'movies'];
for (const name of names) {
  for (const savedF of [false, true]) for (const savedG of [false, true]) {
    storage.clear(); reads.length = 0; writes = 0;
    const f = makeApp(name);
    const key = f.config.storageKey;
    check(key === `fibonacci-flight-v1-${name}`, `${name} independent F key`);
    const savedValues = Object.fromEntries(f.config.controls.map(([k, , min, max]) => [k, min + (max - min) * 0.25]));
    if (name === 'galaxy') savedValues.rmbMaxSpeed = 6;
    if (savedF) storage.set(key, JSON.stringify({ version: 1, settings: savedValues }));
    if (savedG) storage.set(`hero-core-gui-${name}`, JSON.stringify({ folders: {
      'Theme LOOK': { controllers: { 'Veil scale': 2.5 } } }, plasmaBaselineVersion: 'blob-pass-2' }));
    storage.set('unrelated-theme', 'protected');
    const storedBefore = JSON.stringify([...storage]);
    const unsavedValues = Object.fromEntries(f.config.controls.map(([k, , min, max]) => [k, min + (max - min) * 0.75]));
    if (name === 'galaxy') unsavedValues.rmbMaxSpeed = 10;
    f.theme.applyFlightSettings(unsavedValues); f.look.scale = f.applied.scale = 3.5;
    reads.length = 0;
    f.press();
    check(f.calls.join(',') === 'homePose,inspection,returnHome,cancelJourney,disarm', `${name} cancellation order`);
    check(reads.length === 0 && f.theme.flight.rmbMaxSpeed === unsavedValues.rmbMaxSpeed && f.look.scale === 3.5,
      `${name} no restoration midway through return`);
    f.press(null, true); check(f.calls.length === 5, `${name} repeat ignored`);
    f.finish();
    const expected = savedF ? savedValues : unsavedValues;
    check(f.config.controls.every(([k]) => f.theme.flight[k] === expected[k]), `${name} F runtime restored independently`);
    check(f.fControllers.every(c => c.displayed === expected[c.property]), `${name} F controls synchronized`);
    check(f.look.scale === (savedG ? 2.5 : 3.5) && f.applied.scale === f.look.scale, `${name} G runtime restored independently`);
    check(!savedG || f.gController.displayed === 2.5, `${name} G display refreshed`);
    check(writes === 0 && JSON.stringify([...storage]) === storedBefore, `${name} presets unchanged, no writes`);
    check(reads.join(',') === `${key},hero-core-gui-${name}`, `${name} only active category keys read once`);
    check(f.app.pendingSavedReturnTheme === null, `${name} ESC request consumed`);
  }
}
storage.clear(); const switching = makeApp('galaxy'); switching.press();
const replacement = makeApp('human');
switching.app.themeManager = replacement.app.themeManager; switching.app.gui = replacement.app.gui;
reads.length = 0; switching.finish();
check(reads.join(',') === 'hero-core-gui-human', 'stale ESC request never restores F of old/new theme');
storage.clear(); const normal = makeApp('planetary'); reads.length = 0; normal.finish();
check(reads.join(',') === 'hero-core-gui-planetary', 'non-ESC Return Home retains existing G-only behavior');
for (const broken of ['F', 'G', 'both']) {
  storage.clear(); const f = makeApp('galaxy');
  storage.set(f.config.storageKey, broken === 'G' ? JSON.stringify({ version: 1, settings: { rmbMaxSpeed: 6 } }) : '{bad');
  storage.set('hero-core-gui-galaxy', broken === 'F' ? JSON.stringify({ folders: { 'Theme LOOK': { controllers: { 'Veil scale': 2.5 } } } }) : '{bad');
  f.theme.applyFlightSettings({ rmbMaxSpeed: 10 }); f.look.scale = 3.5;
  const originalWarn = console.warn; const originalError = console.error;
  console.warn = console.error = () => {};
  f.press(); f.finish(); console.warn = originalWarn; console.error = originalError;
  check(f.theme.flight.rmbMaxSpeed === (broken === 'G' ? 6 : 10) && f.look.scale === (broken === 'F' ? 2.5 : 3.5), 'corrupt categories isolated');
}
storage.clear(); const denied = makeApp('movies'); const getItem = localStorage.getItem;
localStorage.getItem = () => { throw new Error('storage unavailable'); };
const originalWarn = console.warn; const originalError = console.error; console.warn = console.error = () => {};
denied.press(); denied.finish(); console.warn = originalWarn; console.error = originalError; localStorage.getItem = getItem;
check(denied.app.pendingSavedReturnTheme === null, 'unavailable storage does not break completion');
storage.clear(); const editing = makeApp('environment'); editing.press({ closest: () => ({ tagName: 'INPUT' }) });
check(editing.calls.includes('returnHome'), 'ESC in inputs retains existing routing');
check(source.includes('this.cameraDirector.onReturnHome = () => {\n      this.restoreSavedSettingsAfterReturn();'), 'completion callback connected');
delete globalThis.window; delete globalThis.localStorage;
console.log = originalLog;
console.log(`Universal ESC characterization: PASS (${checks} checks across seven themes). No browser or physical GREEN claim.`);
