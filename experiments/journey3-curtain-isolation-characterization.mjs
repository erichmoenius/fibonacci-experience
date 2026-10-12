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
  const isolation=[];
  for(const [width,height] of [[320,180],[180,320]]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    const setup=await call('Runtime.evaluate',{expression:`window.isolated=new JourneyAtmosphere(overlay);window.isolationStep=t=>{const x=Math.max(0,Math.min(1,(t-7.5)/2.5)),reveal=t<7.5?1:1-x*x*x*(x*(x*6-15)+10);isolated.update({haze:.3,clouds:t<6.5?1:0,whiteout:entryVeil(t),reveal,time:t});return {greyDisplay:getComputedStyle(isolated.layers[2]).display,logicalOpacity:isolated.whiteout,layerOpacity:Number(getComputedStyle(isolated.layers[2]).opacity),haze:Number(getComputedStyle(isolated.layers[0]).opacity),clouds:Number(getComputedStyle(isolated.layers[1]).opacity)};};`,returnByValue:true});
    assert.ok(!setup.exceptionDetails);
    const shot=async()=>decodeRGB((await call('Page.captureScreenshot',{format:'png',fromSurface:true})).data);
    const observed=[];
    for(const time of [5.3,7.38,7.5,7.72,7.82,10]) {
      const state=(await call('Runtime.evaluate',{expression:'isolationStep('+time+')',returnByValue:true})).result.value;
      assert.equal(state.greyDisplay,'none','Grey SVG, backing and warm gradients are hidden');
      if(time===7.5) {
        assert.equal(state.logicalOpacity,1,'Existing authoritative handoff envelope retained');
        await call('Runtime.evaluate',{expression:'isolated.obscure()'});
        assert.equal((await call('Runtime.evaluate',{expression:'getComputedStyle(isolated.layers[2]).display',returnByValue:true})).result.value,'none','obscure cannot restore the hidden layer');
      }
      if(time===5.3)assert.ok(state.haze>0&&state.clouds>0,'Underlying haze/cloud compositor layers remain enabled');
      if(time===10)assert.equal(state.haze,0,'Existing reveal completes');
      const visible=await shot();
      await call('Runtime.evaluate',{expression:'isolated.layers[2].remove()'});
      assert.deepEqual(await shot(),visible,'Hidden curtain contributes zero pixels at '+time);
      await call('Runtime.evaluate',{expression:'overlay.appendChild(isolated.layers[2])'});
      observed.push({time,...state});
    }
    // The scene can be seen through the unmasked handoff, as intended for diagnosis.
    await call('Runtime.evaluate',{expression:"document.body.style.background='rgb(8,22,40)';isolationStep(7.5)"});
    const dark=await shot();
    await call('Runtime.evaluate',{expression:"document.body.style.background='rgb(250,230,190)';isolationStep(7.5)"});
    assert.notDeepEqual(await shot(),dark,'Underlying scene visible at handoff');
    await call('Runtime.evaluate',{expression:'isolated.clear();isolated.clear()'});
    const cleanup=await sample('isolated-cleanup');assert.equal(cleanup.computedOpacity,0);assert.equal(cleanup.children,0);
    const finalPixels=await shot();for(let i=0;i<finalPixels.length;i+=3)assert.deepEqual([...finalPixels.subarray(i,i+3)],[250,230,190],'No residual grey or black cleanup pulse');
    isolation.push({ratio:width>height?'16:9':'9:16',observed,cleanup:'PASS'});
  }
  console.log(JSON.stringify({isolation,cancellations}));
  await call('Browser.close');
  await sleep(200);
  console.log('Curtain isolation: PASS (16:9/9:16, no grey pixels, handoff exposed, underlying haze/clouds preserved, cleanup).');
} finally {
  socket?.close();if(processBrowser.exitCode===null)processBrowser.kill();
  await Promise.race([new Promise(r=>processBrowser.once('exit',r)),sleep(1000)]);
  try {rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:100});} catch {console.log('Temporary browser profile retained outside repository after process exit.');}
}
