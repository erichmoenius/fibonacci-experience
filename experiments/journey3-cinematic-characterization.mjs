import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { EarthJourney, EARTH_PHASES } from '../src/systems/cinematic/EarthJourney.js';

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const originalLog = console.log;
console.log = () => {};
function element() {
  return { style: { background: 'black', transition: 'opacity 1s linear', opacity: '0' }, children: [],
    appendChild(child) { this.children.push(child); child.parent = this; },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); } };
}
globalThis.document = { createElement: element };
const home = { position: new THREE.Vector3(0, 0, 6.5), lookTarget: new THREE.Vector3() };
function fixture(direction = new THREE.Vector3(0, 0, 1), distance = 10, scale = 1) {
  const root = new THREE.Group(); root.position.set(3, -2, 1); root.scale.setScalar(scale);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(2, 128, 96)); earth.position.x = 22; root.add(earth);
  const center = earth.getWorldPosition(new THREE.Vector3());
  const journey = new EarthJourney();
  journey.prepareDescent({ camera: { near: 0.1 }, position: center.clone().addScaledVector(direction, distance * scale), currentTarget: center }, earth, element());
  journey.start();
  return { journey, root, earth };
}
try {
  check(EARTH_PHASES.reduce((total, p) => total + p.duration, 0) === 10, 'phase durations total exactly 10');
  check(EARTH_PHASES.map(p => p.id).join(',') === 'START,APPROACH,HORIZON,SINGULARITY,WORMHOLE,VOID,BIRTH', 'existing phase IDs/order');
  for (const dt of [1 / 30, 1 / 60, 1 / 120, 0.016, 0.037, 1.7]) {
    const f = fixture(), j = f.journey, events = [];
    j.onEvent = event => {
      events.push([event, j.elapsed]);
      if (event === 'birth') {
        check(j.atmosphere.whiteout === 1, 'handoff fully masked at phase callback');
        j.setArrivalPose(home);
      }
    };
    let wall = 0;
    while (!j.completed && wall < 12) { j.update(dt); wall += dt; }
    check(j.completed && Math.abs(j.elapsed - 10) < 1e-10 && wall >= 10 - 1e-9 && wall < 10 + dt + 1e-9, 'duration exact with carried phase overshoot');
    const expected = [['approach', 2], ['horizon', 3.25], ['singularity', 4.5], ['wormhole', 5.5], ['void', 6.5], ['birth', 7.5], ['complete', 10]];
    check(events.length === expected.length && events.every(([event, time], i) => event === expected[i][0] && Math.abs(time - expected[i][1]) < 1e-9), 'every callback fires once at its scheduled time');
    check(j.atmosphere.cleared && j.target === null && j.getAtmosphericPose() === null, 'completion releases overlay/source/pose');
    f.earth.geometry.dispose();
  }
  for (const direction of [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0.2, 0.5).normalize(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)]) {
    for (const distance of [10, 6, 2.2, 1.5]) {
      const f = fixture(direction, distance), j = f.journey;
      const camera = new THREE.PerspectiveCamera(60, 1.5, 0.1, 320);
      let previousAngle = 0, previousDistance = Infinity;
      const speeds = [];
      for (let frame = 0; frame <= 1300; frame++) {
        j.elapsed = frame * 0.005;
        f.root.rotation.y = frame * 0.00004;
        const pose = j.getAtmosphericPose(); const center = f.earth.getWorldPosition(new THREE.Vector3());
        const radius = pose.position.distanceTo(center);
        check(radius > j.solidRadius, 'exterior camera at all sampled times, including unsafe close starts');
        check(radius <= previousDistance + 1e-8, 'apparent scale increases monotonically');
        const angle = Math.asin(Math.min(1, j.solidRadius / radius));
        check(angle >= previousAngle - 1e-8, 'increasing apparent angular size');
        if (frame) speeds.push((previousDistance - radius) / 0.005);
        previousDistance = radius; previousAngle = angle;
        camera.position.copy(pose.position); camera.lookAt(pose.lookTarget); camera.updateMatrixWorld();
        check(camera.quaternion.toArray().every(Number.isFinite), 'finite horizon orientation including polar approaches');
        if (frame * 0.005 >= 4.5) {
          const normal = pose.lookTarget.clone().sub(center);
          const viewRay = pose.lookTarget.clone().sub(pose.position).normalize();
          check(Math.abs(normal.length() - j.solidRadius) < 1e-7 && Math.abs(normal.dot(viewRay)) < 1e-7, 'focus is actual visible sphere tangent');
          check(normal.dot(j.axis) > 0, 'upper-limb horizon framing');
        }
      }
      if (distance > 2.4) {
        check(Math.max(...speeds) > speeds[0] * 100 && speeds.at(-1) < 0.0001, 'deliberate acceleration then deceleration');
        j.elapsed = 2;
        check(j.getAtmosphericPose().position.distanceTo(j.center) < distance - 0.1, 'opening PULL already moves camera toward Earth');
      }
      j.cancel(); f.earth.geometry.dispose();
    }
  }
  const f = fixture(), j = f.journey;
  for (const [time, haze, clouds, whiteout] of [[0, 0, 0, 0], [2, 0, 0, 0], [4.5, 1, 0, 0], [6.5, 1, 1, 1], [7.49, 1, 1, 1]]) {
    j.elapsed = time; j.updateAtmosphere();
    check(j.atmosphericState.haze === haze && j.atmosphericState.clouds === clouds && j.atmosphericState.whiteout === whiteout, 'existing layers map to creative boundaries');
  }
  j.phase = 'BIRTH'; j.setArrivalPose(home);
  let previous = j.arrivalStart.clone();
  for (let step = 0; step <= 500; step++) {
    j.phaseTime = step * 0.005;
    const pose = j.getAtmosphericPose();
    check(pose.position.distanceTo(previous) < 0.02, 'gentle continuous reveal pull-back');
    check(pose.position.length() > 2 && pose.position.length() <= home.position.length() + 1e-10, 'destination stays exterior and within home range');
    previous.copy(pose.position);
  }
  check(j.getAtmosphericPose().position.equals(home.position), 'reveal endpoint exactly matches normal exploration home');
  j.lastFrameTime = 0;
  check(j.getFrameDelta(1 / 120) === 1 / 120, 'measured delta retains high refresh timing');
  check(j.getFrameDelta(10) === 0.1, 'stalled frame limited to readable choreography');
  check(j.getFrameDelta(9) === 0, 'backward clock cannot reverse descent');
  j.cancel(); f.earth.geometry.dispose();

  const checkpoint = '94c6c7e3a07ad59f058d4b01e45390c32803f2ad';
  const baseline = path => execFileSync('git', ['show', `${checkpoint}:${path}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
  const appSource = readFileSync('src/core/App.js', 'utf8').replaceAll('\r\n', '\n');
  const strippedApp = appSource
    .replace('      this.cameraDirector.finishTravel(this.journeyDirector.getJourney()?.id !== "planetary-environment");', '      this.cameraDirector.finishTravel();')
    .replace(/    const descentJourney = activeJourney\?\.id === "planetary-environment"[\s\S]*?    this\.cameraDirector\.update\(descentJourney\?\.completed \? 0 : journeyCameraDelta\);/,
      '    this.cameraDirector.update(journeyCameraDelta);')
    .replace('    if (!descentJourney) this.journeyDirector.update(this.cameraDirector.getPosition(), descentDelta);', '    this.journeyDirector.update(this.cameraDirector.getPosition(), descentDelta);')
    .replace(/    const activeJourney = this\.journeyDirector\.getJourney\?\.\(\);\n    const descentDelta = [\s\S]*? : 0\.016;\n/, '')
    .replace('this.journeyDirector.getScaledDelta(descentDelta)', 'this.journeyDirector.getScaledDelta(0.016)')
    .replace('this.journeyDirector.update(this.cameraDirector.getPosition(), descentDelta)', 'this.journeyDirector.update(this.cameraDirector.getPosition())')
    .replace('        earthJourney.captureArrival();\n', '')
    .replace(/        if \(earthJourney\) \{\n          const earth = this\.themeManager\.activeTheme\.earth;[\s\S]*?        \} else \{\n          this\.cameraDirector\.travel\(pose\);\n        \}/,
      '        // The destination jump is fully masked; reveal only its existing home.\n        earthJourney?.setArrivalPose(pose, this.themeManager.activeTheme.earth?.ready);\n        this.cameraDirector.travel(pose);');
  check(strippedApp === baseline('src/core/App.js'), 'App changes limited to Journey 3 measured clock and established BIRTH pose; Journey 2/gateway/storage unchanged');
  check(execFileSync('git', ['diff', checkpoint, '--', 'src', 'public', ':(exclude)src/core/App.js', ':(exclude)src/systems/cinematic/EarthJourney.js', ':(exclude)src/systems/cinematic/CameraDirector.js', ':(exclude)src/systems/cinematic/JourneyAtmosphere.js'], { encoding: 'utf8' }) === '', 'all other rendering, effects, Journey 2, themes, flight, GUI and assets unchanged');
} finally {
  delete globalThis.document; console.log = originalLog;
}
console.log(`Journey 3 cinematic characterization: PASS (${checks} checks). Schedule 10.000 s; full veil 1.000 s. No physical GREEN claim.`);
