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
import { CinematicTimeline } from "./CinematicTimeline.js";

const NORMAL_TIME_SCALE = 1.0;
const SLOW_MOTION_TIME_SCALE = 1 / 3;

export default class JourneyDirector {
  constructor(cameraDirector) {
    this.cameraDirector = cameraDirector;

    this.timeScale = NORMAL_TIME_SCALE;

    this.activeJourney = null;
    this.timeline = new CinematicTimeline();
    this.activeJourneyTarget = null;
    this.activeJourneyCrossing = null;
    this.activeJourneyDestinationTheme = null;

    this.gateways = [];

    this.onJourneyFinished = null;

    this.onApproach = null;

    this.onHorizon = null;

    this.onSingularity = null;

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

  isSlowMotionEnabled() {
    return this.timeScale === SLOW_MOTION_TIME_SCALE;
  }

  toggleSlowMotion() {
    this.timeScale = this.isSlowMotionEnabled()
      ? NORMAL_TIME_SCALE
      : SLOW_MOTION_TIME_SCALE;

    return this.isSlowMotionEnabled();
  }

  getScaledDelta(delta = 0.016) {
    return delta * this.timeScale;
  }

  begin(journey, target = null, crossing = null, destinationTheme = null) {
    if (!(journey instanceof Journey)) {
      throw new Error("JourneyDirector.begin() expects a Journey.");
    }

    this.activeJourney = journey;
    this.activeJourneyTarget = target;
    this.activeJourneyCrossing = crossing;
    this.activeJourneyDestinationTheme = destinationTheme;

    this.activeJourney.onEvent = (event, data) => {
      this.timeline.sampleJourney(this.activeJourney);
      if (event === "approach") {
        this.onApproach?.(this.activeJourneyTarget);
      }

      if (event === "horizon") {
        this.onHorizon?.(this.activeJourneyTarget);
      }

      if (event === "singularity") {
        this.onSingularity?.(this.activeJourneyCrossing);
      }

      if (event === "wormhole") {
        this.onTransit?.("wormhole");
      }

      if (event === "void") {
        this.onVoidStart?.();
      }

      if (event === "birth") {
        this.onBirth?.(this.activeJourneyDestinationTheme);
      }

      if (event === "complete") {
        this.onTransitEnd?.();

        this.onJourneyFinished?.();
        this.timeline.continueWith(this.cameraDirector.journey);

        this.activeJourney = null;
        this.activeJourneyTarget = null;
        this.activeJourneyCrossing = null;
        this.activeJourneyDestinationTheme = null;
      }
    };

    this.activeJourney.start();
    this.timeline.start(this.activeJourney);
  }

  addGateway(gateway) {
    this.gateways.push(gateway);
  }

  stop() {
    this.timeline.cancel();
    if (this.activeJourney) {
      this.activeJourney.cancel();
    }

    this.activeJourney = null;
    this.activeJourneyTarget = null;
    this.activeJourneyCrossing = null;
    this.activeJourneyDestinationTheme = null;
  }

  findGateway(position) {
    for (const gateway of this.gateways) {
      if (!gateway.enabled) continue;

      const gatewayPosition = gateway.resolvePosition();

      console.log(
        "Gateway position:",
        gatewayPosition,
        "radius:",
        gateway.radius,
      );

      const distance = gatewayPosition.distanceTo(position);

      console.log("🧪 GATEWAY DISTANCE:", distance.toFixed(2));

      if (distance <= gateway.radius) {
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

    const journey = this.activeJourney;
    const scaledDelta = this.getScaledDelta(delta);
    this.timeline.advanceLegacy(journey, scaledDelta);
    journey.update(scaledDelta);
    this.timeline.sampleJourney(journey);
  }
}
