import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";
import { EnvironmentTheme } from "../src/themes/EnvironmentTheme.js";
import { GalleryRoom } from "../src/systems/GalleryRoom.js";

import { layoutDenseGallery } from "../src/systems/GalleryLayout.js";

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
  let bounds = { left: 0, top: 0, width: 1000, height: 1000 };
  canvas.getBoundingClientRect = () => bounds;
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  const director = new CameraDirector(camera, canvas);
  const container = new THREE.Group(); container.position.z = -0.01;
  const theme = new EnvironmentTheme(container, null);
  await theme.earth.ready;
  director.setExploreTravel(theme.flight);
  director.returnHome(theme.getHomePose(), true);
  const baseListeners = window.listeners.length;
  theme.initializeFlightControls({ cameraDirector: director });
  const controller = theme.galleryInteraction;
  const resources = [];
  const room = new GalleryRoom(container, { photoLoader: async () => {
    const texture = new THREE.Texture({ close() {} }); resources.push(texture); return texture;
  } });
  await room.ready;
  controller.room = room;
  const thumbnailSizes = room.monitors.map(m => ({
    width: m.userData.panelSize.width * m.scale.x,
    height: m.userData.panelSize.height * m.scale.y,
    position: m.position.clone(), quaternion: m.quaternion.clone(), photo: m.userData.photo,
  }));
  layoutDenseGallery(room.monitors);
  room.monitors.forEach((m, i) => {
    check(Math.abs(thumbnailSizes[i].width / (m.userData.panelSize.width * m.scale.x) - 1) < 1e-10
      && Math.abs(thumbnailSizes[i].height / (m.userData.panelSize.height * m.scale.y) - 1) < 1e-10, "reapplying the layout preserves fitted tile dimensions");
    check(Math.abs(thumbnailSizes[i].position.length() - 10) < 0.01
      && m.userData.photo === thumbnailSizes[i].photo, "75-photo sphere radius and exact photo assignment preserved");
  });
  layoutDenseGallery(room.monitors);
  check(controller.open(), "gallery opens under original camera ownership");
  director.update(1 / 60);
  const listeners = window.listeners.length;
  const event = (extra = {}) => ({ target: canvas, pointerId: 1, button: 0, buttons: 1, timeStamp: 0,
    preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; },
    stopPropagation() { this.bubbleStopped = true; }, ...extra });
  const at = monitor => {
    room.group.updateWorldMatrix(true, true); camera.updateWorldMatrix(true, false);
    const point = monitor.children.at(-1).getWorldPosition(new THREE.Vector3()).project(camera);
    return event({ clientX: bounds.left + (point.x + 1) * bounds.width / 2,
      clientY: bounds.top + (1 - point.y) * bounds.height / 2 });
  };
  const visible = () => room.monitors.filter(m => {
    const e = at(m);
    return e.clientX > bounds.left + 40 && e.clientX < bounds.left + bounds.width - 40
      && e.clientY > bounds.top + 40 && e.clientY < bounds.top + bounds.height - 40
      && controller.hitPhoto(e) === m;
  });
  const monitor = visible()[0];
  check(!!monitor, "real raycasting finds a visible ready photograph");
  const clickPhoto = (m = monitor, duration = 100) => {
    const down = at(m); controller.down(down);
    controller.up({ ...down, buttons: 0, timeStamp: duration });
  };
  const position = camera.position.clone(), heading = camera.getWorldDirection(new THREE.Vector3());
  const yaw = controller.lookYaw, pitch = controller.lookPitch;
  clickPhoto();
  const box = controller.lightbox;
  check(!!box && box.photo === monitor.userData.photo, "short LMB click enlarges exactly the selected photograph with attribution metadata");
  check(!controller.lookPointer && !canvas.hasPointerCapture(1), "opening ends pointer capture");
  check(controller.controls.hidden && controller.controls.style.visibility === "hidden" && document.body.children.length === 2, "modal UI hides gallery controls without leaving the gallery");
  check(document.activeElement === box.closeButton, "keyboard focus moves to Close photo");
  check(box.screen.material.map === room.photoMaterials.get(box.photo.path).map
    && box.screen.geometry === room.photoGeometry && resources.length === 20, "lightbox reuses the existing photo texture and plane; no image requests");
  check(box.photoMaterial !== room.photoMaterials.get(box.photo.path) && !room.photoMaterials.get(box.photo.path).transparent,
    "overlay does not modify the shared gallery material");
  check(box.dim.material.transparent && box.screen.material.transparent && box.dim.renderOrder < box.screen.renderOrder
    && !box.screen.material.depthTest && box.dimMaterial.opacity > 0 && box.dimMaterial.opacity < 0.5,
    "dimmer precedes photo in the same render queue and dims the gallery only");
  bounds = { left: 8, top: 12, width: 960, height: 540 };
  camera.aspect = bounds.width / bounds.height; camera.zoom = 1.25; camera.updateProjectionMatrix();
  controller.update();
  check(Math.abs(Math.max(parseFloat(box.imageArea.style.width) / bounds.width,
    parseFloat(box.imageArea.style.height) / bounds.height) - 0.7) < 1e-9
    && box.root.style.left === "8px" && box.root.style.top === "12px",
    "an already-open lightbox adapts to viewport resize and camera zoom");
  bounds = { left: 0, top: 0, width: 1000, height: 1000 };
  camera.aspect = 1; camera.zoom = 1; camera.updateProjectionMatrix(); controller.update();
  const frozen = at(monitor);
  controller.down(frozen); controller.move({ ...frozen, clientX: frozen.clientX + 500 });
  director.update(1 / 60); controller.update();
  check(controller.lookYaw === yaw && controller.lookPitch === pitch && !controller.lookPointer
    && camera.position.equals(position) && camera.getWorldDirection(new THREE.Vector3()).dot(heading) > 0.999999,
    "modal input cannot rotate or move the camera");
  check(director.mode === "inspect" && !director.freeFlight.active && director.journey === null && controller.opened,
    "lightbox keeps existing camera owner, theme and gallery state");
  window.emit("keydown", event({ code: "Tab" }));
  check(document.activeElement === box.closeButton, "Tab stays within the modal");
  box.root.emit("click", event({ target: box.imageArea }));
  check(controller.lightbox === box, "clicking enlarged photograph keeps it open");
  window.emit("keydown", event({ code: "Escape", repeat: false }));
  check(!controller.lightbox && controller.opened && !controller.controls.hidden
    && document.activeElement === controller.back, "first ESC closes just the photo and restores gallery controls/focus");
  check(camera.position.equals(position) && camera.getWorldDirection(new THREE.Vector3()).dot(heading) > 0.999999,
    "gallery viewpoint is unchanged after closing");
  window.emit("keydown", event({ code: "Escape", repeat: true }));
  check(controller.opened, "held ESC cannot cascade from lightbox into gallery exit");

  clickPhoto(monitor, 600);
  check(!controller.lightbox, "long LMB press never opens a photo");
  const drag = at(monitor); controller.down(drag);
  controller.move({ ...drag, clientX: drag.clientX + 30 });
  controller.move({ ...drag });
  controller.up({ ...drag, buttons: 0, timeStamp: 100 });
  check(!controller.lightbox, "drag out and back never opens a photo");
  director.update(1 / 60);
  const largeRelease = at(monitor); controller.down(largeRelease);
  controller.up({ ...largeRelease, clientX: largeRelease.clientX + 12, buttons: 0, timeStamp: 100 });
  check(!controller.lightbox, "release displacement without pointermove cannot open");
  const cancelled = at(monitor); controller.down(cancelled);
  window.emit("pointercancel", event()); controller.up({ ...cancelled, buttons: 0, timeStamp: 100 });
  check(!controller.lightbox && !controller.lookPointer, "cancelled pointer never opens a photo");
  controller.down(cancelled); window.emit("blur", event());
  controller.up({ ...cancelled, buttons: 0, timeStamp: 100 });
  check(!controller.lightbox, "blur cancels the pending click");
  const alternatives = visible();
  controller.down(at(alternatives[0]));
  controller.up({ ...at(alternatives[1]), buttons: 0, timeStamp: 100 });
  check(!controller.lightbox, "release over another photo cannot open it");
  const failed = alternatives[0]; failed.userData.photoStatus = "failed";
  check(controller.hitPhoto(at(failed)) !== failed, "failed/loading placeholders are not selectable");
  failed.userData.photoStatus = "ready";
  controller.down({ ...at(monitor), button: 2, buttons: 2 });
  controller.up({ ...at(monitor), button: 2, buttons: 0, timeStamp: 100 });
  check(!controller.lightbox, "RMB never opens a photo");

  let overlayDisposals = 0, sharedDisposals = 0;
  room.photoGeometry.addEventListener("dispose", () => sharedDisposals++);
  resources.forEach(texture => texture.addEventListener("dispose", () => sharedDisposals++));
  const unique = [...new Map(room.monitors.map(m => [m.userData.photo.path, m])).values()];
  for (const [i, photoMonitor] of unique.entries()) {
    bounds = i % 2 ? { left: 12, top: 24, width: 1920, height: 1080 } : { left: 5, top: 9, width: 600, height: 1000 };
    camera.aspect = bounds.width / bounds.height; camera.zoom = i % 3 ? 1 : 1.2;
    camera.updateProjectionMatrix();
    check(controller.openLightbox(photoMonitor), "every unique photo can be inspected");
    const lightbox = controller.lightbox;
    lightbox.dimMaterial.addEventListener("dispose", () => overlayDisposals++);
    lightbox.photoMaterial.addEventListener("dispose", () => overlayDisposals++);
    controller.update(); lightbox.group.updateWorldMatrix(true, true);
    const width = parseFloat(lightbox.imageArea.style.width), height = parseFloat(lightbox.imageArea.style.height);
    check(Math.abs(width / height - photoMonitor.userData.photo.width / photoMonitor.userData.photo.height) < 1e-9,
      "lightbox preserves photo aspect ratio at wide and tall viewport sizes");
    check(Math.abs(Math.max(width / bounds.width, height / bounds.height) - 0.7) < 1e-9
      && width <= bounds.width * 0.700001 && height <= bounds.height * 0.700001,
      "image fits within 70% of viewport with comfortable margins");
    const corners = [[-0.5, -0.5], [0.5, 0.5]].map(([x, y]) =>
      lightbox.screen.localToWorld(new THREE.Vector3(x, y, 0)).project(camera));
    check(Math.abs(Math.max(...corners.flatMap(p => [Math.abs(p.x), Math.abs(p.y)])) - 0.7) < 1e-6,
      "actual rendered plane matches the viewport fit, including parent offset and camera zoom");
    if (i % 2) lightbox.closeButton.emit("click", event({ target: lightbox.closeButton }));
    else lightbox.root.emit("click", event({ target: lightbox.root }));
    lightbox.dispose();
    check(!controller.lightbox && document.body.children.length === 1 && window.listeners.length === listeners,
      "Close/outside click removes UI and overlay with no listener accumulation");
  }
  check(overlayDisposals === 40 && sharedDisposals === 0 && room.photoMaterials.size === 20,
    "20 open/close cycles dispose owned materials once; cached photo resources remain usable");
  bounds = { left: 0, top: 0, width: 1000, height: 1000 };
  camera.aspect = 1; camera.zoom = 1; camera.updateProjectionMatrix();
  const current = visible()[0], down = at(current); controller.down(down);
  controller.move({ ...down, clientX: down.clientX + 40 }); director.update(1 / 60);
  controller.up({ ...down, clientX: down.clientX + 40, buttons: 0, timeStamp: 100 });
  check(camera.getWorldDirection(new THREE.Vector3()).dot(heading) < 0.999 && !controller.lightbox,
    "gallery look resumes after lightbox closes");
  window.emit("keydown", event({ code: "Escape", repeat: false }));
  check(!controller.opened && director.mode === "explore" && director.freeFlight.active,
    "next ESC exits gallery to Earth normally");
  controller.open(); director.update(1 / 60); controller.openLightbox(monitor);
  controller.close();
  check(!controller.lightbox && !controller.opened && document.body.children.length === 0,
    "Back to Earth/gallery close also cleans an open lightbox");
  controller.open(); director.update(1 / 60); controller.openLightbox(monitor);
  const last = controller.lightbox;
  let finalDisposals = 0;
  last.dimMaterial.addEventListener("dispose", () => finalDisposals++);
  last.photoMaterial.addEventListener("dispose", () => finalDisposals++);
  theme.destroy(); controller.dispose();
  check(finalDisposals === 2 && sharedDisposals === 21 && document.body.children.length === 0
    && container.children.length === 0 && window.listeners.length === baseListeners,
    "theme exit disposes lightbox, shared gallery resources, UI and local listeners exactly once");
  output.log(JSON.stringify({ result: "PASS", checks, monitors: 75, layout: "spherical mosaic", viewportFit: 0.7,
    photos: 20, inspectCycles: 20, scope: "real CameraDirector and raycasting; DOM double; no browser visual claim" }));
} finally {
  THREE.TextureLoader.prototype.load = textureLoad;
  Object.assign(console, output);
  delete globalThis.window; delete globalThis.document; delete globalThis.localStorage;
}
