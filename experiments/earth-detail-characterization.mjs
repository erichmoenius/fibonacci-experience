import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import * as THREE from 'three';

// Exercise the production module with local assets and a controllable loader.
// Substitute Vite's BASE_URL and module URLs only; no browser/preview is started.
const moduleURL = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const earthSource = readFileSync('src/systems/EarthGlobe.js', 'utf8');
const earthURL = moduleURL(earthSource.replaceAll('import.meta.env.BASE_URL', '"/"')
  .replace('from "three"', `from ${JSON.stringify(import.meta.resolve('three'))}`));
const { EarthGlobe, textureBytes, supportsHighSurface, EARTH_STANDARD_BYTES, EARTH_HIGH_BYTES } = await import(earthURL);
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
class Loader {
  requests = [];
  load(url, success, progress, error) { this.requests.push({ url, success, error }); }
  complete(index, width = 4096, height = 2048) {
    const texture = new THREE.Texture({ width, height });
    texture.disposals = 0;
    texture.addEventListener('dispose', () => texture.disposals++);
    this.requests[index].success(texture);
    return texture;
  }
}
function fixture(maxTextureSize = 16384) {
  const loader = new Loader();
  const root = new THREE.Group(); root.position.set(1, 2, -0.01);
  const globe = new EarthGlobe(root, { loader });
  const renderer = { capabilities: { maxTextureSize, getMaxAnisotropy: () => 16 }, uploads: [],
    initTexture(texture) { this.uploads.push(texture); } };
  const maps = Array.from({ length: 5 }, (_, i) => loader.complete(i));
  return { loader, root, globe, renderer, maps };
}
check(textureBytes(4096, 2048) === 44739244, 'exact 4K mip chain');
check(EARTH_STANDARD_BYTES === 223696220, 'Standard GPU bytes');
check(EARTH_HIGH_BYTES === 357913948, 'High GPU bytes');
check(supportsHighSurface({ maxTextureSize: 8192 }), '8K capability accepted');
check(!supportsHighSurface({ maxTextureSize: 4096 }), 'limited renderer rejected');
check(!supportsHighSurface({ maxTextureSize: 16384 }, EARTH_HIGH_BYTES), 'switching peak budget enforced');

const f = fixture(); await f.globe.ready; await flush();
check(f.globe.group.visible && f.globe.textures.size === 5, 'complete reveal and five owned maps');
check(f.globe.surfaceDetail === 'standard', 'default Standard');
check(f.globe.surface.geometry.parameters.radius === 2 && f.globe.clouds.geometry.parameters.radius === 2.006
  && f.globe.atmosphere.geometry.parameters.radius === 2.036, 'GREEN geometry preserved');
check(Math.abs(f.globe.group.rotation.z - THREE.MathUtils.degToRad(-23.44)) < 1e-12, 'tilt retained');
check(f.globe.getWorldCenter(new THREE.Vector3()).equals(f.root.position), 'transformed orbit center');
f.globe.surface.onBeforeRender(f.renderer);
check(f.maps.every(t => t.anisotropy === 8), 'anisotropy hardware capped');
const initial = f.globe.surface.rotation.y; f.globe.update(10);
check(Math.abs(f.globe.surface.rotation.y - initial - 0.0018) < 1e-12, 'rotation and delta clamp retained');
check(f.globe.uniforms.cloudOffset.value > 0, 'relative cloud drift');
const high = f.globe.setSurfaceDetail('high'); await flush();
check(f.loader.requests[5].url === '/textures/earth/day-8k.jpg', 'local High path');
check(f.globe.uniforms.dayMap.value === f.maps[0], '4K retained during download');
const highMap = f.loader.complete(5, 8192, 4096); check(await high, 'High replacement succeeds');
check(f.globe.textures.size === 5 && f.maps[0].disposals === 1, 'old map disposed, five active maps');
check(highMap.colorSpace === THREE.SRGBColorSpace && highMap.minFilter === THREE.LinearMipmapLinearFilter
  && highMap.magFilter === THREE.LinearFilter && highMap.generateMipmaps, 'High color space and mipmaps');
check(highMap.wrapS === THREE.RepeatWrapping && highMap.wrapT === THREE.ClampToEdgeWrapping, 'High seam wrapping');
const standard = f.globe.setSurfaceDetail('standard'); await flush();
const standardMap = f.loader.complete(6); check(await standard, 'return to Standard');
check(highMap.disposals === 1 && f.globe.effectiveSurfaceDetail === 'standard', 'High released on downgrade');

const failed = f.globe.setSurfaceDetail('high'); await flush(); f.loader.requests[7].error();
check(!await failed && f.globe.uniforms.dayMap.value === standardMap && f.globe.surfaceDetail === 'standard', 'download failure fallback');
const wrong = f.globe.setSurfaceDetail('high'); await flush(); const wrongMap = f.loader.complete(8);
check(!await wrong && wrongMap.disposals === 1 && f.globe.uniforms.dayMap.value === standardMap, 'wrong dimensions rejected');
f.renderer.initTexture = () => { throw new Error('test upload failure'); };
const badUpload = f.globe.setSurfaceDetail('high'); await flush(); const badMap = f.loader.complete(9, 8192, 4096);
check(!await badUpload && badMap.disposals === 1 && f.globe.uniforms.dayMap.value === standardMap, 'upload exception fallback');
f.renderer.initTexture = () => {};
const superseded = f.globe.setSurfaceDetail('high'); await flush();
const finalStandard = f.globe.setSurfaceDetail('standard'); await flush();
check(f.loader.requests.length === 11, 'only one detail download in flight');
const stale = f.loader.complete(10, 8192, 4096);
check(!await superseded && await finalStandard && stale.disposals === 1, 'stale replacement discarded');
const late = f.globe.setSurfaceDetail('high'); await flush();
f.globe.dispose(); const lateMap = f.loader.complete(11, 8192, 4096);
check(!await late && lateMap.disposals === 1 && f.globe.textures.size === 0 && f.root.children.length === 0, 'theme switch during detail download');
f.globe.dispose(); check(standardMap.disposals === 1 && f.maps.slice(1).every(t => t.disposals === 1), 'idempotent disposal');

const limited = fixture(4096); await limited.globe.ready; limited.globe.surface.onBeforeRender(limited.renderer);
check(!await limited.globe.setSurfaceDetail('high') && limited.loader.requests.length === 5
  && limited.globe.surfaceDetail === 'standard', 'no 8K download on unsupported GPU'); limited.globe.dispose();
const waiting = fixture(); await waiting.globe.ready;
const waitingHigh = waiting.globe.setSurfaceDetail('high'); await flush(); waiting.globe.dispose();
check(!await waitingHigh, 'renderer wait released by disposal');
const throwing = fixture(); await throwing.globe.ready; throwing.globe.surface.onBeforeRender(throwing.renderer);
throwing.loader.load = () => { throw new Error('synchronous loader failure'); };
check(!await throwing.globe.setSurfaceDetail('high') && throwing.globe.surfaceDetail === 'standard', 'synchronous loader failure fallback');
throwing.globe.dispose();
const loading = new Loader(); const early = new EarthGlobe(new THREE.Group(), { loader: loading }); early.dispose();
const earlyMaps = Array.from({ length: 5 }, (_, i) => loading.complete(i)); await early.ready; await flush();
check(earlyMaps.every(t => t.disposals === 1) && !early.group.visible, 'late baseline maps released');
for (let activation = 0; activation < 5; activation++) {
  const cycle = fixture(); await cycle.globe.ready; cycle.globe.dispose();
  check(cycle.globe.textures.size === 0 && cycle.root.children.length === 0, 'repeated activation cleanup');
}

// Exact shader and protected-system checks against the physical GREEN commit.
const checkpoint = '981562083ad1ac9110920cd9f68c61c08ca26b06';
const baseline = execFileSync('git', ['show', `${checkpoint}:src/systems/EarthGlobe.js`], { encoding: 'utf8' });
for (const name of ['VERTEX', 'COMMON', 'SURFACE', 'CLOUDS']) {
  const get = source => source.match(new RegExp(`const ${name} = [\\s\\S]*?\\n\\x60;`))[0];
  check(get(earthSource) === get(baseline), `${name} shader unchanged`);
}
const protectedPaths = ['src/systems/cinematic', 'src/ui/ThemeFlightControls.js', 'src/graphics/Renderer.js',
  'src/themes/SpaceTheme.js', 'src/themes/GalaxyTheme.js', 'src/themes/PlanetaryTheme.js'];
check(execFileSync('git', ['diff', checkpoint, '--', ...protectedPaths], { encoding: 'utf8' }) === '', 'protected flight, F, renderer and other themes unchanged');
const manifest = JSON.parse(readFileSync('public/textures/earth/manifest.json', 'utf8'));
for (const asset of manifest) {
  const bytes = readFileSync(`public/textures/earth/${asset.file}`);
  check(bytes.length === asset.bytes && createHash('sha256').update(bytes).digest('hex') === asset.sha256, `asset checksum ${asset.file}`);
}
for (const asset of manifest.filter(a => a.file.includes('4k'))) {
  const committed = execFileSync('git', ['show', `${checkpoint}:public/textures/earth/${asset.file}`], { maxBuffer: 8 * 1024 * 1024 });
  check(committed.equals(readFileSync(`public/textures/earth/${asset.file}`)), `GREEN asset preserved ${asset.file}`);
}

let themeSource = readFileSync('src/themes/EnvironmentTheme.js', 'utf8');
themeSource = themeSource.replace('"../systems/EarthGlobe.js"', JSON.stringify(earthURL))
  .replace('"three"', JSON.stringify(import.meta.resolve('three')));
for (const relative of ['./BaseTheme.js', '../systems/SphericalTravellerFlight.js']) {
  themeSource = themeSource.replace(JSON.stringify(relative), JSON.stringify(new URL(relative, pathToFileURL(`${process.cwd()}/src/themes/EnvironmentTheme.js`)).href));
}
const { EnvironmentTheme } = await import(moduleURL(themeSource));
// Theme integration uses a stub GUI and immediate local loader, not a DOM.
const originalLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function(url, success) { success(new THREE.Texture({ width: 4096, height: 2048 })); };
const controllers = [];
const folder = { add(object, property) {
  const c = { object, property, name() { return this; }, listen() { return this; }, disable() { return this; },
    onChange(callback) { this.callback = callback; return this; } }; controllers.push(c); return c;
}, destroy() { this.destroyed = true; } };
const gui = { addFolder(title) { check(title === 'Earth', 'Earth-only G folder'); return folder; } };
const parent = new THREE.Group(); const container = new THREE.Group(); parent.add(container);
const particles = new THREE.Points(new THREE.BufferGeometry()); particles.geometry.setAttribute('aHue', new THREE.Float32BufferAttribute([0], 1)); parent.add(particles);
const theme = new EnvironmentTheme(container, gui); await theme.earth.ready;
check(controllers[0].property === 'surfaceDetail' && typeof controllers[0].callback === 'function', 'G quality callback installed');
const liveStatus = theme.earth.detailStatus; controllers[1].object.status = 'stale saved status';
check(theme.earth.detailStatus === liveStatus, 'G Load cannot overwrite live diagnostics');
check(theme.getFlightGUIConfig().storageKey === 'fibonacci-flight-v1-environment', 'F key unchanged');
check(theme.flight.getOrbitLookTarget() === null, 'free heading retained'); theme.flight.orbiting = true;
check(theme.flight.getOrbitLookTarget() === theme.flight.orbitCenter, 'Earth orbit hook retained');
for (const aspect of [0.5, 1, 2]) {
  globalThis.window = { innerWidth: 1000 * aspect, innerHeight: 1000 };
  const pose = theme.getHomePose();
  check(pose.position.distanceTo(pose.lookTarget) >= 6.5, 'home composition retained');
}
delete globalThis.window;
theme.destroy(); check(folder.destroyed && particles.visible && theme.earth.textures.size === 0, 'G folder and Earth destroyed; particles restored');
THREE.TextureLoader.prototype.load = originalLoad;
console.log(`Earth detail characterization: PASS (${checks} checks). No visual/FPS or GPU compilation claim.`);
