import * as THREE from "three";
import { BaseTheme } from "./BaseTheme.js";

export class DevelopmentTheme extends BaseTheme {
  constructor(container, config) {
    super(container);

    this.config = config;
    this.time = 0;
    this.group = new THREE.Group();
    this.group.name = config.name;
    this.container.add(this.group);

    this.createIdentifier();
    this.createTransporter();
  }

  createIdentifier() {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;

    const context = canvas.getContext("2d");
    const identifierColor = new THREE.Color(this.config.color).getStyle();
    context.fillStyle = "rgba(2, 5, 12, 0.88)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = identifierColor;
    context.lineWidth = 8;
    context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    context.fillStyle = identifierColor;
    context.font = "bold 58px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(this.config.label, canvas.width / 2, canvas.height / 2);

    this.identifierTexture = new THREE.CanvasTexture(canvas);
    this.identifierTexture.colorSpace = THREE.SRGBColorSpace;
    this.identifierGeometry = new THREE.PlaneGeometry(8, 2);
    this.identifierMaterial = new THREE.MeshBasicMaterial({
      map: this.identifierTexture,
      transparent: true,
      depthWrite: false,
    });
    this.identifier = new THREE.Mesh(
      this.identifierGeometry,
      this.identifierMaterial,
    );
    this.identifier.position.set(0, 2.2, -6);
    this.group.add(this.identifier);
  }

  createTransporter() {
    this.transporterGeometry = new THREE.SphereGeometry(0.75, 32, 24);
    this.transporterMaterial = new THREE.MeshStandardMaterial({
      color: this.config.color,
      emissive: this.config.color,
      emissiveIntensity: 0.35,
      metalness: 0.25,
      roughness: 0.35,
    });
    this.transporter = new THREE.Mesh(
      this.transporterGeometry,
      this.transporterMaterial,
    );
    this.transporter.position.set(0, 0, -6);
    this.group.add(this.transporter);

    this.transporterRingGeometry = new THREE.TorusGeometry(1.15, 0.045, 16, 64);
    this.transporterRingMaterial = new THREE.MeshBasicMaterial({
      color: this.config.color,
      transparent: true,
      opacity: 0.8,
    });
    this.transporterRing = new THREE.Mesh(
      this.transporterRingGeometry,
      this.transporterRingMaterial,
    );
    this.transporterRing.position.copy(this.transporter.position);
    this.transporterRing.rotation.x = Math.PI / 2;
    this.group.add(this.transporterRing);
  }

  update() {
    this.time += 0.016;
    this.transporter.rotation.y += 0.004;
    this.transporterRing.rotation.z += 0.006;
  }

  getEnvironment() {
    return {
      world: true,
      stars: false,
      portal: false,
      stage: true,
    };
  }

  getHomePose() {
    return {
      position: new THREE.Vector3(0, 0, 5),
      lookTarget: new THREE.Vector3(0, 0, 0),
    };
  }

  getGateways() {
    return [];
  }

  destroy() {
    this.container.remove(this.group);

    this.identifierGeometry.dispose();
    this.identifierMaterial.dispose();
    this.identifierTexture.dispose();
    this.transporterGeometry.dispose();
    this.transporterMaterial.dispose();
    this.transporterRingGeometry.dispose();
    this.transporterRingMaterial.dispose();
  }
}
