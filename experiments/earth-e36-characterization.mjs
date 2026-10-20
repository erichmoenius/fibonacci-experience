import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";
import { EnvironmentTheme } from "../src/themes/EnvironmentTheme.js";
import { GalleryRoom } from "../src/systems/GalleryRoom.js";

import { measureMosaic, setMosaicGap } from "../src/systems/GalleryLayout.js";

const cache = new Map();
async function moduleURL(path) {
  path = resolve(path);
  if (cache.has(path)) return cache.get(path);
  let source = readFileSync(path, "utf8");
  for (const match of [...source.matchAll(/from\s+["']([^"']+)["']/g)]) {
    const spec = match[1];
    const target = spec.startsWith(".")
      ? await moduleURL(resolve(dirname(path), spec + (extname(spec) ? "" : ".js")))
      : import.meta.resolve(spec);
    source = source.replace(match[0], "from " + JSON.stringify(target));
  }
  const url = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  cache.set(path, url);
  return url;
}
const { default: CameraDirector } = await import(await moduleURL("src/systems/cinematic/CameraDirector.js"));
class Surface {
  constructor() { this.listeners = []; this.children = []; this.style = {}; this.dataset = {}; }
  addEventListener(name, handler, capture = false) { this.listeners.push({ name, handler, capture }); }
  removeEventListener(name, handler, capture = false) {
    this.listeners = this.listeners.filter(l => l.name !== name || l.handler !== handler || l.capture !== capture);
  }
  emit(name, event) { for (const l of [...this.listeners]) if (l.name === name) { l.handler(event); if (event.stopped) break; } }
  appendChild(child) { this.children.push(child); child.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
  setAttribute() {}
  setPointerCapture(id) { this.captureId = id; }
  hasPointerCapture(id) { return this.captureId === id; }
  releasePointerCapture(id) { if (this.captureId === id) this.captureId = undefined; }
  focus() { document.activeElement = this; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1000, height: 1000 }; }
}
const output = { log: console.log, warn: console.warn, trace: console.trace };
console.log = console.warn = console.trace = () => {};
globalThis.window = new Surface();
window.innerWidth = window.innerHeight = 1000;
globalThis.document = Object.assign(new Surface(), { createElement: () => new Surface(), body: new Surface(), activeElement: null });
globalThis.localStorage = { getItem: () => null };
const textureLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = function (_url, ready) { ready(new THREE.Texture({ width: 4096, height: 2048 })); };
let checks = 0;
const check = (condition, text) => { assert.ok(condition, text); checks++; };
class GuiController {
  constructor(gui, object, property, min, max, step) {
    Object.assign(this, { gui, object, property, min, max, step });
    this.domElement = {}; this.label = property;
  }
  name(label) { this.label = label; return this; }
  onChange(callback) { this.callback = callback; return this; }
  disable() { this.disabled = true; return this; }
  updateDisplay() { this.displayed = this.object[this.property]; return this; }
  setValue(value) { this.object[this.property] = value; this.callback?.(value); return this; }
}
class Gui {
  constructor(parent = null, title = "G") { Object.assign(this, { parent, title, folders: [], controllers: [], hidden: false }); }
  addFolder(title) { const folder = new Gui(this, title); this.folders.push(folder); return folder; }
  add(...args) { const controller = new GuiController(this, ...args); this.controllers.push(controller); return controller; }
  open() { this.opened = true; return this; }
  show(visible = true) { this.hidden = !visible; return this; }
  save() {
    return { controllers: Object.fromEntries(this.controllers.filter(c => typeof c.object[c.property] !== "function")
      .map(c => [c.label, c.object[c.property]])), folders: Object.fromEntries(this.folders.map(f => [f.title, f.save()])) };
  }
  load(values) {
    for (const controller of this.controllers) if (controller.label in (values.controllers || {})) controller.setValue(values.controllers[controller.label]);
    for (const folder of this.folders) if (folder.title in (values.folders || {})) folder.load(values.folders[folder.title]);
    return this;
  }
  destroy() { this.destroyed = true; if (this.parent) this.parent.folders = this.parent.folders.filter(f => f !== this); }
}
try {
  const canvas = new Surface(), gui = new Gui();
  const unrelated = { value: 17 }; gui.add(unrelated, "value").name("Unrelated");
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100); camera.zoom = 1.2; camera.updateProjectionMatrix();
  const director = new CameraDirector(camera, canvas);
  const container = new THREE.Group();
  const theme = new EnvironmentTheme(container, null);
  await theme.earth.ready;
  theme.visualFolder = gui.addFolder("Earth");
  director.setExploreTravel(theme.flight); director.returnHome(theme.getHomePose(), true);
  const baseListeners = window.listeners.length;
  theme.initializeFlightControls({ cameraDirector: director });
  const controller = theme.galleryInteraction;
  const tuning = controller.layoutControls;
  check(gui.folders.length === 1, "gallery folder is not exposed before entering Cities");
  let loads = 0;
  const room = new GalleryRoom(container, { photoLoader: async () => { loads++; return new THREE.Texture({close() {}}); } });
  await room.ready;
  controller.room = room;
  const baselineGap = measureMosaic(room.monitors).photoFreeFraction * 100;
  const before = room.monitors.map(m => ({screen: m.children.at(-1), material: m.children.at(-1).material,
    texture: m.children.at(-1).material.map, position: m.position.clone(), scale: m.scale.clone(),
    quaternion: m.quaternion.clone(), photo: m.userData.photo, cell: m.userData.mosaicCell,
    width: m.userData.panelSize.width, height: m.userData.panelSize.height}));
  check(controller.open(), "Cities opens without a theme restart"); director.update(1 / 60); controller.update();
  const folder = tuning.folder, size = folder.controllers.find(c => c.property === "thumbnailSize"),
    gap = folder.controllers.find(c => c.property === "gap"), reset = folder.controllers.find(c => c.property === "reset");
  check(folder.title === "Gallery / Cities" && !folder.hidden && folder.parent === gui, "folder follows the existing Earth G-GUI parent");
  check(size.min === 25 && size.max === 150 && size.step === 1 && tuning.settings.thumbnailSize === 100, "Size range and baseline default");
  check(gap.min === 0 && gap.max === 30 && Math.abs(tuning.settings.gap - baselineGap) < 1e-10, "Gap range and current effective-gap default");
  check(camera.zoom === 1.2 && Math.abs(tuning.settings.effectiveGap - baselineGap) < 1e-9, "default settings preserve the current composition and incoming lens");
  const first = room.monitors.find(m => {
    camera.updateWorldMatrix(true, false); const p = m.children.at(-1).getWorldPosition(new THREE.Vector3()).project(camera);
    return Math.abs(p.x) < 0.8 && Math.abs(p.y) < 0.8 && p.z > -1 && p.z < 1;
  });
  check(!!first, "visible photo is available for projected-size checks");
  const projectedWidth = () => {
    camera.updateWorldMatrix(true, false); room.group.updateWorldMatrix(true, true);
    const screen = first.children.at(-1);
    const points = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,y]) => screen.localToWorld(new THREE.Vector3(x,y,0)).project(camera));
    return Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x));
  };
  const baseWidth = projectedWidth(), heldPosition = camera.position.clone(), heldQuaternion = camera.quaternion.clone();
  const originalInset = room.monitors.map(m=>m.userData.mosaicInset);
  for (const value of [25, 75, 100, 150]) {
    size.setValue(value);
    check(Math.abs(projectedWidth() / baseWidth - value / 100) < 1e-9, "Size immediately produces its advertised viewport magnification");
    check(Math.abs(measureMosaic(room.monitors).photoFreeFraction * 100 - baselineGap) < 1e-9,
      "Size does not change angular gaps or overlap geometry");
    check(room.monitors.every((m,i) => m.userData.mosaicInset === originalInset[i]
      && Math.abs(m.userData.panelSize.width-before[i].width)<1e-8), "Size never resizes the photo meshes");
  }
  const measureActual = () => {
    room.group.updateWorldMatrix(true, true);
    const planes = room.monitors.map(m=>({center:m.children.at(-1).getWorldPosition(new THREE.Vector3()),
      n:new THREE.Vector3(0,0,1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion())), u:new THREE.Vector3(1,0,0).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion())),
      v:new THREE.Vector3(0,1,0).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion())),w:m.children.at(-1).scale.x*m.scale.x,h:m.children.at(-1).scale.y*m.scale.y}));
    const center = room.getCenter(); let empty=0, overlap=0; const count=60000;
    for(let i=0;i<count;i++) {
      const y=1-2*(i+.5)/count,a=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y),ray=new THREE.Vector3(r*Math.cos(a),y,r*Math.sin(a));
      let hits=0;
      for(const plane of planes){const d=ray.dot(plane.n);if(d>=0)continue;
        const t=plane.center.clone().sub(center).dot(plane.n)/d;
        const p=ray.clone().multiplyScalar(t).add(center).sub(plane.center);
        if(Math.abs(p.dot(plane.u))<=plane.w/2&&Math.abs(p.dot(plane.v))<=plane.h/2)hits++;
      }
      if(!hits)empty++; if(hits>1)overlap++;
    }
    return {gap:100*empty/count,overlap};
  };
  let minimumGap;
  for (const value of [0, 1, 5, 15, 30]) {
    const lens = camera.projectionMatrix.clone(); gap.setValue(value);
    const actual = measureMosaic(room.monitors).photoFreeFraction * 100;
    if(value===0) {minimumGap=actual;check(actual>0&&actual<1,"Gap zero retains only sub-1% safety clearance for frames");}
    else check(Math.abs(actual-value)<1e-8,"Gap immediately reaches its angular dark-area target");
    check(camera.projectionMatrix.equals(lens)&&Math.abs(camera.zoom-1.8)<1e-12,"Gap does not change the lens or Size setting");
    const sample = measureActual();
    check(Math.abs(sample.gap-actual)<0.2&&sample.overlap===0,"actual loaded photo planes match the requested gap with no overlaps");
    check(room.monitors.every((m,i)=>m.children.at(-1)===before[i].screen&&m.children.at(-1).material===before[i].material
      &&m.children.at(-1).material.map===before[i].texture&&m.userData.photo===before[i].photo&&m.userData.mosaicCell===before[i].cell),
      "live gap tuning reuses every mesh, material, texture, assignment and packed cell");
    check(room.monitors.every(m=>Math.abs(m.children.at(-1).scale.x/m.children.at(-1).scale.y-m.userData.photo.width/m.userData.photo.height)<1e-9),
      "every live gap preserves original photograph proportions");
  }
  check(loads===20&&room.monitors.length===75&&room.photoMaterials.size===20,"all live controls perform zero texture reloads or panel creation");
  check(camera.position.equals(heldPosition)&&camera.quaternion.equals(heldQuaternion)&&director.mode==="inspect",
    "CameraDirector retains sole position/orientation ownership throughout tuning");
  gap.setValue(0);
  const assertFrameClearance = () => {
    room.group.updateWorldMatrix(true,true);
    const origin=room.getCenter();
    const tiles=room.monitors.map(m=>({center:m.children.at(-1).getWorldPosition(new THREE.Vector3()).sub(origin),normal:new THREE.Vector3(0,0,1).applyQuaternion(m.getWorldQuaternion(new THREE.Quaternion()))}));
  const boxes = room.monitors.map(m => new OBB(new THREE.Vector3(), new THREE.Vector3(0.5, 0.5, 0.5))
    .applyMatrix4(m.children[0].matrixWorld));
  const corners = room.monitors.map(m => {
    const points = [];
    for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5])
      points.push(m.children[0].localToWorld(new THREE.Vector3(x, y, z)).sub(origin));
    return points;
  });
  function hull(points) {
    points.sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const half = values => { const result = []; for (const p of values) {
      while (result.length >= 2 && cross(result.at(-2), result.at(-1), p) <= 0) result.pop(); result.push(p);
    } return result; };
    return [...half(points).slice(0, -1), ...half([...points].reverse()).slice(0, -1)];
  }
  let testedProjectedPairs = 0;
  for (let i = 0; i < 75; i++) for (let j = i + 1; j < 75; j++) {
    check(!boxes[i].intersectsOBB(boxes[j]), "no physical frame intersections");
    const a = tiles[i].center.clone().normalize(), b = tiles[j].center.clone().normalize();
    const angle = a.angleTo(b);
    const cone = (d, points) => Math.max(...points.map(p => d.angleTo(p)));
    if (angle > cone(a, corners[i]) + cone(b, corners[j])) continue;
    if (tiles[i].normal.dot(tiles[j].normal) < -0.99) {
      check(corners[i].every(p => p.dot(tiles[i].normal) < 0)
        && corners[j].every(p => p.dot(tiles[i].normal) > 0), "opposite sectors occupy disjoint viewing hemispheres");
      continue;
    }
    // Sector normals, unlike center-vector bisectors, provide a shared
    // gnomonic hemisphere even for very wide off-axis rectangular tiles.
    const n = tiles[i].normal.clone().add(tiles[j].normal).negate().normalize();
    check([...corners[i], ...corners[j]].every(p => p.dot(n) > 0), "projection plane contains both complete frame silhouettes");
    let u = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0));
    if (u.lengthSq() < 1e-8) u.crossVectors(n, new THREE.Vector3(1, 0, 0));
    u.normalize(); const v = new THREE.Vector3().crossVectors(n, u);
    const project = points => hull(points.map(p => new THREE.Vector2(p.dot(u) / p.dot(n), p.dot(v) / p.dot(n))));
    const pa = project(corners[i]), pb = project(corners[j]);
    let separated = false;
    for (const polygon of [pa, pb]) for (let k = 0; k < polygon.length; k++) {
      const edge = polygon[(k + 1) % polygon.length].clone().sub(polygon[k]);
      const axis = new THREE.Vector2(-edge.y, edge.x).normalize();
      const aa = pa.map(p => p.dot(axis)), bb = pb.map(p => p.dot(axis));
      if (Math.max(...aa) < Math.min(...bb) - 1e-9 || Math.max(...bb) < Math.min(...aa) - 1e-9) separated = true;
    }
    testedProjectedPairs++;
    check(separated, "full eight-corner frame silhouettes do not overlap: " + (i + 1) + "/" + (j + 1));
  }

  };
  assertFrameClearance();
  const saved = gui.save();
  check(Object.keys(saved.folders["Gallery / Cities"].controllers).length===0&&saved.controllers.Unrelated===17,
    "root Save serializes no gallery settings and preserves unrelated settings");
  const sizeBefore=tuning.settings.thumbnailSize,gapBefore=tuning.settings.gap;
  gui.load({controllers:{Unrelated:19},folders:{"Gallery / Cities":{controllers:{"Thumbnail Size (%)":40,"Gap (%)":20}}}});
  check(tuning.settings.thumbnailSize===sizeBefore&&tuning.settings.gap===gapBefore&&unrelated.value===19,
    "root Load ignores gallery tuning without changing unrelated load behavior");
  reset.object[reset.property]();
  check(tuning.settings.thumbnailSize===100&&camera.zoom===1.2&&Math.abs(tuning.settings.gap-baselineGap)<1e-10,
    "Reset restores initial slider and lens values immediately");
  check(room.monitors.every((m,i)=>Math.abs(m.userData.panelSize.width-before[i].width)<1e-8
    &&Math.abs(m.userData.panelSize.height-before[i].height)<1e-8),"Reset restores every original tile dimension");
  for (const magnification of [25,150]) {
    size.setValue(magnification); gap.setValue(5);
    camera.updateWorldMatrix(true,false);room.group.updateWorldMatrix(true,true);
    // At high magnification a photo may fill the viewport while its center is
    // offscreen. Select an actual visible pixel rather than a panel center.
    let clickable,click;
    for(const x of [.5,.35,.65,.2,.8])for(const y of [.5,.35,.65,.2,.8]){
      if(clickable)continue;
      const candidate={target:canvas,pointerId:77,button:0,buttons:1,timeStamp:0,clientX:x*1000,clientY:y*1000,
        preventDefault(){},stopImmediatePropagation(){}};
      const hit=controller.hitPhoto(candidate);if(hit){clickable=hit;click=candidate;}
    }
    check(!!clickable,"at least one visible photo pixel is selectable at each lens extreme");
    controller.down(click);controller.up({...click,buttons:0,timeStamp:100});
    check(!!controller.lightbox&&controller.lightbox.photo===clickable.userData.photo,"actual short-click raycasting opens the correct photo at both Size extremes"); controller.update();
    const box=controller.lightbox;
    check(folder.hidden,"gallery controls are hidden while the lightbox is open");
    const w=parseFloat(box.imageArea.style.width),h=parseFloat(box.imageArea.style.height);
    check(Math.abs(Math.max(w/1000,h/1000)-.7)<1e-9,"unchanged lightbox keeps its 70% viewport fit at both lens extremes");
    window.emit("keydown",{code:"Escape",repeat:false,preventDefault(){},stopImmediatePropagation(){this.stopped=true;}});
    controller.update();
    check(!controller.lightbox&&controller.opened&&!folder.hidden&&camera.position.equals(heldPosition)
      &&camera.quaternion.equals(heldQuaternion),"ESC returns to the same tuned gallery viewpoint and restores folder visibility");
  }
  const folderCount=gui.folders.length;
  for(let i=0;i<5;i++){
    controller.close();
    check(folder.hidden&&camera.zoom===1.2&&director.mode==="explore","leaving Cities hides controls and restores Earth lens");
    controller.open();director.update(1/60);controller.update();
    check(tuning.folder===folder&&gui.folders.length===folderCount&&Math.abs(camera.zoom-1.8)<1e-12
      &&Math.abs(tuning.settings.effectiveGap-5)<1e-8,"reentry reuses the room/folder and unsaved session values without lens drift");
  }
  check(loads===20,"reentering tuned gallery does not reload any photo");
  const pendingRoom=new GalleryRoom(new THREE.Group(),{photoLoader:async()=>new THREE.Texture()});
  setMosaicGap(pendingRoom.monitors,15); await pendingRoom.ready;
  check(pendingRoom.monitors.every(m=>m.children.at(-1).scale.x===m.userData.panelSize.width
    &&m.children.at(-1).scale.y===m.userData.panelSize.height)
    &&Math.abs(measureMosaic(pendingRoom.monitors).photoFreeFraction*100-15)<1e-8,
    "images completing after a live gap change use the latest dimensions without reloading");
  pendingRoom.dispose();
  theme.destroy();controller.dispose();
  check(folder.destroyed&&camera.zoom===1.2&&window.listeners.length===baseListeners&&document.body.children.length===0
    &&container.children.length===0,"theme exit restores lens and removes folder, gallery UI, resources and listeners");
  output.log(JSON.stringify({result:"PASS",checks,minimumSafeGapPercent:minimumGap,sliderSizeRange:[25,150],sliderGapRange:[0,30],
    textureLoads:loads,scope:"real CameraDirector, actual photo planes and projection; DOM/GUI doubles; no browser visual claim"}));
} finally {
  THREE.TextureLoader.prototype.load=textureLoad;Object.assign(console,output);
  delete globalThis.window;delete globalThis.document;delete globalThis.localStorage;
}
