import * as THREE from "three";

// Journey 2 experiment only. Set enabled=false to return to the H1 tunnel.
export const JOURNEY2_FRACTAL = {
  enabled: true,
  duration: 5.7,
  softness: 1.6,
  irregularity: 0.7,
  zoomOctaves: 22,
  acceleration: 3.4,
  recursion: 6,
  intensity: 2.5,
  streakStrength: 0.65,
  spiralTwist: 1.7,
  goldMix: 0.12,
};

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
const fragmentShader = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime, uAspect, uZoom, uAcceleration, uRecursion;
  uniform float uIntensity, uStreaks, uTwist, uGold;
  uniform float uDuration, uSoftness, uIrregularity;
  const float PI = 3.14159265359;
  const float PHI = 1.61803398875;
  const float GOLDEN_ANGLE = 2.39996322973;

  // Derivative-width filtering bounds the finest structures at pixel scale.
  float filament(float field, float width) {
    float aa = max(fwidth(field), 0.001);
    float distance = abs(field);
    float core = 1.0 - smoothstep(width * 0.35, width + aa, distance);
    float glow = exp(-distance / max(width * uSoftness * 3.0 + aa, 0.001));
    return core * 0.25 + glow * 0.55;
  }
  void main() {
    float progress = clamp(uTime / uDuration, 0.0, 1.0);
    float takeover = smoothstep(0.04, 0.35, uTime);
    float collapse = smoothstep(uDuration - 0.7, uDuration, uTime);
    vec2 p = (vUv * 2.0 - 1.0) * vec2(uAspect, 1.0);
    float radius = max(length(p), 0.002);
    float angle = atan(p.y, p.x);
    float flight = uZoom * pow(progress, uAcceleration);
    vec3 cyan = vec3(0.07, 0.85, 1.0);
    vec3 violet = vec3(0.48, 0.08, 1.0);
    vec3 gold = vec3(1.0, 0.62, 0.12);
    vec3 light = vec3(0.0);
    // Staggered perspective slices: births stay in the vanishing point, while
    // near structures grow beyond both landscape and portrait screen edges.
    // Each slice has independent spacing, eccentricity and branch illumination.
    for (int i = 0; i < 7; i++) {
      if (float(i) >= uRecursion) break;
      float level = float(i);
      float seed = level * GOLDEN_ANGLE;
      float passage = flight * (0.16 + 0.018 * mod(level, 3.0)) + level * 0.61803398875;
      float generation = floor(passage);
      float depth = fract(passage);
      float identity = seed + generation * GOLDEN_ANGLE;
      float spacing = 6.0 + 0.35 * sin(identity * 1.7);
      float projectedRadius = 0.035 * exp(depth * spacing);
      vec2 offset = vec2(sin(identity * 1.3), cos(identity * 1.9)) * 0.07 * projectedRadius;
      vec2 q = (p - offset) / projectedRadius;
      float orientation = seed * 0.3 + depth * 0.18 * uTwist;
      q = mat2(cos(orientation), -sin(orientation), sin(orientation), cos(orientation)) * q;
      q *= vec2(1.0 + 0.16 * sin(identity), 1.0 + 0.13 * cos(identity * 1.4));
      float localRadius = max(length(q), 0.002);
      float theta = atan(q.y, q.x);
      float warp = (0.16 + uIrregularity * 0.12) * sin(theta * 3.0 + identity)
        + (0.07 + uIrregularity * 0.08) * sin(theta * 7.0 - identity * 1.3)
        + uIrregularity * 0.08 * sin(theta * 2.0 + localRadius * 4.0 + depth * 2.0);
      float nearWeight = smoothstep(0.35, 0.9, depth);
      float arc = smoothstep(-0.55, 0.45, sin(theta * 3.0 + identity));
      float ring = filament(localRadius - 1.0 + warp, 0.018 + 0.025 * nearWeight) * arc;
      // Nested spiral forks live on the individual passing slices, not a global grid.
      float branchPhase = theta * (5.0 + mod(level, 3.0) * 3.0)
        - log(localRadius) * uTwist * PHI + identity;
      float branch = filament(sin(branchPhase + warp * 4.0), 0.018);
      float fork = filament(sin(branchPhase * PHI + localRadius * 3.0), 0.022);
      float territory = smoothstep(0.16, 0.4, localRadius)
        * (1.0 - smoothstep(1.1, 1.65, localRadius));
      float illumination = 0.3 + 0.7 * pow(0.5 + 0.5 * sin(theta * 2.0 + identity * 1.7), 2.0);
      float veil = exp(-abs(localRadius - 0.9 + warp) * 4.0) * territory * 0.12;
      float structure = (ring * 1.35 + branch * territory * (0.22 + fork * 0.85) + veil) * illumination;
      float lifetime = smoothstep(0.0, 0.12, depth) * (1.0 - smoothstep(0.88, 1.0, depth));
      vec3 tint = mix(violet, cyan, clamp(0.18 + nearWeight * 0.3 + 0.42 * sin(theta * 2.0 + identity), 0.02, 0.9));
      tint = mix(tint, gold, uGold * pow(0.5 + 0.5 * sin(identity + theta), 4.0));
      // Far is dim/fine violet, middle is detailed, near is thick/bright cyan.
      light += tint * structure * lifetime * (0.25 + nearWeight * 1.8);
    }
    // Negative travel in logarithmic radius gives outward optical flow.
    float flow = log(radius) / log(2.0) - flight;
    float lane = filament(sin(angle * 55.0 + sin(angle * 13.0) * 2.7), 0.014);
    float streakPulse = pow(0.5 + 0.5 * sin(flow * 2.8 + sin(angle * 21.0)), 4.0);
    light += mix(cyan, violet, 0.25) * lane * streakPulse * uStreaks
      * (0.12 + pow(progress, 4.0) * 3.8) * smoothstep(0.1, 0.8, radius);
    // The vanishing point expands past every corner as infinity swallows the view.
    float swallowedRadius = 0.035 + pow(collapse, 2.4) * (length(vec2(uAspect, 1.0)) + 0.4);
    float aperture = smoothstep(swallowedRadius, swallowedRadius + 0.09, radius);
    light *= aperture * uIntensity * (0.4 + takeover * 0.6);
    vec3 color = vec3(0.001, 0.002, 0.008) + 1.0 - exp(-light);
    color *= 1.0 - collapse;
    gl_FragColor = vec4(color, takeover);
    #include <colorspace_fragment>
  }
`;

export class Journey2Fractal {
  constructor(settings = JOURNEY2_FRACTAL) {
    this.settings = settings;
    this.disposed = false;
    this.uniforms = {
      uTime: { value: 0 }, uAspect: { value: 1 },
      uDuration: { value: settings.duration }, uSoftness: { value: settings.softness },
      uIrregularity: { value: settings.irregularity },
      uZoom: { value: settings.zoomOctaves }, uAcceleration: { value: settings.acceleration },
      uRecursion: { value: settings.recursion }, uIntensity: { value: settings.intensity },
      uStreaks: { value: settings.streakStrength }, uTwist: { value: settings.spiralTwist },
      uGold: { value: settings.goldMix },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader, fragmentShader,
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.name = "Journey2FractalOverdose";
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 100;
    const size = new THREE.Vector2();
    this.mesh.onBeforeRender = renderer => {
      renderer.getDrawingBufferSize(size);
      this.uniforms.uAspect.value = size.x / Math.max(size.y, 1);
    };
    this.update(0);
  }

  update(phaseTime) {
    if (this.disposed) return;
    const s = this.settings, u = this.uniforms;
    u.uDuration.value = Math.max(0.5, s.duration);
    u.uTime.value = THREE.MathUtils.clamp(phaseTime, 0, u.uDuration.value);
    u.uSoftness.value = THREE.MathUtils.clamp(s.softness, 0.5, 3);
    u.uIrregularity.value = THREE.MathUtils.clamp(s.irregularity, 0, 1.5);
    u.uZoom.value = THREE.MathUtils.clamp(s.zoomOctaves, 0, 40);
    u.uAcceleration.value = THREE.MathUtils.clamp(s.acceleration, 1, 5);
    u.uRecursion.value = THREE.MathUtils.clamp(s.recursion, 1, 7);
    u.uIntensity.value = THREE.MathUtils.clamp(s.intensity, 0, 8);
    u.uStreaks.value = THREE.MathUtils.clamp(s.streakStrength, 0, 5);
    u.uTwist.value = THREE.MathUtils.clamp(s.spiralTwist, 0, 4);
    u.uGold.value = THREE.MathUtils.clamp(s.goldMix, 0, 0.3);
    this.mesh.visible = s.enabled && phaseTime >= 0.04;
  }

  holdVoid() { this.update(this.settings.duration); } // Static black until the existing BIRTH handoff.

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
