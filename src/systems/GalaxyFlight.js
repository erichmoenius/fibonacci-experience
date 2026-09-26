import * as THREE from "three";
import { SphericalTravellerFlight } from "./SphericalTravellerFlight.js";

const GALAXY_RADIUS = 35;

export class GalaxyFlight extends SphericalTravellerFlight {
  constructor(galaxyRoot) {
    const worldScale = galaxyRoot.getWorldScale(new THREE.Vector3()).x;
    super({
      orbitCenter: galaxyRoot.getWorldPosition(new THREE.Vector3()),
      travelLimit: GALAXY_RADIUS * worldScale * 4,
      maxSpeed: 6,
    });
  }
}
