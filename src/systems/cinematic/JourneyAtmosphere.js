// Visual veil only, sampled from the existing Journey 3 elapsed clock.
export function entryVeil(time) {
  const smooth = (start, end) => { const x = Math.max(0, Math.min(1, (time - start) / (end - start))); return x*x*x*(x*(x*6-15)+10); };
  if (!Number.isFinite(time) || time <= 7.18 || time >= 7.82) return 0;
  return smooth(7.18, 7.38) * (1 - smooth(7.62, 7.82));
}

// Journey 3-only compositor layers borrowed by the existing cinematic curtain.
// Small static procedural cloud image; only opacity/transform changes per frame.
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
    // Opaque procedural blue-grey cloud mask. Static 192px SVG noise is rasterized
    // by the compositor; no animated filter, asset loader or independent clock.
    // Legacy whiteout names remain the existing handoff-opacity contract.
    const cloudImage = encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192" preserveAspectRatio="xMidYMid slice"><filter id="cloud" color-interpolation-filters="sRGB" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .019" numOctaves="3" seed="17"/><feColorMatrix type="matrix" values=".17 0 0 0 .12  .11 0 0 0 .20  .09 0 0 0 .27  0 0 0 0 1"/></filter><rect width="192" height="192" fill="#304555"/><rect width="192" height="192" filter="url(#cloud)"/></svg>');
    const backgrounds = [
      "radial-gradient(ellipse at 50% 50%, rgba(15,45,91,0.04) 25%, rgba(88,185,225,0.26) 66%, rgba(10,32,68,0.18) 100%)",
      "linear-gradient(150deg, rgba(12,48,84,0.12), rgba(36,91,126,0.18) 50%, rgba(14,42,74,0.10))",
      'radial-gradient(ellipse at 23% 34%, rgba(157,112,67,0.16), transparent 43%), radial-gradient(ellipse at 79% 68%, rgba(170,126,75,0.10), transparent 37%), url("data:image/svg+xml,' + cloudImage + '")',
    ];
    for (const background of backgrounds) {
      const layer = document.createElement("div");
      layer.style.cssText = "position:absolute;inset:-3%;pointer-events:none;opacity:0;will-change:opacity,transform";
      layer.style.background = background;
      layer.style.backgroundSize = "100% 100%";
      overlay.appendChild(layer);
      this.layers.push(layer);
    }
    // Fill/crop the SVG without letterboxing; backing stays inside the fading layer.
    this.layers[2].style.backgroundColor = "#304555";
    this.layers[2].style.backgroundRepeat = "no-repeat";
    // Pass 7D.2 isolation: hide only the grey curtain; remove this line to restore it.
    this.layers[2].style.display = "none";
  }

  update({ haze, clouds, whiteout, reveal = 1, time = 0 }) {
    if (this.cleared) return;
    this.whiteout = whiteout * reveal;
    if (!this.overlay) return;
    this.layers[0].style.opacity = String(haze * reveal);
    this.layers[1].style.opacity = String(clouds * reveal);
    this.layers[1].style.transform = `translate(${Math.sin(time * 0.17) * 1.2}%, ${Math.cos(time * 0.13) * 0.8}%)`;
    this.layers[2].style.opacity = String(this.whiteout);
    this.layers[2].style.transform = `translate(${Math.sin(time * 0.63) * 1.1}%, ${Math.cos(time * 0.47) * 0.9}%) scale(1.025)`;
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
      // Commit transparency with transitions disabled before restoring the
      // borrowed black curtain/transition. Otherwise CSS animates its parent
      // from opacity 1 to 0 over the first second of exploration.
      this.overlay.style.transition = "none";
      this.overlay.style.opacity = "0";
      void this.overlay.offsetWidth;
      this.overlay.style.overflow = this.original.overflow;
      this.overlay.style.background = this.original.background;
      this.overlay.style.transition = this.original.transition;
    }
    this.overlay = null;
  }
}
