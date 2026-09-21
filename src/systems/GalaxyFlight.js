import * as THREE from "three";

const GALAXY_RADIUS = 35;

export class GalaxyFlight {
  constructor(galaxyRoot) {
    const worldScale = galaxyRoot.getWorldScale(new THREE.Vector3()).x;
    this.travelLimit = GALAXY_RADIUS * worldScale * 4;
    this.forwardAcceleration = 3;
    this.reverseAcceleration = 4.5;
    this.maxForwardSpeed = 11;
    this.maxReverseSpeed = 5;
    this.braking = 10;
    this.strafeSensitivity = 0.01;
    this.strafeMaxPixelsPerFrame = 24;
    this.strafeBraking = 40;
    this.lowSpeedSteering = 5;
    this.highSpeedSteering = 2;

    this.aim = new THREE.Vector2();
    this.hasAim = false;
    this.desiredDirection = new THREE.Vector3();
    this.steeredDirection = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.lateralVelocity = new THREE.Vector3();
    this.displacement = new THREE.Vector3();
    this.nextDisplacement = new THREE.Vector3();
    this.strafeDelta = new THREE.Vector2();
    this.strafePointer = new THREE.Vector2();
    this.strafing = false;
  }

  updateStrafePointer(pointer, active) {
    this.strafeDelta.set(0, 0);
    if (!active || !pointer.hasPosition) {
      this.strafing = false;
      return;
    }
    if (this.strafing) {
      this.strafeDelta.set(
        THREE.MathUtils.clamp(pointer.x - this.strafePointer.x, -this.strafeMaxPixelsPerFrame, this.strafeMaxPixelsPerFrame),
        THREE.MathUtils.clamp(pointer.y - this.strafePointer.y, -this.strafeMaxPixelsPerFrame, this.strafeMaxPixelsPerFrame),
      );
    }
    this.strafePointer.set(pointer.x, pointer.y);
    this.strafing = true;
  }

  updateAim(pointer, canvas) {
    if (!pointer.hasPosition) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    this.aim.set(
      ((pointer.x - bounds.left) / bounds.width) * 2 - 1,
      -((pointer.y - bounds.top) / bounds.height) * 2 + 1,
    );
    this.hasAim = true;
  }

  update(delta, rayDirection, thrusting, braking, cameraRight, cameraUp) {
    if (this.hasAim && !this.strafing) {
      this.desiredDirection.copy(rayDirection).normalize();
      if (this.steeredDirection.lengthSq() === 0) {
        this.steeredDirection.copy(this.desiredDirection);
      } else {
        const speedRatio = Math.min(1, this.velocity.length() / this.maxForwardSpeed);
        const response = THREE.MathUtils.lerp(
          this.lowSpeedSteering,
          this.highSpeedSteering,
          speedRatio,
        );
        this.steeredDirection.lerp(
          this.desiredDirection,
          1 - Math.exp(-response * delta),
        ).normalize();
      }
    }

    const speed = this.velocity.length();
    if (!thrusting && !braking) {
      this.velocity.set(0, 0, 0);
      this.lateralVelocity.set(0, 0, 0);
    } else if (braking && thrusting) {
      this.velocity.multiplyScalar(
        speed > 0 ? Math.max(0, speed - this.strafeBraking * delta) / speed : 0,
      );
    } else if (braking && this.hasAim) {
      let alongAim = this.velocity.dot(this.steeredDirection);
      if (alongAim > 0) {
        const stoppingTime = Math.min(delta, alongAim / this.braking);
        alongAim -= this.braking * stoppingTime;
        alongAim -= this.reverseAcceleration * (delta - stoppingTime);
      } else {
        alongAim -= this.reverseAcceleration * delta;
      }
      alongAim = Math.max(-this.maxReverseSpeed, alongAim);

      this.lateralVelocity.copy(this.velocity)
        .addScaledVector(this.steeredDirection, -this.velocity.dot(this.steeredDirection))
        .multiplyScalar(Math.exp(-this.braking * delta));
      this.velocity.copy(this.steeredDirection).multiplyScalar(alongAim)
        .add(this.lateralVelocity);
    } else if (thrusting && this.hasAim) {
      this.velocity.addScaledVector(this.steeredDirection, this.forwardAcceleration * delta);
      this.velocity.clampLength(0, this.maxForwardSpeed);
    }

    this.nextDisplacement.copy(this.displacement).addScaledVector(this.velocity, delta);
    if (this.strafing) {
      this.nextDisplacement
        .addScaledVector(cameraRight, -this.strafeDelta.x * this.strafeSensitivity)
        .addScaledVector(cameraUp, this.strafeDelta.y * this.strafeSensitivity);
    }
    if (this.nextDisplacement.length() > this.travelLimit) {
      this.nextDisplacement.setLength(this.travelLimit);
      const outwardSpeed = this.velocity.dot(this.nextDisplacement) / this.travelLimit;
      if (outwardSpeed > 0) {
        this.velocity.addScaledVector(this.nextDisplacement, -outwardSpeed / this.travelLimit);
      }
    }
    this.displacement.copy(this.nextDisplacement);
  }

  reset() {
    this.hasAim = false;
    this.aim.set(0, 0);
    this.desiredDirection.set(0, 0, 0);
    this.steeredDirection.set(0, 0, 0);
    this.velocity.set(0, 0, 0);
    this.lateralVelocity.set(0, 0, 0);
    this.displacement.set(0, 0, 0);
    this.nextDisplacement.set(0, 0, 0);
    this.strafeDelta.set(0, 0);
    this.strafePointer.set(0, 0);
    this.strafing = false;
  }
}
