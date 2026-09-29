import * as THREE from "three";
import { TransitState } from "./TransitState.js";

const TUNNEL_LENGTH = 42;
const RING_COUNT = 20;
const PARTICLE_COUNT = 900;

export default class WormholeTransit {
  constructor() {
    this.time = 0;
    this.state = TransitState.CREATED;
    this.group = new THREE.Group();
    this.group.name = "WormholeTransit";
    this.rings = [];
    this.resources = [];
    this.openingElapsed = 0;
    this.closingElapsed = 0;
    this.closingDuration = 1;
    this.visibility = 0;

    this.createTunnelShell();
    this.createRings();
    this.createParticles();
  }

  createTunnelShell() {
    const shellGeometry = new THREE.CylinderGeometry(
      3.6,
      3.6,
      TUNNEL_LENGTH,
      48,
      1,
      true,
    );
    const shellMaterial = new THREE.MeshBasicMaterial({
      color: 0x000006,
      transparent: true,
      opacity: 0,
      side: THREE.BackSide,
      depthWrite: true,
    });

    this.shell = new THREE.Mesh(shellGeometry, shellMaterial);
    this.shell.rotation.x = Math.PI * 0.5;
    this.shell.position.z = -TUNNEL_LENGTH * 0.5 + 1;
    this.group.add(this.shell);

    const capGeometry = new THREE.CircleGeometry(3.6, 48);
    const capMaterial = new THREE.MeshBasicMaterial({ color: 0x000006 });

    this.endCap = new THREE.Mesh(capGeometry, capMaterial);
    this.endCap.position.z = -TUNNEL_LENGTH + 1;
    this.endCap.visible = false;
    this.group.add(this.endCap);
    this.resources.push(
      shellGeometry,
      shellMaterial,
      capGeometry,
      capMaterial,
    );
  }

  createRings() {
    const geometry = new THREE.TorusGeometry(1, 0.035, 12, 96);
    this.resources.push(geometry);

    for (let i = 0; i < RING_COUNT; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.53 + (i % 5) * 0.018, 0.9, 0.66),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const ring = new THREE.Mesh(geometry, material);
      const radius = 1.25 + (i / (RING_COUNT - 1)) * 1.65;

      ring.scale.setScalar(radius);
      ring.position.z = -1.5 - i * 2;
      ring.rotation.z = i * 0.37;
      ring.userData.baseOpacity = 0.18 + (i % 4) * 0.055;
      ring.userData.speed = 5.5 + (i % 5) * 0.7;
      ring.userData.spin = (i % 2 === 0 ? 1 : -1) * (0.16 + i * 0.006);
      this.group.add(ring);
      this.rings.push(ring);
      this.resources.push(material);
    }
  }

  createParticles() {
    const positions = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = THREE.MathUtils.randFloat(0.45, 3.25);
      const i3 = i * 3;

      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = Math.sin(angle) * radius;
      positions[i3 + 2] = THREE.MathUtils.randFloat(-TUNNEL_LENGTH + 1, 2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x9deaff,
      size: 0.055,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    material.userData.baseOpacity = 0.72;
    this.particles = new THREE.Points(geometry, material);
    this.group.add(this.particles);
    this.resources.push(geometry, material);
  }

  setPose({ position, forward } = {}) {
    const normalizedForward = forward?.lengthSq()
      ? forward.clone().normalize()
      : null;

    if (position) {
      this.group.position.copy(position);
    }
    if (normalizedForward) {
      this.group.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, -1),
        normalizedForward,
      );
    }
  }

  applyVisibility() {
    this.shell.material.opacity = this.visibility;
    this.endCap.visible = this.visibility > 0.02;

    for (const ring of this.rings) {
      ring.material.opacity = ring.userData.baseOpacity * this.visibility;
    }

    this.particles.material.opacity =
      this.particles.material.userData.baseOpacity * this.visibility;
  }

  start({ position, forward } = {}) {
    this.state = TransitState.OPENING;

    this.setPose({ position, forward });

    console.log("🌀 Wormhole opening");
  }

  close(duration = 1) {
    this.state = TransitState.CLOSING;
    this.closingElapsed = 0;
    this.closingDuration = duration;
  }

  stop() {
    this.state = TransitState.FINISHED;
    console.log("🌀 Wormhole finished");
  }

  dispose() {
    this.group.clear();
    this.resources.forEach((resource) => resource.dispose());
    this.resources.length = 0;
    console.log("🌀 Wormhole disposed");
  }

  update(delta) {
    this.time += delta;

    if (this.state === TransitState.OPENING) {
      this.openingElapsed = Math.min(this.openingElapsed + delta, 0.6);
      this.visibility = Math.max(
        this.visibility,
        THREE.MathUtils.smoothstep(this.openingElapsed, 0, 0.6),
      );

      if (this.openingElapsed >= 0.6) {
        this.state = TransitState.ACTIVE;
      }
    } else if (this.state === TransitState.CLOSING) {
      this.closingElapsed = Math.min(
        this.closingElapsed + delta,
        this.closingDuration,
      );
      this.visibility =
        1 - this.closingElapsed / Math.max(this.closingDuration, 0.001);
    }

    this.applyVisibility();

    for (const ring of this.rings) {
      ring.position.z += delta * ring.userData.speed;
      if (ring.position.z > 2) ring.position.z -= TUNNEL_LENGTH;
      ring.rotation.z += delta * ring.userData.spin;
    }

    const positions = this.particles.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      let z = positions.getZ(i) + delta * (9 + (i % 7) * 0.8);
      if (z > 2) z -= TUNNEL_LENGTH;
      positions.setZ(i, z);
    }
    positions.needsUpdate = true;
    this.particles.rotation.z += delta * 0.08;
  }

  getState() {
    return this.state;
  }

  getObject() {
    return this.group;
  }
}
