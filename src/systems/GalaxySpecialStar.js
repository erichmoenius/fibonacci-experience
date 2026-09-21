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
  ray.addColorStop(0.12, "rgba(255,255,255,0.03)");
  ray.addColorStop(0.34, "rgba(255,255,255,0.28)");
  ray.addColorStop(0.5, "rgba(255,255,255,1)");
  ray.addColorStop(0.66, "rgba(255,255,255,0.28)");
  ray.addColorStop(0.88, "rgba(255,255,255,0.03)");
  ray.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = ray;
  context.fillRect(0, 121, 256, 14);
  context.save();
  context.translate(128, 128);
  context.rotate(Math.PI / 2);
  context.translate(-128, -128);
  context.fillRect(0, 121, 256, 14);
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
    this.coreGeometry = new THREE.SphereGeometry(0.14, 12, 8);
    this.coreMaterial = new THREE.MeshBasicMaterial({ color: 0xfff8eb });
    this.core = new THREE.Mesh(this.coreGeometry, this.coreMaterial);
    this.group.add(this.core);

    this.haloMaterial = new THREE.SpriteMaterial({
      map: this.glowMap,
      color: 0xffe8bb,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.halo = new THREE.Sprite(this.haloMaterial);
    this.halo.scale.set(1.55, 1.55, 1);
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
    this.glint.scale.set(5, 5, 1);
    this.group.add(this.glint);

    this.elapsed = 0;
    this.sparkleAge = Infinity;
    this.nextSparkle = 2.2;
    this.sparkleSeed = 3917;
    this.sparkleDuration = 0.5;
    this.sparkleStrength = 1;
    this.sparkleTint = new THREE.Color(0xffffff);
  }

  update(delta) {
    this.elapsed += delta;
    if (this.elapsed >= this.nextSparkle) {
      this.sparkleAge = 0;
      this.sparkleSeed = (1664525 * this.sparkleSeed + 1013904223) >>> 0;
      const variation = this.sparkleSeed / 4294967296;
      this.nextSparkle += 2.1 + variation * 2.7;
      this.sparkleDuration = 0.35 + variation * 0.3;
      this.sparkleStrength = 0.8 + variation * 0.2;
      this.sparkleTint.setHex(variation > 0.5 ? 0xf1f7ff : 0xfff5de);
      this.glintMaterial.color.copy(this.sparkleTint);
      this.glint.material.rotation = (variation - 0.5) * 0.3;
    }
    this.sparkleAge += delta;

    const breath = Math.sin(this.elapsed * 1.1 + 0.3);
    const attack = Math.min(1, this.sparkleAge / 0.08);
    const decay = Math.max(0,
      1 - Math.max(0, this.sparkleAge - 0.08) / (this.sparkleDuration - 0.08));
    const sparkle = this.sparkleAge < this.sparkleDuration
      ? attack * decay * decay
      : 0;
    this.core.scale.setScalar(1 + 0.03 * breath + 0.08 * sparkle);
    this.coreMaterial.color.setHex(0xfff8eb).lerp(this.sparkleTint, 0.35 * sparkle);
    this.halo.scale.setScalar(1.55 * (1 + 0.03 * breath + 0.07 * sparkle));
    this.haloMaterial.opacity = 0.24 + 0.03 * breath + 0.16 * sparkle;
    this.glint.scale.setScalar(5 + 1.4 * sparkle);
    this.glintMaterial.opacity = 0.9 * this.sparkleStrength * sparkle;
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
