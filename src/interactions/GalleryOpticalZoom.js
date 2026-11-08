/** Gallery-owned FOV adjustment. Does not modify camera pose or flight systems. */
export class GalleryOpticalZoom {
  constructor({camera,canvas,ownsCamera,blocked}) {
    Object.assign(this,{camera,canvas,ownsCamera,blocked});
    this.wheelOptions={passive:false};
    this.handler=event=>this.wheel(event);
    canvas.addEventListener("wheel",this.handler,this.wheelOptions);
  }
  enter() {
    this.leave();
    this.originalFov=this.camera.fov;
    this.targetFov=this.originalFov;
    this.minFov=Math.min(this.originalFov,Math.max(5,this.originalFov*.35));
    this.maxFov=Math.max(this.originalFov,Math.min(120,this.originalFov*1.5));
    this.lastTime=undefined;
  }
  wheel(event) {
    if(this.originalFov===undefined||!this.ownsCamera()||this.blocked()||event.target!==this.canvas||event.ctrlKey||!Number.isFinite(event.deltaY)||!event.deltaY)return;
    const units=event.deltaMode===1?16:event.deltaMode===2?(this.canvas.clientHeight||800):1;
    const delta=Math.max(-300,Math.min(300,event.deltaY*units));
    this.targetFov=Math.max(this.minFov,Math.min(this.maxFov,this.targetFov*Math.exp(delta*.0015)));
    event.preventDefault();event.stopPropagation();
  }
  update(delta) {
    if(this.originalFov===undefined)return;
    if(!this.ownsCamera()){this.leave();return;}
    const time=globalThis.performance?.now?.()??Date.now();
    const dt=Number.isFinite(delta)?Math.max(0,Math.min(.1,delta)):this.lastTime===undefined?1/60:Math.max(0,Math.min(.1,(time-this.lastTime)/1000));
    this.lastTime=time;
    if(this.blocked()){this.targetFov=this.camera.fov;return;}
    const next=this.camera.fov+(this.targetFov-this.camera.fov)*(1-Math.exp(-12*dt));
    const fov=Math.abs(this.targetFov-next)<.0001?this.targetFov:next;
    if(fov!==this.camera.fov){this.camera.fov=fov;this.camera.updateProjectionMatrix();}
  }
  leave() {
    if(this.originalFov===undefined)return;
    this.camera.fov=this.originalFov;this.camera.updateProjectionMatrix();
    this.originalFov=undefined;this.targetFov=undefined;this.lastTime=undefined;
  }
  dispose() {this.leave();this.canvas.removeEventListener("wheel",this.handler,this.wheelOptions);}
}
