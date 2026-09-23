import * as THREE from "three";

// Owns heliocentric pose math only. CameraDirector owns and applies the camera.
export class PlanetaryFlight {
  constructor(solarSystem) {
    this.kind = "heliocentric";
    this.solarSystem = solarSystem;
    this.angularSensitivity = 0.002; // Radians per horizontal pointer pixel.
    this.lookResponse = 3;
    this.center = new THREE.Vector3();
    this.position = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.reset();
  }

  updatePose(delta, horizontalMovement, held, currentPosition, currentLookTarget) {
    // No inertia: release freezes both the reached position and look target.
    if (!held) return this.started;
    if (!this.started && horizontalMovement === 0) return false;

    this.solarSystem.getSunWorldPosition(this.center);
    if (!this.started) {
      const x = currentPosition.x - this.center.x;
      const z = currentPosition.z - this.center.z;
      this.radius = Math.hypot(x, z);
      this.angle = Math.atan2(x, z);
      this.height = currentPosition.y - this.center.y;
      this.lookTarget.copy(currentLookTarget);
      this.started = true;
    }

    // Unbounded angle allows repeated full turns in either direction.
    this.angle += horizontalMovement * this.angularSensitivity;
    this.position.set(
      this.center.x + Math.sin(this.angle) * this.radius,
      this.center.y + this.height,
      this.center.z + Math.cos(this.angle) * this.radius,
    );
    // Ease from the existing composition instead of snapping the view on LMB.
    this.lookTarget.lerp(this.center, 1 - Math.exp(-this.lookResponse * delta));
    return true;
  }

  reset() {
    this.started = false;
    this.radius = 0;
    this.angle = 0;
    this.height = 0;
    this.position.set(0, 0, 0);
    this.lookTarget.set(0, 0, 0);
  }
}
