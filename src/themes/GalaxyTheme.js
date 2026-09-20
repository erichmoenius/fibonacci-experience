import * as THREE from "three";
import { BaseTheme } from "./BaseTheme.js";
import { GalaxySystem } from "../systems/GalaxySystem.js";
import { GalaxyFlight } from "../systems/GalaxyFlight.js";

export class GalaxyTheme extends BaseTheme {
  constructor(container, gui) {
    super(container, gui);
    this.galaxy = new GalaxySystem(container);
    this.flight = new GalaxyFlight(this.galaxy.group);
    this.lastUpdateTime = null;
    // The app's separate blue spiral sits at the world origin, below this galaxy.
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
    this.galaxy.update(delta);
  }

  getEnvironment() {
    return { world: false, stars: false, portal: false, stage: true };
  }

  getHomePose() {
    return {
      position: new THREE.Vector3(20, 89, -30),
      lookTarget: new THREE.Vector3(0, 0, -30),
    };
  }

  getGateways() {
    return [];
  }

  destroy() {
    this.galaxy.destroy();
    if (this.backgroundParticleField) {
      this.backgroundParticleField.visible = this.backgroundParticleFieldWasVisible;
    }
  }
}
