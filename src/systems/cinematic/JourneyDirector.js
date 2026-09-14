// =====================================================
// JOURNEY DIRECTOR
// =====================================================
//
// Hero Core Journey Director
//
// Responsibilities:
//
// • Starts cinematic journeys
// • Coordinates CameraDirector
// • Future orchestration of audio, FX and world transitions
//
// This class NEVER knows:
//
// ❌ Three.js Camera
//
// It only knows:
//
// ✔ CameraDirector
// ✔ Active Journey
//
// =====================================================

import { Journey } from "./Journey";
export default class JourneyDirector {
  constructor(cameraDirector) {
    this.cameraDirector = cameraDirector;

    this.activeJourney = null;

    this.gateways = [];

    this.onJourneyFinished = null;

    // -------------------------------------------------
    // GATEWAY STATE
    // -------------------------------------------------

    this.gatewayReady = false;

    this.onGatewayReady = null;
  }

  getPhase() {
    return this.activeJourney?.phase ?? "IDLE";
  }

  getJourney() {
    return this.activeJourney;
  }

  isActive() {
    return this.activeJourney !== null;
  }

  begin(journey) {
    if (!(journey instanceof Journey)) {
      throw new Error("JourneyDirector.begin() expects a Journey.");
    }

    this.activeJourney = journey;

    this.activeJourney.onEvent = (event, data) => {
      if (event === "wormhole") {
        this.onTransit?.("wormhole");
      }

      if (event === "void") {
        this.onVoidStart?.();
      }

      if (event === "birth") {
        this.onBirth?.();
      }

      if (event === "complete") {
        this.onTransitEnd?.();

        this.onJourneyFinished?.();

        this.activeJourney = null;
      }
    };

    this.activeJourney.start();
  }

  addGateway(gateway) {
    this.gateways.push(gateway);
  }

  stop() {
    if (this.activeJourney) {
      this.activeJourney.cancel();
    }

    this.activeJourney = null;
  }

  findGateway(position) {
    for (const gateway of this.gateways) {
      if (!gateway.enabled) continue;

      console.log(
        "Gateway position:",
        gateway.position,
        "radius:",
        gateway.radius,
      );

      const distance = gateway.position.distanceTo(position);

      console.log("🧪 GATEWAY DISTANCE:", distance.toFixed(2));

      if (gateway.contains(position)) {
        return gateway;
      }
    }

    return null;
  }

  setGateways(gateways) {
    this.gateways = gateways;
  }

  update(cameraPosition, delta = 0.016) {
    // -------------------------------------------------
    // GATEWAY PROXIMITY
    // -------------------------------------------------

    // -------------------------------------------------
    //
    // GATEWAY PROXIMITY
    //
    // -------------------------------------------------

    const travelerPosition = this.cameraDirector.position;

    const gateway = this.findGateway(travelerPosition);

    const ready = gateway !== null;

    console.log(
      "🧪 GATEWAY STATE:",
      "ready:",
      ready,
      "previous:",
      this.gatewayReady,
    );

    // -------------------------------------------------
    //
    // GATEWAY STATE CHANGE
    //
    // -------------------------------------------------

    if (ready !== this.gatewayReady) {
      this.gatewayReady = ready;

      console.log(ready ? "🌌 GATEWAY READY" : "🌌 GATEWAY LEFT");

      this.onGatewayReady?.(ready, gateway);
    }

    if (!this.activeJourney) return;

    this.activeJourney.update(delta);
  }
}
