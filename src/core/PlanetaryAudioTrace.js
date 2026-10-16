import * as THREE from "three";

const fixed = value => Number.isFinite(value) ? value.toFixed(3) : "-";
const bands = input => ["bass", "mid", "high", "energy"].map(key => fixed(input?.[key] ?? 0)).join(" / ");
const row = (label, value) => ({ label, value });
const visible = object => {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return object?.material?.visible !== false;
};


const belongsTo = (object, scene) => {
  if (!object || !scene) return false;
  for (let node = object; node; node = node.parent) if (node === scene) return true;
  return false;
};
const releaseProbe = probe => {
  if (probe && probe.object.onBeforeRender === probe.wrapper) probe.object.onBeforeRender = probe.previous;
};
function screenProbe(object, scene, app) {
  if (!object) return null;
  const probe = { object, scene, previous: object.onBeforeRender, frame: null, material: null };
  probe.wrapper = function (...args) {
    const result = probe.previous?.apply(this, args);
    // Preserve the original callback and all render state. Submission is evidence
    // of renderer traversal, not proof of successful/visible GPU pixels.
    if (app.devHUD?.visible) {
      try {
        if (args[1] === probe.scene && args[0].getRenderTarget?.() === null) {
          probe.frame = app.audioTraceFrame;
          probe.material = args[4];
        }
      } catch { /* Diagnostic sampling must never interrupt rendering. */ }
    }
    return result;
  };
  object.onBeforeRender = probe.wrapper;
  return probe;
}
function captureRuntimeRows(app, theme) {
  const solar = theme.solarSystem, activity = solar?.solarActivity;
  const sky = app.renderer.celestialStarfield.planetaryOpticalSky;
  const objects = [solar?.sun, solar?.corona, sky?.points];
  const scenes = [app.renderer.scene, app.renderer.scene, app.renderer.celestialStarfield.scene];
  const previous = theme.audioTraceDrawProbes ?? [];
  const probes = objects.map((object, index) => {
    const old = previous[index];
    if (old?.object === object && old?.scene === scenes[index]) return old;
    releaseProbe(old);
    return screenProbe(object, scenes[index], app);
  });
  theme.audioTraceDrawProbes = probes;
  theme.audioTraceRelease = () => {
    for (const probe of theme.audioTraceDrawProbes ?? []) releaseProbe(probe);
    theme.audioTraceDrawProbes = undefined;
  };
  const settings = theme.audioSettings;
  const controller = theme.audioFolder?.controllers.find(c => c.property === "masterGain");
  const guiValue = controller?.object?.[controller.property];
  const uniforms = sky?.points?.material?.uniforms;
  const audio = app.audio, sample = app.audioState;
  const identity = (object, scene, probe, ownerMatches) => {
    if (!object) return "MISSING";
    const attached = belongsTo(object, scene) ? "ATTACHED" : "DETACHED";
    const shown = visible(object) ? "VISIBLE" : "HIDDEN";
    const layers = app.cameraDirector.camera.layers.test(object.layers) ? "LAYER OK" : "LAYER OFF";
    const draw = probe?.frame == null ? "NONE" : `${probe.frame}/m${probe.material?.id ?? "?"}`;
    const callback = probe && object.onBeforeRender !== probe.wrapper ? " PROBE REPLACED" : "";
    return `#${object.id}/m${object.material?.id ?? "?"} ${attached} ${shown} ${layers}`
      + ` ${ownerMatches ? "OWNER OK" : "OWNER MISMATCH"} screen:${draw}${callback}`;
  };
  theme.audioTraceA7Rows = [
    row("App frame / dt", `${app.audioTraceFrame ?? "-"} / ${fixed(app.audioTraceDelta)}s T:${fixed(app.time)}`),
    row("Theme / mode", `${app.themeManager.activeThemeName} / ${app.cameraDirector.mode ?? "-"} loop:${app.loop?.isRunning ?? "-"}`),
    row("Updates P/Sun/Sky", `${theme.audioTraceUpdateCount ?? 0} / ${activity?.audioTraceUpdateCount ?? 0} / ${sky?.audioTraceUpdateCount ?? 0}`),
    row("Audio B/H/E", `${fixed(sample?.bass)} / ${fixed(sample?.high)} / ${fixed(sample?.energy)} ${audio.audioContext?.state ?? "uninitialized"} source:${audio.source ? "ON" : "OFF"}`),
    row("Fresh / gates", `Sun:${theme.lastUpdateTime === app.time ? "FRESH" : "STALE"}/${activity?.audioTraceEnabled ? "ON" : "OFF"}`
      + ` Sky:${sky?.lastAudioTime === app.time ? "FRESH" : "STALE"}/${sky?.audioTraceEnabled ? "ON" : "OFF"}`),
    row("Master GUI/T/S/K", `${fixed(guiValue)} / ${fixed(settings?.masterGain)} / ${fixed(activity?.audioTraceMaster)} / ${fixed(sky?.audioTraceMaster)}`
      + ` ${controller?.object === settings && activity?.audioSettings === settings && sky?.audioTraceSettings === settings ? "LINKED" : "MISMATCH"}`),
    row("Corona scale/alpha", `${fixed(solar?.corona?.scale.x)} / ${fixed(solar?.corona?.material?.opacity)}`),
    row("Star material E/H", `${fixed(uniforms?.uAudioEnergy?.value)} / ${fixed(uniforms?.uAudioHigh?.value)}`),
    row("Sun rotY / clock", `${fixed(solar?.sun?.rotation.y)}rad / ${fixed(solar?.sun?.material?.uniforms?.uTime?.value)}s`),
    row("Sun object", identity(objects[0], scenes[0], probes[0], activity?.sun === objects[0])),
    row("Corona object", identity(objects[1], scenes[1], probes[1], activity?.corona === objects[1])),
    row("Star object", identity(objects[2], scenes[2], probes[2], uniforms === sky?.uniforms)),
    row("Screen frame", "last submission (normally App frame - 1); GPU pixels unverified"),
  ];
}

// Temporary, read-only Theme 3 diagnostic. One snapshot after both consumers,
// at the existing HUD cadence. Never samples FFT or writes render parameters.
export function capturePlanetaryAudioTrace(app) {
  if (app.themeManager.activeThemeName !== "planetary") return;
  const theme = app.themeManager.activeTheme, hud = app.devHUD;
  if (hud.lastTheme === theme && performance.now() - hud.lastUpdate < 200) return;
  captureRuntimeRows(app, theme);
  const solar = theme.solarSystem, activity = solar?.solarActivity;
  const sky = app.renderer.celestialStarfield.planetaryOpticalSky;
  if (!activity || !sky?.points?.material?.uniforms?.uAudioEnergy || !sky.points.material.uniforms.uAudioHigh) {
    theme.audioTraceRows = undefined;
    return;
  }
  const audio = app.audio, camera = app.cameraDirector.camera, telemetry = hud.telemetry;
  const track = audio.stream?.getAudioTracks()[0];
  const uniforms = sky.points.material.uniforms;
  const energy = uniforms.uAudioEnergy.value, high = uniforms.uAudioHigh.value;
  // Match the renderer's rotation-only sky camera; distance never attenuates it.
  const cameraWorld = telemetry.worldMatrix(camera, new THREE.Matrix4());
  const rotation = new THREE.Matrix4().extractRotation(cameraWorld).invert();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    rotation.premultiply(camera.projectionMatrix));
  const pointWorld = telemetry.worldMatrix(sky.points, new THREE.Matrix4());
  const geometry = sky.points.geometry;
  const weights = geometry.getAttribute("aAudioWeight"), phases = geometry.getAttribute("aPhase");
  const positions = geometry.getAttribute("position"), point = new THREE.Vector3();
  const skyVisible = app.renderer.celestialStarfield.active && visible(sky.points)
    && camera.layers.test(sky.points.layers);
  let count = 0, minimum = Infinity, maximum = 1;
  for (let i = 0; i < weights.count; i++) {
    if (weights.getX(i) <= 0 || !skyVisible) continue;
    point.fromBufferAttribute(positions, i).applyMatrix4(pointWorld);
    if (!frustum.containsPoint(point)) continue;
    count++;
    // Shader-derived multiplier from the actual material uniforms/attributes.
    // This is a numeric prediction, not GPU pixel readback or occlusion proof.
    const phase = phases.getX(i) * 0.61803398875;
    const mix = 0.25 + 0.5 * (phase - Math.floor(phase));
    const drive = energy * (1 - mix) + high * mix;
    const peak = THREE.MathUtils.smoothstep(1 - Math.exp(-4 * drive), 0.03, 0.75);
    const multiplier = 1 + weights.getX(i) * 1.8 * peak;
    minimum = Math.min(minimum, multiplier); maximum = Math.max(maximum, multiplier);
  }
  const sunPosition = telemetry.worldPosition(solar.sun);
  const cameraPosition = telemetry.worldPosition(camera);
  const distance = Math.hypot(sunPosition.x-cameraPosition.x, sunPosition.y-cameraPosition.y, sunPosition.z-cameraPosition.z);
  const solarFresh = theme.lastUpdateTime === app.time && activity.audioTraceInput === theme.solarAudioInput;
  const starFresh = sky.lastAudioTime === app.time;
  theme.audioTraceRows = [
    row("Frame (s)", fixed(app.time)),
    row("Manager raw", `${bands(app.audioState)} K:${app.audioState?.kick ? 1 : 0}`),
    row("Context / source", `${audio.audioContext?.state ?? "uninitialized"} / ${audio.source ? "CONNECTED" : "OFF"}`),
    row("Input track", track ? `${track.label} / ${track.readyState} / muted:${track.muted} enabled:${track.enabled}` : "NONE"),
    row("Sun received", `${bands(activity.audioTraceInput)} ${solarFresh ? "FRESH" : "STALE"}`),
    row("Sun smoothed", bands(activity.signals)),
    row("Sun gate / gain", `${activity.audioTraceEnabled ? "ON" : "OFF"} / ${fixed(activity.settings.response)} dt:${fixed(theme.solarAudioDelta)}`),
    row("Stars received", `${bands(sky.audioTraceInput)} ${starFresh ? "FRESH" : "STALE"} gate:${sky.audioTraceEnabled ? "ON" : "OFF"}`),
    row("Sample links", `Sun:${activity.audioTraceInput === app.audioState ? "RAW" : "BASELINE"} Stars:${sky.audioTraceInput === app.audioState ? "RAW" : "BASELINE"}`),
    row("Corona scale / alpha", `${fixed(solar.corona.scale.x)} / ${fixed(solar.corona.material.opacity)}`),
    row("Star uniforms E/H", `${fixed(energy)} / ${fixed(high)} ${uniforms === sky.uniforms ? "BOUND" : "MISMATCH"}`),
    row("Star multiplier*", count ? `${fixed(minimum)}–${fixed(maximum)}x (${count}/${sky.audioStarCount} in frustum)` : `NO REACTIVE STARS IN VIEW / ${sky.audioStarCount}`),
    row("Sun view / distance", `${telemetry.objectViewState(solar.sun)} / ${fixed(distance)} corona:${visible(solar.corona) ? "VISIBLE" : "HIDDEN"}`),
    row("*Numeric shader result", "GPU pixels / occlusion / musical perception unverified"),
  ];
}
