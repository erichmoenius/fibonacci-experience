import { GalaxyJourney } from "./GalaxyJourney.js";

// Separate opt-in schedule; GalaxyJourney and EarthJourney remain unchanged.
export const JOURNEY2_PHASES = Object.freeze([
  { id: "START", duration: 0.2 },
  { id: "APPROACH", duration: 1.2, event: "approach" },
  { id: "HORIZON", duration: 0.6, event: "horizon" },
  { id: "SINGULARITY", duration: 2, event: "singularity" },
  { id: "WORMHOLE", duration: 5.7, event: "wormhole" },
  { id: "VOID", duration: 0.3, event: "void" },
  { id: "BIRTH", duration: 2, event: "birth" },
].map(Object.freeze));

export class Journey2 extends GalaxyJourney {
  constructor() {
    super();
    this.cameraDurations = { approach: 1.2, horizon: 0.6, crossing: 2, birth: 2 };
    this.wormholeDuration = 5.7;
    this.voidFadeDuration = 0.15;
    this.birthFadeDuration = 0.35;
    this.start();
  }

  start() {
    this.phaseIndex = 0;
    this.phase = "START";
    this.phaseTime = 0;
    this.elapsed = 0;
    this.lastFrameTime = null;
    this.completed = this.cancelled = false;
  }

  getFrameDelta(time) {
    const delta = this.lastFrameTime === null ? 0 : Math.min(0.1, Math.max(0, time - this.lastFrameTime));
    this.lastFrameTime = time;
    return delta;
  }

  update(delta) {
    if (this.completed || this.cancelled) return;
    let remaining = Math.max(0, delta);
    while (remaining > 1e-10 && !this.completed && !this.cancelled) {
      const duration = JOURNEY2_PHASES[this.phaseIndex].duration;
      const step = Math.min(remaining, duration - this.phaseTime);
      this.phaseTime += step;
      this.elapsed += step;
      remaining -= step;
      if (this.phaseTime < duration - 1e-9) break;
      if (this.phaseIndex === JOURNEY2_PHASES.length - 1) {
        this.complete();
        this.emit("complete");
        break;
      }
      const next = JOURNEY2_PHASES[++this.phaseIndex];
      this.phase = next.id;
      this.phaseTime = 0;
      this.emit(next.event);
    }
  }
}
