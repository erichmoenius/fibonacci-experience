import * as THREE from "three";
import { CelestialStarfield } from "../systems/CelestialStarfield.js";
export class Renderer {
  constructor() {
    // ------------------------------------------------
    // SCENE + CAMERA
    // ------------------------------------------------

    this.scene = new THREE.Scene();
    this.celestialStarfield = new CelestialStarfield();

    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );

    this.camera.position.set(0, 0, 5);

    // ------------------------------------------------
    // WEBGL RENDERER
    // ------------------------------------------------

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ------------------------------------------------
    // RENDER TARGET (für Portal)
    // ------------------------------------------------

    this.renderTarget = new THREE.WebGLRenderTarget(
      window.innerWidth,
      window.innerHeight,
    );

    // ------------------------------------------------
    // CINEMATIC FADE
    // ------------------------------------------------

    this.fade = 0;
    this.fadeTarget = 0;
    this.fadeSpeed = 1;

    // ------------------------------------------------
    // CANVAS SETUP
    // ------------------------------------------------

    const canvas = this.renderer.domElement;

    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "auto";
    canvas.style.zIndex = "0";

    document.body.appendChild(canvas);

    // ------------------------------------------------
    // CINEMATIC CURTAIN
    // ------------------------------------------------

    this.fadeOverlay = document.createElement("div");

    this.fadeOverlay.style.position = "fixed";
    this.fadeOverlay.style.top = "0";
    this.fadeOverlay.style.left = "0";
    this.fadeOverlay.style.width = "100%";
    this.fadeOverlay.style.height = "100%";

    this.fadeOverlay.style.background = "black";

    this.fadeOverlay.style.pointerEvents = "none";

    this.fadeOverlay.style.opacity = "0";

    this.fadeOverlay.style.transition = "opacity 1s linear";

    this.fadeOverlay.style.zIndex = "9999";

    document.body.appendChild(this.fadeOverlay);

    // ------------------------------------------------
    // RESIZE
    // ------------------------------------------------

    window.addEventListener("resize", () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();

      this.renderer.setSize(w, h);
      this.renderTarget.setSize(w, h);
    });
  }
  // ------------------------------------------------
  // CINEMATIC FADE API
  // ------------------------------------------------

  fadeOut(duration = 1) {
    this.fadeOverlay.style.transition = `opacity ${duration}s linear`;

    this.fadeOverlay.style.opacity = "1";
  }

  fadeIn(duration = 1) {
    this.fadeOverlay.style.transition = `opacity ${duration}s linear`;

    this.fadeOverlay.style.opacity = "0";
  }

  isBlack() {
    return this.fade >= 0.99;
  }

  // ------------------------------------------------
  // RENDER PIPELINE
  // ------------------------------------------------

  renderScene() {
    if (!this.celestialStarfield.active) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const autoClear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    try {
      this.renderer.clear();
      this.celestialStarfield.render(this.renderer, this.camera);
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.camera);
    } finally {
      this.renderer.autoClear = autoClear;
    }
  }

  render() {
    console.log("RENDER");
    // PASS 1 → Scene in Texture (ohne Portal)
    if (this.portal) this.portal.mesh.visible = false;

    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.clear();
    this.renderScene();

    // PASS 2 → normale Szene
    if (this.portal) this.portal.mesh.visible = true;

    this.renderer.setRenderTarget(null);
    this.renderScene();
  }
}
