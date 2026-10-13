import { HUDTelemetry, cinematicSection } from "./DevHUDTelemetry.js";
export { formatCinematicTime } from "./DevHUDTelemetry.js";

export class DevHUD {
  constructor(app) {
    this.app = app;
    this.visible = false;
    this.mode = "COMPACT";
    this.lastUpdate = 0;
    this.lastText = "";
    this.sections = [];
    this.telemetry = new HUDTelemetry(app);
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
    if (this.visible) this.update(true);
  }

  toggleMode() {
    this.mode = this.mode === "COMPACT" ? "FULL" : "COMPACT";
    this.update(true);
  }

  update(force = false) {
    if (!this.visible) return;
    const now = performance.now(), full = this.mode === "FULL";
    const theme = this.app.themeManager.activeTheme;
    // Slow-changing readings/providers at 5 Hz; clocks remain frame-accurate.
    if (force || theme !== this.lastTheme || now - this.lastUpdate >= 200) {
      this.sections = this.telemetry.sections(full);
      this.lastTheme = theme;
      this.lastUpdate = now;
    }
    const sections = [...this.sections];
    const cinematic = cinematicSection(this.app, full);
    sections.splice(2, 0, cinematic);
    const lines = [`DEV HUD — ${this.mode} (Shift+D: mode)`, cinematic.timecode];
    for (const section of sections) {
      const rows = section.rows.filter(r => r && typeof r.label === "string" && (full || !r.fullOnly));
      if (!rows.length) continue;
      lines.push(`[${section.title}]`);
      for (const { label, value } of rows) {
        const prefix = `${label}:`;
        lines.push(`${prefix.padEnd(Math.max(14, prefix.length + 1))}${value ?? "-"}`);
      }
    }
    const text = lines.join("\n");
    if (text !== this.lastText) {
      this.element.textContent = text;
      this.lastText = text;
    }
  }
}
