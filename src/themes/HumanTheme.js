import * as THREE from "three";
import { DevelopmentTheme } from "./DevelopmentTheme.js";
import { SphericalTravellerFlight } from "../systems/SphericalTravellerFlight.js";

const HUMAN_FLIGHT = {
  travelLimit: 16,
  maxSpeed: 2,
  orbitAngularSensitivity: 0.001,
  orbitElevationSensitivity: 0.001,
  travelAcceleration: 5,
  travelBraking: 11,
  thrustSensitivity: 0.03,
  strafeSensitivity: 0.03,
  deadZone: 3,
  stopEpsilon: 0.01,
};

export class HumanTheme extends DevelopmentTheme {
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
