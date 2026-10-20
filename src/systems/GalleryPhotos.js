import * as THREE from "three";
import manifest from "../config/citiesManifest.js";

export const CITY_MEDIA_BASE = "https://media.thefridolin.com/theme-04-environment/cities/";
export const PHOTO_TEXTURE_LIMIT = 1024;
export const CITY_PHOTOS = manifest.map(entry => Object.freeze({
  path: entry.Dateipfad, width: entry.Breite_px, height: entry.Hoehe_px,
  city: entry.Stadt, title: entry.Motiv, photographer: entry.Fotograf,
  source: entry.Quell_URL, license: entry.Lizenz, licenseURL: entry.Lizenz_URL,
  attribution: entry.Erforderliche_Attribution, manifest: Object.freeze(entry),
}));

export function photoSize(photo) {
  const scale = Math.min(2 / photo.width, 1.2 / photo.height);
  return { width: photo.width * scale, height: photo.height * scale };
}

// Balance counts first, then maximize distance from copies already placed.
// The six nearest neighbours in either direction define local adjacency.
export function assignPhotos(monitors, photos = CITY_PHOTOS) {
  const neighbours = monitors.map(m => monitors.map((other, index) => ({
    index, distance: m.position.angleTo(other.position),
  })).sort((a, b) => a.distance - b.distance).slice(1, 7).map(item => item.index));
  const assigned = [], counts = photos.map(() => 0);
  for (const [i, monitor] of monitors.entries()) {
    const forbidden = new Set(assigned.filter((_, j) => neighbours[i].includes(j) || neighbours[j].includes(i)));
    const available = photos.map((_, index) => index).filter(index => !forbidden.has(index));
    const candidates = available.length ? available : photos.map((_, index) => index);
    const leastUsed = Math.min(...candidates.map(index => counts[index]));
    let best = candidates[0], bestDistance = -1;
    for (const candidate of candidates.filter(index => counts[index] === leastUsed)) {
      const distance = Math.min(Math.PI, ...assigned.flatMap((photo, j) => photo === candidate
        ? [monitor.position.angleTo(monitors[j].position)] : []));
      if (distance > bestDistance) { best = candidate; bestDistance = distance; }
    }
    assigned.push(best); counts[best]++;
  }
  return assigned.map(index => photos[index]);
}

export async function loadCityTexture(photo, signal) {
  // ImageBitmap performs bounded decode/resize before GPU upload. Do not retain
  // original-size image elements or canvases for every repeated monitor.
  if (typeof createImageBitmap !== "function") throw new Error("ImageBitmap unavailable");
  const response = await fetch(CITY_MEDIA_BASE + photo.path, { signal, mode: "cors" });
  if (!response.ok) throw new Error("Photo HTTP " + response.status);
  const blob = await response.blob();
  if (signal.aborted) throw new Error("Photo cancelled");
  const scale = Math.min(1, PHOTO_TEXTURE_LIMIT / Math.max(photo.width, photo.height));
  const bitmap = await createImageBitmap(blob, {
    resizeWidth: Math.max(1, Math.round(photo.width * scale)),
    resizeHeight: Math.max(1, Math.round(photo.height * scale)),
    resizeQuality: "high", imageOrientation: "flipY",
  });
  if (signal.aborted) { bitmap.close(); throw new Error("Photo cancelled"); }
  const texture = new THREE.Texture(bitmap);
  texture.flipY = false; // ImageBitmap orientation is handled during decode.
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
