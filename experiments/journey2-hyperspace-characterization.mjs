import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import * as THREE from "three";
import TransitSystem from "../src/systems/transit/TransitSystem.js";
import WormholeTransit from "../src/systems/transit/WormholeTransit.js";
import { Journey2, JOURNEY2_PHASES } from "../src/systems/cinematic/Journey2.js";

// Load the production theme with the extension resolution supplied by Vite.
const cache = new Map();
async function moduleURL(path) {
  path = resolve(path);
  if (cache.has(path)) return cache.get(path);
  let source = readFileSync(path, "utf8")
    .replaceAll("import.meta.env.BASE_URL", '"/"')
    .replaceAll("import.meta.env.DEV", "false");
  for (const match of [...source.matchAll(/from\s+["']([^"']+)["']/g)]) {
    const spec = match[1];
    const url = spec.startsWith(".")
      ? await moduleURL(resolve(dirname(path), spec + (extname(spec) ? "" : ".js")))
      : import.meta.resolve(spec);
    source = source.replace(match[0], `from ${JSON.stringify(url)}`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  cache.set(path, url);
  return url;
}
const { GalaxyTheme } = await import(await moduleURL("src/themes/GalaxyTheme.js"));
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const near = (a, b, message) => check(Math.abs(a - b) < 1e-5, message);
const originalLog = console.log;
console.log = () => {};
try {
  function fixture() {
    const scene = new THREE.Scene();
    const container = new THREE.Group();
    container.position.set(3, -2, 7);
    container.rotation.y = 0.4;
    scene.add(container);
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 450);
    camera.position.set(18, 4, -11);
    camera.lookAt(new THREE.Vector3(13, 7, -24));
    scene.add(camera);
    scene.updateMatrixWorld(true);
    const journey = new Journey2();
    let currentJourney = journey;
    const transitSystem = new TransitSystem();
    const theme = Object.create(GalaxyTheme.prototype);
    Object.assign(theme, { container, transitSystem,
      journeyDirector: { cameraDirector: { camera }, getJourney: () => currentJourney },
      galaxy: { update() {}, destroy() {} }, plasmaFilaments: { update() {}, dispose() {} },
      cosmos: { dispose() {} }, lastUpdateTime: null });
    const events = [];
    journey.onEvent = event => {
      events.push(event);
      if (event === "wormhole") transitSystem.start("wormhole");
      if (event === "complete") transitSystem.stop();
    };
    function frame(delta = 0.016) {
      journey.update(delta);
      transitSystem.update(0.016);
      theme.update({ time: journey.phaseTime, audio: {} });
    }
    while (journey.phase !== "WORMHOLE") frame();
    return { scene, camera, journey, theme, transitSystem, events, frame,
      cancel() { journey.cancel(); currentJourney = null; theme.update({ time: 0, audio: {} }); } };
  }
  // Real seconds and overshoot preservation at different display rates.
  for (const fps of [30, 60, 120]) {
    const journey = new Journey2(); const observed = [];
    journey.onEvent = event => observed.push([event, journey.elapsed]);
    for (let frame = 1; frame <= fps * 13 && !journey.completed; frame++) journey.update(1 / fps);
    near(journey.elapsed, 12, "Journey 2 completes in 12 seconds at " + fps + " FPS");
    for (const [event, time] of [["approach",.2],["horizon",1.4],["singularity",2],["wormhole",4],["void",9.7],["birth",10],["complete",12]]) {
      near(observed.find(item => item[0] === event)[1], time, "exact event boundary " + event);
    }
  }
  for (const phase of JOURNEY2_PHASES) {
    const journey = new Journey2();
    while (journey.phase !== phase.id) journey.update(.01);
    journey.cancel(); const elapsed = journey.elapsed; journey.update(10);
    near(journey.elapsed, elapsed, "cancel stops every phase: " + phase.id);
    journey.start(); check(journey.phase === "START" && !journey.cancelled, "explicit replay resets state");
  }
  const clock = new Journey2();near(clock.getFrameDelta(100),0,"clock first frame");
  near(clock.getFrameDelta(100.02),.02,"wall clock delta");
  near(clock.getFrameDelta(102),.1,"background frame capped safely");
  const f = fixture();
  const transit = f.transitSystem.currentTransit;
  const object = transit.getObject();
  const expectedPosition = f.camera.getWorldPosition(new THREE.Vector3());
  const expectedForward = f.camera.getWorldDirection(new THREE.Vector3());
  f.scene.updateMatrixWorld(true);
  check(object.parent === f.theme.container, "theme container owns tunnel");
  check(object.getWorldPosition(new THREE.Vector3()).distanceTo(expectedPosition) < 1e-8,
    "attachment preserves camera world position under transformed container");
  const tunnelForward = new THREE.Vector3(0, 0, -1).applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
  check(tunnelForward.distanceTo(expectedForward) < 1e-8, "tunnel forward matches rendered camera");
  check(transit.rings.length === 20 && transit.particles.geometry.attributes.position.count === 900,
    "existing ring and particle counts retained");
  check(object.children.length === 23, "no new geometry objects");

  // Compare equal clock steps at early/middle/late times, away from recycling.
  const samples = [];
  for (const time of [0.5, 2.85, 5.6]) {
    const probe = new WormholeTransit();
    const j = { id: "galaxy-planetary", phase: "WORMHOLE", wormholeDuration: 5.7, phaseTime: time - 0.016 };
    probe.start(); probe.enableJourney2Hyperspace(j, {});
    const ring = probe.rings[0]; ring.position.z = -30;
    probe.particles.geometry.attributes.position.setZ(0, -30);
    j.phaseTime = time;
    probe.update(0.1); // Caller delta must not override the Journey 2 clock.
    const scale = 1 + 5 * (time / 5.7) ** 2;
    near(ring.position.z + 30, 0.016 * ring.userData.speed * scale, "ring acceleration follows phase clock");
    near(probe.particles.geometry.attributes.position.getZ(0) + 30, 0.016 * 9 * scale,
      "particle acceleration follows phase clock");
    samples.push(ring.position.z + 30);
    const z = ring.position.z;
    probe.update(1);
    near(ring.position.z, z, "paused phase clock does not advance tunnel");
    j.phaseTime += 0.016 / 3; probe.update(0.016);
    near(probe.time, 0.016 + 0.016 / 3, "slow motion follows scaled phase clock");
    probe.dispose();
  }
  check(samples[0] < samples[1] && samples[1] < samples[2], "flow increases monotonically");

  const legacy = new WormholeTransit(); legacy.start();
  legacy.enableJourney2Hyperspace({ id: "engine", phaseTime: 3 }, {});
  check(legacy.hyperspaceJourney === null, "Journey 1 cannot enable acceleration");
  const legacyRing = legacy.rings[0]; const oldZ = legacyRing.position.z;
  legacy.update(0.016);
  near(legacyRing.position.z - oldZ, 0.016 * legacyRing.userData.speed, "Journey 1 ring speed unchanged");
  legacy.dispose();

  let disposed = 0;
  const resources = [...transit.resources];
  for (const resource of resources) resource.addEventListener("dispose", () => disposed++);
  while (f.journey.phase === "WORMHOLE") {
    f.frame();
    if (f.journey.phase === "WORMHOLE") {
      check(f.transitSystem.getObject() === object, "single tunnel retained throughout phase");
      check(object.getWorldPosition(new THREE.Vector3()).distanceTo(expectedPosition) < 1e-8,
        "entry alignment remains fixed");
      for (const ring of transit.rings) check(ring.position.z <= 2 && ring.position.z >= -40, "ring recycling bounded");
      const positions = transit.particles.geometry.attributes.position;
      check(Array.from(positions.array).every(Number.isFinite), "particle data remains finite");
    }
  }
  check(f.theme.fractalTransit?.uniforms.uTime.value === 5.7, "VOID holds static black without moving fractals");
  check(f.journey.phase === "VOID", "existing VOID transition retained");
  check(!f.transitSystem.isActive() && object.parent === null, "VOID detaches and stops tunnel");
  check(disposed === resources.length && transit.resources.length === 0, "VOID disposes every resource once");
  check(transit.hyperspaceJourney === null, "disposed tunnel releases journey reference");
  while (!f.journey.completed) f.frame();
  check(!f.theme.fractalTransit, "BIRTH clears fractal blackout");
  check(f.events.join(",") === "approach,horizon,singularity,wormhole,void,birth,complete", "phase event order unchanged");
  check(f.camera.position.distanceTo(expectedPosition) < 1e-8, "prototype never writes camera position");
  check(f.camera.getWorldDirection(new THREE.Vector3()).distanceTo(expectedForward) < 1e-8,
    "prototype never writes camera orientation");

  const cancelled = fixture(); const cancelledObject = cancelled.transitSystem.getObject();
  const cancelledFractal = cancelled.theme.fractalTransit;
  cancelled.cancel();
  check(cancelledFractal.disposed && cancelledFractal.mesh.parent === null, "ESC releases fractal resources");
  check(!cancelled.transitSystem.isActive() && cancelledObject.parent === null, "ESC/director stop cleanup");
  cancelled.theme.clearHyperspace();
  check(!cancelled.theme.hyperspaceTransit, "cleanup is idempotent");
  const voidExit = fixture();
  while (voidExit.journey.phase !== "VOID") voidExit.frame();
  const voidFractal = voidExit.theme.fractalTransit;voidExit.cancel();
  check(voidFractal.disposed && voidFractal.mesh.parent === null, "ESC during VOID releases blackout");
  const exit = fixture(); const exitObject = exit.transitSystem.getObject();
  const exitFractal = exit.theme.fractalTransit;
  exit.theme.destroy();
  check(exitFractal.disposed && exitFractal.mesh.parent === null, "theme exit releases fractal resources");
  check(!exit.transitSystem.isActive() && exitObject.parent === null, "theme destruction cleanup");
  const replay = fixture();
  check(replay.transitSystem.getObject() !== object && replay.theme.container.children.filter(child => child.name === "WormholeTransit").length === 1,
    "replay starts with one fresh owned tunnel");
  replay.cancel();
  console.log = originalLog;
  console.log(`Journey 2 H3 lifecycle: PASS (${checks} checks; attachment, acceleration, clock, cleanup, replay, Journey 1 defaults)`);
} finally { console.log = originalLog; }
