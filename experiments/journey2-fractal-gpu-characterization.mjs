import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
const browser=[process.env.JOURNEY_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&existsSync(p));
assert.ok(browser,'Existing Chromium required; no dependency downloads');
const directory=mkdtempSync(join(tmpdir(),'fibonacci-fractal-test-'));
assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));
const html=`<!doctype html><html><body><script type="importmap">{"imports":{"three":"/three.module.js"}}</script><script type="module">
import * as THREE from 'three';
import {Journey2Fractal,JOURNEY2_FRACTAL} from '/Journey2Fractal.js';
window.runFractal=()=>{
 let checks=0;const check=(v,m)=>{if(!v)throw Error(m);checks++;};
 const errors=[],renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
 renderer.setSize(320,180);renderer.setClearColor(0);
 renderer.debug.onShaderError=(gl,p,v,f)=>errors.push([gl.getProgramInfoLog(p),gl.getShaderInfoLog(v),gl.getShaderInfoLog(f)]);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,16/9,.1,100);
 camera.position.set(13,5,9);camera.lookAt(3,8,-4);camera.updateMatrixWorld(true);
 const cameraState=JSON.stringify([camera.position.toArray(),camera.quaternion.toArray(),camera.fov]);
 const effect=new Journey2Fractal();scene.add(effect.mesh);const samples=[];
 const read=()=>{const gl=renderer.getContext(),data=new Uint8Array(320*180*4);gl.readPixels(0,0,320,180,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;};
 for(const time of [0,.1,.35,1.7,3.5,5,5.4,5.7]){
  effect.update(time);renderer.render(scene,camera);const data=read();
  let lit=0,cyan=0,violet=0,white=0,hash=0,max=0;
  for(let i=0;i<data.length;i+=4){const r=data[i],g=data[i+1],b=data[i+2];
   if(Math.max(r,g,b)>45)lit++;if(b>80&&g>r*1.2)cyan++;if(b>80&&r>g*1.2)violet++;
   if(Math.min(r,g,b)>230)white++;max=Math.max(max,r,g,b);hash=(Math.imul(hash,31)+r+3*g+7*b)|0;
  }
  samples.push({time,lit,cyan,violet,white,hash,max,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
 }
 check(errors.length===0,'actual GPU shader compiles');
 check(samples[0].calls===0,'no fractal draw before onset');
 for(const s of samples.filter(s=>s.time>=.35&&s.time<=5)){
  check(s.lit>1500,'substantial luminous structure at '+s.time);
  check(s.cyan>100&&s.violet>100,'cyan and violet remain distinct at '+s.time+' '+JSON.stringify(s));
  check(s.white<320*180*.3,'contrast survives exaggerated intensity');
  check(s.calls===1&&s.triangles===2,'one quad, one GPU draw');
 }
 check(new Set(samples.filter(s=>s.time>=.35&&s.time<=5).map(s=>s.hash)).size===4,'zoom evolves throughout crescendo');
 check(samples.at(-1).max===0,'exact black at VOID boundary');
 // Isolate one passing slice and measure actual rendered outward expansion.
 const originalSettings=effect.settings;
 effect.settings={...JOURNEY2_FRACTAL,recursion:1,streakStrength:0};
 const outward=[];
 for(const depth of [.25,.4,.55]){
  effect.settings.zoomOctaves=depth/(.16*Math.pow(.5,effect.settings.acceleration));
  effect.update(JOURNEY2_FRACTAL.duration*.5);renderer.render(scene,camera);const data=read();let weightedRadius=0,weight=0;
  for(let y=0;y<180;y++)for(let x=0;x<320;x++){
   const i=(y*320+x)*4,w=Math.max(data[i],data[i+1],data[i+2]);
   if(w<60)continue;
   const radius=Math.hypot(((x+.5)/320*2-1)*16/9,(y+.5)/180*2-1);
   weightedRadius+=radius*w;weight+=w;
  }
  check(weight>0,'passing slice is visible');outward.push(weightedRadius/weight);
 }
 check(outward[1]>outward[0]*1.4&&outward[2]>outward[1]*1.4,'rendered structures grow outward across depth');
 effect.settings=originalSettings;
 effect.update(4.4);renderer.render(scene,camera);const centerData=read(),centerIndex=(90*320+160)*4;
 check(Math.max(...centerData.slice(centerIndex,centerIndex+3))<30,'central vanishing point stays dark');
 const darkCenter=time=>{
  effect.update(time);renderer.render(scene,camera);const data=read();let dark=0;
  for(let y=0;y<180;y++)for(let x=0;x<320;x++){
   const radius=Math.hypot(((x+.5)/320*2-1)*16/9,(y+.5)/180*2-1),i=(y*320+x)*4;
   if(radius<.85&&Math.max(data[i],data[i+1],data[i+2])<30)dark++;
  }return dark;
 };
 check(darkCenter(5.4)>darkCenter(5)*1.2,'collapse expands the central dark region');
 check(effect.uniforms.uAspect.value===16/9,'buffer aspect reaches shader');
 let firstBlack=JOURNEY2_FRACTAL.duration;
 for(let time=JOURNEY2_FRACTAL.duration-.25;time<=JOURNEY2_FRACTAL.duration+.0001;time+=.01){
  effect.update(time);renderer.render(scene,camera);const data=read();
  if(data.every((v,i)=>i%4===3||v===0)){firstBlack=time;break;}
 }
 const blackSeconds=.3+JOURNEY2_FRACTAL.duration-firstBlack;
 check(blackSeconds<=.4+1e-6,'fully black shader tail plus VOID stays below 0.4 seconds');
 effect.holdVoid();renderer.render(scene,camera);check(read().filter((v,i)=>i%4!==3&&v>0).length===0,'static VOID black stays black');
 renderer.setSize(180,320);effect.update(2);renderer.render(scene,camera);check(effect.uniforms.uAspect.value===180/320,'portrait resize updates aspect');
 check(JSON.stringify([camera.position.toArray(),camera.quaternion.toArray(),camera.fov])===cameraState,'camera unchanged');
 let geometryDisposals=0,materialDisposals=0;
 effect.mesh.geometry.addEventListener('dispose',()=>geometryDisposals++);effect.material.addEventListener('dispose',()=>materialDisposals++);
 effect.dispose();effect.dispose();renderer.render(scene,camera);
 check(geometryDisposals===1&&materialDisposals===1&&effect.mesh.parent===null,'idempotent cleanup');
 check(renderer.info.memory.geometries===0&&renderer.info.programs.length===0,'GPU resources released');
 const off=new Journey2Fractal({...JOURNEY2_FRACTAL,enabled:false});off.update(2);scene.add(off.mesh);renderer.render(scene,camera);
 check(renderer.info.render.calls===0,'disable switch suppresses effect');off.dispose();renderer.dispose();
 return {checks,errors,samples,outward,blackSeconds};
};
</script></body></html>`;
const routes={'/':()=>html,'/three.module.js':()=>readFileSync('node_modules/three/build/three.module.js'),'/three.core.js':()=>readFileSync('node_modules/three/build/three.core.js'),'/Journey2Fractal.js':()=>readFileSync('src/systems/transit/Journey2Fractal.js')};
const server=createServer((req,res)=>{const route=routes[req.url];if(!route){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':req.url==='/'?'text/html':req.url.endsWith('.jpg')?'image/jpeg':req.url.endsWith('.png')?'image/png':'text/javascript'});res.end(route());});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const helper=spawn(browser,['--headless','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+directory,'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try {
 for(let i=0;i<200&&!existsSync(join(directory,'DevToolsActivePort'));i++)await sleep(25);
 const port=readFileSync(join(directory,'DevToolsActivePort'),'utf8').split('\n')[0];const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,e)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',e,{once:true});});
 let id=0;const pending=new Map();socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.e(m.error);else p.r(m.result);});
 const call=(method,params={})=>new Promise((r,e)=>{const n=++id;pending.set(n,{r,e});socket.send(JSON.stringify({id:n,method,params}));});
 await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
 let ready=false;for(let i=0;i<100;i++){ready=(await call('Runtime.evaluate',{expression:'typeof runFractal === "function"',returnByValue:true})).result.value;if(ready)break;await sleep(30);}assert.ok(ready,'Local shader fixture loaded');
 const evaluation=await call('Runtime.evaluate',{expression:'runFractal()',awaitPromise:true,returnByValue:true});assert.ok(!evaluation.exceptionDetails,JSON.stringify(evaluation.exceptionDetails));const result=evaluation.result.value;
 assert.equal(result.errors.length,0,JSON.stringify(result.errors));console.log(JSON.stringify(result));console.log('Journey 2 fractal GPU: PASS (shader compilation, softened depth, outward flow, short collapse, aspect, disposal).');
 await call('Browser.close');await sleep(200);
}finally{socket?.close();if(helper.exitCode===null)helper.kill();await Promise.race([new Promise(r=>helper.once('exit',r)),sleep(1000)]);await new Promise(r=>server.close(r));try{rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{console.log('Temporary shader-test profile retained outside repository.');}}
