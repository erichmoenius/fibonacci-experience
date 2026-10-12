import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

export const JOURNEY2_BIRTH_SECONDS = 1.5;

// Independent of Journey 3: one outgoing GPU snapshot over the live destination.
export class Journey2BirthComposite {
  constructor(renderer, journey) {
    this.renderer = renderer;
    this.journey = journey;
    this.sun = null;
    this.disposed = false;
    this.startTime = journey.elapsed;
    this.lastTime = this.startTime;
    this.sunConfidence = 0;
    this.size = new THREE.Vector2();
    this.point = new THREE.Vector3();
    renderer.getDrawingBufferSize(this.size);
    this.source = new THREE.FramebufferTexture(this.size.x, this.size.y);
    this.live = new THREE.FramebufferTexture(this.size.x, this.size.y);
    renderer.copyFramebufferToTexture(this.source);
    this.uniforms = {
      sourceFrame: { value: this.source }, liveFrame: { value: this.live },
      progress: { value: 0 }, aspect: { value: this.size.x / this.size.y },
      sunCenter: { value: new THREE.Vector2(0.5, 0.5) }, sunValid: { value: 0 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: /* glsl */ `
        uniform sampler2D sourceFrame, liveFrame;
        uniform float progress, aspect, sunValid;
        uniform vec2 sunCenter;
        varying vec2 vUv;
        vec3 decode(vec3 c) { return mix(pow((c+0.055)/1.055,vec3(2.4)),c/12.92,lessThanEqual(c,vec3(0.04045))); }
        void main() {
          float t = progress * progress * (3.0 - 2.0 * progress);
          vec2 center = mix(vec2(0.5), sunCenter, t * sunValid);
          vec2 sourceUv = clamp((vUv-center)/(1.0+t*0.1)+vec2(0.5),vec2(0.0),vec2(1.0));
          vec4 a=texture2D(sourceFrame,sourceUv), b=texture2D(liveFrame,vUv);
          vec2 distanceScale=vec2(aspect,1.0);
          float farthest=length(max(sunCenter,vec2(1.0)-sunCenter)*distanceScale);
          float radius=t*(farthest+0.15);
          float opening=(1.0-smoothstep(radius,radius+0.12,length((vUv-sunCenter)*distanceScale)))
            * smoothstep(0.0,0.12,progress);
          float reveal=mix(t,opening,sunValid);
          // Always finish on deadline, even when the Sun never enters the view.
          reveal=mix(reveal,1.0,smoothstep(0.65,1.0,progress));
          vec3 ca=decode(a.rgb/max(a.a,0.00001))*a.a;
          vec3 cb=decode(b.rgb/max(b.a,0.00001))*b.a;
          float alpha=mix(a.a,b.a,reveal);
          gl_FragColor=vec4(mix(ca,cb,reveal)/max(alpha,0.00001),alpha);
          #include <colorspace_fragment>
          #include <premultiplied_alpha_fragment>
        }`,
      blending: THREE.NoBlending, premultipliedAlpha: true,
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }

  setDestination(sun) { this.sun = sun ?? null; }

  render(camera) {
    if (this.disposed) return;
    const time = this.journey.elapsed;
    const progress = THREE.MathUtils.clamp((time - this.startTime) / JOURNEY2_BIRTH_SECONDS, 0, 1);
    if (this.journey.cancelled || this.journey.completed || progress >= 1) { this.dispose(); return; }
    const delta = Math.max(0, time - this.lastTime); this.lastTime = time;
    let visible = false;
    if (this.sun) {
      camera.updateMatrixWorld(true);
      this.sun.getWorldPosition(this.point);
      const front = this.point.clone().applyMatrix4(camera.matrixWorldInverse).z < -camera.near;
      this.point.project(camera);
      visible = front && this.point.z >= -1 && this.point.z <= 1
        && Math.abs(this.point.x) <= 1 && Math.abs(this.point.y) <= 1;
      if (visible) this.uniforms.sunCenter.value.set((this.point.x+1)*0.5,(this.point.y+1)*0.5);
    }
    this.sunConfidence = THREE.MathUtils.clamp(this.sunConfidence + (visible ? delta : -delta) / 0.15, 0, 1);
    const renderer = this.renderer;
    renderer.getDrawingBufferSize(this.size);
    if (this.size.x !== this.live.image.width || this.size.y !== this.live.image.height) {
      this.live.dispose(); this.live = new THREE.FramebufferTexture(this.size.x,this.size.y);
      this.uniforms.liveFrame.value = this.live;
    }
    renderer.copyFramebufferToTexture(this.live);
    this.uniforms.progress.value = progress;
    this.uniforms.aspect.value = this.size.x / Math.max(this.size.y,1);
    this.uniforms.sunValid.value = this.sunConfidence;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    try { this.quad.render(renderer); } finally { renderer.autoClear = autoClear; }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.source.dispose(); this.live.dispose(); this.material.dispose(); this.quad.dispose();
    this.sun = this.journey = null;
  }
}
