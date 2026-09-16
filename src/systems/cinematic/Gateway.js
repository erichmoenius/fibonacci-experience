import * as THREE from "three";

// =====================================================
// GATEWAY
// =====================================================
//
// Hero Core Gateway
//
// A Gateway is an invitation to begin a journey.
//
// It is NOT:
//
// ❌ A visible object
// ❌ A trigger
// ❌ A portal
//
// A Gateway simply defines:
//
// ✔ Where a journey can begin
// ✔ Which journey it offers
// ✔ Whether it is enabled
//
// =====================================================

export default class Gateway {
  constructor(position = new THREE.Vector3(), radius = 1, target = null) {
    this.position = position.clone();
    this.target = target;

    this.radius = radius;

    this.entryPose = null;

    this.enabled = true;

    this.journey = null;
  }

  contains(position) {
    this.target?.getWorldPosition(this.position);
    return this.position.distanceTo(position) <= this.radius;
  }
}
