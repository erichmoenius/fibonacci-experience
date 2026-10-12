import * as THREE from "three";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

export const BIRTH_DISSOLVE_SECONDS = 0.45;
export function birthSourceWeight(time, ready) {
  if (!ready) return 1;
  const x = THREE.MathUtils.clamp((time - 7.5) / BIRTH_DISSOLVE_SECONDS, 0, 1);
  return 1 - x * x * x * (x * (x * 6 - 15) + 10);
}

// GPU copies of display-encoded, premultiplied canvas pixels; no DOM overlay.
export class JourneyBirthDissolve {
  constructor(renderer) {
    this.renderer = renderer;
    this.disposed = false;
    this.time = 7.5;
    this.destination = null;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.source = new THREE.FramebufferTexture(size.x, size.y);
    this.live = new THREE.FramebufferTexture(size.x, size.y);
    renderer.copyFramebufferToTexture(this.source);
    this.material = new THREE.ShaderMaterial({
      uniforms: { sourceFrame: { value: this.source }, liveFrame: { value: this.live }, sourceWeight: { value: 1 } },
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
      fragmentShader: `
        uniform sampler2D sourceFrame, liveFrame;
        uniform float sourceWeight;
        varying vec2 vUv;
        vec3 decode(vec3 c) { return mix(pow((c+0.055)/1.055,vec3(2.4)),c/12.92,lessThanEqual(c,vec3(0.04045))); }
        void main(){
          vec4 a=texture2D(sourceFrame,vUv), b=texture2D(liveFrame,vUv);
          // Unpremultiply display pixels before decoding, then mix linear premultiplied colour.
          vec3 ca=decode(a.rgb/max(a.a,0.00001))*a.a;
          vec3 cb=decode(b.rgb/max(b.a,0.00001))*b.a;
          float alpha=mix(b.a,a.a,sourceWeight);
          gl_FragColor=vec4(mix(cb,ca,sourceWeight)/max(alpha,0.00001),alpha);
          #include <colorspace_fragment>
          #include <premultiplied_alpha_fragment>
        }`,
      blending: THREE.NoBlending, premultipliedAlpha: true,
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.quad = new FullScreenQuad(this.material);
  }
  update(time) { this.time = time; }
  render() {
    if (this.disposed) return;
    const ready = this.destination?.group.visible && this.destination.loadErrors.length === 0;
    const weight = birthSourceWeight(this.time, ready);
    if (weight === 0) { this.dispose(); return; }
    const renderer = this.renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (size.x !== this.live.image.width || size.y !== this.live.image.height) {
      this.live.dispose(); this.live = new THREE.FramebufferTexture(size.x,size.y);
      this.material.uniforms.liveFrame.value = this.live;
    }
    renderer.copyFramebufferToTexture(this.live);
    this.material.uniforms.sourceWeight.value = weight;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    try { this.quad.render(renderer); } finally { renderer.autoClear = autoClear; }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.source.dispose(); this.live.dispose(); this.material.dispose(); this.quad.dispose();
    this.destination = null;
  }
}
