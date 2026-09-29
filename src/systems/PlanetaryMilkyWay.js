import * as THREE from "three";
import { PLANETARY_BLOOM_LAYER } from "../config/PlanetaryDeepSpaceConfig.js";

export const PLANETARY_MILKY_WAY = Object.freeze({
  seed: 734921,
  referenceDistance: 100,
  bloomSeedCount: 24,
  populations: Object.freeze({
    micro: 9000,
    visible: 1800,
    embedded: 200,
    diffuse: 700,
  }),
});

const DEPTH_REGIONS = Object.freeze([
  Object.freeze({
    id: "foregroundFringe",
    intensity: 1.18,
    populations: Object.freeze({ micro: 2100, visible: 450, embedded: 50, diffuse: 180 }),
    volumes: Object.freeze([
      Object.freeze({
        center: [-28, 18, -38], scale: [20, 5, 10], rotation: [8, 20, 15], weight: 0.58,
        lanePhase: 0.4,
      }),
      Object.freeze({
        center: [-2, 28, -58], scale: [18, 5, 12], rotation: [-9, -12, -18], weight: 0.42,
        lanePhase: 2.1,
      }),
    ]),
  }),
  Object.freeze({
    id: "middleConcentration",
    intensity: 1,
    populations: Object.freeze({ micro: 3900, visible: 800, embedded: 100, diffuse: 320 }),
    volumes: Object.freeze([
      Object.freeze({
        center: [-48, 22, -88], scale: [30, 8, 16], rotation: [7, 17, 12], weight: 0.42,
        lanePhase: 1.2,
      }),
      Object.freeze({
        center: [-15, 34, -105], scale: [26, 7, 18], rotation: [-12, -15, -20], weight: 0.34,
        lanePhase: 3.6,
      }),
      Object.freeze({
        center: [-70, -2, -112], scale: [22, 6, 15], rotation: [14, 24, 18], weight: 0.24,
        lanePhase: 5.1,
      }),
    ]),
  }),
  Object.freeze({
    id: "deepConcentration",
    intensity: 0.72,
    populations: Object.freeze({ micro: 3000, visible: 550, embedded: 50, diffuse: 200 }),
    volumes: Object.freeze([
      Object.freeze({
        center: [-65, 16, -155], scale: [38, 10, 22], rotation: [5, 12, 10], weight: 0.45,
        lanePhase: 0.9,
      }),
      Object.freeze({
        center: [-15, 40, -175], scale: [34, 8, 25], rotation: [-10, -18, -17], weight: 0.32,
        lanePhase: 2.8,
      }),
      Object.freeze({
        center: [-105, -12, -180], scale: [30, 7, 22], rotation: [15, 28, 21], weight: 0.23,
        lanePhase: 4.7,
      }),
    ]),
  }),
]);

const POPULATION_STYLES = Object.freeze({
  micro: Object.freeze({
    size: [0.9, 1.55], sizeCap: 2.2, brightness: [0.12, 0.32], softness: 0,
  }),
  visible: Object.freeze({
    size: [1.35, 2.35], sizeCap: 3.4, brightness: [0.28, 0.7], softness: 0,
  }),
  embedded: Object.freeze({
    size: [2.2, 3.8], sizeCap: 5.2, brightness: [0.7, 1.65], softness: 0,
  }),
  diffuse: Object.freeze({
    size: [5.0, 12.0], sizeCap: 8.0, brightness: [0.02, 0.06], softness: 1,
  }),
});

const STAR_PALETTE = Object.freeze([
  Object.freeze({ color: 0xedf3ff, weight: 0.38 }),
  Object.freeze({ color: 0xcbdcff, weight: 0.38 }),
  Object.freeze({ color: 0x9fb5d4, weight: 0.22 }),
  Object.freeze({ color: 0xffe7c7, weight: 0.02 }),
]);

const DIFFUSE_PALETTE = Object.freeze([0x8295b1, 0x9aabc4, 0xb2bfd1]);

function sumPopulation(population) {
  return Object.values(population).reduce((total, count) => total + count, 0);
}

export class PlanetaryMilkyWay {
  constructor(parent) {
    this.group = new THREE.Group();
    this.group.name = "PlanetaryMilkyWay";
    this.resources = [];
    this.regionCounts = Object.fromEntries(DEPTH_REGIONS.map((region) => [
      region.id,
      sumPopulation(region.populations),
    ]));
    this.populationCounts = { ...PLANETARY_MILKY_WAY.populations };

    const { geometry, bloomSeedGeometry } = this.createGeometry();
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: {
          value: Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2),
        },
        uReferenceDistance: { value: PLANETARY_MILKY_WAY.referenceDistance },
      },
      vertexShader: `
        uniform float uPixelRatio;
        uniform float uReferenceDistance;
        attribute float aSize;
        attribute float aSizeCap;
        attribute float aBrightness;
        attribute float aSoftness;
        attribute vec3 aColor;
        varying float vBrightness;
        varying float vSoftness;
        varying vec3 vColor;

        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          float perspectiveScale = uReferenceDistance / max(20.0, -viewPosition.z);
          float rawPointSize = aSize * uPixelRatio * perspectiveScale;
          gl_PointSize = clamp(rawPointSize, 1.0, aSizeCap * uPixelRatio);
          gl_Position = projectionMatrix * viewPosition;
          vBrightness = aBrightness;
          vSoftness = aSoftness;
          vColor = aColor;
        }
      `,
      fragmentShader: `
        precision highp float;
        varying float vBrightness;
        varying float vSoftness;
        varying vec3 vColor;

        void main() {
          vec2 offset = gl_PointCoord - 0.5;
          float radiusSquared = dot(offset, offset);
          float radius = sqrt(radiusSquared);
          float aperture = 1.0 - smoothstep(0.34, 0.47, radius);
          if (aperture <= 0.0001) discard;
          float core = 1.0 - smoothstep(0.04, 0.24, radius);
          float compactHalo = exp(-radiusSquared * 18.0);
          float diffuseHalo = exp(-radiusSquared * 22.0);
          float stellarProfile = core + compactHalo * 0.5;
          float diffuseProfile = diffuseHalo * 0.82;
          float profile = mix(stellarProfile, diffuseProfile, vSoftness);
          vec3 light = vColor * vBrightness * profile * aperture;
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

    this.points = new THREE.Points(geometry, material);
    this.points.name = "PlanetaryMilkyWayParticles";
    this.group.add(this.points);
    const bloomSeedMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: {
          value: Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2),
        },
        uReferenceDistance: { value: PLANETARY_MILKY_WAY.referenceDistance },
      },
      vertexShader: `
        uniform float uPixelRatio;
        uniform float uReferenceDistance;

        void main() {
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          float perspectiveScale = uReferenceDistance / max(20.0, -viewPosition.z);
          gl_PointSize = clamp(1.8 * uPixelRatio * perspectiveScale, 1.0, 2.8 * uPixelRatio);
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        precision highp float;

        void main() {
          vec2 offset = gl_PointCoord - 0.5;
          float radiusSquared = dot(offset, offset);
          if (radiusSquared > 0.09) discard;
          float core = 1.0 - smoothstep(0.015, 0.055, radiusSquared);
          float halo = exp(-radiusSquared * 54.0);
          vec3 light = vec3(0.78, 0.88, 1.0) * (core * 18.0 + halo * 4.0);
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
    this.bloomSeeds = new THREE.Points(bloomSeedGeometry, bloomSeedMaterial);
    this.bloomSeeds.name = "PlanetaryMilkyWayBloomSeeds";
    this.bloomSeeds.layers.set(PLANETARY_BLOOM_LAYER);
    this.group.add(this.bloomSeeds);
    parent.add(this.group);
    this.resources.push(geometry, material, bloomSeedGeometry, bloomSeedMaterial);
  }

  createGeometry() {
    const positions = [];
    const sizes = [];
    const sizeCaps = [];
    const brightnesses = [];
    const softness = [];
    const colors = [];
    const embeddedCandidates = [];
    const color = new THREE.Color();
    const position = new THREE.Vector3();
    const local = new THREE.Vector3();
    const euler = new THREE.Euler();
    const center = new THREE.Vector3();
    let seed = PLANETARY_MILKY_WAY.seed;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    const normal = () => Math.sqrt(-2 * Math.log(Math.max(random(), 1e-7)))
      * Math.cos(Math.PI * 2 * random());
    const randomRange = ([minimum, maximum]) =>
      THREE.MathUtils.lerp(minimum, maximum, random());

    const chooseVolume = (volumes) => {
      const selection = random();
      let accumulated = 0;
      for (const volume of volumes) {
        accumulated += volume.weight;
        if (selection <= accumulated) return volume;
      }
      return volumes[volumes.length - 1];
    };

    const chooseStarColor = () => {
      const selection = random();
      let accumulated = 0;
      for (const entry of STAR_PALETTE) {
        accumulated += entry.weight;
        if (selection <= accumulated) return entry.color;
      }
      return STAR_PALETTE[STAR_PALETTE.length - 1].color;
    };

    const survivesDarkLanes = (volume, x, y, z) => {
      const laneCenter = 0.18 * Math.sin(x * 2.4 + volume.lanePhase)
        + 0.08 * Math.sin(x * 6.2 - volume.lanePhase)
        + z * 0.07;
      const laneWidth = 0.1 + 0.055 * (1 + Math.sin(x * 3.1 + z * 2.7));
      const laneDistance = Math.abs(y - laneCenter);
      if (laneDistance < laneWidth && random() < 0.88) return false;

      const firstVoid = ((x + 0.42) / 0.32) ** 2
        + ((y - 0.2) / 0.24) ** 2
        + ((z + 0.05) / 0.38) ** 2;
      if (firstVoid < 1 && random() < 0.82) return false;
      const secondVoid = ((x - 0.48) / 0.24) ** 2
        + ((y + 0.18) / 0.2) ** 2
        + ((z - 0.22) / 0.3) ** 2;
      return secondVoid >= 1 || random() >= 0.76;
    };

    const samplePosition = (volume) => {
      let normalizedX;
      let normalizedY;
      let normalizedZ;
      do {
        normalizedX = THREE.MathUtils.clamp(normal() / 2.45, -1.25, 1.25);
        normalizedY = THREE.MathUtils.clamp(normal() / 2.45, -1.25, 1.25);
        normalizedZ = THREE.MathUtils.clamp(normal() / 2.45, -1.25, 1.25);
      } while (!survivesDarkLanes(volume, normalizedX, normalizedY, normalizedZ));

      local.set(
        normalizedX * volume.scale[0],
        normalizedY * volume.scale[1],
        normalizedZ * volume.scale[2],
      );
      euler.set(
        THREE.MathUtils.degToRad(volume.rotation[0]),
        THREE.MathUtils.degToRad(volume.rotation[1]),
        THREE.MathUtils.degToRad(volume.rotation[2]),
      );
      center.fromArray(volume.center);
      position.copy(local).applyEuler(euler).add(center);
    };

    const pushParticle = (region, kind) => {
      const volume = chooseVolume(region.volumes);
      const style = POPULATION_STYLES[kind];
      samplePosition(volume);
      positions.push(position.x, position.y, position.z);
      sizes.push(randomRange(style.size));
      sizeCaps.push(style.sizeCap);
      const brightness = randomRange(style.brightness) * region.intensity;
      brightnesses.push(brightness);
      softness.push(style.softness);
      const tint = kind === "diffuse"
        ? DIFFUSE_PALETTE[Math.floor(random() * DIFFUSE_PALETTE.length)]
        : chooseStarColor();
      color.setHex(tint);
      colors.push(color.r, color.g, color.b);
      if (kind === "embedded") {
        embeddedCandidates.push({
          brightness,
          position: [position.x, position.y, position.z],
        });
      }
    };

    for (const region of DEPTH_REGIONS) {
      for (const [kind, count] of Object.entries(region.populations)) {
        for (let i = 0; i < count; i++) pushParticle(region, kind);
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute("aSizeCap", new THREE.Float32BufferAttribute(sizeCaps, 1));
    geometry.setAttribute("aBrightness", new THREE.Float32BufferAttribute(brightnesses, 1));
    geometry.setAttribute("aSoftness", new THREE.Float32BufferAttribute(softness, 1));
    geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    this.totalParticleCount = positions.length / 3;
    this.bounds = geometry.boundingBox;
    embeddedCandidates.sort((first, second) => second.brightness - first.brightness);
    const bloomSeedPositions = embeddedCandidates
      .slice(0, PLANETARY_MILKY_WAY.bloomSeedCount)
      .flatMap((candidate) => candidate.position);
    const bloomSeedGeometry = new THREE.BufferGeometry();
    bloomSeedGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(bloomSeedPositions, 3),
    );
    this.bloomSeedCount = bloomSeedPositions.length / 3;
    return { geometry, bloomSeedGeometry };
  }

  dispose() {
    this.group.removeFromParent();
    for (const resource of this.resources) resource.dispose();
    this.group.clear();
  }
}
