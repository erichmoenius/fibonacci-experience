import * as THREE from "three";

const TAU = Math.PI * 2;
const SEGMENTS = 40, SIDES = 6;
const unit = (v) => Number.isFinite(v) ? THREE.MathUtils.clamp(v, 0, 1) : 0;
const audioGain = (v) => v === undefined ? 1 : Number.isFinite(v) ? THREE.MathUtils.clamp(v, 0, 10) : 0;
// Amplify only the audio increment, with a soft diagnostic ceiling. Gain 1 is
// exactly A5; ambient scale/opacity never enter this amplification.
const coronaAmount = (amount, ceiling, gain) => gain === 1 ? amount
  : ceiling * (1 - Math.pow(1 - amount / ceiling, gain));

// Theme 3 only. Fixed geometry pool; no particles, textures or audio provider.
export class SolarActivity {
  constructor(sun, corona, radius) {
    this.sun = sun;
    this.corona = corona;
    this.radius = radius;
    this.settings = { response: 1, eruptions: true, eruptionThreshold: 0.32 };
    this.signals = { bass: 0, mid: 0, high: 0, energy: 0 };
    this.primed = false;
    this.cooldown = 0;
    this.time = 0;
    this.flow = sun.material.uniforms.uFlowAmount.value;
    this.brightness = sun.material.uniforms.uBrightness.value;
    this.shimmer = { value: 0 };
    this.breath = { value: 0 };
    this.clock = { value: 0 };
    // Blob-derived broad deformation, adapted to the existing solar billboard.
    // Keep the original map as a subtle atmosphere underneath flowing folds.
    corona.material.onBeforeCompile = (shader) => {
      shader.uniforms.uSolarHigh = this.shimmer;
      shader.uniforms.uSolarBreath = this.breath;
      shader.uniforms.uSolarClock = this.clock;
      shader.fragmentShader = `uniform float uSolarHigh, uSolarClock, uSolarBreath;
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


float solarField(vec3 p){
  float v=0.0, a=0.5;
  for(int i=0;i<3;i++){v+=a*noise3D(p);p=p*2.0+vec3(5.2,1.3,8.7);a*=0.5;}
  return v*2.0-0.875;
}
` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 atmosphere = texture2D(map, vMapUv);
          vec2 solarUV = vMapUv - 0.5;
          float r = length(solarUV);
          vec2 direction = solarUV / max(r, 0.001);
          float drive = clamp(uSolarBreath, 0.0, 1.0);
          float t = uSolarClock * 0.22;
          // Smooth 3D noise on the circle avoids a polar seam. Broad swells
          // move the limb itself; a second advected field folds the surface.
          float swell = solarField(vec3(direction * 2.2, t));
          float fold = solarField(vec3(direction * 4.2 + swell * 0.7, r * 5.0 - t * 1.4));
          float detail = solarField(vec3(direction * 7.0 + fold * 0.6, r * 14.0 - t * 2.0));
          float edge = 0.29 + drive * 0.105 + swell * (0.025 + drive * 0.085);
          float width = 0.017 + drive * 0.025;
          float foldedRadius = r - edge + fold * (0.012 + drive * 0.025);
          // Fill back to the occulting sphere: an attached plasma fold, not a ring.
          float sheet = (1.0 - smoothstep(-width, width, foldedRadius))
            * smoothstep(0.19, 0.245, r);
          float tongues = smoothstep(-0.35, 0.30, swell + fold * 0.45);
          float filaments = 0.30 + 0.70 * smoothstep(-0.35, 0.40, detail);
          float plasmaAlpha = drive * sheet * tongues * (0.12 + 0.12 * filaments);
          plasmaAlpha *= 1.0 - smoothstep(0.42, 0.49, r);
          float atmosphereAlpha = atmosphere.a * (1.0 - drive * 0.65);
          float totalAlpha = atmosphereAlpha + plasmaAlpha;
          vec3 gold = vec3(1.0, 0.55, 0.10);
          vec3 orange = vec3(1.0, 0.16, 0.015);
          vec3 plasmaColor = mix(orange, gold, smoothstep(-0.35, 0.40, detail + fold * 0.30));
          diffuseColor.rgb *= mix(atmosphere.rgb, plasmaColor,
            plasmaAlpha / max(totalAlpha, 0.0001));
          diffuseColor.a *= totalAlpha;
        #endif
      `);
    };
    corona.material.customProgramCacheKey = () => 'planetary-sun-a13-organic-corona';
    this.view = new THREE.Vector3();
    this.normal = new THREE.Vector3();
    this.tangent = new THREE.Vector3();
    this.axis = new THREE.Vector3();
    this.pool = Array.from({ length: 2 }, () => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SEGMENTS + 1) * SIDES * 3), 3).setUsage(THREE.DynamicDrawUsage));
      const indices = [];
      for (let i = 0; i < SEGMENTS; i++) for (let j = 0; j < SIDES; j++) {
        const a = i * SIDES + j, b = i * SIDES + (j + 1) % SIDES;
        // Outward-facing winding: radial/tangent/axis form a right-handed frame.
        indices.push(a, a + SIDES, b, b, a + SIDES, b + SIDES);
      }
      geometry.setIndex(indices);
      const material = new THREE.MeshBasicMaterial({ color: 0xff8b28, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = 'SolarProminenceA1';
      mesh.visible = false;
      mesh.frustumCulled = false; // Tiny pool stays at the Sun; no dynamic bounds scan.
      sun.add(mesh);
      return { mesh, age: 0, life: 4.5, normal: new THREE.Vector3(), tangent: new THREE.Vector3(), axis: new THREE.Vector3(), strength: 0 };
    });
  }

  spawn(camera, strength) {
    const event = this.pool.find((e) => !e.mesh.visible);
    if (!event || !camera) return;
    camera.getWorldPosition(this.view);
    this.sun.worldToLocal(this.view);
    const distance = this.view.length();
    if (distance <= this.radius * 1.05) return;
    this.view.normalize();
    this.axis.set(0, 1, 0);
    if (Math.abs(this.view.y) > 0.9) this.axis.set(1, 0, 0);
    this.normal.crossVectors(this.view, this.axis).normalize();
    this.tangent.crossVectors(this.view, this.normal).normalize();
    const angle = Math.random() * TAU;
    // Tangency on a sphere: n dot view = radius / camera distance.
    const depth = this.radius / distance;
    event.normal.copy(this.normal).multiplyScalar(Math.cos(angle)).addScaledVector(this.tangent, Math.sin(angle)).multiplyScalar(Math.sqrt(1 - depth * depth)).addScaledVector(this.view, depth);
    event.tangent.crossVectors(this.view, event.normal).normalize();
    event.axis.crossVectors(event.normal, event.tangent).normalize();
    event.age = 0;
    event.strength = strength;
    event.mesh.visible = true;
    this.cooldown = 6;
  }

  update(delta, inputs, camera, enabled = true) {
    const master = audioGain(this.audioSettings?.masterGain);
    const coronaGain = audioGain(this.audioSettings?.coronaBassGain);
    this.audioTraceUpdateCount = (this.audioTraceUpdateCount ?? 0) + 1;
    this.audioTraceMaster = master;
    enabled = enabled && master > 0;
    // Temporary A3 trace: record the actual receiver without another FFT read.
    this.audioTraceInput = inputs;
    this.audioTraceEnabled = enabled;
    const dt = Number.isFinite(delta) ? THREE.MathUtils.clamp(delta, 0, 0.1) : 0;
    this.time += dt;
    this.clock.value = this.time;
    this.cooldown = Math.max(0, this.cooldown - dt);
    const gain = enabled ? unit(this.settings.response) : 0;
    const bass = unit(inputs?.bass), energy = unit(inputs?.energy);
    // AudioManager already detects the onset. Its smoothed FFT can rise over
    // several frames; a second same-frame slope test discarded valid kicks.
    if (dt > 0 && gain > 0 && this.primed && this.settings.eruptions && inputs?.kick
      && energy > 0.08 && bass > this.settings.eruptionThreshold && this.cooldown === 0) {
      this.spawn(camera, bass * gain);
    }
    this.primed = enabled && dt > 0;
    for (const key of Object.keys(this.signals)) {
      const input = unit(inputs?.[key]);
      // Space's plasma follows raw bands. Avoid lifting bass valleys before
      // another envelope: the shared FFT already smooths the incoming signal.
      // Keep raw bass/energy above for the existing eruption trigger.
      const target = unit((key === 'bass' ? input : input * master) * gain);
      // Fast bass attack, smooth release; surface bands keep their A2 timing.
      const rate = target > this.signals[key] ? (key === 'bass' ? 1 / 0.02 : 4)
        : (key === 'bass' ? 1 / 0.16 : 3);
      this.signals[key] = enabled ? THREE.MathUtils.lerp(this.signals[key], target, 1 - Math.exp(-dt * rate)) : 0;
      if (this.signals[key] < 1e-5 && target === 0) this.signals[key] = 0;
    }
    const { mid, high } = this.signals;
    // Integrate extra procedural time; never multiply an absolute clock, which
    // would make the approved advected field jump when music changes.
    this.sun.material.uniforms.uTime.value += dt * (mid * 0.08 + this.signals.energy * 0.06);
    this.sun.material.uniforms.uFlowAmount.value = this.flow * (1 + mid * 0.06);
    this.sun.material.uniforms.uBrightness.value = this.brightness * (1 + this.signals.energy * 0.025);
    this.shimmer.value = high;
    // Preserve bass contrast between beats instead of compressing it twice.
    // Retain the previous full-input drive and all existing size/opacity caps.
    const bassDrive = this.signals.bass * (1 - Math.exp(-4));
    // SolarSystem restores ambient scale/opacity before this call each frame.
    const coronaLevel = master * coronaGain;
    // Use the existing smoothed bass directly: retain rhythmic dips instead of
    // flattening this spatial response with the brightness drive's exponential.
    this.breath.value = this.signals.bass * Math.min(1, coronaLevel);
    // Structure and local deformation carry the response, not A11's large ring.
    this.corona.scale.multiplyScalar(1 + coronaAmount(bassDrive * 0.28, 0.75, coronaLevel));
    this.corona.material.opacity *= 1 + coronaAmount(bassDrive * 0.75, 1.5, coronaLevel);
    for (const event of this.pool) {
      if (!event.mesh.visible) continue;
      event.age += dt;
      if (!enabled || event.age >= event.life) {
        event.mesh.visible = false;
        event.mesh.material.opacity = 0;
        continue;
      }
      const p = event.age / event.life;
      const growth = THREE.MathUtils.smoothstep(p, 0, 0.32);
      const fade = 1 - THREE.MathUtils.smoothstep(p, 0.4, 1);
      event.mesh.material.opacity = 0.80 * growth * fade;
      const positions = event.mesh.geometry.attributes.position;
      const height = (0.6 + event.strength * 0.8) * growth;
      for (let i = 0; i <= SEGMENTS; i++) {
        const u = i / SEGMENTS, arc = (u - 0.5) * 0.25;
        const r = this.radius * 0.999 + Math.sin(Math.PI * u) * height;
        // About 3.4 px wide at the home distance in a 1080p capture.
        const tube = 0.09 * Math.sin(Math.PI * u) * growth;
        for (let j = 0; j < SIDES; j++) {
          const a = j / SIDES * TAU;
          const radial = Math.cos(arc) * r + Math.cos(a) * tube;
          const along = Math.sin(arc) * r;
          const side = Math.sin(a) * tube;
          positions.setXYZ(i * SIDES + j,
            event.normal.x * radial + event.tangent.x * along + event.axis.x * side,
            event.normal.y * radial + event.tangent.y * along + event.axis.y * side,
            event.normal.z * radial + event.tangent.z * along + event.axis.z * side);
        }
      }
      positions.needsUpdate = true;
    }
  }

  dispose() {
    for (const { mesh } of this.pool) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}
