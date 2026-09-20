import * as THREE from "three";

function glowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const context = canvas.getContext("2d");
  const glow = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.14, "rgba(255,255,255,0.8)");
  glow.addColorStop(0.45, "rgba(255,255,255,0.22)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

function glintTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const context = canvas.getContext("2d");
  const ray = context.createLinearGradient(0, 128, 256, 128);
  ray.addColorStop(0, "rgba(255,255,255,0)");
  ray.addColorStop(0.43, "rgba(255,255,255,0.08)");
  ray.addColorStop(0.5, "rgba(255,255,255,0.75)");
  ray.addColorStop(0.57, "rgba(255,255,255,0.08)");
  ray.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = ray;
  context.fillRect(0, 125, 256, 6);
  context.save();
  context.translate(128, 128);
  context.rotate(Math.PI / 2);
  context.translate(-128, -128);
  context.fillRect(0, 125, 256, 6);
  context.restore();
  return new THREE.CanvasTexture(canvas);
}

export class GalaxySpecialStar {
  constructor(parent) {
    this.group = new THREE.Group();
    this.group.name = "GalaxySpecialStar";

    // Follow one of the four generated arms, away from the core and rim.
    const radius = 20;
    const angle = 2.5 * Math.log1p(radius / 2) + 0.05;
    this.group.position.set(
      radius * Math.cos(angle),
      0.8,
      radius * Math.sin(angle),
    );
    parent.add(this.group);

    this.glowMap = glowTexture();
    this.glintMap = glintTexture();
    this.coreGeometry = new THREE.SphereGeometry(0.24, 12, 8);
    this.coreMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1cf });
    this.core = new THREE.Mesh(this.coreGeometry, this.coreMaterial);
    this.group.add(this.core);

    this.haloMaterial = new THREE.SpriteMaterial({
      map: this.glowMap,
      color: 0xffe8bb,
      transparent: true,
      opacity: 0.33,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.halo = new THREE.Sprite(this.haloMaterial);
    this.halo.scale.set(2.4, 2.4, 1);
    this.group.add(this.halo);

    this.glintMaterial = new THREE.SpriteMaterial({
      map: this.glintMap,
      color: 0xfff4dc,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.glint = new THREE.Sprite(this.glintMaterial);
    this.glint.scale.set(4.2, 4.2, 1);
    this.group.add(this.glint);

    this.elapsed = 0;
    this.sparkleAge = Infinity;
    this.nextSparkle = 3.5;
    this.sparkleIndex = 0;
  }

  update(delta) {
    this.elapsed += delta;
    if (this.elapsed >= this.nextSparkle) {
      this.sparkleAge = 0;
      this.nextSparkle += [5.8, 8.2, 6.9, 9.1][this.sparkleIndex % 4];
      this.sparkleIndex += 1;
    }
    this.sparkleAge += delta;

    const breath = Math.sin(this.elapsed * 1.1 + 0.3);
    const sparkle = this.sparkleAge < 1.2
      ? Math.pow(Math.sin(Math.PI * this.sparkleAge / 1.2), 2)
      : 0;
    this.core.scale.setScalar(1 + 0.05 * breath + 0.13 * sparkle);
    this.halo.scale.setScalar(2.4 * (1 + 0.04 * breath + 0.10 * sparkle));
    this.haloMaterial.opacity = 0.33 + 0.04 * breath + 0.27 * sparkle;
    this.glintMaterial.opacity = 0.65 * sparkle;
  }

  getWorldPosition(target) {
    this.group.updateWorldMatrix(true, false);
    return this.group.getWorldPosition(target);
  }

  dispose() {
    this.group.removeFromParent();
    this.coreGeometry.dispose();
    this.coreMaterial.dispose();
    this.haloMaterial.dispose();
    this.glintMaterial.dispose();
    this.glowMap.dispose();
    this.glintMap.dispose();
    this.group.clear();
  }
}
