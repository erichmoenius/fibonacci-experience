import * as THREE from "three";

const TAU = Math.PI * 2;
export const EARTH_SATELLITES = Object.freeze([
  { number: 1, title: "CITIES", color: 0x23c8ff },
  { number: 2, title: "COUNTRIES", color: 0xffc648 },
  { number: 3, title: "WATER", color: 0x245bdb },
  { number: 4, title: "ANIMALS", color: 0x46d46b },
  { number: 5, title: "EVENTS", color: 0xff6038 },
  { number: 6, title: "ETHNICITY", color: 0xb367ed },
].map(Object.freeze));
export const SATELLITE_RADIUS = 0.28;
export const ORBIT_RADIUS = 4.2;
// Bounds include the number badges above the spheres.
export const EARTH_WORLD_RADIUS = ORBIT_RADIUS + 0.8;
const ORBIT_PERIOD = 90;
const DIGITS = [
  ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
  ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
];

// Tiny built-in raster badges: no font downloads, canvas, or extra renderer.
function numberTexture(number) {
  const pixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const offset = (y * 64 + x) * 4;
    const col = Math.floor((x - 17) / 6);
    const row = Math.floor((y - 11) / 6);
    const digit = DIGITS[number - 1][row]?.[col] === "1";
    const disc = Math.hypot(x - 31.5, y - 31.5) < 30;
    pixels.set(digit ? [255, 255, 255, 255] : [8, 12, 24, disc ? 230 : 0], offset);
  }
  const texture = new THREE.DataTexture(pixels, 64, 64);
  // Pixel rows above run top-to-bottom; texture coordinates run bottom-to-top.
  texture.flipY = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Theme 4 visuals only. No input handlers, gateways, or camera writes. */
export class EarthSatellites {
  constructor(container) {
    this.group = new THREE.Group();
    this.group.name = "EarthSatellites";
    this.group.rotation.x = 0.24;
    container.add(this.group);
    this.angle = 0;
    this.geometry = new THREE.SphereGeometry(SATELLITE_RADIUS, 32, 20);
    // Baked soft shading keeps sphere volume readable without scene lights.
    const normals = this.geometry.getAttribute("normal");
    const colors = new Float32Array(normals.count * 3);
    const light = new THREE.Vector3(-0.5, 0.7, 1).normalize();
    const normal = new THREE.Vector3();
    for (let i = 0; i < normals.count; i++) {
      const shade = 0.42 + 0.58 * Math.max(0, normal.fromBufferAttribute(normals, i).dot(light));
      colors.set([shade, shade, shade], i * 3);
    }
    this.geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.satellites = EARTH_SATELLITES.map((definition) => {
      const sphere = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({
        color: definition.color, vertexColors: true, toneMapped: false,
      }));
      sphere.name = `Sat ${definition.number} — ${definition.title}`;
      sphere.userData = { ...definition };
      const label = new THREE.Sprite(new THREE.SpriteMaterial({
        map: numberTexture(definition.number), toneMapped: false, depthWrite: false,
      }));
      label.name = `Satellite number ${definition.number}`;
      label.position.y = 0.5;
      label.scale.setScalar(0.48);
      sphere.add(label);
      this.group.add(sphere);
      return sphere;
    });
    this.update(0);
  }

  update(delta) {
    if (this.disposed || !Number.isFinite(delta)) return;
    // A resumed tab cannot teleport the ring; phases never drift independently.
    this.angle = (this.angle + THREE.MathUtils.clamp(delta, 0, 0.1) * TAU / ORBIT_PERIOD) % TAU;
    this.satellites.forEach((sphere, index) => {
      const phase = this.angle + index * TAU / this.satellites.length;
      sphere.position.set(Math.cos(phase) * ORBIT_RADIUS, Math.sin(phase) * ORBIT_RADIUS, 0);
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    this.geometry.dispose();
    for (const sphere of this.satellites) {
      sphere.material.dispose();
      const label = sphere.children[0];
      label.material.map.dispose();
      label.material.dispose();
    }
  }
}
