import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import nature from "./nature-kit.data.json";

declare const process: { env: { EXPO_BASE_URL?: string } };
type Kind = "garden" | "courtyard" | "veranda" | "table" | "river";
type Profile = { kind: Kind; floor: number; night?: boolean; warmLight?: boolean };
const profiles: Record<string, Profile> = {
  'ema-votive-plaque': { kind: 'veranda', floor: -0.04 },
  'clootie-well-rag': { kind: 'garden', floor: -0.04 },
  'diya-oil-lamp': { kind: 'courtyard', floor: -0.04, night: true, warmLight: true },
  'votive-candle-catholic': { kind: 'courtyard', floor: -0.04, night: true, warmLight: true },
  'daruma-eye-painting': { kind: 'veranda', floor: -0.04 },
  mizuhiki: { kind: 'veranda', floor: -0.04 },
  milagros: { kind: 'veranda', floor: -0.04 },
  'phuang-malai': { kind: 'garden', floor: -0.04 },
  woodfish: { kind: "veranda", floor: -0.95 },
  "celtic-folk-spring": { kind: "garden", floor: -0.025 },
  "theravada-water": { kind: "courtyard", floor: -0.09 },
  "furin-wind-chime": { kind: "veranda", floor: -0.04 },
  "shinto-torii": { kind: "courtyard", floor: -0.035 },
  "tibetan-wheel": { kind: "veranda", floor: -0.035 },
  "tanzaku-tanabata": { kind: "garden", floor: -0.04 },
  crane: { kind: "table", floor: -0.65 },
  "slavic-wreath": { kind: "river", floor: -0.055 },
  lantern: { kind: "veranda", floor: -0.04, night: true },
  yeondeunghoe: { kind: "garden", floor: -0.04, night: true },
};

type Part = { positions: number[]; normals: number[]; indices: number[]; color: number[] };
type NatureModel = { parts: Part[] };
const models = nature as Record<string, NatureModel>;

/** Small, source-derived Kenney props and a local Poly Haven sky; each mount owns its GPU resources. */
export function createCozyEnvironment(
  scene: THREE.Scene,
  { id, loadSky = (url: string) => new RGBELoader().loadAsync(url), invalidate = () => {} }: {
    id: string;
    loadSky?: (url: string) => Promise<THREE.DataTexture>;
    invalidate?: () => void;
  },
) {
  const profile = profiles[id];
  if (!profile) return null;
  const { kind, floor, night = false, warmLight = false } = profile;
  const previous = {
    background: scene.background, fog: scene.fog, environment: scene.environment,
    intensity: scene.backgroundIntensity, blur: scene.backgroundBlurriness,
    environmentIntensity: scene.environmentIntensity,
    backgroundRotation: scene.backgroundRotation.clone(), environmentRotation: scene.environmentRotation.clone(),
  };
  const root = new THREE.Group();
  root.name = "cozy-environment";
  root.userData.environment = kind;
  scene.add(root);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const propGeometries = new Map<string, THREE.BufferGeometry[]>();
  let disposed = false;
  let sky: THREE.DataTexture | undefined;
  const horizon = night ? 0x415d73 : 0xd7e9da;
  const fallback = new THREE.Color(horizon);
  scene.background = fallback;
  scene.fog = new THREE.Fog(horizon, night ? 7 : 9, night ? 24 : 28);
  scene.backgroundIntensity = night ? 0.065 : 0.42;
  scene.backgroundBlurriness = night ? 0.015 : 0.12;
  scene.environmentIntensity = warmLight ? 0.25 : night ? 0.16 : 0.3;
  scene.backgroundRotation.set(0, 2.2, 0);
  scene.environmentRotation.copy(scene.backgroundRotation);

  const makeMaterial = (color: number) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
    materials.add(material);
    return material;
  };
  const grass = makeMaterial(night ? 0x718e82 : 0xa9bd83);
  const sand = makeMaterial(night ? 0x9e9b83 : 0xe3d4ab);
  const wood = makeMaterial(night ? 0xa78e70 : 0xc6a57b);
  const trim = makeMaterial(night ? 0x8c846e : 0xa58866);
  const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.userData.toonSurface = { outline: false };
    root.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) =>
    addMesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  const groundY = kind === "table" ? floor - 0.14 : floor;
  const ground = addMesh(new THREE.PlaneGeometry(100, 100), grass, 0, groundY, -12);
  ground.rotation.x = -Math.PI / 2;

  if (kind === "courtyard") {
    box(2.45, 0.025, 26, sand, 0, floor + 0.004, -7);
    // Separate stones make a quiet path through the whole environment.
    for (let i = 0; i < 8; i++) box(1.72, 0.028, 0.64, sand, 0, floor + 0.028, -2.8 - i * 0.9);
  } else if (kind === "veranda") {
    box(12, 0.12, 5.3, wood, 0, floor - 0.055, 0.2);
    for (let i = -5; i <= 5; i++) box(0.018, 0.003, 5.3, trim, i, floor + 0.01, 0.2);
    // A low rail anchors the eye without surrounding the subject with a box.
    for (const x of [-4.6, -2.3, 2.3, 4.6]) box(0.12, 0.66, 0.12, wood, x, floor + 0.32, -2.5);
    for (const x of [-3.5, 3.5]) box(3, 0.10, 0.1, wood, x, floor + 0.58, -2.5);
  } else if (kind === "table") {
    box(5.8, 0.13, 3.4, wood, 0, floor - 0.08, 0.35);
    for (let i = -2; i <= 2; i++) box(0.012, 0.003, 3.4, trim, i * 0.85, floor - 0.01, 0.35);
    // The paper's existing folding/lifting motion stays unobstructed.
    box(0.15, 0.68, 0.15, wood, -2.1, floor - 0.43, 1.25);
    box(0.15, 0.68, 0.15, wood, 2.1, floor - 0.43, 1.25);
  } else if (kind === "river") {
    ground.material = makeMaterial(0x8cc3c2);
    for (const x of [-5, 5]) box(5, 0.10, 46, grass, x, floor + 0.025, -13);
  } else {
    const path = addMesh(new THREE.CircleGeometry(2.55, 48), sand, 0, floor + 0.008, 0);
    path.rotation.x = -Math.PI / 2;
    path.scale.set(1.15, 0.86, 1);
  }

  const prop = (name: string, x: number, z: number, scale: number, rotation = 0) => {
    const model = models[name];
    if (!model) return;
    let parts = propGeometries.get(name);
    if (!parts) {
      parts = model.parts.map(part => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(part.positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(part.normals, 3));
        geometry.setIndex(part.indices);
        geometries.add(geometry);
        return geometry;
      });
      propGeometries.set(name, parts);
    }
    const group = new THREE.Group();
    group.position.set(x, groundY + 0.014, z);
    group.scale.setScalar(scale);
    group.rotation.y = rotation;
    model.parts.forEach((part, index) => {
      const color = new THREE.Color().setRGB(part.color[0], part.color[1], part.color[2]);
      // Bring source greens into the UI's sage palette without replacing their colour variation.
      if (color.g > color.r * 1.1) color.lerp(new THREE.Color(night ? 0x729988 : 0x9bb779), 0.48);
      const material = new THREE.MeshStandardMaterial({ color, roughness: 1 });
      materials.add(material);
      const mesh = new THREE.Mesh(parts![index], material);
      mesh.userData.toonSurface = { outline: false };
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    });
    root.add(group);
  };
  // Keep the central interaction area open; depth comes from a staggered tree line.
  const trees: [number, number, number][] = [
    [-4.6, -4.2, 2.4], [4.8, -5.0, 2.8], [-7.0, -8.8, 3.2],
    [7.4, -10, 3.6], [-2.6, -10.5, 2.7], [2.5, -12.4, 3.3], [-10, -15, 4.1], [10.4, -16, 4.3],
  ];
  trees.forEach(([x, z, scale], index) => prop(index % 3 === 0 ? "tree-pine" : "tree-round", x, z, scale, index * 0.8));
  for (const [x, z, scale] of [[-2.8, -2.3, 1.3], [3.0, -3.3, 1.1], [-5.2, -6.6, 1.8], [4, -7, 1.5]]) {
    prop("bush", x, z, scale, x);
  }
  for (const [x, z, scale] of [[-2.2, -1.4, 0.7], [2.7, -2.0, 0.6], [-3.8, -4.0, 1.0], [3.5, -5.6, 0.9]]) {
    prop("rock", x, z, scale, z);
  }
  for (let i = 0; i < 7; i++) {
    prop("flowers", (i % 2 ? -1 : 1) * (2.6 + i * 0.25), -2.2 - i * 0.68, 0.8, i);
  }
  if (id === "celtic-folk-spring") {
    for (let i = 0; i < 14; i++) {
      const angle = i * Math.PI * 2 / 14;
      prop("rock", Math.cos(angle) * 1.72, Math.sin(angle) * 1.72, 0.65 + (i % 3) * 0.06, angle);
    }
  }

  const file = night ? "kloppenheim-02-night-1k.hdr" : "kloppenheim-06-sky-1k.hdr";
  const base = process.env.EXPO_BASE_URL || "/";
  const ready = loadSky(`${base.replace(/\/$/, "")}/environments/${file}`)
    .then(texture => {
      if (disposed) { texture.dispose(); return; }
      sky = texture;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = scene.environment = texture;
      invalidate();
    })
    .catch(() => { /* Local sky unavailable: the fully built garden still renders. */ });

  const lights = new WeakSet<THREE.Light>();
  const meshes = new WeakSet<THREE.Mesh>();
  return {
    kind, ready,
    prepare(renderer: THREE.WebGLRenderer) {
      let keySeen = false;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      scene.traverse(object => {
        if (object instanceof THREE.Mesh && !meshes.has(object)) {
          meshes.add(object);
          const surfaces = Array.isArray(object.material) ? object.material : [object.material];
          if (surfaces.some(material => material instanceof THREE.MeshStandardMaterial && !material.transparent)) {
            object.castShadow = object.receiveShadow = true;
          }
        }
        if (!(object instanceof THREE.Light)) return;
        const first = !lights.has(object);
        if (first) lights.add(object);
        if (object instanceof THREE.AmbientLight) {
          object.color.set(warmLight ? 0xffe0b9 : night ? 0xa8bddb : 0xfff3df);
          object.intensity = warmLight ? 0.35 : night ? 0.24 : 0.22;
        } else if (object instanceof THREE.HemisphereLight) {
          object.color.set(night ? 0xaec9e1 : 0xfff5e7);
          object.groundColor.set(warmLight ? 0x988568 : night ? 0x536971 : 0xb4bd8d);
          object.intensity = warmLight ? 0.6 : night ? 0.48 : 0.5;
        } else if (object instanceof THREE.DirectionalLight) {
          const key = !keySeen;
          keySeen = true;
          object.color.set(warmLight && key ? 0xffd19a : night ? 0xd6e5fb : key ? 0xffe6bf : 0xfff2e4);
          object.intensity = warmLight && key ? 1.15 : night ? (key ? 0.65 : 0.2) : (key ? 1.2 : 0.18);
          object.castShadow = key;
          if (key && first) {
            object.shadow.mapSize.set(1024, 1024);
            Object.assign(object.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.1, far: 35 });
            object.shadow.bias = -0.0003;
            object.shadow.normalBias = 0.035;
            object.shadow.radius = 4;
            object.shadow.camera.updateProjectionMatrix();
          }
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      sky?.dispose();
      scene.background = previous.background;
      scene.environment = previous.environment;
      scene.fog = previous.fog;
      scene.backgroundIntensity = previous.intensity;
      scene.backgroundBlurriness = previous.blur;
      scene.environmentIntensity = previous.environmentIntensity;
      scene.backgroundRotation.copy(previous.backgroundRotation);
      scene.environmentRotation.copy(previous.environmentRotation);
    },
  };
}
