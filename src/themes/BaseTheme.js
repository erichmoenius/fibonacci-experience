import { ThemeFlightControls } from "../ui/ThemeFlightControls.js";

export class BaseTheme {
  constructor(container, app) {
    this.container = container;
    this.app = app;
  }

  initializeFlightControls(context) {
    this.flightControls = new ThemeFlightControls(this, this.getFlightGUIConfig(), context);
  }

  createFlightGUI() { return this.flightControls.createGUI(); }
  getFlightSettings() { return { ...this.flightControls.settings }; }
  applyFlightSettings(values) { return this.flightControls.apply(values); }
  saveFlightSettings() { return this.flightControls.save(); }
  loadFlightSettings(notify = true) { return this.flightControls.load(notify); }
  resetFlightSettings() { this.flightControls.reset(); }
  disposeFlightGUI() { this.flightControls?.disposeGUI(); }
  updateFlightGUI() { this.flightControls?.updateDiagnostics(); }

  // Optional synchronous, read-only HUD provider. Return sections shaped as:
  // [{ title: "Section", rows: [{ label: "Value", value: "text", fullOnly: false }] }].
  // Called only while the HUD is visible, at most 5 Hz except explicit refreshes.
  // context supplies full, cameraPosition, formatTime, worldPosition(object),
  // objectViewState(object), isGatewayRegistered(gateway). Do not mutate state.
  getDevDiagnostics(_context) { return []; }

  init() {}

  update(state) {}

  updateCamera(camera, state) {}

  getEnvironment() {
    return {};
  }

  destroy() {}
}
