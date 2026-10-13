import * as THREE from "three";

// S3: broad advected plasma that remains readable at normal Waltz distance.
// Scales are noise units per solar radius;
// speeds are procedural-coordinate units/s, independent of axial rotation.
export const SUN_SURFACE = Object.freeze({
  granulationScale: 9,
  evolutionSpeed: 0.38,
  flowAmount: 0.72,
  magneticSpeed: 0.12,
  brightness: 1.05,
  limbDarkening: 0.28,
});

const VERTEX = /* glsl */ `
  varying vec3 vLocalPosition;
  varying vec3 vViewPosition;
  varying vec3 vViewNormal;
  void main() {
    vLocalPosition = position;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    vViewNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform float uTime, uGranulationScale, uEvolutionSpeed, uFlowAmount;
  uniform float uMagneticSpeed, uBrightness, uLimbDarkening;
  varying vec3 vLocalPosition;
  varying vec3 vViewPosition;
  varying vec3 vViewNormal;

  // Deterministic spatial hashes: no frame-random seed or UV seams/poles.
  vec3 hash3(vec3 p) {
    p = fract(p * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yxz + 33.33);
    return fract((p.xxy + p.yxx) * p.zyx);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i).x, hash3(i + vec3(1,0,0)).x, f.x),
                   mix(hash3(i + vec3(0,1,0)).x, hash3(i + vec3(1,1,0)).x, f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)).x, hash3(i + vec3(1,0,1)).x, f.x),
                   mix(hash3(i + vec3(0,1,1)).x, hash3(i + vec3(1,1,1)).x, f.x), f.y), f.z);
  }
  vec2 spot(vec3 n, vec3 center, float radius, float irregularity) {
    float d = length(n - normalize(center)) / radius;
    d *= 1.0 + irregularity;
    return vec2(1.0 - smoothstep(0.62, 1.30, d),
                1.0 - smoothstep(0.30, 0.62, d));
  }
  void main() {
    vec3 n = normalize(vLocalPosition);
    float t = uTime * uEvolutionSpeed;
    // Transport a coherent field across the sphere instead of recoloring small
    // outlined cells. No modulo clock, UV seams or frame-random seeds.
    float angle = t * 0.26;
    float c = cos(angle), s = sin(angle);
    vec3 advected = vec3(c * n.x - s * n.z, n.y, s * n.x + c * n.z);
    float broad = noise3(advected * 3.0 + vec3(t * 0.10, -t * 0.06, t * 0.08));
    vec3 flow = vec3(
      noise3(advected * 4.0 + vec3(t * 0.18, 7.1, 0.0)),
      noise3(advected * 4.0 + vec3(4.3, -t * 0.14, 9.2)),
      noise3(advected * 4.0 + vec3(8.7, 2.1, t * 0.12))) - 0.5;
    vec3 p = advected * uGranulationScale + flow * uFlowAmount * 2.4;
    float body = noise3(p);
    float eddies = noise3(p * 2.07 + flow * 0.75);
    eddies = mix(0.5, eddies, 1.0 - smoothstep(0.35, 1.2, length(fwidth(p * 2.07))));
    float fine = noise3(p * 4.1 + flow);
    fine = mix(0.5, fine, 1.0 - smoothstep(0.3, 1.0, length(fwidth(p * 4.1))));
    float convection = smoothstep(0.22, 0.76, body * 0.64 + eddies * 0.27 + broad * 0.09);
    float heat = clamp(0.13 + convection * 0.51 + broad * 0.29 + (fine - 0.5) * 0.12, 0.0, 1.0);

    vec3 color = mix(vec3(0.25, 0.022, 0.003), vec3(0.92, 0.23, 0.018),
                     smoothstep(0.10, 0.56, heat));
    color = mix(color, vec3(1.0, 0.64, 0.16), smoothstep(0.48, 0.95, heat));

    // Slow curved currents; derivatives soften fine bands when viewed far away.
    float phase = p.y * 2.0 + body * 7.0 + flow.x * 5.0 + uTime * uMagneticSpeed;
    float streak = pow(0.5 + 0.5 * sin(phase), 6.0);
    streak *= 1.0 - smoothstep(0.6, 2.5, fwidth(phase));
    color += vec3(0.10, 0.040, 0.006) * streak * convection;

    // Preserve anchored spot centers with gentle plasma flow at their boundaries.
    // Penumbra/umbra remain color-only: no displacement or crater geometry.
    float irregularity = (noise3(n * 32.0 + flow * 1.3 + vec3(t * 0.15, 19.4, 0.0)) - 0.5) * 0.34;
    vec3 spotN = normalize(n + flow * 0.018);
    vec2 spots = vec2(0.0);
    spots = max(spots, spot(spotN, vec3(0.32, 0.18, 1.0), 0.105, irregularity));
    spots = max(spots, spot(spotN, vec3(0.45, 0.22, 1.0), 0.052, irregularity));
    spots = max(spots, spot(spotN, vec3(-0.62, -0.27, 0.85), 0.072, irregularity));
    spots = max(spots, spot(spotN, vec3(0.95, -0.19, -0.35), 0.090, irregularity));
    spots = max(spots, spot(spotN, vec3(-0.33, 0.31, -1.0), 0.125, irregularity));
    spots = max(spots, spot(spotN, vec3(-0.45, 0.27, -1.0), 0.045, irregularity));
    color *= 1.0 - spots.x * 0.56;
    color = mix(color, vec3(0.035, 0.006, 0.002), spots.y * 0.94);

    float mu = max(dot(normalize(vViewNormal), normalize(-vViewPosition)), 0.0);
    float limb = 1.0 - uLimbDarkening * (1.0 - pow(mu, 0.65));
    // A restrained warm rim joins the unchanged additive corona without
    // bleaching the photosphere. All colors above are linear-light values.
    color = color * limb + vec3(0.10, 0.022, 0.002) * pow(1.0 - mu, 4.0);
    gl_FragColor = vec4(color * uBrightness, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export class SunSurface extends THREE.ShaderMaterial {
  constructor() {
    super({
      name: "LivingSunS3",
      uniforms: {
        uTime: { value: 0 },
        uGranulationScale: { value: SUN_SURFACE.granulationScale },
        uEvolutionSpeed: { value: SUN_SURFACE.evolutionSpeed },
        uFlowAmount: { value: SUN_SURFACE.flowAmount },
        uMagneticSpeed: { value: SUN_SURFACE.magneticSpeed },
        uBrightness: { value: SUN_SURFACE.brightness },
        uLimbDarkening: { value: SUN_SURFACE.limbDarkening },
        // Reserved interface only: S1 deliberately has no audio modulation.
        uAudio: { value: new THREE.Vector4(0, 0, 0, 0) }, // bass, mid, high, energy
        uKick: { value: 0 },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });
  }

  update(delta) {
    if (Number.isFinite(delta) && delta > 0) this.uniforms.uTime.value += delta;
  }

  // Future AudioManager adapter; omitted channels reset to zero (audio OFF).
  // No provider dependency, per-frame allocations, or current visual mapping.
  setAudioInputs(inputs = {}) {
    const unit = (v) => Number.isFinite(v) ? THREE.MathUtils.clamp(v, 0, 1) : 0;
    this.uniforms.uAudio.value.set(unit(inputs.bass), unit(inputs.mid), unit(inputs.high), unit(inputs.energy));
    this.uniforms.uKick.value = unit(inputs.kick);
  }
}
