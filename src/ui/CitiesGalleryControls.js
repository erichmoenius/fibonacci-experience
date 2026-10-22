import { DEFAULT_GALLERY_RADIUS, MIN_GALLERY_RADIUS, MAX_GALLERY_RADIUS, measureMosaic, setMosaicGap, setMosaicRadius } from "../systems/GalleryLayout.js";

/** Existing Cities tuning lab, configurable for other gallery destinations. Lens magnification and angular tile spacing are
 * independent; this class never writes camera position or orientation. */
export class CitiesGalleryControls {
  constructor(gui, camera, { name = "Cities", radiusControl = true } = {}) {
    this.name = name;
    this.radiusControl = radiusControl;
    this.gui = gui;
    this.camera = camera;
    this.settings = { thumbnailSize: 100, gap: 0, effectiveGap: 0,
      ...(radiusControl ? { sphereRadius: DEFAULT_GALLERY_RADIUS } : {}),
      reset: () => this.reset() };
    this.controllers = [];
    // Register before the root Settings Load, even before the room exists.
    if (this.gui) this.createGUI();
    this.setVisible(false);
  }

  enter(room) {
    if (this.disposed) return;
    this.room = room;
    this.baseZoom = this.camera.zoom;
    if (this.defaultGap === undefined) {
      this.defaultGap = measureMosaic(room.monitors).photoFreeFraction * 100;
      if (!this.gapConfigured) this.settings.gap = this.defaultGap;
    }
    if (this.gui && !this.folder) this.createGUI();
    this.applySize();
    this.applyGap();
    this.applyRadius();
    this.setVisible(true);
  }

  createGUI() {
    const folder = this.folder = this.gui.addFolder("Gallery / " + this.name);
    // Keep lil-gui's native controller-name schema in the existing theme save.
    const save = folder.save.bind(folder), load = folder.load.bind(folder);
    folder.save = (...args) => {
      const data = save(...args);
      delete data.controllers["Effective Gap (%)"];
      // Before first entry an untouched gap has not yet been measured.
      if (!this.gapConfigured) delete data.controllers["Gap (%)"];
      return data;
    };
    folder.load = (data) => {
      // lil-gui skips onChange when a saved zero equals the initial value.
      if (Object.hasOwn(data.controllers ?? {}, "Gap (%)")) this.gapConfigured = true;
      return load({ ...data, controllers: {
        ...(this.radiusControl ? { "Sphere Radius (units)": DEFAULT_GALLERY_RADIUS } : {}), ...data.controllers,
      } });
    };
    this.controllers.push(folder.add(this.settings, "thumbnailSize", 25, 150, 1)
      .name("Thumbnail Size (%)").onChange(() => this.applySize()));
    this.controllers.push(folder.add(this.settings, "gap", 0, 30, 0.1)
      .name("Gap (%)").onChange(() => this.applyGap()));
    if (this.radiusControl) {
      const radius = folder.add(this.settings, "sphereRadius", MIN_GALLERY_RADIUS, MAX_GALLERY_RADIUS, 0.1)
        .name("Sphere Radius (units)").onChange(() => this.applyRadius());
      radius.domElement.title = "Center-to-photo distance in world units; photo dimensions stay fixed. Larger Radius makes photos appear smaller. Minimum 10 prevents dense-mosaic overlaps.";
      this.controllers.push(radius);
    }
    this.controllers.push(folder.add(this.settings, "effectiveGap").name("Effective Gap (%)").disable());
    folder.add(this.settings, "reset").name("Reset Gallery Layout");
    this.controllers[0].domElement.title = "Gallery-only lens magnification. Does not resize or overlap photo meshes.";
    this.controllers[1].domElement.title = this.radiusControl
      ? "Dark-area target at radius 10. Larger Radius increases actual gaps; Effective Gap reports them. Zero retains frame clearance."
      : "Whole-sphere dark-area target. Zero retains a small safety seam around frames.";
    folder.open();
  }

  applySize() {
    this.settings.thumbnailSize = Math.max(25, Math.min(150, Number(this.settings.thumbnailSize) || 100));
    if (!this.room || this.baseZoom === undefined) return;
    const zoom = this.baseZoom * this.settings.thumbnailSize / 100;
    if (this.camera.zoom !== zoom) { this.camera.zoom = zoom; this.camera.updateProjectionMatrix(); }
    this.refresh();
  }

  applyGap() {
    this.gapConfigured = true;
    this.settings.gap = Math.max(0, Math.min(30, Number(this.settings.gap) || 0));
    if (!this.room) return;
    this.settings.effectiveGap = setMosaicGap(this.room.monitors, this.settings.gap).photoFreeFraction * 100;
    this.room.group.updateWorldMatrix(true, true);
    this.refresh();
  }

  applyRadius() {
    if (!this.radiusControl) return;
    const value = this.settings.sphereRadius;
    this.settings.sphereRadius = Number.isFinite(value)
      ? Math.max(MIN_GALLERY_RADIUS, Math.min(MAX_GALLERY_RADIUS, value)) : DEFAULT_GALLERY_RADIUS;
    if (this.room) {
      setMosaicRadius(this.room.monitors, this.settings.sphereRadius);
      this.settings.effectiveGap = measureMosaic(this.room.monitors).photoFreeFraction * 100;
      this.room.group.updateWorldMatrix(true, true);
    }
    this.refresh();
  }

  refresh() { this.controllers.forEach(controller => controller.updateDisplay()); }

  reset() {
    if (this.defaultGap === undefined) return;
    this.settings.thumbnailSize = 100;
    this.settings.gap = this.defaultGap;
    if (this.radiusControl) this.settings.sphereRadius = DEFAULT_GALLERY_RADIUS;
    this.applySize(); this.applyGap(); this.applyRadius();
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
