import * as THREE from "three";
import { DevelopmentTheme } from "./DevelopmentTheme.js";
import { SphericalTravellerFlight } from "../systems/SphericalTravellerFlight.js";

const MOLECULAR_FLIGHT = {
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

export class MolecularTheme extends DevelopmentTheme {
  constructor(container, gui) {
    super(container, {
      name: "MolecularTheme",
      label: "6 - MOLECULAR WORLD",
      color: 0x35d9e8,
    });
    this.flight = new SphericalTravellerFlight({
      orbitCenter: this.group.getWorldPosition(new THREE.Vector3()),
      ...MOLECULAR_FLIGHT,
    });
  }
}
