import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
const browser=[process.env.JOURNEY_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&existsSync(p));
assert.ok(browser,'Existing Chromium required');
const directory=mkdtempSync(join(tmpdir(),'fibonacci-birth-test-'));
assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));
const html=String.raw`<!doctype html><html><body><script type="importmap">{"imports":{"three":"/three.module.js","three/addons/":"/addons/"}}</script><script type="module">
import * as THREE from 'three';
import { SunSurface } from '/SunSurface.js';
import { Journey2BirthComposite } from '/Journey2BirthComposite.js';
window.runComposite = async () => {
  let checks = 0; const check = (v, m) => { if (!v) throw Error(m); checks++; };
  const errors = [], renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(640, 360);
  renderer.debug.onShaderError = (gl, p, v, f) => errors.push([gl.getProgramInfoLog(p), gl.getShaderInfoLog(v), gl.getShaderInfoLog(f)]);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 320);
  camera.position.set(10, 10, 48); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 40), new SunSurface()); scene.add(sun);
  renderer.setClearColor(0x000000, 1);
  const read = () => { const gl = renderer.getContext(), pixels = new Uint8Array(640 * 360 * 4); gl.readPixels(0, 0, 640, 360, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels; };
  const image = () => { renderer.render(scene, camera); return read(); };
  const original = image();
  const mask = []; for (let i = 0; i < original.length; i += 4) if (original[i] > 10) mask.push(i);
  check(mask.length > 2000, 'actual arrival-distance sphere visible');
  const delta = (a, b) => {
    let total = 0, changed = 0;
    for (const i of mask) { const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i+1] - b[i+1]) + Math.abs(a[i+2] - b[i+2])) / 3; total += d; if (d > 3) changed++; }
    return { meanRgbDifference: total / mask.length, changedFraction: changed / mask.length };
  };
  check(delta(original, image()).meanRgbDifference === 0, 'frozen clock gives identical pixels: no random flicker');
  sun.material.update(1 / 60); const adjacent = delta(original, image());
  check(adjacent.meanRgbDifference < 2, 'adjacent frame has gentle continuous evolution');
  sun.material.update(2 - 1 / 60); const afterTwo = image(), motion = delta(original, afterTwo);
  check(motion.meanRgbDifference > 1 && motion.changedFraction > .15, 'plasma changes visible at fixed arrival camera within two seconds, without rotation/audio');
  let s1Motion = null;
  if (await fetch('/SunSurfaceS1.js').then(r => r.text()).then(s => s !== 'export {};')) {
    const { SunSurface: S1 } = await import('/SunSurfaceS1.js');
    const s2 = sun.material, s1 = new S1(); sun.material = s1;
    const before = image(); s1.update(2); s1Motion = delta(before, image());
    check(motion.meanRgbDifference > s1Motion.meanRgbDifference * 2, 'S2 two-second motion exceeds preserved S1 reference');
    sun.material = s2; s1.dispose();
  }
  // The real BIRTH composite must transmit the evolving destination pixels.
  const journey = { elapsed: 10, cancelled: false, completed: false };
  renderer.setClearColor(0x401008, 1); sun.visible = false; image();
  const effect = new Journey2BirthComposite(renderer, journey); effect.setDestination(sun);
  renderer.setClearColor(0x000000, 1); sun.visible = true; sun.material.uniforms.uTime.value = 0;
  const visibleNow = image(); journey.elapsed = 10.45; effect.render(camera); const reveal = read();
  check(effect.sun === sun && effect.uniforms.sunValid.value === 1, 'BIRTH uses the live S2 mesh at its projected position');
  check(delta(visibleNow, reveal).meanRgbDifference < 1, 'guided aperture transmits the live surface at arrival distance');
  sun.material.update(.2); const nextLive = image(); journey.elapsed = 10.65; effect.render(camera); const nextReveal = read();
  check(delta(nextLive, nextReveal).meanRgbDifference < 1, 'next BIRTH frame transmits refreshed Sun pixels');
  check(delta(reveal, nextReveal).meanRgbDifference > .1, 'surface remains animated inside BIRTH composite');
  effect.dispose();
  check(errors.length === 0, 'Sun and reveal shaders compile on WebGL2');
  sun.geometry.dispose(); sun.material.dispose(); renderer.dispose();
  return { checks, errors, diskPixels: mask.length, motion, adjacentFrame: adjacent, s1Motion, cameraDistance: camera.position.length() };
};
</script></body></html>
`;
const routes={'/':()=>html,'/three.module.js':()=>readFileSync('node_modules/three/build/three.module.js'),'/three.core.js':()=>readFileSync('node_modules/three/build/three.core.js'),'/addons/postprocessing/Pass.js':()=>readFileSync('node_modules/three/examples/jsm/postprocessing/Pass.js'),'/SunSurface.js':()=>readFileSync('src/systems/SunSurface.js'),'/SunSurfaceS1.js':()=>process.env.SUN_S1_REFERENCE?readFileSync(process.env.SUN_S1_REFERENCE):'export {};','/Journey2BirthComposite.js':()=>readFileSync('src/systems/transit/Journey2BirthComposite.js')};
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
 let ready=false;for(let i=0;i<100;i++){ready=(await call('Runtime.evaluate',{expression:'typeof runComposite === "function"',returnByValue:true})).result.value;if(ready)break;await sleep(30);}assert.ok(ready,'Local shader fixture loaded');
 const evaluation=await call('Runtime.evaluate',{expression:'runComposite()',awaitPromise:true,returnByValue:true});assert.ok(!evaluation.exceptionDetails,JSON.stringify(evaluation.exceptionDetails));const result=evaluation.result.value;
 assert.equal(result.errors.length,0,JSON.stringify(result.errors));console.log(JSON.stringify(result));console.log('Sun S2 GPU: PASS (fixed-camera ambient motion, deterministic frames, live BIRTH pixels, shader compilation).');
 await call('Browser.close');await sleep(200);
}finally{socket?.close();if(helper.exitCode===null)helper.kill();await Promise.race([new Promise(r=>helper.once('exit',r)),sleep(1000)]);await new Promise(r=>server.close(r));try{rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{console.log('Temporary shader-test profile retained outside repository.');}}
