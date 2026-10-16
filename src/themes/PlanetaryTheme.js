import * as THREE from "three";
import { BaseTheme } from "./BaseTheme.js";
import { SolarSystem } from "../systems/SolarSystem.js";
import { PlanetaryFlight } from "../systems/PlanetaryFlight.js";
import { PlanetaryMilkyWay } from "../systems/PlanetaryMilkyWay.js";
import { PlanetaryDeepSpace } from "../systems/PlanetaryDeepSpace.js";
import { BlobAuraReferenceA12 } from "../systems/dev/BlobAuraReferenceA12.js";

import { EarthJourney } from "../systems/cinematic/EarthJourney.js";
import Gateway from "../systems/cinematic/Gateway.js";

// Earth-only readiness threshold, in world units from its live center.
export const PLANETARY_EARTH_GATEWAY_RADIUS = 10;

// Theme-owned schema and unsaved session values. Defaults come from this theme's
// existing flight instance, before any saved or runtime tuning is applied.
const PLANETARY_FLIGHT_GUI = {
  id: "planetary",
  title: "Planetary Flight Control",
  storageKey: "fibonacci-flight-v1-planetary",
  runtime: null,
  controls: [
    ["thrustMaxSpeed", "Flight speed (units/s)", 0.35, 24, 0.05],
    ["thrustAcceleration", "Acceleration response (1/s)", 0.5, 20, 0.1],
    ["thrustBraking", "Damping / braking (1/s)", 0.5, 25, 0.1],
    ["angularSensitivity", "X orbit sensitivity (rad/px)", 0.0002, 0.006, 0.0001],
    ["verticalSensitivity", "Y orbit sensitivity (units/px)", 0.005, 0.15, 0.001],
    ["strafeDisplacementSensitivity", "X strafe sensitivity (units/s/px)", 0.005, 0.2, 0.001],
    ["thrustDisplacementSensitivity", "Z thrust sensitivity (units/s/px)", 0.005, 0.2, 0.001],
  ],
};

// Unsaved session controls, like the theme's flight runtime: survive theme
// switches, reset on page reload. Both rendered systems read this same object.
const PLANETARY_AUDIO_SETTINGS = {
  masterGain: 1, coronaBassGain: 1, starHighGain: 1, starEnergyGain: 1,
};

export class PlanetaryTheme extends BaseTheme {
  getFlightGUIConfig() { return PLANETARY_FLIGHT_GUI; }

  getDevDiagnostics(context) {
    const sun = this.solarSystem?.sun, gateway = this.earthGateway;
    const rows = [
      { label: "Sun", value: sun ? `ACTIVE / ${context.objectViewState(sun)}` : "INACTIVE" },
      { label: "Sun clock", value: context.formatTime(sun?.material?.uniforms?.uTime?.value), fullOnly: true },
    ];
    if (gateway && import.meta.env.DEV) {
      // Never call resolvePosition()/contains(): they update gateway caches.
      const position = gateway.target ? context.worldPosition(gateway.target) : gateway.position;
      const camera = context.cameraPosition;
      const distance = Math.hypot(camera.x-position.x, camera.y-position.y, camera.z-position.z);
      rows.push(
        { label: "Earth gateway", value: context.isGatewayRegistered(gateway) ? "REGISTERED" : "-", fullOnly: true },
        { label: "Earth world", value: [position.x, position.y, position.z].map(v => v.toFixed(2)).join(", "), fullOnly: true },
        { label: "Earth distance", value: distance.toFixed(2), fullOnly: true },
        { label: "Earth radius", value: gateway.radius.toFixed(2), fullOnly: true },
        { label: "Earth state", value: gateway.enabled && distance <= gateway.radius ? "READY" : "NOT READY" },
        { label: "Earth intent", value: gateway.intentCount, fullOnly: true },
      );
    }
    return [
      ...(import.meta.env.DEV && this.audioTraceA7Rows
        ? [{ title: "Audio A7 · runtime truth", rows: this.audioTraceA7Rows }] : []),
      { title: "Planetary", rows },
      ...(import.meta.env.DEV && this.audioTraceRows
        ? [{ title: "Audio A3 · same frame · B/M/H/E", rows: this.audioTraceRows.map(r => ({ ...r, fullOnly: Boolean(this.audioTraceA7Rows) })) }] : [])];
  }

  constructor(container, gui) {
    super(container, gui);
    this.milkyWay = new PlanetaryMilkyWay(container);
    this.deepSpace = new PlanetaryDeepSpace(container);
    this.solarSystem = new SolarSystem(container);
    // TEMPORARY A12 comparison, DEV-only and excluded from cinematic states.
    if (import.meta.env.DEV) this.blobAuraReference = new BlobAuraReferenceA12(container,
      () => this.journeyDirector?.cameraDirector?.mode === "explore"
        && !this.journeyDirector?.isActive() && !this.transitSystem?.active);
    this.audioSettings = PLANETARY_AUDIO_SETTINGS;
    this.solarSystem.solarActivity.audioSettings = this.audioSettings;
    if (gui) {
      this.audioFolder = gui.addFolder("Planetary Audio").close();
      for (const [key, label] of [
        ["masterGain", "Master Audio Gain"], ["coronaBassGain", "Corona Bass Gain"],
        ["starHighGain", "Star High Gain"], ["starEnergyGain", "Star Energy Gain"],
      ]) this.audioFolder.add(this.audioSettings, key, 0, 10, 0.1).name(label);
      this.solarFolder = gui.addFolder("Sun · Audio activity");
      const settings = this.solarSystem.solarActivity.settings;
      this.solarFolder.add(settings, "response", 0, 1, 0.05).name("Audio response");
      this.solarFolder.add(settings, "eruptions").name("Solar eruptions");
      this.solarFolder.add(settings, "eruptionThreshold", 0.2, 0.7, 0.01).name("Eruption threshold");
      // Read-only A1 trace; no second audio sample and no visual parameter changes.
      const theme = this;
      const bands = ["bass", "mid", "high", "energy"];
      const format = (v) => Number.isFinite(v) ? v.toFixed(3) : "-";
      const trace = {
        get input() {
          const audio = theme.solarAudioInput;
          return bands.map(key => format(audio?.[key])).join(" / ")
            + ` / K:${audio?.kick ? 1 : 0}`;
        },
        set input(_value) {},
        get smoothed() {
          const signals = theme.solarSystem.solarActivity.signals;
          return bands.map(key => format(signals[key])).join(" / ");
        },
        set smoothed(_value) {},
        get gate() {
          return `J:${theme.journeyDirector?.isActive() ? 1 : 0}`
            + ` T:${theme.transitSystem?.active ? 1 : 0}`
            + ` gain:${format(settings.response)} dt:${format(theme.solarAudioDelta)}`;
        },
        set gate(_value) {},
        get rotation() {
          return `${format(THREE.MathUtils.radToDeg(theme.solarSystem.sun.rotation.y))} deg`;
        },
        set rotation(_value) {},
      };
      this.solarFolder.add(trace, "input").name("In B/M/H/E · Kick").listen().disable();
      this.solarFolder.add(trace, "smoothed").name("Smoothed B/M/H/E").listen().disable();
      this.solarFolder.add(trace, "gate").name("Journey / Transit / Gain / dt").listen().disable();
      this.solarFolder.add(trace, "rotation").name("Sun local rotation Y").listen().disable();
    }
    this.flight = new PlanetaryFlight(this.solarSystem);
    this.updateBeforeGatewayDetection = true;
    this.earthGateway = new Gateway(new THREE.Vector3(), PLANETARY_EARTH_GATEWAY_RADIUS, this.solarSystem.earth);
    this.earthGateway.acceptanceMode = "proximity-lmb";
    this.earthGateway.readinessOnly = false;
    this.earthGateway.journey = new EarthJourney();
    this.earthGateway.crossing = {
      target: this.solarSystem.earth, direction: new THREE.Vector3(0, 0, 1), endpointDistance: 0.75,
    };
    this.earthGateway.intentCount = 0;
    // Registered destination ID; proximity alone never starts this journey.
    this.earthGateway.destinationTheme = "environment";
    this.gateways = [this.earthGateway];
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
    this.audioTraceUpdateCount = (this.audioTraceUpdateCount ?? 0) + 1;
    const time = state.time;
    const delta = this.lastUpdateTime === null
      ? 0
      : Math.min(Math.max(time - this.lastUpdateTime, 0), 0.1);
    this.lastUpdateTime = time;
    this.solarAudioInput = state.audio;
    this.solarAudioDelta = delta;
    // Journeys/BIRTH retain the natural S3 Sun. No audio enters a transition.
    const audioEnabled = !this.journeyDirector?.isActive() && !this.transitSystem?.active;
    this.solarSystem.update(delta, state.audio,
      this.journeyDirector?.cameraDirector?.camera, audioEnabled);
    if (import.meta.env.DEV) this.blobAuraReference?.update(state.audio, time);
  }

  getEnvironment() {
    // Environment is evaluated after gateway/journey updates, before rendering.
    if (import.meta.env.DEV) this.blobAuraReference?.syncVisibility();
    return { world: false, stars: false, portal: false, stage: true };
  }

  getHomePose() {
    return {
      position: new THREE.Vector3(10, 10, 48),
      lookTarget: new THREE.Vector3(10, 0, 0),
    };
  }

  getCameraFar() {
    return 320;
  }

  getGateways() {
    return this.gateways;
  }

  destroy() {
    this.earthGateway.enabled = false;
    this.earthGateway.target = null;
    this.earthGateway.crossing.target = null;
    if (this.journeyDirector?.gateways === this.gateways) {
      this.journeyDirector.setGateways([]);
      this.journeyDirector.gatewayReady = false;
      this.journeyDirector.onGatewayReady?.(false, null);
    }
    this.gateways.length = 0;
    this.audioTraceRelease?.();
    if (import.meta.env.DEV) this.blobAuraReference?.destroy();
    this.deepSpace.dispose();
    this.milkyWay.dispose();
    this.solarSystem.dispose();
    this.solarFolder?.destroy();
    this.audioFolder?.destroy();
    if (this.backgroundParticleField) {
      this.backgroundParticleField.visible = this.backgroundParticleFieldWasVisible;
    }
  }
}
