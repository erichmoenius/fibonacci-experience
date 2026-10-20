import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";
import { EnvironmentTheme } from "../src/themes/EnvironmentTheme.js";
import { GalleryRoom } from "../src/systems/GalleryRoom.js";

import { measureMosaic } from "../src/systems/GalleryLayout.js";

const cache = new Map();
async function moduleURL(path) {
  path = resolve(path);
  if (cache.has(path)) return cache.get(path);
  let source = readFileSync(path, "utf8");
  for (const match of [...source.matchAll(/from\s+["']([^"']+)["']/g)]) {
    const spec = match[1];
    const target = spec.startsWith(".")
      ? await moduleURL(resolve(dirname(path), spec + (extname(spec) ? "" : ".js")))
      : import.meta.resolve(spec);
    source = source.replace(match[0], "from " + JSON.stringify(target));
  }
  const url = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  cache.set(path, url);
  return url;
}
const { default: CameraDirector } = await import(await moduleURL("src/systems/cinematic/CameraDirector.js"));
class Surface {
  constructor() { this.listeners = []; this.children = []; this.style = {}; this.dataset = {}; }
  addEventListener(name, handler, capture = false) { this.listeners.push({ name, handler, capture }); }
  removeEventListener(name, handler, capture = false) {
    this.listeners = this.listeners.filter(l => l.name !== name || l.handler !== handler || l.capture !== capture);
  }
  emit(name, event) { for (const l of [...this.listeners]) if (l.name === name) { l.handler(event); if (event.stopped) break; } }
  appendChild(child) { this.children.push(child); child.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  setAttribute() {}
  setPointerCapture(id) { this.captureId = id; }
  hasPointerCapture(id) { return this.captureId === id; }
  releasePointerCapture(id) { if (this.captureId === id) this.captureId = undefined; }
  focus() { document.activeElement = this; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 1000 }; }
}
const output = { log: console.log, warn: console.warn, trace: console.trace };
console.log = console.warn = console.trace = () => {};
globalThis.window = new Surface();
window.innerWidth = window.innerHeight = 1000;
globalThis.document = Object.assign(new Surface(), { createElement: () => new Surface(), body: new Surface(), activeElement: null });
globalThis.localStorage = { getItem: () => null };
const textureLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function (_url, ready) { ready(new THREE.Texture({ width: 4096, height: 2048 })); };
let checks = 0;
const check = (condition, text) => { assert.ok(condition, text); checks++; };
try {
  const canvas = new Surface();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  const director = new CameraDirector(camera, canvas);
  const container = new THREE.Group(); container.position.z = -0.01;
  const theme = new EnvironmentTheme(container, null);
  await theme.earth.ready;
  director.setExploreTravel(theme.flight);
  director.returnHome(theme.getHomePose(), true);
  const baselineListeners = window.listeners.length;
  theme.initializeFlightControls({ cameraDirector: director });
  const controller = theme.galleryInteraction;
  const listenerCount = window.listeners.length;
  check(listenerCount === baselineListeners + 6, "six removable local observers");
  const eventAt = (sphere, extra = {}) => {
    container.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    const p = sphere.getWorldPosition(new THREE.Vector3()).project(camera);
    return { target: canvas, pointerId: 1, clientX: (p.x + 1) * 500, clientY: (1 - p.y) * 500,
      button: 0, buttons: 1, timeStamp: 0, preventDefault() { this.prevented = true; },
      stopImmediatePropagation() { this.stopped = true; }, ...extra };
  };
  const first = theme.satellites.satellites[0];
  const click = (extra = {}) => {
    const down = eventAt(first, extra);
    controller.down(down);
    const up = { ...down, buttons: 0, timeStamp: 100 };
    controller.up(up); return up;
  };
  const initialPose = director.position.clone();
  const initialForward = camera.getWorldDirection(new THREE.Vector3());
  const accepted = click();
  check(controller.opened && director.mode === "inspect" && !director.freeFlight.active, "Satellite 1 release opens gallery under CameraDirector ownership");
  check(!accepted.stopped, "normal pointer release remains available to existing App/FreeFlight cleanup");
  director.update(1 / 60);
  const room = controller.room;
  check(room.monitors.length === 75 && new Set(room.monitors.map(m => m.userData.number)).size === 75, "exactly 75 distinct numbered monitors");
  check(!theme.earth.group.visible && !theme.satellites.group.visible && room.group.visible, "gallery isolated inside same theme");
  check(theme.getGateways().length === 0 && director.journey === null, "no gateway, JourneyDirector, or theme switch");
  check(director.position.distanceTo(initialPose) < 1e-8, "visitor stays at saved position");
  const center = room.group.getWorldPosition(new THREE.Vector3());
  let minDistance = Infinity;
  room.group.updateMatrixWorld(true);
  for (const [i, monitor] of room.monitors.entries()) {
    const p = monitor.getWorldPosition(new THREE.Vector3());
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(monitor.getWorldQuaternion(new THREE.Quaternion()));
    check(normal.dot(center.clone().sub(p).normalize()) >= 1 / Math.sqrt(3) - 1e-6, "sector-oriented screen faces the visitor");
    check(p.distanceTo(center) >= 9.65 && p.distanceTo(center) <= 10.35, "subtle bounded shell depth");
    for (const other of room.monitors.slice(i + 1)) minDistance = Math.min(minDistance, p.distanceTo(other.getWorldPosition(new THREE.Vector3())));
  }
  // Dense rectangular panels can have intersecting bounding spheres while
  // their actual oriented frame boxes remain clearly separated.
  const frames = room.monitors.map(monitor => new OBB(
    new THREE.Vector3(), new THREE.Vector3(0.5, 0.5, 0.5),
  ).applyMatrix4(monitor.children[0].matrixWorld));
  for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) {
    check(!frames[i].intersectsOBB(frames[j]), "actual monitor frames do not intersect");
  }
  // Retain angular-envelope telemetry. Dense rectangles can share enclosing
  // cones without sharing pixels; E3.1 checks actual projected polygons.
  const directions = room.monitors.map(m => m.getWorldPosition(new THREE.Vector3()).sub(center).normalize());
  const halfAngles = room.monitors.map((m, index) => {
    let maximum = 0;
    const frame = m.children[0];
    for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) {
      const direction = frame.localToWorld(new THREE.Vector3(x, y, z)).sub(center).normalize();
      maximum = Math.max(maximum, direction.angleTo(directions[index]));
    }
    return maximum;
  });
  let minAngularSeparation = Infinity, minAngularClearance = Infinity;
  for (let i = 0; i < directions.length; i++) for (let j = i + 1; j < directions.length; j++) {
    const angle = directions[i].angleTo(directions[j]);
    const clearance = angle - halfAngles[i] - halfAngles[j];
    minAngularSeparation = Math.min(minAngularSeparation, angle);
    minAngularClearance = Math.min(minAngularClearance, clearance);

  }
  check(minAngularSeparation > THREE.MathUtils.degToRad(1), "all mosaic panel centers remain distinct");
  check(new Set(room.monitors.map(m => m.userData.mosaicCell.face)).size === 6, "six sectors cover horizon and poles; E3.4 checks exact projected frame silhouettes");
  const depthRange = [Math.min(...room.monitors.map(m => m.position.length())), Math.max(...room.monitors.map(m => m.position.length()))];
  const widthRange = [Math.min(...room.monitors.map(m => m.children[0].scale.x * m.scale.x)), Math.max(...room.monitors.map(m => m.children[0].scale.x * m.scale.x))];
  check(depthRange.every(radius => Math.abs(radius - 10) < 0.01), "monitor origins remain immediately behind the radius-10 photo shell");
  check(widthRange[0] > 0 && widthRange[1] / widthRange[0] > 2, "aspect-aware mosaic permits different monitor dimensions");
  check(measureMosaic(room.monitors).photoCoverage > 0.97, "whole-sphere photographic coverage exceeds 97%");
  const octants = Array(8).fill(0);
  directions.forEach(d => octants[(d.x >= 0 ? 1 : 0) + (d.y >= 0 ? 2 : 0) + (d.z >= 0 ? 4 : 0)]++);
  check(octants.every(count => count >= 1 && count <= 25), "constellation remains distributed around the whole visitor");
  const repeated = new GalleryRoom(new THREE.Group());
  check(repeated.monitors.every((m, index) => {
    const original = room.monitors[index];
    return m.position.equals(original.position) && m.quaternion.equals(original.quaternion) && m.scale.equals(original.scale);
  }), "seeded position, size and orientation are identical on every construction");
  repeated.dispose();
  // Count actual projected screen polygons, including partially visible edge
  // panels, across continuous forward headings rather than predefined views.
  const density = [];
  const sampleCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  sampleCamera.position.copy(center);
  const visibleFrame = frame => {
    let polygon = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([x, y]) =>
      frame.localToWorld(new THREE.Vector3(x, y, 0.5)).project(sampleCamera));
    if (polygon.some(p => p.z < -1 || p.z > 1)) return false;
    for (const [axis, sign] of [["x", 1], ["x", -1], ["y", 1], ["y", -1]]) {
      const clipped = [];
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length];
        const da = 1 - sign * a[axis], db = 1 - sign * b[axis];
        if (da >= 0) clipped.push(a);
        if ((da >= 0) !== (db >= 0)) clipped.push(a.clone().lerp(b, da / (da - db)));
      }
      polygon = clipped;
      if (!polygon.length) return false;
    }
    return true;
  };
  for (const aspect of [16 / 9, 21 / 9, 1]) {
    sampleCamera.aspect = aspect; sampleCamera.updateProjectionMatrix();
    const counts = [];
    for (let step = 0; step < 24; step++) {
      const angle = step * Math.PI / 12;
      sampleCamera.lookAt(center.clone().add(new THREE.Vector3(Math.sin(angle), 0, -Math.cos(angle))));
      sampleCamera.updateMatrixWorld(true);
      counts.push(room.monitors.filter(m => visibleFrame(m.children[0])).length);
    }
    const result = { aspect, min: Math.min(...counts), max: Math.max(...counts),
      average: counts.reduce((a, b) => a + b) / counts.length };
    density.push(result);
    if (aspect >= 16 / 9) check(result.min >= 5 && result.average >= 8 && result.max <= 40, "several readable panels remain visible across typical widescreen headings");
  }
  // Cover the full 360 degrees through actual local drag input, with the
  // production director writing all camera transforms and zero translation.
  check(controller.controls.children.filter(e => e.type === "button").length === 1
    && controller.back.textContent === "Back to Earth", "only Back remains; no view counter or slideshow controls");
  check(camera.getWorldDirection(new THREE.Vector3()).dot(initialForward) > 0.99999, "entry preserves rendered Earth heading without a jump");
  const drag = { target: canvas, pointerId: 99, button: 0, buttons: 1, clientX: 500, clientY: 500,
    preventDefault() {}, stopImmediatePropagation() {} };
  controller.down(drag);
  check(canvas.hasPointerCapture(99), "drag captures pointer for outside-canvas releases");
  const beforeLoop = camera.getWorldDirection(new THREE.Vector3());
  const quadrants = new Set();
  let previous = beforeLoop.clone(), maxStep = 0, fullTurns = 0;
  for (let step = 1; step <= 240; step++) {
    drag.clientX += 2 * Math.PI / 0.003 / 120;
    controller.move(drag);
    // Include the real App's ordinary parallax and legacy target submissions.
    director.setParallax({ x: Math.sin(step), y: Math.cos(step) }, 1);
    director.setLookTarget(2.8, 0, -8);
    director.update(1 / 60);
    const direction = camera.getWorldDirection(new THREE.Vector3());
    quadrants.add(Math.floor(THREE.MathUtils.euclideanModulo(Math.atan2(direction.x, -direction.z), 2 * Math.PI) / (Math.PI / 2)));
    maxStep = Math.max(maxStep, previous.angleTo(direction)); previous.copy(direction);
    check(camera.position.distanceTo(center) < 1e-8, "rendered camera remains at exact center despite parallax");
    check(!director.freeFlight.active && director.journey === null, "local look never hands ownership to flight or journeys");
    if (step % 120 === 0) {
      check(direction.dot(beforeLoop) > 0.99999, "360-degree wrap is continuous");
      fullTurns++;
    }
  }
  check(quadrants.size === 4 && fullTurns === 2 && maxStep < 0.053, "two complete turns cover every horizontal direction without snapping");
  drag.clientY -= 0.8 / 0.003; controller.move(drag); director.update(1 / 60);
  check(camera.getWorldDirection(new THREE.Vector3()).y > 0.7, "upward mouse drag looks up");
  drag.clientY += 1.6 / 0.003; controller.move(drag); director.update(1 / 60);
  check(camera.getWorldDirection(new THREE.Vector3()).y < -0.7, "downward mouse drag looks down");
  drag.clientY -= 10000; controller.move(drag); director.update(1 / 60);
  const pole = camera.getWorldDirection(new THREE.Vector3());
  check(pole.y > 0.999 && Number.isFinite(pole.x) && camera.position.distanceTo(center) < 1e-8, "pole limit prevents flipping and translation");
  controller.up({ ...drag, buttons: 0 });
  check(!canvas.hasPointerCapture(99) && !controller.lookPointer, "release ends look capture");
  controller.move({ ...drag, clientX: drag.clientX + 500, buttons: 0 }); director.update(1 / 60);
  check(camera.getWorldDirection(new THREE.Vector3()).dot(pole) > 0.99999, "unheld mouse movement does not rotate the view");
  controller.down(drag);
  window.emit("blur", {});
  check(!controller.lookPointer && !canvas.hasPointerCapture(99), "blur safely releases look input");
  let gaps = 0;

  const raycaster = new THREE.Raycaster();
  for (let i = 0; i < 200; i++) {
    const y = 1 - 2 * (i + 0.5) / 200, a = i * Math.PI * (3 - Math.sqrt(5)), r = Math.sqrt(1 - y * y);
    raycaster.set(center, new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a)));
    if (!raycaster.intersectObjects(room.monitors, true).length) gaps++;
  }
  check(gaps > 0 && gaps < 12 && theme.getEnvironment().legacyStars === false, "tiled photographic sphere leaves narrow starfield windows; celestial sky untouched");
  const geometries = new Set(), materials = new Set();
  room.group.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); });
  check(geometries.size === 1 && [...materials].every(m => !m.map && !m.isShaderMaterial), "one shared geometry; no textures or custom shaders");
  controller.back.emit("click", {});
  check(!controller.opened && document.body.children.length === 0 && theme.earth.group.visible, "Back to Earth removes UI and restores Earth");
  check(director.mode === "explore" && director.freeFlight.active && director.position.distanceTo(initialPose) < 1e-8, "saved Earth position and flight restored");
  check(camera.getWorldDirection(new THREE.Vector3()).dot(initialForward) > 0.9999, "saved Earth heading restored");
  for (let i = 0; i < 30; i++) {
    check(controller.open(), "repeat open");
    check(controller.room === room && document.body.children.length === 1, "reuse one room and UI");
    controller.close();
    check(document.body.children.length === 0 && window.listeners.length === listenerCount, "no objects or global listeners accumulate");
  }
  check(director.inspectParallaxStrength === 0.25, "closing restores normal inspection settings");
  const down = eventAt(first);
  controller.down(down);
  controller.move({ ...down, clientX: down.clientX + 20 });
  controller.move({ ...down });
  controller.up({ ...down, buttons: 0, timeStamp: 100 });
  check(!controller.opened, "drag out and back cannot open");
  controller.down(down); controller.up({ ...down, timeStamp: 600, buttons: 0 });
  check(!controller.opened, "long press cannot open");
  director.mode = "travel"; click();
  check(!controller.opened, "camera transitions cannot open gallery");
  director.mode = "explore";
  theme.flight.rmbThrustVelocity = 0.5; click();
  check(!controller.opened, "moving flight cannot open");
  theme.flight.rmbThrustVelocity = 0;
  for (const sphere of theme.satellites.satellites.slice(1)) {
    const e = eventAt(sphere); controller.down(e); controller.up({ ...e, buttons: 0, timeStamp: 100 });
    check(!controller.opened, "satellites 2-6 inactive");
  }
  const halo = eventAt(first, { clientX: eventAt(first).clientX + 16 });
  check(controller.hit(halo), "expanded target includes a 16-pixel near miss");
  controller.open();
  let escaped = false;
  window.emit("keydown", { code: "Escape", repeat: false, preventDefault() {}, stopImmediatePropagation() { this.stopped = escaped = true; } });
  check(escaped && !controller.opened && director.mode === "explore", "first ESC closes gallery and restores view");
  const nextEscape = { code: "Escape", repeat: false, preventDefault() {}, stopImmediatePropagation() { this.stopped = true; } };
  window.emit("keydown", nextEscape);
  check(!nextEscape.stopped, "subsequent ESC falls through to existing home handling");
  // Arbitrary Earth position/heading and existing yaw must also round-trip.
  for (const forward of [new THREE.Vector3(0.7, 0.4, -0.2).normalize(), new THREE.Vector3(-0.2, -0.6, 0.7).normalize()]) {
    const position = new THREE.Vector3(3, -2, 14);
    director.returnHome({ position, lookTarget: position.clone().addScaledVector(forward, 10) }, true);
    director.yaw = 0.37; director.applyComputedPosition();
    const heading = camera.getWorldDirection(new THREE.Vector3());
    controller.open(); director.update(1 / 60);
    check(camera.position.distanceTo(position) < 1e-8 && camera.getWorldDirection(new THREE.Vector3()).dot(heading) > 0.99999, "arbitrary heading and existing director yaw enter without a jump");
    controller.close();
    check(camera.position.distanceTo(position) < 1e-8 && camera.getWorldDirection(new THREE.Vector3()).dot(heading) > 0.99999, "arbitrary Earth position and rendered heading restored");
  }
  let disposalCount = 0;
  for (const resource of [...geometries, ...materials]) resource.addEventListener("dispose", () => disposalCount++);
  controller.open();
  theme.destroy(); controller.dispose();
  check(window.listeners.length === baselineListeners && document.body.children.length === 0 && container.children.length === 0, "theme exit removes room, UI and all gallery observers");
  check(disposalCount === geometries.size + materials.size, "GPU resources disposed exactly once");
  output.log(JSON.stringify({ result: "PASS", checks, monitors: 75, minDistance, minAngularSeparation, minAngularClearance, depthRange, widthRange, octants, density, fullTurns, maxStep, openSkyRays: gaps + "/200", cycles: 30, scope: "real CameraDirector APIs; fake DOM; no browser visual claim" }));
} finally {
  THREE.TextureLoader.prototype.load = textureLoad;
  Object.assign(console, output);
  delete globalThis.window; delete globalThis.document; delete globalThis.localStorage;
}
