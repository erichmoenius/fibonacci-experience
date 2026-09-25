import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { FullScreenQuad, Pass } from "three/addons/postprocessing/Pass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import {
  PLANETARY_BLOOM_LAYER,
  PLANETARY_SELECTIVE_BLOOM,
} from "../config/PlanetarySelectiveBloomConfig.js";
import { CelestialStarfield } from "../systems/CelestialStarfield.js";

class SelectiveBloomScenePass extends Pass {
  constructor(owner) {
    super();
    this.owner = owner;
    this.needsSwap = false;
  }

  render(renderer, writeBuffer, readBuffer) {
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    renderer.clear();
    this.owner.renderBloomScene();
  }
}

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
    this.bloomCamera = this.camera.clone();
    this.bloomCamera.layers.set(PLANETARY_BLOOM_LAYER);

    // ------------------------------------------------
    // WEBGL RENDERER
    // ------------------------------------------------

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.bloomEnabled = false;
    this.bloomSettings = PLANETARY_SELECTIVE_BLOOM;
    this.bloomComposer = new EffectComposer(this.renderer);
    this.bloomComposer.renderToScreen = false;
    this.bloomComposer.addPass(new SelectiveBloomScenePass(this));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      this.bloomSettings.strength,
      this.bloomSettings.radius,
      this.bloomSettings.threshold,
    );
    this.bloomComposer.addPass(this.bloomPass);
    this.bloomComposite = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: {
        uBloomTexture: { value: this.bloomComposer.renderTarget2.texture },
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uBloomTexture;
        varying vec2 vUv;

        void main() {
          gl_FragColor = texture2D(uBloomTexture, vUv);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    }));

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
      this.bloomComposer.setSize(w, h);
    });
  }

  setBloomEnabled(enabled) {
    this.bloomEnabled = Boolean(enabled) && this.bloomSettings.enabled;
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

  renderBloomScene() {
    const autoClear = this.renderer.autoClear;
    this.bloomCamera.copy(this.camera, false);
    this.bloomCamera.layers.set(PLANETARY_BLOOM_LAYER);
    this.renderer.autoClear = false;
    try {
      this.renderer.clear();
      this.celestialStarfield.render(
        this.renderer,
        this.bloomCamera,
        1 << PLANETARY_BLOOM_LAYER,
      );
      this.renderer.clearDepth();
      this.renderer.render(this.scene, this.bloomCamera);
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
    if (!this.bloomEnabled) return;

    this.bloomComposer.render();
    this.renderer.setRenderTarget(null);
    const autoClear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.bloomComposite.render(this.renderer);
    this.renderer.autoClear = autoClear;
  }
}
