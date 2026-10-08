// Journey 3-only compositor layers borrowed by the existing cinematic curtain.
// Static gradients; only opacity/transform changes. No scene textures or passes.
export class JourneyAtmosphere {
  constructor(overlay) {
    this.overlay = overlay;
    this.whiteout = 0;
    this.cleared = false;
    this.layers = [];
    if (!overlay) return;
    this.original = { background: overlay.style.background, transition: overlay.style.transition, overflow: overlay.style.overflow };
    overlay.style.overflow = "hidden";
    overlay.style.background = "transparent";
    overlay.style.transition = "none";
    overlay.style.opacity = "1";
    const backgrounds = [
      "radial-gradient(ellipse at 50% 50%, rgba(15,45,91,0.04) 25%, rgba(88,185,225,0.26) 66%, rgba(10,32,68,0.18) 100%)",
      "radial-gradient(ellipse at 32% 62%, rgba(240,249,255,0.92), rgba(187,219,240,0.48) 38%, transparent 75%), radial-gradient(ellipse at 76% 27%, rgba(215,238,252,0.88), rgba(139,192,226,0.35) 44%, transparent 82%)",
      "linear-gradient(135deg, #eaf4fb, #f5faff)",
    ];
    for (const background of backgrounds) {
      const layer = document.createElement("div");
      layer.style.cssText = "position:absolute;inset:-3%;pointer-events:none;opacity:0;will-change:opacity,transform";
      layer.style.background = background;
      overlay.appendChild(layer);
      this.layers.push(layer);
    }
  }

  update({ haze, clouds, whiteout, reveal = 1, time = 0 }) {
    if (this.cleared) return;
    this.whiteout = whiteout * reveal;
    if (!this.overlay) return;
    this.layers[0].style.opacity = String(haze * reveal);
    this.layers[1].style.opacity = String(clouds * reveal);
    this.layers[1].style.transform = `translate(${Math.sin(time * 0.17) * 1.2}%, ${Math.cos(time * 0.13) * 0.8}%)`;
    this.layers[2].style.opacity = String(this.whiteout);
  }

  obscure() {
    if (this.cleared) return;
    this.whiteout = 1;
    if (this.overlay) {
      this.overlay.style.transition = "none";
      this.overlay.style.opacity = "1";
    }
    if (this.layers[2]) this.layers[2].style.opacity = "1";
  }

  clear() {
    if (this.cleared) return;
    this.cleared = true;
    this.whiteout = 0;
    for (const layer of this.layers) layer.remove();
    this.layers.length = 0;
    if (this.overlay) {
      this.overlay.style.overflow = this.original.overflow;
      this.overlay.style.background = this.original.background;
      this.overlay.style.transition = this.original.transition;
      this.overlay.style.opacity = "0";
    }
    this.overlay = null;
  }
}
