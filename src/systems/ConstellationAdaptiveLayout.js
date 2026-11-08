import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";

const FRAME_MARGIN = .02;
/** Ethnicity-only radial reflow. Fibonacci rays and the existing graph stay
 * fixed; a bounded multi-layer depth spread keeps the network genuinely spatial. */
export function adaptConstellation(tuning, settings, radius) {
  const gapFactor=1-settings.gap/100;
  const strength=THREE.MathUtils.clamp((settings.pictureSize/100*gapFactor-1)/.44,0,1);
  const nearest=Math.max(4,radius-2*strength),spread=9-3*strength;
  const seeds=tuning.base.map(b=>{
    const normal=new THREE.Vector3(0,0,1).applyQuaternion(b.quaternion);
    const surface=b.position.clone().addScaledVector(normal,.09*b.scale.z);
    return {direction:surface.clone().normalize(),rank:THREE.MathUtils.clamp((surface.length()-9)/9,0,1),rotation:new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(b.quaternion))};
  });
  const solve=percent=>{
    const factor=percent/100*gapFactor;
    // Prefer the closest safe field, preserving deterministic depth rank.
    for(let p=0;p<9;p++)for(let s=0;s<5;s++) {
      const near=nearest+p*.25,depth=spread+s*.5;
      const centers=seeds.map((seed,i)=>seed.direction.clone().multiplyScalar(near+seed.rank*depth+.09*tuning.base[i].scale.z));
      const boxes=centers.map((center,i)=>{
        const b=tuning.base[i],f=b.children[0].scale;
        return new OBB(center,new THREE.Vector3(f.x+b.size.width*(factor-1),f.y+b.size.height*(factor-1),f.z).multiply(b.scale).multiplyScalar(.5).addScalar(FRAME_MARGIN),seeds[i].rotation);
      });
      let safe=true;
      for(let i=0;safe&&i<boxes.length;i++) {
        if(boxes[i].clampPoint(new THREE.Vector3(),new THREE.Vector3()).length()<3){safe=false;break;}
        for(let j=i+1;j<boxes.length;j++) {
          if(boxes[i].center.distanceToSquared(boxes[j].center)>(boxes[i].halfSize.length()+boxes[j].halfSize.length())**2)continue;
          if(boxes[i].intersectsOBB(boxes[j],1e-10)){safe=false;break;}
        }
      }
      if(safe)return {centers,nearest:near,spread:depth};
    }
    return null;
  };
  let effective=settings.pictureSize,result=solve(effective);
  if(!result){let low=1,high=Math.floor(settings.pictureSize);while(low<high){const mid=Math.ceil((low+high)/2);if(solve(mid))low=mid;else high=mid-1;}effective=low;result=solve(effective);}
  if(!result)return null;
  tuning.room.monitors.forEach((m,i)=>{m.position.copy(result.centers[i]);m.quaternion.copy(tuning.base[i].quaternion);m.scale.copy(tuning.base[i].scale);});
  return {maxPictureSize:effective<settings.pictureSize?effective:150,details:{strength,nearestDistance:result.nearest,depthSpread:result.spread,farthestDistance:result.nearest+result.spread,frameMargin:FRAME_MARGIN}};
}
