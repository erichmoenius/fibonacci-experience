import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";
import { adaptConstellation } from "./ConstellationAdaptiveLayout.js";
import { adaptTimeline } from "./TimelineAdaptiveLayout.js";
import { adaptSpiral } from "./SpiralAdaptiveLayout.js";
import { adaptPlants } from "./PlantsAdaptiveLayout.js";
import { updateConnections } from "./ConstellationLayout.js";

export const GALLERY_TUNING_LIMITS = Object.freeze({
  SPHERICAL: { radius: [5, 15], defaultRadius: 10, description: "Spherical shell radius" },
  CUBE: { radius: [5, 15], defaultRadius: 10, description: "Cube wall distance" },
  IMMERSIVE_SPHERE: { radius: [5, 15], defaultRadius: 10, description: "Spherical shell radius" },
  SPIRAL: { radius: [5, 15], defaultRadius: 10, description: "Helix radius; dense settings adapt pitch and stagger panel depth" },
  TIMELINE_TUNNEL: { radius: [2, 10], defaultRadius: 5, description: "Tunnel radius; dense settings adapt section spacing and panel angles" },
  CONSTELLATION: { radius: [4, 14], defaultRadius: 9, description: "Nearest reference depth; dense settings retain a bounded multi-layer constellation" },
  PHYLLOTAXIS: { radius: [8, 17], defaultRadius: 12, description: "Botanical reference radius; dense settings adapt placement with fixed golden-angle azimuths" },
});

/** An adjustment layer over immutable M09 placements. Bounded layout-specific reflow; no photo reassignment. */
export class GalleryLayoutTuning {
  constructor(room, layout) {
    this.room = room; this.layout = layout;
    this.limits = GALLERY_TUNING_LIMITS[layout];
    this.base = room.monitors.map(m => ({
      position: m.position.clone(), quaternion: m.quaternion.clone(), scale: m.scale.clone(),
      size: { ...m.userData.panelSize },
      children: m.children.filter(c => c.geometry.type === "BoxGeometry").map(c => ({
        object: c, position: c.position.clone(), scale: c.scale.clone(),
      })),
    }));
  }

  position(radius) {
    const delta = radius - this.limits.defaultRadius;
    this.room.monitors.forEach((m, i) => {
      const b = this.base[i]; m.position.copy(b.position); m.quaternion.copy(b.quaternion); m.scale.copy(b.scale);
      if (!delta) return;
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(b.quaternion);
      const center = b.position.clone().addScaledVector(normal, .09 * b.scale.z);
      if (this.layout === "SPIRAL") {
        // Expand the cylinder, preserving the full staircase's vertical pitch.
        const radial = Math.hypot(center.x, center.z);
        center.x *= (radial + delta) / radial; center.z *= (radial + delta) / radial;
      } else if (this.layout === "TIMELINE_TUNNEL") {
        // Five fixed chronological Z sections; only the tunnel cross-section expands.
        center.x *= radius / this.limits.defaultRadius; center.y *= radius / this.limits.defaultRadius;
      } else if (this.layout === "PHYLLOTAXIS") {
        const radial = Math.hypot(center.x, center.z);
        center.x *= (radial + delta) / radial; center.z *= (radial + delta) / radial;
      } else if (this.layout === "CONSTELLATION") {
        center.multiplyScalar((center.length() + delta) / center.length());
      } else if (this.layout === "CUBE") {
        // Scale the six face coordinates, retaining coplanarity and face ordering.
        const faceDistance = center.dot(normal);
        const tangent = center.clone().addScaledVector(normal, -faceDistance);
        center.copy(tangent.multiplyScalar(radius / this.limits.defaultRadius)).addScaledVector(normal, faceDistance * radius / this.limits.defaultRadius);
      } else center.multiplyScalar(radius / this.limits.defaultRadius);
      if (["TIMELINE_TUNNEL", "PHYLLOTAXIS"].includes(this.layout)) {
        const inward = center.clone().normalize().negate();
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), inward).normalize();
        const up = new THREE.Vector3().crossVectors(inward, right).normalize();
        m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, inward));
        normal.copy(inward);
      }
      m.position.copy(center).addScaledVector(normal, -.09 * b.scale.z);
    });
  }

  fits(factor) {
    const boxes = this.room.monitors.map((m, i) => {
      const b = this.base[i], frame = b.children[0];
      const half = new THREE.Vector3(frame.scale.x + b.size.width * (factor - 1), frame.scale.y + b.size.height * (factor - 1), frame.scale.z).multiply(b.scale).multiplyScalar(.5);
      return new OBB(m.position.clone(), half, new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(m.quaternion)));
    });
    if (boxes.some(box => box.clampPoint(new THREE.Vector3(), new THREE.Vector3()).length() < 1)) return false;
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      if (boxes[a].center.distanceToSquared(boxes[b].center) > (boxes[a].halfSize.length() + boxes[b].halfSize.length()) ** 2) continue;
      if (boxes[a].intersectsOBB(boxes[b], 1e-10)) return false;
    }
    return true;
  }

  apply(settings) {
    const requestedRadius = this.limits.defaultRadius + settings.radius;
    const radius = THREE.MathUtils.clamp(requestedRadius, ...this.limits.radius);
    const gapFactor = 1 - settings.gap / 100;
    const adaptive = this.layout === "PHYLLOTAXIS" && settings.pictureSize / 100 * gapFactor > 1.000001
      ? adaptPlants(this,settings,radius)
      : this.layout === "SPIRAL" && settings.pictureSize / 100 * gapFactor > 1.000001
        ? adaptSpiral(this,settings,radius)
        : this.layout === "TIMELINE_TUNNEL" && settings.pictureSize / 100 * gapFactor > 1.000001
          ? adaptTimeline(this,settings,radius)
          : this.layout === "CONSTELLATION" && settings.pictureSize / 100 * gapFactor > 1.000001
            ? adaptConstellation(this,settings,radius) : null;
    let maxSize;
    if (adaptive) maxSize = adaptive.maxPictureSize;
    else {
      this.position(radius);
      let upper = 1.5 * gapFactor;
      // Keep the existing angular envelopes readable, as well as physically separate.
      this.room.monitors.forEach((m, i) => {
        const data = m.userData.immersiveSphere ?? m.userData.timeline ?? m.userData.constellation ?? m.userData.phyllotaxis;
        if (!data?.envelopeAngle) return;
        const b = this.base[i], distance = m.position.length() - .09;
        const envelope = 2 * ((distance - .03) * Math.tan(data.envelopeAngle) - .025 / Math.sqrt(2));
        upper = Math.min(upper, envelope / Math.hypot(b.size.width, b.size.height));
      });
      if (!this.fits(upper)) {
        let low = 0, high = upper;
        for (let step = 0; step < 20; step++) { const mid = (low + high) / 2; if (this.fits(mid)) low = mid; else high = mid; }
        upper = low * .999;
      }
      maxSize = Math.min(150, Math.max(1, Math.floor((upper / gapFactor + 1e-9) * 100)));
    }
    const pictureSize = Math.min(settings.pictureSize, maxSize);
    const factor = pictureSize / 100 * gapFactor;
    this.room.monitors.forEach((m, i) => {
      const b = this.base[i];
      m.userData.panelSize = { width: b.size.width * factor, height: b.size.height * factor };
      for (const [index, child] of b.children.entries()) {
        child.object.position.copy(child.position); child.object.scale.copy(child.scale);
        if (index === 0) {
          child.object.scale.x += b.size.width * (factor - 1); child.object.scale.y += b.size.height * (factor - 1);
        } else {
          child.object.scale.x *= factor; child.object.scale.y *= factor;
          if (index > 1) { child.object.position.x *= factor; child.object.position.y *= factor; }
        }
      }
      if (m.userData.photoStatus === "ready") {
        const {photo,panelSize} = m.userData;
        const fit = Math.min(panelSize.width / photo.width, panelSize.height / photo.height);
        m.children.at(-1).scale.set(photo.width * fit, photo.height * fit, 1);
      }
      if (m.userData.constellation) {
        const data = m.userData.constellation, normal = new THREE.Vector3(0,0,1).applyQuaternion(m.quaternion);
        data.position = m.position.clone().addScaledVector(normal, .09 * m.scale.z);
        data.distance = data.position.length(); data.direction = data.position.clone().normalize();
      }
    });
    if (this.room.constellation) updateConnections(this.room.monitors, this.room.constellation);
    this.room.group.updateWorldMatrix(true,true);
    return { pictureSize, gap: settings.gap, radius: radius === requestedRadius ? settings.radius : radius - this.limits.defaultRadius, absoluteRadius: radius, maxPictureSize: maxSize, panelScale: factor, ...(adaptive ? {adaptive:adaptive.details} : {}) };
  }
}
