import GUI from "lil-gui";

// Plumbing only: schemas, runtime values and storage keys belong to each theme.
export class ThemeFlightControls {
  constructor(theme, config, context) {
    this.theme = theme;
    this.config = config;
    this.context = context;
    this.defaults = Object.freeze(Object.fromEntries(
      config.controls.map(([key]) => [key, theme.flight[key]]),
    ));
    this.settings = { ...this.defaults };
    if (config.runtime) this.apply(config.runtime);
    else this.load(false);
    config.runtime = { ...this.settings };
  }

  apply(values) {
    if (!values || typeof values !== "object" || Array.isArray(values)) return false;
    for (const [key, , min, max] of this.config.controls) {
      if (typeof values[key] !== "number" || !Number.isFinite(values[key])) continue;
      this.settings[key] = Math.max(min, Math.min(max, values[key]));
    }
    // Apply only declared, live engine parameters. Never mutate a camera pose.
    Object.assign(this.theme.flight, this.settings);
    this.config.runtime = { ...this.settings };
    this.gui?.controllersRecursive().forEach((controller) => controller.updateDisplay());
    return true;
  }

  save() {
    try {
      localStorage.setItem(this.config.storageKey, JSON.stringify({
        version: 1, settings: this.settings,
      }));
      this.context.notify?.(`${this.config.title}: flight saved`);
      return true;
    } catch (error) {
      this.context.notify?.("Flight save unavailable");
      console.warn("Flight save failed", error);
      return false;
    }
  }

  load(notify = true) {
    try {
      const raw = localStorage.getItem(this.config.storageKey);
      if (!raw) {
        if (notify) this.context.notify?.("No saved flight settings for this theme");
        return false;
      }
      const saved = JSON.parse(raw);
      if (saved?.version !== 1 || !this.apply(saved.settings)) {
        throw new Error("Invalid flight settings");
      }
      if (notify) this.context.notify?.(`${this.config.title}: flight loaded`);
      return true;
    } catch (error) {
      if (notify) this.context.notify?.("Flight load unavailable");
      console.warn("Flight load failed", error);
      return false;
    }
  }

  reset() {
    this.apply(this.defaults);
    this.context.notify?.(`${this.config.title}: flight defaults restored`);
  }

  createGUI() {
    if (this.gui) return this.gui;
    this.gui = new GUI({ title: `${this.config.title} — F = FEEL`, width: 340 });
    Object.assign(this.gui.domElement.style, {
      right: "auto", left: "12px", top: "12px", maxHeight: "calc(100vh - 24px)",
    });
    this.gui.domElement.dataset.flightGui = this.config.id;
    for (const [key, label, min, max, step] of this.config.controls) {
      this.gui.add(this.settings, key, min, max, step).name(label)
        .onChange(() => this.apply(this.settings));
    }
    const actions = this.gui.addFolder("This theme's settings");
    actions.add({ Save: () => this.save() }, "Save");
    actions.add({ Load: () => this.load() }, "Load");
    actions.add({ Reset: () => this.reset() }, "Reset").name("Reset to Defaults");
    this.diagnostics = this.theme.getFlightDiagnostics?.(this.context);
    if (this.diagnostics) {
      const folder = this.gui.addFolder("Galaxy diagnostics (read only)");
      for (const key of Object.keys(this.diagnostics)) {
        folder.add(this.diagnostics, key).disable();
      }
    }
    // Prevent panel events bubbling into world interaction. App's capture-phase
    // acceptance handlers also reject GUI targets before processing a click.
    // Let pointerup reach the existing window release handler so a flight
    // started on the canvas still stops when released over this panel.
    for (const type of ["pointerdown", "pointermove", "click", "wheel"]) {
      this.gui.domElement.addEventListener(type, (event) => event.stopPropagation());
    }
    this.gui.hide();
    return this.gui;
  }

  updateDiagnostics() {
    if (!this.diagnostics || this.gui?._hidden) return;
    Object.assign(this.diagnostics, this.theme.getFlightDiagnostics(this.context));
    this.gui.controllersRecursive().forEach((controller) => controller.updateDisplay());
  }

  disposeGUI() {
    this.gui?.destroy();
    this.gui = null;
    this.diagnostics = null;
  }
}
