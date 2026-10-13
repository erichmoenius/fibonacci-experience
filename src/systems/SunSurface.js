import * as THREE from "three";

// Artistic S2 tuning of the S1 surface. Scales are cells/noise units per solar radius;
// speeds are procedural-coordinate units/s, independent of axial rotation.
export const SUN_SURFACE = Object.freeze({
  granulationScale: 30,
  evolutionSpeed: 0.24,
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
  // Keep the S1 bounded cellular pass; soften/deform its result below.
  vec2 cells(vec3 p) {
    vec3 base = floor(p), f = fract(p);
    float first = 8.0, second = 8.0;
    for (int z = -1; z <= 1; z++) {
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec3 offset = vec3(float(x), float(y), float(z));
          vec3 r = offset + 0.15 + 0.7 * hash3(base + offset) - f;
          float d = dot(r, r);
          second = min(second, max(first, d));
          first = min(first, d);
        }
      }
    }
    return sqrt(vec2(first, second));
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
    float broad = noise3(n * 5.0 + vec3(t * 0.60, -t * 0.36, t * 0.48));
    vec3 flow = vec3(
      noise3(n * 8.0 + vec3(t, 7.1, 0.0)),
      noise3(n * 8.0 + vec3(4.3, -t * 0.8, 9.2)),
      noise3(n * 8.0 + vec3(8.7, 2.1, t * 0.6))) - 0.5;
    // Spatially varying warp stretches/bends the lattice, giving local cells
    // different sizes and shapes. Steady advection makes audio-OFF flow readable
    // during the short reveal as well as the Waltz, with no random frame seeds.
    vec3 p = n * uGranulationScale + flow * uFlowAmount * 4.0
      + vec3(t * 0.65, -t * 0.40, t * 0.52);
    vec2 cell = cells(p);
    float gap = cell.y - cell.x;
    float aa = max(fwidth(gap), 0.012);
    float interior = smoothstep(-0.035, 0.28 + aa, gap);
    float resolved = 1.0 - smoothstep(0.35, 1.2, length(fwidth(p)));
    interior = mix(0.54, interior, resolved);
    float fine = noise3(p * 2.8 + flow + vec3(0.0, t * 0.45, 0.0));
    fine = mix(0.5, fine, 1.0 - smoothstep(0.3, 1.0, length(fwidth(p * 2.8))));
    // Break the uniformly outlined-cell look with the existing fine noise;
    // cellular structure remains present without dictating every bright patch.
    float convection = mix(interior, fine, 0.32);
    float heat = clamp(0.13 + convection * 0.51 + broad * 0.29 + (fine - 0.5) * 0.18, 0.0, 1.0);
    vec3 color = mix(vec3(0.25, 0.022, 0.003), vec3(0.92, 0.23, 0.018),
                     smoothstep(0.10, 0.56, heat));
    color = mix(color, vec3(1.0, 0.64, 0.16), smoothstep(0.48, 0.95, heat));

    // Slow curved currents; derivatives soften fine bands when viewed far away.
    float phase = n.y * 115.0 + broad * 18.0 + flow.x * 9.0 + uTime * uMagneticSpeed;
    float streak = pow(0.5 + 0.5 * sin(phase), 12.0);
    streak *= 1.0 - smoothstep(0.6, 2.5, fwidth(phase));
    color += vec3(0.10, 0.040, 0.006) * streak * interior;

    // Fixed local directions rotate with the mesh. Irregular boundaries are
    // spatial, not time-random; penumbra and umbra change color only, no craters.
    float irregularity = (noise3(n * 65.0 + 19.4) - 0.5) * 0.42;
    vec2 spots = vec2(0.0);
    spots = max(spots, spot(n, vec3(0.32, 0.18, 1.0), 0.105, irregularity));
    spots = max(spots, spot(n, vec3(0.45, 0.22, 1.0), 0.052, irregularity));
    spots = max(spots, spot(n, vec3(-0.62, -0.27, 0.85), 0.072, irregularity));
    spots = max(spots, spot(n, vec3(0.95, -0.19, -0.35), 0.090, irregularity));
    spots = max(spots, spot(n, vec3(-0.33, 0.31, -1.0), 0.125, irregularity));
    spots = max(spots, spot(n, vec3(-0.45, 0.27, -1.0), 0.045, irregularity));
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
      name: "LivingSunS2",
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
