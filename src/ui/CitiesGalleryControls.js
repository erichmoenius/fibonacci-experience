import { CITIES_HOME } from "../config/earthGalleries.js";
import { GalleryLayoutTuning, GALLERY_TUNING_LIMITS } from "../systems/GalleryLayoutTuning.js";

export const GALLERY_PRESET_VERSION = 2;
export const galleryPresetKey = id => "fibonacci-experience:gallery:" + id;
const number = (value, min, max, fallback) => typeof value === "number" && Number.isFinite(value)
  ? Math.max(min, Math.min(max, value)) : fallback;

/** Three physical layout controls. Camera position, FOV and zoom are untouched. */
export class CitiesGalleryControls {
  constructor(gui, camera, { id = "cities", name = "Cities", layout = "SPHERICAL", home = id === "cities" ? CITIES_HOME : { pictureSize: 100, gap: 0, radius: 0 } } = {}, storage) {
    Object.assign(this, { gui, camera, id, name, layout, storage });
    this.limits = GALLERY_TUNING_LIMITS[layout];
    this.home = Object.freeze({ ...home });
    this.settings = { ...this.home,
      save: () => this.save(), load: () => this.load(), reset: () => this.reset() };
    this.controllers = [];
    if (gui) this.createGUI();
    this.setVisible(false);
  }

  createGUI() {
    const folder = this.folder = this.gui.addFolder("Gallery / " + this.name);
    // Root GUI presets do not read/write satellite layouts. Each satellite owns its preset.
    folder.save = () => ({ controllers: {}, folders: {} });
    folder.load = () => folder;
    this.controllers.push(folder.add(this.settings,"pictureSize",1,150,1).name("Picture Size (%)").onChange(()=>this.apply()));
    this.controllers.push(folder.add(this.settings,"gap",-50,50,1).name("Gap (%)").onChange(()=>this.apply()));
    this.controllers.push(folder.add(this.settings,"radius",-5,5,.1).name("Radius / Traveller Distance").onChange(()=>this.apply()));
    this.controllers[0].domElement.title = "Physical panel dimensions relative to factory size. Requested range 1â€“150%. Safe effective size is reported below when clearance limits it.";
    this.controllers[1].domElement.title = "Signed slot margin: negative closes edge spacing, positive opens it. Zero is factory spacing. Safety can limit effective panel size.";
    this.controllers[2].domElement.title = this.limits.description + ". Offset from factory distance: negative closer, positive farther. Safe effective offset is reported below. Traveller stays fixed.";
    folder.add(this.settings,"save").name("Save Gallery");
    folder.add(this.settings,"load").name("Load Gallery");
    folder.add(this.settings,"reset").name("Reset Gallery Layout");
    folder.open();
  }

  enter(room) {
    if (this.disposed) return;
    this.room = room;
    this.tuning ??= new GalleryLayoutTuning(room,this.layout);
    if (!this.entered) { this.entered = true; this.load(); }
    this.apply(); this.setVisible(true);
    room.ready.then(()=>{if(!this.disposed&&this.room===room)this.apply();});
  }

  apply() {
    this.settings.pictureSize = number(this.settings.pictureSize,1,150,this.home.pictureSize);
    this.settings.gap = number(this.settings.gap,-50,50,this.home.gap);
    this.settings.radius = number(this.settings.radius,-5,5,this.home.radius);
    if (this.room) {
      this.effective = this.tuning.apply(this.settings);
      this.maxPictureSize = this.effective.maxPictureSize;
      const limits = [];
      if (this.effective.pictureSize !== this.settings.pictureSize) limits.push(`Picture Size ${this.settings.pictureSize}% requested â†’ ${this.effective.pictureSize}% effective for clearance`);
      if (this.effective.radius !== this.settings.radius) limits.push(`Radius ${this.settings.radius} requested â†’ ${this.effective.radius} effective for Traveller clearance`);
      this.clampNotice = limits.join("; ");
      this.layoutNotice = this.effective.adaptive ? (this.layout === "SPIRAL" ? "Animals adaptive spiral density active; preset values unchanged" : this.layout === "TIMELINE_TUNNEL" ? "Events adaptive timeline density active; preset values unchanged" : this.layout === "CONSTELLATION" ? "Ethnicity adaptive constellation density active; preset values unchanged" : "Plants adaptive botanical density active; preset values unchanged") : "";
      this.notice("Layout updated");
    }
    this.controllers.forEach(c=>c.updateDisplay());
  }

  // Existing lifecycle callers/tests can request a single-control refresh.
  applySize() { this.apply(); }
  applyGap() { this.apply(); }
  applyRadius() { this.apply(); }

  getStorage() { return this.storage ?? globalThis.localStorage; }

  save() {
    if (!this.room || this.disposed) return false;
    this.apply();
    try {
      const {pictureSize,gap,radius} = this.settings;
      this.getStorage().setItem(galleryPresetKey(this.id), JSON.stringify({version:GALLERY_PRESET_VERSION,gallery:this.id,settings:{pictureSize,gap,radius}}));
      this.presetNotice="";this.notice("Gallery saved");return true;
    } catch { this.notice("Gallery could not be saved");return false; }
  }

  load() {
    if (!this.room || this.disposed) return false;
    try {
      const raw = this.getStorage()?.getItem(galleryPresetKey(this.id));
      if (!raw) { this.notice("No saved gallery preset");return false; }
      const data = JSON.parse(raw);
      if (!data || Array.isArray(data) || typeof data !== "object" || (data.gallery !== undefined && data.gallery !== this.id)) return false;
      if (![undefined,0,1,GALLERY_PRESET_VERSION].includes(data.version)) {
        this.presetNotice="Unsupported preset version; saved data retained";this.notice("Preset not loaded");return false;
      }
      let values = data.settings ?? data;
      if (!values || Array.isArray(values) || typeof values !== "object" || !["pictureSize","gap","radius"].some(k=>typeof values[k]==="number"&&Number.isFinite(values[k]))) return false;
      this.presetNotice="";
      if (data.version !== GALLERY_PRESET_VERSION) {
        // M10A stored absolute radii. Conversion never overwrites the old record.
        const absolute = values.radius ?? this.limits.defaultRadius;
        const offset = absolute - this.limits.defaultRadius;
        if (typeof absolute !== "number" || !Number.isFinite(absolute) || offset < -5 || offset > 5
          || (values.pictureSize !== undefined && (!Number.isFinite(values.pictureSize) || values.pictureSize < 1 || values.pictureSize > 150))
          || (values.gap !== undefined && (!Number.isFinite(values.gap) || values.gap < -50 || values.gap > 50))) {
          this.presetNotice="M10A preset exceeds the new ranges; original data retained. Reset or adjust and Save to create a v2 preset.";
          this.notice("Preset not loaded");return false;
        }
        values={...values,radius:offset};
        this.presetNotice="M10A absolute Radius converted to offset; original saved data retained until Save";
      }
      this.settings.pictureSize=number(values.pictureSize,1,150,this.home.pictureSize);
      this.settings.gap=number(values.gap,-50,50,this.home.gap);
      this.settings.radius=number(values.radius,-5,5,this.home.radius);
      this.apply();this.notice("Gallery loaded");return true;
    } catch { this.notice("Saved gallery preset unavailable");return false; }
  }

  reset() {
    Object.assign(this.settings,this.home);
    this.apply();this.notice("Factory layout restored; saved preset retained");
  }

  notice(message) {
    this.statusMessage=[message,this.presetNotice,this.clampNotice,this.layoutNotice].filter(Boolean).join(" Â· ");
    if (!this.folder?.domElement || typeof document === "undefined") return;
    if (!this.status) { this.status=document.createElement("div");this.status.setAttribute("role","status");this.status.style.cssText="padding:4px 8px;font:11px system-ui";this.folder.domElement.appendChild(this.status); }
    this.status.textContent=this.statusMessage;
  }
  setVisible(visible) { this.visible=Boolean(visible);this.folder?.show(this.visible); }
  leave() { this.room=null;this.setVisible(false); }
  dispose() { if(this.disposed)return;this.leave();this.folder?.destroy();this.disposed=true; }
}
