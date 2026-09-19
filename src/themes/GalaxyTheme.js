import * as THREE from "three";
import { BaseTheme } from "./BaseTheme.js";
import { GalaxySystem } from "../systems/GalaxySystem.js";

export class GalaxyTheme extends BaseTheme {
  constructor(container, gui) {
    super(container, gui);
    this.galaxy = new GalaxySystem(container);
    // The app's separate blue spiral sits at the world origin, below this galaxy.
    this.backgroundParticleField = container.parent?.children.find(
      (object) => object.isPoints && object.geometry?.getAttribute("aHue"),
    );
    if (this.backgroundParticleField) {
      this.backgroundParticleFieldWasVisible = this.backgroundParticleField.visible;
      this.backgroundParticleField.visible = false;
    }
  }

  update() {
    this.galaxy.update(0.016);
  }

  getEnvironment() {
    return { world: false, stars: false, portal: false, stage: true };
  }

  getHomePose() {
    return {
      position: new THREE.Vector3(4, 25, 12),
      lookTarget: new THREE.Vector3(21, 0, -30),
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
