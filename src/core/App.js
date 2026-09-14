import * as THREE from "three";
import Stats from "stats.js";
import GUI from "lil-gui";

import { Renderer } from "../graphics/Renderer.js";
import { ShaderWorld } from "../graphics/ShaderWorld.js";
import { Starfield } from "../graphics/Starfield.js";
import { ThemeStage } from "../graphics/ThemeStage.js";

import { Loop } from "./Loop.js";

import { ScrollController } from "../engine/ScrollController.js";
import { ThemeManager } from "../engine/ThemeManager.js";

import { SeasonsTheme } from "../themes/SeasonsTheme.js";
import { MoviesTheme } from "../themes/MoviesTheme.js";
import { ImageTheme } from "../themes/ImageTheme.js";
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

    this.journeyDirector.onBirth = () => {
      console.log("✨ BIRTH");

      this.themeManager.activate("movies");

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

    this.themeManager.register("movies", MoviesTheme);

    this.themeManager.register("space", SpaceTheme);

    this.themeManager.register("images", ImageTheme);

    this.themeManager.register("seasons", SeasonsTheme);

    // ------------------------------------------------
    // 🚀 START THEME
    // ------------------------------------------------

    this.themeManager.activate("space");

    this.themeManager.activeTheme.journeyDirector = this.journeyDirector;

    this.themeManager.activeTheme.transitSystem = this.transitSystem;

    this.journeyDirector.setGateways(
      this.themeManager.activeTheme.getGateways(),
    );

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

    canvas.addEventListener(
      "pointerdown",

      () => {
        this.isBoosting = true;
      },
    );

    window.addEventListener(
      "pointerup",

      () => {
        this.isBoosting = false;
      },
    );
  }

  // ------------------------------------------------
  // 🖱️ MOUSE
  // ------------------------------------------------

  setupMouse() {
    window.addEventListener(
      "pointermove",

      (e) => {
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

        if (e.code === "Digit1") {
          this.cameraDirector.cancel();
          this.journeyDirector.stop();

          this.themeManager.activate("movies");

          this.initializeActiveTheme();

          this.journeyDirector.setGateways(
            this.themeManager.activeTheme.getGateways(),
          );
        }

        if (e.code === "Digit2") {
          this.themeManager.activate("space");

          this.initializeActiveTheme();

          this.journeyDirector.setGateways(
            this.themeManager.activeTheme.getGateways(),
          );
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
          this.cameraDirector.returnHome();

          this.journeyDirector.stop();
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

  initializeActiveTheme() {
    const theme = this.themeManager.activeTheme;

    if (!theme) return;

    theme.journeyDirector = this.journeyDirector;

    theme.transitSystem = this.transitSystem;

    this.exploreDirector.setTheme(theme);
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

    if (this.stars?.points) {
      this.stars.points.visible = env.stars ?? true;
    }

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
