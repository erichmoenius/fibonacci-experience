import * as THREE from "three";

export class DevHUD {
  constructor(app) {
    this.app = app;
    this.visible = false;
    this.lastUpdate = 0;
    this.coreWorldPosition = new THREE.Vector3();

    this.element = document.createElement("pre");
    this.element.setAttribute("aria-hidden", "true");
    this.element.style.cssText = [
      "position:fixed",
      "top:90px",
      "left:12px",
      "z-index:1000",
      "margin:0",
      "padding:8px 10px",
      "background:rgba(0,0,0,.58)",
      "border:1px solid rgba(90,220,130,.7)",
      "border-radius:3px",
      "box-shadow:0 0 6px rgba(70,210,110,.2)",
      "color:rgba(120,235,145,.95)",
      "font:12px/1.45 monospace",
      "white-space:pre",
      "pointer-events:none",
      "display:none",
    ].join(";");

    document.body.appendChild(this.element);
  }

  toggle() {
    this.visible = !this.visible;
    this.element.style.display = this.visible ? "block" : "none";

    if (this.visible) {
      this.lastUpdate = 0;
      this.update(true);
    }
  }

  update(force = false) {
    if (!this.visible) return;

    const now = performance.now();
    if (!force && now - this.lastUpdate < 200) return;

    this.lastUpdate = now;

    const {
      cameraDirector,
      journeyDirector,
      themeManager,
      armedGateway,
    } = this.app;
    const themeName = themeManager.activeThemeName ?? "-";
    const theme = themeManager.activeTheme;
    const core = theme?.engine?.core?.object;

    let coreDistance = "-";
    if (core) {
      core.getWorldPosition(this.coreWorldPosition);
      coreDistance = cameraDirector.position
        .distanceTo(this.coreWorldPosition)
        .toFixed(2);
    }

    const journey = journeyDirector.isActive()
      ? journeyDirector.getPhase()
      : "-";

    this.element.textContent = [
      "DEV HUD",
      `Theme:        ${themeName.toUpperCase()}`,
      `Camera:       ${cameraDirector.mode.toUpperCase()}`,
      `FreeFlight:   ${cameraDirector.freeFlight.active ? "ON" : "OFF"}`,
      `Core dist:    ${coreDistance}`,
      `Gateway:      ${journeyDirector.gatewayReady ? "READY" : "-"}`,
      `Armed:        ${armedGateway ? "YES" : "NO"}`,
      `Journey:      ${journey}`,
    ].join("\n");
  }
}