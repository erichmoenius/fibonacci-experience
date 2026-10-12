import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as THREE from 'three';
import { JourneyPlasma, plasmaEnvelope, PLASMA_MAX_ALPHA, PLASMA_PEAK_TIME, PLASMA_END_TIME } from '../src/systems/cinematic/JourneyPlasma.js';
import { EarthJourney, descentEase } from '../src/systems/cinematic/EarthJourney.js';
let checks=0;const check=(value,message)=>{assert.ok(value,message);checks++;};
const log=console.log;console.log=()=>{};
const element=()=>({style:{background:'black',transition:'opacity 1s linear',opacity:'0'},children:[],appendChild(c){this.children.push(c);c.parent=this;},remove(){this.parent.children=this.parent.children.filter(c=>c!==this);}});
globalThis.document={createElement:element};
try {
  for (let i=0;i<=10000;i++) {
    const t=i/1000,value=plasmaEnvelope(t);
    check(value>=0&&value<=1,'bounded intensity');
    if(t<=2||t>=PLASMA_END_TIME)check(value===0,'strictly absent outside visual window, including BIRTH');
  }
  check(plasmaEnvelope(NaN)===0&&plasmaEnvelope(Infinity)===0,'invalid time invisible');
  check(plasmaEnvelope(PLASMA_PEAK_TIME)===1&&plasmaEnvelope(3.8)===1&&plasmaEnvelope(4.5)===0,'exact peak and residual');
  const h=1e-4;
  for(const boundary of [2,PLASMA_PEAK_TIME,3.8,PLASMA_END_TIME]) {
    const left=(plasmaEnvelope(boundary)-plasmaEnvelope(boundary-h))/h;
    const right=(plasmaEnvelope(boundary+h)-plasmaEnvelope(boundary))/h;
    check(Math.abs(left)<1e-6&&Math.abs(right)<1e-6,'smooth ignition/peak/decay/residual boundaries');
  }
  for(const [start,end,sign] of [[2,3.5,1],[3.5,3.8,1],[3.8,4.5,-1]]) {
    let previous=plasmaEnvelope(start);
    for(let i=1;i<=1000;i++){const value=plasmaEnvelope(start+(end-start)*i/1000);check((value-previous)*sign>=-1e-12,'monotonic envelope segment');previous=value;}
  }
  const scene=new THREE.Scene(),target=new THREE.Mesh(new THREE.SphereGeometry(2));scene.add(target);
  const component=new JourneyPlasma(target);
  check(component.mesh.parent===scene&&scene.children.length===2,'one isolated scene-root visual mesh');
  check(component.mesh.geometry.index.count===6,'two triangles only');
  const m=component.mesh.material;
  check(m.transparent&&m.premultipliedAlpha&&m.blending===THREE.AdditiveBlending&&!m.depthTest&&!m.depthWrite&&!m.toneMapped,'correct bounded additive alpha blending, no depth or exposure ownership');
  const bloomLayer=new THREE.Layers();bloomLayer.set(1);
  check(component.mesh.layers.mask===1&&!component.mesh.layers.test(bloomLayer),'main layer only; excluded from bloom');
  let geometryDisposals=0,materialDisposals=0;
  component.mesh.geometry.addEventListener('dispose',()=>geometryDisposals++);m.addEventListener('dispose',()=>materialDisposals++);
  component.update(1,0.02);check(!component.mesh.visible,'PULL hidden');
  component.update(3.2,0.48);check(component.mesh.visible&&component.uniforms.uTime.value===3.2&&component.uniforms.uProgress.value===0.48,'authoritative time/progression consumed');
  component.mesh.onBeforeRender({getDrawingBufferSize(v){return v.set(1920,1080);}});
  check(component.uniforms.uAspect.value===1920/1080,'existing renderer buffer aspect');
  component.update(6.5,1);component.dispose();component.update(3.2,0.48);
  check(component.disposed&&!component.mesh.parent&&!component.mesh.visible&&component.intensity===0&&geometryDisposals===1&&materialDisposals===1,'atmospheric dissolution releases GPU resources exactly once, late updates inert');
  check(!/requestAnimationFrame|performance\.now|setTimeout|new THREE\.(Texture|WebGLRenderer)/.test(readFileSync('src/systems/cinematic/JourneyPlasma.js','utf8')), 'no independent timer, texture loader or renderer');
  check(PLASMA_MAX_ALPHA===0.68&&m.fragmentShader.includes('sampler2D uCloudMap'),'borrowed cloud sampler; bounded alpha cap');
  for(const phase of ['START','APPROACH','HORIZON','SINGULARITY','WORMHOLE','VOID','BIRTH']) {
    const root=new THREE.Scene(),earth=new THREE.Mesh(new THREE.SphereGeometry(2));earth.position.x=22;root.add(earth);
    const j=new EarthJourney();const center=earth.getWorldPosition(new THREE.Vector3());
    j.prepareDescent({camera:{near:0.1},position:center.clone().add(new THREE.Vector3(0,0,10)),currentTarget:center},earth,element());j.start();
    const plasma=j.plasma;let gd=0,md=0;plasma.mesh.geometry.addEventListener('dispose',()=>gd++);plasma.mesh.material.addEventListener('dispose',()=>md++);
    for(let i=0;i<1100&&j.phase!==phase;i++)j.update(0.01);
    check(j.phase===phase,'target cancellation phase reached');j.cancel();j.update(1);j.cancel();
    check(j.plasma===null&&plasma.disposed&&!plasma.mesh.parent&&gd===1&&md===1&&j.atmosphere.cleared,'every-phase cancellation clears plasma and curtain');
    earth.geometry.dispose();
  }
  for(let cycle=0;cycle<5;cycle++){
    const j=new EarthJourney(),root=new THREE.Scene();root.add(target);const center=target.getWorldPosition(new THREE.Vector3());
    j.prepareDescent({camera:{near:0.1},position:center.clone().add(new THREE.Vector3(0,0,10)),currentTarget:center},target,element());j.start();
    const plasma=j.plasma;const events=[];j.onEvent=event=>{events.push(event);if(event==='birth')j.setArrivalPose({position:new THREE.Vector3(0,0,6.5),lookTarget:new THREE.Vector3()});};
    for(let i=0;i<1000&&!j.completed;i++){
      j.update(0.016);
      if(!plasma.disposed)check(plasma.uniforms.uTime.value===j.elapsed&&plasma.uniforms.uProgress.value===descentEase(0,6.5,j.elapsed),'only authoritative journey clock/progression publishes uniforms');
      if(j.phase==='BIRTH')check(plasma.disposed&&!plasma.mesh.parent,'plasma absent throughout BIRTH');
    }
    check(j.completed&&j.elapsed===10&&plasma.disposed&&j.plasma===null&&root.children.length===1,'repeated completion preserves schedule and leaves no extra mesh');
    check(events.filter(e=>e==='birth').length===1&&events.filter(e=>e==='complete').length===1,'single handoff/completion');
  }
  const checkpoint='78f72485b05b68be116ea4d11faaf1e9848e788d';
  const source=readFileSync('src/systems/cinematic/EarthJourney.js','utf8').replaceAll('\r\n','\n');
  const stripped=source.replace('import { JourneyAtmosphere, entryVeil }', 'import { JourneyAtmosphere }').replace('import { JourneyPlasma } from "./JourneyPlasma.js";\n','')
    .replace('    this.plasma?.dispose();\n    this.plasma = new JourneyPlasma(target);\n','')
    .replace('    this.plasma?.update(this.elapsed, descentEase(0, 6.5, this.elapsed));\n','')
    .replace('    this.plasma?.dispose();\n    this.plasma = null;\n','')
    .replace('state.haze = descentEase(2, 4.5, this.elapsed) * 0.30;', 'state.haze = descentEase(2, 4.5, this.elapsed);')
    .replace('state.clouds = descentEase(4.5, 4.85, this.elapsed) * (1 - descentEase(6.05, 6.5, this.elapsed));', 'state.clouds = descentEase(4.5, 6.5, this.elapsed);')
    .replace('state.whiteout = entryVeil(this.elapsed);', 'state.whiteout = descentEase(6, 6.5, this.elapsed);')
    .replace('maskHandoff() { if (this.elapsed >= 7.38) this.atmosphere?.obscure(); }','maskHandoff() { this.atmosphere?.obscure(); }');
  check(stripped===execFileSync('git',['show',`${checkpoint}:src/systems/cinematic/EarthJourney.js`],{encoding:'utf8'}).replaceAll('\r\n','\n'),'EarthJourney exactly GREEN except approved effect/visual-envelope hooks');
  check(execFileSync('git',['diff',checkpoint,'--','src','public',':(exclude)src/systems/cinematic/EarthJourney.js',':(exclude)src/systems/cinematic/JourneyPlasma.js',':(exclude)src/systems/cinematic/JourneyAtmosphere.js'],{encoding:'utf8'})==='','all other GREEN runtime systems, camera, Earth, textures and renderer untouched; curtain cleanup guarded separately');
  target.geometry.dispose();target.material.dispose();
} finally {delete globalThis.document;console.log=log;}
console.log(`Journey 3 plasma lifecycle/envelope: PASS (${checks} checks). No physical/GPU performance claim.`);
