import { measureMosaic, setMosaicGap } from "../systems/GalleryLayout.js";

/** Transient G-GUI controls. Lens magnification and angular tile spacing are
 * independent; this class never writes camera position or orientation. */
export class CitiesGalleryControls {
  constructor(gui, camera) {
    this.gui = gui;
    this.camera = camera;
    this.settings = { thumbnailSize: 100, gap: 0, effectiveGap: 0,
      reset: () => this.reset() };
    this.controllers = [];
  }

  enter(room) {
    if (this.disposed) return;
    this.room = room;
    this.baseZoom = this.camera.zoom;
    if (this.defaultGap === undefined) {
      this.defaultGap = measureMosaic(room.monitors).photoFreeFraction * 100;
      this.settings.gap = this.defaultGap;
    }
    if (this.gui && !this.folder) this.createGUI();
    this.applySize();
    this.applyGap();
    this.setVisible(true);
  }

  createGUI() {
    const folder = this.folder = this.gui.addFolder("Gallery / Cities");
    // The existing root Save/Load keeps its behavior. This folder deliberately
    // serializes no tuning values and ignores old/external gallery presets.
    folder.save = () => ({ controllers: {}, folders: {} });
    folder.load = () => folder;
    this.controllers.push(folder.add(this.settings, "thumbnailSize", 25, 150, 1)
      .name("Thumbnail Size (%)").onChange(() => this.applySize()));
    this.controllers.push(folder.add(this.settings, "gap", 0, 30, 0.1)
      .name("Gap (%)").onChange(() => this.applyGap()));
    this.controllers.push(folder.add(this.settings, "effectiveGap").name("Effective Gap (%)").disable());
    folder.add(this.settings, "reset").name("Reset Gallery Layout");
    this.controllers[0].domElement.title = "Gallery-only lens magnification. Does not resize or overlap photo meshes.";
    this.controllers[1].domElement.title = "Whole-sphere dark-area target. Zero retains a small safety seam around frames.";
    folder.open();
  }

  applySize() {
    if (!this.room || this.baseZoom === undefined) return;
    this.settings.thumbnailSize = Math.max(25, Math.min(150, Number(this.settings.thumbnailSize) || 100));
    const zoom = this.baseZoom * this.settings.thumbnailSize / 100;
    if (this.camera.zoom !== zoom) { this.camera.zoom = zoom; this.camera.updateProjectionMatrix(); }
    this.refresh();
  }

  applyGap() {
    if (!this.room) return;
    this.settings.gap = Math.max(0, Math.min(30, Number(this.settings.gap) || 0));
    this.settings.effectiveGap = setMosaicGap(this.room.monitors, this.settings.gap).photoFreeFraction * 100;
    this.room.group.updateWorldMatrix(true, true);
    this.refresh();
  }

  refresh() { this.controllers.forEach(controller => controller.updateDisplay()); }

  reset() {
    if (this.defaultGap === undefined) return;
    this.settings.thumbnailSize = 100;
    this.settings.gap = this.defaultGap;
    this.applySize(); this.applyGap();
  }

  setVisible(visible) {
    if (this.folder && this.visible !== visible) this.folder.show(visible);
    this.visible = visible;
  }

  leave() {
    if (this.baseZoom !== undefined) {
      if (this.camera.zoom !== this.baseZoom) {
        this.camera.zoom = this.baseZoom; this.camera.updateProjectionMatrix();
      }
      this.baseZoom = undefined;
    }
    this.room = null;
    this.setVisible(false);
  }

  dispose() {
    if (this.disposed) return;
    this.leave(); this.folder?.destroy(); this.disposed = true;
  }
}
