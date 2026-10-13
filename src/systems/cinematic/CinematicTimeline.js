// Diagnostic-only lifecycle clock. Existing journey/presentation clocks remain
// authoritative; no wall-clock timer, camera writes or cinematic timing changes.
export class CinematicTimeline {
  constructor() {
    this.elapsed = 0;
    this.state = "IDLE";
    this.phase = "IDLE";
    this.journeyId = null;
    this.segment = null;
    this.kind = null;
    this.offset = 0;
    this.origin = 0;
  }

  start(journey) {
    this.elapsed = this.offset = 0;
    this.state = "RUNNING";
    this.phase = journey.phase ?? "START";
    this.journeyId = journey.id;
    this.segment = journey;
    this.kind = "journey";
    this.origin = Number.isFinite(journey.elapsed) ? journey.elapsed : 0;
  }

  advanceLegacy(journey, delta) {
    // Legacy journeys have no elapsed field. Count exactly the scaled deltas
    // already sent by JourneyDirector, including their existing frame overshoot.
    if (this.state === "RUNNING" && this.kind === "journey" && this.segment === journey
      && !Number.isFinite(journey.elapsed) && Number.isFinite(delta) && delta > 0) this.elapsed += delta;
  }

  sampleJourney(journey) {
    if (this.state !== "RUNNING" || this.kind !== "journey" || this.segment !== journey) return;
    if (Number.isFinite(journey.elapsed)) this.elapsed = Math.max(this.elapsed, journey.elapsed - this.origin);
    this.phase = journey.phase ?? "JOURNEY";
    if (journey.cancelled) this.cancel();
  }

  continueWith(provider) {
    if (this.state !== "RUNNING") return;
    if (!provider || provider === this.segment || provider.cancelled || provider.disposed || !Number.isFinite(provider.elapsed)) {
      this.finish(); return;
    }
    this.offset = this.elapsed;
    this.segment = provider;
    this.kind = "presentation";
    this.samplePresentation(provider);
  }

  samplePresentation(provider) {
    if (this.state !== "RUNNING" || this.kind !== "presentation") return;
    const segment = this.segment;
    if (Number.isFinite(segment.elapsed)) this.elapsed = Math.max(this.elapsed, this.offset + segment.elapsed);
    if (segment.completed) { this.finish(); return; }
    if (provider !== segment || segment.cancelled || segment.disposed) { this.cancel(); return; }
    this.phase = segment.phase ?? String(segment.id ?? "presentation").replaceAll("-", " ").toUpperCase();
  }

  finish() {
    this.state = "COMPLETE";
    this.phase = "COMPLETE";
    this.segment = this.kind = null;
  }

  cancel() {
    if (this.state !== "RUNNING") return;
    if (this.kind === "presentation" && Number.isFinite(this.segment?.elapsed)) this.elapsed = Math.max(this.elapsed, this.offset + this.segment.elapsed);
    if (this.kind === "journey" && Number.isFinite(this.segment?.elapsed)) this.elapsed = Math.max(this.elapsed, this.segment.elapsed - this.origin);
    this.state = "CANCELLED";
    this.phase = "CANCELLED";
    this.segment = this.kind = null;
  }
}

export function formatTimelineTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--.---";
  const ms = Math.round(seconds * 1000);
  return `${String(Math.floor(ms / 60000)).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(ms % 1000).padStart(3, "0")}`;
}
