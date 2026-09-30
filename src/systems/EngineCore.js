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
    this.presenceIntensity = 0;
    this.journeyProgress = 0;
    this.journeyDebrisCaptured = false;

    // ------------------------------------------------
    // CORE PRESENCE COLOR
    // ------------------------------------------------

    this.innerCoreBaseEmissiveIntensity = 0;

    this.innerCorePresenceEmissiveBoost = 1.5;

    this.innerCoreInvitationBaseEmissiveIntensity = 0.15;

    this.innerCoreInvitationPulseEmissiveBoost = 1.5;

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

        depthWrite: false,
      }),
    );

    this.singularity.renderOrder = 0;

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

    this.accretionRingJourneyScale = this.accretionRing.scale.clone();
    this.accretionRingJourneyEmissiveIntensity =
      this.accretionRing.material.emissiveIntensity;

    // ------------------------------------------------
    // ORBIT PARTICLES
    // ------------------------------------------------

    this.orbitParticles = [];

    const captureSectorCenters = [0.25, 1.35, 3.15, 5.05];

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

      const concentrated = Math.random() < 0.68;

      const sectorCenter = concentrated
        ? captureSectorCenters[
            Math.floor(Math.random() * captureSectorCenters.length)
          ]
        : 0;

      const sectorSpread = 0.35 + Math.random() * 0.3;

      const angle = concentrated
        ? sectorCenter +
          (Math.random() + Math.random() - 1) * sectorSpread
        : Math.random() * Math.PI * 2;

      let radius;

      let inclination;

      // ------------------------------------------------
      // RADIUS
      // ------------------------------------------------

      if (family < 0.25) {
        // Inner dust

        radius = 0.18 + Math.random() * 0.1;

        inclination = THREE.MathUtils.degToRad(
          THREE.MathUtils.randFloat(-3, 3),
        );
      } else if (family < 0.8) {
        // Main accretion disk

        radius =
          (cluster ? 0.36 : 0.32) + Math.random() * (cluster ? 0.08 : 0.18);

        const inclinationTendencies = [-9, 0, 7];

        inclination = THREE.MathUtils.degToRad(
          inclinationTendencies[
            Math.floor(Math.random() * inclinationTendencies.length)
          ] + THREE.MathUtils.randFloat(-2.5, 2.5),
        );
      } else {
        // Outer drifting dust

        radius = 0.6 + Math.random() * 0.35;

        inclination = THREE.MathUtils.degToRad(
          THREE.MathUtils.randFloat(-14, 14),
        );
      }

      // ------------------------------------------------
      // MATTER LANES
      // ------------------------------------------------

      const lane = Math.floor(Math.random() * 6);

      radius += lane * 0.015;

      // ------------------------------------------------
      // MATERIAL
      // ------------------------------------------------

      const materialRoll = Math.random();

      let palette;

      let brightness;

      let roughness;

      let metalness;

      if (materialRoll < 0.35) {
        // Dark titanium / charcoal

        palette = [0x111419, 0x1a1d22, 0x24282e, 0x30343a];
        brightness = THREE.MathUtils.randFloat(0.72, 1.0);
        roughness = THREE.MathUtils.randFloat(0.62, 0.88);
        metalness = THREE.MathUtils.randFloat(0.18, 0.42);
      } else if (materialRoll < 0.6) {
        // Cool steel / blue-gray metal

        palette = [0x1b252f, 0x27333d, 0x36434d, 0x46525b];
        brightness = THREE.MathUtils.randFloat(0.68, 0.96);
        roughness = THREE.MathUtils.randFloat(0.38, 0.68);
        metalness = THREE.MathUtils.randFloat(0.48, 0.78);
      } else if (materialRoll < 0.8) {
        // Mineral / stone

        palette =
          Math.random() < 0.16
            ? [0x737579, 0x858580]
            : [0x303237, 0x3b3f44, 0x4b5054];
        brightness = THREE.MathUtils.randFloat(0.7, 0.98);
        roughness = THREE.MathUtils.randFloat(0.78, 0.98);
        metalness = THREE.MathUtils.randFloat(0.02, 0.14);
      } else if (materialRoll < 0.95) {
        // Warm iron / oxidized matter

        palette = [0x302521, 0x3b2b25, 0x493129, 0x41352d];
        brightness = THREE.MathUtils.randFloat(0.7, 0.96);
        roughness = THREE.MathUtils.randFloat(0.64, 0.9);
        metalness = THREE.MathUtils.randFloat(0.1, 0.38);
      } else {
        // Rare pale, warm metallic, or reflective catch

        const accentRoll = Math.random();

        if (accentRoll < 0.45) {
          palette = [0x8b8a84, 0xa09b8e];
          brightness = THREE.MathUtils.randFloat(0.72, 0.94);
          roughness = THREE.MathUtils.randFloat(0.72, 0.94);
          metalness = THREE.MathUtils.randFloat(0.02, 0.12);
        } else if (accentRoll < 0.85) {
          palette = [0x5f4c2d, 0x715932];
          brightness = THREE.MathUtils.randFloat(0.68, 0.88);
          roughness = THREE.MathUtils.randFloat(0.42, 0.68);
          metalness = THREE.MathUtils.randFloat(0.46, 0.7);
        } else {
          palette = [0x080a0d, 0x10141a];
          brightness = THREE.MathUtils.randFloat(0.78, 1.0);
          roughness = THREE.MathUtils.randFloat(0.2, 0.42);
          metalness = THREE.MathUtils.randFloat(0.72, 0.92);
        }
      }

      const color = new THREE.Color(
        palette[Math.floor(Math.random() * palette.length)],
      ).multiplyScalar(brightness);

      const material = new THREE.MeshStandardMaterial({
        color,

        roughness,
        metalness,

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

      const silhouette = Math.random();

      if (silhouette < 0.28) {
        // Stretched shard

        particle.scale.set(
          THREE.MathUtils.randFloat(1.6, 2.25),
          THREE.MathUtils.randFloat(0.38, 0.68),
          THREE.MathUtils.randFloat(0.42, 0.78),
        );
      } else if (silhouette < 0.55) {
        // Flattened chip

        particle.scale.set(
          THREE.MathUtils.randFloat(0.9, 1.45),
          THREE.MathUtils.randFloat(0.28, 0.5),
          THREE.MathUtils.randFloat(0.8, 1.35),
        );
      } else if (silhouette < 0.8) {
        // Squat irregular chunk

        particle.scale.set(
          THREE.MathUtils.randFloat(0.7, 1.25),
          THREE.MathUtils.randFloat(0.58, 0.9),
          THREE.MathUtils.randFloat(0.68, 1.2),
        );
      } else {
        // Narrow fragment

        particle.scale.set(
          THREE.MathUtils.randFloat(0.35, 0.62),
          THREE.MathUtils.randFloat(0.55, 0.95),
          THREE.MathUtils.randFloat(1.35, 2.0),
        );
      }

      particle.userData = {
        angle,

        radius,

        speed: THREE.MathUtils.randFloat(0.88, 1.12),

        height:
          family < 0.25
            ? (Math.random() - 0.5) * 0.012
            : family < 0.8
              ? (Math.random() - 0.5) * 0.028
              : (Math.random() - 0.5) * 0.06,

        inclination,

        ascendingNode: Math.random() * Math.PI * 2,

        concentrated,

        sectorCenter,

        sectorSpread,

        tumble: new THREE.Vector3(
          THREE.MathUtils.randFloatSpread(0.2),
          THREE.MathUtils.randFloatSpread(0.16),
          THREE.MathUtils.randFloatSpread(0.14),
        ),

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

      new THREE.MeshStandardMaterial({
        color: 0x080201,

        emissive: 0xff3a12,

        emissiveIntensity: 0,

        metalness: 0,

        roughness: 0.45,
      }),
    );

    this.innerCore.renderOrder = 1;

    this.group.add(this.innerCore);

    this.innerCoreJourneyColor = this.innerCore.material.color.clone();
    this.innerCoreJourneyEmissive = this.innerCore.material.emissive.clone();
    this.innerCoreJourneyScale = this.innerCore.scale.clone();
    this.innerCoreJourneyDarkColor = new THREE.Color(0x010101);
    this.innerCoreJourneyDarkEmissive = new THREE.Color(0x050100);

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

    this.singularityJourneyScale = this.singularity.scale.clone();
    this.singularityJourneyVisible = this.singularity.visible;
    this.eventHorizonJourneyScale = this.eventHorizon.scale.clone();
    this.eventHorizonJourneyOpacity = this.eventHorizon.material.opacity;

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
    this.plasmaTrail.setInvitation(active);
  }

  acceptInvitation() {
    this.plasmaTrail.acceptInvitation();
  }

  setPresenceIntensity(value) {
    this.presenceIntensity = THREE.MathUtils.clamp(value, 0, 1);
  }

  setJourneyProgress(value) {
    const next = THREE.MathUtils.clamp(value, 0, 1);

    if (next > 0 && !this.journeyDebrisCaptured) {
      this.captureJourneyDebrisState();
    }

    if (next === 0 && this.journeyProgress > 0) {
      this.resetJourneyVisuals();
      return;
    }

    this.journeyProgress = next;
  }

  resetJourneyVisuals() {
    this.journeyProgress = 0;
    this.innerCore.material.color.copy(this.innerCoreJourneyColor);
    this.innerCore.material.emissive.copy(this.innerCoreJourneyEmissive);
    this.innerCore.material.emissiveIntensity =
      this.innerCoreBaseEmissiveIntensity +
      this.presenceIntensity * this.innerCorePresenceEmissiveBoost;
    this.innerCore.scale.copy(this.innerCoreJourneyScale);
    this.singularity.scale.copy(this.singularityJourneyScale);
    this.singularity.visible = this.singularityJourneyVisible;
    this.eventHorizon.scale.copy(this.eventHorizonJourneyScale);
    this.eventHorizon.material.opacity = this.eventHorizonJourneyOpacity;
    this.accretionRing.scale.copy(this.accretionRingJourneyScale);
    this.accretionRing.material.emissiveIntensity =
      this.accretionRingJourneyEmissiveIntensity;
    this.restoreJourneyDebrisState();
  }

  captureJourneyDebrisState() {
    this.orbitParticles.forEach((particle) => {
      particle.userData.journeyState = {
        radius: particle.userData.radius,
        angle: particle.userData.angle,
        visible: particle.visible,
        opacity: particle.material.opacity,
        position: particle.position.clone(),
        rotation: particle.rotation.clone(),
      };
    });
    this.journeyDebrisCaptured = true;
  }

  restoreJourneyDebrisState() {
    if (!this.journeyDebrisCaptured) return;

    this.orbitParticles.forEach((particle) => {
      const state = particle.userData.journeyState;
      if (!state) return;

      particle.userData.radius = state.radius;
      particle.userData.angle = state.angle;
      particle.visible = state.visible;
      particle.material.opacity = state.opacity;
      particle.position.copy(state.position);
      particle.rotation.copy(state.rotation);
      particle.userData.journeyState = null;
    });
    this.journeyDebrisCaptured = false;
  }

  updateJourneyDebris(particle, delta) {
    const state = particle.userData.journeyState;
    if (!state?.visible) {
      particle.visible = false;
      return;
    }

    const variation = (Math.sin(particle.userData.drift * 12.9898) + 1) * 0.5;
    const secondary = (variation * 7.13) % 1;
    const delay = 0.003 + variation * 0.022;
    const progress = THREE.MathUtils.clamp(
      (this.journeyProgress - delay) / (1 - delay),
      0,
      1,
    );
    const curved = THREE.MathUtils.smoothstep(progress, 0, 0.38);
    const infall = Math.pow(
      THREE.MathUtils.clamp((progress - 0.1) / 0.9, 0, 1),
      1.7 + secondary * 0.3,
    );
    const radiusScale = 1 - infall;
    const direction = variation < 0.12 ? -1 : 1;
    const angle =
      state.angle +
      direction *
        (curved * 1.25 +
          progress * progress * (6.2 + variation * 3.8));
    const animatedRadius =
      state.radius +
      Math.sin(
        this.time * particle.userData.driftSpeed + particle.userData.drift,
      ) *
        particle.userData.driftAmount;
    const displayedRadius = animatedRadius * radiusScale;

    particle.visible = displayedRadius >= 0.055;
    if (!particle.visible) return;

    particle.rotation.x += delta * particle.userData.tumble.x;
    particle.rotation.y += delta * particle.userData.tumble.y;
    particle.rotation.z += delta * particle.userData.tumble.z;

    const cosNode = Math.cos(particle.userData.ascendingNode);
    const sinNode = Math.sin(particle.userData.ascendingNode);
    const cosInclination = Math.cos(particle.userData.inclination);
    const sinInclination = Math.sin(particle.userData.inclination);
    const orbitPhase = angle - particle.userData.ascendingNode;
    const cosAngle = Math.cos(orbitPhase);
    const sinAngle = Math.sin(orbitPhase);
    const verticalDrift =
      Math.sin(
        this.time * particle.userData.driftSpeed + particle.userData.drift,
      ) *
      particle.userData.driftAmount *
      0.25;

    particle.position.set(
      (cosNode * cosAngle - sinNode * sinAngle * cosInclination) *
        displayedRadius,
      (particle.userData.height + verticalDrift) * radiusScale +
        sinAngle * sinInclination * displayedRadius,
      (sinNode * cosAngle + cosNode * sinAngle * cosInclination) *
        displayedRadius,
    );
    particle.material.opacity =
      state.opacity * THREE.MathUtils.smoothstep(displayedRadius, 0.055, 0.14);
  }

  update(delta) {
    this.time += delta;

    const journeyProgress = this.journeyProgress;
    const concentration = THREE.MathUtils.smoothstep(journeyProgress, 0.08, 0.68);
    const darkening = THREE.MathUtils.smoothstep(journeyProgress, 0.42, 0.94);
    const earlyReaction = Math.sin(
      Math.PI * THREE.MathUtils.smoothstep(journeyProgress, 0, 0.58),
    );

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

    const presenceEmissiveIntensity =
      this.presenceIntensity * this.innerCorePresenceEmissiveBoost;

    let normalEmissiveIntensity;

    if (this.invitationActive) {
      const invitationEmissiveIntensity =
        this.innerCoreInvitationBaseEmissiveIntensity +
        invitationPulse * this.innerCoreInvitationPulseEmissiveBoost;

      normalEmissiveIntensity =
        this.innerCoreBaseEmissiveIntensity +
        presenceEmissiveIntensity +
        invitationEmissiveIntensity;
    } else {
      normalEmissiveIntensity =
        this.innerCoreBaseEmissiveIntensity + presenceEmissiveIntensity;
    }

    const journeyPulse =
      earlyReaction *
      (1.15 + Math.sin(this.time * (2.2 + concentration * 1.8)) * 0.22);
    const orangeStrength = 1 - darkening;

    this.innerCore.material.emissiveIntensity =
      (normalEmissiveIntensity + journeyPulse) * orangeStrength;
    this.innerCore.material.color
      .copy(this.innerCoreJourneyColor)
      .lerp(this.innerCoreJourneyDarkColor, darkening);
    this.innerCore.material.emissive
      .copy(this.innerCoreJourneyEmissive)
      .lerp(this.innerCoreJourneyDarkEmissive, darkening);

    const coreBreath =
      1 +
      earlyReaction * (0.055 + Math.sin(this.time * 2.4) * 0.018) -
      darkening * 0.12;
    this.innerCore.scale
      .copy(this.innerCoreJourneyScale)
      .multiplyScalar(coreBreath);

    this.singularity.scale
      .copy(this.singularityJourneyScale)
      .multiplyScalar(1 + concentration * 0.32);

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
      const horizonScale =
        1 + Math.sin(this.time * 0.28) * 0.015 + darkening * 0.08;

      this.eventHorizon.scale
        .copy(this.eventHorizonJourneyScale)
        .multiplyScalar(horizonScale);
    }

    this.eventHorizon.material.opacity =
      THREE.MathUtils.lerp(
        0.16 + Math.sin(this.time * 0.22) * 0.02,
        0.82,
        darkening,
      );

    // ------------------------------------------------
    // ACCRETION RING
    // ------------------------------------------------

    if (this.accretionRing) {
      this.accretionRing.rotation.z += delta * (0.45 + concentration * 1.15);

      this.accretionRing.position.x = Math.sin(this.time * 0.18) * 0.003;

      this.accretionRing.position.y = Math.cos(this.time * 0.14) * 0.002;

      this.accretionRing.rotation.x =
        THREE.MathUtils.degToRad(68) + Math.sin(this.time * 0.25) * 0.02;

      this.accretionRing.rotation.y =
        THREE.MathUtils.degToRad(18) + Math.cos(this.time * 0.18) * 0.015;

      this.accretionRing.material.emissiveIntensity =
        (0.12 +
          Math.sin(this.time * 0.35) * 0.02 +
          (this.ringPulse || 0) * 0.25 +
          earlyReaction * 0.12) *
        (1 - darkening * 0.72);

      const ringScale =
        1 +
        Math.sin(this.time * 0.45) * 0.008 +
        (this.ringPulse || 0) * 0.05 -
        darkening * 0.1;

      this.accretionRing.scale.setScalar(ringScale);

      // ------------------------------------------------
      // PHOTON ARC
      // ------------------------------------------------

      if (this.photonArc) {
        this.photonArc.rotation.z += delta * 0.2;
      }

      if (this.orbitParticles) {
        this.orbitParticles.forEach((particle) => {
          if (this.journeyProgress > 0) {
            this.updateJourneyDebris(particle, delta);
            return;
          }

          if (!particle.visible) {
            particle.userData.respawnTimer -= delta;

            if (particle.userData.respawnTimer <= 0) {
              particle.userData.radius = THREE.MathUtils.randFloat(0.85, 0.95);
              particle.userData.angle = particle.userData.concentrated
                ? particle.userData.sectorCenter +
                  (Math.random() + Math.random() - 1) *
                    particle.userData.sectorSpread
                : Math.random() * Math.PI * 2;
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
            1.65, // Inner disk

            0.32, // Outer disk

            THREE.MathUtils.clamp(radiusFactor, 0, 1),
          ) * particle.userData.speed;

          particle.userData.angle += delta * orbitalSpeed;

          particle.rotation.x += delta * particle.userData.tumble.x;
          particle.rotation.y += delta * particle.userData.tumble.y;
          particle.rotation.z += delta * particle.userData.tumble.z;

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

          const orbitAngle = particle.userData.angle + wobble;

          const cosNode = Math.cos(particle.userData.ascendingNode);
          const sinNode = Math.sin(particle.userData.ascendingNode);
          const cosInclination = Math.cos(particle.userData.inclination);
          const sinInclination = Math.sin(particle.userData.inclination);

          const orbitPhase = orbitAngle - particle.userData.ascendingNode;

          const cosAngle = Math.cos(orbitPhase);
          const sinAngle = Math.sin(orbitPhase);

          const verticalDrift =
            Math.sin(
              this.time * particle.userData.driftSpeed + particle.userData.drift,
            ) *
            particle.userData.driftAmount *
            0.25;

          particle.position.set(
            (cosNode * cosAngle - sinNode * sinAngle * cosInclination) *
              animatedRadius,

            particle.userData.height +
              sinAngle * sinInclination * animatedRadius +
              verticalDrift,

            (sinNode * cosAngle + cosNode * sinAngle * cosInclination) *
              animatedRadius,
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
