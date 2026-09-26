import * as THREE from "three";
import Stats from "stats.js";
import GUI from "lil-gui";

import { Renderer } from "../graphics/Renderer.js";
import { ShaderWorld } from "../graphics/ShaderWorld.js";
import { Starfield } from "../graphics/Starfield.js";
import { ThemeStage } from "../graphics/ThemeStage.js";

import { Loop } from "./Loop.js";
import { DevHUD } from "./DevHUD.js";

import { ScrollController } from "../engine/ScrollController.js";
import { ThemeManager } from "../engine/ThemeManager.js";

import { GalaxyTheme } from "../themes/GalaxyTheme.js";
import { PlanetaryTheme } from "../themes/PlanetaryTheme.js";
import { EnvironmentTheme } from "../themes/EnvironmentTheme.js";
import { HumanTheme } from "../themes/HumanTheme.js";
import { MolecularTheme } from "../themes/MolecularTheme.js";
import { MoviesTheme } from "../themes/MoviesTheme.js";
import { SpaceTheme } from "../themes/SpaceTheme.js";

import { createParticleField } from "../particles/ParticleField.js";
import { createParticleMaterial } from "../particles/ParticleShader.js";

import AudioManager from "../audio/AudioManager.js";

import { ExploreDirector } from "../systems/cinematic/ExploreDirector.js";
import { InteractionManager } from "../interactions/InteractionManager.js";
import CameraDirector, {
  CameraMode,
} from "../systems/cinematic/CameraDirector.js";
import JourneyDirector from "../systems/cinematic/JourneyDirector.js";
import TransitSystem from "../systems/transit/TransitSystem.js";

export class App {
  constructor() {
    // ------------------------------------------------
    // 🎬 CORE
    // ------------------------------------------------

    this.renderer = new Renderer();

    this.scene = this.renderer.scene;
    this.camera = this.renderer.camera;

    this.activeGateway = null;

    this.armedGateway = null;

    this.acceptanceRaycaster = new THREE.Raycaster();

    this.acceptancePointer = new THREE.Vector2();

    this.acceptanceClick = {
      pointerId: null,
      startX: 0,
      startY: 0,
      moved: false,
    };

    // ------------------------------------------------
    // 🎬 CINEMATIC CAMERA
    // ------------------------------------------------

    this.cameraDirector = new CameraDirector(
      this.camera,
      this.renderer.renderer.domElement,
    );

    this.cameraDirector.onReturnHome = () => {
      this.loadGUISettings();
    };

    this.exploreDirector = new ExploreDirector(this.cameraDirector);

    this.journeyDirector = new JourneyDirector(this.cameraDirector);

    this.journeyDirector.onApproach = (coreObject) => {
      this.cameraDirector.beginCoreApproach(coreObject);
    };

    this.journeyDirector.onHorizon = (coreObject) => {
      this.cameraDirector.beginCoreHorizon(coreObject);
    };

    this.journeyDirector.onSingularity = (crossing) => {
      this.cameraDirector.beginCrossing(crossing);
    };

    this.transitSystem = new TransitSystem();

    this.cameraDirector.journeyDirector = this.journeyDirector;

    this.cameraDirector.onFlightFinished = () => {
      console.log("🎬 App: Flight complete");
    };

    this.journeyDirector.onTransit = (type) => {
      console.log("🌌 Transit requested:", type);

      this.transitSystem.start(type);
    };

    // ------------------------------------------------
    //
    // 🧡 GATEWAY INVITATION
    //
    // ------------------------------------------------

    this.journeyDirector.onGatewayReady = (ready, gateway) => {
      console.log(ready ? "🧡 APP — INVITATION ON" : "🖤 APP — INVITATION OFF");

      if (ready) {
        this.activeGateway = gateway;
        this.armedGateway = gateway;
      } else {
        this.activeGateway = null;
      }

      const theme = this.themeManager.activeTheme;

      theme?.engine?.setInvitation(ready);
    };

    this.journeyDirector.onTransitEnd = () => {
      console.log("🌌 Transit ended");

      this.transitSystem.stop();
    };

    this.journeyDirector.onJourneyFinished = () => {
      console.log("🌌 EXPLORE");

      this.cameraDirector.finishTravel();
    };

    this.journeyDirector.onVoidStart = () => {
      console.log("🌑 VOID");

      this.renderer.fadeOut(1);
    };

    this.journeyDirector.onBirth = (destinationTheme) => {
      console.log("✨ BIRTH");

      if (
        !destinationTheme ||
        !this.themeManager.themes.has(destinationTheme)
      ) {
        console.error(
          "Journey destination theme is unavailable:",
          destinationTheme,
        );
        return;
      }

      this.themeManager.activate(destinationTheme);
      this.applyActiveThemeFlight();
      this.activeGateway = null;
      this.armedGateway = null;
      this.journeyDirector.setGateways(
        this.themeManager.activeTheme.getGateways(),
      );

      const pose = this.themeManager.activeTheme?.getHomePose();

      if (pose) {
        this.cameraDirector.travel(pose);
      }

      this.renderer.fadeIn(3);
    };

    console.log("🎬 Cinematic system initialized");

    this.renderer.portal = null;

    // ------------------------------------------------
    // 🎛️ GUI
    // ------------------------------------------------

    this.gui = new GUI();

    this.gui.title("Hero Core");

    // ------------------------------------------------
    // 🎧 AUDIO
    // ------------------------------------------------

    this.audio = new AudioManager();

    window.addEventListener(
      "pointerdown",
      async () => {
        console.log("🎤 Initializing audio...");

        await this.audio.init();
      },
      { once: true },
    );

    window.audio = this.audio;

    // ------------------------------------------------
    // 🔓 AUDIO UNLOCK
    // ------------------------------------------------

    window.addEventListener(
      "pointerdown",

      async () => {
        try {
          if (
            this.audio.audioContext &&
            this.audio.audioContext.state === "suspended"
          ) {
            await this.audio.audioContext.resume();

            console.log("🔓 AudioContext resumed");
          }
        } catch (err) {
          console.error(err);
        }
      },

      { once: true },
    );

    // ------------------------------------------------
    // 🌍 ENVIRONMENT
    // ------------------------------------------------

    this.world = new ShaderWorld(this.scene);

    this.stars = new Starfield(this.scene);

    this.stage = new ThemeStage(this.scene);

    // ------------------------------------------------
    // 🧠 ENGINE
    // ------------------------------------------------

    this.scroll = new ScrollController();

    // ------------------------------------------------
    // 🎨 THEMES
    // ------------------------------------------------

    this.themeManager = new ThemeManager(
      this.stage.getContent(),

      this.gui,
    );

    this.themeManager.register("space", SpaceTheme);
    this.themeManager.register("galaxy", GalaxyTheme);
    this.themeManager.register("planetary", PlanetaryTheme);
    this.themeManager.register("environment", EnvironmentTheme);
    this.themeManager.register("human", HumanTheme);
    this.themeManager.register("molecular", MolecularTheme);
    this.themeManager.register("movies", MoviesTheme);

    // ------------------------------------------------
    // 🚀 START THEME
    // ------------------------------------------------

    this.themeManager.activate("space");
    this.applyActiveThemeFlight();

    this.themeManager.activeTheme.journeyDirector = this.journeyDirector;

    this.themeManager.activeTheme.transitSystem = this.transitSystem;

    this.journeyDirector.setGateways(
      this.themeManager.activeTheme.getGateways(),
    );

    this.devHUD = new DevHUD(this);

    // ------------------------------------------------
    // ✨ PARTICLES
    // ------------------------------------------------

    this.setupParticles();

    // ------------------------------------------------
    // 🖱️ INTERACTION
    // ------------------------------------------------

    this.interactionManager = new InteractionManager(
      document.getElementById("hero-root"),

      this.gui,
    );

    this.interactionManager.setMode("off");

    // ------------------------------------------------
    // 🖱️ INPUT
    // ------------------------------------------------

    this.isBoosting = false;

    this.intensity = 0;

    // ------------------------------------------------
    // 🖱️ MOUSE
    // ------------------------------------------------

    this.mouse = {
      x: 0,
      y: 0,
    };

    this.parallax = {
      x: 0,
      y: 0,
    };

    this.mouseVel = {
      x: 0,
      y: 0,
    };

    this.flight = {
      x: 0,
      y: 0,
      z: 0,
    };

    this.wheel = {
      delta: 0,
    };

    // ------------------------------------------------
    // 🎬 CINEMATIC
    // ------------------------------------------------

    this.cinematic = {
      parallaxStrength: 0.25,

      masterBoost: 1.0,

      flightSpeed: 0.05,

      flightDamping: 0.92,

      idleCameraMotion: 0.2,
    };

    // ------------------------------------------------
    // ⏱️ TIME
    // ------------------------------------------------

    this.time = 0;

    // ------------------------------------------------
    // ⚙️ SETUP
    // ------------------------------------------------

    this.setupInput();
    this.setupMouse();
    this.setupThemeSwitching();
    this.setupGui();

    // ------------------------------------------------
    // 📊 STATS
    // ------------------------------------------------

    this.stats = new Stats();

    document.body.appendChild(this.stats.dom);

    // ------------------------------------------------
    // 🔁 LOOP
    // ------------------------------------------------

    this.loop = new Loop(
      this.update.bind(this),

      this.renderer.render.bind(this.renderer),
    );

    this.loop.start();
  }

  // ------------------------------------------------
  // 🎛️ GUI
  // ------------------------------------------------

  setupGui() {
    // ------------------------------------------------
    // 🎬 CAMERA
    // ------------------------------------------------

    const cinematic = this.gui.addFolder("🎬 Cinematic");

    cinematic.add(this.cinematic, "parallaxStrength", 0, 1, 0.01);

    cinematic.add(this.cinematic, "masterBoost", 0, 3, 0.01);

    // ------------------------------------------------
    // 🎧 AUDIO
    // ------------------------------------------------

    const audioFolder = this.gui.addFolder("🎧 Audio");

    audioFolder
      .add(this.audio, "smoothing", 0.01, 0.95, 0.01)
      .onChange((value) => {
        if (this.audio.analyser) {
          this.audio.analyser.smoothingTimeConstant = value;
        }
      });

    audioFolder.open();

    // ------------------------------------------------
    // 💾 SETTINGS
    // ------------------------------------------------

    const saveFolder = this.gui.addFolder("💾 Settings");

    saveFolder.add(
      {
        save: () => {
          this.saveGUISettings();
        },
      },
      "save",
    );

    saveFolder.add(
      {
        load: () => {
          this.loadGUISettings();
        },
      },
      "load",
    );

    audioFolder.open();
  }

  // ------------------------------------------------
  // ✨ PARTICLES
  // ------------------------------------------------

  setupParticles() {
    const geo = createParticleField(6000);

    const mat = createParticleMaterial();

    this.points = new THREE.Points(
      geo.geometry,

      mat,
    );

    this.material = mat;

    this.scene.add(this.points);
  }

  // ------------------------------------------------
  // 🖱️ INPUT
  // ------------------------------------------------

  setupInput() {
    const canvas = this.renderer.renderer.domElement;

    window.addEventListener(
      "pointerdown",
      (event) => {
        if (!this.acceptReadyProximityGateway(event)) return;

        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );

    canvas.addEventListener(
      "pointerdown",

      () => {
        this.isBoosting = true;
      },
    );

    window.addEventListener(
      "pointerup",

      (event) => {
        this.isBoosting = false;

        this.evaluateCoreAcceptance(event);
      },
    );

    window.addEventListener("pointercancel", () => {
      this.resetAcceptanceClick();
    });

    window.addEventListener("blur", () => {
      this.resetAcceptanceClick();
    });
  }

  // ------------------------------------------------
  // 🖱️ MOUSE
  // ------------------------------------------------

  setupMouse() {
    window.addEventListener(
      "pointermove",

      (e) => {
        this.trackAcceptanceMovement(e);

        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;

        const nx = (x - 0.5) * 2;
        const ny = (y - 0.5) * 2;

        this.mouseVel.x = nx - this.mouse.x;
        this.mouseVel.y = ny - this.mouse.y;

        this.mouse.x = nx;
        this.mouse.y = ny;

        console.log(
          "mouse",
          this.mouse.x,
          this.mouse.y,
          "scroll",
          window.scrollY,
        );
      },
    );

    window.addEventListener("pointerdown", (event) => {
      this.beginAcceptanceClick(event);
    });

    // TEMP DEBUG
    window.addEventListener(
      "pointerdown",

      (e) => {
        console.log("🖱️ APP POINTER DOWN", e.pointerType, e.clientX, e.clientY);
      },
    );

    window.addEventListener(
      "wheel",

      (e) => {
        this.wheel.delta += e.deltaY * 0.001;
      },
    );

    // Journey LMB temporarily disabled
    //
    // IMPORTANT:
    // Do not restore this yet.
    // We are testing FreeFlight first.

    // TEMP DEBUG
    window.addEventListener(
      "pointerdown",

      (e) => {
        if (e.button !== 0) return;

        console.log("🖱️ LMB → FreeFlight");
      },
    );
  }

  beginAcceptanceClick(event) {
    if (event.button !== 0) return;

    this.acceptanceClick.pointerId = event.pointerId;
    this.acceptanceClick.startX = event.clientX;
    this.acceptanceClick.startY = event.clientY;
    this.acceptanceClick.moved = false;
  }

  acceptReadyProximityGateway(event) {
    const journeyGateway = this.activeGateway;

    if (
      event.button !== 0 ||
      this.themeManager.activeThemeName !== "galaxy" ||
      !this.journeyDirector.gatewayReady ||
      journeyGateway !== this.armedGateway ||
      journeyGateway?.acceptanceMode !== "proximity-lmb" ||
      !journeyGateway.journey ||
      this.journeyDirector.isActive()
    )
      return false;

    console.log("JOURNEY_ACCEPTED: gateway proximity");

    this.isBoosting = false;
    this.resetAcceptanceClick();
    this.beginGatewayJourney(journeyGateway);

    return true;
  }

  trackAcceptanceMovement(event) {
    if (event.pointerId !== this.acceptanceClick.pointerId) return;

    const dx = event.clientX - this.acceptanceClick.startX;
    const dy = event.clientY - this.acceptanceClick.startY;
    const threshold = this.cameraDirector.freeFlight.dragThreshold;

    if ((event.buttons & 1) === 0) return;

    if (Math.hypot(dx, dy) >= threshold) {
      this.acceptanceClick.moved = true;
    }
  }

  evaluateCoreAcceptance(event) {
    const click = this.acceptanceClick;
    const threshold = this.cameraDirector.freeFlight.dragThreshold;
    const theme = this.themeManager.activeTheme;
    const innerCore = theme?.engine?.core?.innerCore;
    const journeyGateway = this.armedGateway;
    const acceptsProximityClick =
      journeyGateway?.acceptanceMode === "proximity-lmb";
    const canvas = this.renderer.renderer.domElement;
    const bounds = canvas.getBoundingClientRect();

    try {
      if (
        event.pointerId !== click.pointerId ||
        click.moved ||
        event.buttons !== 0 ||
        !journeyGateway?.journey ||
        this.journeyDirector.isActive() ||
        !bounds.width ||
        !bounds.height
      )
        return;

      const movementDistance = Math.hypot(
        event.clientX - click.startX,
        event.clientY - click.startY,
      );

      if (movementDistance > threshold) return;

      if (acceptsProximityClick) {
        return;
      } else {
        if (!innerCore?.visible) return;

        this.acceptancePointer.set(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
        );

        this.acceptanceRaycaster.setFromCamera(
          this.acceptancePointer,
          this.camera,
        );

        const hits = this.acceptanceRaycaster.intersectObject(innerCore, false);

        if (!hits.length) return;

        console.log("JOURNEY_ACCEPTED: engine core");
      }

      this.beginGatewayJourney(journeyGateway);
    } finally {
      this.resetAcceptanceClick();
    }
  }

  beginGatewayJourney(journeyGateway) {
    const journey = journeyGateway.journey;

    this.disarmArmedInvitation();

    this.cameraDirector.beginJourney(journey);

    this.journeyDirector.begin(
      journey,
      journeyGateway.target,
      journeyGateway.crossing,
      journeyGateway.destinationTheme,
    );
  }

  resetAcceptanceClick() {
    this.acceptanceClick.pointerId = null;
    this.acceptanceClick.startX = 0;
    this.acceptanceClick.startY = 0;
    this.acceptanceClick.moved = false;
  }

  disarmArmedInvitation() {
    this.armedGateway = null;
  }

  // ------------------------------------------------
  // 🎬 THEME SWITCHING
  // ------------------------------------------------

  setupThemeSwitching() {
    window.addEventListener(
      "keydown",

      (e) => {
        console.log("Key:", e.code);
        console.log("Camera mode:", this.cameraDirector.mode);
        console.log("Journey active:", this.journeyDirector.isActive());

        if (e.code === "KeyD" && !e.repeat) {
          this.devHUD.toggle();
        }

        const developmentThemes = {
          Digit1: "space",
          Digit2: "galaxy",
          Digit3: "planetary",
          Digit4: "environment",
          Digit5: "human",
          Digit6: "molecular",
          Digit7: "movies",
        };

        const themeName = developmentThemes[e.code];
        if (themeName) {
          this.switchDevelopmentTheme(themeName);
          return;
        }

        if (e.code === "Digit8") {
          this.renderer.fadeOut(1);
        }

        if (e.code === "Digit9") {
          this.renderer.fadeIn(4);
        }

        // TEMP DEBUG
        if (e.code === "KeyI") {
          const engine = this.themeManager.activeTheme?.engine;

          if (engine?.object) {
            this.cameraDirector.inspect(engine.getInspectionPose());
          }
        }

        // TEMP DEBUG
        if (e.code === "Escape") {
          const homePose = this.themeManager.activeTheme?.getHomePose?.();
          this.cameraDirector.returnHome(homePose);

          this.journeyDirector.stop();
          this.disarmArmedInvitation();
        }

        // TEMP DEBUG
        if (e.code === "KeyT") {
          console.log("T pressed");

          const pose =
            this.themeManager.activeTheme?.engine?.getInspectionPose();

          console.log("Inspection pose:", pose);

          if (pose) {
            this.cameraDirector.flightStyle = "linear";
            this.cameraDirector.travel(pose);
          }
        }

        if (e.code === "KeyG") {
          console.log("G pressed");

          const pose =
            this.themeManager.activeTheme?.engine?.getInspectionPose();

          console.log("Inspection pose:", pose);

          if (pose) {
            this.cameraDirector.flightStyle = "gravity";
            this.cameraDirector.travel(pose);
          }
        }
      },
    );
  }

  switchDevelopmentTheme(themeName) {
    this.cameraDirector.cancel();
    this.cameraDirector.finishTravel();
    this.journeyDirector.stop();
    this.transitSystem.stop();
    this.journeyDirector.gatewayReady = false;
    this.activeGateway = null;
    this.disarmArmedInvitation();

    this.themeManager.activate(themeName);
    this.applyActiveThemeFlight();
    this.initializeActiveTheme();
    this.journeyDirector.setGateways(
      this.themeManager.activeTheme.getGateways(),
    );

    const pose = this.themeManager.activeTheme.getHomePose?.();
    this.cameraDirector.returnHome(pose, true);
  }

  initializeActiveTheme() {
    const theme = this.themeManager.activeTheme;

    if (!theme) return;

    theme.journeyDirector = this.journeyDirector;

    theme.transitSystem = this.transitSystem;
  }

  applyActiveThemeFlight() {
    this.cameraDirector.setExploreTravel(this.themeManager.activeTheme?.flight ?? null);
  }

  // ------------------------------------------------
  // 🧠 STATE
  // ------------------------------------------------

  buildState() {
    const audio = this.audio.getState();

    // 🔥 DEBUG
    console.log(audio);

    return {
      progress: this.scroll.getProgress(),

      intensity: this.intensity,

      time: this.time,

      travelerPosition: this.cameraDirector.position,

      mouse: this.mouse,

      parallax: this.parallax,

      flight: this.flight,

      wheel: this.wheel,

      audio,
    };
  }

  // ------------------------------------------------
  // 🌍 ENVIRONMENT
  // ------------------------------------------------

  updateEnvironment() {
    const theme = this.themeManager.activeTheme;

    const env = theme?.getEnvironment ? theme.getEnvironment() : {};

    this.world.setActive(env.world ?? true);

    this.renderer.celestialStarfield.setTheme(this.themeManager.activeThemeName);
    this.renderer.setBloomEnabled(this.themeManager.activeThemeName === "planetary");
    // CelestialStarfield is only the distant sky. Themes may keep the legacy
    // local field in front of it; themes without the celestial sky retain the
    // legacy behavior by default.
    this.stars.setVisible(
      env.legacyStars ?? !this.renderer.celestialStarfield.active,
    );

    if (this.stage?.mesh) {
      this.stage.mesh.visible = env.stage ?? true;
    }
  }

  // ------------------------------------------------
  // 💾 SAVE GUI
  // ------------------------------------------------

  saveGUISettings() {
    const data = this.gui.save();

    const key = `hero-core-gui-${this.themeManager.activeThemeName}`;

    localStorage.setItem(key, JSON.stringify(data));

    console.log("💾 GUI saved");

    this.showNotification("💾 GUI Saved");
  }

  // ------------------------------------------------
  // 📂 LOAD GUI
  // ------------------------------------------------

  loadGUISettings() {
    const key = `hero-core-gui-${this.themeManager.activeThemeName}`;

    const raw = localStorage.getItem(key);

    if (!raw) return;

    try {
      const data = JSON.parse(raw);

      this.gui.load(data);

      console.log("📂 GUI loaded");

      this.showNotification("📂 GUI Loaded");
    } catch (err) {
      console.error(err);
    }
  }

  // ------------------------------------------------
  // 🔔 NOTIFICATION
  // ------------------------------------------------

  showNotification(text) {
    const old = document.getElementById("hero-notification");

    if (old) {
      old.remove();
    }

    const div = document.createElement("div");

    div.id = "hero-notification";

    div.textContent = text;

    div.style.position = "fixed";

    div.style.top = "20px";

    div.style.right = "20px";

    div.style.padding = "12px 18px";

    div.style.background = "rgba(0,0,0,0.75)";

    div.style.color = "#fff";

    div.style.borderRadius = "8px";

    div.style.zIndex = "99999";

    div.style.fontFamily = "sans-serif";

    document.body.appendChild(div);

    setTimeout(() => {
      div.remove();
    }, 2000);
  }

  // ------------------------------------------------
  // 🎥 CAMERA
  // ------------------------------------------------

  updateCamera() {
    this.cameraDirector.setParallax(
      this.mouse,
      this.cinematic.parallaxStrength,
    );

    if (this.cameraDirector.isMode(CameraMode.TRAVEL)) return;

    this.cameraDirector.setLookTarget(2.8, 0, -8);
  }

  // =====================================================
  // 🎬 HERO CORE FRAME CONTRACT
  //
  // Every frame MUST execute these phases:
  //
  // 1. INPUT
  //    Mouse, keyboard, wheel, audio, scroll
  //
  // 2. STATE
  //    Build shared immutable state
  //
  // 3. CAMERA
  //    CameraDirector receives input and updates camera
  //
  // 4. WORLD
  //    Environment, world systems, stars, gateways
  //
  // 5. THEME
  //    Active theme receives state
  //
  // 6. UI
  //    Debug GUI, Stats
  //
  // Never remove an entire phase.
  // Move responsibilities INSIDE a phase only.
  // =====================================================

  // ------------------------------------------------
  // 🔄 UPDATE
  // ------------------------------------------------

  update() {
    this.stats.begin();

    // ------------------------------------------------
    // ⏱️ TIME
    // ------------------------------------------------

    this.time = performance.now() * 0.001;

    // ------------------------------------------------
    // 🧠 SYSTEMS
    // ------------------------------------------------

    this.scroll.updateScroll();

    // ------------------------------------------------
    // ⚡ INTENSITY
    // ------------------------------------------------

    const target = this.isBoosting ? 1 : 0;

    this.intensity += (target - this.intensity) * 0.08;

    this.intensity = THREE.MathUtils.clamp(this.intensity, 0, 1);

    const state = this.buildState();

    this.interactionManager.update(state);

    this.updateCamera();

    this.cameraDirector.update();

    this.exploreDirector.update(0.016);

    this.journeyDirector.update(this.cameraDirector.getPosition());

    this.transitSystem.update(0.016);

    this.updateEnvironment();

    this.themeManager.update(state);

    this.devHUD.update();

    // ------------------------------------------------
    // ✨ PARTICLES
    // ------------------------------------------------

    this.points.rotation.y += 0.0003 + this.intensity * 0.001;

    this.points.rotation.x = Math.sin(this.time * 0.1) * 0.03;

    if (this.material?.uniforms?.uTime) {
      this.material.uniforms.uTime.value += 0.01;
    }

    // ------------------------------------------------
    // 🖱️ RESET
    // ------------------------------------------------

    this.wheel.delta = 0;

    // ------------------------------------------------
    // 📊 END STATS
    // ------------------------------------------------

    this.stats.end();
  }
}
