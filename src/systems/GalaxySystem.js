import * as THREE from "three";
import { GalaxyBody } from "./GalaxyBody.js";
import { GalaxySpecialStar } from "./GalaxySpecialStar.js";

const RADIUS = 30;
const PALETTE = [
  new THREE.Color(0xffedcb),
  new THREE.Color(0xf0bc9f),
  new THREE.Color(0xd38cba),
  new THREE.Color(0x8579c9),
  new THREE.Color(0x729ed6),
];

// Radius, arm, angular offset, activity, tint, hero cloud radius.
const FORMING_REGIONS = [
  [9.5, 0, 0.16, 0.7, 0xffdfb6, 0],
  [13.8, 0, -0.08, 1.0, 0xe9a0bc, 3.0],
  [18.4, 0, 0.22, 0.8, 0xd990bd, 2.5],
  [23.6, 0, -0.15, 0.45, 0xc1b7ea, 0],
  [16.2, 1, 0.13, 0.35, 0xe5a5c6, 0],
  [25.1, 2, -0.21, 0.9, 0xb7d6ff, 2.8],
  [19.7, 3, -0.11, 0.55, 0xc5bce9, 2.6],
  [27.2, 3, 0.18, 0.75, 0xc3ddff, 2.2],
];

function gaussian() {
  return Math.sqrt(-2 * Math.log(Math.max(Math.random(), 1e-6))) *
    Math.cos(2 * Math.PI * Math.random());
}

function colorAt(radius, target) {
  const scaled = Math.min(radius / RADIUS, 0.999) * (PALETTE.length - 1);
  const index = Math.floor(scaled);
  return target.copy(PALETTE[index]).lerp(PALETTE[index + 1], scaled - index);
}

function starSprite() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  const glow = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.12, "rgba(255,255,255,0.85)");
  glow.addColorStop(0.38, "rgba(255,255,255,0.23)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export class GalaxySystem {
  constructor(container) {
    this.container = container;
    this.group = new THREE.Group();
    this.group.name = "SpiralGalaxy";
    this.group.position.z = -30;
    this.group.rotation.set(-0.21, 0, -0.22);
    this.group.scale.setScalar(1.5);
    container.add(this.group);

    this.spinGroup = new THREE.Group();
    this.innerGroup = new THREE.Group();
    this.outerGroup = new THREE.Group();
    this.haloGroup = new THREE.Group();
    this.group.add(
      this.spinGroup,
      this.innerGroup,
      this.outerGroup,
      this.haloGroup,
    );
    this.body = new GalaxyBody(this.group, FORMING_REGIONS.filter((region) => region[5] > 0));
    this.texture = starSprite();
    this.resources = [];

    // Separate point layers let broad light and sharp stars coexist without
    // turning the entire disk into uniformly sized dots.
    this.addLayer(44000, "arms", 0.25, 0.9);
    this.addLayer(17000, "disk", 0.19, 0.57);
    this.addLayer(10000, "bulge", 0.3, 0.85);
    this.addLayer(5000, "halo", 0.18, 0.35);
    this.addLayer(13000, "clouds", 1.8, 0.065);
    this.addStarFormingRegions();

    this.core = [];
    for (const [size, opacity, y] of [
      [12, 0.16, 0],
      [6, 0.26, 0.35],
      [2.4, 0.62, 0.7],
    ]) {
      const material = new THREE.SpriteMaterial({
        map: this.texture,
        color: 0xffd7a3,
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.set(size, size, 1);
      sprite.position.y = y;
      this.innerGroup.add(sprite);
      this.core.push(sprite);
      this.resources.push(material);
    }

    this.specialStar = new GalaxySpecialStar(this.spinGroup);
  }

  addLayer(count, kind, size, opacity) {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const color = new THREE.Color();

    for (let i = 0; i < count; i++) {
      let radius;
      let angle;
      let height;

      if (kind === "bulge") {
        radius = Math.min(8, Math.abs(gaussian()) * 2.8);
        angle = Math.random() * Math.PI * 2;
        height = gaussian() * (1.3 + 0.15 * radius);
      } else if (kind === "halo") {
        radius = 8 + Math.random() * 27;
        angle = Math.random() * Math.PI * 2;
        height = gaussian() * (2 + 0.23 * radius);
      } else {
        radius = 2 + Math.sqrt(Math.random()) * (RADIUS - 2);
        const arm = Math.floor(Math.random() * 4);
        const spiral = arm * Math.PI / 2 + 2.5 * Math.log1p(radius / 2);
        const scatter = kind === "disk" ? Math.PI : kind === "clouds" ? 0.28 : 0.15;
        angle = spiral + gaussian() * scatter;
        height = gaussian() * (0.5 + 0.055 * radius);
        if (kind === "clouds") height *= 0.75;
      }

      const index = i * 3;
      const radialScatter = kind === "arms" ? gaussian() * 0.7 : 0;
      positions[index] = (radius + radialScatter) * Math.cos(angle);
      positions[index + 1] = height;
      positions[index + 2] = (radius + radialScatter) * Math.sin(angle);

      colorAt(radius, color);
      const variation = 0.72 + Math.random() * 0.55;
      colors[index] = color.r * variation;
      colors[index + 1] = color.g * variation;
      colors[index + 2] = color.b * variation;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    const material = new THREE.PointsMaterial({
      size,
      map: this.texture,
      vertexColors: true,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    points.name = kind;
    const parent = kind === "bulge" ? this.innerGroup
      : kind === "halo" ? this.haloGroup
      : kind === "arms" ? this.spinGroup
      : this.outerGroup;
    parent.add(points);
    this.resources.push(geometry, material);
  }

  addStarFormingRegions() {
    // A few unequal arm locations; these are separate from the global layers.
    let seed = 73819;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    const normal = () => Math.sqrt(-2 * Math.log(Math.max(random(), 1e-6)))
      * Math.cos(2 * Math.PI * random());
    const layers = [
      { name: "formingGas", positions: [], colors: [], size: 2.1, opacity: 0.055 },
      { name: "formingStars", positions: [], colors: [], size: 0.32, opacity: 0.62 },
      { name: "heroGas", positions: [], colors: [], size: 3.4, opacity: 0.12 },
    ];
    const base = new THREE.Color();
    const tint = new THREE.Color();
    const pointColor = new THREE.Color();
    const white = new THREE.Color(0xffffff);

    for (const [radius, arm, offset, activity, hex, heroRadius] of FORMING_REGIONS) {
      const angle = arm * Math.PI / 2 + 2.5 * Math.log1p(radius / 2) + offset;
      const radialX = Math.cos(angle);
      const radialZ = Math.sin(angle);
      const tangentX = -radialZ;
      const tangentZ = radialX;
      colorAt(radius, base);
      tint.setHex(hex);
      const lobes = 2 + Math.floor(random() * 3);

      for (let lobe = 0; lobe < lobes; lobe++) {
        const lobeAlong = normal() * (0.45 + activity * 0.45);
        const lobeAcross = normal() * 0.28;
        const width = (0.25 + random() * 0.55) * (0.65 + activity * 0.4);
        const length = (0.45 + random() * 0.9) * (0.7 + activity * 0.5);

        for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
          if (layerIndex === 2 && heroRadius === 0) continue;
          const layer = layers[layerIndex];
          const count = Math.round(activity * (layerIndex === 0 ? 20 + random() * 18
            : layerIndex === 1 ? 4 + random() * 7 : 11 + random() * 9));
          for (let i = 0; i < count; i++) {
            const spread = layerIndex === 0 ? 1 : layerIndex === 1 ? 0.38 : 1.65;
            const across = lobeAcross + normal() * width * spread;
            const along = lobeAlong + normal() * length * spread;
            layer.positions.push(
              radius * radialX + across * radialX + along * tangentX,
              normal() * (0.3 + radius * 0.025),
              radius * radialZ + across * radialZ + along * tangentZ,
            );
            pointColor.copy(base).lerp(tint, layerIndex === 1 ? 0.32 : 0.72);
            if (layerIndex === 1) pointColor.lerp(white, 0.3);
            const variation = layerIndex === 1 ? 0.65 + random() * 0.35 : 0.4 + random() * 0.45;
            layer.colors.push(
              pointColor.r * variation,
              pointColor.g * variation,
              pointColor.b * variation,
            );
          }
        }
      }
    }

    for (const layer of layers) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(layer.positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(layer.colors, 3));
      geometry.computeBoundingSphere();
      const material = new THREE.PointsMaterial({
        size: layer.size,
        map: this.texture,
        vertexColors: true,
        transparent: true,
        opacity: layer.opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const points = new THREE.Points(geometry, material);
      points.name = layer.name;
      this.spinGroup.add(points);
      this.resources.push(geometry, material);
    }
  }

  update(delta) {
    this.innerGroup.rotation.y -= delta * 0.0544;
    this.spinGroup.rotation.y -= delta * 0.02992;
    this.outerGroup.rotation.y -= delta * 0.01496;
    this.haloGroup.rotation.y -= delta * 0.00272;
    this.body.update(this.spinGroup.rotation.y);
    this.specialStar.update(delta);
  }

  destroy() {
    this.container.remove(this.group);
    this.body.dispose();
    this.specialStar.dispose();
    for (const resource of this.resources) resource.dispose();
    this.texture.dispose();
    this.group.clear();
    this.spinGroup.clear();
    this.innerGroup.clear();
    this.outerGroup.clear();
    this.haloGroup.clear();
  }
}
