import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { SolarSystem } from '../src/systems/SolarSystem.js';
import { SunSurface } from '../src/systems/SunSurface.js';

const checkpoint = 'eab53517740c8512392a04a632b42aedc284e16c';
const baselineSource = execFileSync('git', ['show', `${checkpoint}:src/systems/SolarSystem.js`], { encoding: 'utf8' });
const earthModule = new URL('../src/systems/EarthGlobe.js', import.meta.url).href;
const { SolarSystem: BaselineSolarSystem } = await import(`data:text/javascript;base64,${Buffer.from(baselineSource
  .replace('"three"', JSON.stringify(new URL('../node_modules/three/build/three.module.js', import.meta.url).href))
  .replace('"./EarthGlobe.js"', JSON.stringify(earthModule))).toString('base64')}`);

let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const close = (a, b) => Math.abs(a - b) < 1e-10;
// Isolate unrelated Earth image I/O; keep the real Earth/SolarSystem hierarchy.
const originalLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function (_url, ready) {
  const texture = new THREE.Texture({ width: 1, height: 1 });
  ready(texture);
  return texture;
};
let current, baseline;
try {
  const scene = new THREE.Scene();
  current = new SolarSystem(scene);
  baseline = new BaselineSolarSystem(new THREE.Scene());
  await Promise.all([current.earthGlobe.ready, baseline.earthGlobe.ready]);
  check(current.sun.material instanceof SunSurface, 'S1 only replaces the Sun material');
  check(current.sun.geometry.parameters.radius === baseline.sun.geometry.parameters.radius, 'Sun radius preserved');
  check(current.sun.geometry.attributes.position.count === baseline.sun.geometry.attributes.position.count, 'Sun tessellation preserved');
  check(current.corona.parent === current.sun, 'corona keeps existing Sun parent');
  assert.deepEqual(current.corona.material.map.image.data, baseline.corona.material.map.image.data); checks++;
  const material = current.sun.material;
  const uniforms = material.uniforms;
  const resources = current.resources.slice();
  const versions = resources.map(r => r.version);
  check(uniforms.uAudio.value.toArray().every(v => v === 0) && uniforms.uKick.value === 0, 'audio OFF defaults');
  for (let frame = 0; frame < 240; frame++) {
    const delta = frame % 2 ? 1 / 30 : 1 / 60;
    current.update(delta); baseline.update(delta);
  }
  check(close(uniforms.uTime.value, 6), 'surface evolves for six seconds with audio OFF');
  check(close(current.sun.rotation.y, baseline.sun.rotation.y), 'axial rotation exactly matches checkpoint');
  assert.deepEqual(current.corona.scale.toArray(), baseline.corona.scale.toArray()); checks++;
  check(current.corona.material.opacity === baseline.corona.material.opacity, 'corona breathing exactly matches checkpoint');
  for (const [name, planet] of current.planets) {
    const old = baseline.planets.get(name);
    assert.deepEqual(planet.definition, old.definition); checks++;
    assert.deepEqual(planet.body.rotation.toArray(), old.body.rotation.toArray()); checks++;
    assert.deepEqual(planet.orbit.rotation.toArray(), old.orbit.rotation.toArray()); checks++;
  }
  assert.deepEqual(current.clouds.rotation.toArray(), baseline.clouds.rotation.toArray()); checks++;
  assert.deepEqual(current.moonOrbit.rotation.toArray(), baseline.moonOrbit.rotation.toArray()); checks++;
  assert.deepEqual(current.getSunWorldPosition(new THREE.Vector3()).toArray(), baseline.getSunWorldPosition(new THREE.Vector3()).toArray()); checks++;
  current.sun.material.setAudioInputs({ bass: 2, mid: -1, high: NaN, energy: 0.7, kick: Infinity });
  assert.deepEqual(uniforms.uAudio.value.toArray(), [1, 0, 0, 0.7]); checks++;
  check(uniforms.uKick.value === 0, 'invalid future audio channels sanitized');
  current.sun.material.setAudioInputs();
  check(uniforms.uAudio.value.toArray().every(v => v === 0), 'audio OFF resets reserved inputs');
  check(!material.fragmentShader.includes('uAudio') && !material.fragmentShader.includes('uKick'), 'reserved inputs do not implement premature audio reactivity');
  current.update(0);
  check(close(uniforms.uTime.value, 6), 'zero delta does not advance the surface');
  check(current.sun.material === material && material.uniforms === uniforms, 'material and uniform identities stable');
  assert.deepEqual(current.resources, resources); checks++;
  assert.deepEqual(resources.map(r => r.version), versions); checks++;
  // Approved HUD files may differ. Mixed runtime files are checked separately
  // after stripping only the exact diagnostic additions, preserving their full
  // checkpoint comparisons rather than exempting camera/journey/flight logic.
  const diagnosticFiles = [
    'src/core/DevHUD.js', 'src/core/DevHUDTelemetry.js',
    'src/systems/cinematic/CinematicTimeline.js',
    'src/core/App.js', 'src/systems/cinematic/JourneyDirector.js',
    'src/themes/BaseTheme.js', 'src/themes/PlanetaryTheme.js',
  ];
  const stripDiagnostics = (path, source) => {
    if (path === 'src/core/App.js') return source
      .replace('          if (e.shiftKey) this.devHUD.toggleMode();\n          else this.devHUD.toggle();', '          this.devHUD.toggle();')
      .replace('    this.audioState = audio; // Reuse the existing sample for read-only diagnostics.\n', '')
      .replace('    this.journeyDirector.timeline?.samplePresentation(this.cameraDirector.journey);\n', '');
    if (path === 'src/systems/cinematic/JourneyDirector.js') return source
      .replace('import { CinematicTimeline } from "./CinematicTimeline.js";\n', '')
      .replace('    this.timeline = new CinematicTimeline();\n', '')
      .replace('      this.timeline.sampleJourney(this.activeJourney);\n', '')
      .replace('        this.timeline.continueWith(this.cameraDirector.journey);\n', '')
      .replace('    this.timeline.start(this.activeJourney);\n', '')
      .replace('    this.timeline.cancel();\n', '')
      .replace('    const journey = this.activeJourney;\n    const scaledDelta = this.getScaledDelta(delta);\n    this.timeline.advanceLegacy(journey, scaledDelta);\n    journey.update(scaledDelta);\n    this.timeline.sampleJourney(journey);',
        '    this.activeJourney.update(this.getScaledDelta(delta));');
    if (path === 'src/themes/BaseTheme.js') return source.replace(/  \/\/ Optional synchronous, read-only HUD provider\.[\s\S]*?  getDevDiagnostics\(_context\) \{ return \[\]; \}\n\n/, '');
    if (path === 'src/themes/PlanetaryTheme.js') return source.replace(/^  getDevDiagnostics\(context\) \{[\s\S]*?^  \}\n\n/m, '');
    return source;
  };
  for (const path of diagnosticFiles.slice(3)) {
    const current = readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
    const protectedSource = execFileSync('git', ['show', `eab53517740c8512392a04a632b42aedc284e16c:${path}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
    check(stripDiagnostics(path, current) === protectedSource, `${path}: all non-diagnostic behavior exactly matches checkpoint`);
  }
  const changedProtected = execFileSync('git', ['diff', checkpoint, '--', 'src', 'public',
    ':(exclude)src/systems/SolarSystem.js', ':(exclude)src/systems/SunSurface.js', ...diagnosticFiles.map(path => ':(exclude)' + path)], { encoding: 'utf8' });
  check(changedProtected === '', 'Waltz, journeys, cameras, flight, gateway and stars unchanged');
  // Verify the complete existing simulation remains unchanged except one call.
  const source = readFileSync(new URL('../src/systems/SolarSystem.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const updateSection = s => s.slice(s.indexOf('  update(delta)'), s.indexOf('  dispose()'));
  check(updateSection(source).replace('    this.sun.material.update(delta);\n', '') === updateSection(baselineSource.replaceAll('\r\n', '\n')), 'existing update loop exactly protected');
  let disposed = 0;
  material.addEventListener('dispose', () => disposed++);
  current.dispose(); current = null;
  check(disposed === 1 && scene.children.length === 0, 'new material released through existing resource ownership');
  console.log(`Sun S1 characterization: PASS (${checks} checks). GPU compilation, appearance and timing pending localhost artistic review.`);
} finally {
  current?.dispose(); baseline?.dispose();
  THREE.TextureLoader.prototype.load = originalLoad;
}
