import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { EarthJourney, descentEase } from '../src/systems/cinematic/EarthJourney.js';
import { JourneyAtmosphere } from '../src/systems/cinematic/JourneyAtmosphere.js';

let checks = 0; const check = (value, message) => { assert.ok(value, message); checks++; };
const originalLog = console.log; console.log = () => {};
function element() {
  return { style: { background: 'black', transition: 'opacity 1s linear', opacity: '0' }, children: [],
    appendChild(child) { this.children.push(child); child.parent = this; },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); } };
}
globalThis.document = { createElement: element };
function fixture(scale = [1, 1, 1], close = false) {
  const root = new THREE.Group(); root.position.set(2, -3, -0.01); root.scale.set(...scale); root.rotation.y = 0.2;
  const orbit = new THREE.Group(); root.add(orbit);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(2, 64, 40)); earth.position.x = 22; orbit.add(earth);
  const center = earth.getWorldPosition(new THREE.Vector3());
  const near = 0.1; const maxScale = Math.max(...scale); const distance = close ? 2 * maxScale + 0.2 : 10 * maxScale;
  const director = { camera: { near }, position: center.clone().add(new THREE.Vector3(0, 0, distance)), currentTarget: center.clone() };
  const overlay = element(); const journey = new EarthJourney(); journey.prepareDescent(director, earth, overlay); journey.start();
  return { root, orbit, earth, director, overlay, journey };
}
check(descentEase(2, 16, 2) === 0 && descentEase(2, 16, 16) === 1, 'path endpoints');
const overlay = element(); const layer = new JourneyAtmosphere(overlay);
check(overlay.children.length === 3 && overlay.style.background === 'transparent', 'three lightweight borrowed-curtain layers');
layer.update({ haze: 0.2, clouds: 0.3, whiteout: 0.4, time: 5 });
check(layer.layers[0].style.opacity === '0.2' && layer.layers[2].style.opacity === '0.4', 'progressive opacity output');
layer.obscure(); check(layer.whiteout === 1 && layer.layers[2].style.opacity === '1', 'opaque whiteout masks handoff');
layer.clear(); layer.clear();
check(overlay.children.length === 0 && overlay.style.background === 'black' && overlay.style.opacity === '0'
  && overlay.style.transition === 'opacity 1s linear', 'idempotent complete curtain restoration');

for (const scale of [[1, 1, 1], [1.4, 0.9, 1.2]]) for (const close of [false, true]) {
  const f = fixture(scale, close); const j = f.journey;
  check(Math.abs(j.solidRadius - 2 * Math.max(...scale)) < 1e-6, 'radius from geometry and conservative world scale');
  check(j.getAtmosphericPose().position.equals(f.director.position), 'START matches captured camera position');
  const pose = j.getAtmosphericPose(); const position = pose.position;
  let previousPosition = position.clone(), previousHaze = 0, previousWhite = 0, previousDistance = Infinity;
  const phases = [];
  j.onEvent = event => phases.push(event);
  for (let frame = 0; frame < 1800 && j.phase !== 'BIRTH'; frame++) {
    f.orbit.rotation.y += 0.00026;
    j.update(0.01);
    const current = j.getAtmosphericPose(); const center = f.earth.getWorldPosition(new THREE.Vector3());
    check(current === pose && current.position === position, 'pose/vector reused without frame allocations');
    const distance = current.position.distanceTo(center);
    check(distance > j.solidRadius, 'camera remains outside rendered solid Earth');
    check(Math.abs(j.center.distanceTo(center)) < 1e-10, 'camera tracks current orbital/parent world transform');
    check(current.position.distanceTo(previousPosition) < 0.08 * Math.max(...scale), 'bounded continuous movement at phase boundaries');
    check(distance <= previousDistance + 1e-8, 'one continuous radial descent, no phase reset');
    check(j.atmosphericState.haze >= previousHaze - 1e-10 && j.atmosphericState.whiteout >= previousWhite - 1e-10, 'progressive haze/whiteout');
    previousPosition.copy(current.position); previousDistance = distance;
    previousHaze = j.atmosphericState.haze; previousWhite = j.atmosphericState.whiteout;
  }
  check(phases.join(',') === 'approach,horizon,singularity,wormhole,void,birth', 'phase IDs and order retained');
  check(j.atmosphere.whiteout === 1, 'BIRTH entered under opaque atmospheric whiteout');
  check(Math.abs(j.getAtmosphericPose().lookTarget.distanceTo(j.center) - j.solidRadius) < 1e-8,
    'immersion focuses on the measured visible limb');
  const arrival = { position: new THREE.Vector3(0, 0, 6.5), lookTarget: new THREE.Vector3() };
  j.setArrivalPose(arrival);
  check(j.target === null && j.getAtmosphericPose().position.equals(arrival.position), 'source released and home fixed before reveal');
  let previousReveal = 1;
  for (let frame = 0; frame < 310 && !j.completed; frame++) {
    j.update(0.01);
    if (!j.completed) {
      check(j.atmosphericState.reveal <= previousReveal + 1e-10, 'gentle monotonic destination reveal');
      check(j.getAtmosphericPose().position.equals(arrival.position), 'reveal never shows en-route destination camera');
      previousReveal = j.atmosphericState.reveal;
    }
  }
  check(j.completed && j.atmosphere.cleared && f.overlay.children.length === 0 && j.getAtmosphericPose() === null, 'complete clears effects and pose ownership');
  f.earth.geometry.dispose();
}
for (const targetPhase of ['APPROACH', 'HORIZON', 'WORMHOLE', 'VOID', 'BIRTH']) {
  const f = fixture(); while (f.journey.phase !== targetPhase) f.journey.update(0.01);
  f.journey.cancel(); const phase = f.journey.phase; f.journey.update(100);
  check(f.journey.cancelled && f.journey.target === null && f.overlay.children.length === 0
    && f.overlay.style.opacity === '0' && f.journey.phase === phase, `cancel clears ${targetPhase} without late events`);
  f.earth.geometry.dispose();
}
const sheared = fixture([1.4, 0.9, 1.2]);
sheared.earth.rotation.set(0.2, 0.4, 0.3);
sheared.journey.getAtmosphericPose();
check(sheared.journey.solidRadius >= 2.8, 'rotated nonuniform scale cannot underestimate solid radius');
sheared.journey.cancel(); sheared.earth.geometry.dispose();
const matrixParent = fixture();
matrixParent.root.updateMatrix(); matrixParent.root.matrixAutoUpdate = false;
matrixParent.root.matrix.multiply(new THREE.Matrix4().makeShear(0.25, 0, 0, 0.1, 0, 0));
matrixParent.journey.measureEarth();
const vertex = new THREE.Vector3(); const positions = matrixParent.earth.geometry.getAttribute('position');
let contained = true;
for (let index = 0; index < positions.count; index++) {
  vertex.fromBufferAttribute(positions, index).applyMatrix4(matrixParent.earth.matrixWorld);
  if (vertex.distanceTo(matrixParent.journey.center) > matrixParent.journey.solidRadius + 1e-6) contained = false;
}
check(contained, 'explicit parent shear bound contains every rendered Earth vertex');
matrixParent.journey.cancel(); matrixParent.earth.geometry.dispose();
const loading = fixture();
while (loading.journey.phase !== 'BIRTH') loading.journey.update(0.01);
let settleMaps;
const maps = new Promise(resolve => { settleMaps = resolve; });
loading.journey.setArrivalPose({ position: new THREE.Vector3(0, 0, 6.5), lookTarget: new THREE.Vector3() }, maps);
loading.journey.update(10);
check(loading.journey.phase === 'BIRTH' && loading.journey.phaseTime === 0
  && loading.journey.atmosphere.whiteout === 1, 'pending destination maps hold opaque BIRTH without changing phase IDs');
settleMaps(); await maps; await Promise.resolve(); loading.journey.update(0.1);
check(loading.journey.phaseTime === 0.1 && loading.journey.atmosphericState.reveal < 1, 'map readiness releases gentle reveal');
loading.journey.cancel(); loading.earth.geometry.dispose();
const abortedLoading = fixture();
while (abortedLoading.journey.phase !== 'BIRTH') abortedLoading.journey.update(0.01);
let lateMaps;
abortedLoading.journey.setArrivalPose({ position: new THREE.Vector3(0, 0, 6.5), lookTarget: new THREE.Vector3() },
  new Promise(resolve => { lateMaps = resolve; }));
abortedLoading.journey.cancel(); lateMaps(); await Promise.resolve();
check(abortedLoading.overlay.children.length === 0 && abortedLoading.overlay.style.opacity === '0'
  && abortedLoading.journey.cancelled, 'late map readiness cannot recreate cancelled effects');
abortedLoading.earth.geometry.dispose();

// The only camera source change is the opt-in pose application in updateTravel.
const checkpoint = '2e8aa06f3557107b9468c3a83f57e183c52ab9ed';
const baselineCamera = execFileSync('git', ['show', `${checkpoint}:src/systems/cinematic/CameraDirector.js`], { encoding: 'utf8' });
const cameraSource = readFileSync('src/systems/cinematic/CameraDirector.js', 'utf8');
const stripped = cameraSource.replace(/    \/\/ Opt-in Journey 3 pose\.[\s\S]*?    if \(this\.approachActive\)/,
  '    if (this.approachActive)');
check(stripped.replaceAll('\r\n', '\n') === baselineCamera.replaceAll('\r\n', '\n'), 'all non-descent camera code unchanged');
const protectedPaths = ['src/systems/cinematic/GalaxyJourney.js', 'src/systems/cinematic/JourneyDirector.js',
  'src/systems/cinematic/FreeFlight.js', 'src/themes', 'src/systems/PlanetaryFlight.js', 'src/systems/SolarSystem.js',
  'src/systems/EarthGlobe.js', 'src/ui', 'src/graphics', 'public/textures'];
check(execFileSync('git', ['diff', checkpoint, '--', ...protectedPaths], { encoding: 'utf8' }) === '', 'Journey 2, gateway, flight, F/G, renderer and Earth visuals untouched');
delete globalThis.document; console.log = originalLog;
console.log(`Journey 3 atmosphere characterization: PASS (${checks} checks). No visual/FPS GREEN claim.`);
