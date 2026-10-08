import * as THREE from "three";
import { BaseTheme } from "./BaseTheme.js";
import { GalaxySystem } from "../systems/GalaxySystem.js";
import { GalaxyFlight } from "../systems/GalaxyFlight.js";
import { GalaxyCosmos } from "../systems/GalaxyCosmos.js";
import { GalaxyPlasmaFilaments } from "../systems/GalaxyPlasmaFilaments.js";
import Gateway from "../systems/cinematic/Gateway.js";
import { GalaxyJourney } from "../systems/cinematic/GalaxyJourney.js";

// Theme-owned schema and unsaved session values. Defaults come from this theme's
// existing flight instance, before any saved or runtime tuning is applied.
const GALAXY_FLIGHT_GUI = {
  id: "galaxy",
  title: "Galaxy Flight Control",
  storageKey: "fibonacci-flight-v1-galaxy",
  runtime: null,
  controls: [
    ["rmbMaxSpeed", "Flight speed (units/s)", 0.35, 12, 0.05],
    ["rmbAcceleration", "Acceleration response (1/s)", 0.5, 20, 0.1],
    ["rmbBraking", "Damping / braking (1/s)", 0.5, 25, 0.1],
    ["orbitAngularSensitivity", "X orbit sensitivity (rad/px)", 0.0002, 0.006, 0.0001],
    ["orbitElevationSensitivity", "Y orbit sensitivity (rad/px)", 0.0002, 0.006, 0.0001],
    ["rmbStrafeSensitivity", "X strafe sensitivity (units/s/px)", 0.005, 0.2, 0.001],
    ["rmbThrustSensitivity", "Z thrust sensitivity (units/s/px)", 0.005, 0.2, 0.001],
  ],
};

export class GalaxyTheme extends BaseTheme {
  getFlightGUIConfig() { return GALAXY_FLIGHT_GUI; }

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
    // Match Planetary's fractional thrust/strafe response per pointer pixel,
    // retaining this theme's speed cap, orbit reference and angular geometry.
    this.flight.rmbThrustSensitivity = this.flight.rmbMaxSpeed * (0.08 / 12);
    this.flight.rmbStrafeSensitivity = this.flight.rmbMaxSpeed * (0.08 / 12);
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

  handleInspectionWheel(event, camera, canvas) {
    return this.galaxy.specialStar.handleInspectionWheel(event, camera, canvas);
  }

  resetInspection() {
    this.galaxy.specialStar.resetInspection();
  }

  getFlightDiagnostics({ cameraDirector, journeyDirector }) {
    const position = cameraDirector.position;
    const gateway = this.gateways[0];
    return {
      "Traveller world position": [position.x, position.y, position.z]
        .map((value) => value.toFixed(2)).join(", "),
      "Distance to Special Star": gateway.resolvePosition().distanceTo(position).toFixed(2),
      "Gateway READY": journeyDirector.gatewayReady,
    };
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
