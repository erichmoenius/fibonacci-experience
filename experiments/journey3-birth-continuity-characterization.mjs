import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { EarthJourney } from '../src/systems/cinematic/EarthJourney.js';
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const log = console.log; console.log = () => {};
const element = () => ({ style: {}, children: [], appendChild(c) { this.children.push(c); c.parent = this; },
  remove() { this.parent.children = this.parent.children.filter(c => c !== this); } });
globalThis.document = { createElement: element };
try {
  for (const direction of [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0.3, -0.8).normalize(), new THREE.Vector3(0, 1, 0)]) {
    for (const scale of [1, 1.5]) {
      const root = new THREE.Group(); root.position.set(4, -2, 3); root.scale.setScalar(scale);
      const material = new THREE.ShaderMaterial({ uniforms: { sunDirection: { value: new THREE.Vector3(-1, 0.2, 0).normalize() } } });
      const earth = new THREE.Mesh(new THREE.SphereGeometry(2, 128, 96), material); earth.position.x = 22; root.add(earth);
      const center = earth.getWorldPosition(new THREE.Vector3());
      const j = new EarthJourney();
      j.prepareDescent({ camera: { near: 0.1 }, position: center.clone().addScaledVector(direction, 10 * scale), currentTarget: center }, earth, element());
      j.start(); j.elapsed = 7.5; j.captureArrival();
      const sourceDistance = j.sourceRelative.length(), sourceRadius = j.sourceRadius;
      const sourceEye = j.pose.position.clone(), sourceLook = j.pose.lookTarget.clone();
      // Removal must not corrupt the captured source world transform.
      earth.removeFromParent();
      const defaultSun = new THREE.Vector3(-0.85, 0.35, 0.65).normalize();
      const globe = { surface: { geometry: { parameters: { radius: 2 } } }, uniforms: { sunDirection: { value: defaultSun.clone() } } };
      const home = { position: new THREE.Vector3(0, 0, 6.5), lookTarget: new THREE.Vector3() };
      j.phase = 'BIRTH'; j.setArrivalPose(home, null, globe);
      check(Math.abs(Math.asin(sourceRadius / sourceDistance) - Math.asin(2 / j.arrivalStart.length())) < 1e-10, 'angular scale conserved across disposed-parent handoff');
      const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 100);
      camera.position.copy(sourceEye); camera.lookAt(sourceLook); camera.updateMatrixWorld();
      const sourceScreen = center.clone().project(camera);
      camera.position.copy(j.pose.position); camera.lookAt(j.pose.lookTarget); camera.updateMatrixWorld();
      const arrivalScreen = new THREE.Vector3().project(camera);
      check(Math.abs(Math.hypot(sourceScreen.x, sourceScreen.y) - Math.hypot(arrivalScreen.x, arrivalScreen.y)) < 0.02, 'horizon screen displacement conserved');
      let previousPosition = j.pose.position.clone(), previousRotation = camera.quaternion.clone(), previousSun = globe.uniforms.sunDirection.value.clone();
      for (let i = 1; i <= 300; i++) {
        j.phaseTime = 2.5 * i / 300;
        const pose = j.getAtmosphericPose();
        camera.position.copy(pose.position); camera.lookAt(pose.lookTarget); camera.updateMatrixWorld();
        check(camera.position.length() > 2 && camera.position.distanceTo(previousPosition) < 0.08, 'continuous exterior BIRTH position');
        check(camera.quaternion.angleTo(previousRotation) < 0.06, 'continuous BIRTH rotation');
        check(camera.fov === 60 && camera.zoom === 1, 'constant projection through reveal');
        check(globe.uniforms.sunDirection.value.angleTo(previousSun) < 0.02 && Math.abs(globe.uniforms.sunDirection.value.length() - 1) < 1e-10, 'continuous normalized lighting, no exposure change');
        previousPosition.copy(camera.position); previousRotation.copy(camera.quaternion); previousSun.copy(globe.uniforms.sunDirection.value);
      }
      check(j.pose.position.equals(home.position) && j.pose.lookTarget.equals(home.lookTarget), 'exact home endpoint before ownership release');
      check(globe.uniforms.sunDirection.value.distanceTo(defaultSun) < 1e-10, 'default Theme 4 illumination reached continuously');
      j.complete();
      check(j.getExplorationPose() === j.pose && j.arrivalEarth === null && globe.uniforms.sunDirection.value.equals(defaultSun), 'release supplies final pose and restores illumination ownership');
      earth.geometry.dispose(); material.dispose();
    }
  }
  const checkpoint = '94c6c7e3a07ad59f058d4b01e45390c32803f2ad';
  const camera = readFileSync('src/systems/cinematic/CameraDirector.js', 'utf8').replaceAll('\r\n', '\n');
  const original = execFileSync('git', ['show', `${checkpoint}:src/systems/cinematic/CameraDirector.js`], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
  const stripped = camera.replace('finishTravel(applyPose = true)', 'finishTravel()').replace('    this.arrivalIdleStart = undefined;\n', '')
    .replace(/    \/\/ Opt-in Journey 3 endpoint:[\s\S]*?    const flight =/, '    const flight =')
    .replace('    if (explorationPose && applyPose) this.applyComputedPosition();\n', '')
    .replace(/    \/\/ Opt-in Journey 3 release:[\s\S]*?    this\.position\.y \+= [^\n]*;\n/,
      '    this.position.x += Math.sin(time * 0.3) * 0.2 + px + idle.x;\n    this.position.y += Math.cos(time * 0.2) * 0.2 + py + idle.y;\n');
  check(stripped === original, 'CameraDirector changes limited to opt-in endpoint adoption and idle entry; all other camera/flight code preserved');
} finally { delete globalThis.document; console.log = log; }
console.log(`Journey 3 BIRTH continuity: PASS (${checks} checks). No physical GREEN claim.`);
