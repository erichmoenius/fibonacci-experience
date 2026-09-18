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

export class EngineJourney extends Journey {
  constructor() {
    super("engine");

    this.phase = EngineJourneyPhase.START;
    this.phaseTime = 0;
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

    if (this.phase === EngineJourneyPhase.SINGULARITY && this.phaseTime >= 4) {
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
