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
globalThis.document = Object.assign(new Surface(), { createElement: () => new Surface(), createTextNode: text => Object.assign(new Surface(), { textContent: text }), body: new Surface(), activeElement: null });
const presetStorage = new Map();
globalThis.localStorage = { getItem: key => presetStorage.get(key) ?? null, setItem: (key,value) => presetStorage.set(key,value) };
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
  interaction.update();
  check([...interaction.galleries.values()].every(g=>g.controls.folder.hidden),"no gallery folder is visible before first entry");
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
    &&c.layout===(c.number===2?"CUBE":c.number===3?"IMMERSIVE_SPHERE":c.number===4?"SPIRAL":c.number===5?"TIMELINE_TUNNEL":c.number===6?"CONSTELLATION":c.number===7?"PHYLLOTAXIS":"SPHERICAL")),"configuration matches all satellite identities with Countries cube, Water immersive sphere, Animals spiral, Events tunnel, Ethnicity constellation and Plants phyllotaxis");
  check(EARTH_GALLERIES.map(c=>c.plannedLayout).join(",")==="SPHERICAL,CUBE,IMMERSIVE_SPHERE,SPIRAL,TIMELINE_TUNNEL,CONSTELLATION,PHYLLOTAXIS",
    "all seven independent gallery personalities are recorded");
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
  const baselineControls=new CitiesGalleryControls(null,new THREE.PerspectiveCamera(),EARTH_GALLERIES[0],{getItem:()=>null});baselineControls.enter(baseline);await Promise.resolve();
  const baselineTiles=baseline.monitors.map(m=>({position:m.position.clone(),scale:m.scale.clone(),quaternion:m.quaternion.clone(),
    width:m.userData.panelSize.width,height:m.userData.panelSize.height,photo:m.userData.photo}));baselineControls.dispose();baseline.dispose();
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
  check(interaction.open(2),"Countries can enter from an arbitrary exploration pose");await interaction.room.ready;
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
  const waterPress=at(theme.satellites.satellites[2]);
  interaction.down(waterPress);interaction.move({...waterPress,clientX:waterPress.clientX+12});
  interaction.up({...waterPress,clientX:waterPress.clientX+12,buttons:0,timeStamp:100});
  check(!interaction.opened,"Water entry rejects flight drags");
  interaction.down(waterPress);interaction.up({...waterPress,buttons:0,timeStamp:500});
  check(!interaction.opened,"Water entry rejects long presses");
  director.returnHome(customPose,true);
  const waterHeading=camera.getWorldDirection(new THREE.Vector3());
  check(interaction.open(3),"Water enters from an arbitrary rendered pose");await interaction.room.ready;director.update(1/60);
  check(camera.position.distanceTo(customPose.position)<1e-9,"Water holds the visitor at the actual center");
  interaction.layoutControls.settings.gap=30;interaction.layoutControls.applyGap();
  interaction.layoutControls.settings.radius=20;interaction.layoutControls.applyRadius();
  interaction.layoutControls.settings.reset();interaction.close();
  check(camera.position.distanceTo(customPose.position)<1e-9
    &&camera.getWorldDirection(new THREE.Vector3()).dot(waterHeading)>.999999
    &&director.mode==="explore"&&director.freeFlight.active&&camera.zoom===1,
    "Water restores entry position, heading, lens and flight after controls/reset/return");
  director.returnHome(theme.getHomePose(),true);
  const eventsPress=at(theme.satellites.satellites[4]);
  interaction.down(eventsPress);interaction.move({...eventsPress,clientX:eventsPress.clientX+12});
  interaction.up({...eventsPress,clientX:eventsPress.clientX+12,buttons:0,timeStamp:100});
  check(!interaction.opened,"Events entry rejects flight drags");
  interaction.down(eventsPress);interaction.up({...eventsPress,buttons:0,timeStamp:500});
  check(!interaction.opened,"Events entry rejects long presses");
  director.returnHome(customPose,true);
  const eventsHeading=camera.getWorldDirection(new THREE.Vector3());
  check(interaction.open(5),"Events enters from an arbitrary rendered pose");await interaction.room.ready;director.update(1/60);
  check(camera.position.distanceTo(customPose.position)<1e-9&&interaction.room.getCenter().distanceTo(customPose.position)<1e-9,
    "timeline tunnel retains the actual visitor center without a camera jump");
  interaction.layoutControls.settings.gap=30;interaction.layoutControls.applyGap();
  interaction.layoutControls.settings.pictureSize=125;interaction.layoutControls.applySize();
  interaction.layoutControls.reset();interaction.close();
  check(camera.position.distanceTo(customPose.position)<1e-9
    &&camera.getWorldDirection(new THREE.Vector3()).dot(eventsHeading)>.999999
    &&director.mode==="explore"&&director.freeFlight.active&&camera.zoom===1,
    "Events restores arbitrary entry position, heading, lens and flight after controls/reset/return");
  director.returnHome(theme.getHomePose(),true);
  const constellationPress=at(theme.satellites.satellites[5]);
  interaction.down(constellationPress);interaction.move({...constellationPress,clientX:constellationPress.clientX+12});
  interaction.up({...constellationPress,clientX:constellationPress.clientX+12,buttons:0,timeStamp:100});
  check(!interaction.opened,"Ethnicity entry rejects flight drags");
  interaction.down(constellationPress);interaction.up({...constellationPress,buttons:0,timeStamp:500});
  check(!interaction.opened,"Ethnicity entry rejects long presses");
  director.returnHome(customPose,true);
  const constellationHeading=camera.getWorldDirection(new THREE.Vector3());
  check(interaction.open(6),"Ethnicity enters from an arbitrary rendered pose");await interaction.room.ready;director.update(1/60);
  check(camera.position.distanceTo(customPose.position)<1e-9&&interaction.room.getCenter().distanceTo(customPose.position)<1e-9,
    "constellation retains the actual visitor center without a camera jump");
  interaction.layoutControls.settings.gap=30;interaction.layoutControls.applyGap();
  interaction.layoutControls.settings.pictureSize=125;interaction.layoutControls.applySize();
  interaction.layoutControls.reset();interaction.close();
  check(camera.position.distanceTo(customPose.position)<1e-9
    &&camera.getWorldDirection(new THREE.Vector3()).dot(constellationHeading)>.999999
    &&director.mode==="explore"&&director.freeFlight.active&&camera.zoom===1,
    "Ethnicity restores arbitrary entry position, heading, lens and flight after controls/reset/return");
  director.returnHome(theme.getHomePose(),true);
  const plantsPress=at(theme.satellites.satellites[6]);
  interaction.down(plantsPress);interaction.move({...plantsPress,clientX:plantsPress.clientX+12});
  interaction.up({...plantsPress,clientX:plantsPress.clientX+12,buttons:0,timeStamp:100});
  check(!interaction.opened,"Plants entry rejects flight drags");
  interaction.down(plantsPress);interaction.up({...plantsPress,buttons:0,timeStamp:500});
  check(!interaction.opened,"Plants entry rejects long presses");
  director.returnHome(customPose,true);
  const plantsHeading=camera.getWorldDirection(new THREE.Vector3());
  check(interaction.open(7),"Plants enters from an arbitrary rendered pose");await interaction.room.ready;director.update(1/60);
  check(camera.position.distanceTo(customPose.position)<1e-9&&interaction.room.getCenter().distanceTo(customPose.position)<1e-9,
    "botanical dome retains the actual visitor center without a camera jump");
  interaction.layoutControls.settings.gap=30;interaction.layoutControls.applyGap();
  interaction.layoutControls.settings.pictureSize=125;interaction.layoutControls.applySize();
  interaction.layoutControls.reset();interaction.close();
  check(camera.position.distanceTo(customPose.position)<1e-9
    &&camera.getWorldDirection(new THREE.Vector3()).dot(plantsHeading)>.999999
    &&director.mode==="explore"&&director.freeFlight.active&&camera.zoom===1,
    "Plants restores arbitrary entry position, heading, lens and flight after controls/reset/return");
  director.returnHome(theme.getHomePose(),true);
  // Visit every collection before Cities to verify collection isolation.
  for(const number of [2,3,4,5,6,7,1]){
    clickSatellite(number);
    const g=interaction.activeGallery,room=interaction.room;await room.ready;
    rooms.set(number,room);
    check(room instanceof GalleryRoom&&room.layout===g.config.layout&&room.monitors.length===75,"shared room builds 75 panels in the selected layout for "+g.config.name);
    check(new Set(room.monitors.map(m=>m.userData.number)).size===75&&room.monitors.every(m=>m.children.slice(2,-1).every(c=>!c.visible)&&m.children.at(-1).visible),
      "All photo galleries retain hidden loading glyphs and visible photo planes");
    check(interaction.controls.dataset.earthGallery===g.config.id&&interaction.controls.children[0].textContent.startsWith(g.config.name.toUpperCase()),
      "destination identity appears in existing gallery overlay");
    check([...interaction.galleries.values()].filter(x=>x.controls.visible).length===1&&g.controls.visible,"only active destination GUI is visible");
    check(room.getCenter().distanceTo(home)<1e-9&&camera.position.distanceTo(home)<1e-9,"CameraDirector holds the visitor at the unchanged center");
    {
      check(room.content===g.config.id&&room.photoMaterials.size===(number===1?20:12),"each gallery uses its own collection and shared textures");
      if(number===1){
      check(room.monitors.every((m,i)=>m.position.distanceTo(baselineTiles[i].position)<1e-9&&m.scale.distanceTo(baselineTiles[i].scale)<1e-9
        &&m.quaternion.equals(baselineTiles[i].quaternion)&&m.userData.photo===baselineTiles[i].photo
        &&Math.abs(m.userData.panelSize.width-baselineTiles[i].width)<1e-8&&Math.abs(m.userData.panelSize.height-baselineTiles[i].height)<1e-8),
        "Cities preserves original photo assignment, transforms, aspect ratios and dimensions");
      }else{
        const counts=[...room.photoMaterials.keys()].map(path=>room.monitors.filter(m=>m.userData.photo.path===path).length);
        check(counts.every(n=>n===6||n===7)&&counts.filter(n=>n===7).length===3,"Countries and Water balance twelve originals across all 75 panels");
      }
      const e=findPhotoPixel();check(!!e,"photo gallery has a selectable loaded photo pixel");
      interaction.down(e);interaction.up({...e,buttons:0,timeStamp:100});interaction.update();
      check(!!interaction.lightbox&&g.controls.folder.hidden,"shared short-click path opens Cities lightbox and hides its GUI");
      if(number!==1){
        const photo=interaction.lightbox.photo,caption=interaction.lightbox.root.children.at(-1),credit=caption.children[0];
        check(interaction.lightbox.root.dataset.earthLightbox===g.config.id&&credit.children.filter(c=>c.href).length===2
          &&credit.children.some(c=>c.href===photo.source)&&credit.children.some(c=>c.href===photo.licenseURL),
          "photo lightboxes retain real creators and clickable source/license attribution");
        if(number===2) check(credit.children[0].textContent.startsWith(photo.attribution)
          &&interaction.lightbox.group.name==="CountriesPhotoLightbox", "Countries exposes its exact full archive attribution in the existing lightbox");
      }
      escape();interaction.update();check(!interaction.lightbox&&interaction.opened&&!g.controls.folder.hidden,"first ESC returns from lightbox to its photo gallery");
    }
    const radius=g.controls.folder.controllers.find(c=>c.property==="radius");
    check(g.controls.controllers.length===3&&!!radius,"all seven destinations expose three physical sliders");
    const lens=camera.projectionMatrix.clone(),radiusPose=camera.position.clone();
    radius.setValue(5);
    check(camera.position.equals(radiusPose)&&camera.projectionMatrix.equals(lens),"geometry-specific distance leaves camera and lens unchanged");
    g.controls.reset();
    const wheelFov=camera.fov,layoutBeforeZoom=JSON.stringify(room.monitors.map(m=>m.position.toArray()));
    interaction.opticalZoom.wheel({target:canvas,deltaY:-300,preventDefault(){},stopPropagation(){}});
    interaction.opticalZoom.update(1/60);
    check(camera.fov<wheelFov&&JSON.stringify(room.monitors.map(m=>m.position.toArray()))===layoutBeforeZoom,"gallery wheel zoom changes FOV without moving panels");
    const before=camera.quaternion.clone(),drag=events();
    interaction.down(drag);interaction.move({...drag,clientX:550});interaction.up({...drag,clientX:550,buttons:0,timeStamp:100});
    director.update(1/60);
    check(!camera.quaternion.equals(before)&&camera.position.distanceTo(home)<1e-9&&!interaction.lightbox&&!interaction.lookPointer,
      "shared LMB drag looks around without moving the center or opening a lightbox");
    const size=g.controls.folder.controllers.find(c=>c.property==="pictureSize"),gap=g.controls.folder.controllers.find(c=>c.property==="gap");
    const otherSettings=JSON.stringify([...interaction.galleries.values()].filter(other=>other!==g).map(other=>other.controls.settings));
    radius.setValue(number*.5);size.setValue(80+number);gap.setValue(number*2);
    check(camera.zoom===1&&g.controls.settings.radius===number*.5,"physical Size and Gap retain independent distance and lens");
    check(g.controls.save(),"active satellite preset saves independently");
    g.expectedSettings={pictureSize:g.controls.settings.pictureSize,gap:g.controls.settings.gap,radius:g.controls.settings.radius};
    g.controls.reset();
    check(g.controls.settings.pictureSize===g.controls.home.pictureSize&&g.controls.settings.gap===g.controls.home.gap&&g.controls.settings.radius===g.controls.home.radius&&camera.zoom===1,"Reset restores physical factory composition");
    check(JSON.stringify([...interaction.galleries.values()].filter(other=>other!==g).map(other=>other.controls.settings))===otherSettings,"Reset leaves other satellites unchanged");
    check(g.controls.load()&&Object.entries(g.expectedSettings).every(([k,v])=>g.controls.settings[k]===v),"active Load restores only its own saved preset");
    if(number%2)escape();else interaction.back.emit("click",{});
    check(!interaction.opened&&theme.earth.group.visible&&theme.satellites.group.visible&&!room.group.visible
      &&camera.position.distanceTo(home)<1e-9&&camera.getWorldDirection(new THREE.Vector3()).dot(heading)>.999999&&camera.zoom===1&&camera.fov===60,
      "ESC/Back restores Earth, original lens and pose for "+g.config.name);
    check(document.body.children.length===0&&window.listeners.length===baseListeners+6,"closing removes overlay without accumulating listeners");
  }
  const saved=JSON.parse(JSON.stringify(gui.save()));
  const expectedPresets=new Map([...interaction.galleries.values()].map(g=>[g.config.number,g.expectedSettings]));
  for(const config of EARTH_GALLERIES)check(Object.keys(saved.folders["Gallery / "+config.name].controllers).length===0,"root Save cannot mix gallery presets");
  const requestCount=requests.length;
  for(let cycle=0;cycle<3;cycle++)for(const config of EARTH_GALLERIES){
    clickSatellite(config.number);
    check(interaction.room===rooms.get(config.number)&&gui.folders.length===8&&document.body.children.length===1,
      "switching reuses bounded rooms and existing GUI folders with one overlay");
    check([...rooms.values()].filter(r=>r.group.visible).length===1&&window.listeners.length===baseListeners+6,
      "only selected room is visible; listener count stays fixed");
    check(Object.entries(expectedPresets.get(config.number)).every(([k,v])=>interaction.layoutControls.settings[k]===v)&&camera.zoom===1,"switching retains independent physical values without lens drift");
    interaction.close();
  }
  check(requests.length===requestCount&&bitmaps.length===92,"repeated gallery switching performs zero additional photo downloads/decodes");
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
  check([...interaction.galleries.values()].every(g=>!g.room&&g.controls.settings.pictureSize===g.controls.home.pictureSize),"root Load leaves independent defaults alone");
  for(const config of EARTH_GALLERIES){clickSatellite(config.number);await interaction.room.ready;
    check(Object.entries(expectedPresets.get(config.number)).every(([k,v])=>interaction.layoutControls.settings[k]===v)&&camera.zoom===1,"new theme lifecycle restores only active saved gallery");
    interaction.close();
  }
  clickSatellite(4);
  theme.destroy();interaction.dispose();
  check(window.listeners.length===baseListeners&&document.body.children.length===0&&container.children.length===0&&gui.folders.length===0
    &&bitmaps.every(b=>b.closes===1),"theme exit while a placeholder gallery is open cleans all rooms, controls, listeners and media exactly once");
  output.log(JSON.stringify({result:"PASS",checks,destinations:7,placeholderDestinations:0,panelsPerDestination:75,
    repeatedSwitches:21,initialCityRequests:20,initialCountriesRequests:12,initialWaterRequests:12,initialOtherSatelliteRequests:48,totalInitialPhotoRequests:requestCount,scope:"real geometry, CameraDirector, raycasting and native GUI serialization; DOM/HTTP doubles; no browser visual claim"}));
}finally{
  THREE.TextureLoader.prototype.load=textureLoad;Object.assign(console,output);
  globalThis.fetch=originalFetch;
  if(originalBitmap===undefined)delete globalThis.createImageBitmap;else globalThis.createImageBitmap=originalBitmap;
  delete globalThis.window;delete globalThis.document;delete globalThis.localStorage;
}
