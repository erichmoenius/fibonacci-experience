import * as THREE from "three";
import { CameraPose } from "./CameraPose";
import { FlightSystem } from "./FlightSystem";
import { Flight } from "./Flight";
import { FreeFlight } from "./FreeFlight";
import { TravelerMode } from "./TravelerMode";

// =====================================================
// CAMERA MODES
// =====================================================

export const CameraMode = {
  EXPLORE: "explore",
  INSPECT: "inspect",
  TRAVEL: "travel",
  RETURN: "return",
};

export default class CameraDirector {
  constructor(camera, canvas) {
    this.camera = camera;

    // ------------------------------------------------
    // CAMERA MODE
    // ------------------------------------------------

    this.mode = CameraMode.EXPLORE;
    this.previousMode = CameraMode.EXPLORE;

    this.flightStyle = "linear";

    this.inspectTarget = null;

    this.journey = null;

    this.onFlightFinished = null;

    // -------------------------------------------------
    // CAMERA ORIENTATION
    // -------------------------------------------------

    this.yaw = 0;

    this.yawTarget = new THREE.Vector3();

    // ------------------------------------------------
    // TARGETS
    // ------------------------------------------------

    // Current camera position (the only live camera position)
    this.position = new THREE.Vector3(0, 0, 5);

    // Explore/home position
    this.basePosition = this.position.clone();

    // Destination for smooth transitions
    this.targetPosition = new THREE.Vector3(0, 0, 5);

    // Camera look target
    this.lookTarget = new THREE.Vector3(0, 0, 0);

    // Home camera pose

    this.homePosition = this.targetPosition.clone();
    this.homeLookTarget = this.lookTarget.clone();

    // ------------------------------------------------
    // ACTIVE TARGET
    // ------------------------------------------------

    this.currentTarget = new THREE.Vector3(0, 0, 0);

    // Explore keeps its own horizontal orientation baseline.
    this.exploreForward = new THREE.Vector3(0, 0, -1);
    this.captureExploreForward();

    // ------------------------------------------------
    // FUTURE FLIGHT SYSTEM
    // ------------------------------------------------

    this.currentPose = new CameraPose();
    this.flightSystem = new FlightSystem();

    // -------------------------------------------------
    // TRAVELER MODE
    // -------------------------------------------------

    this.travelerMode = new TravelerMode();

    // -------------------------------------------------
    // FREE FLIGHT
    // -------------------------------------------------

    this.freeFlight = new FreeFlight(this.travelerMode, canvas);
    this.exploreTravel = null;
    this.travelRaycaster = new THREE.Raycaster();

    // CameraDirector starts in EXPLORE mode.
    // Activate FreeFlight explicitly for the initial state.

    this.freeFlight.start();

    console.log("🛩️ CameraDirector → FreeFlight created");

    // -------------------------------------------------
    // FLIGHT FINISHED
    // -------------------------------------------------

    // CameraDirector.update handles completion after applying the final pose.
    // ------------------------------------------------
    // CAMERA OFFSET
    // ------------------------------------------------

    this.offset = new THREE.Vector3();

    // ------------------------------------------------
    // CAMERA CHANNELS
    // ------------------------------------------------

    this.channels = {
      parallax: new THREE.Vector3(),

      cinematic: new THREE.Vector3(),

      focus: new THREE.Vector3(),

      shake: new THREE.Vector3(),
    };

    // ------------------------------------------------
    // PARALLAX
    // ------------------------------------------------

    this.parallax = new THREE.Vector2();

    // ------------------------------------------------
    // INTERNAL MOTION
    // ------------------------------------------------

    this.velocity = new THREE.Vector3();

    this.lookVelocity = new THREE.Vector3();

    // ------------------------------------------------
    // TIME
    // ------------------------------------------------

    this.time = 0;

    // ------------------------------------------------
    // TEMP VECTORS
    // (avoid allocations every frame)
    // ------------------------------------------------

    this.tempA = new THREE.Vector3();

    this.tempB = new THREE.Vector3();

    this.tempC = new THREE.Vector3();

    this.approachStartPosition = new THREE.Vector3();

    this.approachStartLookTarget = new THREE.Vector3();

    this.approachDirection = new THREE.Vector3();

    this.approachCorePosition = new THREE.Vector3();

    this.approachTargetPosition = new THREE.Vector3();

    this.approachCoreObject = null;

    this.approachActive = false;

    this.approachElapsed = 0;

    this.approachDuration = 3;

    this.approachRadius = 8.0;

    this.horizonStartPosition = new THREE.Vector3();

    this.horizonStartLookTarget = new THREE.Vector3();

    this.horizonTargetPosition = new THREE.Vector3();

    this.horizonCorePosition = new THREE.Vector3();

    this.horizonActive = false;

    this.horizonElapsed = 0;

    this.horizonDuration = 3;

    this.horizonRadius = 0.75;

    this.crossingStartPosition = new THREE.Vector3();

    this.crossingForward = new THREE.Vector3();

    this.crossingDirection = new THREE.Vector3();

    this.crossingCorePosition = new THREE.Vector3();

    this.crossingTargetPosition = new THREE.Vector3();

    this.crossingLookTarget = new THREE.Vector3();

    this.crossingCoreObject = null;

    this.crossingActive = false;

    this.crossingElapsed = 0;

    this.crossingDuration = 4;

    this.crossingEndpointDistance = 0.75;

    // ------------------------------------------------
    // SETTINGS
    // ------------------------------------------------

    this.positionDamping = 0.035;

    this.lookDamping = 0.05;

    this.maxSpeed = 0.08;

    this.floatStrength = 0.1;

    this.inspectParallaxStrength = 0.25;

    this.floatSpeed = 0.18;
  }

  // =====================================================
  // PUBLIC API/MODES
  // =====================================================

  setMode(mode) {
    if (this.mode === mode) {
      if (mode === CameraMode.EXPLORE) {
        this.freeFlight.start();
      }

      return;
    }

    this.previousMode = this.mode;
    this.mode = mode;

    // -------------------------------------------------
    // FREE FLIGHT
    // -------------------------------------------------

    if (mode === CameraMode.EXPLORE) {
      this.freeFlight.start();
    } else {
      this.freeFlight.stop();
    }

    // -------------------------------------------------
    // EXPLORE BASE POSITION
    // -------------------------------------------------

    if (
      mode === CameraMode.EXPLORE &&
      this.previousMode !== CameraMode.EXPLORE
    ) {
      this.basePosition.copy(this.position);
      this.captureExploreForward();
    }
  }

  isMode(mode) {
    return this.mode === mode;
  }

  captureExploreForward() {
    this.exploreForward.subVectors(this.currentTarget, this.position);

    if (this.exploreForward.lengthSq() > 0.000001) {
      this.exploreForward.normalize();
    }
  }

  setExploreTravel(flight) {
    this.exploreTravel = flight;
    this.freeFlight.reset();
    flight?.reset();
  }

  inspect(target, lookAt = null) {
    this.setMode(CameraMode.INSPECT);

    // CameraPose API

    if (target?.position && target?.lookTarget) {
      this.targetPosition.copy(target.position);

      this.lookTarget.copy(target.lookTarget);

      return;
    }

    // Legacy API
    this.targetPosition.copy(target);
    this.lookTarget.copy(lookAt ?? target);
  }

  travel(position, lookAt = position) {
    this.inspect(position, lookAt);

    this.setMode(CameraMode.TRAVEL);
  }

  cancelTravel() {
    this.setMode(CameraMode.EXPLORE);
  }

  cancel() {
    this.flightSystem.stop();

    this.cancelTravel();
  }

  beginJourney(journey) {
    this.journey = journey;

    this.flightSystem.stop();

    this.currentPose.position.copy(this.position);

    this.camera.getWorldDirection(this.tempA).normalize();

    this.currentPose.lookTarget
      .copy(this.position)
      .addScaledVector(this.tempA, 10);

    this.targetPosition.copy(this.position);
    this.lookTarget.copy(this.currentPose.lookTarget);
    this.currentTarget.copy(this.currentPose.lookTarget);

    this.setMode(CameraMode.TRAVEL);
  }

  beginCoreApproach(coreObject) {
    if (!coreObject?.getWorldPosition) return;

    this.approachCoreObject = coreObject;
    this.approachElapsed = 0;
    this.approachStartPosition.copy(this.position);
    this.approachStartLookTarget.copy(this.currentTarget);

    coreObject.getWorldPosition(this.approachCorePosition);

    this.approachDirection.set(0, 0, 1);

    this.approachActive = true;
  }

  beginCoreHorizon(coreObject) {
    if (!coreObject?.getWorldPosition) return;

    this.approachCoreObject = coreObject;
    this.horizonElapsed = 0;
    this.horizonStartPosition.copy(this.position);
    this.horizonStartLookTarget.copy(this.currentTarget);
    this.horizonActive = true;
  }

  beginCrossing(crossing) {
    const target = crossing?.target;
    const direction = crossing?.direction;

    if (!target?.getWorldPosition || !direction) return;

    this.crossingCoreObject = target;
    this.crossingElapsed = 0;
    this.crossingStartPosition.copy(this.position);
    this.camera.getWorldDirection(this.crossingForward).normalize();
    this.crossingDirection.copy(direction).normalize();
    this.crossingEndpointDistance = crossing.endpointDistance ?? 0.75;
    this.crossingActive = true;
  }

  isInJourney() {
    return this.journey !== null;
  }

  returnHome(pose = null, immediate = false) {
    this.flightSystem.stop();

    // -------------------------------------------------
    // RESET FREE FLIGHT
    // -------------------------------------------------

    this.freeFlight.reset();
    this.exploreTravel?.reset();

    // -------------------------------------------------
    // RESET ORIENTATION
    // -------------------------------------------------

    this.yaw = 0;

    // -------------------------------------------------
    // RETURN HOME
    // -------------------------------------------------

    this.basePosition.copy(pose?.position ?? this.homePosition);

    this.setMode(CameraMode.RETURN);

    this.targetPosition.copy(this.basePosition);
    this.lookTarget.copy(pose?.lookTarget ?? this.homeLookTarget);
    this.currentTarget.copy(this.lookTarget);

    if (immediate) {
      this.finishReturn();
      this.applyComputedPosition();
    }
  }

  travel(targetPose) {
    if (!this.currentPose) {
      throw new Error("currentPose is undefined");
    }

    if (!this.currentPose.position) {
      throw new Error("currentPose.position is undefined");
    }

    if (!targetPose) {
      throw new Error("targetPose is undefined");
    }

    const flight = this.createFlight(targetPose);

    this.logTravel(targetPose);

    this.beginFlight(flight);
  }

  createFlight(targetPose) {
    const flight = new Flight();

    flight.startPose.copy(this.currentPose);
    flight.targetPose.copy(targetPose);

    flight.duration = this.journey ? 3.0 : 2.0;

    return flight;
  }

  beginFlight(flight) {
    this.setMode(CameraMode.TRAVEL);

    this.flightSystem.start(flight);
  }

  logTravel(targetPose) {
    console.log("Travel started");

    console.log("currentPose", this.currentPose);
    console.log("targetPose", targetPose);

    console.log("currentPose.position:", this.currentPose.position);
    console.log("currentPose.lookTarget:", this.currentPose.lookTarget);

    console.log("targetPose.position:", targetPose.position);
    console.log("targetPose.lookTarget:", targetPose.lookTarget);
  }

  // =====================================================
  // UPDATE
  // =====================================================

  updateExplore(delta) {
    const floatY = Math.sin(this.time * this.floatSpeed) * this.floatStrength;

    this.channels.cinematic.set(0, floatY, 0);

    // -------------------------------------------------
    // FREE FLIGHT
    // -------------------------------------------------

    if (this.exploreTravel) {
      this.exploreTravel.updateAim(this.freeFlight.pointer, this.freeFlight.target);
    } else {
      this.freeFlight.update(delta);
    }

    const flightOffset = this.freeFlight.getOffset();

    const lookIntent = this.freeFlight.getLookIntent();

    // -------------------------------------------------
    // FREE LOOK — HORIZONTAL YAW
    // -------------------------------------------------

    const yawSensitivity = 0.002;

    if (lookIntent.yaw !== 0) {
      this.yaw += lookIntent.yaw * yawSensitivity;
    }

    // Consume the mouse movement impulse.

    lookIntent.yaw = 0;

    if (this.exploreTravel) {
      if (this.exploreTravel.hasAim) {
        this.applyLookTarget();
        this.camera.updateWorldMatrix(true, false);
        this.travelRaycaster.setFromCamera(this.exploreTravel.aim, this.camera);
      }
      this.exploreTravel.update(
        delta,
        this.exploreTravel.hasAim ? this.travelRaycaster.ray.direction : null,
        this.freeFlight.pointer.active,
        this.freeFlight.pointer.rmbActive,
      );
    }

    // -------------------------------------------------
    // LOOK TARGET
    // -------------------------------------------------

    // -------------------------------------------------
    // BASE EXPLORE POSITION
    // -------------------------------------------------

    this.setPosition(this.time, 0);

    // -------------------------------------------------
    // FREE FLIGHT OFFSET
    // -------------------------------------------------

    if (this.exploreTravel) {
      this.position.add(this.exploreTravel.displacement);
    } else {
      this.position.x += flightOffset.x;
      this.position.y += flightOffset.y;
      this.position.z += flightOffset.z;
    }

    // -------------------------------------------------
    // APPLY
    // -------------------------------------------------

    this.applyComputedPosition();
  }

  updateInspect(delta) {
    const floatY = Math.sin(this.time * this.floatSpeed) * this.floatStrength;

    this.channels.cinematic.set(0, floatY, 0);

    this.applyLookTarget();

    // this.setPosition(this.time, this.inspectParallaxStrength);
    const px = this.parallax.x * this.inspectParallaxStrength;
    const py = this.parallax.y * this.inspectParallaxStrength;

    this.position.copy(this.targetPosition);

    this.position.x += px;
    this.position.y += py;

    this.applyComputedPosition();
  }

  applyFlight() {
    const flight = this.flightSystem.flight;

    if (!flight) return;
  }

  updateTravel(delta) {
    if (this.approachActive) {
      this.approachElapsed = Math.min(
        this.approachElapsed + delta,
        this.approachDuration,
      );

      const progress = this.approachElapsed / this.approachDuration;
      const eased = progress * progress * (3 - 2 * progress);

      this.approachCoreObject.getWorldPosition(this.approachCorePosition);

      this.approachTargetPosition
        .copy(this.approachCorePosition)
        .addScaledVector(this.approachDirection, this.approachRadius);

      this.currentPose.position.lerpVectors(
        this.approachStartPosition,
        this.approachTargetPosition,
        eased,
      );

      this.currentPose.lookTarget.lerpVectors(
        this.approachStartLookTarget,
        this.approachCorePosition,
        eased,
      );

      this.position.copy(this.currentPose.position);
      this.currentTarget.copy(this.currentPose.lookTarget);
      this.lookTarget.copy(this.currentTarget);
      this.targetPosition.copy(this.position);

      this.applyComputedPosition();

      if (progress >= 1) {
        this.approachActive = false;
        this.approachCoreObject = null;
      }

      return;
    }

    if (this.horizonActive) {
      this.horizonElapsed = Math.min(
        this.horizonElapsed + delta,
        this.horizonDuration,
      );

      const progress = this.horizonElapsed / this.horizonDuration;
      const eased = progress * progress * (3 - 2 * progress);

      this.approachCoreObject.getWorldPosition(this.horizonCorePosition);

      this.horizonTargetPosition
        .copy(this.horizonCorePosition)
        .addScaledVector(this.approachDirection, this.horizonRadius);

      this.currentPose.position.lerpVectors(
        this.horizonStartPosition,
        this.horizonTargetPosition,
        eased,
      );

      this.currentPose.lookTarget.lerpVectors(
        this.horizonStartLookTarget,
        this.horizonCorePosition,
        eased,
      );

      this.position.copy(this.currentPose.position);
      this.currentTarget.copy(this.currentPose.lookTarget);
      this.lookTarget.copy(this.currentTarget);
      this.targetPosition.copy(this.position);

      this.applyComputedPosition();

      if (progress >= 1) {
        this.horizonActive = false;
      }

      return;
    }

    if (this.crossingActive) {
      this.crossingElapsed = Math.min(
        this.crossingElapsed + delta,
        this.crossingDuration,
      );

      const progress = this.crossingElapsed / this.crossingDuration;
      const eased = progress * progress * (3 - 2 * progress);

      this.crossingCoreObject.getWorldPosition(this.crossingCorePosition);

      this.crossingTargetPosition
        .copy(this.crossingCorePosition)
        .addScaledVector(
          this.crossingDirection,
          -this.crossingEndpointDistance,
        );

      this.currentPose.position.lerpVectors(
        this.crossingStartPosition,
        this.crossingTargetPosition,
        eased,
      );

      this.position.copy(this.currentPose.position);
      this.crossingLookTarget
        .copy(this.position)
        .addScaledVector(this.crossingForward, 10);
      this.currentPose.lookTarget.copy(this.crossingLookTarget);
      this.currentTarget.copy(this.currentPose.lookTarget);
      this.lookTarget.copy(this.currentTarget);
      this.targetPosition.copy(this.position);

      this.applyComputedPosition();

      if (progress >= 1) {
        this.crossingActive = false;
      }

      return;
    }

    this.position.copy(this.currentPose.position);

    this.applyComputedPosition();
  }

  updateReturn(delta) {
    const floatY = Math.sin(this.time * this.floatSpeed) * this.floatStrength;

    this.channels.cinematic.set(0, floatY, 0);

    this.applyLookTarget();

    this.position.lerp(this.targetPosition, 0.08);

    if (this.position.distanceTo(this.targetPosition) < 0.01) {
      this.finishReturn();
    }

    this.applyComputedPosition();
  }

  finishReturn() {
    this.position.copy(this.targetPosition);

    this.basePosition.copy(this.targetPosition);
    this.currentTarget.copy(this.lookTarget);

    this.setMode(CameraMode.EXPLORE);

    this.onReturnHome?.();
  }

  finishTravel() {
    const flight = this.flightSystem.flight;
    if (flight) {
      this.currentPose.copy(flight.targetPose);
      this.flightSystem.stop();
    }

    this.position.copy(this.currentPose.position);
    this.targetPosition.copy(this.position);
    this.lookTarget.copy(this.currentPose.lookTarget);
    this.currentTarget.copy(this.lookTarget);
    this.freeFlight.reset();
    this.exploreTravel?.reset();

    this.yaw = 0;

    this.basePosition.copy(this.position);

    this.journey = null;
    this.approachActive = false;
    this.horizonActive = false;
    this.crossingActive = false;
    this.approachCoreObject = null;
    this.crossingCoreObject = null;

    this.setMode(CameraMode.EXPLORE);
  }

  // Main update(delta)

  update(delta = 0.016) {
    this.time += delta;

    const flight = this.flightSystem.flight;

    // Update cinematic flight system
    this.flightSystem.update(delta);

    const flightFinished = flight && !this.flightSystem.flight;

    if (flight) {
      const t = flightFinished ? 1 : this.flightSystem.getProgress();

      let progress = t;

      if (this.flightStyle === "gravity") {
        progress = Math.pow(t, 3);
      }

      this.currentPose.position.lerpVectors(
        flight.startPose.position,
        flight.targetPose.position,
        progress,
      );

      this.currentPose.lookTarget.lerpVectors(
        flight.startPose.lookTarget,
        flight.targetPose.lookTarget,
        progress,
      );

      this.targetPosition.copy(this.currentPose.position);
      this.lookTarget.copy(this.currentPose.lookTarget);
    }

    // this.currentTarget.lerp(this.lookTarget, this.lookDamping);
    this.currentTarget.copy(this.lookTarget);

    if (flightFinished && !this.journey) {
      this.finishTravel();
      this.onFlightFinished?.();
    }

    switch (this.mode) {
      case CameraMode.EXPLORE:
        this.updateExplore(delta);
        break;

      case CameraMode.INSPECT:
        this.updateInspect(delta);
        break;

      case CameraMode.TRAVEL:
        this.updateTravel(delta);
        break;

      case CameraMode.RETURN:
        this.updateReturn(delta);
        break;
    }
  }

  // =====================================================
  // CAMERA
  // =====================================================

  setParallax(mouse, strength = 1) {
    return this.updateParallax(mouse, strength);
  }

  updateParallax(mouse, strength = 1) {
    this.parallax.x += (mouse.x - this.parallax.x) * 0.08;

    this.parallax.y += (mouse.y - this.parallax.y) * 0.08;

    this.channels.parallax.set(
      this.parallax.x * strength,
      this.parallax.y * strength,
      0,
    );

    return this.parallax;
  }

  // =====================================================
  // IDLE
  // =====================================================

  getIdleOffset() {
    return this.channels.cinematic;
  }

  // =====================================================
  // COMPUTE POSITION
  // =====================================================

  setPosition(time, parallaxStrength = 1) {
    return this.computePosition(time, parallaxStrength);
  }

  computePosition(time, parallaxStrength = 1) {
    const px = this.parallax.x * parallaxStrength;
    const py = this.parallax.y * parallaxStrength;

    const idle = this.getIdleOffset();

    this.position.copy(this.basePosition);

    this.position.x += Math.sin(time * 0.3) * 0.2 + px + idle.x;
    this.position.y += Math.cos(time * 0.2) * 0.2 + py + idle.y;

    return this.position;
  }

  // =====================================================
  // CAMERA POSITION
  // =====================================================

  applyComputedPosition() {
    this.currentPose.position.copy(this.position);
    this.currentPose.lookTarget.copy(this.currentTarget);

    this.applyPosition(this.position.x, this.position.y, this.position.z);

    this.applyLookTarget();
  }

  applyPosition(x, y, z) {
    if (!this.camera) return;

    // -------------------------------------------------
    // POSITION
    // -------------------------------------------------

    this.camera.position.set(x, y, z);

    // -------------------------------------------------
    // ORIENTATION
    // -------------------------------------------------

    // Orientation is handled by applyLookTarget().
    // this.camera.rotation.y = this.yaw;
  }

  // =====================================================
  // LOOK TARGET
  // =====================================================

  applyLookTarget() {
    if (!this.camera) return;

    if (this.mode === CameraMode.EXPLORE) {
      this.yawTarget
        .copy(this.exploreForward)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw)
        .add(this.position);

      this.camera.lookAt(this.yawTarget);

      return;
    }

    if (this.mode === CameraMode.TRAVEL) {
      this.camera.lookAt(this.currentTarget);

      return;
    }

    const direction = this.currentTarget.clone().sub(this.position);

    // HORIZONTAL YAW ONLY
    const horizontalDirection = new THREE.Vector3(direction.x, 0, direction.z);

    horizontalDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    const yawTarget = this.position.clone().add(horizontalDirection);

    // Preserve original vertical target level
    yawTarget.y += direction.y;

    this.camera.lookAt(yawTarget);
  }

  // =====================================================
  // TARGET
  // =====================================================

  setLookTarget(x, y, z) {
    return this.setTarget(x, y, z);
  }

  setTarget(x, y, z) {
    this.currentTarget.set(x, y, z);
  }

  // =====================================================
  // HELPERS
  // =====================================================

  getOffset() {
    return this.getFinalOffset();
  }

  getPosition() {
    return this.position;
  }

  // =====================================================
  // FINAL OFFSET
  // =====================================================

  getFinalOffset() {
    this.offset.set(0, 0, 0);

    this.offset.add(this.channels.parallax);

    this.offset.add(this.channels.cinematic);

    this.offset.add(this.channels.focus);

    this.offset.add(this.channels.shake);

    return this.offset;
  }
}
