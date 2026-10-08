import * as THREE from "three";
import { BaseTheme } from "./BaseTheme.js";
import { EarthGlobe, EARTH_RADIUS } from "../systems/EarthGlobe.js";
import { SphericalTravellerFlight } from "../systems/SphericalTravellerFlight.js";

const ENVIRONMENT_FLIGHT = {
  travelLimit: 16,
  maxSpeed: 2,
  orbitAngularSensitivity: 0.001,
  orbitElevationSensitivity: 0.001,
  travelAcceleration: 7, // Planetary acceleration response; geometry stays theme-owned.
  travelBraking: 11,
  thrustSensitivity: 2 * (0.08 / 12), // Same fraction of maxSpeed per pixel as Planetary.
  strafeSensitivity: 2 * (0.08 / 12),
  deadZone: 3,
  stopEpsilon: 0.01,
};

// Theme-owned schema and unsaved session values. Defaults come from this theme's
// existing flight instance, before any saved or runtime tuning is applied.
const ENVIRONMENT_FLIGHT_GUI = {
  id: "environment",
  title: "Environment Flight Control",
  storageKey: "fibonacci-flight-v1-environment",
  runtime: null,
  controls: [
    ["rmbMaxSpeed", "Flight speed (units/s)", 0.35, 6, 0.05],
    ["rmbAcceleration", "Acceleration response (1/s)", 0.5, 12, 0.1],
    ["rmbBraking", "Damping / braking (1/s)", 0.5, 25, 0.1],
    ["orbitAngularSensitivity", "X orbit sensitivity (rad/px)", 0.0002, 0.003, 0.0001],
    ["orbitElevationSensitivity", "Y orbit sensitivity (rad/px)", 0.0002, 0.003, 0.0001],
    ["rmbStrafeSensitivity", "X strafe sensitivity (units/s/px)", 0.005, 0.1, 0.001],
    ["rmbThrustSensitivity", "Z thrust sensitivity (units/s/px)", 0.005, 0.1, 0.001],
  ],
};

export class EnvironmentTheme extends BaseTheme {
  getFlightGUIConfig() { return ENVIRONMENT_FLIGHT_GUI; }

  constructor(container, gui) {
    super(container, gui);
    this.earth = new EarthGlobe(container);
    this.group = this.earth.group;
    this.lastUpdateTime = null;
    this.flight = new SphericalTravellerFlight({
      orbitCenter: this.earth.getWorldCenter(new THREE.Vector3()),
      ...ENVIRONMENT_FLIGHT,
    });
    // Opt into Earth-facing orbit only; shared adapters and other themes retain
    // their existing heading behavior. LMB translation keeps its free heading.
    this.flight.getOrbitLookTarget = () => this.flight.orbiting
      ? this.flight.orbitCenter : null;
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
    if (!Number.isFinite(time)) return;
    const delta = this.lastUpdateTime === null ? 0 : time - this.lastUpdateTime;
    this.lastUpdateTime = time;
    this.earth.update(delta);
    this.earth.getWorldCenter(this.flight.orbitCenter);
  }

  getEnvironment() {
    return { world: false, stars: false, legacyStars: false, portal: false, stage: false };
  }

  getHomePose() {
    const center = this.earth.getWorldCenter(new THREE.Vector3());
    // Fit the entire atmosphere within the smaller viewport dimension at the
    // shared 60-degree FOV, with room for the existing idle camera motion.
    const aspect = typeof window === "undefined" ? 1 : window.innerWidth / Math.max(window.innerHeight, 1);
    const halfFov = Math.atan(Math.tan(Math.PI / 6) * Math.min(Math.max(aspect, 0.1), 1));
    const distance = Math.max(6.5, EARTH_RADIUS * 1.018 / Math.sin(halfFov) * 1.3);
    return { position: center.clone().add(new THREE.Vector3(0, 0, distance)), lookTarget: center };
  }

  getGateways() { return []; }

  destroy() {
    this.earth.dispose();
    if (this.backgroundParticleField) {
      this.backgroundParticleField.visible = this.backgroundParticleFieldWasVisible;
    }
  }
}
