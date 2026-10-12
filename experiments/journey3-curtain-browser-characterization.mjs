import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
const browser = [process.env.JOURNEY_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
assert.ok(browser, 'Existing Chromium browser required; no dependency download');
const record = process.argv.find(arg => arg.startsWith('--record='))?.split('=')[1];
const directory = mkdtempSync(join(tmpdir(), 'fibonacci-curtain-test-'));
assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep), 'Temporary profile must remain under named temp root');
const processBrowser = spawn(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + directory, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
try {
  for (let i=0;i<200 && !existsSync(join(directory,'DevToolsActivePort'));i++) await sleep(25);
  const port = readFileSync(join(directory,'DevToolsActivePort'),'utf8').split('\n')[0];
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve,reject) => {socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let nextId=0;const pending=new Map();
  socket.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(!msg.id)return;const p=pending.get(msg.id);pending.delete(msg.id);if(msg.error)p.reject(msg.error);else p.resolve(msg.result);});
  const call = (method,params={})=>new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  await call('Emulation.setDeviceMetricsOverride',{width:64,height:64,deviceScaleFactor:1,mobile:false});
  const source=(record==='before' ? execFileSync('git',['show','94c6c7e3a07ad59f058d4b01e45390c32803f2ad:src/systems/cinematic/JourneyAtmosphere.js'],{encoding:'utf8'}) : readFileSync('src/systems/cinematic/JourneyAtmosphere.js','utf8')).replace(/^export /gm,'');
  await call('Runtime.evaluate',{expression:`document.body.style.margin='0';document.body.style.background='rgb(64,128,192)';
    const overlay=document.createElement('div');overlay.style.cssText='position:fixed;inset:0;background:black;opacity:0;transition:opacity 1s linear';document.body.appendChild(overlay);
    ${source}
    const atmosphere=new JourneyAtmosphere(overlay);atmosphere.update({haze:1,clouds:1,whiteout:1,reveal:0.000003,time:9.98});
    window.traceSample=label=>{const s=getComputedStyle(overlay);return {label,time:performance.now(),logicalOpacity:overlay.style.opacity,computedOpacity:Number(s.opacity),background:s.backgroundColor,transition:s.transition,children:overlay.children.length,blend:s.mixBlendMode};};
    window.traceClear=()=>atmosphere.clear();`});
  const sample=async label => (await call('Runtime.evaluate',{expression:`traceSample(${JSON.stringify(label)})`,returnByValue:true})).result.value;
  const rows=[await sample('last-travel')];
  await call('Runtime.evaluate',{expression:'traceClear()'});
  rows.push(await sample('completion'));
  await sleep(16);rows.push(await sample('first-explore'));
  const capture=await call('Page.captureScreenshot',{format:'png',fromSurface:true});
  const png=join(directory,'first-explore.png');writeFileSync(png,Buffer.from(capture.data,'base64'));
  const decodeRGB=data=>{
    const bytes=Buffer.from(data,'base64'),parts=[];let width,height,bpp;
    for(let offset=8;offset<bytes.length;){const length=bytes.readUInt32BE(offset),type=bytes.toString('ascii',offset+4,offset+8),chunk=bytes.subarray(offset+8,offset+8+length);if(type==='IHDR'){width=chunk.readUInt32BE(0);height=chunk.readUInt32BE(4);assert.equal(chunk[8],8);assert.ok([2,6].includes(chunk[9]));bpp=chunk[9]===2?3:4;}if(type==='IDAT')parts.push(chunk);offset+=length+12;}
    const raw=inflateSync(Buffer.concat(parts)),stride=width*bpp,out=Buffer.alloc(width*height*3);let previous=Buffer.alloc(stride);
    for(let y=0;y<height;y++){const filter=raw[y*(stride+1)],row=Buffer.from(raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)));for(let x=0;x<stride;x++){const a=x>=bpp?row[x-bpp]:0,b=previous[x],c=x>=bpp?previous[x-bpp]:0,p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c),predictor=pa<=pb&&pa<=pc?a:pb<=pc?b:c;row[x]=(row[x]+(filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):predictor))&255;}for(let x=0;x<width;x++)for(let ch=0;ch<3;ch++)out[(y*width+x)*3+ch]=row[x*bpp+ch];previous=row;}
    return out;
  };
  const firstPixels=decodeRGB(capture.data),pixel=[...firstPixels.subarray((32*64+32)*3,(32*64+32)*3+3)];
  await sleep(100);rows.push(await sample('explore-later'));
  await sleep(1100);rows.push(await sample('stable'));
  if(record!=='before') {
    assert.ok(rows.slice(1).every(row=>row.logicalOpacity==='0'&&row.computedOpacity===0),'Browser-computed opacity must be zero at cleanup and every exploration sample');
    assert.deepEqual(pixel,[64,128,192],'Actual first-exploration pixel must retain the stable scene background');
    assert.equal(rows.at(-1).transition,'opacity 1s linear','Borrowed transition restored');
    assert.equal(rows.at(-1).children,0,'Layers removed');
  }
  const cancellations=[];
  if(record!=='before') {
    for(const reveal of [1,0.4]) {
      const outcome=await call('Runtime.evaluate',{expression:`(()=>{const cancelled=new JourneyAtmosphere(overlay);cancelled.update({haze:1,clouds:1,whiteout:1,reveal:${reveal}});getComputedStyle(overlay).opacity;cancelled.clear();cancelled.clear();return traceSample('cancel-${reveal}');})()`,returnByValue:true});
      cancellations.push(outcome.result.value);
      assert.equal(outcome.result.value.computedOpacity,0,'Cancellation must not create a black opacity transition');
      assert.equal(outcome.result.value.children,0,'Cancellation removes every layer');
    }
    // Protect everything except the confirmed clear() opacity-commit change.
    const original=execFileSync('git',['show','78f72485b05b68be116ea4d11faaf1e9848e788d:src/systems/cinematic/JourneyAtmosphere.js'],{encoding:'utf8'}).replaceAll('\r\n','\n');
    assert.equal(source.slice(source.indexOf('  clear()')).replaceAll('\r\n','\n'),original.slice(original.indexOf('  clear()')), 'Proven transparent cleanup is exactly unchanged');
  }
  let renderedNearWhite=null;
  if(record!=='before'){
    await call('Runtime.evaluate',{expression:`document.body.style.background='rgb(8,22,40)';const pulse=new JourneyAtmosphere(overlay);window.pulseStep=t=>{const x=Math.max(0,Math.min(1,(t-7.5)/2.5)),reveal=t<7.5?1:1-x*x*x*(x*(x*6-15)+10);pulse.update({haze:.3,clouds:0,whiteout:entryVeil(t),reveal,time:t});return {time:t,opacity:Number(getComputedStyle(pulse.layers[2]).opacity)};};window.pulseClear=()=>pulse.clear();`});
    let duration=0;const pulseSamples=[];
    for(let i=0;i<=34;i++){const time=7.10+i*.025;const state=(await call('Runtime.evaluate',{expression:'pulseStep('+time+')',returnByValue:true})).result.value;const shot=await call('Page.captureScreenshot',{format:'png',fromSurface:true});const rgb=decodeRGB(shot.data);let sum=0;for(const value of rgb)sum+=value;const brightness=sum/(rgb.length*255);if(brightness>.85)duration+=.025;pulseSamples.push({...state,brightness});}
    assert.equal(duration,0,'No rendered near-white cloud pulse');
    const handoff=pulseSamples.find(s=>Math.abs(s.time-7.5)<1e-9);
    console.log('Dark handoff sample: '+JSON.stringify(handoff));
    assert.ok(handoff.brightness>0.15&&handoff.brightness<0.5,'Handoff is blue-grey cloud, neither black nor white');
    assert.equal(pulseSamples.find(s=>Math.abs(s.time-7.5)<1e-9).opacity,1,'Actual theme-switch sample is fully opaque');
    await call('Runtime.evaluate',{expression:'pulseStep(7.5)'});
    const darkShot=decodeRGB((await call('Page.captureScreenshot',{format:'png',fromSurface:true})).data);
    await call('Runtime.evaluate',{expression:"document.body.style.background='rgb(250,230,190)';pulseStep(7.5)"});
    const brightShot=decodeRGB((await call('Page.captureScreenshot',{format:'png',fromSurface:true})).data);
    assert.deepEqual(brightShot,darkShot,'Opaque cloud pixels fully conceal different source/destination scenes');
    assert.ok(Math.max(...darkShot)-Math.min(...darkShot)>20,'Cloud mask retains spatial shading');
    assert.ok(pulseSamples.every(s=>s.brightness>0.02&&s.brightness<0.5),'No white or black frame over dark atmospheric reference');
    await call('Runtime.evaluate',{expression:'pulseClear()'});assert.equal((await sample('pulse-cleanup')).computedOpacity,0);
    renderedNearWhite={seconds:Number(duration.toFixed(3)),threshold:'mean rendered RGB > 0.85 over dark atmospheric reference',samples:pulseSamples.length};
  }
  const coverage=[];
  if(record!=='before') {
    for(const [width,height] of [[320,180],[180,320]]) {
      await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
      await call('Runtime.evaluate',{expression:`window.ratioCurtain=new JourneyAtmosphere(overlay);window.ratioStep=t=>{const x=Math.max(0,Math.min(1,(t-7.5)/2.5)),reveal=t<7.5?1:1-x*x*x*(x*(x*6-15)+10);ratioCurtain.update({haze:.3,clouds:0,whiteout:entryVeil(t),reveal,time:t});return Number(getComputedStyle(ratioCurtain.layers[2]).opacity);};document.body.style.background='rgb(8,22,40)';`});
      const shot=async()=>decodeRGB((await call('Page.captureScreenshot',{format:'png',fromSurface:true})).data);
      const step=async t=>(await call('Runtime.evaluate',{expression:'ratioStep('+t+')',returnByValue:true})).result.value;
      const opacity=await step(7.5);assert.equal(opacity,1,'Handoff opacity unchanged');
      const dark=await shot();assert.equal(dark.length,width*height*3);
      await call('Runtime.evaluate',{expression:"document.body.style.background='rgb(250,230,190)'"});
      const bright=await shot();assert.deepEqual(bright,dark,'Every pixel concealed at '+width+'x'+height);
      let min=255,max=0,maxJump=0;
      for(let y=0;y<height;y++)for(let x=0;x<width;x++) {
        const i=(y*width+x)*3,r=dark[i],g=dark[i+1],b=dark[i+2];
        assert.ok(b>r&&g>=r&&r>20&&b<150,'Blue-grey cloud covers edges, corners and interior');
        min=Math.min(min,r,g,b);max=Math.max(max,r,g,b);
        for(const offset of [x?3:0,y?width*3:0])if(offset)for(let c=0;c<3;c++)maxJump=Math.max(maxJump,Math.abs(dark[i+c]-dark[i-offset+c]));
      }
      assert.ok(max-min>20,'Organic cloud shading preserved');
      assert.ok(maxJump<12,'No abrupt internal rectangular image edge');
      // Backing must conceal everything even if the SVG image is unavailable.
      await call('Runtime.evaluate',{expression:"window.ratioCloudImage=ratioCurtain.layers[2].style.backgroundImage;ratioCurtain.layers[2].style.backgroundImage='none'"});
      const backing=await shot();for(let i=0;i<backing.length;i+=3)assert.deepEqual([...backing.subarray(i,i+3)],[48,69,85],'Opaque backing across viewport');
      await call('Runtime.evaluate',{expression:'ratioCurtain.layers[2].style.backgroundImage=ratioCloudImage'});
      // Restore the original cloud image after exercising fallback coverage.
      const fade=[];
      for(const time of [7.18,7.28,7.38,7.5,7.62,7.72,7.82]) {
        const actual=await step(time);
        const expected=(await call('Runtime.evaluate',{expression:`entryVeil(${time})*(${time}<7.5?1:1-(()=>{const x=(${time}-7.5)/2.5;return x*x*x*(x*(x*6-15)+10);})())`,returnByValue:true})).result.value;
        assert.ok(Math.abs(actual-expected)<1e-6,'Unchanged computed fade at '+time);fade.push({time,opacity:actual});
      }
      await step(10);const end=await shot();for(let i=0;i<end.length;i+=3)assert.deepEqual([...end.subarray(i,i+3)],[250,230,190],'Underlying scene restored at journey completion');
      await call('Runtime.evaluate',{expression:'ratioCurtain.clear();ratioCurtain.clear()'});
      const cleaned=await sample('ratio-cleanup');assert.equal(cleaned.computedOpacity,0);assert.equal(cleaned.children,0);
      assert.deepEqual(await shot(),end,'Cleanup causes no black pulse');
      coverage.push({ratio:width>height?'16:9':'9:16',width,height,occludedPixels:width*height,backing:'PASS',maxAdjacentChannelJump:maxJump,fade,cleanup:'PASS'});
    }
  }
  const result={coverage,renderedNearWhite,cancellations,kind:'Real headless Chromium CSS/compositor fixture using production JourneyAtmosphere; no app preview or Three.js GPU claim',rows,firstExplorePixel:pixel,stableScenePixel:[64,128,192]};
  if(record){mkdirSync('docs/traces',{recursive:true});writeFileSync(`docs/traces/JOURNEY-3-PASS-6C-curtain-${record}.json`,JSON.stringify(result,null,2)+'\n');}
  console.log(JSON.stringify(result));
  await call('Browser.close');
  await sleep(200);
  console.log(record==='before'?'Before diagnosis recorded.':'Curtain browser regression: PASS (computed opacity, rendered pixel, cleanup and style restoration).');
} finally {
  socket?.close();if(processBrowser.exitCode===null)processBrowser.kill();
  await Promise.race([new Promise(r=>processBrowser.once('exit',r)),sleep(1000)]);
  try {rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});} catch {console.log('Temporary browser profile retained outside repository after process exit.');}
}
