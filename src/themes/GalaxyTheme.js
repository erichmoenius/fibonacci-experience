import * as THREE from "three";
import { BaseTheme } from "./BaseTheme.js";
import { GalaxySystem } from "../systems/GalaxySystem.js";

export class GalaxyTheme extends BaseTheme {
  constructor(container, gui) {
    super(container, gui);
    this.galaxy = new GalaxySystem(container);
  }

  update() {
    this.galaxy.update(0.016);
  }

  getEnvironment() {
    return { world: true, stars: false, portal: false, stage: true };
  }

  getHomePose() {
    return {
      position: new THREE.Vector3(0, 26, 32),
      lookTarget: new THREE.Vector3(0, 0, -30),
    };
  }

  getGateways() {
    return [];
  }

  destroy() {
    this.galaxy.destroy();
  }
}
