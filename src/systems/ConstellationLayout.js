import * as THREE from "three";

export const CONSTELLATION_MAX_DEGREE = 3;
const RIM = 0.025;

function applyPanel(monitor) {
  const data = monitor.userData.constellation, factor = 1 - data.gap / 100;
  const width = data.width * factor, height = data.height * factor;
  monitor.position.copy(data.position).addScaledVector(data.direction, 0.09);
  monitor.scale.setScalar(1);
  monitor.userData.panelSize = { width, height };
  monitor.children[0].scale.set(width + RIM, height + RIM, 0.12);
  monitor.children[1].scale.set(width, height, 0.025);
  const numberScale = Math.min(width / 2, height / 1.2);
  for (const glyph of monitor.children.slice(2).filter(child => child.geometry.type === "BoxGeometry")) {
    glyph.userData.constellationBase ??= { position: glyph.position.clone(), scale: glyph.scale.clone() };
    glyph.position.copy(glyph.userData.constellationBase.position);
    glyph.position.x *= numberScale; glyph.position.y *= numberScale;
    glyph.scale.copy(glyph.userData.constellationBase.scale);
    glyph.scale.x *= numberScale; glyph.scale.y *= numberScale;
  }
}

function selectEdges(monitors) {
  const candidates = [], degrees = monitors.map(() => 0), components = monitors.map((_, i) => i);
  const find = i => { while (components[i] !== i) i = components[i]; return i; };
  for (let a = 0; a < monitors.length; a++) for (let b = a + 1; b < monitors.length; b++) {
    const x = monitors[a].userData.constellation, y = monitors[b].userData.constellation;
    if (x.direction.angleTo(y.direction) <= 0.8) candidates.push({ a, b, distance: x.position.distanceToSquared(y.position) });
  }
  candidates.sort((x, y) => x.distance - y.distance || x.a - y.a || x.b - y.b);
  const edges = [], used = new Set();
  const add = ({ a, b }) => { edges.push(Object.freeze([a, b])); used.add(a + ":" + b); degrees[a]++; degrees[b]++; };
  // A degree-bounded nearest-neighbor spanning pass, then sparse local links.
  for (const edge of candidates) if (find(edge.a) !== find(edge.b)
    && degrees[edge.a] < CONSTELLATION_MAX_DEGREE && degrees[edge.b] < CONSTELLATION_MAX_DEGREE) {
    components[find(edge.a)] = find(edge.b); add(edge);
  }
  for (const edge of candidates) if (!used.has(edge.a + ":" + edge.b)
    && degrees[edge.a] < CONSTELLATION_MAX_DEGREE && degrees[edge.b] < CONSTELLATION_MAX_DEGREE) add(edge);
  return Object.freeze(edges);
}

// Clip a segment against a panel's viewing pyramid. Removing that interval
// keeps lines away from the entire readable face, even when a line is nearer.
function panelInterval(start, delta, monitor) {
  const data = monitor.userData.constellation, size = monitor.userData.panelSize;
  const hx = (size.width + RIM) / 2 + 0.04, hy = (size.height + RIM) / 2 + 0.04;
  const n0 = data.direction.dot(start), nd = data.direction.dot(delta);
  let lo = 0, hi = 1;
  const planes = [[n0, nd]];
  for (const [axis, half] of [[data.right, hx], [data.up, hy]]) {
    const a = axis.dot(start) * data.distance, b = axis.dot(delta) * data.distance;
    planes.push([n0 * half - a, nd * half - b], [n0 * half + a, nd * half + b]);
  }
  for (const [a, b] of planes) {
    if (Math.abs(b) < 1e-12) { if (a < 0) return null; }
    else if (b > 0) lo = Math.max(lo, -a / b);
    else hi = Math.min(hi, -a / b);
    if (lo > hi) return null;
  }
  return [lo, hi];
}

export function updateConnections(monitors, network) {
  const attribute = network.geometry.getAttribute("position"), positions = attribute.array;
  let count = 0;
  for (const [a, b] of network.edges) {
    const x = monitors[a].userData.constellation, y = monitors[b].userData.constellation;
    const start = x.position.clone().addScaledVector(x.direction, 0.2);
    const end = y.position.clone().addScaledVector(y.direction, 0.2), delta = end.sub(start);
    const blocked = monitors.map(m => panelInterval(start, delta, m)).filter(Boolean).sort((p, q) => p[0] - q[0]);
    const emit = (lo, hi) => {
      if (hi - lo < 1e-6) return;
      for (const t of [lo, hi]) { positions[count++] = start.x + delta.x * t; positions[count++] = start.y + delta.y * t; positions[count++] = start.z + delta.z * t; }
    };
    let cursor = 0;
    for (const [lo, hi] of blocked) { emit(cursor, lo); cursor = Math.max(cursor, hi); }
    emit(cursor, 1);
  }
  attribute.needsUpdate = true;
  network.geometry.setDrawRange(0, count / 3);
  network.geometry.computeBoundingSphere();
}

/** Balanced Fibonacci directions, with a separate deterministic 9-18 unit
 * depth sequence. Connections are abstract geometry, never cultural claims. */
export function layoutConstellation(monitors, container) {
  const placements = monitors.map((_, i) => {
    const y = 1 - 2 * (i + 0.5) / monitors.length, azimuth = i * Math.PI * (3 - Math.sqrt(5));
    const h = Math.sqrt(1 - y * y), direction = new THREE.Vector3(Math.cos(azimuth) * h, y, Math.sin(azimuth) * h);
    const distance = 9 + 9 * ((i * 37) % monitors.length) / Math.max(1, monitors.length - 1);
    return { direction, distance, position: direction.clone().multiplyScalar(distance) };
  });
  monitors.forEach((monitor, i) => {
    const placement = placements[i];
    const nearest = Math.min(Math.PI / 2, ...placements.filter((_, j) => j !== i).map(p => placement.direction.angleTo(p.direction)));
    const envelopeAngle = nearest * 0.44;
    const halfDiagonal = (placement.distance - 0.03) * Math.tan(envelopeAngle) - RIM / Math.sqrt(2);
    const aspect = monitor.userData.photo.width / monitor.userData.photo.height;
    const width = Math.min(2.2, 2 * halfDiagonal * aspect / Math.hypot(aspect, 1));
    const inward = placement.direction.clone().negate();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), inward).normalize();
    const up = new THREE.Vector3().crossVectors(inward, right).normalize();
    monitor.userData.constellation = { ...placement, right, up, width, height: width / aspect, gap: 0, envelopeAngle };
    monitor.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, inward));
    applyPanel(monitor);
  });
  const edges = selectEdges(monitors), geometry = new THREE.BufferGeometry();
  // Clipping N panel intervals can create at most N+1 pieces per edge.
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(edges.length * (monitors.length + 1) * 6), 3).setUsage(THREE.DynamicDrawUsage));
  const material = new THREE.LineBasicMaterial({ color: 0x91b8d0, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false });
  const lines = new THREE.LineSegments(geometry, material); lines.name = "Abstract constellation connections";
  container.add(lines);
  const network = { edges, geometry, material, lines, disposed: false, dispose() {
    if (this.disposed) return; this.disposed = true; lines.removeFromParent(); geometry.dispose(); material.dispose();
  } };
  updateConnections(monitors, network);
  return network;
}

export function setConstellationGap(monitors, gapPercent, network) {
  const gap = Number.isFinite(gapPercent) ? THREE.MathUtils.clamp(gapPercent, 0, 30) : 0;
  for (const monitor of monitors) { monitor.userData.constellation.gap = gap; applyPanel(monitor); }
  if (network && !network.disposed) updateConnections(monitors, network);
}
