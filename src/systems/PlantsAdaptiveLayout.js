import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";

const ELEVATION_LIMIT = 1.45;
const FRAME_MARGIN = .04;
const STEP = .25, OUTWARD_LIMIT = 2.5, INWARD_LIMIT = -1, MAX_PASSES = 32;

/** Dense Plants mode: fixed golden-angle azimuths, botanical latitude sweep,
 * and a small bounded radial reflow. Factory and low-density geometry stay intact. */
export function adaptPlants(tuning, settings, absoluteRadius) {
  const gapFactor = 1 - settings.gap / 100;
  const strength = THREE.MathUtils.clamp((settings.pictureSize / 100 * gapFactor - 1) / 1.25, 0, 1);
  const offset = absoluteRadius - 12;
  const seeds = tuning.room.monitors.map((monitor, i) => {
    const b = tuning.base[i], data = monitor.userData.phyllotaxis;
    const normal = new THREE.Vector3(0,0,1).applyQuaternion(b.quaternion);
    const original = b.position.clone().addScaledVector(normal,.09 * b.scale.z);
    const originalRadial = Math.hypot(original.x,original.z) + offset;
    const oldElevation = Math.atan2(original.y,originalRadial);
    const oldDistance = Math.hypot(original.y,originalRadial);
    const elevation = THREE.MathUtils.lerp(oldElevation,(1 - 2 * data.t) * ELEVATION_LIMIT,strength);
    const distance = THREE.MathUtils.lerp(oldDistance,10 - 1.5 * Math.cos(2 * Math.PI * data.t) + offset,strength);
    const direction = new THREE.Vector3(Math.cos(elevation)*Math.cos(data.azimuth),Math.sin(elevation),Math.cos(elevation)*Math.sin(data.azimuth));
    const inward = direction.clone().negate();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),inward).normalize();
    const up = new THREE.Vector3().crossVectors(inward,right).normalize();
    const matrix = new THREE.Matrix4().makeBasis(right,up,inward);
    return { direction,distance,quaternion:new THREE.Quaternion().setFromRotationMatrix(matrix),rotation:new THREE.Matrix3().setFromMatrix4(matrix) };
  });
  const overlaps = (a,b) => a.center.distanceToSquared(b.center) <= (a.halfSize.length()+b.halfSize.length())**2 && a.intersectsOBB(b,1e-10);
  const solve = percent => {
    const factor = percent / 100 * gapFactor, shifts = seeds.map(()=>0);
    const boxes = seeds.map((seed,i) => {
      const b=tuning.base[i],frame=b.children[0].scale;
      const half=new THREE.Vector3(frame.x+b.size.width*(factor-1),frame.y+b.size.height*(factor-1),frame.z).multiply(b.scale).multiplyScalar(.5).addScalar(FRAME_MARGIN);
      return new OBB(seed.direction.clone().multiplyScalar(seed.distance+.09),half,seed.rotation.clone());
    });
    let passes=0;
    for(;passes<MAX_PASSES;passes++) {
      let count=0;
      for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++)if(overlaps(boxes[a],boxes[b])) {
        count++;
        const order=seeds[a].distance>seeds[b].distance?[a,b]:[b,a];
        let moved=false;
        for(const k of order)if(shifts[k]<OUTWARD_LIMIT){shifts[k]+=STEP;boxes[k].center.copy(seeds[k].direction).multiplyScalar(seeds[k].distance+shifts[k]+.09);moved=true;break;}
        if(!moved)for(const k of order)if(shifts[k]>INWARD_LIMIT){shifts[k]-=STEP;boxes[k].center.copy(seeds[k].direction).multiplyScalar(seeds[k].distance+shifts[k]+.09);break;}
      }
      if(!count)break;
    }
    for(let a=0;a<boxes.length;a++) {
      if(boxes[a].clampPoint(new THREE.Vector3(),new THREE.Vector3()).length()<3)return null;
      for(let b=a+1;b<boxes.length;b++)if(overlaps(boxes[a],boxes[b]))return null;
    }
    return {boxes,shifts,passes};
  };
  let effective=settings.pictureSize,result=solve(effective);
  if(!result) {
    let low=1,high=Math.floor(settings.pictureSize);
    while(low<high){const mid=Math.ceil((low+high)/2);if(solve(mid))low=mid;else high=mid-1;}
    effective=low;result=solve(effective);
  }
  // The minimum-size candidate always has a clear center and separated frames.
  if(!result)throw new Error("Plants adaptive layout has no safe placement");
  tuning.room.monitors.forEach((monitor,i)=>{
    monitor.position.copy(result.boxes[i].center);monitor.quaternion.copy(seeds[i].quaternion);monitor.scale.copy(tuning.base[i].scale);
  });
  return {maxPictureSize:effective<settings.pictureSize?effective:150,
    details:{strength,passes:result.passes,maxRadialShift:Math.max(...result.shifts.map(Math.abs)),elevationLimitDegrees:THREE.MathUtils.radToDeg(ELEVATION_LIMIT),frameMargin:FRAME_MARGIN}};
}
