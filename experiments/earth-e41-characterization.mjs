import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import * as THREE from "three";
import GUI, { Controller } from "lil-gui";
import { CitiesGalleryControls } from "../src/ui/CitiesGalleryControls.js";
import { EARTH_GALLERIES } from "../src/config/earthGalleries.js";
import { EARTH_SATELLITES } from "../src/systems/EarthSatellites.js";
import { EnvironmentTheme } from "../src/themes/EnvironmentTheme.js";
import { GalleryRoom } from "../src/systems/GalleryRoom.js";

import { measureMosaic, setMosaicGap, setMosaicRadius } from "../src/systems/GalleryLayout.js";

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
    this.domElement = {}; this.label = this._name = property;
  }
  name(label) { this.label = this._name = label; return this; }
  onChange(callback) { this.callback = callback; return this; }
  getValue() { return this.object[this.property]; }
  _callOnChange() { this.callback?.(this.getValue()); }
  _callOnFinishChange() {}
  save() { return Controller.prototype.save.call(this); }
  load(value) { return Controller.prototype.load.call(this,value); }
  disable() { this.disabled = true; return this; }
  updateDisplay() { this.displayed = this.object[this.property]; return this; }
  setValue(value) { return Controller.prototype.setValue.call(this,value); }
}
class Gui {
  constructor(parent = null, title = "G") { Object.assign(this, { parent, title, _title: title, folders: [], controllers: [], hidden: false }); }
  addFolder(title) { const folder = new Gui(this, title); this.folders.push(folder); return folder; }
  add(...args) { const controller = new GuiController(this, ...args); this.controllers.push(controller); return controller; }
  open() { this.opened = true; return this; }
  show(visible = true) { this.hidden = !visible; return this; }
  save(...args) { return GUI.prototype.save.apply(this, args); }
  load(...args) { return GUI.prototype.load.apply(this, args); }
  destroy() { this.destroyed = true; if (this.parent) this.parent.folders = this.parent.folders.filter(f => f !== this); }
}
const originalFetch=globalThis.fetch,originalBitmap=globalThis.createImageBitmap;
const requests=[],bitmaps=[];
globalThis.fetch=async url=>{requests.push(url);return {ok:true,blob:async()=>({})};};
globalThis.createImageBitmap=async()=>{const bitmap={closes:0,close(){this.closes++;}};bitmaps.push(bitmap);return bitmap;};
try {
  const gui=new Gui(),canvas=new Surface(),camera=new THREE.PerspectiveCamera(60,1,.1,100);
  const director=new CameraDirector(camera,canvas),container=new THREE.Group();
  const theme=new EnvironmentTheme(container,null);await theme.earth.ready;
  theme.visualFolder=gui.addFolder("Earth");
  director.setExploreTravel(theme.flight);director.returnHome(theme.getHomePose(),true);
  const home=director.position.clone(),heading=camera.getWorldDirection(new THREE.Vector3());
  const baseListeners=window.listeners.length;
  theme.initializeFlightControls({cameraDirector:director});
  let interaction=theme.galleryInteraction;
  const events=extra=>({target:canvas,pointerId:41,button:0,buttons:1,timeStamp:0,clientX:500,clientY:500,
    preventDefault(){},stopImmediatePropagation(){this.stopped=true;},...extra});
  const at=object=>{
    container.updateWorldMatrix(true,true);camera.updateWorldMatrix(true,false);
    const p=object.getWorldPosition(new THREE.Vector3()).project(camera);
    return events({clientX:(p.x+1)*500,clientY:(1-p.y)*500});
  };
  const escape=()=>window.emit("keydown",events({code:"Escape",repeat:false}));
  const clickSatellite=number=>{
    const e=at(theme.satellites.satellites[number-1]);
    check(interaction.hit(e)===number,"sphere raycast identifies satellite "+number);
    interaction.down(e);interaction.up({...e,buttons:0,timeStamp:100});
    director.update(1/60);interaction.update();
    check(interaction.opened&&interaction.activeGallery.config.number===number,"short click opens correct destination "+number);
  };
  const findPhotoPixel=()=>{
    camera.updateWorldMatrix(true,false);interaction.room.group.updateWorldMatrix(true,true);
    for(const x of [.5,.35,.65,.2,.8])for(const y of [.5,.35,.65,.2,.8]){
      const event=events({clientX:x*1000,clientY:y*1000});
      if(interaction.hitPhoto(event))return event;
    }
  };
  check(EARTH_GALLERIES.length===7&&interaction.galleries.size===7,"seven configuration records share one interaction owner");
  check(EARTH_GALLERIES.every((c,i)=>c.number===EARTH_SATELLITES[i].number&&c.name.toUpperCase()===EARTH_SATELLITES[i].title
    &&c.layout===(c.number===2?"CUBE":"SPHERICAL")),"configuration matches all satellite identities with Countries cube and unchanged spherical layouts");
  check(EARTH_GALLERIES.map(c=>c.plannedLayout).join(",")==="SPHERICAL,CUBE,IMMERSIVE_SPHERE,SPIRAL,TIMELINE_TUNNEL,CONSTELLATION,SPHERICAL",
    "future independent personalities are recorded without enabling new layouts");
  check([...interaction.galleries.values()].every(g=>!g.room&&g.controls.folder.hidden)&&gui.folders.length===8,
    "rooms are lazy; seven distinct settings folders register once before root Settings Load");
  check(window.listeners.length===baseListeners+6,"one set of six interaction listeners serves all destinations");
  check(!interaction.open(0)&&!interaction.open(8)&&!interaction.opened,"unknown destinations cannot open");
  for(const sphere of theme.satellites.satellites){
    check(interaction.hit(at(sphere.children[0]))===sphere.userData.number,"number badge targets its own satellite, ahead of neighbouring halos");
  }
  const first=theme.satellites.satellites[0],second=theme.satellites.satellites[1];
  const savedFirst=first.position.clone(),savedSecond=second.position.clone(),press=at(first);
  interaction.down(press);first.position.copy(savedSecond);second.position.copy(savedFirst);
  interaction.up({...press,buttons:0,timeStamp:100});
  check(!interaction.opened,"press and release resolving to different satellites cannot open a gallery");
  first.position.copy(savedFirst);second.position.copy(savedSecond);
  theme.satellites.group.updateWorldMatrix(true,true);
  second.position.copy(theme.satellites.group.worldToLocal(new THREE.Vector3(0,0,-4.2)));
  check(!interaction.hit(at(second)),"Earth blocks a satellite on its far side");
  second.position.copy(savedSecond);
  const baseline=new GalleryRoom(new THREE.Group(),{photoLoader:async()=>new THREE.Texture()});await baseline.ready;
  const baselineTiles=baseline.monitors.map(m=>({position:m.position.clone(),scale:m.scale.clone(),quaternion:m.quaternion.clone(),
    width:m.userData.panelSize.width,height:m.userData.panelSize.height,photo:m.userData.photo}));baseline.dispose();
  const rooms=new Map();
  // Countries preserves stationary-click discrimination and arbitrary entry poses.
  const countriesPress=at(second);
  interaction.down(countriesPress);
  interaction.move({...countriesPress,clientX:countriesPress.clientX+12});
  interaction.up({...countriesPress,clientX:countriesPress.clientX+12,buttons:0,timeStamp:100});
  check(!interaction.opened,"dragging over Countries cannot enter its cube");
  interaction.down(countriesPress);
  interaction.up({...countriesPress,buttons:0,timeStamp:500});
  check(!interaction.opened,"holding Countries longer than the acceptance threshold cannot enter");
  const customPose={position:new THREE.Vector3(1.5,-0.8,14),lookTarget:new THREE.Vector3(-2,1,-3)};
  director.returnHome(customPose,true);
  const customHeading=camera.getWorldDirection(new THREE.Vector3());
  check(interaction.open(2),"Countries can enter from an arbitrary exploration pose");
  director.update(1/60);
  check(camera.position.distanceTo(customPose.position)<1e-9,"cube inspection holds the actual entry position");
  const cubeLook=events();
  interaction.down(cubeLook);interaction.move({...cubeLook,clientX:580,clientY:540});
  interaction.up({...cubeLook,clientX:580,clientY:540,buttons:0,timeStamp:100});
  director.update(1/60);interaction.close();
  check(camera.position.distanceTo(customPose.position)<1e-9
    &&camera.getWorldDirection(new THREE.Vector3()).dot(customHeading)>.999999
    &&director.mode==="explore"&&director.freeFlight.active,"cube exit restores arbitrary entry position, heading and flight ownership");
  director.returnHome(theme.getHomePose(),true);
  // Visit placeholders before Cities to prove they start no city media workers.
  for(const number of [2,3,4,5,6,7,1]){
    clickSatellite(number);
    const g=interaction.activeGallery,room=interaction.room;await room.ready;
    rooms.set(number,room);
    check(room instanceof GalleryRoom&&room.layout===g.config.layout&&room.monitors.length===75,"shared room builds 75 panels in the selected layout for "+g.config.name);
    check(new Set(room.monitors.map(m=>m.userData.number)).size===75&&room.monitors.every(m=>number===1
      ? m.children.slice(2,-1).every(c=>!c.visible)&&m.children.at(-1).visible : m.children.slice(2).some(c=>c.visible)),
      number===1?"Cities retains its hidden loading glyphs":"placeholder panels have distinct visible mesh numbers");
    check(interaction.controls.dataset.earthGallery===g.config.id&&interaction.controls.children[0].textContent.startsWith(g.config.name.toUpperCase()),
      "destination identity appears in existing gallery overlay");
    check([...interaction.galleries.values()].filter(x=>x.controls.visible).length===1&&g.controls.visible,"only active destination GUI is visible");
    check(room.getCenter().distanceTo(home)<1e-9&&camera.position.distanceTo(home)<1e-9,"CameraDirector holds the visitor at the unchanged center");
    if(number!==1){
      check(room.content==="placeholders"&&room.photoMaterials.size===0&&!room.photoGeometry&&room.monitors.every(m=>m.userData.photoStatus==="placeholder"
        &&m.userData.photo.path.startsWith(g.config.id+"/placeholder-")&&m.children.every(c=>!c.material.map)),"placeholder destinations contain no Cities photographs or textures");
      check(requests.length===0&&bitmaps.length===0,"placeholder destinations launch zero media requests/decodes");

      check(!interaction.openLightbox(room.monitors[0])&&!interaction.hitPhoto(events()),"placeholders cannot open an empty lightbox");
    }else{
      check(requests.length===20&&room.photoMaterials.size===20,"Cities retains its original twenty shared photo textures");
      check(room.monitors.every((m,i)=>m.position.distanceTo(baselineTiles[i].position)<1e-9&&m.scale.distanceTo(baselineTiles[i].scale)<1e-9
        &&m.quaternion.equals(baselineTiles[i].quaternion)&&m.userData.photo===baselineTiles[i].photo
        &&Math.abs(m.userData.panelSize.width-baselineTiles[i].width)<1e-8&&Math.abs(m.userData.panelSize.height-baselineTiles[i].height)<1e-8),
        "Cities preserves original photo assignment, transforms, aspect ratios and dimensions");
      const e=findPhotoPixel();check(!!e,"Cities has a selectable real photo pixel");
      interaction.down(e);interaction.up({...e,buttons:0,timeStamp:100});interaction.update();
      check(!!interaction.lightbox&&g.controls.folder.hidden,"shared short-click path opens Cities lightbox and hides its GUI");
      escape();interaction.update();check(!interaction.lightbox&&interaction.opened&&!g.controls.folder.hidden,"first ESC returns from lightbox to Cities");
    }
    const radius=g.controls.folder.controllers.find(c=>c.property==="sphereRadius");
    check(number===2 ? !g.controls.radiusControl&&!radius&&g.controls.settings.sphereRadius===undefined
      : g.controls.radiusControl&&radius&&radius.min===10&&radius.max===20&&g.controls.settings.sphereRadius===10,
      "Countries omits Sphere Radius; all spherical destinations retain the safe shared control");
    if(radius){
      room.group.updateWorldMatrix(true,true);
      const panelSurface=m=>m.userData.photoStatus==="ready"?m.children.at(-1):m.children[1];
      const angle=m=>{
        const surface=panelSurface(m),center=room.getCenter();
        return surface.localToWorld(new THREE.Vector3(-.5,-.5,0)).sub(center)
          .angleTo(surface.localToWorld(new THREE.Vector3(.5,.5,0)).sub(center));
      };
      const geometryBefore=room.monitors.map(m=>({scale:m.scale.clone(),surfaceScale:panelSurface(m).scale.clone(),
        angle:angle(m),quaternion:m.quaternion.clone(),geometry:panelSurface(m).geometry,material:panelSurface(m).material}));
      const radiusPose=camera.position.clone(),radiusHeading=camera.quaternion.clone(),radiusLens=camera.projectionMatrix.clone(),
        gapBefore=g.controls.settings.gap,sizeBefore=g.controls.settings.thumbnailSize;
      radius?.setValue(20);
      check(room.monitors.every((m,i)=>m.scale.equals(geometryBefore[i].scale)&&panelSurface(m).scale.equals(geometryBefore[i].surfaceScale)
        &&m.quaternion.equals(geometryBefore[i].quaternion)&&panelSurface(m).geometry===geometryBefore[i].geometry
        &&panelSurface(m).material===geometryBefore[i].material&&angle(m)<geometryBefore[i].angle*.75),
        "every destination visibly reduces panel angular size at Radius 20 without scaling meshes or replacing resources");
      check(camera.position.equals(radiusPose)&&camera.quaternion.equals(radiusHeading)&&camera.projectionMatrix.equals(radiusLens)
        &&g.controls.settings.gap===gapBefore&&g.controls.settings.thumbnailSize===sizeBefore,
        "Radius leaves camera, Size and Gap settings unchanged for every destination");
      radius?.setValue(10);
      check(room.monitors.every((m,i)=>Math.abs(angle(m)-geometryBefore[i].angle)<1e-9),"returning Radius to 10 restores original angular panel sizes");
    }
    const before=camera.quaternion.clone(),drag=events();
    interaction.down(drag);interaction.move({...drag,clientX:550});interaction.up({...drag,clientX:550,buttons:0,timeStamp:100});
    director.update(1/60);
    check(!camera.quaternion.equals(before)&&camera.position.distanceTo(home)<1e-9&&!interaction.lightbox&&!interaction.lookPointer,
      "shared LMB drag looks around without moving the center or opening a lightbox");
    const size=g.controls.folder.controllers.find(c=>c.property==="thumbnailSize"),gap=g.controls.folder.controllers.find(c=>c.property==="gap");
    size.setValue(90+number*5);gap.setValue(number*2);
    radius?.setValue(10+number);
    gap.setValue(0);gap.setValue(number*2);
    check(g.controls.settings.sphereRadius===(number===2?undefined:10+number)&&room.monitors.every(m=>m.userData.mosaicRadius===(number===2?10:10+number)),
      "Gap changes retain each destination's independent Radius");
    const otherSettings=JSON.stringify([...interaction.galleries.values()].filter(other=>other!==g).map(other=>other.controls.settings));
    g.controls.settings.reset();
    check(g.controls.settings.thumbnailSize===100&&g.controls.settings.sphereRadius===(number===2?undefined:10)
      &&Math.abs(g.controls.settings.gap-g.controls.defaultGap)<1e-9&&camera.zoom===1
      &&room.monitors.every(m=>m.userData.mosaicRadius===10),"Reset restores Size, Gap and Radius for the active gallery");
    check(JSON.stringify([...interaction.galleries.values()].filter(other=>other!==g).map(other=>other.controls.settings))===otherSettings,
      "Reset leaves all other destination settings unchanged");
    size.setValue(90+number*5);gap.setValue(number*2);radius?.setValue(10+number);
    if(number%2)escape();else interaction.back.emit("click",{});
    check(!interaction.opened&&theme.earth.group.visible&&theme.satellites.group.visible&&!room.group.visible
      &&camera.position.distanceTo(home)<1e-9&&camera.getWorldDirection(new THREE.Vector3()).dot(heading)>.999999&&camera.zoom===1,
      "ESC/Back restores Earth, original lens and pose for "+g.config.name);
    check(document.body.children.length===0&&window.listeners.length===baseListeners+6,"closing removes overlay without accumulating listeners");
  }
  const saved=JSON.parse(JSON.stringify(gui.save()));
  for(const config of EARTH_GALLERIES){
    const values=saved.folders["Gallery / "+config.name].controllers;
    check(values["Thumbnail Size (%)"]===90+config.number*5&&values["Gap (%)"]===config.number*2
      &&values["Sphere Radius (units)"]===(config.number===2?undefined:10+config.number),"native root Save isolates every destination's settings");
  }
  const requestCount=requests.length;
  for(let cycle=0;cycle<3;cycle++)for(const config of EARTH_GALLERIES){
    clickSatellite(config.number);
    check(interaction.room===rooms.get(config.number)&&gui.folders.length===8&&document.body.children.length===1,
      "switching reuses bounded rooms and existing GUI folders with one overlay");
    check([...rooms.values()].filter(r=>r.group.visible).length===1&&window.listeners.length===baseListeners+6,
      "only selected room is visible; listener count stays fixed");
    check(interaction.layoutControls.settings.thumbnailSize===90+config.number*5&&interaction.layoutControls.settings.gap===config.number*2&&interaction.layoutControls.settings.sphereRadius===(config.number===2?undefined:10+config.number),
      "switching preserves separate tuning values without lens drift");
    interaction.close();
  }
  check(requests.length===requestCount&&bitmaps.length===20,"repeated gallery switching performs zero additional photo downloads/decodes");
  const watched=new Map();
  for(const room of rooms.values()){
    room.group.traverse(o=>{for(const resource of [o.geometry,o.material,o.material?.map].filter(Boolean)){
      if(!watched.has(resource)){watched.set(resource,0);resource.addEventListener("dispose",()=>watched.set(resource,watched.get(resource)+1));}
    }});
  }
  theme.initializeFlightControls({cameraDirector:director});
  check([...rooms.values()].every(r=>r.disposed&&r.abortController.signal.aborted&&!r.group.parent)&&[...watched.values()].every(n=>n===1)
    &&bitmaps.every(b=>b.closes===1),"reinitialization disposes every cached room, texture/bitmap, geometry and material exactly once");
  interaction=theme.galleryInteraction;
  check(gui.folders.length===8&&window.listeners.length===baseListeners+6,"reinitialization replaces all seven folders and observers without duplication");
  gui.load(saved);
  check([...interaction.galleries.values()].every(g=>!g.room&&g.controls.settings.thumbnailSize===90+g.config.number*5
    &&g.controls.settings.gap===g.config.number*2&&g.controls.settings.sphereRadius===(g.config.number===2?undefined:10+g.config.number)),"root Load restores every destination before its room exists");
  for(const number of [7,6,5,4,3,2,1]){
    clickSatellite(number);await interaction.room.ready;
    check(Math.abs(camera.zoom-(90+number*5)/100)<1e-12&&interaction.layoutControls.settings.gap===number*2&&interaction.layoutControls.settings.sphereRadius===(number===2?undefined:10+number)
      &&interaction.room.monitors.every(m=>m.userData.mosaicRadius===(number===2?10:10+number)),
      "restored settings apply only when the corresponding destination enters");
    interaction.close();
  }
  const legacy=JSON.parse(JSON.stringify(saved));
  for(const config of EARTH_GALLERIES)delete legacy.folders["Gallery / "+config.name].controllers["Sphere Radius (units)"];
  gui.load(legacy);
  check([...interaction.galleries.values()].every(g=>g.controls.settings.sphereRadius===(g.config.number===2?undefined:10)
    &&g.controls.settings.thumbnailSize===90+g.config.number*5&&g.controls.settings.gap===g.config.number*2),
    "older presets without Radius restore safe defaults for all seven while retaining independent Size and Gap");
  for(const config of EARTH_GALLERIES){
    clickSatellite(config.number);
    check(interaction.room.monitors.every(m=>m.userData.mosaicRadius===10),"legacy default radius applies on entry for every destination");
    interaction.close();
  }
  clickSatellite(3);
  gui.load(saved);
  check(interaction.layoutControls.settings.sphereRadius===13&&interaction.room.monitors.every(m=>m.userData.mosaicRadius===13)
    &&Math.abs(camera.zoom-1.05)<1e-12,"existing root Load restores active Water controls and meshes live");
  gui.load(legacy);
  check(interaction.layoutControls.settings.sphereRadius===10&&interaction.room.monitors.every(m=>m.userData.mosaicRadius===10),
    "older preset without Radius safely restores the active gallery live");
  interaction.close();
  clickSatellite(4);
  theme.destroy();interaction.dispose();
  check(window.listeners.length===baseListeners&&document.body.children.length===0&&container.children.length===0&&gui.folders.length===0
    &&bitmaps.every(b=>b.closes===1),"theme exit while a placeholder gallery is open cleans all rooms, controls, listeners and media exactly once");
  output.log(JSON.stringify({result:"PASS",checks,destinations:7,placeholderDestinations:6,panelsPerDestination:75,
    repeatedSwitches:21,initialCityRequests:requestCount,scope:"real geometry, CameraDirector, raycasting and native GUI serialization; DOM/HTTP doubles; no browser visual claim"}));
}finally{
  THREE.TextureLoader.prototype.load=textureLoad;Object.assign(console,output);
  globalThis.fetch=originalFetch;
  if(originalBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=originalBitmap;
  delete globalThis.window;delete globalThis.document;delete globalThis.localStorage;
}
