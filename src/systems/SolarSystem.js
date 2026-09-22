import * as THREE from "three";

// Astronomical periods are data; geometry and simulation time are experience choices.
export const SOLAR_PERIODS = Object.freeze({
  earthOrbitDays: 365.256,
  earthRotationHours: 23.934,
  moonOrbitDays: 27.322,
});

export const SOLAR_DISPLAY = Object.freeze({
  sunRadius: 5,
  earthRadius: 2,
  moonRadius: 0.55,
  earthOrbitRadius: 22,
  moonOrbitRadius: 4.2,
  simulationDaysPerSecond: 1.5,
  // Cinematic axial spin only; scientific periods and orbital timing stay intact.
  visualSelfRotationScale: 0.05,
});

// NASA planetary fact sheet values, rounded to useful precision. The signed
// sidereal rotation period records retrograde rotation independently of tilt.
// Display dimensions are deliberately compressed and remain separate below.
export const PLANETS = Object.freeze([
  { name: "Mercury", radiusKm: 2439.5, orbitMillionKm: 57.9, orbitDays: 87.969, rotationHours: 1407.6, tiltDegrees: 0.034, inclinationDegrees: 7.0, displayRadius: 0.65, displayOrbitRadius: 10, appearance: "rock", phase: 0.9 },
  { name: "Venus", radiusKm: 6052, orbitMillionKm: 108.2, orbitDays: 224.701, rotationHours: -5832.5, tiltDegrees: 177.4, inclinationDegrees: 3.4, displayRadius: 1.7, displayOrbitRadius: 16, appearance: "venus", phase: -0.6 },
  { name: "Earth", radiusKm: 6378, orbitMillionKm: 149.6, orbitDays: SOLAR_PERIODS.earthOrbitDays, rotationHours: SOLAR_PERIODS.earthRotationHours, tiltDegrees: 23.4, inclinationDegrees: 0, displayRadius: SOLAR_DISPLAY.earthRadius, displayOrbitRadius: SOLAR_DISPLAY.earthOrbitRadius, appearance: "earth", phase: 0 },
  { name: "Mars", radiusKm: 3396, orbitMillionKm: 228.0, orbitDays: 686.98, rotationHours: 24.6229, tiltDegrees: 25.2, inclinationDegrees: 1.8, displayRadius: 1.1, displayOrbitRadius: 28, appearance: "mars", phase: -1.5 },
  { name: "Jupiter", radiusKm: 71492, orbitMillionKm: 778.5, orbitDays: 4332.589, rotationHours: 9.925, tiltDegrees: 3.1, inclinationDegrees: 1.3, displayRadius: 4.1, displayOrbitRadius: 37, appearance: "jupiter", phase: -0.75 },
  { name: "Saturn", radiusKm: 60268, orbitMillionKm: 1432.0, orbitDays: 10759.22, rotationHours: 10.656, tiltDegrees: 26.7, inclinationDegrees: 2.5, displayRadius: 3.5, displayOrbitRadius: 45, appearance: "saturn", phase: 0 },
  { name: "Uranus", radiusKm: 25559, orbitMillionKm: 2867.0, orbitDays: 30688.5, rotationHours: -17.24, tiltDegrees: 97.8, inclinationDegrees: 0.8, displayRadius: 2.7, displayOrbitRadius: 51, appearance: "uranus", phase: 2.2 },
  { name: "Neptune", radiusKm: 24764, orbitMillionKm: 4515.0, orbitDays: 60182, rotationHours: 16.11, tiltDegrees: 28.3, inclinationDegrees: 1.8, displayRadius: 2.6, displayOrbitRadius: 57, appearance: "neptune", phase: 2.7 },
]);

const TAU = Math.PI * 2;
const EARTH_TILT = THREE.MathUtils.degToRad(23.4);

function wrapLongitude(value) {
  return Math.atan2(Math.sin(value), Math.cos(value));
}

function landField(lon, lat) {
  // Broad continent masses with a little coast irregularity, not a map asset.
  const masses = [
    [-1.75, 0.74, 0.58, 0.43, 1.0],
    [-1.38, -0.35, 0.34, 0.63, 0.85],
    [0.35, 0.74, 0.93, 0.35, 1.0],
    [0.32, 0.03, 0.43, 0.63, 0.9],
    [1.95, -0.55, 0.37, 0.27, 0.75],
    [-0.72, 1.25, 0.32, 0.24, 0.8],
  ];
  let field = 0;
  for (const [x, y, width, height, weight] of masses) {
    const dx = wrapLongitude(lon - x) / width;
    const dy = (lat - y) / height;
    field = Math.max(field, weight * Math.exp(-1.4 * (dx * dx + dy * dy)));
  }
  return field + 0.065 * Math.sin(17 * lon + 8 * lat) * Math.sin(11 * lat - 5 * lon);
}

function makeTexture(width, height, sample) {
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const lat = Math.PI * (0.5 - (y + 0.5) / height);
    for (let x = 0; x < width; x++) {
      const lon = TAU * ((x + 0.5) / width - 0.5);
      const rgba = sample(lon, lat);
      const index = (y * width + x) * 4;
      pixels.set(rgba, index);
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function earthTexture() {
  return makeTexture(512, 256, (lon, lat) => {
    const detail = Math.sin(23 * lon + 9 * lat) * Math.sin(19 * lat - 3 * lon);
    const land = landField(lon, lat) > 0.31;
    const ice = Math.abs(lat) > 1.36 + 0.08 * Math.sin(lon * 7);
    if (ice) return [222, 235, 234, 255];
    if (land) {
      const dry = Math.sin(5 * lon - 3 * lat) + Math.cos(7 * lat + lon) > 0.45;
      return dry
        ? [119 + 12 * detail, 111 + 10 * detail, 77 + 8 * detail, 255]
        : [56 + 14 * detail, 103 + 17 * detail, 72 + 8 * detail, 255];
    }
    return [12 + 5 * detail, 57 + 8 * detail, 115 + 17 * detail, 255];
  });
}

function cloudTexture() {
  return makeTexture(512, 256, (lon, lat) => {
    const bands = Math.sin(13 * lon + 7 * Math.sin(5 * lat))
      * Math.cos(21 * lat - 4 * lon);
    const swirls = Math.sin(27 * lon - 13 * lat) * Math.cos(9 * lon + 23 * lat);
    const opacity = Math.max(0, bands * 0.58 + swirls * 0.34 - 0.28);
    return [235, 244, 250, Math.min(145, Math.round(opacity * 185))];
  });
}

function moonTexture() {
  return makeTexture(256, 128, (lon, lat) => {
    const terrain = Math.sin(19 * lon + 8 * lat) * Math.sin(29 * lat - 7 * lon);
    const maria = Math.sin(4 * lon - 2 * lat) * Math.cos(5 * lat + lon);
    const grey = Math.round(151 + 18 * terrain - 22 * Math.max(0, maria));
    return [grey, grey - 1, grey - 2, 255];
  });
}

function planetTexture(appearance) {
  return makeTexture(256, 128, (lon, lat) => {
    const grain = Math.sin(19 * lon + 9 * lat) * Math.sin(31 * lat - 7 * lon);
    const broad = Math.sin(5 * lon - 4 * lat) * Math.cos(8 * lat + lon);
    if (appearance === "rock") {
      const shade = Math.round(125 + 22 * grain + 14 * broad);
      return [shade + 8, shade + 4, shade, 255];
    }
    if (appearance === "venus") {
      const cloud = 13 * Math.sin(12 * lat + 3 * Math.sin(5 * lon)) + 8 * broad;
      return [222 + cloud, 202 + cloud, 157 + cloud, 255];
    }
    if (appearance === "mars") {
      const dark = 26 * Math.max(0, broad) + 12 * grain;
      const cap = Math.abs(lat) > 1.39 ? 65 : 0;
      return [184 - dark + cap, 91 - dark * 0.65 + cap, 56 - dark * 0.45 + cap, 255];
    }
    if (appearance === "jupiter") {
      const bands = Math.sin(21 * lat + 0.8 * Math.sin(5 * lon))
        + 0.4 * Math.sin(47 * lat - 2 * lon);
      const spot = Math.exp(-Math.pow(wrapLongitude(lon - 0.8) / 0.3, 2)
        - Math.pow((lat + 0.35) / 0.13, 2));
      return [204 + 16 * bands - 16 * spot, 171 + 22 * bands - 55 * spot, 137 + 21 * bands - 57 * spot, 255];
    }
    if (appearance === "saturn") {
      const bands = Math.sin(18 * lat + 0.4 * Math.sin(4 * lon)) + 0.25 * grain;
      return [218 + 7 * bands, 199 + 10 * bands, 157 + 11 * bands, 255];
    }
    if (appearance === "uranus") {
      const bands = Math.sin(8 * lat + 0.35 * Math.sin(3 * lon));
      return [153 + 8 * bands, 217 + 9 * bands, 218 + 8 * bands, 255];
    }
    const bands = Math.sin(16 * lat + 1.2 * Math.sin(5 * lon)) + 0.25 * grain;
    return [47 + 8 * bands, 86 + 12 * bands, 175 + 19 * bands, 255];
  });
}

function sunTexture() {
  return makeTexture(256, 128, (lon, lat) => {
    const granules = Math.sin(35 * lon + 11 * lat) * Math.cos(27 * lat - 13 * lon);
    const bands = Math.sin(8 * lat + 3 * Math.sin(9 * lon));
    return [255, 218 + 12 * granules + 8 * bands, 130 + 18 * granules + 11 * bands, 255];
  });
}

function coronaTexture() {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const alpha = Math.round(75 * Math.pow(Math.max(0, 1 - radius), 2));
      const index = (y * size + x) * 4;
      pixels.set([255, 191, 105, alpha], index);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export class SolarSystem {
  constructor(container) {
    this.group = new THREE.Group();
    this.group.name = "SolarSystem";
    container.add(this.group);
    this.resources = [];
    const track = (resource) => {
      this.resources.push(resource);
      return resource;
    };
    const sphere = (radius) => track(new THREE.SphereGeometry(radius, 64, 40));

    this.sun = new THREE.Mesh(sphere(SOLAR_DISPLAY.sunRadius), track(
      new THREE.MeshBasicMaterial({ map: track(sunTexture()), color: 0xfff5d8 }),
    ));
    this.sun.name = "Sun";
    this.group.add(this.sun);
    const corona = new THREE.Sprite(track(new THREE.SpriteMaterial({
      map: track(coronaTexture()),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })));
    corona.scale.set(17, 17, 1);
    this.sun.add(corona);

    this.sunLight = new THREE.PointLight(0xfff1d5, 2200, 0, 2);
    this.group.add(this.sunLight);
    this.ambientLight = new THREE.AmbientLight(0x334968, 0.12);
    this.group.add(this.ambientLight);

    this.earthOrbit = new THREE.Group();
    this.group.add(this.earthOrbit);
    this.earthSystem = new THREE.Group();
    this.earthSystem.position.x = SOLAR_DISPLAY.earthOrbitRadius;
    this.earthOrbit.add(this.earthSystem);
    this.earthTilt = new THREE.Group();
    this.earthTilt.rotation.z = EARTH_TILT;
    this.earthSystem.add(this.earthTilt);
    this.earth = new THREE.Mesh(sphere(SOLAR_DISPLAY.earthRadius), track(
      new THREE.MeshStandardMaterial({ map: track(earthTexture()), roughness: 0.9 }),
    ));
    this.earth.name = "Earth";
    this.earthTilt.add(this.earth);
    this.clouds = new THREE.Mesh(sphere(SOLAR_DISPLAY.earthRadius * 1.012), track(
      new THREE.MeshStandardMaterial({
        map: track(cloudTexture()),
        transparent: true,
        depthWrite: false,
        roughness: 1,
      }),
    ));
    this.earthTilt.add(this.clouds);
    const atmosphere = new THREE.Mesh(sphere(SOLAR_DISPLAY.earthRadius * 1.045), track(
      new THREE.MeshBasicMaterial({
        color: 0x6bb9ff,
        transparent: true,
        opacity: 0.14,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    ));
    this.earthSystem.add(atmosphere);

    this.moonOrbit = new THREE.Group();
    this.moonOrbit.rotation.y = -0.7;
    this.earthSystem.add(this.moonOrbit);
    this.moon = new THREE.Mesh(sphere(SOLAR_DISPLAY.moonRadius), track(
      new THREE.MeshStandardMaterial({ map: track(moonTexture()), roughness: 1 }),
    ));
    this.moon.name = "Moon";
    this.moon.position.x = SOLAR_DISPLAY.moonOrbitRadius;
    this.moonOrbit.add(this.moon);

    this.planets = new Map([["Earth", {
      definition: PLANETS[2], orbit: this.earthOrbit, body: this.earth,
    }]]);
    for (const definition of PLANETS) {
      if (definition.name === "Earth") continue;
      const orbitPlane = new THREE.Group();
      orbitPlane.name = `${definition.name}OrbitPlane`;
      orbitPlane.rotation.x = THREE.MathUtils.degToRad(definition.inclinationDegrees);
      this.group.add(orbitPlane);
      const orbit = new THREE.Group();
      orbit.name = `${definition.name}Orbit`;
      orbit.rotation.y = definition.phase;
      orbitPlane.add(orbit);
      const system = new THREE.Group();
      system.position.x = definition.displayOrbitRadius;
      orbit.add(system);
      const tilt = new THREE.Group();
      tilt.rotation.z = THREE.MathUtils.degToRad(definition.tiltDegrees);
      system.add(tilt);
      const body = new THREE.Mesh(sphere(definition.displayRadius), track(
        new THREE.MeshStandardMaterial({
          map: track(planetTexture(definition.appearance)),
          roughness: definition.appearance === "rock" || definition.appearance === "mars" ? 1 : 0.9,
        }),
      ));
      body.name = definition.name;
      tilt.add(body);
      if (definition.name === "Saturn") {
        this.addRings(tilt, definition.displayRadius, [
          [1.35, 1.65, 0xc1ad8d, 0.58],
          [1.72, 2.12, 0xe4d2aa, 0.78],
          [2.2, 2.55, 0xb9aa91, 0.5],
        ], track);
      }
      if (definition.name === "Uranus") {
        this.addRings(tilt, definition.displayRadius, [
          [1.45, 1.52, 0xb3d9d6, 0.28],
          [1.63, 1.68, 0x8ebac1, 0.22],
        ], track);
      }
      this.planets.set(definition.name, { definition, orbit, body });
    }
  }

  addRings(parent, radius, bands, track) {
    for (const [inner, outer, color, opacity] of bands) {
      const geometry = track(new THREE.RingGeometry(radius * inner, radius * outer, 96));
      const material = track(new THREE.MeshStandardMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity,
        depthWrite: false,
        roughness: 1,
        emissive: color,
        emissiveIntensity: 0.08,
      }));
      const ring = new THREE.Mesh(geometry, material);
      ring.rotation.x = -Math.PI / 2;
      parent.add(ring);
    }
  }

  update(delta) {
    const days = delta * SOLAR_DISPLAY.simulationDaysPerSecond;
    for (const { definition, orbit, body } of this.planets.values()) {
      orbit.rotation.y += TAU * days / definition.orbitDays;
      body.rotation.y += TAU * days * 24 / definition.rotationHours * SOLAR_DISPLAY.visualSelfRotationScale;
    }
    this.clouds.rotation.y += TAU * days * 24 / SOLAR_PERIODS.earthRotationHours * SOLAR_DISPLAY.visualSelfRotationScale * 0.94;
    this.moonOrbit.rotation.y += TAU * days / SOLAR_PERIODS.moonOrbitDays;
    this.sun.rotation.y += delta * 0.015;
  }

  dispose() {
    this.group.removeFromParent();
    for (const resource of this.resources) resource.dispose();
  }
}
