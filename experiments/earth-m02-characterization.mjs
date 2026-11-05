import assert from "node:assert/strict";
import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";
import { EARTH_GALLERIES } from "../src/config/earthGalleries.js";
import { EARTH_SATELLITES } from "../src/systems/EarthSatellites.js";
import { GalleryRoom } from "../src/systems/GalleryRoom.js";
import { layoutCubeGallery, setMosaicGap, setMosaicRadius, measureMosaic } from "../src/systems/GalleryLayout.js";

let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const countries = EARTH_GALLERIES.find(config => config.id === "countries");
check(EARTH_SATELLITES.length === 7 && EARTH_GALLERIES.length === 7, "seven satellite destinations remain registered");
check(countries.number === 2 && countries.layout === "CUBE" && countries.content === "placeholders" && !countries.radiusControl,
  "Countries alone selects the cube placeholder layout without Sphere Radius");
check(EARTH_GALLERIES.filter(config => config !== countries).every(config => config.layout === "SPHERICAL" && config.radiusControl),
  "the other six destinations retain their spherical controls and layout");
const faces = [
  ["front", [0, 0, -1]], ["right", [1, 0, 0]], ["back", [0, 0, 1]],
  ["left", [-1, 0, 0]], ["ceiling", [0, 1, 0]], ["floor", [0, -1, 0]],
];
const parent = new THREE.Group();
const room = new GalleryRoom(parent, { ...countries, photoLoader: () => { throw new Error("Cube must not load media"); } });
const twin = new GalleryRoom(new THREE.Group(), countries);
await Promise.all([room.ready, twin.ready]);
check(room.monitors.length === 75 && new Set(room.monitors.map(m => m.userData.number)).size === 75, "all 75 stable numbered slots exist");
check(room.photoMaterials.size === 0 && !room.photoGeometry && room.monitors.every(m => m.userData.photoStatus === "placeholder"),
  "Countries still has zero loaded photograph resources");
const state = m => ({ position: m.position.toArray(), scale: m.scale.toArray(), orientation: m.quaternion.toArray(),
  cell: m.userData.mosaicCell, size: m.userData.panelSize, photo: m.userData.photo.path });
check(JSON.stringify(room.monitors.map(state)) === JSON.stringify(twin.monitors.map(state)), "cube construction is deterministic");
check(JSON.stringify(faces.map(([name]) => room.monitors.filter(m => m.userData.cubeFace === name).length)) === "[13,13,13,12,12,12]",
  "75 slots balance deterministically across front/right/back/left/ceiling/floor");
const identities = room.monitors.map(m => ({ monitor: m, children: [...m.children], photo: m.userData.photo,
  geometry: m.children[0].geometry, material: m.children[1].material }));
const unitBox = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5));
for (const gap of [0, 10, 30, 0]) {
  setMosaicGap(room.monitors, gap);
  room.group.updateWorldMatrix(true, true);
  const obbs = room.monitors.map(m => new OBB().fromBox3(unitBox).applyMatrix4(m.children[0].matrixWorld));
  for (const [i, monitor] of room.monitors.entries()) {
    const outward = new THREE.Vector3(...faces[monitor.userData.mosaicCell.face][1]);
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(monitor.quaternion);
    check(normal.dot(outward) < -0.999999999, "panel normal points into cube");
    const photoCenter = monitor.localToWorld(new THREE.Vector3(0, 0, 0.09));
    check(Math.abs(photoCenter.dot(outward) - 10) < 1e-9, "panel center lies on its face plane, not a sphere");
    const { x0, x1, y0, y1 } = monitor.userData.mosaicCell;
    check(x0 >= -1 - 1e-9 && x1 <= 1 + 1e-9 && y0 >= -1 - 1e-9 && y1 <= 1 + 1e-9,
      "packed cell stays within cube face");
    check(identities[i].monitor === monitor && identities[i].photo === monitor.userData.photo
      && identities[i].children.every((child, j) => child === monitor.children[j])
      && identities[i].geometry === monitor.children[0].geometry && identities[i].material === monitor.children[1].material,
      "Gap preserves monitor, selection metadata, children and resource identities");
    check(Math.abs(monitor.userData.panelSize.width / monitor.userData.panelSize.height - 2 / 1.2) < 1e-9,
      "panel aspect ratio is preserved");
    const hit = new THREE.Raycaster(new THREE.Vector3(), photoCenter.clone().normalize()).intersectObjects(monitor.children, false);
    check(hit.length > 0 && hit[0].object.parent === monitor, "panel can be inspected by a center-to-face ray");
    for (let j = i + 1; j < obbs.length; j++) check(!obbs[i].intersectsOBB(obbs[j], 1e-10), "cube frames never intersect on or across faces");
  }
  const coverage = measureMosaic(room.monitors);
  check(Number.isFinite(coverage.photoFreeFraction) && coverage.photoFreeFraction >= gap / 100 - 1e-9,
    "Gap measurement remains meaningful for the cube interior");
}
const cubeTransforms = room.monitors.map(m => m.position.clone());
setMosaicRadius(room.monitors, 20);
check(room.monitors.every((m, i) => m.position.equals(cubeTransforms[i])), "sphere-radius API cannot turn cube faces into a spherical shell");
layoutCubeGallery(room.monitors);
check(JSON.stringify(room.monitors.map(state)) === JSON.stringify(twin.monitors.map(state)), "re-layout restores deterministic placement without reallocating slots");
const worldCenter = new THREE.Vector3(3, -2, 8), forward = new THREE.Vector3(1, 0.3, -0.2).normalize();
room.place(worldCenter, forward);
check(room.getCenter().distanceTo(worldCenter) < 1e-9, "room placement keeps the visitor at the requested world center");
check(new THREE.Vector3(0, 0, -1).applyQuaternion(room.group.quaternion).dot(forward) > 0.999999999,
  "cube front follows the saved entry heading");
const resources = new Map();
room.group.traverse(object => {
  for (const resource of [object.geometry, object.material].filter(Boolean)) {
    if (!resources.has(resource)) {
      resources.set(resource, 0);
      resource.addEventListener("dispose", () => resources.set(resource, resources.get(resource) + 1));
    }
  }
});
room.dispose(); room.dispose(); twin.dispose();
check([...resources.values()].every(count => count === 1), "shared and per-panel resources dispose exactly once");
check(room.abortController.signal.aborted && !room.group.parent && parent.children.length === 0,
  "gallery cleanup removes the room and aborts pending work");
console.log(JSON.stringify({ result: "PASS", checks, layout: "CUBE", slots: 75,
  faceOrder: faces.map(([name]) => name), faceCounts: [13, 13, 13, 12, 12, 12], halfExtent: 10,
  gapSamples: [0, 10, 30, 0], pairwiseIntersectionChecks: 11100,
  scope: "real Three.js geometry, raycasting and OBB intersections; no DOM, HTTP or browser visual claim" }));
