import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';
import { PlanetaryTheme, PLANETARY_EARTH_GATEWAY_RADIUS } from '../src/themes/PlanetaryTheme.js';
import { ThemeManager } from '../src/engine/ThemeManager.js';
import Gateway from '../src/systems/cinematic/Gateway.js';

globalThis.window = { devicePixelRatio: 1 };
// New local Earth maps need a deterministic loader in this DOM-free test.
const textureLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function(url, success) {
  success(new THREE.Texture({ width: 4096, height: 2048 }));
};
const originalLog = console.log; console.log = () => {};
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
const appSource = readFileSync('src/core/App.js', 'utf8');
function appMethod(name) {
  const start = appSource.indexOf(`\n  ${name}(`) + 1;
  const rest = appSource.slice(start);
  const next = rest.slice(1).search(/\n  [a-zA-Z]\w*\(/) + 1;
  const text = appSource.slice(start, next > 0 ? start + next : appSource.lastIndexOf('\n}'));
  return new Function('CameraMode', 'THREE', `return ({ ${text}\n }).${name};`)({ EXPLORE: 'EXPLORE' }, THREE);
}
const directorSource = readFileSync('src/systems/cinematic/JourneyDirector.js', 'utf8')
  .replace('"./Journey"', JSON.stringify(pathToFileURL(`${process.cwd()}/src/systems/cinematic/Journey.js`).href));
const { default: JourneyDirector } = await import(`data:text/javascript;base64,${Buffer.from(directorSource).toString('base64')}`);
const root = new THREE.Group(); root.position.z = -0.01;
const manager = new ThemeManager(root, null); manager.register('planetary', PlanetaryTheme); manager.activate('planetary');
let theme = manager.activeTheme;
const traveler = { position: new THREE.Vector3(10, 10, 48), mode: 'EXPLORE', isMode(mode) { return this.mode === mode; } };
const director = new JourneyDirector(traveler); director.setGateways(theme.getGateways()); theme.journeyDirector = director;
const app = { themeManager: manager, cameraDirector: traveler, journeyDirector: director,
  activeGateway: null, armedGateway: null, renderer: { renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) } } },
  acceptancePointer: new THREE.Vector2(), acceptanceRaycaster: { setFromCamera() {}, intersectObject: () => [] },
  isGUIEvent: e => Boolean(e.gui), disarmArmedInvitation() { this.armedGateway = null; },
  beginGatewayJourney() { throw new Error('Earth must not launch a journey'); }, isBoosting: true };
const callbackStart = appSource.indexOf('this.journeyDirector.onGatewayReady = ') + 'this.journeyDirector.onGatewayReady = '.length;
const callbackEnd = appSource.indexOf('\n    };', callbackStart) + 6;
director.onGatewayReady = new Function(`return ${appSource.slice(callbackStart, callbackEnd)};`).call(app);
const gateway = theme.earthGateway;
check(theme.getGateways().length === 1 && gateway.target === theme.solarSystem.earth, 'one gateway targets actual Earth mesh');
check(gateway.radius === 10 && PLANETARY_EARTH_GATEWAY_RADIUS === 10, 'central world radius');
check(gateway.journey.id === 'planetary-environment' && gateway.destinationTheme === 'environment' && !gateway.readinessOnly, 'Journey 3 destination registration');
const position = gateway.resolvePosition();
check(position.equals(theme.solarSystem.earth.getWorldPosition(new THREE.Vector3())) && position.z === -0.01, 'live position includes stage offset');
check(position === gateway.resolvePosition(), 'world-position vector reused');
const before = position.clone(); theme.update({ time: 0 }); theme.update({ time: 0.1 });
check(!before.equals(gateway.resolvePosition()), 'actual solar orbit moves gateway');
root.position.set(4, -3, 7); root.rotation.y = 0.4; root.scale.set(1.2, 0.9, 1.1);
check(gateway.resolvePosition().distanceTo(theme.solarSystem.earth.getWorldPosition(new THREE.Vector3())) < 1e-12, 'parent translation rotation scale included');
root.position.set(0, 0, -0.01); root.rotation.set(0, 0, 0); root.scale.setScalar(1);
traveler.position.copy(theme.getHomePose().position); director.update();
check(!director.gatewayReady, 'not ready at home');
for (const [distance, ready] of [[11, false], [10, true], [9, true], [11, false]]) {
  traveler.position.copy(gateway.resolvePosition()).add(new THREE.Vector3(0, distance, 0));
  director.update();
  check(director.gatewayReady === ready && (ready
    ? app.activeGateway === gateway && app.armedGateway === gateway
    : !app.activeGateway && !app.armedGateway), `distance ${distance}: READY/ARMED ${ready}`);
}
traveler.position.copy(gateway.resolvePosition()).add(new THREE.Vector3(0, 0, 9)); director.update();
check(director.gatewayReady && app.activeGateway === gateway && app.armedGateway === gateway, 'approach arms READY');
const accept = appMethod('acceptReadyProximityGateway');
const event = { button: 0 };
check(accept.call(app, event) === false && gateway.intentCount === 0 && app.isBoosting, 'LMB miss continues ordinary flight without acceptance');
check(!director.isActive() && manager.activeThemeName === 'planetary', 'no journey and no automatic transition');
for (const invalid of [{ button: 2 }, { button: 0, gui: true }]) accept.call(app, invalid);
check(gateway.intentCount === 0, 'RMB and GUI events rejected');
traveler.mode = 'RETURN'; accept.call(app, event); traveler.mode = 'EXPLORE';
check(gateway.intentCount === 0, 'no intent during Return Home');
traveler.position.add(new THREE.Vector3(0, 0, 10));
accept.call(app, event); check(gateway.intentCount === 0, 'live proximity rechecked before stale READY intent');
director.update(); check(!director.gatewayReady && !app.activeGateway && !app.armedGateway, 'moving away clears READY and Earth arm');
for (const [name, planet] of theme.solarSystem.planets) {
  if (name === 'Earth') continue;
  traveler.position.copy(planet.body.getWorldPosition(new THREE.Vector3())); director.update();
  check(!director.gatewayReady, `${name} does not activate Earth`);
}
traveler.position.copy(theme.solarSystem.moon.getWorldPosition(new THREE.Vector3())); director.update();
check(director.gatewayReady && app.activeGateway === gateway, 'Moon is inside the wider Earth zone, not a separate gateway');
for (let phase = 0; phase < 360; phase += 15) {
  theme.solarSystem.earthOrbit.rotation.y = THREE.MathUtils.degToRad(phase);
  traveler.position.copy(theme.getHomePose().position); director.update();
  check(!director.gatewayReady, 'home outside gateway throughout orbit');
  for (const [name, planet] of theme.solarSystem.planets) if (name !== 'Earth') {
    traveler.position.copy(planet.body.getWorldPosition(new THREE.Vector3())); director.update();
    const distanceToEarth = traveler.position.distanceTo(gateway.resolvePosition());
    check(director.gatewayReady === (distanceToEarth <= 10) &&
      (!director.gatewayReady || app.activeGateway === gateway),
      'nearby planets can overlap Earth zone; only Earth gateway detected');
  }
}
// Actual App frame method: update Earth first, then lookup using current traveler.
theme.solarSystem.earthOrbit.rotation.y = 0; theme.lastUpdateTime = 0;
traveler.position.copy(gateway.resolvePosition()).add(new THREE.Vector3(0, 0, -10.01));
check(!gateway.contains(traveler.position), 'before orbital step NOT READY');
const frameOrder = []; const oldThemeUpdate = theme.update.bind(theme);
theme.update = state => { frameOrder.push('theme'); oldThemeUpdate(state); };
const oldDirectorUpdate = director.update.bind(director);
director.update = () => { frameOrder.push('gateway'); oldDirectorUpdate(); };
Object.assign(app, { stats: { begin() {}, end() {} }, scroll: { updateScroll() {} }, intensity: 0,
  buildState: () => ({ time: 0.1 }), interactionManager: { update() {} }, updateCamera() {},
  exploreDirector: { update() {} }, transitSystem: { update() {} }, updateEnvironment() {},
  devHUD: { update() {} }, points: { rotation: { x: 0, y: 0 } }, wheel: { delta: 0 },
});
traveler.update = () => { frameOrder.push("camera"); }; traveler.getPosition = () => traveler.position;
appMethod('update').call(app);
check(frameOrder.join(',') === 'camera,theme,gateway' && director.gatewayReady, 'same-frame orbital motion readiness, theme updates once');
theme.updateBeforeGatewayDetection = false; frameOrder.length = 0; appMethod('update').call(app);
check(frameOrder.join(',') === 'camera,gateway,theme', 'other-theme update order preserved');
theme.updateBeforeGatewayDetection = true;
frameOrder.length = 0;
director.activeJourney = { id: 'planetary-environment', update() {} };
appMethod('update').call(app);
check(frameOrder.join(',') === 'theme,gateway,camera', 'descent updates live Earth before camera exactly once');
director.activeJourney = null;
// Existing Galaxy route is still consuming and executable, including optical hit.
const galaxyGateway = new Gateway(new THREE.Vector3(), 2.5, { hitInspectionPointer: () => false });
galaxyGateway.acceptanceMode = 'proximity-lmb'; galaxyGateway.journey = { id: 'galaxy' };
app.activeGateway = app.armedGateway = galaxyGateway; director.gatewayReady = true;
let launched = 0; app.beginGatewayJourney = () => launched++; app.resetAcceptanceClick = () => {};
check(galaxyGateway.radius === 2.5 && !accept.call(app, event) && launched === 0, 'Galaxy radius and hit gate retained');
galaxyGateway.target.hitInspectionPointer = () => true;
check(accept.call(app, event) && launched === 1 && !app.isBoosting, 'Galaxy acceptance retained');
director.setGateways(theme.getGateways()); director.gatewayReady = true;
app.activeGateway = app.armedGateway = gateway;
manager.activate('planetary');
check(!gateway.enabled && gateway.target === null && director.gateways.length === 0 && !director.gatewayReady && !app.activeGateway && !app.armedGateway, 'destroy unregisters stale Earth references');
check(manager.activeTheme.getGateways().length === 1 && manager.activeTheme.earthGateway !== gateway, 're-entry has one new gateway');
manager.activeTheme.journeyDirector = director; director.setGateways(manager.activeTheme.getGateways());
const otherGateway = new Gateway(new THREE.Vector3(), 2.5);
director.setGateways([otherGateway]); director.gatewayReady = true;
manager.activeTheme.destroy();
check(director.gateways[0] === otherGateway && director.gatewayReady, 'destroy does not unregister another theme gateways');

// The existing Journey 2 birth path must initialize the new Earth lifecycle too.
const birthManager = new ThemeManager(new THREE.Group(), null);
birthManager.register('planetary', PlanetaryTheme);
const birthDirector = new JourneyDirector(traveler); birthDirector.gatewayReady = true;
let traveledHome = false;
const birthApp = { themeManager: birthManager, journeyDirector: birthDirector, transitSystem: {},
  cameraDirector: { travel() { traveledHome = true; } }, applyActiveThemeFlight() {},
  initializeActiveTheme: appMethod('initializeActiveTheme'), renderer: { fadeIn() {} },
  activeGateway: galaxyGateway, armedGateway: galaxyGateway };
const birthStart = appSource.indexOf('this.journeyDirector.onBirth = ') + 'this.journeyDirector.onBirth = '.length;
const birthEnd = appSource.indexOf('\n    };', birthStart) + 6;
const birth = new Function(`return ${appSource.slice(birthStart, birthEnd)};`).call(birthApp);
birth('planetary');
check(traveledHome && !birthDirector.gatewayReady && !birthApp.activeGateway && !birthApp.armedGateway, 'Journey 2 entry resets stale readiness');
check(birthManager.activeTheme.journeyDirector === birthDirector && birthDirector.gateways[0] === birthManager.activeTheme.earthGateway, 'Journey 2 entry supplies Earth lifecycle reference');
birthManager.activeTheme.destroy();
check(birthDirector.gateways.length === 0, 'Earth entered through Journey 2 unregisters on destruction');

const checkpoint = '80c2757470e66a43e956178aa3629a077fb0bcdc';
const protectedPaths = ['src/systems/cinematic', 'src/systems/PlanetaryFlight.js',
  'src/themes/GalaxyTheme.js', 'src/themes/EnvironmentTheme.js',
  'src/ui/ThemeFlightControls.js', 'src/themes/BaseTheme.js', 'public/textures', 'src/graphics',
  ':(exclude)src/systems/cinematic/GalaxyJourney.js', ':(exclude)src/systems/cinematic/EarthJourney.js',
  ':(exclude)src/systems/cinematic/CameraDirector.js', ':(exclude)src/systems/cinematic/JourneyAtmosphere.js'];
check(execFileSync('git', ['diff', checkpoint, '--', ...protectedPaths], { encoding: 'utf8' }) === '', 'GREEN flight journey Theme 4 integration and assets unchanged; shared Earth/Solar visuals covered by Pass 5');
const oldPlanetary = execFileSync('git', ['show', `${checkpoint}:src/themes/PlanetaryTheme.js`], { encoding: 'utf8' });
const newPlanetary = readFileSync('src/themes/PlanetaryTheme.js', 'utf8');
for (const method of ['getHomePose', 'getCameraFar', 'getEnvironment']) {
  const get = s => s.match(new RegExp(`  ${method}\\(\\) \\{[\\s\\S]*?\\n  \\}`))[0];
  check(get(oldPlanetary) === get(newPlanetary), `${method} unchanged`);
}
check(oldPlanetary.match(/const PLANETARY_FLIGHT_GUI = [\s\S]*?\n};/)[0] === newPlanetary.match(/const PLANETARY_FLIGHT_GUI = [\s\S]*?\n};/)[0], 'Planetary F schema unchanged');
THREE.TextureLoader.prototype.load = textureLoad;
delete globalThis.window;
console.log = originalLog;
console.log(`Planetary Earth gateway characterization: PASS (${checks} checks). No physical GREEN claim.`);
