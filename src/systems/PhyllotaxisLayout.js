import * as THREE from "three";

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const PHYLLOTAXIS_RADIUS = 12;
export const PHYLLOTAXIS_RADIAL_SPAN = 5;
export const PHYLLOTAXIS_HEIGHT = 12;
const RIM = 0.025;

function applyPanel(monitor) {
  const data = monitor.userData.phyllotaxis, factor = 1 - data.gap / 100;
  const width = data.width * factor, height = data.height * factor;
  monitor.position.copy(data.position).addScaledVector(data.direction, 0.09);
  monitor.scale.setScalar(1);
  monitor.userData.panelSize = { width, height };
  monitor.children[0].scale.set(width + RIM, height + RIM, 0.12);
  monitor.children[1].scale.set(width, height, 0.025);
  const numberScale = Math.min(width / 2, height / 1.2);
  for (const glyph of monitor.children.slice(2).filter(child => child.geometry.type === "BoxGeometry")) {
    glyph.userData.phyllotaxisBase ??= { position: glyph.position.clone(), scale: glyph.scale.clone() };
    glyph.position.copy(glyph.userData.phyllotaxisBase.position);
    glyph.position.x *= numberScale; glyph.position.y *= numberScale;
    glyph.scale.copy(glyph.userData.phyllotaxisBase.scale);
    glyph.scale.x *= numberScale; glyph.scale.y *= numberScale;
  }
}

/** A spatial phyllotactic canopy around the visitor. Golden-angle azimuths
 * weave opposing 8/13 spiral families through an elliptical toroidal surface.
 * The inner belt is near, outer belt far, and upper/lower lobes form the canopy;
 * no camera movement is needed to reveal its depth in different directions. */
export function layoutPhyllotaxis(monitors) {
  const placements = monitors.map((_, i) => {
    const t = (i + 0.5) / monitors.length, azimuth = i * GOLDEN_ANGLE;
    const growth = Math.PI * 2 * t + Math.PI;
    const radius = PHYLLOTAXIS_RADIUS + PHYLLOTAXIS_RADIAL_SPAN * Math.cos(growth);
    const position = new THREE.Vector3(radius * Math.cos(azimuth), PHYLLOTAXIS_HEIGHT * Math.sin(growth), radius * Math.sin(azimuth));
    return { t, azimuth, radius, growth, position, distance: position.length(), direction: position.clone().normalize() };
  });
  monitors.forEach((monitor, i) => {
    const placement = placements[i];
    const nearest = Math.min(Math.PI / 2, ...placements.filter((_, j) => j !== i).map(p => placement.direction.angleTo(p.direction)));
    const envelopeAngle = nearest * 0.44;
    const halfDiagonal = (placement.distance - 0.03) * Math.tan(envelopeAngle) - RIM / Math.sqrt(2);
    const aspect = monitor.userData.photo.width / monitor.userData.photo.height;
    const width = Math.min(2.6, 2 * halfDiagonal * aspect / Math.hypot(aspect, 1));
    monitor.userData.phyllotaxis = { ...placement, width, height: width / aspect, gap: 0, envelopeAngle };
    const inward = placement.direction.clone().negate();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), inward).normalize();
    const up = new THREE.Vector3().crossVectors(inward, right).normalize();
    monitor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, inward));
    applyPanel(monitor);
  });
}

/** Additional spacing contracts panels in place without changing growth order. */
export function setPhyllotaxisGap(monitors, gapPercent) {
  const gap = Number.isFinite(gapPercent) ? THREE.MathUtils.clamp(gapPercent, 0, 30) : 0;
  for (const monitor of monitors) { monitor.userData.phyllotaxis.gap = gap; applyPanel(monitor); }
}
