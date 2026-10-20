import * as THREE from "three";
import { GalleryRoom } from "../systems/GalleryRoom.js";
import { GalleryLightbox } from "./GalleryLightbox.js";
import { CitiesGalleryControls } from "../ui/CitiesGalleryControls.js";

/** Theme-local click observer. Leaves all flight input alone until a valid release. */
export class EarthGalleryInteraction {
  constructor(theme, cameraDirector, eventWindow = window, documentRoot = document) {
    this.theme = theme;
    this.director = cameraDirector;
    this.canvas = cameraDirector.freeFlight.target;
    this.eventWindow = eventWindow;
    this.document = documentRoot;
    this.layoutControls = new CitiesGalleryControls(theme.visualFolder?.parent, cameraDirector.camera);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.listeners = [];
    const listen = (name, handler) => {
      eventWindow.addEventListener(name, handler, true);
      this.listeners.push([name, handler]);
    };
    listen("pointerdown", event => this.down(event));
    listen("pointermove", event => this.move(event));
    listen("pointerup", event => this.up(event));
    listen("pointercancel", () => { this.click = null; this.endLook(); });
    listen("blur", () => { this.click = null; this.endLook(); });
    listen("keydown", event => {
      if (this.lightbox && event.code === "Tab") {
        event.preventDefault(); event.stopImmediatePropagation();
        this.lightbox.closeButton.focus();
        return;
      }
      if (this.opened && event.code === "Escape") {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!event.repeat) {
          if (this.lightbox) this.closeLightbox(); else this.close();
        }
      }
    });
  }

  hit(event) {
    if (event.target !== this.canvas) return false;
    const camera = this.director.camera;
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return false;
    const center = this.theme.satellites.satellites[0].getWorldPosition(new THREE.Vector3());
    camera.updateWorldMatrix(true, false);
    const projected = center.clone().project(camera);
    if (projected.z < -1 || projected.z > 1) return false;
    this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
      -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, camera);
    // At least 20 pixels, with a modest world-space halo for nearby viewing.
    const distance = center.distanceTo(camera.position);
    const radius = Math.max(0.6, distance * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * 20 / bounds.height);
    const hit = this.raycaster.ray.intersectSphere(new THREE.Sphere(center, radius), new THREE.Vector3());
    if (!hit) return false;
    const obstruction = this.raycaster.intersectObject(this.theme.earth.surface, false)[0];
    if (obstruction && obstruction.distance < hit.distanceTo(camera.position)) return false;
    // A halo must never turn a different numbered satellite into a target.
    if (this.theme.satellites.satellites.slice(1).some(sphere =>
      this.raycaster.intersectObject(sphere, false).length || this.raycaster.intersectObject(sphere.children[0], false).length)) return false;
    return true;
  }

  down(event) {
    this.click = null;
    if (this.opened) {
      if (event.target === this.canvas) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (this.lightbox) return;
        if (event.button === 0 && event.buttons === 1) {
          this.lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY,
            startX: event.clientX, startY: event.clientY, time: event.timeStamp,
            dragged: false, monitor: this.hitPhoto(event) };
          this.canvas.setPointerCapture?.(event.pointerId);
        }
      }
      return;
    }
    const flight = this.director.freeFlight;
    if (this.director.mode !== "explore" || this.director.isInJourney() || event.button !== 0 || event.buttons !== 1
      || flight.pointer.active || flight.pointer.rmbActive || flight.pointer.dragging
      || Math.hypot(this.theme.flight.rmbThrustVelocity, this.theme.flight.rmbStrafeVelocity) > 0.02
      || !this.hit(event)) return;
    this.click = { id: event.pointerId, x: event.clientX, y: event.clientY,
      time: event.timeStamp, position: this.director.position.clone(), moved: false };
  }

  move(event) {
    if (this.opened) {
      if (this.lightbox) return;
      const pointer = this.lookPointer;
      if (!pointer || pointer.id !== event.pointerId) return;
      if (event.buttons !== 1) { this.endLook(); return; }
      if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY)
        >= Math.min(6, this.director.freeFlight.dragThreshold)) pointer.dragged = true;
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      pointer.x = event.clientX; pointer.y = event.clientY;
      if (!pointer.dragged) return;
      this.lookYaw = THREE.MathUtils.euclideanModulo(this.lookYaw - dx * 0.003 + Math.PI, Math.PI * 2) - Math.PI;
      this.lookPitch = THREE.MathUtils.clamp(this.lookPitch - dy * 0.003, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
      this.director.inspect(this.getLookPose());
      event.preventDefault(); event.stopImmediatePropagation();
      return;
    }
    if (!this.click || event.pointerId !== this.click.id) return;
    if (event.buttons !== 1 || Math.hypot(event.clientX - this.click.x, event.clientY - this.click.y)
      >= Math.min(6, this.director.freeFlight.dragThreshold)) this.click.moved = true;
  }

  up(event) {
    if (this.opened) {
      const pointer = this.lookPointer;
      if (pointer?.id === event.pointerId) {
        this.endLook();
        if (!this.lightbox && event.button === 0 && event.buttons === 0 && !pointer.dragged
          && event.timeStamp - pointer.time <= 350
          && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY)
            < Math.min(6, this.director.freeFlight.dragThreshold)
          && pointer.monitor && this.hitPhoto(event) === pointer.monitor) this.openLightbox(pointer.monitor);
      }
      return;
    }
    const click = this.click;
    this.click = null;
    if (!click || event.pointerId !== click.id || event.button !== 0 || event.buttons !== 0 || click.moved
      || event.timeStamp - click.time > 350
      || Math.hypot(event.clientX - click.x, event.clientY - click.y) >= Math.min(6, this.director.freeFlight.dragThreshold)
      || this.director.position.distanceTo(click.position) > 0.08
      || this.director.mode !== "explore" || this.director.isInJourney() || !this.hit(event)) return;
    event.preventDefault();
    this.open();
  }

  open() {
    if (this.opened || this.disposed || !this.theme.earth.group.visible || this.director.mode !== "explore" || this.director.isInJourney()) return false;
    const forward = this.director.camera.getWorldDirection(new THREE.Vector3());
    this.savedPose = { position: this.director.position.clone(),
      lookTarget: this.director.position.clone().addScaledVector(forward, 10) };
    this.room ??= new GalleryRoom(this.theme.container);
    this.room.place(this.savedPose.position, forward);
    this.savedVisibility = [this.theme.earth.group.visible, this.theme.satellites.group.visible];
    this.theme.earth.group.visible = this.theme.satellites.group.visible = false;
    this.room.group.visible = true;
    this.opened = true;
    this.lookYaw = Math.atan2(-forward.x, -forward.z);
    this.lookPitch = Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1));
    // Configure the existing inspection hold; no camera transform writes.
    this.savedInspectParallaxStrength = this.director.inspectParallaxStrength;
    this.director.inspectParallaxStrength = 0;
    this.director.inspect(this.getLookPose());
    this.director.freeFlight.reset();
    this.showControls();
    this.layoutControls.enter(this.room);
    return true;
  }

  hitPhoto(event) {
    if (event.target !== this.canvas || !this.room || this.lightbox) return null;
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;
    if (event.clientX < bounds.left || event.clientX > bounds.left + bounds.width
      || event.clientY < bounds.top || event.clientY > bounds.top + bounds.height) return null;
    this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
      -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    this.director.camera.updateWorldMatrix(true, false);
    this.room.group.updateWorldMatrix(true, true);
    this.raycaster.setFromCamera(this.pointer, this.director.camera);
    const screens = this.room.monitors.filter(m => m.userData.photoStatus === "ready").map(m => m.children.at(-1));
    return this.raycaster.intersectObjects(screens, false)[0]?.object.parent ?? null;
  }

  openLightbox(monitor) {
    if (!this.opened || this.disposed || this.lightbox || monitor.userData.photoStatus !== "ready") return false;
    this.endLook(); this.click = null;
    this.lightbox = new GalleryLightbox({
      container: this.theme.container, camera: this.director.camera, canvas: this.canvas,
      documentRoot: this.document, monitor, geometry: this.room.photoGeometry,
      material: this.room.photoMaterials.get(monitor.userData.photo.path),
      onClose: () => this.closeLightbox(),
    });
    this.controls.hidden = true;
    this.controls.style.visibility = "hidden";
    return true;
  }

  closeLightbox({ restoreFocus = true } = {}) {
    if (this.controls) { this.controls.hidden = false; this.controls.style.visibility = ""; }
    this.lightbox?.dispose({ restoreFocus });
    this.lightbox = null;
  }

  showControls() {
    const root = this.document.createElement("div");
    root.dataset.earthGallery = "cities";
    root.setAttribute("role", "region"); root.setAttribute("aria-label", "CITIES spherical gallery");
    root.style.cssText = "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:1000;display:flex;align-items:center;gap:12px;padding:12px 16px;border:1px solid #456176;border-radius:12px;background:#08121fea;color:#edf7ff;font:14px system-ui;max-width:calc(100vw - 24px);box-sizing:border-box;flex-wrap:wrap;justify-content:center";
    for (const name of ["pointerdown", "pointerup", "pointermove", "click", "wheel"]) root.addEventListener(name, event => event.stopPropagation());
    const button = (text, action) => {
      const element = this.document.createElement("button"); element.type = "button";
      element.textContent = text;
      element.style.cssText = "cursor:pointer;padding:8px 12px;border:1px solid #60839e;border-radius:6px;background:#162d40;color:#fff;font:inherit";
      element.addEventListener("click", action); root.appendChild(element); return element;
    };
    const hint = this.document.createElement("span");
    hint.textContent = "CITIES · Drag to look · Click a photo to enlarge";
    root.appendChild(hint);
    this.back = button("Back to Earth", () => this.close());
    this.controls = root;
    this.previousFocus = this.document.activeElement;
    this.document.body.appendChild(root);
    this.back.focus();
  }

  getLookPose() {
    const position = this.room.getCenter();
    const cosine = Math.cos(this.lookPitch);
    const direction = new THREE.Vector3(
      -Math.sin(this.lookYaw) * cosine, Math.sin(this.lookPitch), -Math.cos(this.lookYaw) * cosine,
    );
    // Inspection already applies the director's current yaw; compensate in
    // the requested target so entering from any Earth heading is continuous.
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.director.yaw);
    return { position, lookTarget: position.clone().addScaledVector(direction, 10) };
  }

  endLook() {
    const id = this.lookPointer?.id;
    this.lookPointer = null;
    if (id !== undefined && this.canvas.hasPointerCapture?.(id)) this.canvas.releasePointerCapture(id);
  }

  restoreInspectionSettings() {
    if (this.savedInspectParallaxStrength !== undefined) {
      this.director.inspectParallaxStrength = this.savedInspectParallaxStrength;
      this.savedInspectParallaxStrength = undefined;
    }
  }

  close() {
    if (!this.opened) return;
    this.closeLightbox();
    this.layoutControls.leave();
    this.opened = false;
    this.endLook();
    this.restoreInspectionSettings();
    this.room.group.visible = false;
    [this.theme.earth.group.visible, this.theme.satellites.group.visible] = this.savedVisibility;
    this.controls?.remove(); this.controls = null;
    this.director.returnHome(this.savedPose, true);
    this.previousFocus?.focus?.();
    this.click = null;
  }

  update() {
    // A pending Earth map completion cannot reveal Earth through the room.
    if (this.opened) this.theme.earth.group.visible = this.theme.satellites.group.visible = false;
    this.lightbox?.update();
    this.layoutControls.setVisible(this.opened && !this.lightbox);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.layoutControls.dispose();
    this.closeLightbox({ restoreFocus: false });
    this.endLook();
    this.restoreInspectionSettings();
    // Theme exit has its own camera handoff; never restore the departing pose.
    this.controls?.remove();
    this.listeners.forEach(([name, handler]) => this.eventWindow.removeEventListener(name, handler, true));
    this.listeners.length = 0;
    this.room?.dispose();
    this.click = null;
  }
}

