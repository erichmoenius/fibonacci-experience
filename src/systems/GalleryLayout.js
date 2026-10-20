import * as THREE from "three";

const RADIUS = 10;
const SEAM = 0.01;
const MIN_SAFE_SEAM = 0.003;
// Thin physical depth prevents a tilted frame's side walls from intruding
// into a neighbour's viewing rays. Photo dimensions are compensated below.
const LOCAL_SCALE = 0.002;
const RIM = 0.025;
const DIRECTIONS = [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 1, 0], [0, -1, 0]];
const ratio = monitor => monitor.userData.photo.width / monitor.userData.photo.height;

function partition(monitors) {
  const capacities = Array.from({ length: 6 }, (_, i) => Math.floor(monitors.length / 6) + (i < monitors.length % 6 ? 1 : 0));
  const groups = capacities.map(() => []);
  const photos = new Map();
  for (const monitor of monitors) {
    const path = monitor.userData.photo.path;
    if (!photos.has(path)) photos.set(path, []);
    photos.get(path).push(monitor);
  }
  for (const copies of [...photos.values()].sort((a, b) => b.length - a.length)) {
    for (const monitor of copies) {
      const choices = groups.map((group, index) => ({ group, index }))
        .filter(({ group, index }) => group.length < capacities[index])
        .sort((a, b) => Number(a.group.some(m => m.userData.photo.path === monitor.userData.photo.path))
          - Number(b.group.some(m => m.userData.photo.path === monitor.userData.photo.path))
          || a.group.length / capacities[a.index] - b.group.length / capacities[b.index]
          || a.group.reduce((sum, m) => sum + ratio(m), 0) - b.group.reduce((sum, m) => sum + ratio(m), 0));
      choices[0].group.push(monitor);
    }
  }
  return groups;
}

function packSector(monitors, random) {
  if (!monitors.length) return [];
  let best, bestError = Infinity;
  const totalRatio = monitors.reduce((sum, m) => sum + ratio(m), 0);
  const rowCount = Math.min(monitors.length, Math.max(1, Math.floor(Math.sqrt(totalRatio))));
  // Search discrete shelf partitions only. Within a row every image has the
  // same height, and width = height * source aspect ratio, exactly.
  for (let trial = 0; trial < 8192; trial++) {
    const order = [...monitors];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]];
    }
    const cuts = new Set();
    while (cuts.size < rowCount - 1) cuts.add(1 + Math.floor(random() * (order.length - 1)));
    const stops = [0, ...[...cuts].sort((a, b) => a - b), order.length];
    const rows = stops.slice(1).map((end, i) => order.slice(stops[i], end));
    const height = rows.reduce((sum, row) => sum + 1 / row.reduce((s, m) => s + ratio(m), 0), 0);
    const error = Math.abs(Math.log(height));
    if (error < bestError) { best = { rows, height }; bestError = error; }
    if (bestError < 0.00001 || rowCount === 1) break;
  }
  const width = 2 / Math.max(1, best.height);
  let y = width * best.height / 2;
  return best.rows.flatMap(row => {
    const height = width / row.reduce((sum, m) => sum + ratio(m), 0);
    let x = -width / 2;
    const tiles = row.map(monitor => {
      const w = height * ratio(monitor);
      const cell = { monitor, x0: x, x1: x + w, y0: y - height, y1: y };
      x += w; return cell;
    });
    y -= height;
    return tiles;
  });
}

function sectorBasis(index) {
  const outward = new THREE.Vector3(...DIRECTIONS[index]);
  const inward = outward.clone().negate();
  const up = index < 4 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, index === 4 ? 1 : -1);
  const right = new THREE.Vector3().crossVectors(up, inward);
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, inward));
  return { outward, inward, up, right, quaternion };
}

function reflect(tile, bits) {
  return { ...tile, x0: bits & 1 ? -tile.x1 : tile.x0, x1: bits & 1 ? -tile.x0 : tile.x1,
    y0: bits & 2 ? -tile.y1 : tile.y0, y1: bits & 2 ? -tile.y0 : tile.y1 };
}

function borderSegments(tiles, face, bits) {
  const { outward, right, up } = sectorBasis(face);
  const segments = [];
  for (const item of tiles) {
    const tile = reflect(item, bits);
    for (const edge of [[[tile.x0, tile.y0], [tile.x1, tile.y0]], [[tile.x1, tile.y0], [tile.x1, tile.y1]],
      [[tile.x1, tile.y1], [tile.x0, tile.y1]], [[tile.x0, tile.y1], [tile.x0, tile.y0]]]) {
      const points = edge.map(([x, y]) => outward.clone().addScaledVector(right, x).addScaledVector(up, y).toArray());
      const fixed = [0, 1, 2].filter(axis => points.every(p => Math.abs(Math.abs(p[axis]) - 1) < 0.001)
        && points[0][axis] * points[1][axis] > 0);
      if (fixed.length !== 2) continue;
      const free = [0, 1, 2].find(axis => !fixed.includes(axis));
      segments.push({ key: fixed.map(axis => axis + ":" + Math.sign(points[0][axis])).join(","),
        lo: Math.min(...points.map(p => p[free])), hi: Math.max(...points.map(p => p[free])),
        path: tile.monitor.userData.photo.path });
    }
  }
  return segments;
}

function chooseMirrors(sectors) {
  // Reflect cell positions (never the photographs) to separate copies across
  // sector borders. Each sector already contains distinct source images.
  const edges = sectors.map((tiles, face) => [0, 1, 2, 3].map(bits => borderSegments(tiles, face, bits)));
  const pairs = [];
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) {
    const cost = edges[a].map(aa => edges[b].map(bb => aa.reduce((sum, x) => sum + bb.filter(y =>
      x.key === y.key && x.path === y.path && Math.min(x.hi, y.hi) - Math.max(x.lo, y.lo) > 0.0001).length, 0)));
    pairs.push({ a, b, cost });
  }
  let best = Array(6).fill(0), bestCost = Infinity;
  for (let code = 0; code < 4096 && bestCost > 0; code++) {
    const bits = Array.from({ length: 6 }, (_, i) => code >> (i * 2) & 3);
    const cost = pairs.reduce((sum, pair) => sum + pair.cost[bits[pair.a]][bits[pair.b]], 0);
    if (cost < bestCost) { bestCost = cost; best = bits; }
  }
  return best;
}

function applyCell(monitor, cell, inset, basis = sectorBasis(cell.face)) {
  const { outward, inward, up, right, quaternion } = basis;
  const { x0, x1, y0, y1 } = cell;
  const x = (x0 + x1) / 2, y = (y0 + y1) / 2;
  const center = outward.clone().addScaledVector(right, x).addScaledVector(up, y);
  const radialScale = RADIUS / center.length();
  const scale = radialScale * LOCAL_SCALE;
  const width = (x1 - x0) * (1 - inset) / LOCAL_SCALE;
  const height = (y1 - y0) * (1 - inset) / LOCAL_SCALE;
  monitor.position.copy(center).multiplyScalar(radialScale).addScaledVector(inward, -0.09 * scale);
  monitor.quaternion.copy(quaternion);
  monitor.scale.setScalar(scale);
  monitor.userData.panelSize = { width, height };
  monitor.userData.mosaicCell = cell;
  monitor.userData.mosaicInset = inset;
  monitor.children[0].scale.set(width + RIM, height + RIM, 0.12);
  monitor.children[1].scale.set(width, height, 0.025);
  const numberScale = Math.min(width / 2, height / 1.2);
  for (const glyph of monitor.children.slice(2).filter(child => child.geometry.type === "BoxGeometry")) {
    glyph.userData.mosaicBase ??= { position: glyph.position.clone(), scale: glyph.scale.clone() };
    glyph.position.copy(glyph.userData.mosaicBase.position);
    glyph.position.x *= numberScale; glyph.position.y *= numberScale;
    glyph.scale.copy(glyph.userData.mosaicBase.scale);
    glyph.scale.x *= numberScale; glyph.scale.y *= numberScale;
  }
  if (monitor.userData.photoStatus === "ready") monitor.children.at(-1).scale.set(width, height, 1);
}

/** Six angular sectors cover the entire sphere without polar singularities.
 * Flat rectangles are placed radially on a spherical shell while preserving
 * their sector's projection. No UV warp, crop or per-image texture is added. */
export function layoutDenseGallery(monitors) {
  let seed = 34075;
  const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  const groups = partition(monitors);
  const sectors = groups.map(group => packSector(group, random));
  const mirrors = chooseMirrors(sectors);
  sectors.forEach((tiles, face) => {
    const basis = sectorBasis(face);
    for (const item of tiles) {
      const tile = reflect(item, mirrors[face]);
      const { monitor, x0, x1, y0, y1 } = tile;
      // The loaded photo's local z=0.09 lands exactly on the radius-10 shell.
      applyCell(monitor, { face, x0, x1, y0, y1 }, SEAM, basis);
    }
  });
}

const integral = (x, y) => Math.atan2(x * y, Math.sqrt(1 + x * x + y * y));
function rectangleAngle(x0, x1, y0, y1) {
  return integral(x1, y1) - integral(x0, y1) - integral(x1, y0) + integral(x0, y0);
}

export function measureMosaic(monitors) {
  let cells = 0, photos = 0;
  for (const monitor of monitors) {
    const { x0, x1, y0, y1 } = monitor.userData.mosaicCell;
    cells += rectangleAngle(x0, x1, y0, y1);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const inset = monitor.userData.mosaicInset ?? SEAM;
    const hw = (x1 - x0) * (1 - inset) / 2, hh = (y1 - y0) * (1 - inset) / 2;
    photos += rectangleAngle(cx - hw, cx + hw, cy - hh, cy + hh);
  }
  let maxGapRadius = 0;
  for (let face = 0; face < 6; face++) {
    const tiles = monitors.filter(m => m.userData.mosaicCell.face === face).map(m => m.userData.mosaicCell);
    if (!tiles.length) { maxGapRadius = Math.PI; continue; }
    const padX = Math.max(0, 1 + Math.min(...tiles.map(t => t.x0)), 1 - Math.max(...tiles.map(t => t.x1)));
    const padY = Math.max(0, 1 + Math.min(...tiles.map(t => t.y0)), 1 - Math.max(...tiles.map(t => t.y1)));
    // Normalizing vectors on a cube face cannot increase angular path length
    // beyond the face's Euclidean path length. This is a conservative bound
    // on distance from ANY viewing ray to some photograph, including poles.
    const inset = Math.max(...monitors.filter(m => m.userData.mosaicCell.face === face).map(m => {
      const t = m.userData.mosaicCell;
      return (m.userData.mosaicInset ?? SEAM) / 2 * Math.hypot(t.x1 - t.x0, t.y1 - t.y0);
    }));
    maxGapRadius = Math.max(maxGapRadius, Math.hypot(padX, padY) + inset);
  }
  return { panels: monitors.length, cellCoverage: cells / (4 * Math.PI),
    photoCoverage: photos / (4 * Math.PI), photoFreeFraction: 1 - photos / (4 * Math.PI),
    maxGapRadiusDegrees: THREE.MathUtils.radToDeg(maxGapRadius) };
}

function coverageAtInset(monitors, inset) {
  return monitors.reduce((sum, monitor) => {
    const { x0, x1, y0, y1 } = monitor.userData.mosaicCell;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const hw = (x1 - x0) * (1 - inset) / 2, hh = (y1 - y0) * (1 - inset) / 2;
    return sum + rectangleAngle(cx - hw, cx + hw, cy - hh, cy + hh);
  }, 0) / (4 * Math.PI);
}

/** Update existing meshes only. Gap is whole-sphere photo-free angular area,
 * not a second size multiplier. Zero retains clearance for the thin frames. */
export function setMosaicGap(monitors, gapPercent) {
  const requested = Number.isFinite(gapPercent) ? THREE.MathUtils.clamp(gapPercent, 0, 30) : 0;
  const target = Math.min(1 - requested / 100, coverageAtInset(monitors, MIN_SAFE_SEAM));
  let low = MIN_SAFE_SEAM, high = 0.5;
  for (let i = 0; i < 42; i++) {
    const mid = (low + high) / 2;
    if (coverageAtInset(monitors, mid) > target) low = mid; else high = mid;
  }
  const inset = (low + high) / 2;
  const bases = DIRECTIONS.map((_, face) => sectorBasis(face));
  for (const monitor of monitors) applyCell(monitor, monitor.userData.mosaicCell, inset, bases[monitor.userData.mosaicCell.face]);
  return measureMosaic(monitors);
}
