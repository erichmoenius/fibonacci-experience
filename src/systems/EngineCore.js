import * as THREE from "three";
import PlasmaTrail from "./PlasmaTrail.js";
export default class EngineCore {
  constructor() {
    console.log("EngineCore constructor");

    this.group = new THREE.Group();

    this.time = 0;
    this.ringPulse = 0;
    this.spark = 0;
    this.transitEnergy = 0;

    // ------------------------------------------------
    //
    // INVITATION
    //
    // ------------------------------------------------

    this.invitationActive = false;

    // ------------------------------------------------
    // CONTAINMENT SHELL
    // ------------------------------------------------

    this.shell = new THREE.Mesh(
      new THREE.CapsuleGeometry(
        0.008, // radius
        0.025, // body length
        4, // cap segments
        8, // radial segments
      ),

      new THREE.MeshPhysicalMaterial({
        color: 0x181b1f,

        metalness: 0.95,

        roughness: 0.9,

        transparent: true,

        opacity: 0.1,

        transmission: 0.1,

        depthWrite: false,

        side: THREE.DoubleSide,
      }),
    );

    this.group.add(this.shell);

    // ------------------------------------------------
    // SINGULARITY
    // ------------------------------------------------

    this.singularity = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 48, 48),

      new THREE.MeshBasicMaterial({
        color: 0x020202,
      }),
    );

    // ------------------------------------------------
    // ACCRETION RING
    // ------------------------------------------------

    this.accretionRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.02, 24, 192),

      new THREE.MeshStandardMaterial({
        color: 0xc89a45,

        emissive: 0x7a5418,

        emissiveIntensity: 0.12,

        metalness: 0.65,

        roughness: 0.45,

        transparent: true,

        opacity: 0.85,
      }),
    );

    this.accretionRing.rotation.set(
      THREE.MathUtils.degToRad(68),

      THREE.MathUtils.degToRad(18),

      THREE.MathUtils.degToRad(12),
    );

    this.accretionRing.position.z = 0.015;

    this.group.add(this.accretionRing);

    this.plasmaTrail = new PlasmaTrail();

    this.accretionRing.add(this.plasmaTrail.object);

    // ------------------------------------------------
    // RING IMPERFECTION
    // ------------------------------------------------

    this.accretionRing.scale.set(
      1.0,

      0.985,

      1.015,
    );

    // ------------------------------------------------
    // ORBIT PARTICLES
    // ------------------------------------------------

    this.orbitParticles = [];

    for (let i = 0; i < 120; i++) {
      const size =
        Math.random() < 0.75
          ? 0.006 + Math.random() * 0.008
          : 0.02 + Math.random() * 0.02;

      let geometry;

      const shape = Math.random();

      if (shape < 0.7) {
        // Most particles = rough dust

        geometry = new THREE.IcosahedronGeometry(
          size,

          0,
        );
      } else if (shape < 0.9) {
        // Some particles = larger fragments

        geometry = new THREE.DodecahedronGeometry(
          size * 1.15,

          0,
        );
      } else {
        // Rare particles = dense nuggets

        geometry = new THREE.OctahedronGeometry(
          size * 0.85,

          0,
        );
      }

      const family = Math.random();

      const cluster = Math.random() < 0.35;

      let radius;

      // ------------------------------------------------
      // RADIUS
      // ------------------------------------------------

      if (family < 0.25) {
        // Inner dust

        radius = 0.18 + Math.random() * 0.1;
      } else if (family < 0.8) {
        // Main accretion disk

        radius =
          (cluster ? 0.36 : 0.32) + Math.random() * (cluster ? 0.08 : 0.18);
      } else {
        // Outer drifting dust

        radius = 0.6 + Math.random() * 0.35;
      }

      // ------------------------------------------------
      // MATTER LANES
      // ------------------------------------------------

      const lane = Math.floor(Math.random() * 6);

      radius += lane * 0.015;

      // ------------------------------------------------
      // COLOR
      // ------------------------------------------------

      let color;

      // if (family < 0.25) {
      //   color = 0xfff3d1;
      // } else if (family < 0.8) {
      //   color = 0xe6bf67;
      // } else {
      //   color = 0x8d6b3f;
      // }

      if (family < 0.25) {
        // Pale Silver
        color = 0xe8edf5;
      } else if (family < 0.8) {
        // Titanium Gray
        color = 0x8f949d;
      } else {
        // Dark Iron
        color = 0x50545c;
      }

      const brightness = 0.45 + Math.random() * 0.45;

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color).multiplyScalar(brightness),

        roughness: 0.92,
        metalness: 0.12,

        transparent: true,
        opacity: 1.0,
      });

      // ------------------------------------------------
      // PARTICLE
      // ------------------------------------------------

      const particle = new THREE.Mesh(
        geometry,

        material,
      );

      particle.rotation.set(
        Math.random() * Math.PI,

        Math.random() * Math.PI,

        Math.random() * Math.PI,
      );

      particle.userData = {
        angle: Math.random() * Math.PI * 2,

        radius: 0.32 + Math.random() * 0.35,

        speed:
          THREE.MathUtils.lerp(
            1.8,
            0.15,
            THREE.MathUtils.clamp((radius - 0.18) / 0.75, 0, 1),
          ) +
          Math.random() * 0.08,

        height:
          family < 0.25
            ? (Math.random() - 0.5) * 0.015
            : family < 0.8
              ? (Math.random() - 0.5) * 0.05
              : (Math.random() - 0.5) * 0.18,

        drift: Math.random() * Math.PI * 2,

        driftSpeed: 0.15 + Math.random() * 0.2,

        driftAmount: 0.015 + Math.random() * 0.02,

        consume: Math.random() < 0.04,
      };

      this.group.add(particle);

      this.orbitParticles.push(particle);
    }

    this.group.add(this.singularity);

    // ------------------------------------------------
    // INNER CORE
    // ------------------------------------------------

    this.innerCore = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.045,

        32,

        32,
      ),

      new THREE.MeshBasicMaterial({
        color: 0x000000,
      }),
    );

    this.group.add(this.innerCore);

    this.group.position.set(0.04, -0.03, 0.02);

    // ------------------------------------------------
    // EVENT HORIZON
    // ------------------------------------------------

    this.eventHorizon = new THREE.Mesh(
      new THREE.SphereGeometry(
        0.15,

        32,

        32,
      ),

      new THREE.MeshPhysicalMaterial({
        color: 0x040404,

        transparent: true,

        opacity: 0.1,

        transmission: 0.0,

        metalness: 0.0,

        roughness: 0.55,

        clearcoat: 1.0,

        depthWrite: false,
      }),
    );

    this.group.add(this.eventHorizon);

    // ------------------------------------------------
    // PHOTON ARC
    // ------------------------------------------------

    const arcGeometry = new THREE.TorusGeometry(
      0.115, // radius

      0.0025, // thickness

      8,

      64,

      Math.PI * 0.22, // about 40°
    );

    const arcMaterial = new THREE.MeshStandardMaterial({
      color: 0xffe8b5,

      emissive: 0xc79b4a,

      emissiveIntensity: 0.08,

      metalness: 0.2,

      roughness: 0.8,

      transparent: true,

      opacity: 0.7,
    });

    this.photonArc = new THREE.Mesh(
      arcGeometry,

      arcMaterial,
    );

    this.photonArc.rotation.x = THREE.MathUtils.degToRad(68);

    // this.group.add(this.photonArc);
    // TODO:
    // Replace with a physically-inspired gravitational lensing effect
    // during close approach to the event horizon.

    // ------------------------------------------------
    // DEVELOPMENT SCALE
    // ------------------------------------------------

    this.group.scale.setScalar(3);

    // ------------------------------------------------
    // DEVELOPMENT ORIENTATION
    // ------------------------------------------------

    this.group.rotation.set(
      THREE.MathUtils.degToRad(-12),

      THREE.MathUtils.degToRad(18),

      THREE.MathUtils.degToRad(8),
    );
  }

  // =====================================================
  //
  // INVITATION
  //
  // =====================================================

  setInvitation(active) {
    this.invitationActive = active;
  }

  update(delta) {
    this.time += delta;

    // ------------------------------------------------
    //
    // INVITATION PULSE
    //
    // ------------------------------------------------

    let invitationPulse = 0;

    if (this.invitationActive) {
      // Slow cosmic heartbeat.

      invitationPulse = (Math.sin(this.time * 1.6) + 1) * 0.5;
    }

    // ------------------------------------------------
    //
    // INNER CORE — INVITATION
    //
    // ------------------------------------------------

    if (this.invitationActive) {
      const glow = 0.015 + invitationPulse * 0.12;

      this.innerCore.material.color.setRGB(glow, glow * 0.32, 0);
    } else {
      this.innerCore.material.color.set(0x000000);
    }

    const breathe = 1 + Math.sin(this.time * 0.45) * 0.008;

    this.shell.scale.setScalar(breathe);

    this.ringPulse = Math.max(0, (this.ringPulse || 0) - delta * 1.5);

    this.plasmaTrail.update(delta);

    // // TEMPORARY DEBUG
    // this.spark += delta * 2.0;

    // // if (this.sparkMesh) {
    // //   this.sparkMesh.visible = true;

    // //   const angle = this.spark;
    // //   const radius = 0.4;

    // //   this.sparkMesh.position.set(
    // //     Math.cos(angle) * radius,
    // //     Math.sin(angle) * radius,
    // //     0,
    // //   );

    // //   this.sparkMesh.rotation.z = angle;
    // // }

    // ------------------------------------------------
    // EVENT HORIZON
    // ------------------------------------------------

    if (this.eventHorizon) {
      const horizonScale = 1 + Math.sin(this.time * 0.28) * 0.015;

      this.eventHorizon.scale.setScalar(horizonScale);
    }

    this.eventHorizon.material.opacity =
      0.16 + Math.sin(this.time * 0.22) * 0.02;

    // ------------------------------------------------
    // ACCRETION RING
    // ------------------------------------------------

    if (this.accretionRing) {
      this.accretionRing.rotation.z += delta * 0.45;

      this.accretionRing.position.x = Math.sin(this.time * 0.18) * 0.003;

      this.accretionRing.position.y = Math.cos(this.time * 0.14) * 0.002;

      this.accretionRing.rotation.x =
        THREE.MathUtils.degToRad(68) + Math.sin(this.time * 0.25) * 0.02;

      this.accretionRing.rotation.y =
        THREE.MathUtils.degToRad(18) + Math.cos(this.time * 0.18) * 0.015;

      this.accretionRing.material.emissiveIntensity =
        0.12 + Math.sin(this.time * 0.35) * 0.02 + (this.ringPulse || 0) * 0.25;

      const ringScale =
        1 + Math.sin(this.time * 0.45) * 0.008 + (this.ringPulse || 0) * 0.05;

      this.accretionRing.scale.setScalar(ringScale);

      // ------------------------------------------------
      // PHOTON ARC
      // ------------------------------------------------

      if (this.photonArc) {
        this.photonArc.rotation.z += delta * 0.2;
      }

      if (this.orbitParticles) {
        this.orbitParticles.forEach((particle) => {
          if (!particle.visible) {
            particle.userData.respawnTimer -= delta;

            if (particle.userData.respawnTimer <= 0) {
              particle.userData.radius = THREE.MathUtils.randFloat(0.85, 0.95);
              particle.userData.angle = Math.random() * Math.PI * 2;
              particle.userData.consume = Math.random() < 0.08;

              particle.visible = true;
            }

            return;
          }

          const radiusFactor = THREE.MathUtils.inverseLerp(
            0.18,

            0.95,

            particle.userData.radius,
          );

          const orbitalSpeed = THREE.MathUtils.lerp(
            1.35, // Inner disk

            0.35, // Outer disk

            radiusFactor,
          );

          particle.userData.angle +=
            delta * particle.userData.speed * orbitalSpeed;

          particle.rotation.x += delta * 0.1;
          particle.rotation.y += delta * 0.06;

          if (particle.userData.consume) {
            const gravity = THREE.MathUtils.inverseLerp(
              0.95,
              0.18,
              particle.userData.radius,
            );

            const pull =
              THREE.MathUtils.lerp(0.003, 0.03, gravity) *
              (1 + this.transitEnergy * 2);

            particle.userData.radius -= delta * pull;
          }

          if (particle.userData.consume && particle.userData.radius < 0.18) {
            particle.visible = false;
            particle.userData.respawnTimer = 2.0;

            this.ringPulse = 1.0;
          }

          const animatedRadius =
            particle.userData.radius +
            Math.sin(
              this.time * particle.userData.driftSpeed +
                particle.userData.drift,
            ) *
              particle.userData.driftAmount;

          const wobble =
            Math.sin(this.time * 0.35 + particle.userData.drift * 2.0) * 0.012;

          particle.position.set(
            Math.cos(particle.userData.angle + wobble) * animatedRadius,

            particle.userData.height +
              Math.sin(
                this.time * particle.userData.driftSpeed +
                  particle.userData.drift,
              ) *
                particle.userData.driftAmount *
                0.35,

            Math.sin(particle.userData.angle + wobble) * animatedRadius,
          );

          const fade = THREE.MathUtils.smoothstep(
            particle.userData.radius,
            0.18,
            0.45,
          );

          particle.material.opacity = fade;
        });
      }
    }
  }
  setTransitEnergy(value) {
    this.transitEnergy = value;
  }
  get object() {
    return this.group;
  }
}
