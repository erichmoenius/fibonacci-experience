import * as THREE from "three";

export const TUNNEL_RADIUS = 5;
export const TUNNEL_SECTION_SPACING = 12;
export const TUNNEL_PANELS_PER_SECTION = 15;
const RIM = 0.025;

function applyPanel(monitor) {
  const data = monitor.userData.timeline;
  const factor = 1 - data.gap / 100;
  const width = data.width * factor, height = data.height * factor;
  // Local +Z faces the visitor; the photo plane at +0.09 lies on the ring.
  monitor.position.copy(data.position).addScaledVector(data.direction, 0.09);
  monitor.scale.setScalar(1);
  monitor.userData.panelSize = { width, height };
  monitor.children[0].scale.set(width + RIM, height + RIM, 0.12);
  monitor.children[1].scale.set(width, height, 0.025);
  const numberScale = Math.min(width / 2, height / 1.2);
  for (const glyph of monitor.children.slice(2).filter(child => child.geometry.type === "BoxGeometry")) {
    glyph.userData.timelineBase ??= { position: glyph.position.clone(), scale: glyph.scale.clone() };
    glyph.position.copy(glyph.userData.timelineBase.position);
    glyph.position.x *= numberScale; glyph.position.y *= numberScale;
    glyph.scale.copy(glyph.userData.timelineBase.scale);
    glyph.scale.x *= numberScale; glyph.scale.y *= numberScale;
  }
}

/** Bidirectional chronology along local -Z. Five sections of fifteen panels
 * place 1-30 behind, 31-45 around the visitor, and 46-75 ahead. Independent
 * angular envelopes keep successive sections visible from the fixed center. */
export function layoutTimelineTunnel(monitors) {
  const sections = Math.ceil(monitors.length / TUNNEL_PANELS_PER_SECTION);
  const placements = monitors.map((_, i) => {
    const section = Math.floor(i / TUNNEL_PANELS_PER_SECTION);
    const slot = i % TUNNEL_PANELS_PER_SECTION;
    const angle = slot * Math.PI * 2 / TUNNEL_PANELS_PER_SECTION;
    const position = new THREE.Vector3(TUNNEL_RADIUS * Math.cos(angle), TUNNEL_RADIUS * Math.sin(angle),
      ((sections - 1) / 2 - section) * TUNNEL_SECTION_SPACING);
    return { section, slot, position, distance: position.length(), direction: position.clone().normalize() };
  });
  monitors.forEach((monitor, i) => {
    const placement = placements[i];
    const nearest = Math.min(Math.PI / 2, ...placements.filter((_, j) => j !== i).map(p => placement.direction.angleTo(p.direction)));
    const envelopeAngle = nearest * 0.44;
    const halfDiagonal = (placement.distance - 0.03) * Math.tan(envelopeAngle) - RIM / Math.sqrt(2);
    const aspect = monitor.userData.photo.width / monitor.userData.photo.height;
    const width = Math.min(2, 2 * halfDiagonal * aspect / Math.hypot(aspect, 1));
    monitor.userData.timeline = { ...placement, width, height: width / aspect, gap: 0, envelopeAngle };
    const inward = placement.direction.clone().negate();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), inward).normalize();
    const up = new THREE.Vector3().crossVectors(inward, right).normalize();
    monitor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, inward));
    applyPanel(monitor);
  });
}

/** Extra spacing shrinks panels in place, preserving chronology and sightlines. */
export function setTimelineTunnelGap(monitors, gapPercent) {
  const gap = Number.isFinite(gapPercent) ? THREE.MathUtils.clamp(gapPercent, 0, 30) : 0;
  for (const monitor of monitors) { monitor.userData.timeline.gap = gap; applyPanel(monitor); }
}
