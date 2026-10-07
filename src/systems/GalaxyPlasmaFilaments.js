import * as THREE from "three";

const HISTORY_COUNT = 25;
const HISTORY_STEP = 0.08;
const LAB_DEFAULTS = Object.freeze({
  primaryDensity:1, opacity:1, scale:1, peripheralStrength:1, filamentVisibility:1,
  macroStrength:1, mesoStrength:1, microStrength:1, driftSpeed:1,
  colorA:"#36c6e3", colorB:"#8969df", intensityA:1, intensityB:1, saturation:1,
  bassResponse:1, midResponse:1, highResponse:1, energyResponse:1, kickResponse:1,
  propagationSeconds:1.92,
});
const LAB_UNIFORMS = /* glsl */ `
uniform float uPrimaryDensity;
uniform float uOpacity;
uniform float uPeripheralStrength;
uniform float uFilamentVisibility;
uniform float uMacroStrength;
uniform float uMesoStrength;
uniform float uMicroStrength;
uniform float uDriftSpeed;
uniform float uBassResponse;
uniform float uMidResponse;
uniform float uHighResponse;
uniform float uEnergyResponse;
uniform float uKickResponse;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uIntensityA;
uniform float uIntensityB;
uniform float uSaturation;
vec3 labColor(vec3 tint,float flow) {
  return tint*mix(uColorA,uColorB,smoothstep(0.22,0.78,flow));
}
vec3 labRadiance(vec3 tint,float flow) {
  float grey=dot(tint,vec3(0.2126,0.7152,0.0722));
  return max(vec3(0.0),mix(vec3(grey),tint,uSaturation))
    *mix(uIntensityA,uIntensityB,smoothstep(0.22,0.78,flow));
}
void labWeather(inout vec4 layers) {
  layers.x=clamp(0.5+(layers.x-0.5)*uMacroStrength,0.0,1.0);
  layers.y=clamp(0.5+(layers.y-0.5)*uMesoStrength,0.0,1.0);
  layers.w*=uMesoStrength;
}
`;
const NOISE = /* glsl */ `
float hash(vec3 p) {
  p = fract(p * vec3(443.897,441.423,437.195));
  p += dot(p.zxy,p.yxz+19.19);
  return fract(p.x*p.y*p.z);
}
float noise(vec3 p) {
  vec3 i=floor(p),f=fract(p),u=f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),u.x),
    mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),u.x),u.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),u.x),
    mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),u.x),u.y),u.z);
}
`;
const vertexShader = /* glsl */ `
attribute vec3 aCenterline;
attribute float aRoute;
attribute float aFlow;
attribute float aSeed;
attribute float aDetail;
uniform float uTime;
uniform float uBass;
uniform float uHistory[25];
uniform float uFrontHistory[25];
uniform float uKickHistory[25];
uniform float uHistoryPhase;
varying vec3 vTint;
varying vec3 vField;
varying vec3 vWorldPosition;
varying vec2 vUv;
varying float vSeed;
varying float vDetail;
varying float vFlow;
varying float vSignal;
varying float vFront;
varying float vKick;
${NOISE}
${LAB_UNIFORMS}
void main() {
  float delayFlow=aRoute<0.5 ? aFlow*3.0 : aRoute<1.5 ? 0.70+(aFlow-0.90)*3.0 : 0.30+(aFlow-0.10)*0.50;
  float age=clamp(delayFlow*24.0-uHistoryPhase,0.0,23.999);
  int i=int(floor(age));
  float f=smoothstep(0.0,1.0,fract(age));
  float signal=mix(uHistory[i],uHistory[i+1],f)*uMidResponse;
  float front=mix(uFrontHistory[i],uFrontHistory[i+1],f)*uMidResponse;
  float kick=mix(uKickHistory[i],uKickHistory[i+1],f)*uKickResponse;
  vec3 q=position*0.035+vec3(uTime*uDriftSpeed*0.008,-uTime*uDriftSpeed*0.005,aSeed*4.0);
  vec3 pressure=vec3(noise(q),noise(q+vec3(7,13,2)),noise(q+vec3(19,3,11)))-0.5;
  // Slow pressure moves a coherent environment; light carries the fast causality.
  vec3 p=position+pressure*vec3(2.0,2.4,0.8)
    *(0.14+uBass*uBassResponse*1.35*mix(1.12,0.90,aFlow));
  // Density-shaped apparent thickness; coherent front/shock expands only nearby branches.
  float billow=noise(position*0.58+vec3(aSeed*3.0,uTime*uDriftSpeed*0.012,7));
  vec3 radial=position-aCenterline;
  p+=radial*((billow-0.5)*0.65+front*0.22+kick*0.28);
  p+=pressure*vec3(front*0.28+kick*0.42,front*0.40+kick*0.48,front*0.10+kick*0.12);
  vTint=color;vField=position;vUv=uv;vSeed=aSeed;vDetail=aDetail;vFlow=aFlow;
  vSignal=signal;vFront=front;vKick=kick;
  vWorldPosition=(modelMatrix*vec4(p,1.0)).xyz;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}
`;
const WEATHER = /* glsl */ `
float fbm(vec3 p) {
  mat3 turn=mat3(0.80,-0.48,0.36,0.60,0.64,-0.48,0.0,0.60,0.80);
  return noise(p)*0.54+noise(turn*p*2.03+vec3(7,3,11))*0.30
    +noise(turn*p*4.11+vec3(13,17,5))*0.16;
}
// Shared by gas and skeleton: noise is density, not a surface texture overlay.
void weather(vec3 field,float time,float bass,float head,float shock,
  out vec3 domain,out vec4 layers,out float fine) {
  vec3 q=field*vec3(0.10,0.13,0.12)+vec3(time*0.003,-time*0.0015,0.0);
  vec3 curl=vec3(noise(q*0.52+vec3(3,11,7)),noise(q*0.52+vec3(13,5,2)),
    noise(q*0.52+vec3(7,17,9)))-0.5;
  // Spatially nonuniform compression/expansion, rather than global optical gain.
  domain=q+curl*(1.65+bass*0.75)
    +bass*vec3(curl.y,-curl.x,curl.z)*0.42;
  domain+=head*vec3(curl.z*0.65,0.23+curl.x*0.4,-curl.y*0.3)
    +shock*vec3(-curl.y, curl.x, curl.z)*0.62;
  float macro=noise(q*0.43+curl*0.35+vec3(9,3,7));
  float billow=fbm(domain*1.65);
  float channel=noise(domain*2.10+vec3(8,2,17));
  float cavity=1.0-smoothstep(0.46+bass*curl.y*0.10,0.69+bass*curl.y*0.10,channel);
  float width=max(0.024,fwidth(billow)*0.8);
  float ridge=1.0-smoothstep(width,width+0.075,abs(billow-0.51));
  fine=noise(domain*9.5+curl*2.2+vec3(13,7,3));
  layers=vec4(macro,billow,cavity,ridge);
}
`;
const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uBass;
uniform float uHigh;
uniform float uEnergy;
varying vec3 vTint;
varying vec3 vField;
varying vec3 vWorldPosition;
varying vec2 vUv;
varying float vSeed;
varying float vDetail;
varying float vFlow;
varying float vSignal;
varying float vFront;
varying float vKick;
${NOISE}
${LAB_UNIFORMS}
${WEATHER}
void main() {
  vec3 domain;vec4 layers;float fine;
  weather(vField,uTime*uDriftSpeed,uBass*uBassResponse,vFront,vKick,domain,layers,fine);
  labWeather(layers);
  float width=max(0.022,fwidth(fine)*0.8);
  float fineRidge=(1.0-smoothstep(width,width+0.07,abs(fine-0.51)))*uMicroStrength;
  float broken=smoothstep(0.27,0.64,layers.y+(layers.x-0.5)*0.28)*layers.z;
  float embedded=(0.18+layers.w*0.82)*broken;
  float endFade=smoothstep(0.0,0.10,vUv.x)*(1.0-smoothstep(0.88,1.0,vUv.x));
  float highLocal=uHigh*uHighResponse*fineRidge*smoothstep(0.49,0.67,layers.y)*mix(0.78,1.25,vFlow);
  // Constant overall radiance; local fronts displace/reveal structured density.
  float resting=(0.045+uEnergy*uEnergyResponse*0.012)*embedded*mix(1.0,0.30,vDetail);
  float event=vFront*0.38+vKick*0.30;
  float localReveal=event*(0.70+layers.w*0.30)*mix(1.0,0.65,vDetail);
  float sustained=vSignal*0.055*embedded;
  float alpha=min(0.62,resting+sustained+localReveal+highLocal*mix(0.025,0.16,vDetail))*endFade;
  alpha*=smoothstep(0.10,0.28,length(cameraPosition-vWorldPosition))*uFilamentVisibility*uOpacity;
  vec3 colored=labColor(vTint,vFlow);
  vec3 hue=colored/max(0.001,max(colored.r,max(colored.g,colored.b)));
  vec3 muted=mix(hue,vec3(0.25,0.29,0.39),0.22);
  vec3 tint=mix(muted,hue,clamp(layers.w+event*0.35,0.0,1.0));
  if(alpha<0.0005)discard;
  gl_FragColor=vec4(labRadiance(tint,vFlow)*(0.65+layers.w*0.07),min(0.85,alpha));
  #include <colorspace_fragment>
}
`;

const gasVertexShader = /* glsl */ `
attribute float aDensity;
attribute vec3 aCenter;
attribute vec3 aRadii;
attribute vec4 aRotation;
attribute float aSeed;
attribute float aFlow;
uniform float uTime;
uniform float uBass;
varying float vDensity;
varying vec3 vCenter;
varying vec3 vRadii;
varying vec4 vRotation;
varying vec3 vField;
varying vec3 vTint;
varying float vSeed;
varying float vFlow;
${NOISE}
${LAB_UNIFORMS}
void main() {
  vec3 q=aCenter*0.045+vec3(uTime*uDriftSpeed*0.006,-uTime*uDriftSpeed*0.004,aSeed*3.0);
  vec3 pressure=vec3(noise(q),noise(q+vec3(7,13,2)),noise(q+vec3(19,3,11)))-0.5;
  vec3 shift=pressure*vec3(1.1,1.4,0.55)*(0.12+uBass*uBassResponse*mix(1.18,0.80,aFlow));
  vDensity=aDensity;vCenter=aCenter+shift;vRadii=aRadii;vRotation=aRotation;
  vField=position+shift;vTint=color;vSeed=aSeed;vFlow=aFlow;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(vField,1.0);
}
`;

const gasFragmentShader = /* glsl */ `
uniform float uTime;
uniform float uBass;
uniform float uEnergy;
uniform float uHigh;
uniform mat4 uWorldToField;
uniform float uFrontHistory[25];
uniform float uKickHistory[25];
uniform float uHistoryPhase;
varying float vDensity;
varying vec3 vCenter;
varying vec3 vRadii;
varying vec4 vRotation;
varying vec3 vField;
varying vec3 vTint;
varying float vSeed;
varying float vFlow;
${NOISE}
${LAB_UNIFORMS}
${WEATHER}
vec3 unrotate(vec4 q,vec3 v) {
  vec3 xyz=-q.xyz;
  return v+2.0*cross(xyz,cross(xyz,v)+q.w*v);
}
float erfApprox(float x) {
  float a=abs(x),t=1.0/(1.0+0.3275911*a);
  float p=(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t;
  return sign(x)*(1.0-p*exp(-a*a));
}
float frontAt(float flow) {
  float age=clamp(flow*24.0-uHistoryPhase,0.0,23.999);
  int i=int(floor(age));
  return mix(uFrontHistory[i],uFrontHistory[i+1],smoothstep(0.0,1.0,fract(age)))*uMidResponse;
}
float shockAt(float flow) {
  float age=clamp(flow*24.0-uHistoryPhase,0.0,23.999);
  int i=int(floor(age));
  return mix(uKickHistory[i],uKickHistory[i+1],smoothstep(0.0,1.0,fract(age)))*uKickResponse;
}
void main() {
  vec3 origin=(uWorldToField*vec4(cameraPosition,1.0)).xyz;
  vec3 direction=normalize(vField-origin);
  vec3 ro=unrotate(vRotation,origin-vCenter)/vRadii;
  vec3 rd=unrotate(vRotation,direction)/vRadii;
  float a=dot(rd,rd),b=dot(ro,rd),c=dot(ro,ro)-1.0;
  float discriminant=b*b-a*c;
  if(discriminant<=0.0)discard;
  float root=sqrt(discriminant);
  float entry=max(0.0,(-b-root)/a),exitDistance=(-b+root)/a;
  if(exitDistance<=entry)discard;

  // Exact finite Gaussian chord integral with zero density at the proxy boundary.
  // Bass broadens optical density INSIDE the fixed proxy, rather than scaling a mesh.
  float pressure=uBass*uBassResponse*mix(1.18,0.80,vFlow);
  float k=4.8; // Atmospheric expansion/compression happens in density coordinates.
  float closest=-b/a,minRadius2=max(0.0,dot(ro,ro)-b*b/a);
  float factor=sqrt(k*a);
  float integral=exp(-k*minRadius2)*0.886226925/factor
    *(erfApprox(factor*(exitDistance-closest))-erfApprox(factor*(entry-closest)));
  integral=max(0.0,integral-exp(-k)*(exitDistance-entry));
  // A single representative chord sample modulates the analytical envelope.
  // This is a bounded approximation to heterogeneous gas, not a marched noise integral.
  float representative=mix(clamp(closest,entry,exitDistance),mix(entry,exitDistance,0.55),0.75);
  vec3 samplePoint=origin+direction*representative;
  // A's front crosses the territory; B receives at its center and spreads outward.
  // This delay varies PER FRAGMENT and preserves the existing 1.92s history clock.
  float flow=vFlow<0.5 ? (samplePoint.x<-44.0 ? clamp((samplePoint.x+72.0)/28.0,0.0,1.0)*0.30
    : 0.30+clamp((samplePoint.x+44.0)/28.0,0.0,1.0)*0.18)
    : 0.70+clamp(abs(samplePoint.x-40.0)/28.0,0.0,1.0)*0.30;
  float head=frontAt(flow),shock=shockAt(flow),wake=frontAt(min(1.0,flow+0.07))*0.30;
  vec3 domain;vec4 layers;float fine;
  weather(samplePoint,uTime*uDriftSpeed,pressure,head,shock,domain,layers,fine);
  // Freeze the accepted support extinction independently of Lab noise gains.
  vec4 supportLayers=layers;
  labWeather(layers);
  float thin=smoothstep(0.34,0.66,layers.y+(layers.x-0.5)*0.24);
  float knots=layers.w*smoothstep(0.40,0.65,layers.y);
  float fineWidth=max(0.020,fwidth(fine)*0.85);
  float fineRidge=(1.0-smoothstep(fineWidth,fineWidth+0.06,abs(fine-0.52)))*uMicroStrength;
  float density=(0.12+layers.x*0.88)*(0.05+thin*0.95)*layers.z;
  density+=knots*layers.z*(0.25+uEnergy*uEnergyResponse*0.045);
  float detail= fineRidge*smoothstep(0.48,0.69,layers.y)*layers.z;
  density+=detail*(0.07+uHigh*uHighResponse*0.055)*mix(0.80,1.18,vFlow);
  // Short moving fronts/wakes retain a local floor, even through a dark channel.
  // Both resting gas and audio fronts dissolve before the analytical support edge.
  float localEvent=(head*0.19+shock*0.16+wake*0.08)*(0.40+layers.w*0.60);
  // Closest chord radius is continuous from outside, inside and grazing views.
  // Noise changes the extinction region, never the enclosing support geometry.
  // The latest possible fade end is 0.945: no optical density reaches r=1.
  float edgeStart=0.58+(supportLayers.x-0.5)*0.12;
  float edgeEnd=0.91+(supportLayers.y-0.5)*0.07;
  float extinction=1.0-smoothstep(edgeStart,edgeEnd,sqrt(minRadius2));
  float presence=vDensity<0.5 ? uPeripheralStrength : uPrimaryDensity;
  float opticalDepth=integral*(density*0.28+localEvent)*extinction*vDensity*presence;
  float alpha=min(0.72,min(0.48,1.0-exp(-opticalDepth))*uOpacity);
  vec3 colored=labColor(vTint,vFlow);
  vec3 hue=colored/max(0.001,max(colored.r,max(colored.g,colored.b)));
  vec3 thinTint=mix(hue,vec3(0.24,0.28,0.38),0.32);
  vec3 tint=mix(thinTint,hue,clamp(thin*0.5+knots*0.5+head*0.22,0.0,1.0));
  float luminosity=0.42+knots*0.16+detail*0.10;
  if(alpha<0.0005)discard;
  gl_FragColor=vec4(labRadiance(tint,vFlow)*luminosity,alpha);
  #include <colorspace_fragment>
}
`;

export class GalaxyPlasmaFilaments {
  constructor(parent,homePose) {
    this.parameters={...LAB_DEFAULTS};
    this.historyStep=HISTORY_STEP;
    this.regionA=new THREE.Vector3(-44,38,90);
    this.regionB=new THREE.Vector3(40,18,88);
    // World-authored regions. Local field coordinates retain the accepted
    // turbulence and delayed response; neither territory follows the home camera.
    const regionFrame=(center,position,right,up,forward)=>({center,
      worldFrame:new THREE.Matrix4().makeBasis(new THREE.Vector3(...right),
        new THREE.Vector3(...up),new THREE.Vector3(...forward)).setPosition(new THREE.Vector3(...position))
        .multiply(new THREE.Matrix4().makeTranslation(center.clone().negate()))});
    this.territories=[
      regionFrame(this.regionA,[55.471388,8.498613,-58.012823],
        [.7302326447,.1766714454,-.6599602147],[-.4234846639,.8750742898,-.2343197107],
        [-.5361166142,-.4505909317,-.7138254606]),
      regionFrame(this.regionB,[-34.150682,8.048567,-37.131768],
        [.8668995889,-.1691372129,.4689111920],[.3260516564,.9039403200,-.2767349186],
        [.3770615601,-.3927906580,-.8387729603]),
    ];
    this.worldFrame=this.territories[0].worldFrame;
    this.history=new Float32Array(HISTORY_COUNT);
    this.frontHistory=new Float32Array(HISTORY_COUNT);
    this.kickHistory=new Float32Array(HISTORY_COUNT);
    this.historyClock=0;this.mid=0;this.front=0;this.previousSampleMid=0;
    this.kick=0;this.kickCooldown=0;
    this.uniforms={uTime:{value:0},uBass:{value:0},uHigh:{value:0},uEnergy:{value:0},
      uHistory:{value:this.history},uFrontHistory:{value:this.frontHistory},
      uKickHistory:{value:this.kickHistory},uHistoryPhase:{value:0}};
    for(const [key,value] of Object.entries(this.parameters)) {
      if(typeof value==="number" && !["scale","propagationSeconds"].includes(key))
        this.uniforms[`u${key[0].toUpperCase()}${key.slice(1)}`]={value};
    }
    this.uniforms.uColorA={value:new THREE.Color(1,1,1)};
    this.uniforms.uColorB={value:new THREE.Color(1,1,1)};
    const buffers=()=>({position:[],color:[],uv:[],aCenterline:[],aRoute:[],aFlow:[],aSeed:[],aDetail:[],indices:[]});
    const core=[buffers(),buffers()];
    let currentRoute=0;
    this.paths=[];
    const tintA=[new THREE.Color(0x36c6e3),new THREE.Color(0x367ae0),new THREE.Color(0x7564cd)];
    const tintB=[new THREE.Color(0x8969df),new THREE.Color(0xb65dbe),new THREE.Color(0x4d80db)];
    const palette=(flow,seed)=> {
      const shade=p=>p[0].clone().lerp(p[1],0.18+0.32*(0.5+0.5*Math.sin(seed*11)))
        .lerp(p[2],0.12+0.12*(0.5+0.5*Math.cos(seed*7)));
      return shade(tintA).lerp(shade(tintB),THREE.MathUtils.smoothstep(flow,0.22,0.78));
    };
    const makeCurve=points=>new THREE.CatmullRomCurve3(points,false,"centripetal");
    const flowOn=(curve,flows,u)=> {
      const t=curve.getUtoTmapping(u)*(flows.length-1),i=Math.min(flows.length-2,Math.floor(t));
      return THREE.MathUtils.lerp(flows[i],flows[i+1],Math.min(1,t-i));
    };
    const addTube=(data,curve,flows,start,end,seed,detail,radius,isHalo)=> {
      const length=curve.getLength()*(end-start);
      const segments=Math.max(10,Math.ceil(length*(isHalo?0.55:0.90)));
      const sides=isHalo?6:detail?6:8,base=data.position.length/3;
      const frames=curve.computeFrenetFrames(Math.max(64,segments*2),false);
      const frameCount=frames.normals.length-1;
      for(let i=0;i<=segments;i++) {
        const u=THREE.MathUtils.lerp(start,end,i/segments),point=curve.getPointAt(u);
        const fi=Math.min(frameCount,Math.round(u*frameCount)),normal=frames.normals[fi],binormal=frames.binormals[fi];
        const flow=flowOn(curve,flows,u),color=palette(flow,seed);
        const taper=0.56+0.26*Math.sin(u*9+seed*4)+0.13*Math.cos(u*17-seed*5);
        const width=radius*taper*(isHalo?1.0:0.72+0.28*Math.sin(Math.PI*i/segments));
        for(let j=0;j<=sides;j++) {
          const angle=j/sides*Math.PI*2;
          const irregular=1+0.16*Math.sin(angle*3+u*7+seed);
          const p=point.clone().addScaledVector(normal,Math.cos(angle)*width*irregular)
            .addScaledVector(binormal,Math.sin(angle)*width*(isHalo?0.85:0.76));
          data.position.push(p.x,p.y,p.z);data.aCenterline.push(point.x,point.y,point.z);data.color.push(color.r,color.g,color.b);
          data.uv.push(i/segments,j/sides);data.aFlow.push(flow);data.aSeed.push(seed);data.aDetail.push(detail);data.aRoute.push(currentRoute);
        }
      }
      for(let i=0;i<segments;i++)for(let j=0;j<sides;j++) {
        const a=base+i*(sides+1)+j,b=a+sides+1;
        data.indices.push(a,b,a+1,a+1,b,b+1);
      }
    };
    const path=(points,flows,seed,detail,radius,spans=[[0,1]])=> {
      const curve=makeCurve(points);
      this.paths.push({curve,flows,seed,detail,spans,radius});
      for(const [start,end] of spans) {
        addTube(core[currentRoute],curve,flows,start,end,seed,detail,radius,false);
      }
      return curve;
    };
    const world=(center,points)=>points.map(p=>center.clone().add(new THREE.Vector3(p[0],p[1],p[2]*1.45)));
    // Deliberately different branching graphs. Node delays agree at every junction.
    const territories=[
      {center:this.regionA,trunk:[[-28,-7,-3],[-17,2,1],[-6,6,-2],[0,0,0],[13,-3,3],[28,4,-2]],
        flow:[0,.035,.065,.10,.125,.14],
        forks:[{node:1,points:[[-15,8,-2],[-5,13,3],[8,10,4]],tip:.14},
          {node:2,points:[[-12,-3,-4],[-23,-12,1],[-28,-9,3]],tip:.15},
          {node:3,points:[[9,-9,2],[20,-12,-3],[27,-6,-1]],tip:.15}]},
      {center:this.regionB,trunk:[[-28,5,-2],[-18,-3,2],[-7,4,-3],[0,0,0],[12,-4,3],[21,3,-2],[28,1,-3]],
        flow:[1,.97,.935,.90,.94,.975,1],
        forks:[{node:3,points:[[-6,9,2],[-18,12,-3],[-27,8,1]],tip:1},
          {node:4,points:[[11,5,-3],[20,13,1],[27,8,3]],tip:1},
          {node:2,points:[[-5,-6,3],[5,-12,-1],[18,-10,-3]],tip:.99}]},
    ];
    for(let end=0;end<territories.length;end++) {
      currentRoute=end;
      const t=territories[end],seed=0.19+end*0.47;
      path(world(t.center,t.trunk),t.flow,seed,0,0.85,[[0,.47],[.515,1]]);
      for(let b=0;b<t.forks.length;b++) {
        const fork=t.forks[b],points=[t.trunk[fork.node],...fork.points];
        const flows=points.map((_,i)=>THREE.MathUtils.lerp(t.flow[fork.node],fork.tip,i/(points.length-1)));
        const curve=path(world(t.center,points),flows,seed+b*0.173+0.11,0,0.64,[[0,.61],[.69,1]]);
        for(let w=0;w<2;w++) {
          const attach=.28+w*.35,start=curve.getPointAt(attach),flow=flowOn(curve,flows,attach);
          const direction=new THREE.Vector3((w?1:-1)*(4+b),w?4.3:-3.7,(end?1:-1)*(2.7+w));
          const points=[start,start.clone().addScaledVector(direction,.45),start.clone().add(direction),
            start.clone().add(direction).add(new THREE.Vector3(w?4:-3,w?-1:2,-direction.z*.4))];
          const target=end?Math.min(1,flow+.035):Math.min(.16,flow+.035);
          path(points,[flow,flow+(target-flow)*.3,flow+(target-flow)*.7,target],seed+b*.17+w*.09+1,1,.30,[[0,.72],[.81,1]]);
        }
      }
    }
    // A and B communicate through the existing history clock, without a visible bridge.
    const build=data=> {
      const geometry=new THREE.BufferGeometry();
      for(const [key,size] of [["position",3],["color",3],["uv",2],["aCenterline",3],["aRoute",1],["aFlow",1],["aSeed",1],["aDetail",1]])
        geometry.setAttribute(key,new THREE.Float32BufferAttribute(data[key],size));
      geometry.setIndex(data.indices);geometry.computeBoundingSphere();geometry.boundingSphere.radius+=8;
      return geometry;
    };
    const geometries=core.map(build);
    const gasBuffers=()=>({position:[],color:[],aCenter:[],aRadii:[],aRotation:[],aSeed:[],aFlow:[],aDensity:[],indices:[]});
    const gases=[gasBuffers(),gasBuffers()];
    const proxy=new THREE.SphereGeometry(1,20,12);
    this.gasVolumes=[];
    const addGas=(localCenter,radii,rotation,seed,flow,density,territory)=> {
      const gas=gases[territory];
      const color=palette(flow,seed),base=gas.position.length/3;
      for(let v=0;v<proxy.attributes.position.count;v++) {
        // Sphere triangles are inscribed. Overscan encloses the entire analytical
        // ellipsoid, so its silhouette can never be truncated by a proxy facet.
        const p=new THREE.Vector3().fromBufferAttribute(proxy.attributes.position,v)
          .multiplyScalar(1.08).multiply(radii).applyQuaternion(rotation).add(localCenter);
        gas.position.push(p.x,p.y,p.z);gas.color.push(color.r,color.g,color.b);
        gas.aCenter.push(...localCenter.toArray());gas.aRadii.push(...radii.toArray());gas.aRotation.push(...rotation.toArray());
        gas.aSeed.push(seed);gas.aFlow.push(flow);gas.aDensity.push(density);
      }
      for(const index of proxy.index.array)gas.indices.push(base+index);
      this.gasVolumes.push({center:localCenter,radii,rotation,territory,density});
    };
    const offsets=[[-20,-5,-1],[-13,5,1.2],[-6,-6,-1.6],[2,6,1.5],[10,-5,-1.1],[20,2,.4],[-1,0,2],[7,-1,-2.1]];
    for(const [center,end] of [[this.regionA,0],[this.regionB,1]]) {
      for(let i=0;i<offsets.length;i++) {
        const phase=i*2.39996+end*1.7,offset=offsets[i];
        const localCenter=center.clone().add(new THREE.Vector3(offset[0],offset[1],offset[2]));
        const radii=new THREE.Vector3(10.6+Math.sin(phase)*1.1,8.2+Math.cos(phase*1.3)*.7,5.1+Math.sin(phase*.8)*.5);
        const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(phase)*.12,Math.cos(phase)*.10,Math.sin(phase*.7)*.38));
        addGas(localCenter,radii,rotation,.21+i*.173+end*.47,end===0?.06:.95,1,end);
      }
    }
    // Detached cosmic weather, not arms or emissions of the spiral galaxy.
    // Outward/upward/deeper placements leave the foreground and interstitial
    // dark space open. Strength multiplies ALL radiance, including local events.
    const wisps=[
      {offset:[-25,7,4],radii:[5.0,3.0,3.6],strength:.18,angle:-.48},
      {offset:[-17,15,5],radii:[6.8,4.2,3.8],strength:.14,angle:.62},
      {offset:[4,17,6],radii:[10.5,2.6,3.6],strength:.16,angle:.24},
      {offset:[-27,-9,5],radii:[4.0,3.7,3.4],strength:.10,angle:-.70},
      {offset:[-12,20,6],radii:[6.7,2.4,3.1],strength:.08,angle:.85},
    ];
    for(const [center,end] of [[this.regionA,0],[this.regionB,1]]) {
      for(let i=0;i<wisps.length;i++) {
        const w=wisps[i],outward=end===0?1:-1;
        const localCenter=center.clone().add(new THREE.Vector3(w.offset[0]*outward,w.offset[1],w.offset[2]));
        const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.14,-.12,w.angle*outward));
        addGas(localCenter,new THREE.Vector3(...w.radii),rotation,2.1+i*.31+end*.47,
          end===0?.06:.95,w.strength,end);
      }
    }
    proxy.dispose();
    const common={vertexColors:true,transparent:true,blending:THREE.NormalBlending,
      depthTest:true,depthWrite:false,forceSinglePass:true,toneMapped:false};
    this.uniforms.uWorldToField={value:new THREE.Matrix4()};
    for(const [index,territory] of this.territories.entries()) {
      const gas=gases[index];
      territory.geometry=geometries[index];
      territory.gasGeometry=new THREE.BufferGeometry();
      for(const [key,size] of [["position",3],["color",3],["aCenter",3],["aRadii",3],["aRotation",4],["aSeed",1],["aFlow",1],["aDensity",1]])
        territory.gasGeometry.setAttribute(key,new THREE.Float32BufferAttribute(gas[key],size));
      territory.gasGeometry.setIndex(gas.indices);territory.gasGeometry.computeBoundingSphere();territory.gasGeometry.boundingSphere.radius+=3;
      // Share live audio and Lab values, but keep each ray calculation in its own field.
      territory.uniforms={...this.uniforms,uWorldToField:index===0?this.uniforms.uWorldToField:{value:new THREE.Matrix4()}};
      territory.material=new THREE.ShaderMaterial({...common,vertexShader,fragmentShader,uniforms:territory.uniforms,side:THREE.DoubleSide});
      territory.gasMaterial=new THREE.ShaderMaterial({...common,vertexShader:gasVertexShader,fragmentShader:gasFragmentShader,
        uniforms:territory.uniforms,side:THREE.BackSide});
      territory.mesh=new THREE.Mesh(territory.geometry,territory.material);
      territory.gasMesh=new THREE.Mesh(territory.gasGeometry,territory.gasMaterial);
      const label=index===0?"A":"B";
      territory.mesh.name=`CosmicVeilInternalEnergy${label}`;territory.gasMesh.name=`CosmicVeilAnalyticalNebula${label}`;
      territory.gasMesh.renderOrder=1;territory.mesh.renderOrder=2;
      for(const mesh of [territory.gasMesh,territory.mesh]) {
        mesh.matrixAutoUpdate=false;mesh.matrix.copy(territory.worldFrame);parent.add(mesh);
      }
      territory.gasMesh.updateWorldMatrix(true,false);
      territory.uniforms.uWorldToField.value.copy(territory.gasMesh.matrixWorld).invert();
    }
    this.gasFields=this.territories;
    // Retain the first-territory inspection handles; lifecycle owns both independent fields.
    for(const key of ["geometry","gasGeometry","material","gasMaterial","mesh","gasMesh"])this[key]=this.territories[0][key];
  }

  addGUI(gui) {
    this.guiFolder=gui.addFolder("COSMIC VEILS");
    const p=this.parameters;
    const numeric=(folder,key,label,min,max,step=.01)=>folder.add(p,key,min,max,step)
      .name(label).onChange(value=>this.setParameter(key,value));
    const appearance=this.guiFolder.addFolder("Appearance");
    numeric(appearance,"primaryDensity","Primary density",.3,1.8);
    numeric(appearance,"opacity","Gas / Veil visibility",0,1.5);
    // Retain the 450 far plane throughout the protected 210-unit travel range.
    numeric(appearance,"scale","Veil scale",.5,4);
    numeric(appearance,"peripheralStrength","Peripheral wisps",0,2);
    numeric(appearance,"filamentVisibility","Internal energy",0,2);
    const turbulence=this.guiFolder.addFolder("Turbulence").close();
    numeric(turbulence,"macroStrength","Macro noise",.5,1.5);
    numeric(turbulence,"mesoStrength","Meso noise",.5,1.5);
    numeric(turbulence,"microStrength","Micro detail",0,1.8);
    numeric(turbulence,"driftSpeed","Autonomous drift speed",0,2);
    const color=this.guiFolder.addFolder("Color").close();
    for(const [key,label] of [["colorA","A color"],["colorB","B color"]])
      color.addColor(p,key).name(label).onChange(value=>this.setParameter(key,value));
    numeric(color,"intensityA","A intensity",.4,1.6);
    numeric(color,"intensityB","B intensity",.4,1.6);
    numeric(color,"saturation","Color saturation",0,1.3);
    const audio=this.guiFolder.addFolder("Audio").close();
    for(const [key,label] of [["bassResponse","Bass pressure"],["midResponse","Mid travelling front"],
      ["highResponse","High fine detail"],["energyResponse","Energy richness"],["kickResponse","Kick pulse"]])
      numeric(audio,key,label,0,1.5);
    const propagation=this.guiFolder.addFolder("Propagation").close();
    numeric(propagation,"propagationSeconds","A to B (seconds)",.96,3.84,.01);
    return this.guiFolder;
  }

  setParameter(key,value) {
    this.parameters[key]=value;
    if(key==="scale") {
      // Scale each Veil locally; the world centers never migrate with tuning.
      for(const territory of this.gasFields) {
        const local=new THREE.Matrix4().makeTranslation(territory.center)
          .multiply(new THREE.Matrix4().makeScale(value,value,value))
          .multiply(new THREE.Matrix4().makeTranslation(territory.center.clone().negate()));
        for(const mesh of [territory.mesh,territory.gasMesh].filter(Boolean)) {
          mesh.matrix.copy(territory.worldFrame).multiply(local);mesh.matrixWorldNeedsUpdate=true;
        }
        territory.gasMesh.updateWorldMatrix(true,false);
        territory.uniforms.uWorldToField.value.copy(territory.gasMesh.matrixWorld).invert();
      }
    } else if(key==="propagationSeconds") {
      const step=value/(HISTORY_COUNT-1);
      // Retain live history and its phase; tune the existing sampling clock only.
      this.historyClock*=step/this.historyStep;
      this.historyStep=step;
    } else if(key==="colorA" || key==="colorB") {
      const reference=new THREE.Color(LAB_DEFAULTS[key]),color=new THREE.Color(value);
      this.uniforms[key==="colorA"?"uColorA":"uColorB"].value.setRGB(
        color.r/reference.r,color.g/reference.g,color.b/reference.b);
    } else {
      this.uniforms[`u${key[0].toUpperCase()}${key.slice(1)}`].value=value;
    }
  }

  update(audio={},delta=0) {
    audio=audio??{};
    const dt=THREE.MathUtils.clamp(delta,0,.1);
    const band=name=>Number.isFinite(audio[name])?THREE.MathUtils.clamp(audio[name],0,1):0;
    const envelope=(value,target,attack,release)=>THREE.MathUtils.lerp(value,target,1-Math.exp(-dt/(target>value?attack:release)));
    const u=this.uniforms;u.uTime.value+=dt;
    for(const territory of this.gasFields) {
      territory.gasMesh.updateWorldMatrix(true,false);
      territory.uniforms.uWorldToField.value.copy(territory.gasMesh.matrixWorld).invert();
    }
    u.uBass.value=envelope(u.uBass.value,Math.pow(band("bass"),.70),.55,1.8);
    u.uHigh.value=envelope(u.uHigh.value,Math.pow(band("high"),.70),.045,.17);
    u.uEnergy.value=envelope(u.uEnergy.value,Math.pow(band("energy"),.70),.65,1.6);
    this.mid=envelope(this.mid,band("mid"),.06,.32);
    this.front*=Math.exp(-dt/.28);this.kick*=Math.exp(-dt/.32);
    this.kickCooldown=Math.max(0,this.kickCooldown-dt);
    if(audio.kick&&this.kickCooldown===0){this.kick=1;this.kickCooldown=.70;}
    this.historyClock+=dt;
    while(this.historyClock>=this.historyStep) {
      // Rise contrast has its own history, so a visible event survives density gating.
      this.front=Math.max(this.front,Math.min(1,Math.max(0,this.mid-this.previousSampleMid)*8));
      this.previousSampleMid=this.mid;
      for(const [history,value] of [[this.history,this.mid],[this.frontHistory,this.front],[this.kickHistory,this.kick]]) {
        history.copyWithin(1,0,HISTORY_COUNT-1);history[0]=value;
      }
      this.historyClock-=this.historyStep;
    }
    u.uHistoryPhase.value=this.historyClock/this.historyStep;
  }

  dispose() {
    this.guiFolder?.destroy();
    for(const territory of this.territories) {
      territory.mesh.removeFromParent();territory.gasMesh.removeFromParent();
      territory.geometry.dispose();territory.gasGeometry.dispose();territory.material.dispose();territory.gasMaterial.dispose();
    }
  }
}
