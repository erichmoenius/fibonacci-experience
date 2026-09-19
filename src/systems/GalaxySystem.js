import * as THREE from "three";

const RADIUS = 30;
const PALETTE = [
  new THREE.Color(0xffedcb),
  new THREE.Color(0xf0bc9f),
  new THREE.Color(0xd38cba),
  new THREE.Color(0x8579c9),
  new THREE.Color(0x729ed6),
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
    this.texture = starSprite();
    this.resources = [];

    // Separate point layers let broad light and sharp stars coexist without
    // turning the entire disk into uniformly sized dots.
    this.addLayer(44000, "arms", 0.25, 0.9);
    this.addLayer(17000, "disk", 0.19, 0.57);
    this.addLayer(10000, "bulge", 0.3, 0.85);
    this.addLayer(5000, "halo", 0.18, 0.35);
    this.addLayer(13000, "clouds", 1.8, 0.065);

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

  update(delta) {
    this.innerGroup.rotation.y += delta * 0.0012;
    this.spinGroup.rotation.y += delta * 0.0007;
    this.outerGroup.rotation.y += delta * 0.00045;
    this.haloGroup.rotation.y += delta * 0.00008;
  }

  destroy() {
    this.container.remove(this.group);
    for (const resource of this.resources) resource.dispose();
    this.texture.dispose();
    this.group.clear();
    this.spinGroup.clear();
    this.innerGroup.clear();
    this.outerGroup.clear();
    this.haloGroup.clear();
  }
}
