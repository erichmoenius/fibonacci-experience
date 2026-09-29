import {
  PLANETARY_BLOOM_LAYER,
  PLANETARY_SELECTIVE_BLOOM,
} from "./PlanetarySelectiveBloomConfig.js";

export { PLANETARY_BLOOM_LAYER };

export const PLANETARY_DEEP_SPACE = Object.freeze({
  seed: 913579,
  nebula: Object.freeze({
    visible: 1.25,
    intensityA: 1.65,
    intensityB: 1.2,
    particleOpacity: 0.72,
    sizeScale: 1.25,
    regions: Object.freeze({
      a: Object.freeze({
        center: Object.freeze([86, 20, -150]),
        dimensions: Object.freeze([210, 94, 150]),
        particleCount: 1400,
        highlightCount: 4,
      }),
      b: Object.freeze({
        center: Object.freeze([-120, -20, -45]),
        dimensions: Object.freeze([150, 82, 120]),
        particleCount: 650,
        highlightCount: 2,
      }),
    }),
  }),
  dust: Object.freeze({
    opacity: 0.5,
    nearIntensity: 1,
    midIntensity: 0.72,
    farIntensity: 0.48,
    counts: Object.freeze({ near: 160, mid: 500, far: 900 }),
  }),
  bloom: PLANETARY_SELECTIVE_BLOOM,
});
