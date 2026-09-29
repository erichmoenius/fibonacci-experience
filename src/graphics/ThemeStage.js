import * as THREE from "three";

export class ThemeStage {

constructor(scene){

this.scene = scene;

const size = 5.5;


// Theme Container
this.content = new THREE.Group();

// wichtig: leicht hinter dem Glas
this.content.position.z = -0.01;

scene.add(this.content);


// Glass Portal
this.glass = new THREE.Mesh(
new THREE.PlaneGeometry(size, size),
new THREE.MeshPhysicalMaterial({
color: 0xffffff,
transmission: 1,
opacity: 0.15,
transparent: true,
roughness: 0.2,
metalness: 0,
depthWrite:false
})
);

// Glas leicht davor
this.glass.position.z = 0.02;

scene.add(this.glass);

}


getContent(){
return this.content;
}

setVisible(visible){
this.glass.visible = visible;
}

}
