import * as THREE from "three";

export const EARTH_RADIUS = 2;
const TAU = Math.PI * 2;
const VERTEX = /* glsl */ `
  #include <common>
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
  void main() {
    vUv = uv;
    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    // Transform the inverse-transpose view normal back to world space.
    vNormal = inverseTransformDirection(normalMatrix * normal, viewMatrix);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const COMMON = /* glsl */ `
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vPosition;
  varying vec3 vNormal;
`;
const SURFACE = /* glsl */ `
  ${COMMON}
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D normalMap;
  uniform sampler2D oceanMap;
  uniform sampler2D cloudMap;
  uniform float cloudOffset;
  // Cotangent frame from position/UV derivatives: normal detail follows tilt,
  // spin and parent transforms, rather than treating RGB as a world normal.
  vec3 terrainNormal(vec3 N) {
    vec3 q0 = dFdx(vPosition), q1 = dFdy(vPosition);
    vec2 st0 = dFdx(vUv), st1 = dFdy(vUv);
    vec3 p1 = cross(q1, N), p0 = cross(N, q0);
    vec3 T = p1 * st0.x + p0 * st1.x;
    vec3 B = p1 * st0.y + p0 * st1.y;
    float scale = inversesqrt(max(max(dot(T,T), dot(B,B)), 1e-14));
    vec3 detail = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
    detail.xy *= 0.38;
    return normalize(mat3(T * scale, B * scale, N) * normalize(detail));
  }
  void main() {
    vec3 geometricNormal = normalize(vNormal);
    vec3 N = terrainNormal(geometricNormal);
    vec3 L = normalize(sunDirection);
    vec3 V = normalize(cameraPosition - vPosition);
    float solarAltitude = dot(geometricNormal, L);
    float daylight = smoothstep(-0.025, 0.045, solarAltitude);
    float diffuse = max(dot(N, L), 0.0) * daylight;
    // Same UV origin for every surface map; only the weather layer drifts.
    float cloud = texture2D(cloudMap, vec2(vUv.x - cloudOffset, vUv.y)).r;
    float shadow = 1.0 - cloud * 0.28 * daylight;
    vec3 day = texture2D(dayMap, vUv).rgb;
    // Source pack deliberately boosts saturation; gently return toward neutral.
    day = mix(vec3(dot(day, vec3(0.2126, 0.7152, 0.0722))), day, 0.88);
    vec3 color = day * (0.006 + diffuse * 1.18) * shadow;
    float night = 1.0 - smoothstep(-0.16, 0.015, solarAltitude);
    color += texture2D(nightMap, vUv).rgb * night * 1.65 * (1.0 - cloud * 0.72);
    float ocean = texture2D(oceanMap, vUv).r;
    vec3 H = normalize(L + V);
    float fresnel = 0.02 + 0.98 * pow(1.0 - max(dot(V, N), 0.0), 5.0);
    float glint = pow(max(dot(N, H), 0.0), 110.0);
    color += vec3(1.0, 0.97, 0.91) * glint * ocean * fresnel * 3.0 * diffuse * shadow;
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const CLOUDS = /* glsl */ `
  ${COMMON}
  uniform sampler2D cloudMap;
  void main() {
    float density = texture2D(cloudMap, vUv).r;
    float solarAltitude = dot(normalize(vNormal), normalize(sunDirection));
    float light = max(solarAltitude, 0.0);
    vec3 color = vec3(0.91, 0.96, 1.0) * (0.008 + light * 1.12);
    gl_FragColor = vec4(color, smoothstep(0.035, 0.95, density) * 0.92);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const ATMOSPHERE = /* glsl */ `
  ${COMMON}
  uniform vec3 earthCenter;
  void main() {
    // Thin-shell Rayleigh-inspired optical path approximation, not a giant halo.
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vPosition);
    float rim = pow(1.0 - abs(dot(N, V)), 4.5);
    float sunlight = smoothstep(-0.12, 0.4, dot(N, sunDirection));
    float phase = 0.75 * (1.0 + pow(dot(V, sunDirection), 2.0));
    float alpha = rim * sunlight * phase * 0.24;
    // Fade for a camera within the atmosphere instead of filling the screen.
    alpha *= smoothstep(${EARTH_RADIUS.toFixed(1)}, 2.08, distance(cameraPosition, earthCenter));
    gl_FragColor = vec4(vec3(0.17, 0.42, 0.88), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Theme 4 only. Assets are local; no renderer/global-light mutations. */
export class EarthGlobe {
  constructor(container, { loader = new THREE.TextureLoader() } = {}) {
    this.disposed = false;
    this.textures = new Set();
    this.loadErrors = [];
    this.group = new THREE.Group();
    this.group.name = "OurWorldEarth";
    // Reveal the complete composition together, avoiding a patchwork of maps
    // arriving over several frames. Failed maps still have neutral fallbacks.
    this.group.visible = false;
    this.group.rotation.z = THREE.MathUtils.degToRad(-23.44);
    container.add(this.group);
    this.uniforms = {
      sunDirection: { value: new THREE.Vector3(-0.85, 0.35, 0.65).normalize() },
      earthCenter: { value: new THREE.Vector3() },
      cloudOffset: { value: 0 },
    };
    const defaults = { day: [18, 44, 75], night: [0, 0, 0], normal: [128, 128, 255], ocean: [0, 0, 0], clouds: [0, 0, 0] };
    for (const [name, pixel] of Object.entries(defaults)) {
      const texture = new THREE.DataTexture(new Uint8Array([...pixel, 255]), 1, 1);
      texture.colorSpace = name === "day" || name === "night" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      texture.needsUpdate = true;
      this.textures.add(texture);
      this.uniforms[name === "clouds" ? "cloudMap" : `${name}Map`] = { value: texture };
    }
    const material = (fragmentShader, options = {}) => new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERTEX, fragmentShader, ...options,
    });
    this.surface = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 128, 96), material(SURFACE));
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.003, 128, 96), material(CLOUDS, { transparent: true, depthWrite: false }));
    this.atmosphere = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.018, 96, 64), material(ATMOSPHERE, { transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
    this.surface.rotation.y = this.clouds.rotation.y = 4.9;
    this.clouds.renderOrder = 1;
    this.atmosphere.renderOrder = 2;
    this.group.add(this.surface, this.clouds, this.atmosphere);
    // Camera and capability information arrives through the existing renderer.
    // No extra scene lights are needed by these directional solar shaders.
    this.surface.onBeforeRender = (renderer) => {
      const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      for (const texture of this.textures) {
        if (texture.anisotropy !== anisotropy) {
          texture.anisotropy = anisotropy;
          texture.needsUpdate = true;
        }
      }
      this.getWorldCenter(this.uniforms.earthCenter.value);
    };
    this.ready = Promise.all(Object.keys(defaults).map((name) => new Promise((resolve) => {
      const extension = name === "normal" || name === "ocean" ? "png" : "jpg";
      loader.load(`${import.meta.env.BASE_URL}textures/earth/${name}-4k.${extension}`, (texture) => {
        if (this.disposed) { texture.dispose(); resolve(false); return; }
        texture.colorSpace = name === "day" || name === "night" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        const uniform = this.uniforms[name === "clouds" ? "cloudMap" : `${name}Map`];
        this.textures.delete(uniform.value);
        uniform.value.dispose();
        uniform.value = texture;
        this.textures.add(texture);
        resolve(true);
      }, undefined, () => {
        if (!this.disposed) {
          this.loadErrors.push(name);
          console.warn(`OUR WORLD: ${name} texture unavailable; neutral fallback retained.`);
        }
        resolve(false);
      });
    })));
    this.ready.then(() => { if (!this.disposed) this.group.visible = true; });
  }

  getWorldCenter(target) { return this.group.getWorldPosition(target); }

  update(delta) {
    if (this.disposed || !Number.isFinite(delta)) return;
    delta = THREE.MathUtils.clamp(delta, 0, 0.1);
    this.surface.rotation.y = (this.surface.rotation.y + delta * 0.018) % TAU;
    this.clouds.rotation.y = (this.clouds.rotation.y + delta * 0.019) % TAU;
    this.uniforms.cloudOffset.value = (this.clouds.rotation.y - this.surface.rotation.y) / TAU;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.group.removeFromParent();
    for (const mesh of [this.surface, this.clouds, this.atmosphere]) {
      mesh.onBeforeRender = () => {};
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    for (const texture of this.textures) texture.dispose();
    this.textures.clear();
  }
}
