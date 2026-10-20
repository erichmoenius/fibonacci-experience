import * as THREE from "three";

/** A camera-aligned gallery overlay. Uses the room's existing geometry and
 * photo texture; owns two overlay materials and its temporary UI. */
export class GalleryLightbox {
  constructor({ container, camera, canvas, documentRoot, monitor, geometry, material, onClose }) {
    Object.assign(this, { container, camera, canvas, document: documentRoot });
    this.photo = monitor.userData.photo;
    this.previousFocus = documentRoot.activeElement;
    this.group = new THREE.Group();
    this.group.name = "CitiesPhotoLightbox";
    this.group.matrixAutoUpdate = false;
    container.add(this.group);
    this.dimMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.36,
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.dim = new THREE.Mesh(geometry, this.dimMaterial);
    this.dim.position.z = -2.02;
    this.dim.renderOrder = 1000;
    // Both overlays use the transparent render queue so the dimmer is drawn
    // before the enlarged photo. The original gallery material stays intact.
    this.photoMaterial = material.clone();
    this.photoMaterial.transparent = true;
    this.photoMaterial.depthTest = false;
    this.photoMaterial.depthWrite = false;
    this.screen = new THREE.Mesh(geometry, this.photoMaterial);
    this.screen.position.z = -2;
    this.screen.renderOrder = 1001;
    this.group.add(this.dim, this.screen);

    const root = documentRoot.createElement("div");
    root.dataset.earthLightbox = "cities";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", this.photo.city.replaceAll("_", " ") + " · " + this.photo.title);
    root.style.cssText = "position:fixed;z-index:1100;overflow:hidden";
    for (const name of ["pointerdown", "pointermove", "pointerup", "click", "wheel"]) root.addEventListener(name, event => event.stopPropagation());
    root.addEventListener("click", event => { if (event.target === root) onClose(); });
    const imageArea = documentRoot.createElement("div");
    imageArea.style.cssText = "position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);box-shadow:0 8px 42px #0008;border:1px solid #ffffff30;box-sizing:border-box";
    // This transparent DOM surface matches the rendered image and keeps
    // clicking the photo distinct from clicking its surrounding backdrop.
    imageArea.setAttribute("role", "img");
    imageArea.setAttribute("aria-label", this.photo.title);
    root.appendChild(imageArea);
    const close = documentRoot.createElement("button");
    close.type = "button";
    close.textContent = "×";
    close.setAttribute("aria-label", "Close photo");
    close.style.cssText = "position:absolute;right:16px;top:16px;width:36px;height:36px;border:1px solid #ffffff55;border-radius:50%;background:#0a101cdd;color:#fff;font:26px system-ui;cursor:pointer";
    close.addEventListener("click", onClose);
    root.appendChild(close);
    const caption = documentRoot.createElement("div");
    caption.textContent = this.photo.city.replaceAll("_", " ") + " · " + this.photo.title;
    caption.style.cssText = "position:absolute;bottom:18px;left:24px;right:24px;color:#edf7ff;font:13px system-ui;text-align:center;pointer-events:none";
    root.appendChild(caption);
    this.root = root; this.imageArea = imageArea; this.closeButton = close;
    documentRoot.body.appendChild(root);
    this.update();
    close.focus();
  }

  update() {
    if (this.disposed) return;
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const camera = this.camera;
    camera.updateWorldMatrix(true, false);
    this.container.updateWorldMatrix(true, false);
    this.group.matrix.copy(this.container.matrixWorld).invert().multiply(camera.matrixWorld);
    this.group.matrixWorldNeedsUpdate = true;
    const height = 4 * Math.tan(THREE.MathUtils.degToRad(camera.getEffectiveFOV() / 2));
    const width = height * camera.aspect;
    const ratio = this.photo.width / this.photo.height;
    const photoHeight = Math.min(height * 0.7, width * 0.7 / ratio);
    const photoWidth = photoHeight * ratio;
    this.screen.scale.set(photoWidth, photoHeight, 1);
    this.dim.scale.set(width * 1.02, height * 1.02, 1);
    Object.assign(this.root.style, {
      left: bounds.left + "px", top: bounds.top + "px",
      width: bounds.width + "px", height: bounds.height + "px",
    });
    this.imageArea.style.width = bounds.width * photoWidth / width + "px";
    this.imageArea.style.height = bounds.height * photoHeight / height + "px";
  }

  dispose({ restoreFocus = true } = {}) {
    if (this.disposed) return;
    this.disposed = true;
    this.root.remove();
    this.group.removeFromParent();
    this.dimMaterial.dispose();
    this.photoMaterial.dispose();
    if (restoreFocus) this.previousFocus?.focus?.();
  }
}
