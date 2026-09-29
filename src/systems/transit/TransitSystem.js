import WormholeTransit from "./WormholeTransit.js";
export default class TransitSystem {
  constructor() {
    this.active = false;

    this.type = null;

    this.currentTransit = null;
  }

  start(type, context = {}) {
    this.active = true;

    this.type = type;

    if (type === "wormhole") {
      this.currentTransit = new WormholeTransit();
      this.currentTransit.start(context);
    }

    console.log("Transit started:", type);
  }

  stop() {
    this.currentTransit?.getObject()?.removeFromParent();

    this.currentTransit?.stop();

    this.currentTransit?.dispose();

    this.currentTransit = null;

    this.active = false;

    this.type = null;

    console.log("Transit stopped");
  }

  update(delta) {
    if (!this.active) return;

    this.currentTransit?.update(delta);
  }

  close(duration = 1) {
    this.currentTransit?.close(duration);
  }

  isActive() {
    return this.active;
  }

  getType() {
    return this.type;
  }

  getObject() {
    return this.currentTransit?.getObject() ?? null;
  }
}
