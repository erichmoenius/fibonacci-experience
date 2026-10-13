import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
const browser=[process.env.JOURNEY_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&existsSync(p));
assert.ok(browser,'Existing Chromium required');
const directory=mkdtempSync(join(tmpdir(),'fibonacci-birth-test-'));
assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));
const html=String.raw`<!doctype html><html><body><script type="importmap">{"imports":{"three":"/three.module.js","three/addons/":"/addons/"}}</script><script type="module">
import * as THREE from 'three';
import { GalaxySpecialStar } from '/src/systems/GalaxySpecialStar.js';
import { GalaxySpecialStar as BaselineStar } from '/BaselineStar.js';
import { SunSurface } from '/src/systems/SunSurface.js';
import CameraDirector from '/src/systems/cinematic/CameraDirector.js';
import JourneyDirector from '/src/systems/cinematic/JourneyDirector.js';
import { Journey2 } from '/src/systems/cinematic/Journey2.js';
window.runComposite = () => {
  Error.stackTraceLimit = 0;
  let checks = 0; const check = (v, m) => { if (!v) throw Error(m); checks++; };
  const errors = [], renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(640, 360); document.body.appendChild(renderer.domElement);
  renderer.debug.onShaderError = (gl, p, v, f) => errors.push([gl.getProgramInfoLog(p), gl.getShaderInfoLog(v), gl.getShaderInfoLog(f)]);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 16/9, .1, 450);
  const galaxy = new THREE.Group(), spin = new THREE.Group(); scene.add(galaxy); galaxy.add(spin);
  galaxy.position.z = -30; galaxy.rotation.set(-.21, 0, -.22); galaxy.scale.setScalar(1.5);
  const home = new THREE.Vector3(28,22,12), forward = new THREE.Vector3(18,0,-27).sub(home).normalize(); galaxy.position.addScaledVector(forward, -12);
  const star = new GalaxySpecialStar(spin), baseline = new BaselineStar(spin); baseline.group.visible = false;
  const solar = new SunSurface();
  check(star.coreMaterial.fragmentShader === solar.fragmentShader, 'shared S3 surface source is unchanged on the Galaxy instance');
  check(star.coreGeometry.parameters.radius === baseline.coreGeometry.parameters.radius, 'physical gateway core radius preserved');
  check(star.coreGeometry.parameters.widthSegments === 128 && star.coreGeometry.parameters.heightSegments === 96, 'smooth close-up tessellation');
  const read = () => { const gl = renderer.getContext(), p = new Uint8Array(640*360*4); gl.readPixels(0,0,640,360,gl.RGBA,gl.UNSIGNED_BYTE,p); return p; };
  const render = () => { renderer.render(scene,camera); return read(); };
  const center = star.getWorldPosition(new THREE.Vector3()); camera.position.copy(center).add(new THREE.Vector3(0,0,30)); camera.lookAt(center);
  star.update(0); baseline.update(0); const distant = render();
  star.group.visible = false; baseline.group.visible = true; const oldDistant = render(); baseline.group.visible = false; star.group.visible = true;
  const brightness = data => { let total=0; for(let i=0;i<data.length;i+=4)total+=data[i]+data[i+1]+data[i+2]; return total; };
  check(brightness(distant) >= brightness(oldDistant)*.9 && brightness(distant) <= brightness(oldDistant)*1.1, 'distant gateway visibility retained');
  const bounds = renderer.domElement.getBoundingClientRect();
  check(star.hitInspectionPointer({target:renderer.domElement,clientX:bounds.left+bounds.width/2,clientY:bounds.top+bounds.height/2},camera,renderer.domElement), 'existing distant acceptance hit still recognizes gateway');
  const cd = new CameraDirector(camera,renderer.domElement), jd = new JourneyDirector(cd);
  cd.returnHome({position:center.clone().add(new THREE.Vector3(0,0,8)),lookTarget:center},true);
  jd.onApproach = target => cd.beginCoreApproach(target);
  jd.onHorizon = target => cd.beginCoreHorizon(target);
  jd.onSingularity = crossing => cd.beginCrossing(crossing);
  const journey = new Journey2(); cd.beginJourney(journey); jd.begin(journey,star,{target:star,direction:new THREE.Vector3(0,0,1),endpointDistance:.75},'planetary');
  // The same order as the App: camera, journey, then Galaxy's visual update.
  const frames = [], samples = [], times = new Set([0,84,168,240,286,480]);
  let previous = 0, closePixels, closePose, wormhole;
  for(let frame=0;frame<=480;frame++) {
    if(frame) { cd.update(1/120); jd.update(cd.position,1/120); spin.rotation.y-=1/120*.01496; star.update(1/120,jd.getJourney()); }
    if(!times.has(frame)) continue;
    const pixels = render(), t = journey.elapsed, reveal = star.coreMaterial.uniforms.uGatewayReveal.value;
    check(reveal >= previous && reveal >= 0 && reveal <= 1, 'continuous bounded reveal at T='+t); previous=reveal;
    if(t>=1.4)check(reveal===1,'surface fully revealed before SINGULARITY');
    if(frame)check(Math.abs(star.coreMaterial.uniforms.uTime.value-t)<1e-9,'live render clock matches journey without frame lag');
    samples.push({t,phase:journey.phase,reveal,distance:camera.position.distanceTo(star.getWorldPosition(new THREE.Vector3()))});
    if(frame===286) { closePixels=pixels; closePose={position:camera.position.clone(),quaternion:camera.quaternion.clone(),spin:spin.rotation.y}; frames.push({name:'special-star-t1-2.383.png',data:renderer.domElement.toDataURL('image/png').split(',')[1]}); }
    if(frame===480) { const p=star.getWorldPosition(new THREE.Vector3()).applyMatrix4(camera.matrixWorldInverse); wormhole={time:t,phase:journey.phase,starViewZ:p.z}; }
  }
  check(wormhole.phase==='WORMHOLE' && Math.abs(wormhole.time-4)<1e-8 && wormhole.starViewZ>0, 'unchanged T=4 crossing puts star behind camera for wormhole');
  // Compare the observed close-up with the actual previous white gateway core.
  camera.position.copy(closePose.position); camera.quaternion.copy(closePose.quaternion); camera.updateMatrixWorld(true); spin.rotation.y=closePose.spin;
  star.group.visible=false; baseline.group.visible=true; baseline.update(286/120); const oldClose=render(); baseline.group.visible=false; star.group.visible=true;
  const mask=[]; for(let i=0;i<oldClose.length;i+=4)if(oldClose[i]>235&&oldClose[i+1]>230&&oldClose[i+2]>210)mask.push(i);
  check(mask.length>1000,'observed white close-up reproduced by original geometry/material');
  let white=0,green=0,green2=0; for(const i of mask){if(closePixels[i]>245&&closePixels[i+1]>245&&closePixels[i+2]>245)white++;green+=closePixels[i+1];green2+=closePixels[i+1]**2;}
  const whiteFraction=white/mask.length, variation=Math.sqrt(green2/mask.length-(green/mask.length)**2);
  check(whiteFraction<.03 && variation>12,'T=2.383 has warm varied plasma rather than clipped white core');
  // Freeze all transforms/scale: only the accepted clock drives plasma evolution.
  star.update(0,journey); journey.elapsed=2.383; const a=render(), frozen=render(); check(a.every((v,i)=>v===frozen[i]),'frozen journey clock gives identical surface');
  journey.elapsed+=1/60;const next=render();let smooth=0;for(const i of mask)smooth+=(Math.abs(a[i]-next[i])+Math.abs(a[i+1]-next[i+1])+Math.abs(a[i+2]-next[i+2]))/3;
  check(smooth/mask.length<3,'adjacent solar motion smooth');
  journey.elapsed=4.383;const evolved=render();let moving=0;for(const i of mask)moving+=(Math.abs(a[i]-evolved[i])+Math.abs(a[i+1]-evolved[i+1])+Math.abs(a[i+2]-evolved[i+2]))/3;
  check(moving/mask.length>10,'revealed surface evolves without audio or mesh motion');
  journey.cancel(); render(); check(star.coreMaterial.uniforms.uGatewayReveal.value===0,'cancel resets to gateway appearance');
  check(errors.length===0,'shared surface and Galaxy reveal shaders compile');
  star.dispose(); baseline.dispose(); solar.dispose(); renderer.dispose();
  return {checks,errors,samples,wormhole,whiteFraction,closeColorVariation:variation,frames};
};
</script></body></html>
`;
const routes={"/":()=>html,"/three.module.js":()=>readFileSync("node_modules/three/build/three.module.js"),"/three.core.js":()=>readFileSync("node_modules/three/build/three.core.js"),"/BaselineStar.js":()=>execFileSync("git",["show","197d6def1f045830e0fac8f78e3e2b6420c05656:src/systems/GalaxySpecialStar.js"],{encoding:"utf8"})};
const server=createServer((req,res)=>{let route=routes[req.url]; if(!route && req.url.startsWith("/src/") && req.url.endsWith(".js")){const path=resolve("."+req.url);if(path.startsWith(resolve("src")+sep))route=()=>readFileSync(path,"utf8").replaceAll("import.meta.env.DEV","false").replaceAll("import.meta.env.BASE_URL",'"/"').replace(/from\s+(["'])(\.[^"']+)\1/g,(match,quote,spec)=>"from "+quote+spec+(/\.[a-z]+$/i.test(spec)?"":".js")+quote);}if(!route){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':req.url==='/'?'text/html':req.url.endsWith('.jpg')?'image/jpeg':req.url.endsWith('.png')?'image/png':'text/javascript'});res.end(route());});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const helper=spawn(browser,['--headless','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+directory,'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try {
 for(let i=0;i<200&&!existsSync(join(directory,'DevToolsActivePort'));i++)await sleep(25);
 const port=readFileSync(join(directory,'DevToolsActivePort'),'utf8').split('\n')[0];const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,e)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',e,{once:true});});
 let id=0;const pending=new Map();socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.e(m.error);else p.r(m.result);});
 const call=(method,params={})=>new Promise((r,e)=>{const n=++id;pending.set(n,{r,e});socket.send(JSON.stringify({id:n,method,params}));});
 await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
 let ready=false;for(let i=0;i<100;i++){ready=(await call('Runtime.evaluate',{expression:'typeof runComposite === "function"',returnByValue:true})).result.value;if(ready)break;await sleep(30);}assert.ok(ready,'Local shader fixture loaded');
 const evaluation=await call('Runtime.evaluate',{expression:'runComposite()',awaitPromise:true,returnByValue:true});assert.ok(!evaluation.exceptionDetails,JSON.stringify(evaluation.exceptionDetails));const result=evaluation.result.value; if(process.env.SPECIAL_STAR_FRAME_DIR) for(const frame of result.frames) writeFileSync(join(process.env.SPECIAL_STAR_FRAME_DIR,frame.name),Buffer.from(frame.data,"base64")); delete result.frames;
 assert.equal(result.errors.length,0,JSON.stringify(result.errors));console.log(JSON.stringify(result));console.log('Special Star T1: PASS (distant visibility, progressive reveal, actual Journey 2 camera at T=2.383, warm detailed surface, frozen/smooth motion, T=4 wormhole, shader compilation).');
 await call('Browser.close');await sleep(200);
}finally{socket?.close();if(helper.exitCode===null)helper.kill();await Promise.race([new Promise(r=>helper.once('exit',r)),sleep(1000)]);await new Promise(r=>server.close(r));try{rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{console.log('Temporary shader-test profile retained outside repository.');}}
