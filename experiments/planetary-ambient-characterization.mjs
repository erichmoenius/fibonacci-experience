import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { SolarSystem, SOLAR_AMBIENT } from '../src/systems/SolarSystem.js';
import Gateway from '../src/systems/cinematic/Gateway.js';

// Compare the interactive Earth path and unchanged rates to the checkpoint.
const baselineSource=execFileSync('git',['show','HEAD:src/systems/SolarSystem.js'],{encoding:'utf8'})
  .replace('from "three"',`from ${JSON.stringify(import.meta.resolve('three'))}`)
  .replace('from "./EarthGlobe.js"',`from ${JSON.stringify(import.meta.resolve('../src/systems/EarthGlobe.js'))}`);
const {SolarSystem:BaselineSolarSystem}=await import('data:text/javascript;base64,'+Buffer.from(baselineSource).toString('base64'));
const originalLoad=THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load=function(url,onLoad){const texture=new THREE.Texture({width:4096,height:2048});onLoad(texture);return texture;};
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
const near=(a,b,m)=>check(Math.abs(a-b)<1e-8,m);
try{
 const snapshots=[];
 for(const fps of [30,60,120]){
  const scene=new THREE.Scene(),current=new SolarSystem(scene),baseline=new BaselineSolarSystem(new THREE.Group());
  await Promise.all([current.earthGlobe.ready,baseline.earthGlobe.ready]);
  const gateway=new Gateway(new THREE.Vector3(),10,current.earth);
  const surfaceMap=current.sun.material.map,coronaMap=current.corona.material.map;
  let minScale=Infinity,maxScale=0,minOpacity=1,maxOpacity=0;
  for(let frame=0;frame<fps*24;frame++){
   // No audio state is provided or read.
   current.update(1/fps);baseline.update(1/fps);
   minScale=Math.min(minScale,current.corona.scale.x);maxScale=Math.max(maxScale,current.corona.scale.x);
   minOpacity=Math.min(minOpacity,current.corona.material.opacity);maxOpacity=Math.max(maxOpacity,current.corona.material.opacity);
   if(frame%fps===0){
    for(const [name,planet] of current.planets){
     const old=baseline.planets.get(name);
     const elapsed=(frame+1)/fps;
     if(['Earth','Mercury','Venus','Mars'].includes(name)) near(planet.orbit.rotation.y,old.orbit.rotation.y,'established orbit retained: '+name);
     else {near(planet.orbit.rotation.y-planet.definition.phase,elapsed*.003,'gentle outer orbital floor: '+name);check(planet.orbit.rotation.y>old.orbit.rotation.y,'outer orbit visibly advances');}
     if(name!=='Venus') near(planet.body.rotation.y,old.body.rotation.y,'established axial rotation retained: '+name);
     else {near(planet.body.rotation.y,-elapsed*.006,'Venus retains gentle retrograde spin');check(planet.body.rotation.y<0,'retrograde direction retained');}
     if(name==='Earth') check(planet.body.getWorldPosition(new THREE.Vector3()).distanceTo(old.body.getWorldPosition(new THREE.Vector3()))<1e-8,'interactive Earth world path preserved');
     if(name==='Saturn') for(const ring of planet.body.parent.children.filter(child=>child.geometry?.type==='RingGeometry')){
      check(ring.parent===planet.body.parent,'Saturn rings retain shared tilt parent');
      near(ring.rotation.x,-Math.PI/2,'ring local plane retained');
      check(ring.getWorldPosition(new THREE.Vector3()).distanceTo(planet.body.getWorldPosition(new THREE.Vector3()))<1e-8,'rings follow Saturn center');
     }
    }
    check(gateway.resolvePosition().distanceTo(current.earth.getWorldPosition(new THREE.Vector3()))<1e-8,'gateway tracks live Earth');
    check(gateway.contains(gateway.position.clone()),'gateway accepts its live center');
   }
  }
  near(current.sun.rotation.y,24*.025,'restrained Sun surface turn');
  near(current.moonOrbit.rotation.y,baseline.moonOrbit.rotation.y,'Moon orbit retained');
  near(current.clouds.rotation.y,baseline.clouds.rotation.y,'Earth cloud drift retained');
  near(current.corona.scale.x,17,'one full breath returns to base scale');
  near(current.corona.material.opacity,1,'one full breath returns to base opacity');
  check(minScale>=17*(1-.025)-1e-8&&maxScale<=17*(1+.025)+1e-8,'scale remains restrained');
  near(maxScale,17*(1+.025),'scale reaches configured amplitude');
  near(minOpacity,.96,'opacity reaches configured minimum');
  check(maxOpacity<=1,'no increase in corona brightness');
  check(current.sun.material.map===surfaceMap&&current.corona.material.map===coronaMap,'materials and textures retained');
  snapshots.push([...current.planets.values()].map(p=>[p.orbit.rotation.y,p.body.rotation.y]).flat());
  current.ambientMotion.coronaScaleAmount=0;current.ambientMotion.coronaOpacityAmount=0;current.update(.016);
  near(current.corona.scale.x,17,'scale breath can be disabled');near(current.corona.material.opacity,1,'opacity breath can be disabled');
  const updateMethod=readFileSync('src/themes/PlanetaryTheme.js','utf8').match(/  update\(state\) \{[\s\S]*?\n  \}/)[0];
  const updateTheme=new Function('return ({'+updateMethod+'}).update;')();
  const theme={lastUpdateTime:12,solarSystem:current};
  const firstFrameSun=current.sun.rotation.y;
  const firstFrameEarth=current.earthOrbit.rotation.y;
  updateTheme.call(theme,{time:12+1/fps,audio:{bass:0,mid:0,high:0,energy:0}});
  check(current.sun.rotation.y>firstFrameSun&&current.earthOrbit.rotation.y>firstFrameEarth,'first post-arrival frame advances with silent audio');
  check(gateway.resolvePosition().distanceTo(current.earth.getWorldPosition(new THREE.Vector3()))<1e-8,'gateway remains aligned after post-arrival theme update');
  current.dispose();baseline.dispose();check(scene.children.length===0,'normal theme resource cleanup retained');
 }
 for(let i=1;i<snapshots.length;i++)for(let j=0;j<snapshots[0].length;j++)near(snapshots[i][j],snapshots[0][j],'frame-rate-independent orbital/axial motion');
 check(SOLAR_AMBIENT.coronaBreathSeconds===12,'12-second idle cycle');
 console.log('Planetary ambient A1: PASS ('+checks+' checks; silent motion, preserved Earth/fast-planet paths, subtle slow-planet rates, Saturn rings, live Earth gateway, amplitude, 30/60/120 FPS, cleanup)');
}finally{THREE.TextureLoader.prototype.load=originalLoad;}
