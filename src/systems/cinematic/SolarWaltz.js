import * as THREE from "three";

export const SOLAR_WALTZ = Object.freeze({ duration: 18, rampSeconds: 2, heightLift: 8 });

// Supplies poses only. CameraDirector's existing TRAVEL pathway writes the camera.
export class SolarWaltz {
  constructor(sun, startPose, startTime, settings = SOLAR_WALTZ) {
    this.id = "solar-waltz";
    this.sun = sun;
    this.settings = settings;
    this.startTime = startTime;
    this.completed = this.cancelled = this.disposed = false;
    this.elapsed = this.angle = 0;
    this.center = sun.getWorldPosition(new THREE.Vector3());
    this.offset = startPose.position.clone().sub(this.center);
    this.radius = Math.hypot(this.offset.x, this.offset.z);
    this.startAngle = Math.atan2(this.offset.x, this.offset.z);
    this.startLookOffset = startPose.lookTarget.clone().sub(this.center);
    this.pose = { position: startPose.position.clone(), lookTarget: startPose.lookTarget.clone() };
  }

  update(time) {
    if (this.disposed || this.cancelled) return;
    const duration = this.settings.duration;
    const ramp = Math.min(this.settings.rampSeconds, duration / 2);
    this.elapsed = THREE.MathUtils.clamp(time - this.startTime, 0, duration);
    // Integral of a smoothstep velocity ramp; exactly one turn, with zero
    // angular velocity/acceleration at both ends and constant speed in between.
    const integral = x => x*x*x - 0.5*x*x*x*x;
    let travel;
    if (this.elapsed <= ramp) travel = ramp * integral(this.elapsed / ramp);
    else if (this.elapsed >= duration-ramp) travel = duration-ramp - ramp * integral((duration-this.elapsed)/ramp);
    else travel = this.elapsed - ramp/2;
    this.angle = Math.PI * 2 * travel / (duration-ramp);
    this.sun.getWorldPosition(this.center);
    const lift = this.settings.heightLift
      * THREE.MathUtils.smootherstep(this.elapsed, 0, ramp)
      * THREE.MathUtils.smootherstep(duration-this.elapsed, 0, ramp);
    const azimuth = this.startAngle + this.angle;
    this.pose.position.set(
      this.center.x + this.radius * Math.sin(azimuth),
      this.center.y + this.offset.y + lift,
      this.center.z + this.radius * Math.cos(azimuth),
    );
    const gazeBlend = THREE.MathUtils.smootherstep(this.elapsed, 0, ramp);
    this.pose.lookTarget.copy(this.center).addScaledVector(this.startLookOffset, 1-gazeBlend);
    this.completed = this.elapsed >= duration;
  }

  // Reuse the existing pose-provider contract, without changing CameraDirector.
  getAtmosphericPose() { return this.disposed || this.cancelled ? null : this.pose; }
  getExplorationPose() { return this.completed && !this.disposed ? this.pose : null; }
  cancel() { this.cancelled = true; }
  dispose() { this.disposed = true; this.sun = null; }
}
