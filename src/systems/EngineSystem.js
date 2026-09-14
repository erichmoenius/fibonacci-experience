/*
------------------------------------------------------------

THE ENGINE

It was never built.

It was accumulated.

Every ring belongs to a different age.

Every repair remembers.

------------------------------------------------------------
*/

import * as THREE from "three";

import EngineCore from "./EngineCore";
export default class EngineSystem {
  constructor() {
    console.log("EngineSystem constructor");
    this.group = new THREE.Group();
    this.group.name = "Engine";

    this.time = 0;

    this.relationshipEnergy = 0;

    this.targetRelationshipEnergy = 0;

    this.transitEnergy = 0;

    this.transitEnergy = 0;

    this.targetTransitEnergy = 0;

    // ------------------------------------------------
    //
    // INVITATION
    //
    // ------------------------------------------------

    this.invitationActive = false;

    this.rings = [];

    this.rings = [];

    // Material shared by all repair clamps

    this.repairMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x342d27,

      metalness: 0.9,

      roughness: 0.62,

      clearcoat: 0.15,

      clearcoatRoughness: 0.85,
    });

    console.log("✅ EngineCore ready");

    this.core = new EngineCore();

    this.group.add(this.core.object);

    this.createLights();

    this.createRings();

    // console.log("Created:", this.core);
    // this.createRepairPlates();
    // this.createContainmentAssembly();
  }

  // =====================================================
  // LIGHTING
  // =====================================================

  createLights() {
    const warm = new THREE.DirectionalLight(0xffc28a, 0.45);

    warm.position.set(4, 2, 3);

    this.group.add(warm);

    const cool = new THREE.DirectionalLight(0x7ba8ff, 0.25);

    cool.position.set(-3, -1, -2);

    this.group.add(cool);

    // ------------------------------------------------
    // ENGINE ACCENT LIGHT
    // ------------------------------------------------

    const accent = new THREE.PointLight(
      0xffd38a,

      0.12,

      6,
    );

    accent.position.set(
      0,

      0,

      0,
    );

    this.group.add(accent);
  }

  // =====================================================
  // RINGS
  // =====================================================

  createRings() {
    const configs = [
      {
        radius: 0.95,
        tube: 0.02,
        rotation: new THREE.Vector3(12, 38, 4),
        speed: 0.002,
      },

      {
        radius: 1.3,
        tube: 0.03,
        rotation: new THREE.Vector3(-30, 15, 42),
        speed: -0.003,
      },

      {
        radius: 1.9,
        tube: 0.042,
        rotation: new THREE.Vector3(25, 0, 15),
        speed: 0.004,
      },

      {
        radius: 2.2,
        tube: 0.02,
        rotation: new THREE.Vector3(70, -18, 55),
        speed: 0.002,
      },

      {
        radius: 2.7,
        tube: 0.018,
        rotation: new THREE.Vector3(-48, 82, 5),
        speed: -0.0015,
      },

      {
        radius: 3.15,
        tube: 0.01,
        rotation: new THREE.Vector3(88, 22, 66),
        speed: 0.001,
      },

      {
        // Massive forged containment ring

        radius: 3.7,
        tube: 0.135,
        rotation: new THREE.Vector3(-15, 110, -25),

        speed: 0.00035,

        segments: true,
      },
    ];

    configs.forEach((cfg) => {
      const geometry = new THREE.TorusGeometry(cfg.radius, cfg.tube, 24, 256);

      const age = Math.random();

      let material;

      if (cfg.radius === 3.7) {
        // Ancient containment alloy

        material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color().setHSL(0.085, 0.05, 0.085 + age * 0.025),

          metalness: 0.88,

          roughness: 0.82,

          clearcoat: 0.05,

          clearcoatRoughness: 1.0,

          emissive: 0x020101,

          emissiveIntensity: 0.003,
        });
      } else {
        // Standard engine alloy
        material = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color().setHSL(0.08, 0.12, 0.14 + age * 0.08),

          metalness: 1,
          roughness: 0.18 + age * 0.35,

          clearcoat: 1,
          clearcoatRoughness: age * 0.45,

          emissive: 0x100804,
          emissiveIntensity: 0.03,
        });
      }

      const ring = new THREE.Mesh(geometry, material);

      if (cfg.radius === 3.7) {
        this.createForgeSeam(ring, 0);
        this.createForgeSeam(ring, Math.PI * 0.55);
        this.createForgeSeam(ring, Math.PI * 1.25);
      }

      ring.rotation.set(
        THREE.MathUtils.degToRad(cfg.rotation.x),
        THREE.MathUtils.degToRad(cfg.rotation.y),
        THREE.MathUtils.degToRad(cfg.rotation.z),
      );

      // Tiny imperfections

      ring.scale.set(
        1,

        0.97 + Math.random() * 0.05,

        0.98 + Math.random() * 0.04,
      );

      ring.userData.speed = cfg.speed;

      this.group.add(ring);

      this.rings.push(ring);

      // ------------------------------------------------
      // SECOND CONTAINMENT RING
      // ------------------------------------------------

      if (cfg.radius === 3.7) {
        const outerRing = ring.clone();

        // Slightly larger than the first ring
        outerRing.scale.multiplyScalar(1.03);

        // Small offset so both rings are visible
        outerRing.rotation.x += THREE.MathUtils.degToRad(5);

        outerRing.rotation.y += THREE.MathUtils.degToRad(-3);

        this.group.add(outerRing);

        this.rings.push(outerRing);
      }

      if (cfg.radius === 3.7) {
        this.createRepairPlate(ring, 0);

        this.createRepairPlate(ring, Math.PI * 0.55);
      }
    });
  }

  createRepairPlate(ring, angle = 0) {
    const group = new THREE.Group();

    const material = this.repairMaterial;

    const top = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.22, 0.16),

      material,
    );

    const bottom = top.clone();

    top.position.x += 0.03;
    top.position.y += 0.01;

    bottom.position.x -= 0.02;
    bottom.position.y -= 0.01;

    top.rotation.z = THREE.MathUtils.degToRad(1.5);
    bottom.rotation.z = THREE.MathUtils.degToRad(-0.8);

    group.add(top);
    group.add(bottom);

    const boltGeometry = new THREE.CylinderGeometry(0.045, 0.045, 0.42, 16);

    const boltMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x151515,

      metalness: 1,

      roughness: 0.32,

      clearcoat: 1,
    });

    const boltPositions = [
      [-0.42, 0, 0.18],
      [0.42, 0, 0.18],
      [-0.42, 0, -0.18],
      [0.42, 0, -0.18],
    ];

    boltPositions.forEach((pos) => {
      const bolt = new THREE.Mesh(
        boltGeometry,

        boltMaterial,
      );

      bolt.rotation.x = Math.PI * 0.5;

      bolt.position.set(pos[0], pos[1], pos[2]);

      group.add(bolt);

      const sleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 0.26, 16),

        material,
      );

      sleeve.rotation.x = Math.PI * 0.5;

      sleeve.position.copy(bolt.position);

      group.add(sleeve);

      // ------------------------------------------------
      // FRONT BOLT HEAD
      // ------------------------------------------------

      const head = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.075, 0.04, 16),

        boltMaterial,
      );

      head.rotation.x = Math.PI * 0.5;

      head.position.copy(bolt.position);

      // Move to one side of the clamp
      head.position.y += 0.22;

      group.add(head);

      // ------------------------------------------------
      // BACK BOLT HEAD
      // ------------------------------------------------

      const backHead = head.clone();

      // Move to the opposite side
      backHead.position.y -= 0.44;

      group.add(backHead);
    });

    // TEMPORARY POSITION
    const radius = 3.7;

    group.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);

    group.lookAt(0, 0, 0);

    group.rotation.x = 0.04;
    group.rotation.y = -0.02;
    group.rotation.z = 0.06;

    ring.add(group);
  }

  createForgeSeam(ring, angle) {
    const seam = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.18, 0.22),

      new THREE.MeshPhysicalMaterial({
        color: 0x1b1a19,

        metalness: 0.8,

        roughness: 0.9,
      }),
    );

    const radius = 3.7;

    seam.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);

    seam.lookAt(0, 0, 0);

    ring.add(seam);
  }

  createContainmentAssembly() {
    this.assembly = [];

    const geometry = new THREE.BoxGeometry(0.12, 0.08, 0.07);

    const material = new THREE.MeshPhysicalMaterial({
      color: 0x3a3632,

      metalness: 0.95,

      roughness: 0.48,

      clearcoat: 0.45,

      clearcoatRoughness: 0.65,
    });

    const block = new THREE.Mesh(geometry, material);

    block.position.set(3.7, 0, 0);

    this.group.add(block);

    this.assembly.push(block);
  }

  // =====================================================
  //
  // INVITATION
  //
  // =====================================================

  setInvitation(active) {
    if (this.invitationActive === active) return;

    this.invitationActive = active;

    console.log(
      active ? "🧡 ENGINE CORE — INVITATION" : "🖤 ENGINE CORE — DORMANT",
    );

    this.core.setInvitation(active);
  }

  // =====================================================
  // UPDATE
  // =====================================================

  update(delta = 0.016) {
    this.time += delta;

    // ------------------------------------------------
    // RELATIONSHIP ENERGY
    // ------------------------------------------------

    this.relationshipEnergy = THREE.MathUtils.lerp(
      this.relationshipEnergy,
      this.targetRelationshipEnergy ?? 0,
      delta * 2,
    );

    this.transitEnergy = THREE.MathUtils.lerp(
      this.transitEnergy,
      this.targetTransitEnergy ?? 0,
      delta * 1.5,
    );

    this.core.setTransitEnergy(this.transitEnergy);

    this.core.update(delta);

    // ------------------------------------------------
    // ANCIENT DRIFT
    // ------------------------------------------------

    this.group.rotation.y += delta * 0.003;

    this.rings.forEach((ring, index) => {
      const speed = 80 + this.relationshipEnergy * 40 + this.transitEnergy * 30;

      ring.rotation.z += delta * ring.userData.speed * speed;

      // Tiny independent motion
      ring.rotation.x += Math.sin(this.time * 0.08 + index) * 0.00002;
    });
  }

  // =====================================================
  // CAMERA
  // =====================================================

  getInspectionPose() {
    return {
      position: this.object.position.clone().add(new THREE.Vector3(0, 0, 5)),

      lookTarget: this.object.position.clone(),
    };
  }

  // =====================================================
  // PUBLIC
  // =====================================================

  get object() {
    return this.group;
  }
}
