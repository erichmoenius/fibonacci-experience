import { Journey } from "./Journey";

export const GalaxyJourneyPhase = {
  START: "START",
  APPROACH: "APPROACH",
  HORIZON: "HORIZON",
  SINGULARITY: "SINGULARITY",
  WORMHOLE: "WORMHOLE",
  VOID: "VOID",
  BIRTH: "BIRTH",
};

export class GalaxyJourney extends Journey {
  constructor() {
    super("galaxy-planetary");

    this.phase = GalaxyJourneyPhase.START;
    this.phaseTime = 0;
  }

  update(delta) {
    if (this.completed || this.cancelled) return;

    this.phaseTime += delta;

    if (this.phase === GalaxyJourneyPhase.START && this.phaseTime >= 2) {
      this.phase = GalaxyJourneyPhase.APPROACH;
      this.phaseTime = 0;
      this.emit("approach");
      console.log("GalaxyJourney -> APPROACH");
    }

    if (this.phase === GalaxyJourneyPhase.APPROACH && this.phaseTime >= 3) {
      this.phase = GalaxyJourneyPhase.HORIZON;
      this.phaseTime = 0;
      this.emit("horizon");
      console.log("GalaxyJourney -> HORIZON");
    }

    if (this.phase === GalaxyJourneyPhase.HORIZON && this.phaseTime >= 3) {
      this.phase = GalaxyJourneyPhase.SINGULARITY;
      this.phaseTime = 0;
      this.emit("singularity");
      console.log("GalaxyJourney -> SINGULARITY");
    }

    if (
      this.phase === GalaxyJourneyPhase.SINGULARITY &&
      this.phaseTime >= 4
    ) {
      this.phase = GalaxyJourneyPhase.WORMHOLE;
      this.phaseTime = 0;
      this.emit("wormhole");
      console.log("GalaxyJourney -> WORMHOLE");
    }

    if (this.phase === GalaxyJourneyPhase.WORMHOLE && this.phaseTime >= 4) {
      this.phase = GalaxyJourneyPhase.VOID;
      this.phaseTime = 0;
      this.emit("void");
      console.log("GalaxyJourney -> VOID");
    }

    if (this.phase === GalaxyJourneyPhase.VOID && this.phaseTime >= 1) {
      this.phase = GalaxyJourneyPhase.BIRTH;
      this.phaseTime = 0;
      this.emit("birth");
      console.log("GalaxyJourney -> BIRTH");
    }

    if (
      this.phase === GalaxyJourneyPhase.BIRTH &&
      this.phaseTime >= 3 &&
      !this.completed
    ) {
      this.complete();
      this.emit("complete");
      console.log("GalaxyJourney -> COMPLETE");
    }
  }
}
