import * as THREE from "three";
import { PlasmaBlob } from "./HistoricalPlasmaBlobA12.js";

// TEMPORARY A12: remove this adapter, historical copy and PlanetaryTheme hooks
// after the side-by-side review. Never instantiated in a production build.
export class BlobAuraReferenceA12 {
  constructor(parent, isExplore) {
    this.isExplore = isExplore;
    this.enabled = true;
    this.group = new THREE.Group();
    this.group.name = "A12HistoricalBlobReference";
    this.group.position.set(-15, 8, 8);
    this.group.visible = false;
    parent.add(this.group);
    this.blob = new PlasmaBlob(this.group);
    this.blob.applyPreset("nebula"); // Exact historical SpaceTheme preset.
    this.keydown = event => {
      if (event.code !== "KeyB" || event.repeat || event.ctrlKey || event.metaKey || event.altKey
        || event.target?.closest?.("input, textarea, select, [contenteditable]") || !this.isExplore()) return;
      this.enabled = !this.enabled;
      this.syncVisibility();
    };
    window.addEventListener("keydown", this.keydown);
  }

  syncVisibility() {
    const explore = this.isExplore();
    this.group.visible = explore && this.enabled;
    return explore;
  }

  update(audio, time) {
    if (!this.syncVisibility()) return;
    // Same frame, same sample and clock as the Sun; no FFT read or new envelope.
    // Continue updating while B-hidden so toggling back cannot retain a stale kick.
    this.blob.update(audio ?? {}, time);
    // Historical SpaceTheme overrides only the body AFTER PlasmaBlob.update.
    // The original aura keeps its bass/energy/kick pulse independently.
    const breath = 1.0 + Math.sin(time * 0.25) * 0.18;
    this.blob._mesh.scale.setScalar(this.blob.cfg.scale * breath);
  }

  destroy() {
    window.removeEventListener("keydown", this.keydown);
    this.blob.destroy();
    this.group.removeFromParent();
  }
}
