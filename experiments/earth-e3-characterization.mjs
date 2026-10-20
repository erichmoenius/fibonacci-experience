import assert from "node:assert/strict";
import * as THREE from "three";
import { GalleryRoom } from "../src/systems/GalleryRoom.js";
import { CITY_PHOTOS, CITY_MEDIA_BASE, PHOTO_TEXTURE_LIMIT, loadCityTexture, assignPhotos } from "../src/systems/GalleryPhotos.js";

let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
check(CITY_PHOTOS.length === 20 && new Set(CITY_PHOTOS.map(p => p.city)).size === 4, "20 photos across four cities");
check(CITY_PHOTOS.some(p => p.path === "Paris/02_eiffel_tower.jpeg"), "original .jpeg filename retained");
check(CITY_PHOTOS.every(p => p.width > 0 && p.height > 0 && p.photographer && p.source && p.license && p.licenseURL && p.attribution && p.manifest.Dateipfad === p.path), "complete manifest metadata retained");

// Exercise the actual fetch/decode path with deterministic HTTP and bitmap doubles.
const originalFetch = globalThis.fetch, originalBitmap = globalThis.createImageBitmap;
const requests = [], bitmaps = [], textures = [];
let active = 0, peak = 0;
globalThis.fetch = async (url, options) => {
  active++; peak = Math.max(peak, active);
  requests.push({ url, options });
  await new Promise(resolve => setTimeout(resolve, 1));
  active--;
  return { ok: true, blob: async () => ({}) };
};
globalThis.createImageBitmap = async (_blob, options) => {
  const bitmap = { width: options.resizeWidth, height: options.resizeHeight, options, closes: 0,
    close() { this.closes++; } };
  bitmaps.push(bitmap);
  return bitmap;
};
let room;
try {
  room = new GalleryRoom(new THREE.Group(), { photoLoader: async (photo, signal) => {
    const texture = await loadCityTexture(photo, signal); textures.push(texture); return texture;
  } });
  const originalTransforms = room.monitors.map(m => ({ position: m.position.clone(), scale: m.scale.clone(), quaternion: m.quaternion.clone() }));
  check(room.monitors.every(m => m.userData.photoStatus === "loading" && m.children.slice(1).every(c => c.visible)), "numbered placeholders shown during load");
  await room.ready;
  check(requests.length === 20 && new Set(requests.map(r => r.url)).size === 20, "only 20 requests for 75 monitors");
  check(peak === 3 && requests.every(r => r.options.mode === "cors" && r.options.signal === room.abortController.signal), "three concurrent CORS requests with shared cancellation");
  check(requests.every(r => CITY_PHOTOS.some(p => r.url === CITY_MEDIA_BASE + p.path)), "URLs preserve all original paths/extensions");
  check(bitmaps.every(b => Math.max(b.width, b.height) <= PHOTO_TEXTURE_LIMIT && b.options.imageOrientation === "flipY"), "bounded bitmap dimensions and correct image orientation");
  check(textures.every(t => t.colorSpace === THREE.SRGBColorSpace && !t.flipY), "photo color space and bitmap flip handling");
  check(room.photoMaterials.size === 20 && room.monitors.every(m => m.userData.photoStatus === "ready"), "all 75 screens use 20 shared photo materials");
  const counts = new Map();
  let minimumRepeatAngle = Math.PI;
  for (const [i, monitor] of room.monitors.entries()) {
    const photo = monitor.userData.photo, screen = monitor.children.at(-1), before = originalTransforms[i];
    counts.set(photo.path, (counts.get(photo.path) || 0) + 1);
    check(monitor.position.equals(before.position) && monitor.scale.equals(before.scale) && monitor.quaternion.equals(before.quaternion), "layout transforms preserved after load");
    check(Math.abs(screen.scale.x / screen.scale.y - photo.width / photo.height) < 1e-10, "manifest aspect ratio without crop/stretch");
    check(screen.scale.x === monitor.userData.panelSize.width && screen.scale.y === monitor.userData.panelSize.height && Math.abs(monitor.children[0].scale.x - screen.scale.x - 0.025) < 1e-9 && Math.abs(monitor.children[0].scale.y - screen.scale.y - 0.025) < 1e-9, "photo fills its individual mosaic frame with a subtle rim");
    check(screen.geometry === room.photoGeometry && screen.material === room.photoMaterials.get(photo.path) && monitor.children.slice(1, -1).every(c => !c.visible), "shared plane/material; placeholders hidden on success");
    check(screen.material.map.repeat.equals(new THREE.Vector2(1, 1)) && screen.material.map.offset.equals(new THREE.Vector2()), "full uncropped texture UVs");
    check(room.monitors.filter(other => other !== monitor && other.userData.mosaicCell.face === monitor.userData.mosaicCell.face)
      .every(other => other.userData.photo.path !== photo.path), "each sector contains distinct photographs; E3.4 also checks cross-sector adjacency");
    for (const other of room.monitors.filter(m => m !== monitor && m.userData.photo.path === photo.path))
      minimumRepeatAngle = Math.min(minimumRepeatAngle, monitor.position.angleTo(other.position));
  }
  check([...counts.values()].every(n => n === 3 || n === 4), "every photo repeated three or four times");
  const repeat = new GalleryRoom(new THREE.Group(), { photoLoader: async () => { throw Error("test fallback"); } });
  check(repeat.monitors.every((m, i) => m.userData.photo === room.monitors[i].userData.photo && m.position.equals(room.monitors[i].position)), "assignment and layout deterministic");
  repeat.dispose();
  const future = Array.from({ length: 75 }, (_, i) => ({ path: String(i) }));
  check(new Set(assignPhotos(room.monitors, future)).size === 75, "ready for 75 unique photos");
  const resources = new Set([room.geometry, room.photoGeometry, room.frameMaterial, room.numberMaterial,
    ...room.surfaceMaterials, ...room.photoMaterials.values(), ...textures]);
  let disposals = 0;
  resources.forEach(resource => resource.addEventListener("dispose", () => disposals++));
  room.dispose(); room.dispose();
  check(disposals === resources.size && bitmaps.every(b => b.closes === 1) && room.abortController.signal.aborted, "all textures/materials/geometries/bitmaps disposed exactly once");

  const failedPath = CITY_PHOTOS[2].path;
  const partial = new GalleryRoom(new THREE.Group(), { photoLoader: async (photo, signal) => {
    if (photo.path === failedPath) throw new Error("HTTP/decode failure");
    return loadCityTexture(photo, signal);
  } });
  await partial.ready;
  check(partial.monitors.filter(m => m.userData.photo.path === failedPath).every(m => m.userData.photoStatus === "failed"
    && m.children.slice(1).every(c => c.visible) && m.children[0].scale.x === m.userData.panelSize.width + 0.025), "failed photo copies retain original numbered placeholders");
  check(partial.monitors.filter(m => m.userData.photo.path !== failedPath).every(m => m.userData.photoStatus === "ready"), "one failure does not block other photos");
  partial.dispose();

  let resolveLate, lateSignal, lateDisposals = 0, lateCloses = 0, starts = 0;
  const late = new GalleryRoom(new THREE.Group(), { photoLoader: (_photo, signal) => {
    starts++; lateSignal = signal;
    return new Promise(resolve => { const prior = resolveLate; resolveLate = () => { prior?.();
      const texture = new THREE.Texture({ close() { lateCloses++; } });
      texture.addEventListener("dispose", () => lateDisposals++); resolve(texture);
    }; });
  } });
  late.dispose(); resolveLate(); await late.ready;
  check(starts === 3 && lateSignal.aborted && lateDisposals === 3 && lateCloses === 3 && late.photoMaterials.size === 0, "late completions cleaned up; queued work stops after disposal");
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  await assert.rejects(loadCityTexture(CITY_PHOTOS[0], new AbortController().signal), /404/); checks++;
  globalThis.fetch = async () => { throw new Error("CORS/network"); };
  await assert.rejects(loadCityTexture(CITY_PHOTOS[0], new AbortController().signal), /CORS/); checks++;
  globalThis.fetch = async () => ({ ok: true, blob: async () => ({}) });
  globalThis.createImageBitmap = async () => { throw new Error("decode"); };
  await assert.rejects(loadCityTexture(CITY_PHOTOS[0], new AbortController().signal), /decode/); checks++;
  const abort = new AbortController(); let cancelledBitmapClosed = false;
  globalThis.createImageBitmap = async () => { abort.abort(); return { close() { cancelledBitmapClosed = true; } }; };
  await assert.rejects(loadCityTexture(CITY_PHOTOS[0], abort.signal), /cancelled/); checks++;
  check(cancelledBitmapClosed, "bitmap from cancelled decode is closed");
  console.log(JSON.stringify({ result: "PASS", checks, photos: 20, monitors: 75, repeatCounts: [...counts.values()],
    minimumRepeatAngleDegrees: THREE.MathUtils.radToDeg(minimumRepeatAngle), maxConcurrentRequests: peak,
    textureLimit: PHOTO_TEXTURE_LIMIT, scope: "production geometry/media lifecycle; HTTP/bitmap doubles; no visual claim" }));
} finally {
  room?.dispose(); globalThis.fetch = originalFetch;
  if (originalBitmap === undefined) delete globalThis.createImageBitmap;
  else globalThis.createImageBitmap = originalBitmap;
}
