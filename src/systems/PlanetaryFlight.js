import * as THREE from "three";

// Owns heliocentric pose math only. CameraDirector owns and applies the camera.
export class PlanetaryFlight {
  constructor(solarSystem) {
    this.kind = "heliocentric";
    this.solarSystem = solarSystem;
    this.angularSensitivity = 0.002; // Radians per horizontal pointer pixel.
    this.verticalSensitivity = 0.05; // World units per vertical pointer pixel.
    this.verticalLimit = 60; // Symmetric world-Y offset from the Sun.
    this.lookResponse = 3;
    this.thrustAcceleration = 7; // Response rate toward requested speed.
    this.thrustMaxSpeed = 12; // Maximum view-relative world units per second.
    this.thrustBraking = 11; // Short exponential brake after RMB release.
    this.thrustDisplacementSensitivity = 0.08; // Speed per vertical pointer pixel.
    this.strafeDisplacementSensitivity = 0.08; // Speed per horizontal pointer pixel.
    this.thrustDeadZone = 3; // Pixels ignored around the RMB press point on either axis.
    this.thrustStopEpsilon = 0.01;
    this.center = new THREE.Vector3();
    this.position = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.thrustDirection = new THREE.Vector3();
    this.strafeDirection = new THREE.Vector3();
    this.rmbMovement = new THREE.Vector3();
    this.reset();
  }

  updatePose(
    delta,
    horizontalMovement,
    pointerX,
    verticalPointerY,
    lmbHeld,
    rmbHeld,
    currentPosition,
    currentLookTarget,
    viewDirection,
    viewRight,
  ) {
    // LMB remains the established heliocentric orbit path. A button chord is
    // intentionally treated as LMB-only until combination behavior is designed.
    if (lmbHeld) {
      this.thrustPointerStartY = null;
      this.strafePointerStartX = null;
      this.thrustVelocity = 0;
      this.strafeVelocity = 0;

      const verticalMovement = this.lastPointerY === null
        ? 0
        : verticalPointerY - this.lastPointerY;
      this.lastPointerY = verticalPointerY;
      if (!this.started && horizontalMovement === 0 && verticalMovement === 0) {
        return false;
      }

      this.solarSystem.getSunWorldPosition(this.center);
      if (!this.started) {
        this.syncOrbitFromPosition(currentPosition);
        this.lookTarget.copy(currentLookTarget);
        this.started = true;
      }

      // Unbounded angle allows repeated full turns in either direction.
      this.angle += horizontalMovement * this.angularSensitivity;
      this.height = THREE.MathUtils.clamp(
        this.height - verticalMovement * this.verticalSensitivity,
        -this.verticalLimit,
        this.verticalLimit,
      );
      this.position.set(
        this.center.x + Math.sin(this.angle) * this.radius,
        this.center.y + this.height,
        this.center.z + Math.cos(this.angle) * this.radius,
      );
      // Ease from the existing composition instead of snapping the view on LMB.
      this.lookTarget.lerp(this.center, 1 - Math.exp(-this.lookResponse * delta));
      return true;
    }

    this.lastPointerY = null;
    if (rmbHeld) {
      if (!this.started) {
        this.solarSystem.getSunWorldPosition(this.center);
        this.syncOrbitFromPosition(currentPosition);
        this.position.copy(currentPosition);
        this.lookTarget.copy(currentLookTarget);
        this.started = true;
      }
      if (this.thrustPointerStartY === null) {
        this.thrustPointerStartY = verticalPointerY;
      }
      if (this.strafePointerStartX === null) {
        this.strafePointerStartX = pointerX;
      }

      const displacement = this.thrustPointerStartY - verticalPointerY;
      const signedDisplacement = Math.abs(displacement) <= this.thrustDeadZone
        ? 0
        : displacement - Math.sign(displacement) * this.thrustDeadZone;
      const targetVelocity = THREE.MathUtils.clamp(
        signedDisplacement * this.thrustDisplacementSensitivity,
        -this.thrustMaxSpeed,
        this.thrustMaxSpeed,
      );
      const accelerationBlend = 1 - Math.exp(-this.thrustAcceleration * delta);
      this.thrustVelocity += (targetVelocity - this.thrustVelocity) * accelerationBlend;
      const strafeDisplacement = this.strafePointerStartX - pointerX;
      const signedStrafeDisplacement = Math.abs(strafeDisplacement) <= this.thrustDeadZone
        ? 0
        : strafeDisplacement - Math.sign(strafeDisplacement) * this.thrustDeadZone;
      const targetStrafeVelocity = THREE.MathUtils.clamp(
        signedStrafeDisplacement * this.strafeDisplacementSensitivity,
        -this.thrustMaxSpeed,
        this.thrustMaxSpeed,
      );
      this.strafeVelocity += (
        targetStrafeVelocity - this.strafeVelocity
      ) * accelerationBlend;
      this.applyRmbMovement(delta, viewDirection, viewRight);
      return true;
    }

    this.thrustPointerStartY = null;
    this.strafePointerStartX = null;
    if (
      Math.abs(this.thrustVelocity) > this.thrustStopEpsilon
      || Math.abs(this.strafeVelocity) > this.thrustStopEpsilon
    ) {
      this.thrustVelocity *= Math.exp(-this.thrustBraking * delta);
      this.strafeVelocity *= Math.exp(-this.thrustBraking * delta);
      this.applyRmbMovement(delta, viewDirection, viewRight);
      return true;
    }

    this.thrustVelocity = 0;
    this.strafeVelocity = 0;
    // No inertia: LMB release freezes the reached orbit position immediately.
    if (!this.started) {
      this.lastPointerY = null;
      return false;
    }
    return true;
  }

  syncOrbitFromPosition(position) {
    this.solarSystem.getSunWorldPosition(this.center);
    const x = position.x - this.center.x;
    const z = position.z - this.center.z;
    this.radius = Math.hypot(x, z);
    this.angle = Math.atan2(x, z);
    this.height = position.y - this.center.y;
  }

  applyRmbMovement(delta, viewDirection, viewRight) {
    this.thrustDirection.copy(viewDirection);
    this.strafeDirection.copy(viewRight);
    this.strafeDirection.y = 0;
    this.rmbMovement.set(0, 0, 0);
    if (this.thrustDirection.lengthSq() > 0.000001) {
      this.rmbMovement.addScaledVector(
        this.thrustDirection.normalize(),
        this.thrustVelocity,
      );
    }
    if (this.strafeDirection.lengthSq() > 0.000001) {
      this.rmbMovement.addScaledVector(
        this.strafeDirection.normalize(),
        this.strafeVelocity,
      );
    }
    this.rmbMovement.multiplyScalar(delta);
    this.position.add(this.rmbMovement);
    this.lookTarget.add(this.rmbMovement);
    this.syncOrbitFromPosition(this.position);
  }

  reset() {
    this.started = false;
    this.radius = 0;
    this.angle = 0;
    this.height = 0;
    this.lastPointerY = null;
    this.thrustPointerStartY = null;
    this.strafePointerStartX = null;
    this.thrustVelocity = 0;
    this.strafeVelocity = 0;
    this.position.set(0, 0, 0);
    this.lookTarget.set(0, 0, 0);
    this.thrustDirection.set(0, 0, 0);
    this.strafeDirection.set(0, 0, 0);
    this.rmbMovement.set(0, 0, 0);
  }
}
