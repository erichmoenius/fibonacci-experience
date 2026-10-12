import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { writeFileSync, readFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
const browser=[process.env.JOURNEY_TEST_BROWSER,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>p&&existsSync(p));
assert.ok(browser,'Existing Chromium required; no dependency downloads');
const record=process.argv.find(arg=>arg.startsWith('--record='))?.slice('--record='.length);
const capture=process.argv.find(arg=>arg.startsWith('--capture='))?.slice('--capture='.length);
const directory=mkdtempSync(join(tmpdir(),'fibonacci-plasma-test-'));
assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep));
const html=`<!doctype html><html><body style="margin:0;background:#000"><script type="importmap">{"imports":{"three":"/three.module.js"}}</script><script type="module">
import * as THREE from 'three';import {JourneyPlasma,plasmaEnvelope,PLASMA_MAX_ALPHA} from '/JourneyPlasma.js';import {JourneyAtmosphere} from '/JourneyAtmosphere.js';
window.runPlasma=async(captureRequested=false)=>{
 const errors=[];const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});document.body.appendChild(renderer.domElement);renderer.setSize(320,180);renderer.setClearColor(0,0);
 renderer.debug.onShaderError=(gl,program,vertex,fragment)=>errors.push([gl.getProgramInfoLog(program),gl.getShaderInfoLog(vertex),gl.getShaderInfoLog(fragment)]);
 let peakImage,cloudImage;const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,16/9,.1,100);camera.position.z=5;const cameraBefore=JSON.stringify([camera.position.toArray(),camera.quaternion.toArray(),camera.fov]);
 const cloudMap=await new THREE.TextureLoader().loadAsync('/clouds-4k.jpg');const owner=new THREE.Group();owner.material={uniforms:{cloudMap:{value:cloudMap},sunDirection:{value:new THREE.Vector3(-.8,.4,.3).normalize()}}};scene.add(owner);let cloudDisposals=0;cloudMap.addEventListener('dispose',()=>cloudDisposals++);
 const effect=new JourneyPlasma(owner),gl=renderer.getContext(),pixels=new Uint8Array(320*180*4),samples=[];
 const sample=(time,progress)=>{effect.update(time,progress);renderer.render(scene,camera);gl.readPixels(0,0,320,180,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let corridorAlpha=0,bankAlpha=0,corridorCount=0,bankCount=0;let maxAlpha=0,nonzero=0,premultiplied=true,blue=0,warm=0,alphaHash=0,hash=0,alphaSum=0,strong=0,edgeAlpha=0,edgeCount=0;for(let i=0;i<pixels.length;i+=4){const a=pixels[i+3];alphaSum+=a;if(a>=26)strong++;const x=(i/4)%320,y=Math.floor(i/4/320);if(x<64||x>=256||y<36||y>=144){edgeAlpha+=a;edgeCount++;}if(x>=144&&x<176){corridorAlpha+=a;corridorCount++;}if(x<80||x>=240){bankAlpha+=a;bankCount++;}maxAlpha=Math.max(maxAlpha,a);if(a){nonzero++;if(pixels[i+2]>=pixels[i])blue++;if(pixels[i]>pixels[i+2]+4&&pixels[i]>pixels[i+1]+2)warm++;}alphaHash=(Math.imul(alphaHash,31)+a)|0;if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>a+1)premultiplied=false;hash=(Math.imul(hash,31)+pixels[i]+pixels[i+1]*3+pixels[i+2]*7+a*11)|0;}
  if(captureRequested&&time===3.2)peakImage=renderer.domElement.toDataURL('image/png');if(captureRequested&&time===5.15)cloudImage=renderer.domElement.toDataURL('image/png');const center=pixels[(90*320+160)*4+3];samples.push({time,envelope:plasmaEnvelope(time),cloudIntensity:effect.cloudIntensity,maxAlpha,nonzero,center,premultiplied,blue,warm,alphaHash,hash,corridorAlpha:corridorAlpha/(corridorCount*255),bankAlpha:bankAlpha/(bankCount*255),meanAlpha:alphaSum/(320*180*255),strongFraction:strong/(320*180),edgeMeanAlpha:edgeAlpha/(edgeCount*255),drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,programs:renderer.info.programs.length,aspect:effect.uniforms.uAspect.value});};
 sample(1,.03);sample(3.05,.44);sample(3.2,.48);sample(3.35,.54);sample(3.5,.57);sample(3.7,.6);sample(4.5,.83);sample(5.15,.9);sample(5.8,.96);sample(6.49,1);sample(6.5,1);sample(8,1);
 const borrowedReleasedByEffect=cloudDisposals;cloudMap.dispose();const cameraAfter=JSON.stringify([camera.position.toArray(),camera.quaternion.toArray(),camera.fov]);const resources={disposed:effect.disposed,parent:effect.mesh.parent===null,geometries:renderer.info.memory.geometries,programs:renderer.info.programs.length};
 renderer.dispose();renderer.forceContextLoss();return {borrowedReleasedByEffect,maxAlphaBound:PLASMA_MAX_ALPHA,peakImage,cloudImage,errors,samples,resources,cameraUnchanged:cameraBefore===cameraAfter,rendererKind:'Headless Chromium WebGL2 via SwiftShader; no RTX/FPS claim'};
};
window.prepareComposite=(time,shown)=>{
 if(!window.composite){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:false,preserveDrawingBuffer:true});renderer.setSize(320,180);renderer.domElement.style.cssText='position:fixed;left:0;top:0';document.body.appendChild(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,16/9,.1,100);camera.position.z=5;
  const backdrop=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({vertexShader:'varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'varying vec2 uvScreen;void main(){vec2 p=(uvScreen-.5)*vec2(1.7778,1.);float globe=1.-smoothstep(.86,.88,length(p-vec2(0.,-.77)));vec3 c=mix(vec3(.012,.022,.035),vec3(.06,.20,.32),globe);gl_FragColor=vec4(c,1.);}',depthTest:false,depthWrite:false,toneMapped:false}));backdrop.frustumCulled=false;scene.add(backdrop);
  const effect=new JourneyPlasma(scene),overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;background:black;opacity:0;transition:opacity 1s linear;z-index:10';document.body.appendChild(overlay);const atmosphere=new JourneyAtmosphere(overlay);
  window.composite={renderer,scene,camera,backdrop,effect,atmosphere};
 }
 const c=window.composite;c.effect.update(time,.48);c.effect.mesh.visible=shown&&plasmaEnvelope(time)>0;
 const x=THREE.MathUtils.clamp((time-2)/2.5,0,1),haze=x*x*x*(x*(x*6-15)+10)*0.30;
 c.atmosphere.update({haze,clouds:0,whiteout:0,time});c.renderer.render(c.scene,c.camera);getComputedStyle(c.atmosphere.overlay).opacity;
 return {haze,curtainOpacity:c.atmosphere.overlay.style.opacity,hazeOpacity:c.atmosphere.layers[0].style.opacity,cloudOpacity:c.atmosphere.layers[1].style.opacity};
};
window.disposeComposite=()=>{const c=window.composite;c.effect.dispose();c.backdrop.geometry.dispose();c.backdrop.material.dispose();c.atmosphere.clear();c.renderer.dispose();c.renderer.forceContextLoss();c.renderer.domElement.remove();return true;};
</script></body></html>`;
const routes={'/':()=>html,'/three.module.js':()=>readFileSync('node_modules/three/build/three.module.js'),'/three.core.js':()=>readFileSync('node_modules/three/build/three.core.js'),'/JourneyPlasma.js':()=>readFileSync('src/systems/cinematic/JourneyPlasma.js'),'/JourneyAtmosphere.js':()=>readFileSync('src/systems/cinematic/JourneyAtmosphere.js'),'/clouds-4k.jpg':()=>readFileSync('public/textures/earth/clouds-4k.jpg')};
const server=createServer((req,res)=>{const route=routes[req.url];if(!route){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':req.url==='/'?'text/html':req.url.endsWith('.jpg')?'image/jpeg':'text/javascript'});res.end(route());});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const helper=spawn(browser,['--headless','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+directory,'about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let socket;
try {
 for(let i=0;i<200&&!existsSync(join(directory,'DevToolsActivePort'));i++)await sleep(25);
 const port=readFileSync(join(directory,'DevToolsActivePort'),'utf8').split('\n')[0];const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,e)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',e,{once:true});});
 let id=0;const pending=new Map();socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(!m.id)return;const p=pending.get(m.id);pending.delete(m.id);if(m.error)p.e(m.error);else p.r(m.result);});
 const call=(method,params={})=>new Promise((r,e)=>{const n=++id;pending.set(n,{r,e});socket.send(JSON.stringify({id:n,method,params}));});
 await call('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'});
 let ready=false;for(let i=0;i<100;i++){ready=(await call('Runtime.evaluate',{expression:'typeof runPlasma === "function"',returnByValue:true})).result.value;if(ready)break;await sleep(30);}assert.ok(ready,'Local shader fixture loaded');
 const evaluation=await call('Runtime.evaluate',{expression:'runPlasma('+Boolean(capture)+')',awaitPromise:true,returnByValue:true});assert.ok(!evaluation.exceptionDetails,JSON.stringify(evaluation.exceptionDetails));const result=evaluation.result.value;
 assert.equal(result.errors.length,0,JSON.stringify(result.errors));assert.ok(result.cameraUnchanged,'No camera state mutation');
 for(const sample of result.samples){assert.ok(sample.maxAlpha<=Math.ceil(result.maxAlphaBound*255),'Actual fragment alpha cap');if(sample.cloudIntensity===0)assert.equal(sample.center,0,'Fire-facing center remains transparent');assert.ok(sample.premultiplied,'Correct premultiplied fragment output');}
 const peak=result.samples.find(s=>s.time===3.2);assert.ok(peak.maxAlpha>=3&&peak.nonzero>100,'Visible plasma fragments at peak');assert.ok(peak.warm/peak.nonzero>.7,'Hot amber/orange reentry dominates, not pale blue-white curtains');assert.equal(peak.drawCalls,1,'One visual draw per existing scene pass');assert.equal(peak.geometries,1,'One geometry');assert.equal(peak.programs,1,'One shader program');assert.equal(peak.aspect,16/9,'Buffer aspect consumed');
 assert.ok(peak.edgeMeanAlpha>.07&&peak.strongFraction>.1,'Visible fire without opaque screen');
 const cloudSamples=result.samples.filter(sample=>sample.cloudIntensity>0.01);assert.ok(cloudSamples.length>=2&&cloudSamples.every(sample=>sample.maxAlpha>5&&sample.maxAlpha<=174),'Visible bounded cloud layers');assert.ok(cloudSamples.every(sample=>sample.bankAlpha>sample.corridorAlpha*1.4),'Rendered side banks denser than canyon corridor');assert.notEqual(cloudSamples[0].hash,cloudSamples[1].hash,'Cloud banks rush with the authoritative time');assert.equal(result.borrowedReleasedByEffect,0,'Borrowed Earth weather texture is not disposed by effect');
 assert.notEqual(result.samples[1].hash,result.samples[3].hash,'Organic field flows from journey time');
 for(const time of [1,4.5,6.5,8]){const sample=result.samples.find(s=>s.time===time);assert.equal(sample.maxAlpha,0,'No effect in PULL/veil/BIRTH');assert.equal(sample.drawCalls,0,'No hidden plasma draw');}
 assert.ok(result.resources.disposed&&result.resources.parent&&result.resources.geometries===0&&result.resources.programs===0,'GPU resources released before BIRTH');
 if(capture){writeFileSync(capture,Buffer.from(result.peakImage.split(',')[1],'base64'));writeFileSync(capture.replace(/\.png$/,'-cloud.png'),Buffer.from(result.cloudImage.split(',')[1],'base64'));delete result.peakImage;delete result.cloudImage;console.log('Isolated fire/cloud shader images saved.');}
 const decode=data=>{const bytes=Buffer.from(data,'base64'),parts=[];let width,height,bpp;for(let offset=8;offset<bytes.length;){const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),chunk=bytes.subarray(offset+8,offset+8+length);if(type==='IHDR'){width=chunk.readUInt32BE(0);height=chunk.readUInt32BE(4);assert.equal(chunk[8],8);assert.ok([2,6].includes(chunk[9]));bpp=chunk[9]===2?3:4;}if(type==='IDAT')parts.push(chunk);offset+=length+12;}const raw=inflateSync(Buffer.concat(parts)),stride=width*bpp,out=Buffer.alloc(width*height*3);let previous=Buffer.alloc(stride);for(let y=0;y<height;y++){const filter=raw[y*(stride+1)],row=Buffer.from(raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)));for(let x=0;x<stride;x++){const a=x>=bpp?row[x-bpp]:0,b=previous[x],c=x>=bpp?previous[x-bpp]:0,p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);const predictor=pa<=pb&&pa<=pc?a:pb<=pc?b:c;row[x]=(row[x]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):predictor))&255;}for(let x=0;x<width;x++)for(let ch=0;ch<3;ch++)out[(y*width+x)*3+ch]=row[x*bpp+ch];previous=row;}return out;};
 const screenshot=async()=> (await call('Page.captureScreenshot',{format:'png',fromSurface:true,clip:{x:0,y:0,width:320,height:180,scale:1}})).data;
 const compositeState=(await call('Runtime.evaluate',{expression:'prepareComposite(3.2,false)',returnByValue:true})).result.value;
 const baseline=decode(await screenshot());await call('Runtime.evaluate',{expression:'prepareComposite(3.2,true)'});const compositePng=await screenshot(),withPlasma=decode(compositePng);
 let edgeGain=0,edgeCount=0,strongEdges=0,darkenedPixels=0,centerMaxDelta=0;
 for(let y=0;y<180;y++)for(let x=0;x<320;x++){const i=(y*320+x)*3;if([0,1,2].some(c=>withPlasma[i+c]<baseline[i+c]-1))darkenedPixels++;const d=[0,1,2].map(c=>Math.abs(withPlasma[i+c]-baseline[i+c])),gain=Math.max(...d);if(x<64||x>=256||y<36||y>=144){edgeGain+=gain;edgeCount++;if(gain>=26)strongEdges++;}if(Math.hypot(x/320-.5,y/180-.5)<.22)centerMaxDelta=Math.max(centerMaxDelta,gain);}
 result.composited={...compositeState,edgeMeanChannelDelta:edgeGain/edgeCount,edgeStrongFraction:strongEdges/edgeCount,centerMaxDelta,darkenedPixels,method:'Actual browser screenshot with opaque synthetic horizon and production haze; not a full Earth acceptance test'};
 assert.equal(centerMaxDelta,0,'Actual composited center/horizon window preserved');assert.equal(darkenedPixels,0,'Emissive composition never darkens the underlying horizon');
 if(record!=='before'){assert.ok(result.composited.edgeMeanChannelDelta>15&&result.composited.edgeStrongFraction>.15,'Unmistakable actual composited contribution beneath haze');}
 if(capture)writeFileSync(capture.replace(/\.png$/,'-composited.png'),Buffer.from(compositePng,'base64'));
 await call('Runtime.evaluate',{expression:'disposeComposite()'});

 if(record){writeFileSync('docs/PLASMA-7A1-'+record+'.json',JSON.stringify(result,null,2)+'\n');}
 console.log(JSON.stringify(result));console.log('Plasma shader/browser regression: PASS (real shader compile, alpha pixels, center clearance, flow and resource release).');
 await call('Browser.close');await sleep(200);
}finally{socket?.close();if(helper.exitCode===null)helper.kill();await Promise.race([new Promise(r=>helper.once('exit',r)),sleep(1000)]);await new Promise(r=>server.close(r));try{rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});}catch{console.log('Temporary shader-test profile retained outside repository.');}}
