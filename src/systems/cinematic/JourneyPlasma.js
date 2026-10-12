import * as THREE from "three";

export const PLASMA_MAX_ALPHA = 0.68;
export const PLASMA_PEAK_TIME = 3.5;
export const PLASMA_END_TIME = 4.5;
function ease(start, end, time) {
  const x = THREE.MathUtils.clamp((time - start) / (end - start), 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}
export function plasmaEnvelope(time) {
  if (!Number.isFinite(time) || time <= 2 || time >= 6.5) return 0;
  if (time < PLASMA_PEAK_TIME) return ease(2, PLASMA_PEAK_TIME, time);
  if (time < 3.8) return 1;
  return 1 - ease(3.8, PLASMA_END_TIME, time);
}
export function cloudEnvelope(time) {
  if (!Number.isFinite(time) || time <= 4.5 || time >= 6.5) return 0;
  return ease(4.5, 4.85, time) * (1 - ease(6.05, 6.5, time));
}
const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // A visual screen plane only; it neither reads nor writes camera transforms.
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;
const FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uProgress;
  uniform float uAspect;
  uniform float uCloudIntensity;
  uniform float uCloudAvailable;
  uniform sampler2D uCloudMap;
  uniform vec3 uSunDirection;
  varying vec2 vUv;
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float turbulence(vec2 p) {
    // Fixed three-octave budget, no textures and no animated resource creation.
    return 0.57 * noise(p) + 0.28 * noise(p * 2.03 + 11.7)
      + 0.15 * noise(p * 4.07 - 8.3);
  }
  void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
    if (uCloudIntensity > 0.0) {
      // Three projected cloud banks: denser foreground, recessed canyon, no raymarch.
      vec3 light = normalize(mat3(viewMatrix) * uSunDirection);
      vec3 accumulated = vec3(0.0);
      float coverage = 0.0;
      float travel = max(0.0, uTime - 4.5);
      for (int i = 0; i < 3; i++) {
        float layer = float(i);
        float zoom = 1.0 + travel * (0.18 + layer * 0.28);
        vec2 sheet = p / zoom;
        vec2 drift = vec2(-0.08 - layer * 0.12, 0.30 + layer * 0.52) * travel;
        vec2 coords = sheet * (0.10 + layer * 0.025) + vec2(0.19 + layer * 0.27, 0.43) - drift;
        vec2 distortion = vec2(noise(sheet * 3.0 + vec2(layer * 7.1, -travel * 1.4)),
          noise(sheet * 5.1 + vec2(13.8, layer * 3.7 - travel * 0.9))) - 0.5;
        coords += distortion * vec2(0.018, 0.009);
        float density;
        float shaded;
        if (uCloudAvailable > 0.5) {
          // Use mid-latitude weather, avoiding the texture's polar bands.
          // Fade the repeated latitude seam instead of showing a hard stripe.
          vec2 tiled = fract(coords);
          float seam = smoothstep(0.0, 0.07, tiled.y) * (1.0 - smoothstep(0.93, 1.0, tiled.y));
          vec2 mapUv = vec2(tiled.x, 0.22 + tiled.y * 0.56);
          density = texture2D(uCloudMap, mapUv).r * seam;
          shaded = texture2D(uCloudMap, mapUv + light.xy * 0.006).r * seam;
        } else {
          density = turbulence(sheet * (3.0 + layer * 1.6) - drift * 3.0 + layer * 11.3);
          shaded = density * 0.83;
        }
        // Unequal banks open a winding corridor; weather breaks their silhouettes.
        float bankNoise = noise(sheet * vec2(4.1, 2.7) - drift * 1.7 + layer * 9.2);
        float corridor = -0.055 + 0.08 * sin(sheet.y * 3.8 + layer * 1.9 + travel * 0.6);
        float sideDistance = abs(sheet.x - corridor);
        float bank = smoothstep(0.08 + bankNoise * 0.10, 0.34 + bankNoise * 0.16, sideDistance);
        float body = smoothstep(0.10, 0.57, density + bankNoise * 0.18 - 0.09);
        body *= mix(0.12, 1.0, bank);
        float rim = clamp((density - shaded) * 8.0, 0.0, 1.0);
        float litBody = clamp(shaded * 0.75 + bankNoise * 0.20, 0.0, 1.0);
        vec3 cloudColor = mix(vec3(0.055, 0.10, 0.16), vec3(0.26, 0.36, 0.46), litBody);
        cloudColor *= 1.0 - layer * 0.12;
        cloudColor = mix(cloudColor, vec3(0.88, 0.79, 0.60), rim * 0.28);
        float alphaLayer = body * (0.32 + layer * 0.14) * uCloudIntensity;
        accumulated = cloudColor * alphaLayer + accumulated * (1.0 - alphaLayer);
        coverage = alphaLayer + coverage * (1.0 - alphaLayer);
      }
      gl_FragColor = vec4(accumulated / max(coverage, 0.00001), min(coverage, 0.68));
      #include <colorspace_fragment>
      #include <premultiplied_alpha_fragment>
      return;
    }
    // Advected, domain-warped eddies replace uniform diagonal ribbon axes.
    // The central Earth window stays open; each side has an independent field.
    float heatingTime = max(0.0, uTime - 2.0);
    float flowTime = uTime * 2.7 + uProgress * 4.6 + heatingTime * heatingTime * 1.35;
    vec2 advected = vec2(p.x * 3.4, p.y * 2.6 - flowTime);
    vec2 eddy = vec2(turbulence(advected + vec2(8.7, 2.1)),
      turbulence(advected * 0.73 + vec2(-4.2, flowTime * 0.28))) - 0.5;
    vec2 warped = advected + eddy * 2.6;
    float broad = noise(warped * 1.35);
    float detail = turbulence(warped * vec2(2.9, 1.7) + eddy.yx * 1.8);
    // Independent slow/fast fields give fragments varied lifetimes and scale.
    float lifetime = noise(advected * 0.61 + vec2(19.3, -uTime * 0.45));
    float fragments = smoothstep(0.30, 0.73, broad * 0.50 + detail * 0.65);
    fragments *= smoothstep(0.19, 0.63, lifetime);
    float side = smoothstep(0.18 + eddy.x * 0.055, 0.45, abs(uv.x - 0.5));
    float upper = smoothstep(0.32, 0.50, uv.y - 0.5) * (0.14 + broad * 0.25);
    float opening = smoothstep(0.27, 0.40,
      length((uv - vec2(0.5, 0.46)) * vec2(1.0, 0.95)));
    float support = max(side, upper) * opening;
    if (support < 0.015 || uIntensity <= 0.0) discard;
    // Local heating varies independently across the sheath; no uniform flash.
    float ignition = noise(vec2(p.x * 4.7 + uTime * .31, uTime * 2.1 + broad * 1.9));
    float flare = .58 + .58 * smoothstep(.25, .78, ignition);
    float density = clamp((0.07 + broad * 0.16 + fragments * 1.15) * support * flare, 0.0, 1.0);
    float alpha = min(${PLASMA_MAX_ALPHA.toFixed(2)}, density * uIntensity * ${PLASMA_MAX_ALPHA.toFixed(2)});
    vec3 color = mix(vec3(0.82, 0.16, 0.025), vec3(1.0, 0.46, 0.075), fragments);
    float hot = smoothstep(0.68, 0.95, fragments) * smoothstep(0.55, 0.85, detail);
    color = mix(color, vec3(1.0, 0.78, 0.43), hot * 0.48);
    color = mix(color, vec3(0.09, 0.27, 0.43), (1.0 - fragments) * broad * 0.07);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
    #include <premultiplied_alpha_fragment>
  }
`;

/** Journey-owned visual mesh using the existing scene passes and journey clock. */
export class JourneyPlasma {
  constructor(target, { screenClouds = true } = {}) {
    this.screenClouds = screenClouds;
    this.disposed = false;
    this.intensity = 0;
    this.cloudIntensity = 0;
    this.bufferSize = new THREE.Vector2(1, 1);
    this.sourceUniforms = target?.material?.uniforms;
    this.uniforms = {
      uTime: { value: 0 }, uIntensity: { value: 0 },
      uProgress: { value: 0 }, uAspect: { value: 1 },
      uCloudIntensity: { value: 0 }, uCloudAvailable: { value: 0 },
      uCloudMap: { value: null }, uSunDirection: { value: new THREE.Vector3(-1, 0.3, 0).normalize() },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      transparent: true, premultipliedAlpha: true, blending: THREE.AdditiveBlending,
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.mesh.name = "Journey3Plasma";
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1000;
    this.mesh.layers.set(0); // Existing main camera only; no selective bloom layer.
    this.mesh.onBeforeRender = (renderer) => {
      renderer.getDrawingBufferSize?.(this.bufferSize);
      this.uniforms.uAspect.value = this.bufferSize.x / Math.max(1, this.bufferSize.y);
    };
    let root = target;
    while (root?.parent) root = root.parent;
    root?.add(this.mesh);
  }

  update(time, descentProgress) {
    if (this.disposed) return;
    if (Number.isFinite(time) && time >= 6.5) { this.dispose(); return; }
    this.intensity = plasmaEnvelope(time);
    this.cloudIntensity = this.screenClouds ? cloudEnvelope(time) : 0;
    this.mesh.visible = this.intensity > 0 || this.cloudIntensity > 0;
    this.mesh.material.blending = this.cloudIntensity > 0 ? THREE.NormalBlending : THREE.AdditiveBlending;
    const map = this.sourceUniforms?.cloudMap?.value;
    this.uniforms.uCloudMap.value = map ?? null;
    this.uniforms.uCloudAvailable.value = map?.image?.width > 1 ? 1 : 0;
    if (this.sourceUniforms?.sunDirection) this.uniforms.uSunDirection.value.copy(this.sourceUniforms.sunDirection.value);
    this.uniforms.uCloudIntensity.value = this.cloudIntensity;
    this.uniforms.uTime.value = Number.isFinite(time) ? time : 0;
    this.uniforms.uIntensity.value = this.intensity;
    this.uniforms.uProgress.value = THREE.MathUtils.clamp(Number.isFinite(descentProgress) ? descentProgress : 0, 0, 1);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.intensity = 0;
    this.cloudIntensity = 0;
    this.uniforms.uCloudIntensity.value = 0;
    this.uniforms.uCloudMap.value = null;
    this.sourceUniforms = null;
    this.uniforms.uIntensity.value = 0;
    this.mesh.visible = false;
    this.mesh.removeFromParent();
    this.mesh.onBeforeRender = () => {};
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
