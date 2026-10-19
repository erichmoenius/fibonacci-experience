import assert from "node:assert/strict";
import * as THREE from "three";
import { EnvironmentTheme } from "../src/themes/EnvironmentTheme.js";
import { ThemeManager } from "../src/engine/ThemeManager.js";
import { EARTH_RADIUS } from "../src/systems/EarthGlobe.js";
import { EARTH_SATELLITES, ORBIT_RADIUS, SATELLITE_RADIUS } from "../src/systems/EarthSatellites.js";

const load = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function (_url, ready) {
  ready(new THREE.Texture({ width: 4096, height: 2048 }));
};
const manager = new ThemeManager(new THREE.Group(), null);
manager.register("environment", EnvironmentTheme);
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
try {
  manager.activate("environment");
  const theme = manager.activeTheme;
  await theme.earth.ready;
  check(theme.displayName === "EARTH", "display name");
  check(theme.getFlightGUIConfig().storageKey === "fibonacci-flight-v1-environment", "saved F key preserved");
  check(theme.earth.group.visible && theme.earth.getWorldCenter(new THREE.Vector3()).length() === 0, "central Earth ready");
  check(theme.getGateways().length === 0, "no transporters");
  const spheres = theme.satellites.satellites;
  check(spheres.length === 6, "exactly six satellites");
  check(new Set(spheres.map(s => s.material.color.getHex())).size === 6, "six different colors");
  check(spheres.every((s, i) => s.userData.number === i + 1 && s.userData.title === EARTH_SATELLITES[i].title), "number/category mapping");
  check(spheres.every(s => s.children.length === 1 && s.children[0].isSprite && s.children[0].material.map.image.data.some(v => v === 255)), "visible raster number badges");
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  let minEarthGap = Infinity, minPairGap = Infinity;
  for (const aspect of [16 / 9, 1, 9 / 16]) {
    globalThis.window = { innerWidth: aspect * 1000, innerHeight: 1000 };
    const home = theme.getHomePose();
    camera.aspect = aspect;
    camera.position.copy(home.position);
    camera.lookAt(home.lookTarget);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    for (let frame = 0; frame < 900; frame++) {
      const previous = spheres.map(s => s.position.clone());
      theme.satellites.update(0.1);
      theme.satellites.group.updateMatrixWorld(true);
      for (const [i, sphere] of spheres.entries()) {
        check(Math.abs(sphere.position.length() - ORBIT_RADIUS) < 1e-10, "constant orbit radius");
        check(sphere.position.distanceTo(previous[i]) < 0.031, "smooth bounded movement");
        minEarthGap = Math.min(minEarthGap, sphere.position.length() - SATELLITE_RADIUS - EARTH_RADIUS * 1.018);
        for (const other of spheres.slice(i + 1)) minPairGap = Math.min(minPairGap, sphere.position.distanceTo(other.position) - 2 * SATELLITE_RADIUS);
        for (const object of [sphere, sphere.children[0]]) {
          const world = object.getWorldPosition(new THREE.Vector3());
          const ndc = world.clone().project(camera);
          check(Math.abs(ndc.x) < 0.9 && Math.abs(ndc.y) < 0.9 && Math.abs(ndc.z) < 1, "sphere/badge inside home frustum");
          const ray = new THREE.Ray(camera.position.clone(), world.clone().sub(camera.position).normalize());
          check(ray.distanceToPoint(home.lookTarget) > EARTH_RADIUS * 1.018, "sphere/badge not hidden by Earth at home");
        }
      }
    }
  }
  check(minEarthGap > 1.8 && minPairGap > 3.6, "positive surface clearances throughout three orbits");
  const before = spheres.map(s => s.position.clone());
  for (const delta of [-1, NaN, Infinity]) theme.satellites.update(delta);
  check(spheres.every((s, i) => s.position.equals(before[i])), "invalid/backward time stable");
  let geometryDisposals = 0, textureDisposals = 0, materialDisposals = 0;
  theme.satellites.geometry.addEventListener("dispose", () => geometryDisposals++);
  spheres.forEach(s => {
    s.material.addEventListener("dispose", () => materialDisposals++);
    s.children[0].material.addEventListener("dispose", () => materialDisposals++);
    s.children[0].material.map.addEventListener("dispose", () => textureDisposals++);
  });
  theme.destroy();
  theme.satellites.dispose();
  check(manager.container.children.length === 0, "theme cleanup removes Earth and satellites");
  check(geometryDisposals === 1 && textureDisposals === 6 && materialDisposals === 12, "shared geometry and all badge resources disposed once");
  manager.activate("environment");
  await manager.activeTheme.earth.ready;
  check(manager.activeTheme.satellites.satellites.length === 6, "independent reentry recreates exactly six");
  manager.activeTheme.destroy();
  console.log(JSON.stringify({ result: "PASS", checks, minEarthGap, minPairGap, aspects: ["landscape", "square", "portrait"], scope: "CPU scene/frustum/lifecycle checks; no browser visual claim" }));
} finally {
  THREE.TextureLoader.prototype.load = load;
  delete globalThis.window;
}
