import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { EarthJourney, EARTH_PHASES, descentEase } from '../src/systems/cinematic/EarthJourney.js';
import { JourneyPlasma, plasmaEnvelope, cloudEnvelope } from '../src/systems/cinematic/JourneyPlasma.js';
import { entryVeil } from '../src/systems/cinematic/JourneyAtmosphere.js';
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
const element=()=>({style:{background:'black',transition:'opacity 1s linear',opacity:'0'},children:[],appendChild(c){this.children.push(c);c.parent=this;},remove(){this.parent.children=this.parent.children.filter(c=>c!==this);}});
globalThis.document={createElement:element};const log=console.log;console.log=()=>{};
try {
 check(plasmaEnvelope(1)===0&&plasmaEnvelope(3.5)===1&&plasmaEnvelope(4.5)===0,'clean PULL and fire crescendo/end');
 check(cloudEnvelope(4.5)===0&&cloudEnvelope(5.3)===1&&cloudEnvelope(6.5)===0,'rushing cloud window');
 check([6.5,7.18,7.82,8,10].every(t=>entryVeil(t)===0)&&entryVeil(7.5)===1,'brief veil synchronized with existing handoff');
 let denseMask=0,first=Infinity,last=0;
 for(let n=0;n<=2000;n++){
  const time=n*.005,reveal=time<7.5?1:1-descentEase(7.5,10,time),opacity=entryVeil(time)*reveal;
  if(opacity>.9){denseMask+=.005;first=Math.min(first,time);last=time;}
  check(!(plasmaEnvelope(time)>0&&cloudEnvelope(time)>0),'one effect mode per clock sample');
 }
 check(denseMask>=.3&&denseMask<=.5,'opaque cloud envelope preserves the brief handoff budget');
 const scene=new THREE.Scene(),texture=new THREE.Texture({width:4096,height:2048}),owner=new THREE.Group();owner.material={uniforms:{cloudMap:{value:texture},sunDirection:{value:new THREE.Vector3(-1,.2,.1).normalize()}}};scene.add(owner);
 let td=0;texture.addEventListener('dispose',()=>td++);const effect=new JourneyPlasma(owner);
 effect.update(3.5,.6);check(effect.mesh.material.blending===THREE.AdditiveBlending&&effect.cloudIntensity===0,'warm additive fire mode');
 effect.update(5.3,.9);check(effect.mesh.material.blending===THREE.NormalBlending&&effect.uniforms.uCloudMap.value===texture&&effect.uniforms.uCloudAvailable.value===1,'cloud mode borrows existing texture with normal alpha');
 const source=readFileSync('src/systems/cinematic/JourneyPlasma.js','utf8');check(source.includes('layer * 0.52')&&source.includes('layer * 0.28'),'different projected layer drift and approach speeds');
 effect.update(6.5,1);effect.dispose();check(effect.disposed&&!effect.mesh.parent&&td===0&&effect.uniforms.uCloudMap.value===null,'release own resources before BIRTH, leave borrowed map untouched');texture.dispose();
 const root=new THREE.Scene(),earth=new THREE.Mesh(new THREE.SphereGeometry(2));earth.position.x=22;root.add(earth);const center=earth.getWorldPosition(new THREE.Vector3()),j=new EarthJourney();
 j.prepareDescent({camera:{near:.1},position:center.clone().add(new THREE.Vector3(0,0,10)),currentTarget:center},earth,element());j.start();
 let births=0,voidOpacity; j.onEvent=e=>{if(e==='void'){j.maskHandoff();voidOpacity=j.atmosphere.whiteout;}if(e==='birth'){j.maskHandoff();check(j.atmosphere.whiteout===1,'theme switch fully obscured');births++;j.setArrivalPose({position:new THREE.Vector3(0,0,6.5),lookTarget:new THREE.Vector3()});}};
 for(let i=0;i<1000&&!j.completed;i++)j.update(.01);
 check(voidOpacity===0&&births===1&&j.completed&&j.elapsed===10,'no premature VOID whiteout, exactly one handoff and ten-second completion');
 check(j.plasma===null&&j.atmosphere.cleared&&root.children.length===1,'effects and curtain released');earth.geometry.dispose();earth.material.dispose();
 check(EARTH_PHASES.reduce((n,p)=>n+p.duration,0)===10&&EARTH_PHASES.at(-1).start===7.5,'phase schedule unchanged');
 const checkpoint='78f72485b05b68be116ea4d11faaf1e9848e788d';const baseline=p=>execFileSync('git',['show',checkpoint+':'+p],{encoding:'utf8'}).replaceAll('\r\n','\n');
 const journey=readFileSync('src/systems/cinematic/EarthJourney.js','utf8').replaceAll('\r\n','\n');const old=baseline('src/systems/cinematic/EarthJourney.js');
 const pose=s=>s.slice(s.indexOf('  getAtmosphericPose()'),s.indexOf('  maskHandoff()'));
 check(pose(journey)===pose(old),'full approach/BIRTH camera and lighting choreography exactly GREEN');
 const atmo=readFileSync('src/systems/cinematic/JourneyAtmosphere.js','utf8').replaceAll('\r\n','\n');const oldAtmo=baseline('src/systems/cinematic/JourneyAtmosphere.js');check(atmo.slice(atmo.indexOf('  clear()'))===oldAtmo.slice(oldAtmo.indexOf('  clear()')),'proven curtain cleanup exactly GREEN');
 check(execFileSync('git',['diff',checkpoint,'--','src','public',':(exclude)src/systems/cinematic/EarthJourney.js',':(exclude)src/systems/cinematic/JourneyAtmosphere.js',':(exclude)src/systems/cinematic/JourneyPlasma.js'],{encoding:'utf8'})==='','camera owner, renderer, Earth, Journey 2, flight, gateway, F/G and other runtime systems protected');
 console.log=log;console.log(`Spectacle targeted: PASS (${checks} checks). Dense cloud mask opacity >0.9: ${denseMask.toFixed(3)} s (${first.toFixed(3)}–${last.toFixed(3)}). Physical appearance pending.`);
} finally {delete globalThis.document;console.log=log;}
