import * as THREE from "three";

export default class PlasmaTrail {
  constructor() {
    this.object = new THREE.Group();

    // Dormant during normal exploration.
    // Activated later during Core Awakening.

    this.object.visible = false;

    console.log("🧪 PLASMA TRAIL CREATED — HIDDEN");

    const geometry = new THREE.SphereGeometry(0.02, 12, 12);

    const material = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    this.head = new THREE.Mesh(geometry, material);

    this.object.add(this.head);

    // Orbit properties
    this.angle = 0;
    this.radius = 0.425;
    this.speed = 6.0;

    // Trail data
    this.history = [];
    this.tail = [];

    for (let i = 0; i < 8; i++) {
      const tail = new THREE.Mesh(
        new THREE.SphereGeometry(0.012 - i * 0.001, 10, 10),
        new THREE.MeshBasicMaterial({
          color: 0xff4444,
          transparent: true,
          opacity: 1.0 - i * 0.08,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );

      this.tail.push(tail);
      this.object.add(tail);
    }
  }

  update(delta) {
    if (!this.object.visible) return;

    this.angle += delta * this.speed;

    this.head.position.set(
      Math.cos(this.angle) * this.radius,
      Math.sin(this.angle) * this.radius,
      0,
    );

    this.history.unshift(this.head.position.clone());

    if (this.history.length > 80) {
      this.history.pop();
    }
    for (let i = 0; i < this.tail.length; i++) {
      const point = this.history[(i + 1) * 8];

      if (point) {
        this.tail[i].position.copy(point);
      }
    }
  }
}
