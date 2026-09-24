import * as THREE from "three";
import { PlanetaryOpticalSky } from "./PlanetaryOpticalSky.js";

export const CELESTIAL_PROFILES = Object.freeze({
  space: { columns: 80, rows: 40, brightness: 0.9, seed: 81473 },
  galaxy: { columns: 45, rows: 40, brightness: 0.7, seed: 29137 },
  planetary: { columns: 60, rows: 40, brightness: 0.85, seed: 371921 },
  // Neutral development-world placeholders: coverage only, not art direction.
  environment: { columns: 40, rows: 30, brightness: 0.65, seed: 145981 },
  human: { columns: 40, rows: 30, brightness: 0.65, seed: 632041 },
  molecular: { columns: 40, rows: 30, brightness: 0.65, seed: 480217 },
});

// One renderer-owned distant sky. Local theme scenery stays in the main scene.
export class CelestialStarfield {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    this.active = false;
    this.themeName = null;
    this.texture = this.createPointTexture();
    this.planetaryOpticalSky = null;
  }

  createPointTexture() {
    const size = 32;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const radius = Math.hypot((x + 0.5) / size - 0.5, (y + 0.5) / size - 0.5);
        const alpha = 1 - THREE.MathUtils.smoothstep(radius, 0.12, 0.5);
        pixels.set([255, 255, 255, Math.round(alpha * 255)], (y * size + x) * 4);
      }
    }
    const texture = new THREE.DataTexture(pixels, size, size);
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  setTheme(name) {
    if (name === this.themeName) return;
    this.clearStars();
    this.themeName = name;
    const profile = CELESTIAL_PROFILES[name];
    this.active = Boolean(profile);
    if (!profile) return;

    if (name === "planetary") {
      this.planetaryOpticalSky = new PlanetaryOpticalSky();
      this.scene.add(this.planetaryOpticalSky.group);
      return;
    }

    let seed = profile.seed;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    const layers = [1.5, 2, 2.8].map((size) => ({ size, positions: [], colors: [] }));
    const color = new THREE.Color();
    const radius = 50;
    for (let row = 0; row < profile.rows; row++) {
      for (let column = 0; column < profile.columns; column++) {
        // Equal-area cells: uniform azimuth and uniform cos(polar angle).
        // Jitter avoids a visible grid without crowding stars at the poles.
        const y = 1 - 2 * (row + random()) / profile.rows;
        const azimuth = 2 * Math.PI * (column + random()) / profile.columns;
        const horizontal = Math.sqrt(1 - y * y);
        const selection = random();
        const layer = layers[selection < 0.8 ? 0 : selection < 0.97 ? 1 : 2];
        layer.positions.push(radius * horizontal * Math.cos(azimuth), radius * y,
          radius * horizontal * Math.sin(azimuth));
        const tint = random();
        color.setHex(tint < 0.8 ? 0xf5f5f2 : tint < 0.9 ? 0xffead7 : 0xdce8ff);
        color.multiplyScalar(profile.brightness * (0.5 + random() * 0.5));
        layer.colors.push(color.r, color.g, color.b);
      }
    }
    for (const layer of layers) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(layer.positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(layer.colors, 3));
      const material = new THREE.PointsMaterial({
        size: layer.size,
        // Three.js multiplies PointsMaterial.size by renderer pixelRatio.
        // These are CSS-pixel sizes, with no distance attenuation.
        sizeAttenuation: false,
        map: this.texture,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      });
      this.scene.add(new THREE.Points(geometry, material));
    }
  }

  render(renderer, viewCamera) {
    if (!this.active) return;
    this.planetaryOpticalSky?.setPixelRatio(renderer.getPixelRatio());
    // Rotation/projection only: translation cannot approach or leave the sky.
    // Star positions remain fixed; the viewing camera stays at the sphere center.
    viewCamera.getWorldQuaternion(this.camera.quaternion);
    this.camera.projectionMatrix.copy(viewCamera.projectionMatrix);
    this.camera.projectionMatrixInverse.copy(viewCamera.projectionMatrixInverse);
    renderer.render(this.scene, this.camera);
  }

  clearStars() {
    this.planetaryOpticalSky?.dispose();
    this.planetaryOpticalSky = null;
    for (const points of this.scene.children) {
      points.geometry.dispose();
      points.material.dispose();
    }
    this.scene.clear();
  }

  dispose() {
    this.clearStars();
    this.texture.dispose();
    this.active = false;
    this.themeName = null;
  }
}
