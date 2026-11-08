import animals from "../config/animalsManifest.js";
import events from "../config/eventsManifest.js";
import ethnicity from "../config/ethnicityManifest.js";
import plants from "../config/plantsManifest.js";
import { assignPhotos, loadCityTexture } from "./GalleryPhotos.js";

/** Metadata and loading for the four remaining photographic satellites.
 * Original paths remain stable identities; TIFFs use explicitly marked local previews. */
export const SATELLITE_PHOTOS = Object.freeze(Object.fromEntries(
  Object.entries({ animals, events, ethnicity, plants }).map(([collection, entries]) => [collection,
    Object.freeze(entries.map(entry => Object.freeze({
      path: entry.Dateipfad, width: entry.Breite_px, height: entry.Hoehe_px,
      collection, city: collection[0].toUpperCase() + collection.slice(1), title: entry.Motiv,
      photographer: entry.Fotograf, source: entry.Quell_URL, license: entry.Lizenz,
      licenseURL: entry.Lizenz_URL, attribution: entry.Erforderliche_Attribution,
      ...(collection === "animals" && entry.Dateipfad === "crocodile_01.JPG"
        ? { localPath: entry.Dateipfad } : {}),
      ...(entry.Format === "TIFF" ? {
        previewPath: entry.Dateipfad.replace(/\.tif$/i, ".png"),
        previewNotice: "Display preview resized and converted from TIFF to PNG; original archive file unchanged.",
      } : {}),
      manifest: Object.freeze(entry),
    }))),
  ])));

export function loadSatelliteTexture(photo, signal) {
  const localPath = photo.previewPath ?? photo.localPath;
  const base = localPath ? `/gallery-previews/${photo.collection}/`
    : `https://media.thefridolin.com/theme-04-environment/${photo.collection}/`;
  return loadCityTexture(localPath ? { ...photo, path: localPath } : photo, signal, base);
}

export function assignSatellitePhotos(monitors, photos) {
  const assigned = assignPhotos(monitors, photos);
  const counts = photos.map(p => assigned.filter(a => a === p).length);
  // Retain spatial separation when possible, enforcing the exact 7/6 quota.
  const low = Math.floor(monitors.length / photos.length), high = low + 1;
  for (let i = assigned.length - 1; i >= 0; i--) {
    const from = photos.indexOf(assigned[i]);
    if (counts[from] <= high) continue;
    const to = counts.indexOf(Math.min(...counts));
    if (to >= 0) { assigned[i] = photos[to]; counts[from]--; counts[to]++; }
  }
  for (let to = 0; to < counts.length; to++) while (counts[to] < low) {
    const from = counts.findIndex(n => n > low);
    const i = assigned.lastIndexOf(photos[from]);
    assigned[i] = photos[to]; counts[from]--; counts[to]++;
  }
  return assigned;
}

/** Letterbox inside the original frame. Never re-layout cells using photo dimensions. */
export function fitSatellitePhotos(monitors) {
  for (const monitor of monitors) {
    const { photo, photoStatus, panelSize } = monitor.userData;
    if (photoStatus !== "ready" || !SATELLITE_PHOTOS[photo.collection]) continue;
    const scale = Math.min(panelSize.width / photo.width, panelSize.height / photo.height);
    monitor.children.at(-1).scale.set(photo.width * scale, photo.height * scale, 1);
  }
}
