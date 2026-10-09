import * as THREE from "three";

export const EARTH_RADIUS = 2;
const TAU = Math.PI * 2;
// RGBA8/sRGB8_ALPHA8 including the complete mip chain. This is an Earth-only
// budget, not a measurement of available VRAM (WebGL cannot expose that).
export function textureBytes(width, height) {
  let bytes = 0;
  while (true) {
    bytes += width * height * 4;
    if (width === 1 && height === 1) return bytes;
    width = Math.max(1, Math.floor(width / 2));
    height = Math.max(1, Math.floor(height / 2));
  }
}
export const EARTH_TEXTURE_BUDGET = 400 * 1024 * 1024;
export const EARTH_STANDARD_BYTES = textureBytes(4096, 2048) * 5;
export const EARTH_HIGH_BYTES = textureBytes(4096, 2048) * 4 + textureBytes(8192, 4096);
export function supportsHighSurface(capabilities, budget = EARTH_TEXTURE_BUDGET) {
  return capabilities?.maxTextureSize >= 8192
    && EARTH_HIGH_BYTES + textureBytes(4096, 2048) <= budget;
}
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
    // Integrate a short exponential-density path inside the existing shell.
    // Planet intersection truncates the ray: no atmosphere through solid Earth.
    vec3 ray = normalize(vPosition - cameraPosition);
    vec3 origin = cameraPosition - earthCenter;
    float b = dot(origin, ray);
    float outerRadius = ${EARTH_RADIUS.toFixed(1)} * 1.018;
    float outerD = b * b - dot(origin, origin) + outerRadius * outerRadius;
    float outerRoot = sqrt(max(outerD, 0.0));
    float nearT = max(0.0, -b - outerRoot);
    float farT = -b + outerRoot;
    float groundD = b * b - dot(origin, origin) + ${EARTH_RADIUS.toFixed(1)} * ${EARTH_RADIUS.toFixed(1)};
    if (groundD > 0.0) {
      float groundT = -b - sqrt(groundD);
      if (groundT > 0.0) farT = min(farT, groundT);
    }
    float stepLength = max(0.0, farT - nearT) / 6.0;
    float opticalDepth = 0.0;
    for (int i = 0; i < 6; i++) {
      vec3 samplePosition = origin + ray * (nearT + (float(i) + 0.5) * stepLength);
      float height = max(0.0, length(samplePosition) / ${EARTH_RADIUS.toFixed(1)} - 1.0);
      // Density reaches zero smoothly at the outer boundary, hiding shell edges.
      float density = max(0.0, exp(-height / 0.003) - exp(-0.018 / 0.003));
      float solarAltitude = dot(normalize(samplePosition), normalize(sunDirection));
      float illumination = smoothstep(-0.10, 0.18, solarAltitude);
      opticalDepth += density * illumination * stepLength / ${EARTH_RADIUS.toFixed(1)};
    }
    float phase = 0.75 * (1.0 + pow(dot(ray, normalize(sunDirection)), 2.0));
    float alpha = 1.0 - exp(-opticalDepth * phase * 2.8);
    alpha *= smoothstep(${EARTH_RADIUS.toFixed(1)}, 2.08, length(origin));
    gl_FragColor = vec4(vec3(0.20, 0.38, 0.62), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// One loader and reference-counted local maps across the synchronous theme handoff.
// A microtask grace period transfers GPU texture ownership without a reload;
// leaving Earth entirely releases every map. Injected loaders stay isolated.
const sharedLoader = new THREE.TextureLoader();
const sharedMaps = new Map();
const configuredMaps = new WeakSet();
function acquireMap(loader, url) {
  const shared = loader === sharedLoader;
  let entry = shared ? sharedMaps.get(url) : null;
  if (!entry) {
    entry = { references: 1, texture: null, settled: false };
    if (shared) sharedMaps.set(url, entry);
    entry.ready = new Promise((resolve) => {
      const finish = (texture) => {
        entry.texture = texture;
        entry.settled = true;
        resolve(texture);
        if (!entry.references) retire();
      };
      // Promise callbacks run after the lease has acquired its reference.
      try { loader.load(url, texture => finish(texture), undefined, () => finish(null)); }
      catch { finish(null); }
    });
  } else entry.references++;
  function retire() {
    const release = () => {
      if (entry.references || !entry.settled) return;
      if (shared && sharedMaps.get(url) === entry) sharedMaps.delete(url);
      entry.texture?.dispose();
      entry.texture = null;
    };
    if (shared) queueMicrotask(release); else release();
  }
  let released = false;
  return { ready: entry.ready, release() {
    if (released) return;
    released = true;
    entry.references--;
    retire();
  } };
}

/** Shared Earth visual infrastructure; motion remains owned by each theme. */
export class EarthGlobe {
  constructor(container, { loader = sharedLoader, tilt = -23.44, initialRotation = 4.9, sunPosition = null } = {}) {
    this.disposed = false;
    this.loader = loader;
    this.sunPosition = sunPosition;
    this.sunWorldPosition = new THREE.Vector3();
    this.leases = new Set();
    this.textureLeases = new Map();
    this.surfaceDetail = "standard";
    this.effectiveSurfaceDetail = "standard";
    this.detailStatus = "Standard (4K)";
    this.detailRequest = 0;
    this.detailLoading = null;
    this.rendererReady = new Promise((resolve) => { this.resolveRenderer = resolve; });
    this.textures = new Set();
    this.loadErrors = [];
    this.group = new THREE.Group();
    this.group.name = "OurWorldEarth";
    // Reveal the complete composition together, avoiding a patchwork of maps
    // arriving over several frames. Failed maps still have neutral fallbacks.
    this.group.visible = false;
    this.group.rotation.z = THREE.MathUtils.degToRad(tilt);
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
    this.surface.rotation.y = this.clouds.rotation.y = initialRotation;
    this.clouds.renderOrder = 1;
    this.atmosphere.renderOrder = 2;
    this.group.add(this.surface, this.clouds, this.atmosphere);
    // Camera and capability information arrives through the existing renderer.
    // No extra scene lights are needed by these directional solar shaders.
    this.surface.onBeforeRender = (renderer) => {
      this.renderer = renderer;
      this.resolveRenderer(renderer);
      const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      for (const texture of this.textures) {
        if (texture.anisotropy !== anisotropy) {
          texture.anisotropy = anisotropy;
          texture.needsUpdate = true;
        }
      }
      this.syncLighting();
    };
    this.ready = Promise.all(Object.keys(defaults).map((name) => {
      const extension = name === "normal" || name === "ocean" ? "png" : "jpg";
      const lease = acquireMap(loader, `${import.meta.env?.BASE_URL ?? "/"}textures/earth/${name}-4k.${extension}`);
      this.leases.add(lease);
      return lease.ready.then((texture) => {
        if (this.disposed) return false;
        if (!texture) {
          this.leases.delete(lease);
          lease.release();
          this.loadErrors.push(name);
          console.warn(`Earth: ${name} texture unavailable; neutral fallback retained.`);
          return false;
        }
        if (!configuredMaps.has(texture)) {
          texture.colorSpace = name === "day" || name === "night" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.needsUpdate = true;
          configuredMaps.add(texture);
        }
        const uniform = this.uniforms[name === "clouds" ? "cloudMap" : `${name}Map`];
        this.releaseTexture(uniform.value);
        uniform.value = texture;
        this.textures.add(texture);
        this.textureLeases.set(texture, lease);
        return true;
      });
    }));
    this.ready.then(() => { if (!this.disposed) this.group.visible = true; });
  }

  // Serialize downloads, retain the active map until replacement succeeds, and
  // dispose superseded/late results. Neither meshes nor shader programs change.
  async setSurfaceDetail(detail) {
    if (this.disposed || !["standard", "high"].includes(detail)) return false;
    this.surfaceDetail = detail;
    const request = ++this.detailRequest;
    this.detailStatus = detail === "high" ? "Checking High (8K)…" : "Loading Standard (4K)…";
    await this.ready;
    if (this.detailLoading) await this.detailLoading;
    if (this.disposed || request !== this.detailRequest) return false;
    if (this.effectiveSurfaceDetail === detail) {
      this.detailStatus = detail === "high" ? "High (8K)" : "Standard (4K)";
      return true;
    }
    const renderer = detail === "high" ? await this.rendererReady : this.renderer;
    if (this.disposed || request !== this.detailRequest) return false;
    if (detail === "high" && !supportsHighSurface(renderer?.capabilities)) {
      this.surfaceDetail = "standard";
      this.detailStatus = "Standard (4K): High unavailable";
      return false;
    }
    this.detailStatus = detail === "high" ? "Loading High (8K)…" : "Loading Standard (4K)…";
    const load = new Promise((resolve) => {
      const fail = (reason) => {
        if (!this.disposed && request === this.detailRequest) {
          this.surfaceDetail = this.effectiveSurfaceDetail;
          this.detailStatus = `${this.effectiveSurfaceDetail === "high" ? "High (8K)" : "Standard (4K)"}: ${reason}`;
          console.warn(`OUR WORLD: ${reason}; current surface retained.`);
        }
        resolve(false);
      };
      const lease = acquireMap(this.loader, `${import.meta.env?.BASE_URL ?? "/"}textures/earth/day-${detail === "high" ? "8k" : "4k"}.jpg`);
      this.leases.add(lease);
      const abandon = () => { this.leases.delete(lease); lease.release(); };
      lease.ready.then((texture) => {
        if (this.disposed || request !== this.detailRequest) { abandon(); resolve(false); return; }
        if (!texture) { abandon(); fail("Surface download failed"); return; }
        const width = detail === "high" ? 8192 : 4096;
        if (texture.image?.width !== width || texture.image?.height !== width / 2) {
          abandon(); fail("Unexpected surface dimensions"); return;
        }
        if (!configuredMaps.has(texture)) {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.generateMipmaps = true;
          texture.needsUpdate = true;
          configuredMaps.add(texture);
        }
        const anisotropy = Math.min(8, renderer?.capabilities.getMaxAnisotropy() ?? 1);
        if (texture.anisotropy !== anisotropy) {
          texture.anisotropy = anisotropy;
          texture.needsUpdate = true;
        }
        try {
          renderer?.initTexture(texture);
        } catch {
          abandon(); fail("Surface upload failed"); return;
        }
        const old = this.uniforms.dayMap.value;
        this.uniforms.dayMap.value = texture;
        this.textures.add(texture);
        this.textureLeases.set(texture, lease);
        this.releaseTexture(old);
        this.effectiveSurfaceDetail = detail;
        this.detailStatus = detail === "high" ? "High (8K)" : "Standard (4K)";
        resolve(true);
      });
    });
    this.detailLoading = load;
    const result = await load;
    if (this.detailLoading === load) this.detailLoading = null;
    return result;
  }

  releaseTexture(texture) {
    const lease = this.textureLeases.get(texture);
    if (lease) { this.leases.delete(lease); lease.release(); }
    else texture.dispose();
    this.textureLeases.delete(texture);
    this.textures.delete(texture);
  }

  syncLighting() {
    this.getWorldCenter(this.uniforms.earthCenter.value);
    if (this.sunPosition) {
      this.sunPosition(this.sunWorldPosition);
      this.uniforms.sunDirection.value.copy(this.sunWorldPosition)
        .sub(this.uniforms.earthCenter.value).normalize();
    }
    this.uniforms.cloudOffset.value = (this.clouds.rotation.y - this.surface.rotation.y) / TAU;
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
    ++this.detailRequest;
    this.resolveRenderer(null);
    this.renderer = null;
    this.group.removeFromParent();
    for (const mesh of [this.surface, this.clouds, this.atmosphere]) {
      mesh.onBeforeRender = () => {};
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    for (const texture of this.textures) this.releaseTexture(texture);
    for (const lease of this.leases) lease.release();
    this.leases.clear();
  }
}
