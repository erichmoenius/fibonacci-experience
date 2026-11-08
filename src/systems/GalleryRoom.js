import * as THREE from "three";
import { assignPhotos, loadCityTexture } from "./GalleryPhotos.js";
import { COUNTRIES_PHOTOS, loadCountriesTexture, fitCountriesPhotos } from "./CountriesGalleryPhotos.js";
import { SATELLITE_PHOTOS, loadSatelliteTexture, assignSatellitePhotos, fitSatellitePhotos } from "./SatelliteGalleryPhotos.js";
import { WATER_PHOTOS, loadWaterTexture } from "./WaterGalleryPhotos.js";

import { layoutDenseGallery, layoutCubeGallery } from "./GalleryLayout.js";
import { layoutImmersiveSphere } from "./ImmersiveSphereLayout.js";
import { layoutPhyllotaxis } from "./PhyllotaxisLayout.js";
import { layoutConstellation } from "./ConstellationLayout.js";
import { layoutTimelineTunnel } from "./TimelineTunnelLayout.js";
import { layoutSpiralGallery } from "./SpiralGalleryLayout.js";

const SEGMENTS = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];
const BARS = {
  a: [0, 0.32, 0.24, 0.045], b: [0.12, 0.16, 0.045, 0.28],
  c: [0.12, -0.16, 0.045, 0.28], d: [0, -0.32, 0.24, 0.045],
  e: [-0.12, -0.16, 0.045, 0.28], f: [-0.12, 0.16, 0.045, 0.28],
  g: [0, 0, 0.24, 0.045],
};

/** Reusable photo gallery with numbered loading/error placeholders. Its shell has no enclosing surface. */
export class GalleryRoom {
  constructor(container, { layout = "SPHERICAL", content = "cities", id = "cities", name = "Cities", photoLoader = null } = {}) {
    if (!["SPHERICAL", "CUBE", "IMMERSIVE_SPHERE", "SPIRAL", "TIMELINE_TUNNEL", "CONSTELLATION", "PHYLLOTAXIS"].includes(layout)) throw new Error("Unsupported gallery layout: " + layout);
    if (!["cities", "water", "countries", ...Object.keys(SATELLITE_PHOTOS), "placeholders"].includes(content)) throw new Error("Unsupported gallery content: " + content);
    photoLoader ??= SATELLITE_PHOTOS[content] ? loadSatelliteTexture : content === "countries" ? loadCountriesTexture : content === "water" ? loadWaterTexture : loadCityTexture;
    this.layout = layout;
    this.content = content;
    this.id = id;
    this.group = new THREE.Group();
    this.group.name = name + "GalleryRoom";
    this.group.visible = false;
    container.add(this.group);
    this.geometry = new THREE.BoxGeometry(1, 1, 1);
    this.frameMaterial = new THREE.MeshBasicMaterial({ color: 0x101722, toneMapped: false });
    this.numberMaterial = new THREE.MeshBasicMaterial({ color: 0xeef7ff, toneMapped: false });
    this.surfaceMaterials = [];
    this.monitors = [];
    this.photoMaterials = new Map();
    this.abortController = new AbortController();
    // A seeded Fibonacci sphere: settled placement, no animated jitter or rows.
    let seed = 24075;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    const placements = Array.from({ length: 75 }, (_, i) => {
      const y = 1 - 2 * (i + 0.5) / 75;
      const azimuth = i * Math.PI * (3 - Math.sqrt(5));
      const horizontal = Math.sqrt(1 - y * y);
      const direction = new THREE.Vector3(Math.cos(azimuth) * horizontal, y, Math.sin(azimuth) * horizontal);
      const tangent = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
      const bitangent = new THREE.Vector3().crossVectors(direction, tangent).normalize();
      direction.applyAxisAngle(tangent, (random() - 0.5) * THREE.MathUtils.degToRad(1.8))
        .applyAxisAngle(bitangent, (random() - 0.5) * THREE.MathUtils.degToRad(1.8)).normalize();
      return { direction, radius: 10 + (random() - 0.5) * 0.7,
        size: 1.45 * (0.94 + random() * 0.12),
        tiltX: (random() - 0.5) * THREE.MathUtils.degToRad(3),
        tiltY: (random() - 0.5) * THREE.MathUtils.degToRad(3),
        roll: (random() - 0.5) * THREE.MathUtils.degToRad(8) };
    });
    for (const [i, placement] of placements.entries()) {
      const { direction, radius, size, tiltX, tiltY, roll } = placement;
      const nearestAngle = Math.min(...placements.filter(other => other !== placement)
        .map(other => direction.angleTo(other.direction)));
      // Reserve disjoint angular envelopes even when depth/tilt differs.
      // Fit each rectangle inside its envelope instead of allowing clustering.
      const clearanceRadius = (radius - 0.12) * Math.sin(nearestAngle * 0.46);
      const maxScale = Math.sqrt(clearanceRadius ** 2 - (0.06 * 0.65) ** 2) / Math.hypot(1.1, 0.7);
      const scale = Math.min(size, maxScale) * (0.94 + random() * 0.06);
      const monitor = new THREE.Group();
      monitor.name = "Dummy monitor " + (i + 1);
      monitor.userData.number = i + 1;
      monitor.position.copy(direction).multiplyScalar(radius);
      monitor.scale.set(scale, scale, 0.65);
      monitor.lookAt(0, 0, 0);
      monitor.rotateX(tiltX); monitor.rotateY(tiltY); monitor.rotateZ(roll);
      const box = (material, x, y, z, w, h, d) => {
        const mesh = new THREE.Mesh(this.geometry, material);
        mesh.position.set(x, y, z); mesh.scale.set(w, h, d); monitor.add(mesh);
      };
      box(this.frameMaterial, 0, 0, 0, 2.2, 1.4, 0.12);
      const surface = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL((0.52 + i * 0.037) % 1, 0.55, 0.16), toneMapped: false,
      });
      this.surfaceMaterials.push(surface);
      box(surface, 0, 0, 0.075, 2, 1.2, 0.025);
      const digits = String(i + 1);
      for (let digit = 0; digit < digits.length; digit++) {
        for (const segment of SEGMENTS[Number(digits[digit])]) {
          const [x, y, w, h] = BARS[segment];
          box(this.numberMaterial, x + (digit - (digits.length - 1) / 2) * 0.4, y, 0.1, w, h, 0.015);
        }
      }
      this.group.add(monitor);
      this.monitors.push(monitor);
    }
    // Placeholder destinations share the same panel/layout machinery, but have
    // no media requests, textures or lightbox-ready photo planes.
    let photos = content === "cities" ? assignPhotos(this.monitors)
      : content === "water" ? assignPhotos(this.monitors, WATER_PHOTOS) : this.monitors.map((_, i) => ({
      path: id + "/placeholder-" + (i + 1), width: 2, height: 1.2,
    }));
    this.monitors.forEach((monitor, i) => {
      monitor.userData.photo = photos[i];
      monitor.userData.photoStatus = content === "placeholders" ? "placeholder" : "loading";
      if (content === "placeholders") monitor.name = name + " · Panel " + (i + 1);
    });
    if (layout === "CUBE") layoutCubeGallery(this.monitors);
    else if (layout === "IMMERSIVE_SPHERE") layoutImmersiveSphere(this.monitors);
    else if (layout === "SPIRAL") layoutSpiralGallery(this.monitors);
    else if (layout === "TIMELINE_TUNNEL") layoutTimelineTunnel(this.monitors);
    else if (layout === "CONSTELLATION") this.constellation = layoutConstellation(this.monitors, this.group);
    else if (layout === "PHYLLOTAXIS") layoutPhyllotaxis(this.monitors);
    else layoutDenseGallery(this.monitors);
    if (content === "countries") {
      // Preserve the original placeholder cube, then balance photos using its actual adjacency.
      photos = assignPhotos(this.monitors, COUNTRIES_PHOTOS);
      this.monitors.forEach((monitor, i) => { monitor.userData.photo = photos[i]; });
    }
    if (SATELLITE_PHOTOS[content]) {
      // Existing placeholder geometry is frozen before assigning real photographs.
      photos = assignSatellitePhotos(this.monitors, SATELLITE_PHOTOS[content]);
      this.monitors.forEach((monitor, i) => { monitor.userData.photo = photos[i]; });
    }
    if (content === "placeholders") {
      this.ready = Promise.resolve();
      return;
    }
    // One request, decode, texture and material per unique filename. Three
    // workers bound simultaneous original-image downloads and decodes.
    const queue = [...new Map(photos.map(photo => [photo.path, photo])).values()];
    const worker = async () => {
      while (queue.length && !this.disposed) {
        const photo = queue.shift();
        try {
          const texture = await photoLoader(photo, this.abortController.signal);
          if (this.disposed) { texture.dispose(); texture.image?.close?.(); return; }
          const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
          this.photoMaterials.set(photo.path, material);
          this.photoGeometry ??= new THREE.PlaneGeometry(1, 1);
          for (const monitor of this.monitors.filter(m => m.userData.photo.path === photo.path)) {
            // Retain the original numbered placeholder for loading/failure.
            monitor.children.slice(1).forEach(child => { child.visible = false; });
            const { width, height } = monitor.userData.panelSize;
            const screen = new THREE.Mesh(this.photoGeometry, material);
            screen.position.z = 0.09;
            screen.scale.set(width, height, 1);
            monitor.add(screen);
            monitor.name = photo.city + " · " + photo.title + " · " + monitor.userData.number;
            monitor.userData.photoStatus = "ready";
            if (content === "countries") fitCountriesPhotos([monitor]);
            fitSatellitePhotos([monitor]);
          }
        } catch {
          if (!this.disposed) this.monitors.filter(m => m.userData.photo.path === photo.path)
            .forEach(m => { m.userData.photoStatus = "failed"; });
        }
      }
    };
    this.ready = Promise.all(Array.from({ length: 3 }, worker));
  }

  place(worldCenter, forward) {
    this.group.position.copy(this.group.parent.worldToLocal(worldCenter.clone()));
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), forward.clone().normalize());
    this.group.updateWorldMatrix(true, true);
  }

  getCenter(target = new THREE.Vector3()) {
    return this.group.getWorldPosition(target);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController.abort();
    this.constellation?.dispose();
    this.group.removeFromParent();
    this.geometry.dispose();
    this.photoGeometry?.dispose();
    this.photoMaterials.forEach(material => {
      material.map.dispose();
      material.map.image?.close?.();
      material.dispose();
    });
    this.photoMaterials.clear();
    this.frameMaterial.dispose();
    this.numberMaterial.dispose();
    this.surfaceMaterials.forEach(material => material.dispose());
  }
}

