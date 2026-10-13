import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import nature from "./nature-kit.data.json";

declare const process: { env: { EXPO_BASE_URL?: string } };
type Kind = "garden" | "courtyard" | "veranda" | "table" | "river";
type Profile = { kind: Kind; floor: number; night?: boolean; warmLight?: boolean };
const profiles: Record<string, Profile> = {
  'barcelos-clay-rooster': { kind: 'veranda', floor: -0.04 },
  'finnish-birch-basket': { kind: 'veranda', floor: -0.04 },
  'croatian-licitar-heart': { kind: 'courtyard', floor: -0.04 },
  'catalan-festival-giant': { kind: 'courtyard', floor: -0.04 },
  'sorbian-painted-egg': { kind: 'veranda', floor: -0.04 },
  'basque-sunflower': { kind: 'courtyard', floor: -0.04 },
  'breton-banner': { kind: 'courtyard', floor: -0.04 },
  'lithuanian-straw-garden': { kind: 'veranda', floor: -0.04 },
  'dalarna-wooden-horse': { kind: 'veranda', floor: -0.04 },
  'aland-votive-ship': { kind: 'veranda', floor: -0.04 },
  'blang-tea': { kind: 'garden', floor: -0.04 },
  'minangkabau-spinning-top': { kind: 'courtyard', floor: -0.04 },
  'chinese-incense': { kind: 'courtyard', floor: -0.04 },
  'hongsheng-red-string': { kind: 'veranda', floor: -0.04 },
  'italian-ex-voto': { kind: 'veranda', floor: -0.04 },
  'czech-pilgrim-journal': { kind: 'garden', floor: -0.04 },
  omikuji: { kind: 'courtyard', floor: -0.04 },
  'polish-blessing-basket': { kind: 'veranda', floor: -0.04 },
  'navruz-sumalak': { kind: 'courtyard', floor: -0.04 },
  'floating-lantern-loy-krathong': { kind: 'river', floor: -0.04 },
  'omamori-cycle': { kind: 'veranda', floor: -0.04 },
  'shrine-suzu-bell': { kind: 'courtyard', floor: -0.04 },
  'st-brigids-cross': { kind: 'veranda', floor: -0.04 },
  bokjori: { kind: 'veranda', floor: -0.04 },
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

/** A quiet painted sky, independent of the photographic panorama used for lighting. */
function createDaylightBackdrop() {
  const width = 4, height = 64, pixels = new Uint8Array(width * height * 4);
  const horizon = new THREE.Color(0xc0e0ec), zenith = new THREE.Color(0x86c4e2);
  const color = new THREE.Color(), rgb = { r: 0, g: 0, b: 0 };
  for (let y = 0; y < height; y++) {
    const elevation = Math.max(0, (y / (height - 1) - 0.25) / 0.75);
    color.copy(horizon).lerp(zenith, Math.sin(elevation * Math.PI / 2)).getRGB(rgb, THREE.SRGBColorSpace);
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      pixels.set([Math.round(rgb.r * 255), Math.round(rgb.g * 255), Math.round(rgb.b * 255), 255], at);
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Small, source-derived Kenney props and local sky lighting; each mount owns its GPU resources. */
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
  const horizon = night ? 0x415d73 : 0xc9e2d9;
  const backdrop = night ? undefined : createDaylightBackdrop();
  scene.background = backdrop ?? new THREE.Color(horizon);
  // Atmospheric perspective belongs to the far tree line, not the workbench.
  scene.fog = new THREE.Fog(horizon, night ? 7 : 18, night ? 24 : 55);
  scene.backgroundIntensity = night ? 0.065 : 1;
  scene.backgroundBlurriness = night ? 0.015 : 0;
  scene.environmentIntensity = warmLight ? 0.25 : night ? 0.16 : 0.3;
  scene.backgroundRotation.set(0, 2.2, 0);
  scene.environmentRotation.copy(scene.backgroundRotation);

  const makeMaterial = (color: number) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
    materials.add(material);
    return material;
  };
  const grass = makeMaterial(night ? 0x718e82 : 0xb8d48a);
  const sand = makeMaterial(night ? 0x9e9b83 : 0xecdfbd);
  const wood = makeMaterial(night ? 0xa78e70 : 0xd9b98c);
  const trim = makeMaterial(night ? 0x8c846e : 0xbfa07a);
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

  if (!night) {
    // Two broad meadow silhouettes give depth without adding small visual detail.
    const meadow = makeMaterial(0xb0ca88), distantMeadow = makeMaterial(0xbfd69d);
    const left = addMesh(new THREE.SphereGeometry(1, 32, 12), meadow, kind === "river" ? -15 : -8, groundY - 1.0, -19);
    left.scale.set(12, 2.1, 6);
    const right = addMesh(new THREE.SphereGeometry(1, 32, 12), distantMeadow, kind === "river" ? 17 : 10, groundY - 1.3, -26);
    right.scale.set(14, 2.7, 7);
  }

  if (kind === "courtyard") {
    const positions: number[] = [], indices: number[] = [];
    for (let i = 0; i <= 32; i++) {
      const t = i / 32, x = Math.sin(t * Math.PI * 1.5) * 1.6, half = 1.22 - t * 0.65;
      positions.push(x - half, floor + 0.012, 4 - t * 36, x + half, floor + 0.012, 4 - t * 36);
      if (i < 32) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const path = new THREE.BufferGeometry();
    path.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    path.setIndex(indices); path.computeVertexNormals();
    addMesh(path, sand, 0, 0, 0);
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
      // Keep foliage green rather than cyan, with a restrained natural palette.
      if (name === "rock") color.lerp(new THREE.Color(night ? 0x91a9a4 : 0xc3c6aa), 0.72);
      else if (color.g > color.r * 1.1) color.lerp(new THREE.Color(night ? 0x729988 : 0x81ad69), night ? 0.48 : 0.82);
      else if (name.startsWith("tree")) color.lerp(new THREE.Color(night ? 0xa78e70 : 0xb5906c), 0.65);
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
    [-6.8, -6.5, 2.4], [7.0, -7.5, 2.8], [-7.0, -8.8, 3.2],
    [7.4, -10, 3.6], [-4.4, -11, 2.2], [4.6, -13, 2.5], [-10, -15, 4.1], [10.4, -16, 4.3],
  ];
  trees.forEach(([x, z, scale], index) => prop(index % 3 === 0 ? "tree-pine" : "tree-round", x, z, scale, index * 0.8));
  for (const [x, z, scale] of [[-2.8, -2.3, 1.3], [3.0, -3.3, 1.1], [-5.2, -6.6, 1.8], [4, -7, 1.5]]) {
    prop("bush", x, z, scale, x);
  }
  for (const [x, z, scale] of [[-2.2, -1.4, 0.7], [2.7, -2.0, 0.6], [-3.8, -4.0, 1.0], [3.5, -5.6, 0.9]]) {
    prop("rock", x, z, scale, z);
  }
  for (let i = 0; i < 3; i++) {
    prop("flowers", (i % 2 ? -1 : 1) * (3.0 + i * 0.35), -2.6 - i * 1.15, 0.65, i);
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
      scene.environment = texture;
      if (night) scene.background = texture;
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
          object.color.set(warmLight ? 0xffe0b9 : night ? 0xa8bddb : 0xfff8ee);
          object.intensity = warmLight ? 0.35 : night ? 0.24 : 0.28;
        } else if (object instanceof THREE.HemisphereLight) {
          object.color.set(night ? 0xaec9e1 : 0xeaf5ff);
          object.groundColor.set(warmLight ? 0x988568 : night ? 0x536971 : 0xc5ca94);
          object.intensity = warmLight ? 0.6 : night ? 0.48 : 0.65;
        } else if (object instanceof THREE.DirectionalLight) {
          const key = !keySeen;
          keySeen = true;
          object.color.set(warmLight && key ? 0xffd19a : night ? 0xd6e5fb : key ? 0xfff0d6 : 0xecf4ff);
          object.intensity = warmLight && key ? 1.15 : night ? (key ? 0.65 : 0.2) : (key ? 1.35 : 0.22);
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
      backdrop?.dispose();
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
