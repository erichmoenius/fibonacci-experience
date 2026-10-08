import * as THREE from "three";
import { BaseTheme } from "./BaseTheme.js";
import { SolarSystem } from "../systems/SolarSystem.js";
import { PlanetaryFlight } from "../systems/PlanetaryFlight.js";
import { PlanetaryMilkyWay } from "../systems/PlanetaryMilkyWay.js";
import { PlanetaryDeepSpace } from "../systems/PlanetaryDeepSpace.js";

import { EarthJourney } from "../systems/cinematic/EarthJourney.js";
import Gateway from "../systems/cinematic/Gateway.js";

// Earth-only readiness threshold, in world units from its live center.
export const PLANETARY_EARTH_GATEWAY_RADIUS = 10;

// Theme-owned schema and unsaved session values. Defaults come from this theme's
// existing flight instance, before any saved or runtime tuning is applied.
const PLANETARY_FLIGHT_GUI = {
  id: "planetary",
  title: "Planetary Flight Control",
  storageKey: "fibonacci-flight-v1-planetary",
  runtime: null,
  controls: [
    ["thrustMaxSpeed", "Flight speed (units/s)", 0.35, 24, 0.05],
    ["thrustAcceleration", "Acceleration response (1/s)", 0.5, 20, 0.1],
    ["thrustBraking", "Damping / braking (1/s)", 0.5, 25, 0.1],
    ["angularSensitivity", "X orbit sensitivity (rad/px)", 0.0002, 0.006, 0.0001],
    ["verticalSensitivity", "Y orbit sensitivity (units/px)", 0.005, 0.15, 0.001],
    ["strafeDisplacementSensitivity", "X strafe sensitivity (units/s/px)", 0.005, 0.2, 0.001],
    ["thrustDisplacementSensitivity", "Z thrust sensitivity (units/s/px)", 0.005, 0.2, 0.001],
  ],
};

export class PlanetaryTheme extends BaseTheme {
  getFlightGUIConfig() { return PLANETARY_FLIGHT_GUI; }

  constructor(container, gui) {
    super(container, gui);
    this.milkyWay = new PlanetaryMilkyWay(container);
    this.deepSpace = new PlanetaryDeepSpace(container);
    this.solarSystem = new SolarSystem(container);
    this.flight = new PlanetaryFlight(this.solarSystem);
    this.updateBeforeGatewayDetection = true;
    this.earthGateway = new Gateway(new THREE.Vector3(), PLANETARY_EARTH_GATEWAY_RADIUS, this.solarSystem.earth);
    this.earthGateway.acceptanceMode = "proximity-lmb";
    this.earthGateway.readinessOnly = false;
    this.earthGateway.journey = new EarthJourney();
    this.earthGateway.crossing = {
      target: this.solarSystem.earth, direction: new THREE.Vector3(0, 0, 1), endpointDistance: 0.75,
    };
    this.earthGateway.intentCount = 0;
    // Registered destination ID; proximity alone never starts this journey.
    this.earthGateway.destinationTheme = "environment";
    this.gateways = [this.earthGateway];
    this.lastUpdateTime = null;
    this.backgroundParticleField = container.parent?.children.find(
      (object) => object.isPoints && object.geometry?.getAttribute("aHue"),
    );
    if (this.backgroundParticleField) {
      this.backgroundParticleFieldWasVisible = this.backgroundParticleField.visible;
      this.backgroundParticleField.visible = false;
    }
  }

  update(state) {
    const time = state.time;
    const delta = this.lastUpdateTime === null
      ? 0
      : Math.min(Math.max(time - this.lastUpdateTime, 0), 0.1);
    this.lastUpdateTime = time;
    this.solarSystem.update(delta);
  }

  getEnvironment() {
    return { world: false, stars: false, portal: false, stage: true };
  }

  getHomePose() {
    return {
      position: new THREE.Vector3(10, 10, 48),
      lookTarget: new THREE.Vector3(10, 0, 0),
    };
  }

  getCameraFar() {
    return 320;
  }

  getGateways() {
    return this.gateways;
  }

  destroy() {
    this.earthGateway.enabled = false;
    this.earthGateway.target = null;
    this.earthGateway.crossing.target = null;
    if (this.journeyDirector?.gateways === this.gateways) {
      this.journeyDirector.setGateways([]);
      this.journeyDirector.gatewayReady = false;
      this.journeyDirector.onGatewayReady?.(false, null);
    }
    this.gateways.length = 0;
    this.deepSpace.dispose();
    this.milkyWay.dispose();
    this.solarSystem.dispose();
    if (this.backgroundParticleField) {
      this.backgroundParticleField.visible = this.backgroundParticleFieldWasVisible;
    }
  }
}
