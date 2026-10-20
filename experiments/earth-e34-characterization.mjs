import assert from "node:assert/strict";
import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";
import { GalleryRoom } from "../src/systems/GalleryRoom.js";
import { layoutDenseGallery, measureMosaic } from "../src/systems/GalleryLayout.js";

let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const parent = new THREE.Group();
const room = new GalleryRoom(parent, { photoLoader: async () => new THREE.Texture() });
try {
  const pending = room.monitors.map(m => ({ number: m.userData.number, photo: m.userData.photo,
    position: m.position.clone(), scale: m.scale.clone(), quaternion: m.quaternion.clone() }));
  await room.ready;
  room.group.updateWorldMatrix(true, true);
  check(room.monitors.length === 75 && new Set(room.monitors.map(m => m.userData.number)).size === 75, "exactly 75 distinct panels");
  check(room.photoMaterials.size === 20, "original 20 shared photo textures/materials");
  const sectors = Array(6).fill(0);
  const tiles = room.monitors.map((m, i) => {
    const screen = m.children.at(-1), center = screen.getWorldPosition(new THREE.Vector3());
    const u = new THREE.Vector3(1, 0, 0).applyQuaternion(m.quaternion);
    const v = new THREE.Vector3(0, 1, 0).applyQuaternion(m.quaternion);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(m.quaternion);
    check(Math.abs(center.length() - 10) < 1e-9, "every photograph center lies on the radius-10 sphere");
    check(normal.dot(center.clone().negate().normalize()) >= 1 / Math.sqrt(3) - 1e-8, "every photograph faces inward, including sector corners and poles");
    check(m.position.equals(pending[i].position) && m.scale.equals(pending[i].scale)
      && m.quaternion.equals(pending[i].quaternion) && m.userData.photo === pending[i].photo,
      "loading does not change cell placement or photo assignment");
    check(Math.abs(screen.scale.x / screen.scale.y - m.userData.photo.width / m.userData.photo.height) < 1e-10,
      "flat photograph keeps its original aspect ratio");
    check(screen.geometry === room.photoGeometry && screen.material.map.repeat.equals(new THREE.Vector2(1, 1))
      && screen.material.map.offset.equals(new THREE.Vector2()), "original shared plane and uncropped full-image UVs");
    sectors[m.userData.mosaicCell.face]++;
    const { x0, x1, y0, y1 } = m.userData.mosaicCell;
    check(x0 >= -1.000001 && x1 <= 1.000001 && y0 >= -1.000001 && y1 <= 1.000001, "cell remains within its spherical sector");
    return { center, normal, u, v, width: screen.scale.x * m.scale.x, height: screen.scale.y * m.scale.y };
  });
  check(sectors.every(n => n === 12 || n === 13), "four horizon sectors and two polar sectors all populated");
  // Check actual cell-edge adjacency, including transitions between sectors.
  // Center-nearest neighbours are not a reliable adjacency test for shelves
  // containing very different panorama and portrait dimensions.
  let borderNeighbours = 0;
  const cellCorners = (index, otherOutward) => {
    const { x0, x1, y0, y1 } = room.monitors[index].userData.mosaicCell;
    const tile = tiles[index];
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(([x, y]) =>
      tile.normal.clone().negate().addScaledVector(tile.u, x).addScaledVector(tile.v, y))
      .filter(p => Math.abs(p.dot(otherOutward) - 1) < 0.001);
  };
  for (let i = 0; i < 75; i++) for (let j = i + 1; j < 75; j++) {
    const a = room.monitors[i], b = room.monitors[j];
    if (a.userData.mosaicCell.face === b.userData.mosaicCell.face) {
      check(a.userData.photo.path !== b.userData.photo.path, "no repeated photograph within a sector"); continue;
    }
    if (Math.abs(tiles[i].normal.dot(tiles[j].normal)) > 0.01) continue;
    const aa = cellCorners(i, tiles[j].normal.clone().negate());
    const bb = cellCorners(j, tiles[i].normal.clone().negate());
    if (aa.length !== 2 || bb.length !== 2) continue;
    const axis = new THREE.Vector3().crossVectors(tiles[i].normal, tiles[j].normal).normalize();
    const ia = aa.map(p => p.dot(axis)), ib = bb.map(p => p.dot(axis));
    if (Math.min(Math.max(...ia), Math.max(...ib)) - Math.max(Math.min(...ia), Math.min(...ib)) <= 0.0001) continue;
    borderNeighbours++;
    check(a.userData.photo.path !== b.userData.photo.path, "no identical photographs share a sector-border edge");
  }
  const boxes = room.monitors.map(m => new OBB(new THREE.Vector3(), new THREE.Vector3(0.5, 0.5, 0.5))
    .applyMatrix4(m.children[0].matrixWorld));
  const corners = room.monitors.map(m => {
    const points = [];
    for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5])
      points.push(m.children[0].localToWorld(new THREE.Vector3(x, y, z)));
    return points;
  });
  function hull(points) {
    points.sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const half = values => { const result = []; for (const p of values) {
      while (result.length >= 2 && cross(result.at(-2), result.at(-1), p) <= 0) result.pop(); result.push(p);
    } return result; };
    return [...half(points).slice(0, -1), ...half([...points].reverse()).slice(0, -1)];
  }
  let testedProjectedPairs = 0;
  for (let i = 0; i < 75; i++) for (let j = i + 1; j < 75; j++) {
    check(!boxes[i].intersectsOBB(boxes[j]), "no physical frame intersections");
    const a = tiles[i].center.clone().normalize(), b = tiles[j].center.clone().normalize();
    const angle = a.angleTo(b);
    const cone = (d, points) => Math.max(...points.map(p => d.angleTo(p)));
    if (angle > cone(a, corners[i]) + cone(b, corners[j])) continue;
    if (tiles[i].normal.dot(tiles[j].normal) < -0.99) {
      check(corners[i].every(p => p.dot(tiles[i].normal) < 0)
        && corners[j].every(p => p.dot(tiles[i].normal) > 0), "opposite sectors occupy disjoint viewing hemispheres");
      continue;
    }
    // Sector normals, unlike center-vector bisectors, provide a shared
    // gnomonic hemisphere even for very wide off-axis rectangular tiles.
    const n = tiles[i].normal.clone().add(tiles[j].normal).negate().normalize();
    check([...corners[i], ...corners[j]].every(p => p.dot(n) > 0), "projection plane contains both complete frame silhouettes");
    let u = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0));
    if (u.lengthSq() < 1e-8) u.crossVectors(n, new THREE.Vector3(1, 0, 0));
    u.normalize(); const v = new THREE.Vector3().crossVectors(n, u);
    const project = points => hull(points.map(p => new THREE.Vector2(p.dot(u) / p.dot(n), p.dot(v) / p.dot(n))));
    const pa = project(corners[i]), pb = project(corners[j]);
    let separated = false;
    for (const polygon of [pa, pb]) for (let k = 0; k < polygon.length; k++) {
      const edge = polygon[(k + 1) % polygon.length].clone().sub(polygon[k]);
      const axis = new THREE.Vector2(-edge.y, edge.x).normalize();
      const aa = pa.map(p => p.dot(axis)), bb = pb.map(p => p.dot(axis));
      if (Math.max(...aa) < Math.min(...bb) - 1e-9 || Math.max(...bb) < Math.min(...aa) - 1e-9) separated = true;
    }
    testedProjectedPairs++;
    check(separated, "full eight-corner frame silhouettes do not overlap: " + (i + 1) + "/" + (j + 1));
  }
  const analytic = measureMosaic(room.monitors);
  check(analytic.photoFreeFraction >= 0.01 && analytic.photoFreeFraction <= 0.03, "actual photograph footprints leave 1–3% dark area over the full sphere");
  check(analytic.cellCoverage > 0.999 && analytic.maxGapRadiusDegrees < 0.75, "no large empty cell or polar region");
  // Independent equal-area rays intersect the actual world-space photo planes.
  // No cell metadata or analytical coverage function is used by this sampler.
  const sampleCount = 240000;
  let gaps = 0, overlaps = 0;
  const latitude = Array.from({ length: 12 }, () => ({ rays: 0, gaps: 0 }));
  for (let i = 0; i < sampleCount; i++) {
    const y = 1 - 2 * (i + 0.5) / sampleCount, a = i * Math.PI * (3 - Math.sqrt(5));
    const r = Math.sqrt(1 - y * y), ray = new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
    let hits = 0;
    for (const tile of tiles) {
      const denominator = ray.dot(tile.normal);
      if (denominator >= 0) continue;
      const distance = tile.center.dot(tile.normal) / denominator;
      const point = ray.clone().multiplyScalar(distance).sub(tile.center);
      if (Math.abs(point.dot(tile.u)) <= tile.width / 2 && Math.abs(point.dot(tile.v)) <= tile.height / 2) hits++;
    }
    const band = latitude[Math.min(11, Math.floor((y + 1) * 6))]; band.rays++;
    if (!hits) { gaps++; band.gaps++; }
    if (hits > 1) overlaps++;
  }
  const sampledGap = gaps / sampleCount;
  check(Math.abs(sampledGap - analytic.photoFreeFraction) < 0.001, "independent actual-geometry rays agree with exact solid-angle coverage");
  check(overlaps === 0, "no photo occlusion in 240,000 whole-sphere viewing directions");
  check(latitude.every(band => band.gaps / band.rays < 0.03), "every equal-area latitude band, including both poles, has under 3% photo-free area");
  for (const direction of [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)]) {
    const raycaster = new THREE.Raycaster(new THREE.Vector3(), direction);
    check(raycaster.intersectObjects(room.monitors.map(m => m.children.at(-1)), false).length === 1,
      "actual polar ray sees exactly one photograph");
  }
  const repeat = new GalleryRoom(new THREE.Group(), { photoLoader: async () => { throw Error("fixture"); } });
  check(repeat.monitors.every((m, i) => m.position.equals(room.monitors[i].position)
    && m.scale.equals(room.monitors[i].scale) && m.quaternion.equals(room.monitors[i].quaternion)), "layout is deterministic");
  repeat.dispose();
  layoutDenseGallery(room.monitors);
  check(room.monitors.every((m, i) => m.position.equals(pending[i].position) && m.scale.equals(pending[i].scale)), "layout is idempotent after photo loading");
  room.place(new THREE.Vector3(3, -2, 14), new THREE.Vector3(0.4, 0.2, -1).normalize());
  check(room.getCenter().distanceTo(new THREE.Vector3(3, -2, 14)) < 1e-9, "gallery remains centered at an arbitrary saved viewpoint");
  console.log(JSON.stringify({ result: "PASS", checks, sectors, analytic, sampledGapPercent: sampledGap * 100,
    sampleCount, overlaps, testedProjectedPairs, borderNeighbours, latitudeGapPercent: latitude.map(band => 100 * band.gaps / band.rays),
    limitation: "six sector orientations; flat photographs are oblique near sector borders", scope: "actual geometry; no browser visual claim" }));
} finally { room.dispose(); }
