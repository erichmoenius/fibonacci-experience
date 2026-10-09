import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { EarthGlobe, EARTH_STANDARD_BYTES } from '../src/systems/EarthGlobe.js';
import { SolarSystem, SOLAR_DISPLAY } from '../src/systems/SolarSystem.js';
import { PlanetaryTheme } from '../src/themes/PlanetaryTheme.js';
import { EnvironmentTheme } from '../src/themes/EnvironmentTheme.js';
import { ThemeManager } from '../src/engine/ThemeManager.js';

const checkpoint = '341103139b875e72b8b923aa64a05a6155b20863';
let checks = 0;
const check = (value, message) => { assert.ok(value, message); checks++; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const load = THREE.TextureLoader.prototype.load;
const requests = [], maps = [];
let delayed = false;
THREE.TextureLoader.prototype.load = function(url, success, progress, error) {
  const texture = new THREE.Texture({ width: url.includes('8k') ? 8192 : 4096, height: url.includes('8k') ? 4096 : 2048 });
  texture.disposals = 0;
  texture.addEventListener('dispose', () => texture.disposals++);
  requests.push({ url, success, error, texture }); maps.push(texture);
  if (!delayed) success(texture);
};
const renderer = { capabilities: { getMaxAnisotropy: () => 16, maxTextureSize: 16384 }, initTexture() {} };
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const oldSource = execFileSync('git', ['show', `${checkpoint}:src/systems/SolarSystem.js`], { encoding: 'utf8' });
const { SolarSystem: OldSolar } = await import(moduleURL(oldSource.replace('from "three"', `from ${JSON.stringify(import.meta.resolve('three'))}`)));

try {
  globalThis.window = { devicePixelRatio: 1, innerWidth: 1920, innerHeight: 1080 };
  const parent = new THREE.Group(); parent.position.set(4, -3, 7); parent.rotation.y = 0.4;
  const solar = new SolarSystem(parent);
  const oldParent = parent.clone(false); const oldSolar = new OldSolar(oldParent);
  await solar.earthGlobe.ready;
  check(solar.earthGlobe.group.visible && solar.earth === solar.earthGlobe.surface, 'visible solid Earth is the integration target');
  check(requests.length === 5 && requests.every(r => r.url.includes('-4k.')), 'only five licensed local 4K maps; no 8K');
  check(EARTH_STANDARD_BYTES === 223696220, 'five 4K mip chains remain about 213.33 MiB');
  check(solar.earth.geometry.parameters.radius === SOLAR_DISPLAY.earthRadius, 'physical radius preserved');
  check(solar.earthTilt.rotation.z === oldSolar.earthTilt.rotation.z && solar.earthGlobe.group.rotation.z === 0, 'original tilt applied once');
  check(solar.earth.rotation.y === 0 && solar.clouds.rotation.y === 0, 'original initial spin preserved');
  for (const delta of [0, 0.01, 0.1, 0.016, 0.033, ...Array(120).fill(1 / 60)]) {
    solar.update(delta); oldSolar.update(delta);
    for (const [name, { body, orbit }] of solar.planets) {
      const old = oldSolar.planets.get(name);
      check(body.rotation.y === old.body.rotation.y && orbit.rotation.y === old.orbit.rotation.y, `${name} timing unchanged`);
      check(body.getWorldPosition(new THREE.Vector3()).distanceTo(old.body.getWorldPosition(new THREE.Vector3())) < 1e-10, `${name} world position unchanged`);
      if (name !== 'Earth') {
        check(body.geometry.parameters.radius === old.body.geometry.parameters.radius, `${name} size unchanged`);
        check(Buffer.from(body.material.map.image.data).equals(Buffer.from(old.body.material.map.image.data)), `${name} appearance unchanged`);
      }
    }
    check(solar.clouds.rotation.y === oldSolar.clouds.rotation.y && solar.moonOrbit.rotation.y === oldSolar.moonOrbit.rotation.y
      && solar.sun.rotation.y === oldSolar.sun.rotation.y, 'cloud/Moon/Sun timing preserved');
    const expected = solar.getSunWorldPosition(new THREE.Vector3()).sub(solar.earth.getWorldPosition(new THREE.Vector3())).normalize();
    check(solar.earthGlobe.uniforms.sunDirection.value.distanceTo(expected) < 1e-12, 'live Sun direction in world space');
    check(Math.abs(solar.earthGlobe.uniforms.cloudOffset.value - (solar.clouds.rotation.y - solar.earth.rotation.y) / (2 * Math.PI)) < 1e-12, 'cloud shadows follow weather spin');
  }
  solar.dispose(); oldSolar.dispose(); await flush();
  check(maps.every(t => t.disposals === 1), 'first system releases all maps exactly once');

  const manager = new ThemeManager(new THREE.Group(), null);
  manager.register('planetary', PlanetaryTheme); manager.register('environment', EnvironmentTheme);
  manager.activate('planetary'); const theme = manager.activeTheme;
  await theme.solarSystem.earthGlobe.ready;
  const earth = theme.solarSystem.earth;
  check(theme.earthGateway.target === earth && theme.earthGateway.crossing.target === earth && theme.earthGateway.radius === 10, 'gateway and crossing use visible surface at READY radius 10');
  const center = earth.getWorldPosition(new THREE.Vector3());
  const home = theme.getHomePose(); const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 320);
  camera.position.copy(home.position); camera.lookAt(home.lookTarget); camera.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  check(frustum.intersectsSphere(new THREE.Sphere(center, 2)), 'Earth within Planetary home view');
  check(!theme.earthGateway.contains(home.position), 'home outside READY');
  camera.position.copy(center).add(new THREE.Vector3(0, 0, 9)); camera.lookAt(center); camera.updateMatrixWorld();
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
  check(ray.intersectObject(earth, false).length > 0, 'real center LMB ray hits surface mesh');
  ray.setFromCamera(new THREE.Vector2(0.95, 0.95), camera);
  check(ray.intersectObject(earth, false).length === 0, 'off-Earth ray misses');
  const sourceGlobe = theme.solarSystem.earthGlobe;
  sourceGlobe.surface.onBeforeRender(renderer);
  const sourceMaps = [...sourceGlobe.textures]; const versions = sourceMaps.map(t => t.version);
  const requestCount = requests.length;
  manager.activate('environment'); const destination = manager.activeTheme.earth;
  await destination.ready; destination.surface.onBeforeRender(renderer); await flush();
  check(requests.length === requestCount, 'synchronous Journey 3 handoff makes zero duplicate texture requests');
  check([...destination.textures].every(t => sourceMaps.includes(t)), 'all five GPU texture objects transferred');
  check(sourceMaps.every((t, i) => t.disposals === 0 && t.version === versions[i]), 'handoff neither disposes nor marks maps for reupload');
  check(destination.group.rotation.z === THREE.MathUtils.degToRad(-23.44) && destination.surface.rotation.y === 4.9, 'Theme 4 default orientation preserved');
  check(destination.uniforms.sunDirection.value.distanceTo(new THREE.Vector3(-0.85, 0.35, 0.65).normalize()) < 1e-12, 'Theme 4 fixed illumination preserved');
  const concurrent = new EarthGlobe(new THREE.Group()); await concurrent.ready;
  check(requests.length === requestCount && [...concurrent.textures].every(t => destination.textures.has(t)), 'concurrent Earth renderers share maps');
  manager.activeTheme.destroy(); await flush();
  check(sourceMaps.every(t => t.disposals === 0), 'one owner cannot dispose another owner maps');
  concurrent.surface.onBeforeRender(renderer);
  check(await concurrent.setSurfaceDetail('high'), 'existing Theme 4 optional 8K still works');
  concurrent.dispose(); await flush();
  check(sourceMaps.every(t => t.disposals === 1), 'final owner releases all transferred 4K maps');

  // Both subscribers can cross a handoff while decoding is still pending.
  delayed = true;
  let offset = requests.length;
  const pendingSource = new EarthGlobe(new THREE.Group()); pendingSource.dispose();
  const pendingArrival = new EarthGlobe(new THREE.Group());
  check(requests.length - offset === 5, 'pending handoff reuses in-flight requests');
  for (const request of requests.slice(offset)) request.success(request.texture);
  await Promise.all([pendingSource.ready, pendingArrival.ready]); await flush();
  check(!pendingSource.group.visible && pendingArrival.group.visible
    && maps.slice(offset).every(t => t.disposals === 0), 'late source callbacks cannot dispose arrival maps');
  pendingArrival.dispose(); await flush();
  check(maps.slice(offset).every(t => t.disposals === 1), 'pending handoff maps released by last owner');
  offset = requests.length;
  const sharedA = new EarthGlobe(new THREE.Group()), sharedB = new EarthGlobe(new THREE.Group());
  for (const request of requests.slice(offset)) request.success(request.texture);
  await Promise.all([sharedA.ready, sharedB.ready]);
  sharedA.surface.onBeforeRender(renderer); sharedB.surface.onBeforeRender(renderer);
  const highA = sharedA.setSurfaceDetail('high'), highB = sharedB.setSurfaceDetail('high'); await flush();
  check(requests.length - offset === 6, 'concurrent optional High requests share one 8K allocation');
  const highRequest = requests.at(-1); highRequest.success(highRequest.texture);
  check((await highA) && (await highB) && sharedA.uniforms.dayMap.value === sharedB.uniforms.dayMap.value, 'shared optional 8K day map');
  sharedA.dispose(); await flush();
  check(highRequest.texture.disposals === 0, 'High survives disposal of another owner');
  sharedB.dispose(); await flush();
  check(highRequest.texture.disposals === 1, 'High released by last owner');
  offset = requests.length;
  const early = new EarthGlobe(new THREE.Group()); early.dispose();
  for (const request of requests.slice(offset)) request.success(request.texture);
  await early.ready; await flush();
  check(maps.slice(offset).every(t => t.disposals === 1) && !early.group.visible, 'pending maps released after early disposal');
  offset = requests.length;
  const failed = new EarthGlobe(new THREE.Group());
  for (const request of requests.slice(offset)) request.error();
  await failed.ready;
  check(failed.loadErrors.length === 5 && failed.group.visible, 'failed local maps retain visible neutral fallback');
  failed.dispose(); await flush(); delayed = false;
  for (let i = 0; i < 5; i++) {
    const root = new THREE.Group(); const globe = new EarthGlobe(root); await globe.ready; globe.dispose(); await flush();
    check(root.children.length === 0 && globe.textures.size === 0 && globe.leases.size === 0, 'repeated activation fully cleaned up');
  }
  const earthSource = readFileSync('src/systems/EarthGlobe.js', 'utf8').replaceAll('\r\n', '\n');
  const baselineEarth = execFileSync('git', ['show', `${checkpoint}:src/systems/EarthGlobe.js`], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
  for (const name of ['VERTEX', 'COMMON', 'SURFACE', 'CLOUDS', 'ATMOSPHERE']) {
    const shader = s => s.match(new RegExp(`const ${name} = [\\s\\S]*?\\n\\x60;`))[0];
    check(shader(earthSource) === shader(baselineEarth), `${name} shader unchanged from GREEN`);
  }
  const protectedPaths = ['src/core', 'src/themes', 'src/systems/cinematic', 'src/systems/PlanetaryFlight.js',
    'src/ui', 'src/graphics', 'public/textures', 'src/systems/SphericalTravellerFlight.js'];
  check(execFileSync('git', ['diff', checkpoint, '--', ...protectedPaths], { encoding: 'utf8' }) === '', 'all gateway/cinematic/flight/Theme 4/UI/renderer/asset source protected');
} finally {
  THREE.TextureLoader.prototype.load = load; delete globalThis.window;
}
console.log(`Planetary Earth visual characterization: PASS (${checks} checks). No physical visual/FPS/GPU compilation claim.`);
