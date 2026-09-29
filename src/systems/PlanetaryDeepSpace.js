import * as THREE from "three";
import {
  PLANETARY_BLOOM_LAYER,
  PLANETARY_DEEP_SPACE,
} from "../config/PlanetaryDeepSpaceConfig.js";

const REGION_RECIPES = Object.freeze({
  a: Object.freeze({
    palettes: Object.freeze({
      fine: Object.freeze([0x6f7f8d, 0x87929a, 0x617889, 0x6f7f8d, 0x4d91a5]),
      broad: Object.freeze([0x3f566d, 0x4f7f91, 0x3f566d, 0x514e73]),
      medium: Object.freeze([0x3aa7c5, 0x477fc2, 0xb8dbe8, 0x7867a0]),
      compact: Object.freeze([0xb8ddeb, 0x8fc9dc, 0xa69bc1]),
      luminous: Object.freeze([0xe1f4f8, 0xbfeaf2, 0xd8cfe8]),
    }),
    lobes: Object.freeze([
      Object.freeze({ offset: [-0.34, 0.02, -0.16], scale: [0.54, 0.34, 0.48], rotation: [8, 18, -16], weight: 0.31 }),
      Object.freeze({ offset: [0.04, -0.2, 0.12], scale: [0.46, 0.42, 0.56], rotation: [-12, -24, 18], weight: 0.28 }),
      Object.freeze({ offset: [0.38, 0.12, -0.04], scale: [0.4, 0.28, 0.44], rotation: [17, 8, 31], weight: 0.2 }),
      Object.freeze({ offset: [-0.04, 0.34, 0.24], scale: [0.32, 0.22, 0.36], rotation: [-7, 30, -24], weight: 0.13 }),
      Object.freeze({ offset: [0.24, -0.34, -0.28], scale: [0.27, 0.18, 0.3], rotation: [21, -15, 9], weight: 0.08 }),
    ]),
  }),
  b: Object.freeze({
    palettes: Object.freeze({
      fine: Object.freeze([0x6b5552, 0x74524f, 0x654247, 0x6b5552, 0x7b3f46]),
      broad: Object.freeze([0x542733, 0x63303a, 0x542733, 0x71384e]),
      medium: Object.freeze([0x8e3442, 0x86445f, 0x792d38, 0xa65a3e]),
      compact: Object.freeze([0xf0c9b0, 0xd89556, 0xc85b43, 0xd5a2aa]),
      luminous: Object.freeze([0xffe2c6, 0xe6aa63, 0xef8267, 0xe8c8cc]),
    }),
    lobes: Object.freeze([
      Object.freeze({ offset: [-0.3, 0.14, 0.04], scale: [0.5, 0.3, 0.54], rotation: [24, -8, 34], weight: 0.4 }),
      Object.freeze({ offset: [0.22, -0.18, -0.2], scale: [0.4, 0.42, 0.34], rotation: [-18, 29, -12], weight: 0.31 }),
      Object.freeze({ offset: [0.12, 0.34, 0.24], scale: [0.3, 0.2, 0.38], rotation: [6, -32, 21], weight: 0.18 }),
      Object.freeze({ offset: [0.42, 0.02, 0.18], scale: [0.22, 0.16, 0.28], rotation: [-9, 18, -31], weight: 0.11 }),
    ]),
  }),
});

const DUST_CLASSES = Object.freeze({
  near: Object.freeze({ extent: [85, 55, 95], size: [0.75, 1.45], brightness: [0.34, 0.8], sizeCap: 2.2 }),
  mid: Object.freeze({ extent: [150, 95, 165], size: [0.6, 1.15], brightness: [0.22, 0.58], sizeCap: 1.75 }),
  far: Object.freeze({ extent: [245, 150, 260], size: [0.45, 0.9], brightness: [0.16, 0.42], sizeCap: 1.35 }),
});

function chooseWeighted(random, entries) {
  const selection = random();
  let accumulated = 0;
  for (const entry of entries) {
    accumulated += entry.weight;
    if (selection <= accumulated) return entry;
  }
  return entries[entries.length - 1];
}

function makeNebulaMaterial(intensity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uVisibility: { value: PLANETARY_DEEP_SPACE.nebula.visible },
      uIntensity: { value: intensity },
      uOpacity: { value: PLANETARY_DEEP_SPACE.nebula.particleOpacity },
      uSizeScale: { value: PLANETARY_DEEP_SPACE.nebula.sizeScale },
    },
    vertexShader: `
      uniform float uPixelRatio;
      uniform float uSizeScale;
      attribute float aSize;
      attribute float aBrightness;
      attribute float aSoftness;
      attribute float aPhase;
      attribute vec3 aColor;
      varying float vBrightness;
      varying float vSoftness;
      varying float vPhase;
      varying vec3 vColor;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float perspectiveScale = 125.0 / max(30.0, -viewPosition.z);
        gl_PointSize = clamp(aSize * uSizeScale * uPixelRatio * perspectiveScale, 1.0, 80.0 * uPixelRatio);
        gl_Position = projectionMatrix * viewPosition;
        vBrightness = aBrightness;
        vSoftness = aSoftness;
        vPhase = aPhase;
        vColor = aColor;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uVisibility;
      uniform float uIntensity;
      uniform float uOpacity;
      varying float vBrightness;
      varying float vSoftness;
      varying float vPhase;
      varying vec3 vColor;

      void main() {
        vec2 offset = gl_PointCoord - 0.5;
        float angle = atan(offset.y, offset.x);
        float edgeWarp = 1.0
          + sin(angle * 3.0 + vPhase) * 0.16
          + sin(angle * 5.0 - vPhase * 1.7) * 0.1;
        float radiusSquared = dot(offset, offset) * edgeWarp;
        float aperture = 1.0 - smoothstep(0.18, 0.5, sqrt(radiusSquared));
        if (aperture <= 0.0001) discard;
        float compact = exp(-radiusSquared * 22.0);
        float diffuse = exp(-radiusSquared * 4.2);
        float internalVariation = 0.76
          + sin((offset.x + vPhase) * 13.0) * sin((offset.y - vPhase) * 11.0) * 0.24;
        float profile = mix(compact, diffuse * 0.72 * internalVariation, vSoftness);
        float knot = compact * (1.0 - vSoftness) * 0.32;
        float contribution = aperture * uOpacity * uVisibility;
        float luminance = dot(vColor, vec3(0.2126, 0.7152, 0.0722));
        float desaturation = vSoftness * vSoftness * 0.3;
        vec3 cloudColor = mix(vColor, vec3(luminance), desaturation);
        vec3 light = cloudColor * vBrightness * uIntensity * (profile + knot) * contribution;
        gl_FragColor = vec4(light, 0.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    toneMapped: false,
  });
}

function makeDustMaterial(intensity, sizeCap) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uOpacity: { value: PLANETARY_DEEP_SPACE.dust.opacity },
      uIntensity: { value: intensity },
      uSizeCap: { value: sizeCap },
    },
    vertexShader: `
      uniform float uPixelRatio;
      uniform float uSizeCap;
      attribute float aSize;
      attribute float aBrightness;
      attribute vec3 aColor;
      varying float vBrightness;
      varying vec3 vColor;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(aSize * uPixelRatio, 1.0, uSizeCap * uPixelRatio);
        gl_Position = projectionMatrix * viewPosition;
        vBrightness = aBrightness;
        vColor = aColor;
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform float uOpacity;
      uniform float uIntensity;
      varying float vBrightness;
      varying vec3 vColor;

      void main() {
        float radius = length(gl_PointCoord - 0.5);
        float aperture = 1.0 - smoothstep(0.12, 0.48, radius);
        if (aperture <= 0.0001) discard;
        float core = 1.0 - smoothstep(0.04, 0.2, radius);
        vec3 light = vColor * vBrightness * uIntensity * (core + aperture * 0.28);
        gl_FragColor = vec4(light, aperture * uOpacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function makeHighlightMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    },
    vertexShader: `
      uniform float uPixelRatio;
      attribute float aSize;
      attribute vec3 aColor;
      varying vec3 vColor;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        float perspectiveScale = 120.0 / max(30.0, -viewPosition.z);
        gl_PointSize = clamp(aSize * uPixelRatio * perspectiveScale, 2.0, 14.0 * uPixelRatio);
        gl_Position = projectionMatrix * viewPosition;
        vColor = aColor;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vColor;

      void main() {
        vec2 offset = gl_PointCoord - 0.5;
        float radiusSquared = dot(offset, offset);
        if (radiusSquared > 0.24) discard;
        float core = exp(-radiusSquared * 70.0);
        float halo = exp(-radiusSquared * 16.0);
        gl_FragColor = vec4(vColor * (core * 6.0 + halo * 2.1), 1.0);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

export class PlanetaryDeepSpace {
  constructor(parent) {
    this.group = new THREE.Group();
    this.group.name = "PlanetaryDeepSpace";
    this.resources = [];
    this.nebulae = [];
    this.dustLayers = [];
    this.regionInfo = {};

    let seed = PLANETARY_DEEP_SPACE.seed;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    const normal = () => Math.sqrt(-2 * Math.log(Math.max(random(), 1e-7)))
      * Math.cos(Math.PI * 2 * random());

    const highlightPositions = [];
    const highlightSizes = [];
    const highlightColors = [];
    for (const regionId of ["a", "b"]) {
      const region = PLANETARY_DEEP_SPACE.nebula.regions[regionId];
      const recipe = REGION_RECIPES[regionId];
      const generated = this.createNebulaGeometry(region, recipe, random, normal);
      const intensity = regionId === "a"
        ? PLANETARY_DEEP_SPACE.nebula.intensityA
        : PLANETARY_DEEP_SPACE.nebula.intensityB;
      const material = makeNebulaMaterial(intensity);
      const points = new THREE.Points(generated.geometry, material);
      points.name = `PlanetaryNebula${regionId.toUpperCase()}`;
      this.group.add(points);
      this.nebulae.push(points);
      this.resources.push(generated.geometry, material);
      this.regionInfo[regionId] = {
        center: [...region.center],
        dimensions: [...region.dimensions],
        particleCount: region.particleCount,
        highlightCount: region.highlightCount,
      };
      for (const candidate of generated.highlights) {
        highlightPositions.push(...candidate.position);
        highlightSizes.push(candidate.size);
        highlightColors.push(...candidate.color);
      }
    }

    const highlightGeometry = new THREE.BufferGeometry();
    highlightGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(highlightPositions, 3),
    );
    highlightGeometry.setAttribute(
      "aSize",
      new THREE.Float32BufferAttribute(highlightSizes, 1),
    );
    highlightGeometry.setAttribute(
      "aColor",
      new THREE.Float32BufferAttribute(highlightColors, 3),
    );
    const highlightMaterial = makeHighlightMaterial();
    this.highlights = new THREE.Points(highlightGeometry, highlightMaterial);
    this.highlights.name = "PlanetaryNebulaBloomHighlights";
    this.highlights.layers.set(PLANETARY_BLOOM_LAYER);
    this.group.add(this.highlights);
    this.resources.push(highlightGeometry, highlightMaterial);

    this.dustCounts = { ...PLANETARY_DEEP_SPACE.dust.counts };
    for (const depthClass of ["near", "mid", "far"]) {
      const geometry = this.createDustGeometry(depthClass, random);
      const style = DUST_CLASSES[depthClass];
      const intensity = PLANETARY_DEEP_SPACE.dust[`${depthClass}Intensity`];
      const material = makeDustMaterial(intensity, style.sizeCap);
      const points = new THREE.Points(geometry, material);
      points.name = `PlanetaryDust${depthClass[0].toUpperCase()}${depthClass.slice(1)}`;
      this.group.add(points);
      this.dustLayers.push(points);
      this.resources.push(geometry, material);
    }

    this.drawCallCount = 6;
    parent.add(this.group);
  }

  createNebulaGeometry(region, recipe, random, normal) {
    const positions = [];
    const sizes = [];
    const brightnesses = [];
    const softnesses = [];
    const phases = [];
    const colors = [];
    const candidates = [];
    const center = new THREE.Vector3().fromArray(region.center);
    const dimensions = new THREE.Vector3().fromArray(region.dimensions);
    const local = new THREE.Vector3();
    const position = new THREE.Vector3();
    const lobeCenter = new THREE.Vector3();
    const rotation = new THREE.Euler();
    const color = new THREE.Color();

    while (positions.length / 3 < region.particleCount) {
      const lobe = chooseWeighted(random, recipe.lobes);
      const x = normal() / 2.15;
      const y = normal() / 2.15;
      const z = normal() / 2.15;
      if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) > 1.65) continue;
      const firstCavity = ((x + 0.22) / 0.38) ** 2
        + ((y - 0.06) / 0.3) ** 2
        + ((z + 0.14) / 0.44) ** 2;
      const secondCavity = ((x - 0.46) / 0.28) ** 2
        + ((y + 0.22) / 0.22) ** 2
        + ((z - 0.2) / 0.34) ** 2;
      const brokenLane = Math.abs(
        y - 0.17 * Math.sin(x * 4.8 + z * 2.6) - 0.06 * Math.sin(z * 8.1),
      );
      const densityWave = Math.sin(x * 7.3 + z * 3.1)
        * Math.cos(y * 8.7 - z * 4.2);
      const edgeRadius = x * x / 1.35 + y * y / 1.05 + z * z / 1.45;
      const erodedEdge = edgeRadius > 0.82 && random() < 0.28 + Math.max(0, edgeRadius - 0.82) * 0.48;
      const asymmetricBreak = x + y * 0.34 - z * 0.18 > 0.86 && random() < 0.74;
      if (
        (firstCavity < 1 && random() < 0.94)
        || (secondCavity < 1 && random() < 0.88)
        || (brokenLane < 0.12 && random() < 0.86)
        || (densityWave < -0.58 && random() < 0.76)
        || erodedEdge
        || asymmetricBreak
      ) {
        continue;
      }

      local.set(
        x * dimensions.x * lobe.scale[0],
        y * dimensions.y * lobe.scale[1],
        z * dimensions.z * lobe.scale[2],
      );
      rotation.set(
        THREE.MathUtils.degToRad(lobe.rotation[0]),
        THREE.MathUtils.degToRad(lobe.rotation[1]),
        THREE.MathUtils.degToRad(lobe.rotation[2]),
      );
      lobeCenter.set(
        lobe.offset[0] * dimensions.x,
        lobe.offset[1] * dimensions.y,
        lobe.offset[2] * dimensions.z,
      );
      position.copy(local).applyEuler(rotation).add(lobeCenter).add(center);
      const population = random();
      let size;
      let brightness;
      let softness;
      let tier;
      if (population < 0.4) {
        tier = "fine";
        size = THREE.MathUtils.lerp(0.75, 2, random());
        brightness = THREE.MathUtils.lerp(0.035, 0.09, random());
        softness = THREE.MathUtils.lerp(0, 0.12, random());
      } else if (population < 0.52) {
        tier = "broad";
        size = THREE.MathUtils.lerp(24, 52, random());
        brightness = THREE.MathUtils.lerp(0.13, 0.3, random());
        softness = THREE.MathUtils.lerp(0.92, 1, random());
      } else if (population < 0.85) {
        tier = "medium";
        size = THREE.MathUtils.lerp(8, 20, random());
        brightness = THREE.MathUtils.lerp(0.18, 0.44, random());
        softness = THREE.MathUtils.lerp(0.62, 0.88, random());
      } else if (population < 0.98) {
        tier = "compact";
        size = THREE.MathUtils.lerp(3, 8, random());
        brightness = THREE.MathUtils.lerp(0.32, 0.68, random());
        softness = THREE.MathUtils.lerp(0.14, 0.34, random());
      } else {
        tier = "luminous";
        size = THREE.MathUtils.lerp(4, 9, random());
        brightness = THREE.MathUtils.lerp(0.7, 1.2, random());
        softness = THREE.MathUtils.lerp(0.08, 0.24, random());
      }
      const palette = recipe.palettes[tier];
      color.setHex(palette[Math.floor(random() * palette.length)]);
      positions.push(position.x, position.y, position.z);
      sizes.push(size);
      brightnesses.push(brightness);
      softnesses.push(softness);
      phases.push(random() * Math.PI * 2);
      colors.push(color.r, color.g, color.b);
      if (population >= 0.85) {
        candidates.push({
          score: brightness * (1 - softness * 0.5),
          position: [position.x, position.y, position.z],
          size: THREE.MathUtils.lerp(4, 6.8, random()),
          color: [color.r, color.g, color.b],
        });
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute("aBrightness", new THREE.Float32BufferAttribute(brightnesses, 1));
    geometry.setAttribute("aSoftness", new THREE.Float32BufferAttribute(softnesses, 1));
    geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
    geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    candidates.sort((left, right) => right.score - left.score);
    return { geometry, highlights: candidates.slice(0, region.highlightCount) };
  }

  createDustGeometry(depthClass, random) {
    const style = DUST_CLASSES[depthClass];
    const count = PLANETARY_DEEP_SPACE.dust.counts[depthClass];
    const positions = [];
    const sizes = [];
    const brightnesses = [];
    const colors = [];
    const color = new THREE.Color();

    while (positions.length / 3 < count) {
      const x = random() * 2 - 1;
      const y = random() * 2 - 1;
      const z = random() * 2 - 1;
      if (x * x + y * y + z * z > 1 || random() < 0.08) continue;
      positions.push(x * style.extent[0], y * style.extent[1], z * style.extent[2]);
      sizes.push(THREE.MathUtils.lerp(style.size[0], style.size[1], random()));
      brightnesses.push(THREE.MathUtils.lerp(style.brightness[0], style.brightness[1], random()));
      const tint = random();
      color.setHex(tint < 0.67 ? 0xd8e3f0 : tint < 0.95 ? 0x9fb2c9 : 0xe6c7a2);
      colors.push(color.r, color.g, color.b);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute("aBrightness", new THREE.Float32BufferAttribute(brightnesses, 1));
    geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    return geometry;
  }

  dispose() {
    this.group.removeFromParent();
    for (const resource of this.resources) resource.dispose();
    this.group.clear();
  }
}
