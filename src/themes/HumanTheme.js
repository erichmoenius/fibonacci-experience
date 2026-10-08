import * as THREE from "three";
import { DevelopmentTheme } from "./DevelopmentTheme.js";
import { SphericalTravellerFlight } from "../systems/SphericalTravellerFlight.js";

const HUMAN_FLIGHT = {
  travelLimit: 16,
  maxSpeed: 2,
  orbitAngularSensitivity: 0.001,
  orbitElevationSensitivity: 0.001,
  travelAcceleration: 7, // Planetary acceleration response; geometry stays theme-owned.
  travelBraking: 11,
  thrustSensitivity: 2 * (0.08 / 12), // Same fraction of maxSpeed per pixel as Planetary.
  strafeSensitivity: 2 * (0.08 / 12),
  deadZone: 3,
  stopEpsilon: 0.01,
};

// Theme-owned schema and unsaved session values. Defaults come from this theme's
// existing flight instance, before any saved or runtime tuning is applied.
const HUMAN_FLIGHT_GUI = {
  id: "human",
  title: "Human Flight Control",
  storageKey: "fibonacci-flight-v1-human",
  runtime: null,
  controls: [
    ["rmbMaxSpeed", "Flight speed (units/s)", 0.35, 6, 0.05],
    ["rmbAcceleration", "Acceleration response (1/s)", 0.5, 12, 0.1],
    ["rmbBraking", "Damping / braking (1/s)", 0.5, 25, 0.1],
    ["orbitAngularSensitivity", "X orbit sensitivity (rad/px)", 0.0002, 0.003, 0.0001],
    ["orbitElevationSensitivity", "Y orbit sensitivity (rad/px)", 0.0002, 0.003, 0.0001],
    ["rmbStrafeSensitivity", "X strafe sensitivity (units/s/px)", 0.005, 0.1, 0.001],
    ["rmbThrustSensitivity", "Z thrust sensitivity (units/s/px)", 0.005, 0.1, 0.001],
  ],
};

export class HumanTheme extends DevelopmentTheme {
  getFlightGUIConfig() { return HUMAN_FLIGHT_GUI; }

  constructor(container, gui) {
    super(container, {
      name: "HumanTheme",
      label: "5 - HUMAN",
      color: 0xff8a4c,
    });
    this.flight = new SphericalTravellerFlight({
      orbitCenter: this.group.getWorldPosition(new THREE.Vector3()),
      ...HUMAN_FLIGHT,
    });
  }
}
