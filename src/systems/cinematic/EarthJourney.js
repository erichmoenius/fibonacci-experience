import * as THREE from "three";
import { GalaxyJourney, GalaxyJourneyPhase } from "./GalaxyJourney.js";
import { JourneyAtmosphere } from "./JourneyAtmosphere.js";

// Existing IDs/events, with Journey 3-only durations. Journey 2 is untouched.
export const EARTH_PHASES = Object.freeze([
  Object.freeze({ id: "START", start: 0, duration: 2 }),
  Object.freeze({ id: "APPROACH", start: 2, duration: 1.25, event: "approach" }),
  Object.freeze({ id: "HORIZON", start: 3.25, duration: 1.25, event: "horizon" }),
  Object.freeze({ id: "SINGULARITY", start: 4.5, duration: 1, event: "singularity" }),
  Object.freeze({ id: "WORMHOLE", start: 5.5, duration: 1, event: "wormhole" }),
  Object.freeze({ id: "VOID", start: 6.5, duration: 1, event: "void" }),
  Object.freeze({ id: "BIRTH", start: 7.5, duration: 2.5, event: "birth" }),
]);
export function descentEase(start, end, value) {
  const x = THREE.MathUtils.clamp((value - start) / (end - start), 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

// Journey 2's lifecycle contract, Journey 3's independent clock and camera path.
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
    this.arrivalHome = new THREE.Vector3();
    this.arrivalStart = new THREE.Vector3();
    this.arrivalLookStart = new THREE.Vector3();
    this.arrivalLookHome = new THREE.Vector3();
    this.sourceRelative = new THREE.Vector3();
    this.sourceLookRelative = new THREE.Vector3();
    this.sourceSun = new THREE.Vector3();
    this.arrivalSun = new THREE.Vector3();
    this.homeSun = new THREE.Vector3();
    this.sunRotation = new THREE.Quaternion();
    this.sunBlend = new THREE.Quaternion();
    this.arrivalDirection = new THREE.Vector3();
    this.arrivalCameraRotation = new THREE.Quaternion();
    this.cameraBlend = new THREE.Quaternion();
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
    this.arrivalCaptured = false;
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
    this.phaseIndex = 0;
    this.lastFrameTime = performance.now() * 0.001;
    Object.assign(this.atmosphericState, { haze: 0, clouds: 0, whiteout: 0, reveal: 1, time: 0 });
    this.atmosphere?.update(this.atmosphericState);
    console.log("Journey 3 START: atmospheric descent");
  }

  // App uses measured time only for this journey. Clamp a stalled/tab-resumed
  // frame to avoid skipping the readable veil/reveal; slow motion remains opt-in.
  getFrameDelta(time) {
    const delta = THREE.MathUtils.clamp(time - this.lastFrameTime, 0, 0.1);
    this.lastFrameTime = time;
    return Number.isFinite(delta) ? delta : 0;
  }

  update(delta) {
    if (this.completed || this.cancelled || !Number.isFinite(delta) || delta <= 0) return;
    let remaining = delta;
    while (remaining > 0 && !this.completed && !this.cancelled) {
      // Preserve the existing map-ready hold under the fully opaque veil.
      if (this.phase === GalaxyJourneyPhase.BIRTH && this.arrived && !this.arrivalReady) break;
      const phase = EARTH_PHASES[this.phaseIndex];
      const step = Math.min(remaining, phase.duration - this.phaseTime);
      this.phaseTime += step;
      remaining -= step;
      this.elapsed = phase.start + this.phaseTime;
      this.updateAtmosphere();
      if (this.phaseTime < phase.duration - 1e-10) break;
      if (this.phaseIndex === EARTH_PHASES.length - 1) {
        this.elapsed = 10;
        this.complete();
        this.emit("complete");
        break;
      }
      const next = EARTH_PHASES[++this.phaseIndex];
      this.phase = next.id;
      this.phaseTime = 0;
      this.elapsed = next.start;
      this.emit(next.event);
    }
  }

  updateAtmosphere() {
    const state = this.atmosphericState;
    state.time = this.elapsed;
    state.haze = descentEase(2, 4.5, this.elapsed);
    state.clouds = descentEase(4.5, 6.5, this.elapsed);
    state.whiteout = descentEase(6, 6.5, this.elapsed);
    state.reveal = this.phase === GalaxyJourneyPhase.BIRTH ? 1 - descentEase(0, 2.5, this.phaseTime) : 1;
    this.atmosphere?.update(state);
  }

  getAtmosphericPose() {
    if (this.cancelled || this.completed || !this.atmosphere) return null;
    if (this.arrived) {
      const progress = descentEase(0, 2.5, this.phaseTime);
      this.cameraBlend.identity().slerp(this.arrivalCameraRotation, progress);
      this.pose.position.copy(this.arrivalDirection).applyQuaternion(this.cameraBlend)
        .multiplyScalar(THREE.MathUtils.lerp(this.arrivalRadius, this.homeRadius, progress)).add(this.arrivalLookHome);
      this.pose.lookTarget.copy(this.arrivalLookStart).sub(this.arrivalLookHome)
        .applyQuaternion(this.cameraBlend).multiplyScalar(1 - progress).add(this.arrivalLookHome);
      if (progress === 0) {
        this.pose.position.copy(this.arrivalStart);
        this.pose.lookTarget.copy(this.arrivalLookStart);
      }
      if (progress === 1) {
        this.pose.position.copy(this.arrivalHome);
        this.pose.lookTarget.copy(this.arrivalLookHome);
      }
      if (this.arrivalEarth) {
        this.sunBlend.identity().slerp(this.sunRotation, progress);
        this.arrivalEarth.uniforms.sunDirection.value.copy(this.arrivalSun).applyQuaternion(this.sunBlend);
      }
      return this.pose;
    }
    if (!this.target) return null;
    this.measureEarth();
    const progress = descentEase(0, 6.5, this.elapsed);
    const endpoint = Math.min(this.startDistance, this.solidRadius * 1.10 + this.nearClearance);
    // A conservative bound also handles parent scaling. No inward crossing.
    // Logarithmic distance makes apparent scale grow deliberately, with zero
    // relative velocity/acceleration at both ends of the quintic envelope.
    const safeStart = Math.max(this.startDistance, this.solidRadius + 0.001);
    const safeEnd = Math.max(endpoint, this.solidRadius + 0.001);
    const distance = safeStart * Math.pow(safeEnd / safeStart, progress);
    this.pathDirection.copy(this.direction).applyAxisAngle(this.axis, progress * 0.18);
    this.pose.position.copy(this.center).addScaledVector(this.pathDirection, distance);
    const focus = descentEase(0, 2, this.elapsed);
    // Visible limb = tangent point of the measured sphere from this eye pose.
    const limb = descentEase(1.5, 4.5, this.elapsed);
    const radial = this.solidRadius * this.solidRadius / distance;
    const lateral = Math.sqrt(Math.max(0, this.solidRadius * this.solidRadius - radial * radial));
    // Upper visible limb places the globe below a readable horizon, while
    // the independent shallow orbital arc avoids a straight fixed-Z dive.
    this.lookTangent.copy(this.axis).addScaledVector(this.pathDirection, -this.axis.dot(this.pathDirection)).normalize();
    this.pose.lookTarget.copy(this.center).addScaledVector(this.startLookOffset, 1 - focus)
      .addScaledVector(this.pathDirection, radial * limb).addScaledVector(this.lookTangent, lateral * limb);
    return this.pose;
  }

  maskHandoff() { this.atmosphere?.obscure(); }

  // Capture while Planetary is still attached: disposal removes its ancestors.
  captureArrival() {
    if (!this.target || this.arrived) return;
    this.getAtmosphericPose();
    this.sourceRelative.copy(this.pose.position).sub(this.center);
    this.sourceLookRelative.copy(this.pose.lookTarget).sub(this.center);
    this.sourceRadius = this.solidRadius;
    this.sourceSun.copy(this.target.material.uniforms?.sunDirection?.value ?? new THREE.Vector3(-0.85, 0.35, 0.65)).normalize();
    this.arrivalCaptured = true;
  }

  setArrivalPose(pose, ready = null, earth = null) {
    if (!this.arrivalCaptured) this.captureArrival();
    this.phaseTime = 0;
    this.elapsed = 7.5;
    this.arrivalHome.copy(pose.position);
    this.arrivalLookHome.copy(pose.lookTarget);
    // Translate the actual Earth-relative frame without rotating it at handoff:
    // position, horizon direction and screen composition match immediately.
    // During BIRTH, rotate radially toward home while pulling back; spherical
    // interpolation keeps even opposite-side arrivals outside solid Earth.
    const radius = earth?.surface.geometry.parameters.radius ?? 2;
    const scale = radius / (this.sourceRadius || radius);
    this.arrivalStart.copy(this.sourceRelative).multiplyScalar(scale).add(pose.lookTarget);
    this.arrivalLookStart.copy(this.sourceLookRelative).multiplyScalar(scale).add(pose.lookTarget);
    this.arrivalDirection.copy(this.sourceRelative).normalize();
    const homeDirection = pose.position.clone().sub(pose.lookTarget);
    this.homeRadius = homeDirection.length();
    this.arrivalRadius = this.sourceRelative.length() * scale;
    this.arrivalCameraRotation.setFromUnitVectors(this.arrivalDirection, homeDirection.normalize());
    this.pose.position.copy(this.arrivalStart);
    this.pose.lookTarget.copy(this.arrivalLookStart);
    this.arrivalEarth = earth;
    if (earth) {
      this.homeSun.copy(earth.uniforms.sunDirection.value);
      this.arrivalSun.copy(this.sourceSun).normalize();
      this.sunRotation.setFromUnitVectors(this.arrivalSun, this.homeSun);
      earth.uniforms.sunDirection.value.copy(this.arrivalSun);
    }
    this.target = null;
    this.arrived = true;
    this.arrivalReady = !ready;
    ready?.then(() => { if (!this.cancelled && !this.completed) this.arrivalReady = true; });
  }

  getExplorationPose() { return this.completed && this.arrived ? this.pose : null; }

  clearAtmosphere() {
    this.atmosphere?.clear();
    this.target = null;
    if (this.arrivalEarth) this.arrivalEarth.uniforms.sunDirection.value.copy(this.homeSun);
    this.arrivalEarth = null;
  }

  cancel() { super.cancel(); this.clearAtmosphere(); }
  complete() {
    if (this.arrived) {
      this.pose.position.copy(this.arrivalHome);
      this.pose.lookTarget.copy(this.arrivalLookHome);
    }
    super.complete();
    this.clearAtmosphere();
  }
}
