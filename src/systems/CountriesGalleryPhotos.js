import manifest from "../config/countriesManifest.js";
import { loadCityTexture } from "./GalleryPhotos.js";

export const COUNTRIES_MEDIA_BASE = "https://media.thefridolin.com/theme-04-environment/countries/";
export const COUNTRIES_PHOTOS = Object.freeze(manifest.map(entry => Object.freeze({
  path: entry.Dateipfad, width: entry.Breite_px, height: entry.Hoehe_px,
  collection: "countries", city: "Countries", title: entry.Motiv, photographer: entry.Fotograf,
  source: entry.Quell_URL, license: entry.Lizenz, licenseURL: entry.Lizenz_URL,
  attribution: entry.Erforderliche_Attribution, manifest: Object.freeze(entry),
})));

export function loadCountriesTexture(photo, signal) {
  return loadCityTexture(photo, signal, COUNTRIES_MEDIA_BASE);
}

/** Fit real photographs within the unchanged cube cells. The black frame
 * supplies aspect-ratio margins; neither cell geometry nor photographs stretch. */
export function fitCountriesPhotos(monitors) {
  for (const monitor of monitors) {
    if (monitor.userData.photoStatus !== "ready" || monitor.userData.photo.collection !== "countries") continue;
    const { photo, panelSize } = monitor.userData;
    const scale = Math.min(panelSize.width / photo.width, panelSize.height / photo.height);
    monitor.children.at(-1).scale.set(photo.width * scale, photo.height * scale, 1);
  }
}
