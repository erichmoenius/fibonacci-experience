import * as THREE from "three";
export const SPATIAL_CLOUD_END = 7.45;
const smooth = (a,b,t) => { const x=THREE.MathUtils.clamp((t-a)/(b-a),0,1); return x*x*x*(x*(x*6-15)+10); };
const hash = x => { const y=Math.sin(x*127.1)*43758.5453; return y-Math.floor(y); };
const gust = x => { const i=Math.floor(x),f=x-i,u=f*f*(3-2*f); return THREE.MathUtils.lerp(hash(i),hash(i+1),u)*2-1; };
export function atmosphericDynamics(time) {
  if(!Number.isFinite(time)||time<=4.5||time>=SPATIAL_CLOUD_END)return {intensity:0,flow:0,turbulence:0,storm:0};
  const travel=time-4.5;
  const release=1-smooth(7.12,SPATIAL_CLOUD_END,time);
  return {intensity:smooth(4.5,4.9,time)*release,
    flow:travel*travel/(1+.65*travel),
    turbulence:smooth(4.85,6.15,time)*release,
    storm:smooth(5.85,6.65,time)*release};
}

const VERTEX = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vDepth;
  void main(){
    vUv=uv;
    vNormal=normalize(mat3(modelMatrix)*normal);
    vec4 viewPosition=modelViewMatrix*vec4(position,1.0);
    vDepth=-viewPosition.z;
    gl_Position=projectionMatrix*viewPosition;
  }`;
const FRAGMENT = `
  uniform sampler2D cloudMap;
  uniform vec3 sunDirection;
  uniform float intensity, weatherPatch, journeyTime, turbulence, storm, flow, lightVariation;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying float vDepth;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
  void main(){
    vec2 p=(vUv-.5)*2.0;
    float evolving=noise(p*3.7+vec2(weatherPatch*19.0,journeyTime*(.35+turbulence*.65)));
    float edgeNoise=(evolving-.5)*(.12+turbulence*.16)
      +(noise(p.yx*6.1-vec2(journeyTime*.41,weatherPatch*11.0))-.5)*.09;
    float silhouette=1.0-smoothstep(.64+edgeNoise,.98+edgeNoise,length(p*vec2(1.0,.92)));
    float border=smoothstep(0.0,.16,min(min(vUv.x,1.0-vUv.x),min(vUv.y,1.0-vUv.y)));
    float density=texture2D(cloudMap,vec2(weatherPatch+vUv.x*.18+flow*.018,.30+vUv.y*.34)).r;
    density=1.0-(1.0-density)*(1.0-storm*(.38+evolving*.28));
    float body=smoothstep(.025,.60,density);
    float alpha=body*silhouette*border*intensity*mix(.58,.84,storm)*smoothstep(.12,.28,vDepth);
    if(alpha<.002)discard;
    vec3 N=normalize(vNormal)*(gl_FrontFacing?1.0:-1.0);
    float sunlight=max(dot(N,normalize(sunDirection)),0.0);
    vec3 colour=mix(vec3(.075,.12,.17),vec3(.46,.53,.59),sunlight*.65+body*.20);
    colour*=lightVariation;
    colour=mix(colour,vec3(.045,.075,.11)*(0.80+body*.25),storm*.78);
    colour+=vec3(.12,.075,.025)*sunlight*(1.0-body)*.25;
    gl_FragColor=vec4(colour,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <premultiplied_alpha_fragment>
  }`;

/** Three temporary world-space banks; samples come from the existing camera path. */
export class JourneySpatialClouds {
  constructor(target, samples, radius) {
    this.disposed=false;
    this.target=target;
    this.sourceUniforms=target.material?.uniforms;
    this.radius=radius;
    this.group=new THREE.Group();
    this.group.name="Journey3SpatialClouds";
    this.banks=[];
    this.centre=new THREE.Vector3();
    let root=target;while(root.parent)root=root.parent;
    root.add(this.group);
    const worldUp=new THREE.Vector3(0,1,0);
    for(let i=0;i<3;i++) {
      const sample=samples[i],forward=sample.forward.clone();
      const up=Math.abs(forward.dot(worldUp))>.95?new THREE.Vector3(1,0,0):worldUp;
      const right=new THREE.Vector3().crossVectors(forward,up).normalize();
      const bankUp=new THREE.Vector3().crossVectors(right,forward).normalize();
      const side=i===1?1:-1;
      const geometry=new THREE.PlaneGeometry(radius*.76,radius*.70,12,8);
      const positions=geometry.attributes.position;
      for(let v=0;v<positions.count;v++) {
        const x=positions.getX(v)/radius,y=positions.getY(v)/radius;
        positions.setZ(v,radius*(x*x*.65+Math.sin(y*5.0+i)*.025));
      }
      geometry.computeVertexNormals();geometry.computeBoundingSphere();
      const uniforms={cloudMap:{value:this.sourceUniforms?.cloudMap?.value??null},sunDirection:{value:new THREE.Vector3(-1,.3,0).normalize()},intensity:{value:0},weatherPatch:{value:.14+i*.27},journeyTime:{value:0},turbulence:{value:0},storm:{value:0},flow:{value:0},lightVariation:{value:1}};
      const material=new THREE.ShaderMaterial({uniforms,vertexShader:VERTEX,fragmentShader:FRAGMENT,
        transparent:true,premultipliedAlpha:true,blending:THREE.NormalBlending,
        depthTest:true,depthWrite:false,side:THREE.DoubleSide});
      const mesh=new THREE.Mesh(geometry,material);
      mesh.name="Journey3CloudBank"+i;
      mesh.position.copy(sample.position).addScaledVector(forward,radius*(.30+i*.045))
        .addScaledVector(right,side*radius*(.43+i*.025)).addScaledVector(bankUp,radius*(i===1?.05:-.08));
      mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,bankUp,forward.clone().negate()));
      mesh.layers.set(0);
      mesh.renderOrder=3; // After Earth cloud/rim transparency; still depth-tested against solid Earth.
      this.group.add(mesh);
      this.banks.push({mesh,base:mesh.position.clone(),rotation:mesh.quaternion.clone(),forward,up:bankUp,wind:right.multiplyScalar(side),uniforms});
    }
    this.group.visible=false;
    this.update(0);
  }
  update(time) {
    if(this.disposed)return;
    if(Number.isFinite(time)&&time>=SPATIAL_CLOUD_END){this.dispose();return;}
    const map=this.sourceUniforms?.cloudMap?.value;
    const dynamics=atmosphericDynamics(time);
    const intensity=map?.image?.width>1?dynamics.intensity:0;
    this.group.visible=intensity>0;
    this.target.getWorldPosition(this.centre);
    this.group.position.copy(this.centre); // Earth translation, not camera attachment/billboarding.
    for(let i=0;i<this.banks.length;i++) {
      const bank=this.banks[i];
      bank.uniforms.cloudMap.value=map??null;
      bank.uniforms.intensity.value=intensity;
      bank.uniforms.journeyTime.value=Number.isFinite(time)?time:0;
      bank.uniforms.turbulence.value=dynamics.turbulence;
      bank.uniforms.storm.value=dynamics.storm;
      bank.uniforms.flow.value=dynamics.flow;
      bank.uniforms.lightVariation.value=1+dynamics.turbulence*.12*gust(time*(1.6+i*.43)+i*7.1);
      if(this.sourceUniforms?.sunDirection)bank.uniforms.sunDirection.value.copy(this.sourceUniforms.sunDirection.value);
      // Increasing flow, strongest for the near bank; each gust has its own rate.
      const burst=gust(time*(1.1+i*.37)+i*11.7)*dynamics.turbulence;
      bank.mesh.position.copy(bank.base)
        .addScaledVector(bank.forward,-this.radius*dynamics.flow*(.040-i*.010))
        .addScaledVector(bank.wind,this.radius*(burst*.035-dynamics.storm*(.31+i*.018)))
        .addScaledVector(bank.up,this.radius*(gust(time*1.37+i*9.2)*dynamics.turbulence*.035+dynamics.storm*.08));
      bank.mesh.quaternion.copy(bank.rotation);
      bank.mesh.rotateZ(burst*.055);
      bank.mesh.scale.setScalar(1+dynamics.storm*(.22+i*.025));
    }
  }
  dispose() {
    if(this.disposed)return;
    this.disposed=true;this.group.visible=false;this.group.removeFromParent();
    for(const bank of this.banks){bank.uniforms.cloudMap.value=null;bank.mesh.geometry.dispose();bank.mesh.material.dispose();}
    this.target=null;this.sourceUniforms=null;
  }
}
