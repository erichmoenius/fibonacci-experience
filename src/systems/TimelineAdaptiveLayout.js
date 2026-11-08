import * as THREE from "three";
import { OBB } from "three/addons/math/OBB.js";

const FRAME_MARGIN = .02;
/** Events-only dense tunnel: five ordered sections, deterministic angular
 * staggering and bounded spacing/radius reflow. Factory placements stay intact. */
export function adaptTimeline(tuning, settings, radius) {
  const gapFactor = 1 - settings.gap / 100;
  const strength = THREE.MathUtils.clamp((settings.pictureSize / 100 * gapFactor - 1) / .455, 0, 1);
  const referenceRadius = Math.max(3, radius - 1.3 * strength);
  const targetInnerSpacing = 12 - 7.5 * strength;
  const targetOuterSpacing = 12 - 4.5 * strength;
  const step = Math.PI * 2 / 15;
  const seeds = tuning.room.monitors.map(m => {
    const data = m.userData.timeline;
    return {section:data.section,slot:data.slot,angle:data.slot*step+(data.section-2)*step*.5*strength};
  });
  const solve = percent => {
    const factor = percent / 100 * gapFactor;
    for(let p=0;p<9;p++)for(let s=0;s<4;s++) {
      const innerSpacing=targetInnerSpacing+p*.5, outerSpacing=targetOuterSpacing+p*.5, stagger=s*.15*strength;
      const placements=seeds.map(seed=>{
        const r=referenceRadius+(seed.slot%2?1:-1)*stagger;
        const index=2-seed.section;
        const z=Math.sign(index)*(Math.abs(index)>0?innerSpacing+(Math.abs(index)-1)*outerSpacing:0);
        const surface=new THREE.Vector3(r*Math.cos(seed.angle),r*Math.sin(seed.angle),z);
        const inward=surface.clone().normalize().negate();
        const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),inward).normalize();
        const up=new THREE.Vector3().crossVectors(inward,right).normalize();
        const matrix=new THREE.Matrix4().makeBasis(right,up,inward);
        return {center:surface.clone().addScaledVector(inward,-.09),quaternion:new THREE.Quaternion().setFromRotationMatrix(matrix),rotation:new THREE.Matrix3().setFromMatrix4(matrix),r};
      });
      const boxes=placements.map((p,i)=>{
        const b=tuning.base[i],f=b.children[0].scale;
        return new OBB(p.center,new THREE.Vector3(f.x+b.size.width*(factor-1),f.y+b.size.height*(factor-1),f.z).multiply(b.scale).multiplyScalar(.5).addScalar(FRAME_MARGIN),p.rotation);
      });
      let safe=true;
      for(let i=0;safe&&i<boxes.length;i++) {
        // A conservative clear cylinder also protects the axial tunnel sightline.
        if(placements[i].r-boxes[i].halfSize.length()<1.25||boxes[i].clampPoint(new THREE.Vector3(),new THREE.Vector3()).length()<1.5){safe=false;break;}
        for(let j=i+1;j<boxes.length;j++) {
          if(boxes[i].center.distanceToSquared(boxes[j].center)>(boxes[i].halfSize.length()+boxes[j].halfSize.length())**2)continue;
          if(boxes[i].intersectsOBB(boxes[j],1e-10)){safe=false;break;}
        }
      }
      if(safe)return {placements,innerSpacing,outerSpacing,stagger};
    }
    return null;
  };
  let effective=settings.pictureSize,result=solve(effective);
  if(!result){let low=1,high=Math.floor(settings.pictureSize);while(low<high){const mid=Math.ceil((low+high)/2);if(solve(mid))low=mid;else high=mid-1;}effective=low;result=solve(effective);}
  if(!result)return null;
  tuning.room.monitors.forEach((m,i)=>{m.position.copy(result.placements[i].center);m.quaternion.copy(result.placements[i].quaternion);m.scale.copy(tuning.base[i].scale);});
  return {maxPictureSize:effective<settings.pictureSize?effective:150,details:{strength,referenceRadius,innerSpacing:result.innerSpacing,outerSpacing:result.outerSpacing,sectionSpacings:[result.outerSpacing,result.innerSpacing,result.innerSpacing,result.outerSpacing],angularStaggerDegrees:12*strength,radialStagger:result.stagger,frameMargin:FRAME_MARGIN}};
}
