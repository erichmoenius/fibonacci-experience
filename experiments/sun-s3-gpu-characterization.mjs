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
import { SunSurface } from '/SunSurface.js';
import { SunSurface as S2 } from '/SunSurfaceS2.js';
import { Journey2BirthComposite } from '/Journey2BirthComposite.js';
window.runComposite = async () => {
  let checks = 0; const check = (v, m) => { if (!v) throw Error(m); checks++; };
  const errors = [], renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(640, 360);
  renderer.debug.onShaderError = (gl, p, v, f) => errors.push([gl.getProgramInfoLog(p), gl.getShaderInfoLog(v), gl.getShaderInfoLog(f)]);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 16 / 9, .1, 320);
  const material = new SunSurface(), reference = new S2();
  const sun = new THREE.Mesh(new THREE.SphereGeometry(5, 64, 40), material); scene.add(sun);
  renderer.setClearColor(0x000000, 1);
  const read = () => { const gl = renderer.getContext(), pixels = new Uint8Array(640 * 360 * 4); gl.readPixels(0, 0, 640, 360, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels; };
  const image = () => { renderer.render(scene, camera); return read(); };
  const at = t => { sun.material.uniforms.uTime.value = 0; sun.material.update(t); return image(); };
  const difference = (a, b, mask) => {
    let total = 0, changed = 0;
    for (const i of mask) { const d = (Math.abs(a[i]-b[i]) + Math.abs(a[i+1]-b[i+1]) + Math.abs(a[i+2]-b[i+2])) / 3; total += d; if (d > 3) changed++; }
    return { meanRgbDifference: total / mask.length, changedFraction: changed / mask.length };
  };
  const results = [], frames = [];
  for (const [view, y] of [['arrival', 10], ['raised-waltz', 18]]) {
    camera.position.set(10, y, 48); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    const before = at(0), mask = []; for (let i = 0; i < before.length; i += 4) if (before[i] > 10) mask.push(i);
    check(mask.length > 2500, 'normal ' + view + ' distance tested');
    check(difference(before, image(), mask).meanRgbDifference === 0, 'frozen time identical in ' + view);
    if (view === 'arrival') frames.push({ name: 'sun-s3-t0.png', data: renderer.domElement.toDataURL('image/png').split(',')[1] });
    const twoSeconds = difference(before, at(2), mask), threeSeconds = difference(before, at(3), mask);
    check(twoSeconds.meanRgbDifference > 12 && twoSeconds.changedFraction > .65, 'clearly changing plasma within 2 seconds at ' + view);
    check(threeSeconds.meanRgbDifference > 12 && threeSeconds.changedFraction > .65, 'visible motion sustained at 3 seconds at ' + view);
    if (view === 'arrival') frames.push({ name: 'sun-s3-t3.png', data: renderer.domElement.toDataURL('image/png').split(',')[1] });
    let adjacentMax = 0;
    for (const t of [0.5, 1, 1.5, 2, 2.5, 3, 20, 60, 120]) {
      const a = at(t), b = at(t + 1 / 60), d = difference(a, b, mask);
      adjacentMax = Math.max(adjacentMax, d.meanRgbDifference);
      check(d.meanRgbDifference < 2, 'smooth adjacent frame at t=' + t + ' in ' + view);
      check(difference(b, image(), mask).meanRgbDifference === 0, 'deterministic frozen surface at t=' + t);
    }
    sun.material = reference; const oldBefore = at(0), s2Motion = difference(oldBefore, at(2), mask); sun.material = material;
    check(twoSeconds.meanRgbDifference > s2Motion.meanRgbDifference * 3, 'S3 motion materially stronger than GREEN S2 at ' + view);
    check(material.uniforms.uAudio.value.toArray().every(v => v === 0) && material.uniforms.uKick.value === 0, 'audio OFF throughout');
    results.push({ view, distance: camera.position.length(), diskPixels: mask.length, twoSeconds, threeSeconds, adjacentMax, s2Motion });
  }
  // Existing BIRTH must still expose current surface pixels without a new effect.
  camera.position.set(10, 10, 48); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
  const journey = { elapsed: 10, cancelled: false, completed: false };
  renderer.setClearColor(0x401008, 1); sun.visible = false; image();
  const effect = new Journey2BirthComposite(renderer, journey); effect.setDestination(sun);
  renderer.setClearColor(0x000000, 1); sun.visible = true;
  const live = at(0), mask = []; for (let i = 0; i < live.length; i += 4) if (live[i] > 10) mask.push(i);
  journey.elapsed = 10.45; effect.render(camera);
  check(difference(live, read(), mask).meanRgbDifference < 1, 'BIRTH aperture transmits live S3 surface');
  const next = at(.2); journey.elapsed = 10.65; effect.render(camera);
  check(difference(next, read(), mask).meanRgbDifference < 1, 'BIRTH transmits continuously refreshed surface');
  effect.dispose();
  check(errors.length === 0, 'no WebGL2 shader errors');
  sun.geometry.dispose(); material.dispose(); reference.dispose(); renderer.dispose();
  return { checks, errors, results, frames };
};
</script></body></html>
`;
const routes={'/':()=>html,'/three.module.js':()=>readFileSync('node_modules/three/build/three.module.js'),'/three.core.js':()=>readFileSync('node_modules/three/build/three.core.js'),'/addons/postprocessing/Pass.js':()=>readFileSync('node_modules/three/examples/jsm/postprocessing/Pass.js'),'/SunSurface.js':()=>readFileSync('src/systems/SunSurface.js'),'/SunSurfaceS2.js':()=>execFileSync('git',['show','b5c802b39b414c50936a04b24a495f1129042312:src/systems/SunSurface.js'],{encoding:'utf8'}),'/Journey2BirthComposite.js':()=>readFileSync('src/systems/transit/Journey2BirthComposite.js')};
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
 const evaluation=await call('Runtime.evaluate',{expression:'runComposite()',awaitPromise:true,returnByValue:true});assert.ok(!evaluation.exceptionDetails,JSON.stringify(evaluation.exceptionDetails));const result=evaluation.result.value; if(process.env.SUN_S3_FRAME_DIR) for(const frame of result.frames) writeFileSync(join(process.env.SUN_S3_FRAME_DIR,frame.name),Buffer.from(frame.data,"base64")); delete result.frames;
 assert.equal(result.errors.length,0,JSON.stringify(result.errors));console.log(JSON.stringify(result));console.log('Sun S3 GPU: PASS (2/3-second plasma motion, arrival/raised Waltz, smooth/deterministic frames through 120 seconds, audio OFF, GREEN S2 comparison, live BIRTH, shader compilation).');
 await call('Browser.close');await sleep(200);
}finally{socket?.close();if(helper.exitCode===null)helper.kill();await Promise.race([new Promise(r=>helper.once('exit',r)),sleep(1000)]);await new Promise(r=>server.close(r));try{rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{console.log('Temporary shader-test profile retained outside repository.');}}
