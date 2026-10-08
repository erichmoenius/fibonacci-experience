import * as THREE from "three";
import { BaseTheme } from "./BaseTheme.js";
import { SolarSystem } from "../systems/SolarSystem.js";
import { PlanetaryFlight } from "../systems/PlanetaryFlight.js";
import { PlanetaryMilkyWay } from "../systems/PlanetaryMilkyWay.js";
import { PlanetaryDeepSpace } from "../systems/PlanetaryDeepSpace.js";

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
    return [];
  }

  destroy() {
    this.deepSpace.dispose();
    this.milkyWay.dispose();
    this.solarSystem.dispose();
    if (this.backgroundParticleField) {
      this.backgroundParticleField.visible = this.backgroundParticleFieldWasVisible;
    }
  }
}
