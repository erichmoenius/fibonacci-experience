import WormholeTransit from "./WormholeTransit.js";
export default class TransitSystem {
  constructor() {
    this.active = false;

    this.prepared = false;

    this.type = null;

    this.currentTransit = null;
  }

  prepare(type, context = {}) {
    if (this.active && this.type === type) return this.currentTransit;

    if (!this.currentTransit || this.type !== type) {
      this.currentTransit?.dispose();
      this.currentTransit =
        type === "wormhole" ? new WormholeTransit() : null;
      this.type = type;
    }

    this.prepared = Boolean(this.currentTransit);
    this.currentTransit?.setPose(context);

    return this.currentTransit;
  }

  start(type, context = {}) {
    this.active = true;

    this.type = type;

    if (type === "wormhole") {
      const usePreparedTransit = this.prepared && this.currentTransit;

      if (!usePreparedTransit) {
        this.currentTransit = new WormholeTransit();
      }

      this.currentTransit.start(
        usePreparedTransit ? { preservePose: true } : context,
      );
    }

    this.prepared = false;

    console.log("Transit started:", type);
  }

  stop() {
    this.currentTransit?.getObject()?.removeFromParent();

    this.currentTransit?.stop();

    this.currentTransit?.dispose();

    this.currentTransit = null;

    this.active = false;

    this.prepared = false;

    this.type = null;

    console.log("Transit stopped");
  }

  update(delta) {
    if (!this.active && !this.prepared) return;

    this.currentTransit?.update(delta);
  }

  setPreparedReveal(value) {
    if (!this.prepared) return;

    this.currentTransit?.setReveal(value);
  }

  cancelPrepared() {
    if (!this.prepared) return;

    this.currentTransit?.getObject()?.removeFromParent();
    this.currentTransit?.dispose();
    this.currentTransit = null;
    this.prepared = false;
    this.type = null;
  }

  close(duration = 1) {
    this.currentTransit?.close(duration);
  }

  isActive() {
    return this.active;
  }

  isPrepared() {
    return this.prepared;
  }

  getType() {
    return this.type;
  }

  getObject() {
    return this.currentTransit?.getObject() ?? null;
  }
}
