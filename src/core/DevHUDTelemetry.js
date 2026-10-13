import * as THREE from "three";
import { JOURNEY2_PHASES } from "../systems/cinematic/Journey2.js";
import { EARTH_PHASES } from "../systems/cinematic/EarthJourney.js";
import { formatTimelineTime } from "../systems/cinematic/CinematicTimeline.js";

export function formatCinematicTime(seconds) {
  return Number.isFinite(seconds) && seconds >= 0 ? seconds.toFixed(3).padStart(6, "0") : "--.---";
}
const running = p => p && !p.cancelled && !p.completed && !p.disposed;
const durations = {
  "galaxy-planetary": JOURNEY2_PHASES.reduce((sum, p) => sum + p.duration, 0),
  "planetary-environment": EARTH_PHASES.reduce((sum, p) => sum + p.duration, 0),
};
const row = (label, value, fullOnly = false) => ({ label, value, fullOnly });
const coord = p => p ? [p.x, p.y, p.z].map(v => v.toFixed(2)).join(", ") : "-";
const fixed = n => Number.isFinite(n) ? n.toFixed(3) : "-";

// Adapters for existing clocks; the renderer itself knows no theme or journey IDs.
export function cinematicSection(app, full) {
  const candidate = app.journeyDirector?.getJourney();
  const journey = running(candidate) ? candidate : null;
  const cameraProvider = app.cameraDirector?.journey;
  const presentation = !journey && running(cameraProvider) && app.cameraDirector.mode === "travel" ? cameraProvider : null;
  const phase = journey?.phase ?? (presentation ? String(presentation.id ?? "presentation").replaceAll("-", " ").toUpperCase() : "IDLE");
  const duration = journey?.duration ?? (Number.isInteger(journey?.phaseIndex) ? durations[journey.id] : undefined);
  const timeline = app.journeyDirector?.timeline;
  const rows = [row("Journey ID", journey?.id ?? timeline?.journeyId ?? "-", !journey),
    row("Phase", timeline?.state === "COMPLETE" || timeline?.state === "CANCELLED" ? timeline.phase : phase)];
  if (full) rows.push(row("Journey duration", formatCinematicTime(duration)));
  if (presentation) {
    const duration = presentation.duration ?? presentation.settings?.duration;
    const progress = duration > 0 ? THREE.MathUtils.clamp(presentation.elapsed / duration, 0, 1) * 100 : null;
    rows.push(row("Presentation", progress === null ? "ACTIVE" : `${progress.toFixed(1)}%`));
    if (full) rows.push(row("Presentation duration", formatCinematicTime(duration)));
  }
  const j2 = app.renderer?.journey2Dissolve;
  const j3 = app.renderer?.journey3Dissolve;
  const composite = running(j2) && journey && j2.journey === journey
    ? "J2 LIVE"
    : running(j3) && journey?.birthDissolve === j3 ? "J3 LIVE" : "NONE";
  rows.push(row("BIRTH", journey?.phase === "BIRTH" ? "ACTIVE" : "OFF", journey?.phase !== "BIRTH"),
    row("Composite", composite, composite === "NONE"));
  if (import.meta.env.DEV) rows.push(row("JOURNEY SLOW-MO", app.journeyDirector?.isSlowMotionEnabled() ? "3x" : "OFF", !app.journeyDirector?.isSlowMotionEnabled()));
  return { title: "Cinematic / Journey", timecode: `T = ${formatTimelineTime(timeline?.elapsed ?? 0)} [${timeline?.state ?? "IDLE"}]`, rows: rows.filter(r => full || !r.fullOnly) };
}

// Scratch calculations read transforms without updating scene objects, geometry
// bounds, camera matrices, gateway positions or any simulation-owned cache.
export class HUDTelemetry {
  constructor(app) {
    this.app = app;
    this.world = new THREE.Matrix4(); this.local = new THREE.Matrix4();
    this.cameraWorld = new THREE.Matrix4(); this.projection = new THREE.Matrix4();
    this.frustum = new THREE.Frustum(); this.bounds = new THREE.Sphere();
    this.origin = new THREE.Vector3();
  }
  worldMatrix(object, target) {
    if (object.matrixWorldAutoUpdate === false) return target.copy(object.matrixWorld);
    if (object.parent) this.worldMatrix(object.parent, target); else target.identity();
    const local = object.matrixAutoUpdate === false ? object.matrix : this.local.compose(object.position, object.quaternion, object.scale);
    return target.multiply(local);
  }
  worldPosition(object) {
    this.worldMatrix(object, this.world);
    const m = this.world.elements;
    return Object.freeze({ x: m[12], y: m[13], z: m[14] });
  }
  objectViewState(object) {
    const camera = this.app.cameraDirector?.camera;
    if (!camera || !object?.geometry) return "UNKNOWN";
    for (let p = object; p; p = p.parent) if (!p.visible) return "HIDDEN";
    if (!object.material?.visible || !camera.layers.test(object.layers)) return "HIDDEN";
    const sphere = object.geometry.boundingSphere;
    if (sphere) this.bounds.copy(sphere);
    else if (object.geometry.type === "SphereGeometry") this.bounds.set(this.origin, object.geometry.parameters.radius);
    else return "UNKNOWN";
    this.bounds.applyMatrix4(this.worldMatrix(object, this.world));
    this.worldMatrix(camera, this.cameraWorld);
    this.projection.copy(this.cameraWorld).invert().premultiply(camera.projectionMatrix);
    this.frustum.setFromProjectionMatrix(this.projection);
    return this.frustum.intersectsSphere(this.bounds) ? "IN VIEW" : "OFFSCREEN";
  }
  context(full) {
    const app = this.app, p = app.cameraDirector?.position;
    return Object.freeze({ full, formatTime: formatCinematicTime,
      cameraPosition: Object.freeze({ x: p?.x ?? 0, y: p?.y ?? 0, z: p?.z ?? 0 }),
      worldPosition: object => this.worldPosition(object), objectViewState: object => this.objectViewState(object),
      isGatewayRegistered: gateway => app.journeyDirector?.gateways?.includes(gateway) ?? false });
  }
  sections(full) {
    const app = this.app, cd = app.cameraDirector, theme = app.themeManager.activeTheme;
    const audio = app.audio, sample = audio?.source ? app.audioState : null;
    const audioState = !audio?.source ? "OFF" : String(audio.audioContext?.state ?? "CONNECTED").toUpperCase();
    const core = theme?.engine?.core?.object, p = cd.position;
    const corePosition = core ? this.worldPosition(core) : null;
    const sections = [
      { title: "Theme", rows: [row("Theme", (app.themeManager.activeThemeName ?? "-").toUpperCase())] },
      { title: "Camera / FreeFlight", rows: [row("Camera", (cd.mode ?? "-").toUpperCase()), row("FreeFlight", cd.freeFlight?.active ? "ON" : "OFF"), row("Camera world", coord(p), true), row("Look target", coord(cd.currentTarget), true)] },
      { title: "Audio", rows: [row("Audio", audioState), row("Bass / Mid / High", sample ? `${fixed(sample.bass)} / ${fixed(sample.mid)} / ${fixed(sample.high)}` : "-", true), row("Energy / Kick", sample ? `${fixed(sample.energy)} / ${sample.kick ? "YES" : "NO"}` : "-", true)] },
      { title: "Interaction / Gateways", rows: [row("Gateway", app.journeyDirector?.gatewayReady ? "READY" : "-"), row("Armed", app.armedGateway ? "YES" : "NO"), row("Core dist", corePosition ? Math.hypot(p.x-corePosition.x, p.y-corePosition.y, p.z-corePosition.z).toFixed(2) : "-", !core), row("Gateway count", app.journeyDirector?.gateways?.length ?? 0, true)] },
    ];
    const info = app.renderer?.renderer?.info;
    if (info) sections.push({ title: "Performance (renderer)", rows: [row("Draw calls", info.render.calls), row("Triangles", info.render.triangles, true), row("Geometries / Textures", `${info.memory.geometries} / ${info.memory.textures}`, true)] });
    // Optional synchronous read-only provider. A broken diagnostic provider must
    // not interrupt the render loop or retain values from the previous theme.
    try {
      const supplied = theme?.getDevDiagnostics?.(this.context(full));
      if (Array.isArray(supplied)) sections.push(...supplied.filter(s => s && typeof s.title === "string" && Array.isArray(s.rows)));
    } catch { sections.push({ title: "Theme diagnostics", rows: [row("Provider", "UNAVAILABLE")] }); }
    return sections;
  }
}
