import * as THREE from "three";
import { BaseTheme } from "./BaseTheme.js";
import { GalaxySystem } from "../systems/GalaxySystem.js";
import { GalaxyFlight } from "../systems/GalaxyFlight.js";
import { GalaxyCosmos } from "../systems/GalaxyCosmos.js";
import { GalaxyPlasmaFilaments } from "../systems/GalaxyPlasmaFilaments.js";
import Gateway from "../systems/cinematic/Gateway.js";
import { GalaxyJourney } from "../systems/cinematic/GalaxyJourney.js";

export class GalaxyTheme extends BaseTheme {
  constructor(container, gui) {
    super(container, gui);
    this.galaxy = new GalaxySystem(container);
    const home = this.getHomePose();
    const homeForward = home.lookTarget.clone().sub(home.position).normalize();
    // Bring the complete foreground, including its tracked gateway, closer.
    this.galaxy.group.position.addScaledVector(homeForward, -12);
    this.galaxy.group.updateWorldMatrix(true, true);
    // Extinguish background light through the existing body density before
    // adding the unchanged foreground emission, stars and Special Star glows.
    this.galaxy.group.traverse((object) => {
      if (object.isMesh) object.renderOrder = 4;
      if (object.isPoints || object.isSprite) object.renderOrder = 5;
    });
    this.galaxy.body.extinctionSurface.renderOrder = 3;
    this.cosmos = new GalaxyCosmos(container, this.getHomePose());
    // Siblings of SpiralGalaxy: stable cosmic phenomena, never spiral children.
    this.plasmaFilaments = new GalaxyPlasmaFilaments(container, this.getHomePose());
    // Translate the independent fields along their home sightlines. Their
    // centers retain the upper band and horizontal separation at a deeper layer.
    for (const territory of this.plasmaFilaments.territories) {
      const center = territory.center.clone().applyMatrix4(territory.worldFrame);
      const sightline = center.sub(home.position);
      const offset = sightline.multiplyScalar(16 / sightline.dot(homeForward));
      territory.worldFrame.setPosition(
        new THREE.Vector3().setFromMatrixPosition(territory.worldFrame).add(offset),
      );
    }
    this.plasmaFilaments.setParameter("scale", this.plasmaFilaments.parameters.scale);
    if (gui) this.plasmaFilaments.addGUI(gui);
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
    this.plasmaFilaments.update(state.audio, delta);
  }

  getEnvironment() {
    return { world: false, stars: false, portal: false, stage: false };
  }

  getHomePose() {
    return {
      position: new THREE.Vector3(28, 22, 12),
      lookTarget: new THREE.Vector3(18, 0, -27),
    };
  }

  getCameraFar() {
    // 210 units of Galaxy travel + the distant Veil supports, with margin.
    return 450;
  }

  getGateways() {
    return this.gateways;
  }

  destroy() {
    this.plasmaFilaments.dispose();
    this.cosmos.dispose();
    this.galaxy.destroy();
    if (this.backgroundParticleField) {
      this.backgroundParticleField.visible = this.backgroundParticleFieldWasVisible;
    }
  }
}
