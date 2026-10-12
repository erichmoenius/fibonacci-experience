import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import * as THREE from 'three';
import Gateway from '../src/systems/cinematic/Gateway.js';
import TransitSystem from '../src/systems/transit/TransitSystem.js';
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
const { default: CameraDirector } = await import(await moduleURL('src/systems/cinematic/CameraDirector.js'));
const { default: JourneyDirector } = await import(await moduleURL('src/systems/cinematic/JourneyDirector.js'));
const { Journey2 } = await import(await moduleURL('src/systems/cinematic/Journey2.js'));
const { GalaxyTheme } = await import(await moduleURL('src/themes/GalaxyTheme.js'));
const appSource=readFileSync('src/core/App.js','utf8');
function callback(app,name){
 const marker='this.journeyDirector.'+name+' = ';
 const start=appSource.indexOf(marker)+marker.length,end=appSource.indexOf('\n    };',start)+6;
 return new Function('return '+appSource.slice(start,end)+';').call(app);
}
const surface={addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})};
globalThis.window={...surface,innerWidth:1000,innerHeight:1000};globalThis.document={...surface};
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
const originalLog=console.log;console.log=()=>{};console.trace=()=>{};console.warn=()=>{};
try{
 for(const fps of [30,60,120]){
  const camera=new THREE.PerspectiveCamera(60,1,.1,450);camera.position.z=10;camera.lookAt(0,0,0);
  const cd=new CameraDirector(camera,surface);cd.returnHome({position:new THREE.Vector3(0,0,10),lookTarget:new THREE.Vector3()},true);
  const jd=new JourneyDirector(cd),ts=new TransitSystem(),scene=new THREE.Scene();
  scene.add(camera);const container=new THREE.Group();scene.add(container);
  const galaxy=Object.create(GalaxyTheme.prototype);
  Object.assign(galaxy,{container,journeyDirector:jd,transitSystem:ts,
   galaxy:{update(){},destroy(){}},plasmaFilaments:{update(){},dispose(){}},cosmos:{dispose(){}},lastUpdateTime:null});
  const planet={earthGateway:{},getHomePose:()=>({position:new THREE.Vector3(10,10,48),lookTarget:new THREE.Vector3(10,0,0)}),getGateways:()=>[]};
  let births=0;const fades=[];
  const app={cameraDirector:cd,journeyDirector:jd,transitSystem:ts,
   renderer:{fadeOut:t=>fades.push(['out',t]),fadeIn:t=>fades.push(['in',t])},
   applyActiveThemeFlight(){},initializeActiveTheme(){},
   themeManager:{activeTheme:galaxy,themes:new Map([['planetary',planet]]),activate(){galaxy.destroy();this.activeTheme=planet;births++;}}};
  for(const name of ['onApproach','onHorizon','onSingularity','onTransit','onVoidStart','onBirth','onTransitEnd','onJourneyFinished'])jd[name]=callback(app,name);
  const target=new THREE.Object3D();scene.add(target);scene.updateMatrixWorld(true);
  const journey=new Journey2();cd.beginJourney(journey);jd.begin(journey,target,{target,direction:new THREE.Vector3(0,0,1),endpointDistance:.75},'planetary');
  journey.getFrameDelta(0);let time=0;
  while(jd.isActive()&&time<13){time+=1/fps;const delta=journey.getFrameDelta(time);cd.update(jd.getScaledDelta(delta));jd.update(cd.getPosition(),delta);ts.update(.016);if(app.themeManager.activeTheme===galaxy)galaxy.update({time,audio:{}});}
  check(Math.abs(time-12)<=1/fps+1e-6,'actual camera/callback flow completes in 12 seconds at '+fps);
  check(births===1,'one Planetary activation');check(cd.position.distanceTo(planet.getHomePose().position)<1e-8,'camera adopts Planetary endpoint');
  check(!ts.isActive()&&!galaxy.fractalTransit,'transit and blackout released');
  check(JSON.stringify(fades)===JSON.stringify([['out',.15],['in',.35]]),'Journey 2-specific short fades');
  check(cd.approachDuration===3&&cd.horizonDuration===3&&cd.crossingDuration===4,'shared camera defaults never mutated');
  // A subsequent Journey 1 still gets its original three-second arrival flight.
  cd.journey={id:'engine'};check(cd.createFlight(planet.getHomePose()).duration===3,'Journey 1 arrival duration retained');
  cd.journey=null;
 }
 const themeSource=readFileSync('src/themes/GalaxyTheme.js','utf8');
 const radius=Number(themeSource.match(/new Gateway\(\s*new THREE.Vector3\(\),\s*(\d+)/)[1]);
 const gateway=new Gateway(new THREE.Vector3(),radius);
 check(radius===10,'production Special Star activation radius is 10');
 check(gateway.contains(new THREE.Vector3(10,0,0))&&!gateway.contains(new THREE.Vector3(10.001,0,0)),'10 world-unit boundary');
 console.log=originalLog;console.log('Journey 2 H3 camera/handoff: PASS ('+checks+' checks, actual callbacks at 30/60/120 FPS)');
}catch(error){console.log=originalLog;console.error(error.message);process.exitCode=1;}finally{console.log=originalLog;}
