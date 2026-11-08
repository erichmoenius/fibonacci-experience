import * as THREE from "three";

export const SPIRAL_TURNS = 2.5;
export const SPIRAL_RADIUS = 10;
export const SPIRAL_PITCH = 4.8;
const RIM = 0.025;

function applyPanel(monitor) {
  const data = monitor.userData.spiral;
  const factor = 1 - data.gap / 100;
  const width = data.width * factor, height = data.height * factor;
  monitor.position.copy(data.position);
  monitor.scale.setScalar(1);
  monitor.userData.panelSize = { width, height };
  monitor.children[0].scale.set(width + RIM, height + RIM, 0.12);
  monitor.children[1].scale.set(width, height, 0.025);
  const numberScale = Math.min(width / 2, height / 1.2);
  for (const glyph of monitor.children.slice(2).filter(child => child.geometry.type === "BoxGeometry")) {
    glyph.userData.spiralBase ??= { position: glyph.position.clone(), scale: glyph.scale.clone() };
    glyph.position.copy(glyph.userData.spiralBase.position);
    glyph.position.x *= numberScale; glyph.position.y *= numberScale;
    glyph.scale.copy(glyph.userData.spiralBase.scale);
    glyph.scale.x *= numberScale; glyph.scale.y *= numberScale;
  }
}

/** Static cylindrical staircase around the visitor. Upright panels face the
 * vertical viewing axis. At radius 10, two-unit frames subtend less than the
 * 12.16-degree step; a 4.8-unit pitch separates the 1.2-unit-high turns. */
export function layoutSpiralGallery(monitors) {
  monitors.forEach((monitor, i) => {
    const t = monitors.length === 1 ? 0.5 : i / (monitors.length - 1);
    // The middle of the staircase is directly ahead on entry.
    const azimuth = (t - 0.5) * Math.PI * 2 * SPIRAL_TURNS;
    const radial = new THREE.Vector3(Math.sin(azimuth), 0, -Math.cos(azimuth));
    const position = radial.clone().multiplyScalar(SPIRAL_RADIUS);
    position.y = (t - 0.5) * SPIRAL_TURNS * SPIRAL_PITCH;
    const aspect = monitor.userData.photo.width / monitor.userData.photo.height;
    monitor.userData.spiral = { t, azimuth, position, radial,
      direction: position.clone().normalize(), width: 2, height: 2 / aspect, gap: 0 };
    const inward = radial.clone().negate();
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, inward).normalize();
    monitor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, inward));
    applyPanel(monitor);
  });
}

/** Additional panel spacing contracts rectangles along the fixed spiral.
 * No spherical coverage percentage is claimed for this cylindrical gallery. */
export function setSpiralGap(monitors, gapPercent) {
  const gap = Number.isFinite(gapPercent) ? THREE.MathUtils.clamp(gapPercent, 0, 30) : 0;
  for (const monitor of monitors) { monitor.userData.spiral.gap = gap; applyPanel(monitor); }
}
