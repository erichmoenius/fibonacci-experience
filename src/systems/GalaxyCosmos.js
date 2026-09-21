import * as THREE from "three";

// Galaxy-local surroundings stay fixed in world space while the Traveller moves.
export class GalaxyCosmos {
  constructor(parent, homePose) {
    this.group = new THREE.Group();
    this.group.name = "GalaxyCosmos";
    parent.add(this.group);
    this.resources = [];
    this.texture = this.createSoftPointTexture();

    const forward = homePose.lookTarget.clone().sub(homePose.position).normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    const point = new THREE.Vector3();
    const worldPoint = (x, y, depth) => point.copy(homePose.position)
      .addScaledVector(right, x)
      .addScaledVector(up, y)
      .addScaledVector(forward, depth);

    let seed = 921457;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
    const normal = () => Math.sqrt(-2 * Math.log(Math.max(random(), 1e-6)))
      * Math.cos(2 * Math.PI * random());

    // Unequal overlapping volumes avoid camera-centered shells and hard edges.
    const foreground = [
      [-11, -4, 16, 9, 7, 5],
      [2, -9, 22, 10, 5, 6],
      [-19, 7, 27, 7, 7, 5],
    ];
    const middle = [
      [-18, 6, 38, 22, 17, 10],
      [5, -16, 53, 24, 13, 12],
      [-25, -5, 62, 16, 15, 8],
    ];
    const far = [[0, 1, 84, 39, 24, 7]];
    this.addStars("nearStars", 56, 0.18, 0.7, foreground, worldPoint, random, normal);
    this.addStars("nearBrightStars", 12, 0.3, 0.8, foreground, worldPoint, random, normal);
    this.addStars("middleStars", 280, 0.16, 0.48, middle, worldPoint, random, normal);
    this.addStars("farStars", 130, 0.13, 0.28, far, worldPoint, random, normal);

    this.addHaze(worldPoint, normal, random);
    this.addDistantObjects(worldPoint, normal, random);
    this.addCuriosities(worldPoint, normal, random);
  }

  createSoftPointTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d");
    const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    glow.addColorStop(0, "rgba(255,255,255,1)");
    glow.addColorStop(0.25, "rgba(255,255,255,0.55)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  addPoints(name, positions, colors, size, opacity) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();
    const material = new THREE.PointsMaterial({
      size,
      map: this.texture,
      vertexColors: true,
      transparent: true,
      opacity,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    points.name = name;
    this.group.add(points);
    this.resources.push(geometry, material);
  }

  addStars(name, count, size, opacity, volumes, worldPoint, random, normal) {
    const positions = [];
    const colors = [];
    const palette = [0xf5f6ff, 0xcddfff, 0xffe9d2];
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const [x, y, depth, spreadX, spreadY, spreadDepth] =
        volumes[Math.floor(random() * volumes.length)];
      const position = worldPoint(
        x + normal() * spreadX,
        y + normal() * spreadY,
        depth + normal() * spreadDepth,
      );
      positions.push(position.x, position.y, position.z);
      color.setHex(palette[Math.floor(random() * palette.length)]);
      const brightness = 0.55 + random() * 0.45;
      colors.push(color.r * brightness, color.g * brightness, color.b * brightness);
    }
    this.addPoints(name, positions, colors, size, opacity);
  }

  addHaze(worldPoint, normal, random) {
    const positions = [];
    const colors = [];
    const clouds = [
      [-15, -10, 31, 0x9ca8c4],
      [-27, 8, 55, 0xaaa0ba],
      [8, -18, 72, 0xb8aaa5],
    ];
    const color = new THREE.Color();
    for (const [x, y, depth, tint] of clouds) {
      color.setHex(tint);
      for (let i = 0; i < 32; i++) {
        const position = worldPoint(
          x + normal() * 4.5,
          y + normal() * 3.0,
          depth + normal() * 5.0,
        );
        positions.push(position.x, position.y, position.z);
        const brightness = 0.3 + random() * 0.35;
        colors.push(color.r * brightness, color.g * brightness, color.b * brightness);
      }
    }
    this.addPoints("cosmicHaze", positions, colors, 2.6, 0.012);
  }

  addDistantObjects(worldPoint, normal, random) {
    const positions = [];
    const colors = [];
    const objects = [
      [29, 12, 88, 2.1, 0.7, 0xb9c7dc],
      [39, -13, 92, 1.4, 0.35, 0xd6c5c9],
      [-30, 24, 86, 1.2, 0.9, 0xb4bfd7],
      [12, 29, 94, 1.7, 0.45, 0xc7c5d6],
    ];
    const color = new THREE.Color();
    for (const [x, y, depth, spreadX, spreadY, tint] of objects) {
      color.setHex(tint);
      for (let i = 0; i < 28; i++) {
        const position = worldPoint(
          x + normal() * spreadX,
          y + normal() * spreadY,
          depth + normal() * 0.65,
        );
        positions.push(position.x, position.y, position.z);
        const brightness = 0.35 + random() * 0.4;
        colors.push(color.r * brightness, color.g * brightness, color.b * brightness);
      }
    }
    this.addPoints("distantCosmicObjects", positions, colors, 0.9, 0.06);
  }

  addCuriosities(worldPoint, normal, random) {
    // One thin distant galaxy, distinct from the diffuse background smudges.
    const edgePositions = [];
    const edgeColors = [];
    const cool = new THREE.Color(0xa8bddc);
    const warm = new THREE.Color(0xf1d6bb);
    const color = new THREE.Color();
    for (let i = 0; i < 96; i++) {
      const horizontalSample = normal();
      const verticalSample = normal();
      const depthSample = normal();
      const variation = random();
      const bulge = i < 24;
      const along = bulge
        ? horizontalSample * 0.65
        : Math.tanh(horizontalSample * 1.1) * 8.0;
      const taper = Math.max(0, 1 - Math.abs(along) / 8.0);
      const position = worldPoint(
        66 + along + 0.13 * Math.sin(along * 0.9),
        22 + along * 0.22 + 0.16 * Math.sin(along * 0.8)
          + verticalSample * (bulge ? 0.4 : 0.13 + 0.17 * taper),
        89 + 0.22 * Math.cos(along * 0.5)
          + depthSample * (bulge ? 0.9 : 0.55),
      );
      edgePositions.push(position.x, position.y, position.z);
      color.copy(cool).lerp(warm, bulge ? 0.78 : 0.22 * taper)
        .multiplyScalar(bulge
          ? 0.75 + 0.25 * variation
          : 0.25 + 0.42 * taper + 0.15 * variation);
      edgeColors.push(color.r, color.g, color.b);
    }
    this.addPoints("edgeOnCuriosity", edgePositions, edgeColors, 1.2, 0.09);

    // A compact stellar association with a dense center and real XYZ thickness.
    const clusterPositions = [];
    const clusterColors = [];
    for (let i = 0; i < 130; i++) {
      const spread = i < 100 ? 0.85 : 1.9;
      const position = worldPoint(
        40 + normal() * spread,
        -14 + normal() * spread,
        52 + normal() * spread * 1.2,
      );
      clusterPositions.push(position.x, position.y, position.z);
      color.setHex(random() < 0.12 ? 0xffe5ce : 0xdceaff)
        .multiplyScalar(0.55 + random() * 0.45);
      clusterColors.push(color.r, color.g, color.b);
    }
    this.addPoints("stellarClusterCuriosity", clusterPositions, clusterColors, 0.19, 0.48);

    // Broken cloudlets follow a curved path through space, not a line or tube.
    const filamentPositions = [];
    const filamentColors = [];
    for (let i = 0; i < 120; i++) {
      const t = random() * 2 - 1;
      if (t > -0.1 && t < 0.12 && random() < 0.8) continue;
      const position = worldPoint(
        -73 + 10 * t + 3 * Math.sin(2.1 * t) + normal() * 0.8,
        24 + 7 * t + 2 * Math.sin(3.4 * t + 0.4) + normal() * 0.7,
        58 + 9 * t + 2 * Math.cos(2 * t) + normal() * 1.8,
      );
      filamentPositions.push(position.x, position.y, position.z);
      const brightSegment = Math.exp(-Math.pow((t + 0.58) / 0.23, 2))
        + 0.8 * Math.exp(-Math.pow((t - 0.55) / 0.2, 2));
      color.setHex(0xa4b4d2)
        .multiplyScalar(0.3 + random() * 0.3 + 0.35 * Math.min(1, brightSegment));
      filamentColors.push(color.r, color.g, color.b);
    }
    this.addPoints("filamentCuriosity", filamentPositions, filamentColors, 1.4, 0.045);

    // A separate dusty cloud uses offset lobes and varied depth, without a plane.
    const cloudPositions = [];
    const cloudColors = [];
    const lobes = [
      [-2.2, 0.9, -2, 0x8d8aa7],
      [1.8, -1.3, 2.5, 0xa79aa2],
      [0.2, 2.3, 5, 0xa79c8d],
    ];
    for (const [x, y, depth, tint] of lobes) {
      for (let i = 0; i < 50; i++) {
        const position = worldPoint(
          20 + x + normal() * 2.3,
          -38 + y + normal() * 1.7,
          42 + depth + normal() * 2.8,
        );
        cloudPositions.push(position.x, position.y, position.z);
        color.setHex(tint).multiplyScalar(0.35 + random() * 0.35);
        cloudColors.push(color.r, color.g, color.b);
      }
    }
    this.addPoints("dustCloudCuriosity", cloudPositions, cloudColors, 2.7, 0.035);
  }

  dispose() {
    this.group.removeFromParent();
    for (const resource of this.resources) resource.dispose();
    this.texture.dispose();
    this.group.clear();
  }
}
