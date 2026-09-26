import * as THREE from "three";

const SPACE_TRAVEL_LIMIT = 40;

export class SpaceFlight {
  constructor(engineRoot) {
    this.travelLimit = SPACE_TRAVEL_LIMIT;
    this.orbitAngularSensitivity = 0.002;
    this.orbitElevationSensitivity = 0.002;
    this.orbitElevationLimit = Math.PI / 2 - 0.01;
    this.rmbAcceleration = 7;
    this.rmbMaxSpeed = 9;
    this.rmbBraking = 11;
    this.rmbThrustSensitivity = 0.08;
    this.rmbStrafeSensitivity = 0.08;
    this.rmbDeadZone = 3;
    this.rmbStopEpsilon = 0.01;

    this.orbitCenter = engineRoot.getWorldPosition(new THREE.Vector3());
    this.orbitPosition = new THREE.Vector3();
    this.orbitRadius = 0;
    this.orbitAngle = 0;
    this.orbitElevation = 0;
    this.lastOrbitPointerY = null;
    this.orbiting = false;
    this.displacement = new THREE.Vector3();
    this.nextDisplacement = new THREE.Vector3();
    this.rmbPointerStart = new THREE.Vector2();
    this.rmbPointer = new THREE.Vector2();
    this.hasRmbPointerStart = false;
    this.rmbThrustVelocity = 0;
    this.rmbStrafeVelocity = 0;
    this.rmbForward = new THREE.Vector3();
    this.rmbRight = new THREE.Vector3();
    this.rmbMovement = new THREE.Vector3();
  }

  updateRmbPointer(pointer, active) {
    if (!active || !pointer.hasPosition) {
      this.hasRmbPointerStart = false;
      return;
    }
    if (!this.hasRmbPointerStart) {
      this.rmbPointerStart.set(pointer.x, pointer.y);
      this.hasRmbPointerStart = true;
    }
    this.rmbPointer.set(pointer.x, pointer.y);
  }

  update(
    delta,
    horizontalMovement,
    verticalPointerY,
    lmbOrbiting,
    rmbTraveling,
    chorded,
    currentPosition,
    basePosition,
    cameraForward,
    cameraRight,
  ) {
    this.nextDisplacement.copy(this.displacement);
    if (lmbOrbiting) {
      this.updateOrbit(
        horizontalMovement,
        verticalPointerY,
        currentPosition,
      );
      this.nextDisplacement
        .copy(this.orbitPosition)
        .sub(basePosition);
    } else {
      if (this.orbiting) {
        this.nextDisplacement
          .copy(currentPosition)
          .sub(basePosition);
      }
      this.orbiting = false;
      this.lastOrbitPointerY = null;
    }
    this.updateRmbMovement(
      delta,
      cameraForward,
      cameraRight,
      rmbTraveling,
      lmbOrbiting || chorded,
    );
    this.nextDisplacement.add(this.rmbMovement);
    if (this.nextDisplacement.length() > this.travelLimit) {
      this.nextDisplacement.setLength(this.travelLimit);
    }
    this.displacement.copy(this.nextDisplacement);
  }

  updateOrbit(horizontalMovement, verticalPointerY, currentPosition) {
    if (!this.orbiting) {
      const x = currentPosition.x - this.orbitCenter.x;
      const y = currentPosition.y - this.orbitCenter.y;
      const z = currentPosition.z - this.orbitCenter.z;
      this.orbitRadius = Math.hypot(x, y, z);
      this.orbitAngle = Math.atan2(x, z);
      this.orbitElevation = this.orbitRadius > 0
        ? Math.asin(THREE.MathUtils.clamp(y / this.orbitRadius, -1, 1))
        : 0;
      this.lastOrbitPointerY = verticalPointerY;
      this.orbiting = true;
    }

    const verticalMovement = this.lastOrbitPointerY === null
      ? 0
      : verticalPointerY - this.lastOrbitPointerY;
    this.lastOrbitPointerY = verticalPointerY;
    this.orbitAngle -= horizontalMovement * this.orbitAngularSensitivity;
    const requestedElevation = this.orbitElevation
      + verticalMovement * this.orbitElevationSensitivity;
    if (this.orbitElevation > this.orbitElevationLimit) {
      this.orbitElevation = Math.min(
        this.orbitElevation,
        Math.max(requestedElevation, this.orbitElevationLimit),
      );
    } else if (this.orbitElevation < -this.orbitElevationLimit) {
      this.orbitElevation = Math.max(
        this.orbitElevation,
        Math.min(requestedElevation, -this.orbitElevationLimit),
      );
    } else {
      this.orbitElevation = THREE.MathUtils.clamp(
        requestedElevation,
        -this.orbitElevationLimit,
        this.orbitElevationLimit,
      );
    }
    const horizontalRadius = Math.cos(this.orbitElevation) * this.orbitRadius;
    this.orbitPosition.set(
      this.orbitCenter.x + Math.sin(this.orbitAngle) * horizontalRadius,
      this.orbitCenter.y + Math.sin(this.orbitElevation) * this.orbitRadius,
      this.orbitCenter.z + Math.cos(this.orbitAngle) * horizontalRadius,
    );
  }

  updateRmbMovement(delta, cameraForward, cameraRight, active, suspended) {
    this.rmbMovement.set(0, 0, 0);

    if (suspended) {
      this.rmbThrustVelocity = 0;
      this.rmbStrafeVelocity = 0;
      return;
    }

    if (active && this.hasRmbPointerStart) {
      const thrustDisplacement = this.rmbPointerStart.y - this.rmbPointer.y;
      const signedThrust = Math.abs(thrustDisplacement) <= this.rmbDeadZone
        ? 0
        : thrustDisplacement - Math.sign(thrustDisplacement) * this.rmbDeadZone;
      const strafeDisplacement = this.rmbPointerStart.x - this.rmbPointer.x;
      const signedStrafe = Math.abs(strafeDisplacement) <= this.rmbDeadZone
        ? 0
        : strafeDisplacement - Math.sign(strafeDisplacement) * this.rmbDeadZone;
      const targetThrustVelocity = THREE.MathUtils.clamp(
        signedThrust * this.rmbThrustSensitivity,
        -this.rmbMaxSpeed,
        this.rmbMaxSpeed,
      );
      const targetStrafeVelocity = THREE.MathUtils.clamp(
        signedStrafe * this.rmbStrafeSensitivity,
        -this.rmbMaxSpeed,
        this.rmbMaxSpeed,
      );
      const accelerationBlend = 1 - Math.exp(-this.rmbAcceleration * delta);
      this.rmbThrustVelocity += (
        targetThrustVelocity - this.rmbThrustVelocity
      ) * accelerationBlend;
      this.rmbStrafeVelocity += (
        targetStrafeVelocity - this.rmbStrafeVelocity
      ) * accelerationBlend;
    } else {
      this.rmbThrustVelocity *= Math.exp(-this.rmbBraking * delta);
      this.rmbStrafeVelocity *= Math.exp(-this.rmbBraking * delta);
      if (Math.abs(this.rmbThrustVelocity) <= this.rmbStopEpsilon) {
        this.rmbThrustVelocity = 0;
      }
      if (Math.abs(this.rmbStrafeVelocity) <= this.rmbStopEpsilon) {
        this.rmbStrafeVelocity = 0;
      }
    }

    this.rmbForward.copy(cameraForward);
    this.rmbRight.copy(cameraRight);
    if (this.rmbForward.lengthSq() > 0.000001) {
      this.rmbMovement.addScaledVector(
        this.rmbForward.normalize(),
        this.rmbThrustVelocity,
      );
    }
    if (this.rmbRight.lengthSq() > 0.000001) {
      this.rmbMovement.addScaledVector(
        this.rmbRight.normalize(),
        this.rmbStrafeVelocity,
      );
    }
    this.rmbMovement.multiplyScalar(delta);
  }

  reset() {
    this.orbitPosition.set(0, 0, 0);
    this.orbitRadius = 0;
    this.orbitAngle = 0;
    this.orbitElevation = 0;
    this.lastOrbitPointerY = null;
    this.orbiting = false;
    this.displacement.set(0, 0, 0);
    this.nextDisplacement.set(0, 0, 0);
    this.rmbPointerStart.set(0, 0);
    this.rmbPointer.set(0, 0);
    this.hasRmbPointerStart = false;
    this.rmbThrustVelocity = 0;
    this.rmbStrafeVelocity = 0;
    this.rmbForward.set(0, 0, 0);
    this.rmbRight.set(0, 0, 0);
    this.rmbMovement.set(0, 0, 0);
  }
}
