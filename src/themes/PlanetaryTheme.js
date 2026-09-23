import * as THREE from "three";
import { BaseTheme } from "./BaseTheme.js";
import { SolarSystem } from "../systems/SolarSystem.js";
import { PlanetaryFlight } from "../systems/PlanetaryFlight.js";

export class PlanetaryTheme extends BaseTheme {
  constructor(container, gui) {
    super(container, gui);
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

  getGateways() {
    return [];
  }

  destroy() {
    this.solarSystem.dispose();
    if (this.backgroundParticleField) {
      this.backgroundParticleField.visible = this.backgroundParticleFieldWasVisible;
    }
  }
}
