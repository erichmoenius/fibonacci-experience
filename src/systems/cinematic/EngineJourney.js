import { Journey } from "./Journey";

export const EngineJourneyPhase = {
  START: "START",
  APPROACH: "APPROACH",
  HORIZON: "HORIZON",
  SINGULARITY: "SINGULARITY",
  WORMHOLE: "WORMHOLE",
  VOID: "VOID",
  BIRTH: "BIRTH",
};

const GRAVITY_PHASE_START = {
  [EngineJourneyPhase.START]: 0,
  [EngineJourneyPhase.APPROACH]: 2,
  [EngineJourneyPhase.HORIZON]: 5,
  [EngineJourneyPhase.SINGULARITY]: 8,
  [EngineJourneyPhase.WORMHOLE]: 12,
  [EngineJourneyPhase.VOID]: 12,
  [EngineJourneyPhase.BIRTH]: 12,
};
const GRAVITY_DURATION = 12;

export class EngineJourney extends Journey {
  constructor() {
    super("engine");

    this.phase = EngineJourneyPhase.START;
    this.phaseTime = 0;
  }

  start() {
    this.completed = false;
    this.cancelled = false;
    this.phase = EngineJourneyPhase.START;
    this.phaseTime = 0;
  }

  getGravityProgress() {
    const elapsed = (GRAVITY_PHASE_START[this.phase] ?? 0) + this.phaseTime;

    return Math.min(Math.max(elapsed / GRAVITY_DURATION, 0), 1);
  }

  update(delta) {
    if (this.completed || this.cancelled) return;

    this.phaseTime += delta;

    if (this.phase === EngineJourneyPhase.START && this.phaseTime >= 2) {
      this.phase = EngineJourneyPhase.APPROACH;

      this.phaseTime = 0;

      this.emit("approach");

      console.log("EngineJourney → APPROACH");
    }

    if (this.phase === EngineJourneyPhase.APPROACH && this.phaseTime >= 3) {
      this.phase = EngineJourneyPhase.HORIZON;

      this.phaseTime = 0;

      this.emit("horizon");

      console.log("EngineJourney → HORIZON");
    }

    if (this.phase === EngineJourneyPhase.HORIZON && this.phaseTime >= 3) {
      this.phase = EngineJourneyPhase.SINGULARITY;

      this.phaseTime = 0;

      this.emit("singularity");

      console.log("EngineJourney → SINGULARITY");
    }

    if (this.phase === EngineJourneyPhase.SINGULARITY && this.phaseTime >= 2) {
      this.phase = EngineJourneyPhase.WORMHOLE;

      this.phaseTime = 0;

      console.log("EngineJourney → WORMHOLE");

      this.emit("wormhole");
    }

    if (this.phase === EngineJourneyPhase.WORMHOLE && this.phaseTime >= 4) {
      this.phase = EngineJourneyPhase.VOID;

      this.phaseTime = 0;

      console.log("EngineJourney → VOID");

      this.emit("void");
    }

    if (this.phase === EngineJourneyPhase.VOID && this.phaseTime >= 1) {
      this.phase = EngineJourneyPhase.BIRTH;

      this.phaseTime = 0;

      console.log("EngineJourney → BIRTH");

      this.emit("birth");
    }

    if (
      this.phase === EngineJourneyPhase.BIRTH &&
      this.phaseTime >= 3 &&
      !this.completed
    ) {
      this.complete();

      console.log("EngineJourney → COMPLETE");

      this.emit("complete");
    }
  }
}
