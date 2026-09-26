import * as THREE from "three";
import { SphericalTravellerFlight } from "./SphericalTravellerFlight.js";

const SPACE_TRAVEL_LIMIT = 40;

export class SpaceFlight extends SphericalTravellerFlight {
  constructor(engineRoot) {
    super({
      orbitCenter: engineRoot.getWorldPosition(new THREE.Vector3()),
      travelLimit: SPACE_TRAVEL_LIMIT,
      maxSpeed: 9,
    });
  }
}
