import * as THREE from "three";
import { GalaxyJourney, GalaxyJourneyPhase } from "./GalaxyJourney.js";
import { JourneyAtmosphere } from "./JourneyAtmosphere.js";

const PHASE_START = Object.freeze({ START: 0, APPROACH: 2, HORIZON: 5, SINGULARITY: 8, WORMHOLE: 12, VOID: 16, BIRTH: 17 });
export function descentEase(start, end, value) {
  const x = THREE.MathUtils.clamp((value - start) / (end - start), 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

// Journey 2's lifecycle/timing, Journey 3's path and atmospheric presentation.
export class EarthJourney extends GalaxyJourney {
  constructor() {
    super({ id: "planetary-environment" });
    this.pose = { position: new THREE.Vector3(), lookTarget: new THREE.Vector3() };
    this.center = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.axis = new THREE.Vector3();
    this.tangent = new THREE.Vector3();
    this.startLookOffset = new THREE.Vector3();
    this.pathDirection = new THREE.Vector3();
    this.lookTangent = new THREE.Vector3();
    this.elapsed = 0;
    this.atmosphericState = { haze: 0, clouds: 0, whiteout: 0, reveal: 1, time: 0 };
  }

  prepareDescent(cameraDirector, target, overlay) {
    this.atmosphere?.clear();
    this.target = target;
    target.geometry.computeBoundingSphere();
    this.localRadius = target.geometry.boundingSphere.radius;
    this.nearClearance = cameraDirector.camera.near * 2;
    this.measureEarth();
    this.direction.copy(cameraDirector.position).sub(this.center);
    this.startDistance = this.direction.length();
    this.direction.normalize();
    if (this.startDistance === 0) this.direction.set(0, 0, 1);
    this.axis.set(0, 1, 0);
    if (Math.abs(this.axis.dot(this.direction)) > 0.98) this.axis.set(1, 0, 0);
    this.tangent.crossVectors(this.axis, this.direction).normalize();
    this.axis.crossVectors(this.direction, this.tangent).normalize();
    this.startLookOffset.copy(cameraDirector.currentTarget).sub(this.center);
    this.pose.position.copy(cameraDirector.position);
    this.pose.lookTarget.copy(cameraDirector.currentTarget);
    this.atmosphere = new JourneyAtmosphere(overlay);
    this.arrived = false;
  }

  measureEarth() {
    this.target.getWorldPosition(this.center);
    // Product of local stretch bounds is exact for uniform scaling and stays
    // conservative under rotated/nonuniform ancestors. It does not wobble as
    // the spherical Earth spins. Explicit shear matrices use a Gram row bound.
    let stretch = 1;
    for (let object = this.target; object; object = object.parent) {
      if (object.matrixAutoUpdate) {
        stretch *= Math.max(Math.abs(object.scale.x), Math.abs(object.scale.y), Math.abs(object.scale.z));
        continue;
      }
      const m = object.matrix.elements;
      const xx = m[0] * m[0] + m[1] * m[1] + m[2] * m[2];
      const yy = m[4] * m[4] + m[5] * m[5] + m[6] * m[6];
      const zz = m[8] * m[8] + m[9] * m[9] + m[10] * m[10];
      const xy = Math.abs(m[0] * m[4] + m[1] * m[5] + m[2] * m[6]);
      const xz = Math.abs(m[0] * m[8] + m[1] * m[9] + m[2] * m[10]);
      const yz = Math.abs(m[4] * m[8] + m[5] * m[9] + m[6] * m[10]);
      stretch *= Math.sqrt(Math.max(xx + xy + xz, yy + xy + yz, zz + xz + yz));
    }
    this.solidRadius = this.localRadius * stretch;
  }

  start() {
    this.completed = false;
    this.cancelled = false;
    this.phase = GalaxyJourneyPhase.START;
    this.phaseTime = 0;
    this.elapsed = 0;
    Object.assign(this.atmosphericState, { haze: 0, clouds: 0, whiteout: 0, reveal: 1, time: 0 });
    this.atmosphere?.update(this.atmosphericState);
    console.log("Journey 3 START: atmospheric descent");
  }

  update(delta) {
    if (this.completed || this.cancelled) return;
    // Hold the same BIRTH phase under whiteout until the existing maps settle.
    if (!(this.phase === GalaxyJourneyPhase.BIRTH && this.arrived && !this.arrivalReady)) super.update(delta);
    if (this.completed || this.cancelled) return;
    this.elapsed = PHASE_START[this.phase] + this.phaseTime;
    const state = this.atmosphericState;
    state.time = this.elapsed;
    state.haze = descentEase(5, 12, this.elapsed);
    state.clouds = descentEase(8, 16, this.elapsed);
    state.whiteout = descentEase(14, 16, this.elapsed);
    state.reveal = this.phase === GalaxyJourneyPhase.BIRTH ? 1 - descentEase(0, 3, this.phaseTime) : 1;
    this.atmosphere?.update(state);
  }

  getAtmosphericPose() {
    if (this.cancelled || this.completed || !this.atmosphere) return null;
    if (this.arrived) return this.pose;
    if (!this.target) return null;
    this.measureEarth();
    const progress = descentEase(2, 16, this.elapsed);
    const endpoint = Math.min(this.startDistance, this.solidRadius * 1.08 + this.nearClearance);
    // A conservative bound also handles parent scaling. No inward crossing.
    const distance = Math.max(this.solidRadius + 0.001, THREE.MathUtils.lerp(this.startDistance, endpoint, progress));
    this.pathDirection.copy(this.direction).applyAxisAngle(this.axis, progress * 0.12);
    this.pose.position.copy(this.center).addScaledVector(this.pathDirection, distance);
    const focus = descentEase(2, 8, this.elapsed);
    // Visible limb = tangent point of the measured sphere from this eye pose.
    const limb = descentEase(5, 12, this.elapsed);
    const radial = this.solidRadius * this.solidRadius / distance;
    const lateral = Math.sqrt(Math.max(0, this.solidRadius * this.solidRadius - radial * radial));
    this.lookTangent.crossVectors(this.axis, this.pathDirection).normalize();
    this.pose.lookTarget.copy(this.center).addScaledVector(this.startLookOffset, 1 - focus)
      .addScaledVector(this.pathDirection, radial * limb).addScaledVector(this.lookTangent, lateral * limb);
    return this.pose;
  }

  maskHandoff() { this.atmosphere?.obscure(); }

  setArrivalPose(pose, ready = null) {
    this.pose.position.copy(pose.position);
    this.pose.lookTarget.copy(pose.lookTarget);
    this.target = null;
    this.arrived = true;
    this.arrivalReady = !ready;
    ready?.then(() => { if (!this.cancelled && !this.completed) this.arrivalReady = true; });
  }

  clearAtmosphere() {
    this.atmosphere?.clear();
    this.target = null;
  }

  cancel() { super.cancel(); this.clearAtmosphere(); }
  complete() { super.complete(); this.clearAtmosphere(); }
}
