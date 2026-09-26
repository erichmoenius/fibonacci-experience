import * as THREE from "three";
import { BaseTheme } from "./BaseTheme.js";
import { GalaxySystem } from "../systems/GalaxySystem.js";
import { GalaxyFlight } from "../systems/GalaxyFlight.js";
import { GalaxyCosmos } from "../systems/GalaxyCosmos.js";
import Gateway from "../systems/cinematic/Gateway.js";
import { GalaxyJourney } from "../systems/cinematic/GalaxyJourney.js";

export class GalaxyTheme extends BaseTheme {
  constructor(container, gui) {
    super(container, gui);
    this.galaxy = new GalaxySystem(container);
    this.cosmos = new GalaxyCosmos(container, this.getHomePose());
    this.flight = new GalaxyFlight(this.galaxy.group);
    this.gateways = [];

    const gateway = new Gateway(
      new THREE.Vector3(),
      2.5,
      this.galaxy.specialStar,
    );
    gateway.acceptanceMode = "proximity-lmb";
    gateway.crossing = {
      target: this.galaxy.specialStar,
      direction: new THREE.Vector3(0, 0, 1),
      endpointDistance: 0.75,
      orientation: "forward",
      transitDistance: 2.5,
    };
    gateway.destinationTheme = "planetary";
    gateway.journey = new GalaxyJourney();
    this.gateways.push(gateway);

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
      position: new THREE.Vector3(28, 22, 12),
      lookTarget: new THREE.Vector3(18, 0, -27),
    };
  }

  getGateways() {
    return this.gateways;
  }

  destroy() {
    this.cosmos.dispose();
    this.galaxy.destroy();
    if (this.backgroundParticleField) {
      this.backgroundParticleField.visible = this.backgroundParticleFieldWasVisible;
    }
  }
}
