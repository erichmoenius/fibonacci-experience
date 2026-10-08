import { GalaxyJourney, GalaxyJourneyPhase } from "./GalaxyJourney.js";

// Technical vertical slice: Journey 2's exact seven phases and timings.
export class EarthJourney extends GalaxyJourney {
  constructor() { super({ id: "planetary-environment" }); }

  start() {
    this.completed = false;
    this.cancelled = false;
    this.phase = GalaxyJourneyPhase.START;
    this.phaseTime = 0;
    console.log("Journey 3 START: planetary -> environment");
  }
}
