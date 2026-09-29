import * as THREE from "three";

export default class PlasmaTrail {
  constructor() {
    this.object = new THREE.Group();

    // Dormant during normal exploration.
    // Activated later during Core Awakening.

    this.object.visible = false;

    this.activation = 0;
    this.activationRate = 2;
    this.invitationActive = false;
    this.acceptedHoldRemaining = 0;
    this.acceptedHoldDuration = 3;
    this.materials = [];

    console.log("🧪 PLASMA TRAIL CREATED — HIDDEN");

    const geometry = new THREE.SphereGeometry(0.035, 12, 12);

    const material = new THREE.MeshBasicMaterial({
      color: 0xff4444,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.materials.push({ material, opacity: 1 });

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
      const opacity = 1.0 - i * 0.08;
      const tailMaterial = new THREE.MeshBasicMaterial({
        color: 0xff4444,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const tail = new THREE.Mesh(
        new THREE.SphereGeometry(0.022 - i * 0.0018, 10, 10),
        tailMaterial,
      );

      this.materials.push({ material: tailMaterial, opacity });

      this.tail.push(tail);
      this.object.add(tail);
    }
  }

  setInvitation(active) {
    this.invitationActive = active;

    if (active && !this.object.visible) {
      this.resetHistory();
      this.object.visible = true;
    }
  }

  acceptInvitation() {
    if (!this.object.visible) {
      this.resetHistory();
      this.object.visible = true;
    }

    this.activation = 1;
    this.acceptedHoldRemaining = this.acceptedHoldDuration;
    this.applyOpacity();
  }

  resetHistory() {
    this.head.position.set(
      Math.cos(this.angle) * this.radius,
      Math.sin(this.angle) * this.radius,
      0,
    );
    this.history = Array.from({ length: 80 }, () =>
      this.head.position.clone(),
    );
    this.tail.forEach((tail) => tail.position.copy(this.head.position));
  }

  applyOpacity() {
    this.materials.forEach(({ material, opacity }) => {
      material.opacity = opacity * this.activation;
    });
  }

  update(delta) {
    if (!this.object.visible) return;

    this.acceptedHoldRemaining = Math.max(
      0,
      this.acceptedHoldRemaining - delta,
    );

    const targetActivation =
      this.invitationActive || this.acceptedHoldRemaining > 0 ? 1 : 0;
    const activationStep = this.activationRate * delta;

    if (this.activation < targetActivation) {
      this.activation = Math.min(
        targetActivation,
        this.activation + activationStep,
      );
    } else {
      this.activation = Math.max(
        targetActivation,
        this.activation - activationStep,
      );
    }

    this.applyOpacity();

    if (this.activation <= 0.001 && targetActivation === 0) {
      this.activation = 0;
      this.applyOpacity();
      this.object.visible = false;
      this.history = [];
      return;
    }

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
