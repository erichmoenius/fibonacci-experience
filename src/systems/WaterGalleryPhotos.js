import manifest from "../config/waterManifest.js";
import { loadCityTexture } from "./GalleryPhotos.js";

export const WATER_MEDIA_BASE = "https://media.thefridolin.com/theme-04-environment/water/";
export const WATER_PHOTOS = Object.freeze(manifest.map(entry => Object.freeze({
  path: entry.Dateipfad, width: entry.Breite_px, height: entry.Hoehe_px,
  collection: "water", city: "Water", title: entry.Motiv, photographer: entry.Fotograf,
  source: entry.Quell_URL, license: entry.Lizenz, licenseURL: entry.Lizenz_URL,
  attribution: entry.Erforderliche_Attribution, manifest: Object.freeze(entry),
})));

// Same bounded decode, orientation, cancellation and texture policy as Cities.
export function loadWaterTexture(photo, signal) {
  return loadCityTexture(photo, signal, WATER_MEDIA_BASE);
}
