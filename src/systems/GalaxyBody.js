import * as THREE from "three";

const vertexShader = `
  varying vec2 vDiskPosition;
  varying vec3 vWorldPosition;

  void main() {
    vDiskPosition = position.xz;
    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uOpacity;
  uniform float uPhase;
  varying vec2 vDiskPosition;
  varying vec3 vWorldPosition;

  float hash(vec2 point) {
    return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 point) {
    vec2 cell = floor(point);
    vec2 fraction = fract(point);
    fraction = fraction * fraction * (3.0 - 2.0 * fraction);
    return mix(
      mix(hash(cell), hash(cell + vec2(1.0, 0.0)), fraction.x),
      mix(hash(cell + vec2(0.0, 1.0)), hash(cell + 1.0), fraction.x),
      fraction.y
    );
  }

  void main() {
    float radius = length(vDiskPosition);
    float angle = atan(vDiskPosition.y, vDiskPosition.x);
    float broadNoise = noise(vDiskPosition * 0.13);
    float fineNoise = noise(vDiskPosition * 0.39 + 17.0);

    // Broad warps break the repeated arm spacing without changing arm count.
    float middle = smoothstep(6.0, 13.0, radius)
      * (1.0 - smoothstep(27.0, 35.0, radius));
    float outer = smoothstep(22.0, 33.0, radius);
    float warpScale = 0.28 + 0.50 * middle + 0.38 * outer;
    float radialWarp = (noise(vDiskPosition * 0.075 + vec2(4.0, 11.0)) - 0.5)
      * (0.8 + 1.5 * middle + 1.2 * outer);
    float angularWarp = (noise(vDiskPosition * 0.11 + vec2(-13.0, 3.0)) - 0.5)
      * warpScale;
    float spiral = angle - 2.5 * log(1.0 + max(0.0, radius + radialWarp) / 2.0)
      + angularWarp + uPhase;
    float armShape = 0.5 + 0.5 * cos(4.0 * spiral);
    float armWidth = mix(0.9, 2.3,
      noise(vDiskPosition * 0.12 + vec2(19.0, -4.0)));
    float arms = pow(armShape, armWidth);

    // Cloud-sized gaps and sector variation leave the core comparatively dense.
    float cloudMask = noise(vDiskPosition * 0.105 + vec2(-7.0, 23.0));
    float fragments = smoothstep(0.27, 0.67, cloudMask);
    float sector = noise(vec2(cos(angle), sin(angle)) * 1.35 + vec2(9.0, 5.0));
    float armLight = mix(0.88, mix(0.28, 1.15, fragments),
      min(1.0, 0.15 + 0.65 * middle + 0.72 * outer));
    armLight *= mix(0.86, 1.12, sector);

    float disk = exp(-pow(radius / 27.0, 1.5));
    float center = 0.28 * exp(-radius * radius / 65.0);
    float edge = 1.0 - smoothstep(27.0, 36.0, radius);
    float cloud = 0.68 + 0.50 * broadNoise + 0.24 * fineNoise;
    float density = (disk * (0.19 + 0.86 * arms * armLight) * cloud + center) * edge;

    // Broken dust complexes absorb light instead of painting black bands.
    float laneWarp = (noise(vDiskPosition * 0.12 + vec2(13.0, -7.0)) - 0.5)
      * 0.58;
    float laneWidth = mix(3.0, 11.0,
      noise(vDiskPosition * 0.16 + vec2(-5.0, 19.0)));
    float seam = pow(0.5 + 0.5 * cos(4.0 * (spiral - 0.23 + laneWarp)),
      laneWidth);
    float laneRegion = smoothstep(3.0, 7.0, radius)
      * (1.0 - smoothstep(20.0, 31.0, radius));
    float gaps = smoothstep(0.32, 0.68,
      noise(vDiskPosition * 0.11 + vec2(8.0, -12.0)));
    float laneStrength = 0.88 * mix(0.72, 1.0, sector);
    density *= 1.0 - laneStrength * seam * laneRegion * gaps;

    vec3 warm = vec3(1.0, 0.87, 0.69);
    vec3 rose = vec3(0.84, 0.53, 0.65);
    vec3 violet = vec3(0.62, 0.54, 0.82);
    vec3 blue = vec3(0.48, 0.64, 0.89);
    vec3 color = mix(warm, rose, smoothstep(5.0, 16.0, radius));
    color = mix(color, violet, smoothstep(14.0, 24.0, radius));
    color = mix(color, blue, smoothstep(22.0, 34.0, radius));

    float forming = arms * smoothstep(0.62, 0.84,
      noise(vDiskPosition * 0.19 + vec2(-21.0, 5.0)));
    forming *= smoothstep(7.0, 12.0, radius)
      * (1.0 - smoothstep(22.0, 29.0, radius));
    color = mix(color, vec3(1.0, 0.55, 0.69), 0.33 * forming);
    density *= 1.0 + 0.25 * forming;

    float closeFade = smoothstep(2.5, 9.0,
      length(cameraPosition - vWorldPosition));
    gl_FragColor = vec4(color, uOpacity * density * closeFade);
  }
`;

export class GalaxyBody {
  constructor(parent) {
    this.group = new THREE.Group();
    this.group.name = "GalaxyBody";
    parent.add(this.group);

    this.geometry = new THREE.PlaneGeometry(76, 76);
    this.geometry.rotateX(-Math.PI / 2);
    this.materials = [];

    for (const [height, phase, opacity] of [
      [-0.9, -0.035, 0.12],
      [0, 0, 0.15],
      [0.9, 0.035, 0.12],
    ]) {
      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          uOpacity: { value: opacity },
          uPhase: { value: phase },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const surface = new THREE.Mesh(this.geometry, material);
      surface.position.y = height;
      surface.renderOrder = -1;
      this.group.add(surface);
      this.materials.push(material);
    }
  }

  update(rotationY) {
    this.group.rotation.y = rotationY;
  }

  dispose() {
    this.group.removeFromParent();
    this.geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.group.clear();
  }
}
