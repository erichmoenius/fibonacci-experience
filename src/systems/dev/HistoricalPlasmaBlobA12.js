import * as THREE from "three";

// ------------------------------------------------
// VERTEX SHADER
// ------------------------------------------------
const VERT = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform float uOpacity;
uniform float uN1Amp;
uniform float uN1Freq;
uniform float uN2Amp;
uniform float uN2Freq;
uniform float uBass;
uniform float uKickDecay;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vN1;
varying float vN2;
varying float vDisplace;

float hash(vec3 p){
  p = fract(p * vec3(443.897, 441.423, 437.195));
  p += dot(p.zxy, p.yxz + 19.19);
  return fract(p.x * p.y * p.z);
}

float noise3D(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i+vec3(1,0,0)), u.x),
        mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), u.x), u.y),
    mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), u.x),
        mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), u.x), u.y),
    u.z);
}

float fbm1(vec3 p){
  float v=0.0, a=0.5, f=1.0;
  for(int i=0;i<5;i++){ v+=a*noise3D(p*f); f*=2.0; a*=0.5; }
  return v*2.0-1.0;
}

float fbm2(vec3 p){
  float v=0.0, a=0.5, f=1.0;
  for(int i=0;i<4;i++){
    v+=a*noise3D(p*f+vec3(17.4,31.1,23.7));
    f*=2.1; a*=0.48;
  }
  return v*2.0-1.0;
}

vec3 displace(vec3 nd, float t, float a1, float a2){
  return nd*(1.0+clamp(
    fbm1(nd*uN1Freq+t*0.5)*a1+fbm2(nd*uN2Freq+t*0.3)*a2,
    -1.0,1.0)*0.68);
}

void main(){
  float t = uTime*uSpeed;
  vec3 nd = normalize(position);

  float a1 = uN1Amp+(uBass+uKickDecay*0.4)*0.5;
  float a2 = uN2Amp+(uBass+uKickDecay*0.4)*0.25;

  float n1 = fbm1(nd*uN1Freq+t*0.5);
  float n2 = fbm2(nd*uN2Freq+t*0.3);
  float combined = clamp(n1*a1+n2*a2,-1.0,1.0);

  vN1      = clamp(n1*0.5+0.5, 0.0,1.0);
  vN2      = clamp(n2*0.5+0.5, 0.0,1.0);
  vDisplace= clamp(combined*0.5+0.5, 0.0,1.0);

  vec3 pos = nd*(1.5+combined*0.68);

  float eps=0.008;
  vec3 t1=normalize(cross(nd,vec3(0,1,0)));
  if(length(t1)<0.01) t1=normalize(cross(nd,vec3(1,0,0)));
  vec3 t2=normalize(cross(nd,t1));

  vec3 rn=normalize(cross(
    displace(normalize(nd+t1*eps),t,a1,a2)-displace(normalize(nd-t1*eps),t,a1,a2),
    displace(normalize(nd+t2*eps),t,a1,a2)-displace(normalize(nd-t2*eps),t,a1,a2)
  ));
  if(dot(rn,nd)<0.0) rn=-rn;

  vNormal   = normalize(normalMatrix*rn);
  vWorldPos = (modelMatrix*vec4(pos,1.0)).xyz;
  gl_Position = projectionMatrix*modelViewMatrix*vec4(pos,1.0);
}
`;

// ------------------------------------------------
// FRAGMENT SHADER
// ------------------------------------------------
const FRAG = /* glsl */ `
uniform float uTime;
uniform float uSpeed;
uniform float uOpacity;
uniform float uN3Freq;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uKickDecay;
uniform float uBeat;
varying vec3  vNormal;
varying vec3  vWorldPos;
varying float vN1;
varying float vN2;
varying float vDisplace;

float hash(vec3 p){
  p=fract(p*vec3(443.897,441.423,437.195));
  p+=dot(p.zxy,p.yxz+19.19);
  return fract(p.x*p.y*p.z);
}

float noise3D(vec3 p){
  vec3 i=floor(p); vec3 f=fract(p);
  vec3 u=f*f*(3.0-2.0*f);
  return mix(
    mix(mix(hash(i),hash(i+vec3(1,0,0)),u.x),
        mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),u.x),u.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),u.x),
        mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),u.x),u.y),u.z);
}

float colorNoise(vec3 p){
  float v=0.0, a=0.5;
  for(int i=0;i<4;i++){
    v+=a*noise3D(p);
    p=p*2.05+vec3(5.2,1.3,8.7);
    a*=0.5;
  }
  return clamp(v,0.0,1.0);
}

vec3 spectrum(float t){

  t=clamp(t,0.0,1.0);

vec3 c0=vec3(0.02,0.03,0.10);  // deep space

vec3 c1=vec3(0.08,0.12,0.25);  // dark blue

vec3 c2=vec3(0.25,0.15,0.55);  // violet

vec3 c3=vec3(0.55,0.20,0.85);  // magenta

vec3 c4=vec3(0.15,0.65,0.95);  // cyan

vec3 c5=vec3(0.20,0.45,1.00);  // bright blue

vec3 c6=vec3(0.65,0.85,1.00);  // white hot

  float s=t*6.0; int i=int(s); float f=fract(s);

  if(i==0) return mix(c0,c1,f);

  else if(i==1) return mix(c1,c2,f);

  else if(i==2) return mix(c2,c3,f);

  else if(i==3) return mix(c3,c4,f);

  else if(i==4) return mix(c4,c5,f);

  return mix(c5,c6,f);

}

void main(){
  float t=uTime*uSpeed;

  float cN=colorNoise(vWorldPos*(uN3Freq+uMid*1.5)+t*0.25);

  float ct =

    vN1 * 0.25 +
    vN2 * 0.20 +
    cN  * 0.30;

ct +=

    uBass      * 0.10 +
    uMid       * 0.08 +
    uHigh      * 0.05 +
    uEnergy    * 0.15 +
    uKickDecay * 0.20;

ct = clamp(ct,0.0,1.0);

vec3 base=spectrum(ct);

base*=(0.45+uEnergy*0.65);

  vec3 N=normalize(vNormal);
  vec3 V=normalize(-vWorldPos);

  vec3 L1=normalize(vec3(3,4,5)-vWorldPos);
  float d1=max(dot(N,L1),0.0);
  vec3 H1=normalize(V+L1);
  float sp=pow(max(dot(N,H1),0.0),32.0+uHigh*180.0);
  vec3 col=base*vec3(0.45,0.55,1.0)*d1*2.2+vec3(0.55,0.45,1.0)*sp*(0.25+uHigh*0.5);

  col+=base*vec3(0.12,0.25,0.80)*max(dot(N,normalize(vec3(-4,-2,2)-vWorldPos)),0.0)*0.7;

  float rim=pow(max(dot(N,normalize(vec3(0,-4,-6)-vWorldPos)),0.0),3.5);
  col+=spectrum(vDisplace+0.3)*rim*(0.35+uHigh*0.8);

  float fr=pow(1.0-max(dot(N,V),0.0),2.8);
  col+=spectrum(fr)*fr*(0.35+uEnergy*0.9);

  col+=base*vec3(0.02,0.03,0.08)*(1.0+uMid*0.3);

  col=pow(clamp(col,0.0,1.0),vec3(0.4545));
  gl_FragColor=vec4(col,uOpacity);
}
`;

// ------------------------------------------------
// AURA SHADERS
// ------------------------------------------------
const AURA_VERT = /* glsl */ `
varying vec3 vNormal;
void main(){
  vNormal=normalize(normalMatrix*normal);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}
`;

const AURA_FRAG = /* glsl */ `

uniform float uAuraOpacity;

varying vec3 vNormal;

void main(){

  vec3 V = normalize(vec3(0,0,1));

  float fresnel =
    pow(
      1.0 - max(dot(vNormal,V),0.0),
      3.2
    );

  vec3 col = vec3(
    0.18,
    0.10,
    0.42
  );

  gl_FragColor = vec4(

    col * 1.8,

    pow(
      fresnel,
      0.55
    ) *

    smoothstep(
      0.0,
      0.35,
      uAuraOpacity
    )

  );
}
`;

// ════════════════════════════════════════════════
// PLASMA BLOB
// ════════════════════════════════════════════════
export class PlasmaBlob {
  constructor(scene, options = {}) {
    this._scene = scene;
    this._enabled = true;
    this._kickDecay = 0.0;

    // ── Config ────────────────────────────────────
    this.cfg = {
      scale: 1.0,
      opacity: 1.0,
      auraOpacity: 0.35,
      n1Amp: 0.6,
      n1Freq: 1.8,
      n2Amp: 0.35,
      n2Freq: 3.5,
      n3Freq: 2.2,
      speed: 0.22,
      bassAmt: 1.0,
      highAmt: 1.0,
      energyAmt: 1.0,
      rotY: 0.0012,
      rotX: 0.0006,
      rotZ: 0.0004,
      interactionForce: 0.0,
      ...options,
    };

    // ── Uniforms ──────────────────────────────────
    this._U = {
      uTime: { value: 0.0 },
      uSpeed: { value: this.cfg.speed },
      uN1Amp: { value: this.cfg.n1Amp },
      uN1Freq: { value: this.cfg.n1Freq },
      uN2Amp: { value: this.cfg.n2Amp },
      uN2Freq: { value: this.cfg.n2Freq },
      uN3Freq: { value: this.cfg.n3Freq },
      uBass: { value: 0.0 },
      uMid: { value: 0.0 },
      uHigh: { value: 0.0 },
      uEnergy: { value: 0.0 },
      uKickDecay: { value: 0.0 },
      uBeat: { value: 0.0 },
      uOpacity: { value: 1.0 },
    };

    // ── Blob Mesh ─────────────────────────────────
    this._geo = new THREE.SphereGeometry(1.5, 96, 96);
    this._mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this._U,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this._mesh = new THREE.Mesh(this._geo, this._mat);
    this._scene.add(this._mesh);

    // ── Aura Mesh ─────────────────────────────────
    this._auraGeo = new THREE.SphereGeometry(2.1, 32, 32);
    this._auraMat = new THREE.ShaderMaterial({
      vertexShader: AURA_VERT,
      fragmentShader: AURA_FRAG,
      uniforms: {
        uAuraOpacity: {
          value: this.cfg.auraOpacity,
        },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    this._aura = new THREE.Mesh(this._auraGeo, this._auraMat);
    this._scene.add(this._aura);
  }

  // ── Presets ──────────────────────────────────────
  applyPreset(name = "cinematic") {
    switch (name) {
      case "calm":
        this.cfg.speed = 0.08;
        this.cfg.n1Amp = 0.22;
        this.cfg.n2Amp = 0.08;
        break;
      case "nebula":
        this.cfg.speed = 0.18;
        this.cfg.n1Amp = 0.48;
        this.cfg.n2Amp = 0.3;
        break;
      case "crystalline":
        this.cfg.speed = 0.03;
        this.cfg.n1Amp = 0.1;
        this.cfg.n2Amp = 0.82;
        break;
      default: // cinematic
        this.cfg.speed = 0.22;
        this.cfg.n1Amp = 0.6;
        this.cfg.n2Amp = 0.35;
        break;
    }
  }

  // ── API ───────────────────────────────────────────
  setInteractionForce(v = 0) {
    this.cfg.interactionForce = v;
  }

  setPosition(x, y, z) {
    this._mesh.position.set(x, y, z);
    this._aura.position.set(x, y, z);
    return this;
  }

  enable() {
    this._enabled = true;
    this._mesh.visible = true;
    this._aura.visible = true;
    return this;
  }

  disable() {
    this._enabled = false;
    this._mesh.visible = false;
    this._aura.visible = false;
    return this;
  }

  // ── Update ────────────────────────────────────────
  update(audio = {}, time = 0) {
    if (!this._enabled) return;
    const cfg = this.cfg;
    const U = this._U;

    U.uTime.value = time;
    U.uOpacity.value = cfg.opacity;

    const bass = (audio.bass ?? 0) * cfg.bassAmt;
    const mid = audio.mid ?? 0;
    const high = (audio.high ?? 0) * cfg.highAmt;
    const energy = (audio.energy ?? 0) * cfg.energyAmt;

    U.uBass.value = bass;
    U.uMid.value = mid;
    U.uHigh.value = high;
    U.uEnergy.value = energy;
    U.uBeat.value = audio.beat ? 1.0 : 0.0;

    if (audio.kick) this._kickDecay = 1.0;
    this._kickDecay *= 0.88;
    U.uKickDecay.value = this._kickDecay;
    this._auraMat.uniforms.uAuraOpacity.value = cfg.auraOpacity;

    U.uN1Amp.value = cfg.n1Amp;
    U.uN1Freq.value = cfg.n1Freq;
    U.uN2Amp.value = cfg.n2Amp;
    U.uN2Freq.value = cfg.n2Freq;
    U.uN3Freq.value = cfg.n3Freq;
    U.uSpeed.value = cfg.speed;

    const beatBoost = audio.beat ? 1.8 : 1.0;
    this._mesh.rotation.y += (cfg.rotY + high * 0.002) * beatBoost;
    this._mesh.rotation.x += (cfg.rotX + high * 0.001) * beatBoost;
    this._mesh.rotation.z += cfg.rotZ + bass * 0.001;
    this._aura.rotation.y -= 0.0008;
    this._aura.rotation.x += 0.0004;

    const pulse = 1 + bass * 0.18 + energy * 0.12 + this._kickDecay * 0.18;

    this._mesh.scale.setScalar(cfg.scale * pulse);

    this._aura.scale.setScalar(cfg.scale * pulse * 1.15);

    // floating
    this._mesh.position.y = Math.sin(time * 0.4) * 0.08;
    this._aura.position.y = this._mesh.position.y;
  }

  // ── GUI ───────────────────────────────────────────
  addGUI(folder) {
    const c = this.cfg;
    folder.add(c, "opacity", 0, 1, 0.01).name("Opacity");
    folder.add(c, "auraOpacity", 0, 1, 0.01).name("Aura");
    folder.add(c, "scale", 0.2, 8, 0.01).name("Size");

    const fN = folder.addFolder("Noise");
    fN.add(c, "n1Amp", 0, 1.5, 0.01);
    fN.add(c, "n1Freq", 0.5, 5, 0.05);
    fN.add(c, "n2Amp", 0, 1.5, 0.01);
    fN.add(c, "n2Freq", 0.5, 8, 0.05);
    fN.add(c, "n3Freq", 0.5, 6, 0.05);
    fN.add(c, "speed", 0, 1, 0.01);

    const fA = folder.addFolder("Audio");
    fA.add(c, "bassAmt", 0, 3, 0.01);
    fA.add(c, "highAmt", 0, 3, 0.01);
    fA.add(c, "energyAmt", 0, 3, 0.01);

    const fR = folder.addFolder("Rotation");
    fR.add(c, "rotY", 0, 0.005, 0.0001);
    fR.add(c, "rotX", 0, 0.005, 0.0001);
    fR.add(c, "rotZ", 0, 0.005, 0.0001);
    return this;
  }

  // ── Destroy ───────────────────────────────────────
  destroy() {
    this._geo.dispose();
    this._mat.dispose();
    this._auraGeo.dispose();
    this._auraMat.dispose();
    this._scene.remove(this._mesh);
    this._scene.remove(this._aura);
  }
}
