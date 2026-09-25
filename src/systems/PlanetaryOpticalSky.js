import * as THREE from "three";
import { CELESTIAL_DISCOVERIES } from "../config/CelestialDiscoveries.js";
import { PLANETARY_BLOOM_LAYER } from "../config/PlanetarySelectiveBloomConfig.js";

export const PLANETARY_OPTICAL_SKY = Object.freeze({
  generatedStarCount: 7500,
  radius: 50,
  seed: 481516,
  catalogExclusionDegrees: 1.5,
});

const STAR_CLASSES = Object.freeze([
  Object.freeze({ count: 4000, size: [1.4, 2.2], brightness: [1.8, 3.0], kind: "faint" }),
  Object.freeze({ count: 2300, size: [2.0, 3.4], brightness: [3.0, 5.2], kind: "visible" }),
  Object.freeze({ count: 950, size: [3.2, 5.2], brightness: [5.5, 9.0], kind: "bright" }),
  Object.freeze({ count: 250, size: [4.8, 7.5], brightness: [9.0, 16.0], kind: "anchor" }),
]);

const STAR_COLOR_PALETTES = Object.freeze({
  blueWhite: Object.freeze([0xb7d3fa, 0xc0dcff, 0xcbe3ff]),
  neutralWhite: Object.freeze([0xf9faff, 0xffffff, 0xfff8ec]),
  warmGold: Object.freeze([0xffd89b, 0xffdfad, 0xffe7c2]),
  orange: Object.freeze([0xffa85c, 0xffb36b, 0xffbf82]),
  redOrange: Object.freeze([0xd97868, 0xe88870, 0xf09a78]),
});

const BACKGROUND_COLOR_WEIGHTS = Object.freeze({
  blueWhite: 0.132,
  neutralWhite: 0.74,
  warmGold: 0.078,
  orange: 0.035,
  redOrange: 0.015,
});

const STAR_CLUSTERS = Object.freeze([
  Object.freeze({
    id: "clusterA",
    name: "Cool Compact",
    rightAscensionDegrees: 35,
    declinationDegrees: 18,
    extentDegrees: 12,
    axisRatio: 0.62,
    concentration: 1.9,
    outskirts: 0.18,
    phase: 0.7,
    hierarchy: Object.freeze({ faint: 40, visible: 36, bright: 16, anchor: 4 }),
    colors: Object.freeze({
      blueWhite: 0.45,
      neutralWhite: 0.48,
      warmGold: 0.04,
      orange: 0.02,
      redOrange: 0.01,
    }),
    jewelCount: 3,
  }),
  Object.freeze({
    id: "clusterB",
    name: "Neutral Loose",
    rightAscensionDegrees: 155,
    declinationDegrees: -32,
    extentDegrees: 20,
    axisRatio: 0.7,
    concentration: 1.3,
    outskirts: 0.26,
    phase: 2.1,
    hierarchy: Object.freeze({ faint: 65, visible: 40, bright: 12, anchor: 3 }),
    colors: Object.freeze({
      blueWhite: 0.12,
      neutralWhite: 0.78,
      warmGold: 0.06,
      orange: 0.03,
      redOrange: 0.01,
    }),
    jewelCount: 2,
  }),
  Object.freeze({
    id: "clusterC",
    name: "Warm Small",
    rightAscensionDegrees: 285,
    declinationDegrees: 38,
    extentDegrees: 9,
    axisRatio: 0.58,
    concentration: 1.7,
    outskirts: 0.2,
    phase: 4.4,
    hierarchy: Object.freeze({ faint: 28, visible: 22, bright: 8, anchor: 2 }),
    colors: Object.freeze({
      blueWhite: 0.04,
      neutralWhite: 0.35,
      warmGold: 0.36,
      orange: 0.18,
      redOrange: 0.07,
    }),
    jewelCount: 2,
  }),
]);

const BACKGROUND_JEWEL_COUNT = 35;
const GENERATED_SPARKLE_COUNT = 84;
const SPARKLING_JEWEL_COUNT = 18;
const CATALOG_SPARKLE_COUNT = 3;

function catalogDirection(star, target) {
  const rightAscension = THREE.MathUtils.degToRad(star.rightAscensionDegrees);
  const declination = THREE.MathUtils.degToRad(star.declinationDegrees);
  const horizontal = Math.cos(declination);
  return target.set(
    horizontal * Math.cos(rightAscension),
    Math.sin(declination),
    -horizontal * Math.sin(rightAscension),
  );
}

export class PlanetaryOpticalSky {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = "PlanetaryOpticalSky";
    this.catalogVertexMap = new Map();
    this.colorCounts = {
      blueWhite: 0,
      neutralWhite: 0,
      warmGold: 0,
      orange: 0,
      redOrange: 0,
    };
    this.startedAt = performance.now();

    const { geometry, bloomGeometry } = this.createGeometry();
    this.uniforms = {
      uPixelRatio: { value: 1 },
      uTime: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        uniform float uPixelRatio;
        uniform float uTime;
        attribute float aSize;
        attribute float aBrightness;
        attribute vec3 aStarColor;
        attribute float aPhase;
        attribute float aSpeed;
        attribute float aScintillationAmplitude;
        attribute float aScintillationEligible;
        attribute float aGlintEligible;
        varying float vBrightness;
        varying vec3 vStarColor;
        varying float vScintillation;
        varying float vGlintEligible;

        void main() {
          vBrightness = aBrightness;
          vStarColor = aStarColor;
          vGlintEligible = aGlintEligible;
          float wave = sin(uTime * aSpeed + aPhase) * 0.5
            + sin(uTime * aSpeed * 1.73 + aPhase * 2.31) * 0.3
            + sin(uTime * aSpeed * 2.57 + aPhase * 0.73) * 0.2;
          float elegantPeak = pow(max(wave, 0.0), 3.0);
          float variation = wave * 0.25 + elegantPeak * 0.75;
          vScintillation = 1.0
            + aScintillationEligible * aScintillationAmplitude * variation;
          gl_PointSize = max(1.0, aSize * uPixelRatio);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying float vBrightness;
        varying vec3 vStarColor;
        varying float vScintillation;
        varying float vGlintEligible;

        void main() {
          vec2 offset = gl_PointCoord - 0.5;
          float radiusSquared = dot(offset, offset);
          float radius = sqrt(radiusSquared);
          float aperture = 1.0 - smoothstep(0.43, 0.50, radius);
          float core = 1.0 - smoothstep(0.09, 0.19, radius);
          float innerHalo = exp(-radiusSquared * 26.0);
          float outerHalo = exp(-radiusSquared * 9.0);
          float horizontalGlint = exp(-abs(offset.y) * 96.0) * exp(-abs(offset.x) * 9.0);
          float verticalGlint = exp(-abs(offset.x) * 96.0) * exp(-abs(offset.y) * 9.0);
          float glint = (horizontalGlint + verticalGlint) * 0.22 * vGlintEligible;
          float brightResponse = smoothstep(3.0, 11.0, vBrightness);
          float jewelCoreBoost = 1.0 + vGlintEligible * 0.22;
          float jewelHaloBoost = 1.0 + vGlintEligible * 0.34;
          vec3 coreColor = mix(vStarColor, vec3(1.0), 0.62);
          vec3 coreLight = coreColor * core * (1.8 + vBrightness * 0.55)
            * jewelCoreBoost * vScintillation;
          vec3 innerLight = vStarColor * innerHalo * (0.9 + vBrightness * 0.65)
            * jewelHaloBoost * mix(1.0, vScintillation, 0.55);
          vec3 outerLight = vStarColor * outerHalo * brightResponse
            * (0.25 + vBrightness * 0.075);
          vec3 glintLight = vStarColor * glint * brightResponse
            * (0.55 + vBrightness * 0.1) * mix(1.0, vScintillation, 0.35);
          vec3 light = (coreLight + innerLight + outerLight + glintLight) * aperture;
          // AdditiveBlending normally multiplies RGB by source alpha. Keep alpha
          // fully open because the radial aperture is already applied to RGB.
          gl_FragColor = vec4(light, 1.0);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.name = "PlanetaryOpticalStars";
    this.group.add(this.points);

    const bloomMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        uniform float uPixelRatio;
        attribute float aSize;
        attribute vec3 aStarColor;
        attribute float aBurst;
        varying vec3 vStarColor;
        varying float vBurst;

        void main() {
          vStarColor = aStarColor;
          vBurst = aBurst;
          gl_PointSize = max(1.0, aSize * uPixelRatio);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec3 vStarColor;
        varying float vBurst;

        void main() {
          vec2 offset = gl_PointCoord - 0.5;
          float radiusSquared = dot(offset, offset);
          float aperture = 1.0 - smoothstep(0.4, 0.5, sqrt(radiusSquared));
          if (aperture <= 0.0001) discard;
          float core = exp(-radiusSquared * 92.0);
          float halo = exp(-radiusSquared * 18.0);
          float horizontal = exp(-abs(offset.y) * 120.0) * exp(-abs(offset.x) * 8.0);
          float vertical = exp(-abs(offset.x) * 120.0) * exp(-abs(offset.y) * 8.0);
          float burst = (horizontal + vertical) * vBurst * 0.42;
          vec3 color = mix(vStarColor, vec3(1.0), 0.5);
          vec3 light = color * (core * 4.8 + halo * 1.6 + burst * 2.4) * aperture;
          gl_FragColor = vec4(light, 1.0);
          #include <colorspace_fragment>
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.bloomPoints = new THREE.Points(bloomGeometry, bloomMaterial);
    this.bloomPoints.name = "PlanetaryJewelBloom";
    this.bloomPoints.layers.set(PLANETARY_BLOOM_LAYER);
    this.group.add(this.bloomPoints);
  }

  createGeometry() {
    const positions = [];
    const sizes = [];
    const brightnesses = [];
    const colors = [];
    const phases = [];
    const speeds = [];
    const scintillationAmplitudes = [];
    const scintillationEligibility = [];
    const glintEligibility = [];
    const catalogStars = (CELESTIAL_DISCOVERIES.planetary ?? [])
      .flatMap((discovery) => discovery.stars.map((star) => ({ discovery, star })));
    const catalogDirections = catalogStars.map(({ star }) =>
      catalogDirection(star, new THREE.Vector3()));
    const exclusionDot = Math.cos(
      THREE.MathUtils.degToRad(PLANETARY_OPTICAL_SKY.catalogExclusionDegrees),
    );
    const direction = new THREE.Vector3();
    const clusterCenter = new THREE.Vector3();
    const clusterTangent = new THREE.Vector3();
    const clusterBitangent = new THREE.Vector3();
    const referenceAxis = new THREE.Vector3();
    const color = new THREE.Color();
    const anchorCandidates = {
      background: [],
      clusterA: [],
      clusterB: [],
      clusterC: [],
    };
    const sparkleCandidates = {
      background: [],
      clusterA: [],
      clusterB: [],
      clusterC: [],
    };
    const catalogSparkleCandidates = [];
    this.clusterVertexIndices = { clusterA: [], clusterB: [], clusterC: [] };
    let seed = PLANETARY_OPTICAL_SKY.seed;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    const randomRange = ([minimum, maximum]) =>
      THREE.MathUtils.lerp(minimum, maximum, random());

    const pushStar = ({ size, brightness, starColor, phase, speed, amplitude, eligible, glint }) => {
      const vertexIndex = sizes.length;
      positions.push(
        direction.x * PLANETARY_OPTICAL_SKY.radius,
        direction.y * PLANETARY_OPTICAL_SKY.radius,
        direction.z * PLANETARY_OPTICAL_SKY.radius,
      );
      sizes.push(size);
      brightnesses.push(brightness);
      color.setHex(starColor);
      colors.push(color.r, color.g, color.b);
      phases.push(phase);
      speeds.push(speed);
      scintillationAmplitudes.push(amplitude);
      scintillationEligibility.push(eligible);
      glintEligibility.push(glint);
      return vertexIndex;
    };

    const chooseStarColor = (weights) => {
      const tint = random();
      const neutralLimit = weights.blueWhite + weights.neutralWhite;
      const warmLimit = neutralLimit + weights.warmGold;
      const orangeLimit = warmLimit + weights.orange;
      const colorKind = tint < weights.blueWhite
        ? "blueWhite"
        : tint < neutralLimit
          ? "neutralWhite"
          : tint < warmLimit ? "warmGold" : tint < orangeLimit ? "orange" : "redOrange";
      const palette = STAR_COLOR_PALETTES[colorKind];
      this.colorCounts[colorKind]++;
      return palette[Math.min(palette.length - 1, Math.floor(random() * palette.length))];
    };

    const emitGeneratedStar = (starClass, colorWeights, bucket = "background") => {
      const opticallyEligible = starClass.kind === "bright" || starClass.kind === "anchor";
      const size = randomRange(starClass.size);
      const brightness = randomRange(starClass.brightness);
      const starColor = chooseStarColor(colorWeights);
      const phase = random() * Math.PI * 2;
      const speed = THREE.MathUtils.lerp(0.35, 1.8, random());
      const dormantAmplitude = opticallyEligible
        ? THREE.MathUtils.lerp(0.005, 0.025, random())
        : 0;
      const vertexIndex = pushStar({
        size,
        brightness,
        starColor,
        phase,
        speed,
        amplitude: dormantAmplitude,
        eligible: 0,
        glint: 0,
      });
      if (starClass.kind === "anchor") {
        anchorCandidates[bucket].push({ vertexIndex, brightness });
      }
      if (opticallyEligible) {
        sparkleCandidates[bucket].push({ vertexIndex, brightness });
      }
      if (bucket !== "background") {
        this.clusterVertexIndices[bucket].push(vertexIndex);
      }
    };

    const isOutsideCatalogExclusion = () =>
      !catalogDirections.some((catalog) => direction.dot(catalog) > exclusionDot);

    const placeClusterDirection = (cluster) => {
      catalogDirection(cluster, clusterCenter);
      referenceAxis.set(Math.abs(clusterCenter.y) < 0.92 ? 0 : 1, Math.abs(clusterCenter.y) < 0.92 ? 1 : 0, 0);
      clusterTangent.crossVectors(referenceAxis, clusterCenter).normalize();
      clusterBitangent.crossVectors(clusterCenter, clusterTangent).normalize();

      const isOutskirts = random() < cluster.outskirts;
      const radialFraction = isOutskirts
        ? THREE.MathUtils.lerp(0.58, 1, random())
        : Math.pow(random(), cluster.concentration);
      const angle = random() * Math.PI * 2;
      const irregularity = 1
        + Math.sin(angle * 3 + cluster.phase) * 0.14
        + Math.sin(angle * 5 - cluster.phase) * 0.07;
      const extent = THREE.MathUtils.degToRad(cluster.extentDegrees);
      const x = extent * radialFraction * irregularity * Math.cos(angle)
        + extent * 0.06 * radialFraction * radialFraction;
      const y = extent * radialFraction * cluster.axisRatio
        * (1 + Math.sin(angle * 2 + cluster.phase) * 0.12) * Math.sin(angle);
      direction.copy(clusterCenter)
        .addScaledVector(clusterTangent, Math.tan(x))
        .addScaledVector(clusterBitangent, Math.tan(y))
        .normalize();
    };

    const clusteredCounts = Object.fromEntries(STAR_CLASSES.map((starClass) => [
      starClass.kind,
      STAR_CLUSTERS.reduce((total, cluster) => total + cluster.hierarchy[starClass.kind], 0),
    ]));

    for (const starClass of STAR_CLASSES) {
      const backgroundCount = starClass.count - clusteredCounts[starClass.kind];
      for (let i = 0; i < backgroundCount;) {
        const y = 1 - 2 * random();
        const azimuth = Math.PI * 2 * random();
        const horizontal = Math.sqrt(1 - y * y);
        direction.set(
          horizontal * Math.cos(azimuth),
          y,
          horizontal * Math.sin(azimuth),
        );
        if (!isOutsideCatalogExclusion()) {
          continue;
        }
        emitGeneratedStar(starClass, BACKGROUND_COLOR_WEIGHTS);
        i++;
      }
    }

    for (const cluster of STAR_CLUSTERS) {
      for (const starClass of STAR_CLASSES) {
        const memberCount = cluster.hierarchy[starClass.kind];
        for (let i = 0; i < memberCount;) {
          placeClusterDirection(cluster);
          if (!isOutsideCatalogExclusion()) {
            continue;
          }
          emitGeneratedStar(starClass, cluster.colors, cluster.id);
          i++;
        }
      }
    }

    const selectJewels = (bucket, count) => {
      const selected = anchorCandidates[bucket]
        .sort((left, right) => right.brightness - left.brightness)
        .slice(0, count);
      for (const candidate of selected) {
        glintEligibility[candidate.vertexIndex] = 1;
      }
      return selected;
    };
    const jewelsByBucket = {
      background: selectJewels("background", BACKGROUND_JEWEL_COUNT),
    };
    for (const cluster of STAR_CLUSTERS) {
      jewelsByBucket[cluster.id] = selectJewels(cluster.id, cluster.jewelCount);
    }
    const jewelIndices = new Set(Object.values(jewelsByBucket)
      .flatMap((candidates) => candidates.map(({ vertexIndex }) => vertexIndex)));
    this.jewelStarCount = jewelIndices.size;

    const selectedSparkles = new Map();
    const addSparkles = (candidates, count, predicate = () => true) => {
      const selected = candidates
        .filter((candidate) => predicate(candidate) && !selectedSparkles.has(candidate.vertexIndex))
        .sort((left, right) => right.brightness - left.brightness)
        .slice(0, count);
      for (const candidate of selected) {
        selectedSparkles.set(candidate.vertexIndex, candidate);
      }
    };

    for (const cluster of STAR_CLUSTERS) {
      addSparkles(jewelsByBucket[cluster.id], 1);
    }
    addSparkles(jewelsByBucket.background, SPARKLING_JEWEL_COUNT - STAR_CLUSTERS.length);
    for (const cluster of STAR_CLUSTERS) {
      addSparkles(sparkleCandidates[cluster.id], 1, ({ vertexIndex }) => !jewelIndices.has(vertexIndex));
    }
    addSparkles(
      sparkleCandidates.background,
      GENERATED_SPARKLE_COUNT - selectedSparkles.size,
      ({ vertexIndex }) => !jewelIndices.has(vertexIndex),
    );

    const hashFraction = (value) => {
      let hash = Math.imul(value + 1, 0x9e3779b1) >>> 0;
      hash = (hash ^ (hash >>> 16)) >>> 0;
      hash = Math.imul(hash, 0x21f0aaad) >>> 0;
      hash = (hash ^ (hash >>> 15)) >>> 0;
      return hash / 4294967295;
    };
    const enableSparkle = (vertexIndex, jewel) => {
      const strength = hashFraction(vertexIndex);
      scintillationEligibility[vertexIndex] = 1;
      scintillationAmplitudes[vertexIndex] = jewel
        ? THREE.MathUtils.lerp(0.09, 0.16, strength)
        : THREE.MathUtils.lerp(0.035, 0.075, strength);
      speeds[vertexIndex] = THREE.MathUtils.lerp(0.38, 1.1, hashFraction(vertexIndex + 7919));
    };
    for (const { vertexIndex } of selectedSparkles.values()) {
      enableSparkle(vertexIndex, jewelIndices.has(vertexIndex));
    }
    this.generatedSparkleCount = selectedSparkles.size;
    this.sparklingJewelCount = [...selectedSparkles.keys()]
      .filter((vertexIndex) => jewelIndices.has(vertexIndex)).length;

    for (const { discovery, star } of catalogStars) {
      catalogDirection(star, direction);
      const prominence = THREE.MathUtils.clamp(
        (3.4 - star.magnitude) / (3.4 - 1.7),
        0,
        1,
      );
      const vertexIndex = sizes.length;
      pushStar({
        size: THREE.MathUtils.lerp(4.4, 7.0, prominence),
        brightness: THREE.MathUtils.lerp(7.0, 13.0, prominence),
        starColor: 0xe2efff,
        phase: random() * Math.PI * 2,
        speed: THREE.MathUtils.lerp(0.4, 1.35, random()),
        amplitude: THREE.MathUtils.lerp(0.004, 0.018, prominence),
        eligible: 0,
        glint: prominence > 0.93 ? 1 : 0,
      });
      catalogSparkleCandidates.push({ vertexIndex, prominence, name: star.name });
      this.catalogVertexMap.set(star.name, {
        vertexIndex,
        discoveryName: discovery.name,
        star,
      });
    }

    const selectedCatalogSparkles = catalogSparkleCandidates
      .sort((left, right) => right.prominence - left.prominence)
      .slice(0, CATALOG_SPARKLE_COUNT);
    for (const { vertexIndex } of selectedCatalogSparkles) {
      enableSparkle(vertexIndex, glintEligibility[vertexIndex] === 1);
    }
    this.sparklingCatalogNames = selectedCatalogSparkles.map(({ name }) => name);
    this.sparkleStarCount = this.generatedSparkleCount + selectedCatalogSparkles.length;
    this.sparklingJewelCount += selectedCatalogSparkles
      .filter(({ vertexIndex }) => glintEligibility[vertexIndex] === 1).length;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute("aBrightness", new THREE.Float32BufferAttribute(brightnesses, 1));
    geometry.setAttribute("aStarColor", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
    geometry.setAttribute("aSpeed", new THREE.Float32BufferAttribute(speeds, 1));
    geometry.setAttribute(
      "aScintillationAmplitude",
      new THREE.Float32BufferAttribute(scintillationAmplitudes, 1),
    );
    geometry.setAttribute(
      "aScintillationEligible",
      new THREE.Float32BufferAttribute(scintillationEligibility, 1),
    );
    geometry.setAttribute("aGlintEligible", new THREE.Float32BufferAttribute(glintEligibility, 1));
    geometry.computeBoundingSphere();

    const bloomIndices = glintEligibility
      .map((eligible, vertexIndex) => ({ eligible, vertexIndex }))
      .filter(({ eligible }) => eligible === 1)
      .sort((left, right) => brightnesses[right.vertexIndex] - brightnesses[left.vertexIndex]);
    const strongestBloomIndices = new Set(
      bloomIndices.slice(0, 6).map(({ vertexIndex }) => vertexIndex),
    );
    const bloomPositions = [];
    const bloomSizes = [];
    const bloomColors = [];
    const bloomBursts = [];
    for (const { vertexIndex } of bloomIndices) {
      bloomPositions.push(...positions.slice(vertexIndex * 3, vertexIndex * 3 + 3));
      bloomSizes.push(sizes[vertexIndex] * 1.65);
      bloomColors.push(...colors.slice(vertexIndex * 3, vertexIndex * 3 + 3));
      bloomBursts.push(strongestBloomIndices.has(vertexIndex) ? 1 : 0);
    }
    const bloomGeometry = new THREE.BufferGeometry();
    bloomGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(bloomPositions, 3),
    );
    bloomGeometry.setAttribute("aSize", new THREE.Float32BufferAttribute(bloomSizes, 1));
    bloomGeometry.setAttribute(
      "aStarColor",
      new THREE.Float32BufferAttribute(bloomColors, 3),
    );
    bloomGeometry.setAttribute("aBurst", new THREE.Float32BufferAttribute(bloomBursts, 1));
    bloomGeometry.computeBoundingSphere();
    this.bloomStarCount = bloomIndices.length;
    this.burstStarCount = strongestBloomIndices.size;
    this.generatedStarCount = PLANETARY_OPTICAL_SKY.generatedStarCount;
    this.catalogStarCount = catalogStars.length;
    this.totalStarCount = sizes.length;
    return { geometry, bloomGeometry };
  }

  setPixelRatio(pixelRatio) {
    this.uniforms.uPixelRatio.value = pixelRatio;
    this.uniforms.uTime.value = (performance.now() - this.startedAt) * 0.001;
  }

  dispose() {
    this.group.removeFromParent();
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.bloomPoints.geometry.dispose();
    this.bloomPoints.material.dispose();
    this.group.clear();
  }
}
