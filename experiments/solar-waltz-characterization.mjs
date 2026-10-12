import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import * as THREE from 'three';
import { SolarWaltz, SOLAR_WALTZ } from '../src/systems/cinematic/SolarWaltz.js';
import { SolarSystem } from '../src/systems/SolarSystem.js';
import { PlanetaryFlight } from '../src/systems/PlanetaryFlight.js';
const cache = new Map();
async function moduleURL(path) {
  path = resolve(path);
  if (cache.has(path)) return cache.get(path);
  let source = readFileSync(path, "utf8")
    .replaceAll("import.meta.env.BASE_URL", '"/"')
    .replaceAll("import.meta.env.DEV", "false");
  for (const match of [...source.matchAll(/from\s+["']([^"']+)["']/g)]) {
    const spec = match[1];
    const url = spec.startsWith(".")
      ? await moduleURL(resolve(dirname(path), spec + (extname(spec) ? "" : ".js")))
      : import.meta.resolve(spec);
    source = source.replace(match[0], `from ${JSON.stringify(url)}`);
  }
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  cache.set(path, url);
  return url;
}
Error.stackTraceLimit=0;
const {default:CameraDirector}=await import(await moduleURL('src/systems/cinematic/CameraDirector.js'));
const {default:JourneyDirector}=await import(await moduleURL('src/systems/cinematic/JourneyDirector.js'));
const {Journey2}=await import(await moduleURL('src/systems/cinematic/Journey2.js'));
const source=readFileSync('src/core/App.js','utf8');
function method(name){
 const start=source.indexOf('\n  '+name+'(')+1,tail=source.slice(start);
 const next=tail.slice(1).search(/\n  [a-zA-Z]\w*\(/)+1;
 const text=source.slice(start,next>0?start+next:source.lastIndexOf('\n}'));
 return new Function('THREE','SolarWaltz','return ({'+text+'}).'+name+';')(THREE,SolarWaltz);
}
function callback(app,name){const marker='this.journeyDirector.'+name+' = ',start=source.indexOf(marker)+marker.length,end=source.indexOf('\n    };',start)+6;return new Function('return '+source.slice(start,end)+';').call(app);}
function escape(app){const start=source.indexOf('if (e.code === "Escape" && !e.repeat) {');let depth=0,end=start;for(let i=source.indexOf('{',start);i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}'&&--depth===0){end=i+1;break;}}new Function('e',source.slice(start,end)).call(app,{code:'Escape',repeat:false});}
const surface={addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})};
globalThis.window={...surface,innerWidth:1000,innerHeight:1000};globalThis.document={...surface};
const originalLoad=THREE.TextureLoader.prototype.load,originalLog=console.log,originalWarn=console.warn,originalTrace=console.trace;
THREE.TextureLoader.prototype.load=function(url,onLoad){const t=new THREE.Texture({width:4096,height:2048});onLoad(t);return t;};
console.log=console.warn=console.trace=()=>{};
let checks=0,minClearance=Infinity,maxStep=0;
const check=(v,m)=>{assert.ok(v,m);checks++;};const near=(a,b,m)=>check(Math.abs(a-b)<1e-7,m);
function fixture(){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,320);scene.add(camera);
 const cd=new CameraDirector(camera,surface),jd=new JourneyDirector(cd);
 const home={position:new THREE.Vector3(10,10,48),lookTarget:new THREE.Vector3(10,0,0)};
 cd.returnHome(home,true);
 let system=new SolarSystem(scene);
 const theme={solarSystem:system,getHomePose:()=>home,getGateways:()=>[]};
 const app={time:12,cameraDirector:cd,journeyDirector:jd,acceptanceClick:{},isGUIEvent:()=>false,
  renderer:{clearJourney2Dissolve(){},fadeIn(){}},transitSystem:{stop(){}},
  themeManager:{activeTheme:theme,activeThemeName:'planetary',activate(name){this.activeThemeName=name;this.activeTheme=name==='planetary'?theme:{getHomePose:()=>home,getGateways:()=>[]};}},
  applyActiveThemeFlight(){cd.setExploreTravel(this.themeManager.activeTheme===theme?new PlanetaryFlight(system):null);},initializeActiveTheme(){},};
 for(const name of ['startSolarWaltz','updateSolarWaltz','stopSolarWaltz','resetAcceptanceClick','disarmArmedInvitation','beginAcceptanceClick','acceptReadyProximityGateway','beginGatewayJourney','switchDevelopmentTheme'])app[name]=method(name);
 app.applyActiveThemeFlight();
 return {app,scene,camera,cd,jd,system,home,theme};
}
try{
 for(const fps of [30,60,120]){
  const f=fixture();await f.system.earthGlobe.ready;
  const before=f.camera.position.clone(),beforeQ=f.camera.quaternion.clone();
  check(f.app.startSolarWaltz(),'starts once');const provider=f.app.solarWaltz;
  check(!f.app.startSolarWaltz(),'duplicate start rejected');
  check(f.cd.mode==='travel'&&!f.cd.freeFlight.active,'TRAVEL suspends FreeFlight');
  check(f.camera.position.distanceTo(before)<1e-8&&f.camera.quaternion.angleTo(beforeQ)<1e-7,'no starting camera jump');
  check(f.app.acceptReadyProximityGateway({button:0})===false&&f.app.beginGatewayJourney(null)===false,'both acceptance and direct journey start blocked');
  f.app.beginAcceptanceClick({button:0,pointerId:77});check(f.app.acceptanceClick.pointerId===null,'press during Waltz cannot arm a later acceptance');
  let angularTravel=0,lastAngle=provider.startAngle,lastPosition=before.clone(),lastQ=beforeQ.clone();
  for(let frame=1;frame<=fps*18;frame++){
   f.app.time=12+frame/fps;f.system.update(1/fps);f.app.updateSolarWaltz();f.cd.update(1/fps);
   const center=f.system.getSunWorldPosition(new THREE.Vector3()),offset=f.camera.position.clone().sub(center);
   const angle=Math.atan2(offset.x,offset.z),difference=Math.atan2(Math.sin(angle-lastAngle),Math.cos(angle-lastAngle));
   angularTravel+=difference;lastAngle=angle;
   const step=f.camera.position.distanceTo(lastPosition);maxStep=Math.max(maxStep,step);
   check(step<28/fps,'continuous restrained camera displacement');check(f.camera.quaternion.angleTo(lastQ)<1.5/fps,'continuous gaze');
   near(Math.hypot(offset.x,offset.z),provider.radius,'constant horizontal orbit radius');
   for(const [name,planet] of f.system.planets){
    const bounds=[planet.body,...planet.body.parent.children.filter(child=>child.geometry?.type==='RingGeometry')];
    for(const mesh of bounds){mesh.geometry.computeBoundingSphere();const scale=mesh.getWorldScale(new THREE.Vector3());const clearance=f.camera.position.distanceTo(mesh.getWorldPosition(new THREE.Vector3()))-mesh.geometry.boundingSphere.radius*Math.max(scale.x,scale.y,scale.z);minClearance=Math.min(minClearance,clearance);check(clearance>2,'planet/ring clearance: '+name);}
   }
   lastPosition.copy(f.camera.position);lastQ.copy(f.camera.quaternion);
   if(provider.completed)f.app.stopSolarWaltz();
  }
  near(angularTravel,Math.PI*2,'actual camera completes exactly 360 degrees');
  near(provider.elapsed,18,'18-second completion');check(!f.app.solarWaltz&&provider.disposed&&provider.sun===null,'presentation disposed on completion');
  check(f.cd.mode==='explore'&&f.cd.freeFlight.active,'FreeFlight restored');
  check(f.camera.position.distanceTo(before)<1e-7,'ends at starting location');check(f.cd.currentTarget.distanceTo(f.system.getSunWorldPosition(new THREE.Vector3()))<1e-8,'final gaze points at live Sun');
  const finalPose=f.camera.position.clone(),finalQ=f.camera.quaternion.clone();for(let n=0;n<10;n++)f.cd.update(1/fps);
  check(f.camera.position.distanceTo(finalPose)<1e-8&&f.camera.quaternion.angleTo(finalQ)<1e-7,'stationary first exploration frames; no handoff jump');
  check(f.app.startSolarWaltz(),'replay creates fresh provider');const replay=f.app.solarWaltz;check(replay!==provider&&replay.elapsed===0,'replay reset');
  f.app.time+=4;f.app.updateSolarWaltz();f.cd.update(1/fps);escape(f.app);
  check(!f.app.solarWaltz&&replay.disposed&&f.cd.journey===null&&f.cd.mode==='return','actual ESC cancels through Return Home');
  f.cd.returnHome(f.home,true);f.app.startSolarWaltz();const exit=f.app.solarWaltz;f.app.switchDevelopmentTheme('space');
  check(exit.disposed&&!f.app.solarWaltz&&f.cd.journey===null,'actual theme switch disposes presentation');
  f.system.dispose();
 }
 // Smooth start/end velocity and acceleration of the provider itself.
 const sun=new THREE.Object3D(),pose={position:new THREE.Vector3(10,10,48),lookTarget:new THREE.Vector3(10,0,0)};
 const p=new SolarWaltz(sun,pose,0);p.update(.001);check(p.angle<1e-8&&p.pose.position.distanceTo(pose.position)<1e-7,'zero-speed smooth start');
 p.update(17.999);check(Math.PI*2-p.angle<1e-8&&p.pose.position.distanceTo(pose.position)<1e-7,'zero-speed smooth end');p.dispose();
 // Actual JourneyDirector completion dispatch starts a Waltz once at t=12.
 const f=fixture();await f.system.earthGlobe.ready;
 f.app.time=0;const j=new Journey2();const finished=callback(f.app,'onJourneyFinished');let finishes=0;
 f.jd.onJourneyFinished=()=>{finishes++;finished();};f.cd.beginJourney(j);f.jd.begin(j);
 for(let frame=1;frame<=720;frame++){f.app.time=frame/60;f.cd.update(1/60);f.jd.update(f.cd.getPosition(),1/60);}
 check(finishes===1&&!f.jd.isActive()&&f.app.solarWaltz,'one Waltz follows completed Journey 2');near(f.app.solarWaltz.startTime,12,'starts at 12 seconds');
 f.app.stopSolarWaltz();f.system.dispose();
 console.log=originalLog;console.log(JSON.stringify({checks,minClearance,maxStep,duration:SOLAR_WALTZ.duration}));console.log('Solar Waltz S1: PASS (actual camera 360 degrees, start/end continuity, 30/60/120 FPS, rings, FreeFlight, gateway blocking, ESC, theme exit, replay, completion hook)');
}catch(error){console.log=originalLog;console.error(error.message);process.exitCode=1;}finally{THREE.TextureLoader.prototype.load=originalLoad;console.log=originalLog;console.warn=originalWarn;console.trace=originalTrace;}
