import * as THREE from "three";
import { DEFAULT_GALLERY_RADIUS, MIN_GALLERY_RADIUS, MAX_GALLERY_RADIUS } from "./GalleryLayout.js";

const RIM = 0.025;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const safeRadius = value => Number.isFinite(value)
  ? THREE.MathUtils.clamp(value, MIN_GALLERY_RADIUS, MAX_GALLERY_RADIUS) : DEFAULT_GALLERY_RADIUS;

function applyPanel(monitor) {
  const data = monitor.userData.immersiveSphere;
  const factor = 1 - data.gap / 100;
  const width = data.width * factor, height = data.height * factor;
  monitor.position.copy(data.direction).multiplyScalar(data.radius + 0.09);
  monitor.scale.setScalar(1);
  monitor.userData.panelSize = { width, height };
  // Keep the same radius metadata used by shared settings and lifecycle checks.
  monitor.userData.mosaicRadius = data.radius;
  monitor.children[0].scale.set(width + RIM, height + RIM, 0.12);
  monitor.children[1].scale.set(width, height, 0.025);
  const numberScale = Math.min(width / 2, height / 1.2);
  for (const glyph of monitor.children.slice(2).filter(child => child.geometry.type === "BoxGeometry")) {
    glyph.userData.immersiveBase ??= { position: glyph.position.clone(), scale: glyph.scale.clone() };
    glyph.position.copy(glyph.userData.immersiveBase.position);
    glyph.position.x *= numberScale; glyph.position.y *= numberScale;
    glyph.scale.copy(glyph.userData.immersiveBase.scale);
    glyph.scale.x *= numberScale; glyph.scale.y *= numberScale;
  }
  if (monitor.userData.photoStatus === "ready") monitor.children.at(-1).scale.set(width, height, 1);
}

/** Water's tangent-panel sphere. Pole endpoints avoid a missing polar cap.
 * Every frame fits inside an angular envelope smaller than half its nearest
 * neighbour separation, so envelopes remain disjoint at Radius >= 10. */
export function layoutImmersiveSphere(monitors) {
  const directions = monitors.map((_, i) => {
    const y = monitors.length === 1 ? 0 : 1 - 2 * i / (monitors.length - 1);
    const horizontal = Math.sqrt(Math.max(0, 1 - y * y));
    return new THREE.Vector3(Math.cos(i * GOLDEN_ANGLE) * horizontal, y, Math.sin(i * GOLDEN_ANGLE) * horizontal);
  });
  monitors.forEach((monitor, i) => {
    const direction = directions[i];
    const nearest = Math.min(Math.PI, ...directions.filter((_, j) => j !== i).map(other => direction.angleTo(other)));
    // Reserve clearance for the frame rim and its closest physical depth.
    const halfDiagonal = (MIN_GALLERY_RADIUS - 0.03) * Math.tan(nearest * 0.46) - RIM / Math.sqrt(2);
    const aspect = monitor.userData.photo.width / monitor.userData.photo.height;
    const height = 2 * halfDiagonal / Math.hypot(aspect, 1);
    monitor.userData.immersiveSphere = { direction, width: height * aspect, height,
      radius: DEFAULT_GALLERY_RADIUS, gap: 0, envelopeAngle: nearest * 0.46 };
    const inward = direction.clone().negate();
    const upHint = Math.abs(direction.y) > 0.99
      ? new THREE.Vector3(0, 0, direction.y > 0 ? -1 : 1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(upHint, inward).normalize();
    const up = new THREE.Vector3().crossVectors(inward, right).normalize();
    monitor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, inward));
    applyPanel(monitor);
  });
}

/** Exact solid angle of the non-overlapping visible panel rectangles.
 * Borders are excluded; placeholder surfaces include their actual depth. */
export function measureImmersiveSphere(monitors) {
  let solidAngle = 0;
  for (const monitor of monitors) {
    const { radius } = monitor.userData.immersiveSphere;
    const { width, height } = monitor.userData.panelSize;
    const r = radius + (monitor.userData.photoStatus === "ready" ? 0 : 0.0025);
    const x = width / 2, y = height / 2;
    solidAngle += 4 * Math.atan2(x * y, r * Math.sqrt(r * r + x * x + y * y));
  }
  const photoCoverage = solidAngle / (4 * Math.PI);
  return { panels: monitors.length, photoCoverage, photoFreeFraction: 1 - photoCoverage };
}

/** Gap is additional linear spacing, not a promised whole-sphere dark area. */
export function setImmersiveSphereGap(monitors, gapPercent) {
  const gap = Number.isFinite(gapPercent) ? THREE.MathUtils.clamp(gapPercent, 0, 30) : 0;
  for (const monitor of monitors) { monitor.userData.immersiveSphere.gap = gap; applyPanel(monitor); }
  return measureImmersiveSphere(monitors);
}

/** Keep physical panel dimensions fixed while moving them along their rays. */
export function setImmersiveSphereRadius(monitors, radius) {
  const value = safeRadius(radius);
  for (const monitor of monitors) { monitor.userData.immersiveSphere.radius = value; applyPanel(monitor); }
  return measureImmersiveSphere(monitors);
}
