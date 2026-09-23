import * as THREE from "three";

export class Starfield {

constructor(scene){

this.scene = scene;

// deep background micro stars
this.micro = this.createMicroLayer(15000,400);

// main layers
this.far  = this.createLayer(2000,220);
this.mid  = this.createLayer(2000,160);
this.near = this.createLayer(2000,100);

}



setVisible(visible){
  for (const layer of [this.micro, this.far, this.mid, this.near]) {
    layer.visible = visible;
  }
}

createLayer(count,spread){

const geometry = new THREE.BufferGeometry();

const positions = new Float32Array(count*3);
const colors = new Float32Array(count*3);
const sizes = new Float32Array(count);

for(let i=0;i<count;i++){

let color;

// milky way band
const band = Math.random() < 0.3;

// position
positions[i*3] = (Math.random()-0.5)*spread;

if(band){

positions[i*3+1] = (Math.random()-0.5)*spread*0.15;

// milky way stars slightly blue
color = new THREE.Color(0.65,0.8,1.2);

}else{

positions[i*3+1] = (Math.random()-0.5)*spread;

// star color distribution
const r = Math.random();

if(r < 0.65){

color = new THREE.Color(1,1,1); // white

}
else if(r < 0.85){

// stronger blue
color = new THREE.Color(0.55,0.75,1.35);

}
else{

// stronger orange
color = new THREE.Color(1.25,0.75,0.45);

}

}

positions[i*3+2] = -Math.random()*spread;


// write color
colors[i*3]   = color.r;
colors[i*3+1] = color.g;
colors[i*3+2] = color.b;


// size variation
const s = Math.random();

if(s < 0.7){
sizes[i] = 1.0;
}
else if(s < 0.95){
sizes[i] = 2.0;
}
else{
sizes[i] = 4.5;
}

}

geometry.setAttribute(
"position",
new THREE.BufferAttribute(positions,3)
);

geometry.setAttribute(
"color",
new THREE.BufferAttribute(colors,3)
);

geometry.setAttribute(
"aSize",
new THREE.BufferAttribute(sizes,1)
);


const material = new THREE.ShaderMaterial({

uniforms:{
uTime:{value:0}
},

transparent:true,
depthWrite:false,
vertexColors:true,
blending:THREE.AdditiveBlending,


vertexShader:`

attribute float aSize;

varying vec3 vColor;
varying float vSize;

void main(){

vColor = color;
vSize = aSize;

vec4 mvPosition = modelViewMatrix * vec4(position,1.0);

float dist = length(mvPosition.xyz);

gl_PointSize = clamp(aSize * (200.0 / dist),1.0,8.0);

gl_Position = projectionMatrix * mvPosition;

}

`,

fragmentShader:`

uniform float uTime;

varying vec3 vColor;
varying float vSize;

void main(){

vec2 uv = gl_PointCoord - 0.5;

float d = length(uv);

// core
float star = smoothstep(0.5,0.0,d);

// glow halo
float glow = smoothstep(0.7,0.0,d);


// twinkle
float twinkle = sin(uTime*3.0 + gl_FragCoord.x*0.02 + gl_FragCoord.y*0.02);
twinkle = twinkle*0.5 + 0.5;

float brightness = mix(0.8,1.3,twinkle * vSize);


// base color
vec3 color = vColor * star;

// halo
color += vColor * glow * 0.35;

// brightness
color *= brightness;

// avoid white clipping
color = min(color, vColor * 1.7);

gl_FragColor = vec4(color, star);

}

`

});


const points = new THREE.Points(geometry,material);

this.scene.add(points);

return points;

}



createMicroLayer(count,spread){

const geometry = new THREE.BufferGeometry();

const positions = new Float32Array(count*3);

for(let i=0;i<count;i++){

positions[i*3]   = (Math.random()-0.5)*spread;
positions[i*3+1] = (Math.random()-0.5)*spread;
positions[i*3+2] = -Math.random()*spread;

}

geometry.setAttribute(
"position",
new THREE.BufferAttribute(positions,3)
);

const material = new THREE.PointsMaterial({

color:0xffffff,
size:0.25,
sizeAttenuation:true,
transparent:true,
opacity:0.6,
depthWrite:false

});

const points = new THREE.Points(geometry,material);

this.scene.add(points);

return points;

}



update(){

// micro stars very slow
this.micro.rotation.y += 0.000002;


// parallax layers
this.far.rotation.y  += 0.00001;

this.mid.rotation.y  += 0.00005;
this.mid.rotation.z  += 0.00002;

this.near.rotation.y += 0.0002;


// twinkle animation
this.far.material.uniforms.uTime.value  += 0.01;
this.mid.material.uniforms.uTime.value  += 0.01;
this.near.material.uniforms.uTime.value += 0.01;

}

}