import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";

const MARGIN = .02;
/** Animals-only dense mode. Fixed azimuth/order, upright inward-facing panels,
 * bounded alternating depths and a tighter continuous 2.5-turn helix. */
export function adaptSpiral(tuning, settings, radius) {
  const factor = settings.pictureSize / 100 * (1 - settings.gap / 100);
  const strength = THREE.MathUtils.clamp((factor - 1) / .875, 0, 1);
  const referenceRadius = Math.max(4, radius - 1.5 * strength);
  const targetPitch = 4.8 - 1.8 * strength;
  const rotations = tuning.base.map(b => new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(b.quaternion)));
  const solve = percent => {
    const scale = percent / 100 * (1 - settings.gap / 100);
    // At most 45 candidates; prefer the tightest pitch and least depth staggering.
    for (let p = 0; p < 9; p++) for (let s = 0; s < 5; s++) {
      const pitch = targetPitch + p * .45;
      const stagger = (.5 + s * .25) * strength;
      const centers = tuning.room.monitors.map((m,i) => {
        const data = m.userData.spiral, r = referenceRadius + (i % 2 ? 1 : -1) * stagger;
        return new THREE.Vector3(Math.sin(data.azimuth)*r,(data.t-.5)*2.5*pitch,-Math.cos(data.azimuth)*r);
      });
      const boxes = centers.map((center,i) => {
        const b=tuning.base[i], f=b.children[0].scale;
        return new OBB(center,new THREE.Vector3(f.x+b.size.width*(scale-1),f.y+b.size.height*(scale-1),f.z).multiply(b.scale).multiplyScalar(.5).addScalar(MARGIN),rotations[i]);
      });
      let safe=true;
      for(let i=0;safe&&i<boxes.length;i++) {
        if(boxes[i].clampPoint(new THREE.Vector3(),new THREE.Vector3()).length()<2){safe=false;break;}
        for(let j=i+1;j<boxes.length;j++) {
          if(boxes[i].center.distanceToSquared(boxes[j].center)>(boxes[i].halfSize.length()+boxes[j].halfSize.length())**2)continue;
          if(boxes[i].intersectsOBB(boxes[j],1e-10)){safe=false;break;}
        }
      }
      if(safe)return {centers,pitch,stagger};
    }
    return null;
  };
  let effective=settings.pictureSize, result=solve(effective);
  if(!result){let low=1,high=Math.floor(settings.pictureSize);while(low<high){const mid=Math.ceil((low+high)/2);if(solve(mid))low=mid;else high=mid-1;}effective=low;result=solve(effective);}
  if(!result)return null; // Shared physical collision limiter remains the fallback.
  tuning.room.monitors.forEach((m,i)=>{m.position.copy(result.centers[i]);m.quaternion.copy(tuning.base[i].quaternion);m.scale.copy(tuning.base[i].scale);});
  return {maxPictureSize:effective<settings.pictureSize?effective:150,details:{strength,referenceRadius,pitch:result.pitch,stagger:result.stagger,frameMargin:MARGIN}};
}
