import * as THREE from "three";
import type { RenderStyleId } from "@wbr/content";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import nature from "./nature-kit.data.json";
import { gardenLayout, type GardenKind } from "./garden-layout";
import { createStylizedMeadow } from "./stylized-meadow";
import { createStylizedTrees } from "./stylized-trees";
import { readSceneMotion } from "./scene-motion";

declare const process: { env: { EXPO_BASE_URL?: string } };
type Kind = GardenKind;
type Profile = { kind: Kind; floor: number; night?: boolean; warmLight?: boolean; coastal?: boolean };
const profiles: Record<string, Profile> = {
  "brat-bride-cloth": {kind:"courtyard",floor:0,night:true,warmLight:true},
  "alasita-miniature-house": {kind:"courtyard",floor:0},
  "yusheng-lohei": {kind:"garden",floor:-.12},
  "hiiragi-iwashi": {kind:"garden",floor:-.012},
  "tamagushi-offering": {kind:"courtyard",floor:0},
  "tibetan-water-bowls": {kind:"garden",floor:-.02},
  "kagami-biraki-sake": {kind:"garden",floor:-.02},
  "tibetan-prayer-flags": {kind:"courtyard",floor:0},
  "rosh-hashanah-apple-honey": {kind:"garden",floor:-.02},
  "thai-songkran-elders": {kind:"courtyard",floor:0},
  "kameido-usokae": {kind:"garden",floor:-.02},
  "persian-esfand": {kind:"courtyard",floor:0},
  "mochigase-nagashibina": {kind:"garden",floor:-.29},
  "greek-vasilopita": {kind:"courtyard",floor:0},
  "tibetan-khata-greeting": {kind:"garden",floor:-.08},
  "shichigosan-chitose-ame": {kind:"courtyard",floor:-.065},
  "mongolian-ovoo": {kind:"garden",floor:-.09},
  "fgs-buddha-bathing": {kind:"courtyard",floor:-.065},
  "balinese-canang-sari": {kind:"courtyard",floor:-.065},
  "bulgarian-survakane": {kind:"courtyard",floor:-.065},
  "setsubun-mamemaki": {kind:"courtyard",floor:-.065},
  "sternsinger-house-blessing": {kind:"courtyard",floor:-.065},
  "lam-tsuen-wishing-tree": {kind:"courtyard",floor:-.065},
  "kagami-mochi-offering": {kind:"courtyard",floor:-.12},
  "romanian-martisor": {kind:"courtyard",floor:-.075},
  "sumiyoshi-godairiki": {kind:"courtyard",floor:-.075},
  "polish-oplatek-sharing": {kind:"courtyard",floor:0},
  "greek-new-year-pomegranate": {kind:"courtyard",floor:0},
  "bonfim-ribbon": {kind:"courtyard",floor:0},
  "chinowa-kuguri": {kind:"courtyard",floor:0},
  "zeniarai-coin-washing": {kind:"courtyard",floor:0},
  'udo-undama': {kind:'river',floor:-.04,coastal:true},
  'malawi-sansi': { kind: 'garden', floor: -0.04 },
  'japanese-koinobori': { kind: 'garden', floor: -0.04 },
  'russian-matryoshka': { kind: 'garden', floor: -0.04 },
  'korean-yutnori': { kind: 'garden', floor: -0.04 },
  'chinese-diabolo': { kind: 'garden', floor: -0.04 },
  'chinese-tangram': { kind: 'garden', floor: -0.04 },
  'japanese-daruma-otoshi': {kind:'garden',floor:0},
  'paper-pinwheel': {kind:'garden',floor:0},
  'chinese-steelyard': {kind:'garden',floor:0},
  'garden-croquet': { kind: 'garden', floor: -.04 },
  'welsh-drop-spindle': { kind: 'garden', floor: 0 },
  'scottish-plunge-churn': { kind: 'garden', floor: 0 },
  'irish-bodhran': { kind: 'garden', floor: 0 },
  'french-coffee-mill': { kind: 'garden', floor: 0 },
  'japanese-wagasa': { kind: 'garden', floor: 0 },
  'spanish-castanets': { kind: 'garden', floor: 0 },
  'japanese-shishi-odoshi': { kind: 'garden', floor: 0 },
  'german-jumping-jack': { kind: 'garden', floor: 0 },
  'finnish-kantele': { kind: 'garden', floor: 0 },
  'estonian-village-swing': { kind: 'garden', floor: 0 },
  'french-petanque': { kind: 'garden', floor: 0 },
  'english-hearth-bellows': { kind: 'garden', floor: 0 },
  'mexican-metate': { kind: 'garden', floor: 0 },
  'czech-wooden-ratchet': { kind: 'garden', floor: 0 },
  'puerto-rican-guiro': { kind: 'garden', floor: 0 },
  'valencian-folding-fan': { kind: 'garden', floor: 0 },
  'mexican-tortilla-press': { kind: 'garden', floor: 0 },
  'ghanaian-oware': { kind: 'garden', floor: 0 },
  'chinese-rattle-drum': { kind: 'garden', floor: -0.04 },
  'japanese-kendama': { kind: 'garden', floor: -0.04 },
  'indian-charkha': { kind: 'garden', floor: -0.04 },
  'german-nutcracker': { kind: 'garden', floor: -0.04 },
  'mexican-molinillo': { kind: 'garden', floor: -0.04 },
  'chinese-suanpan': { kind: 'garden', floor: -0.04 },
  'mongolian-felt-ger': { kind: 'garden', floor: -0.04 },
  'peruvian-engraved-gourd': { kind: 'garden', floor: -0.04 },
  'venetian-glass-bead': { kind: 'veranda', floor: -0.04 },
  'korean-bojagi-wrap': { kind: 'veranda', floor: -0.04 },
  'vietnamese-bamboo-dragonfly': { kind: 'garden', floor: -0.04 },
  'turkish-ebru-paper': { kind: 'veranda', floor: -0.04 },
  'indonesian-angklung': { kind: 'veranda', floor: -0.04 },
  'weifang-paper-kite': { kind: 'garden', floor: -0.04 },
  'chinese-shadow-puppet': { kind: 'courtyard', floor: -0.04, night: true, warmLight: true },
  'polish-paper-cut': { kind: 'veranda', floor: -0.04 },
  'faroese-wool-knit': { kind: 'veranda', floor: -0.04 },
  'niue-shell-necklace': { kind: 'veranda', floor: -0.04 },
  'uzbek-clay-bowl': { kind: 'veranda', floor: -0.04 },
  'chinese-woodblock-print': { kind: 'veranda', floor: -0.04 },
  'czech-bead-star': { kind: 'veranda', floor: -0.04 },
  'fijian-woven-fan': { kind: 'veranda', floor: -0.04 },
  'amazigh-woven-rug': { kind: 'courtyard', floor: -0.04 },
  'slovak-wire-bird': { kind: 'veranda', floor: -0.04 },
  'hungarian-embroidery-hoop': { kind: 'veranda', floor: -0.04 },
  'andalusian-ceramic-tile': { kind: 'courtyard', floor: -0.04 },
  'sicilian-painted-cart': { kind: 'courtyard', floor: -0.04 },
  'bai-indigo-cloth': { kind: 'veranda', floor: -0.04 },
  'ndebele-painted-house': { kind: 'courtyard', floor: -0.04 },
  'purepecha-copper-bowl': { kind: 'veranda', floor: -0.04 },
  'welsh-love-spoon': { kind: 'veranda', floor: -0.04 },
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

/** A clear painted sky, independent of the photographic panorama used for lighting. */
function createDaylightBackdrop() {
  const width = 4, height = 64, pixels = new Uint8Array(width * height * 4);
  const horizon = new THREE.Color(0x9ed9f3), zenith = new THREE.Color(0x409ee0);
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
  const { kind, floor, night = false, warmLight = false, coastal = false } = profile;
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
  const instances: THREE.InstancedMesh[] = [];
  let disposed = false;
  let sky: THREE.DataTexture | undefined;
  let meadow: ReturnType<typeof createStylizedMeadow> | undefined;
  let treeCanopies: ReturnType<typeof createStylizedTrees> | undefined;
  let windTime = 0, lastFrame = 0;
  const horizon = night ? 0x415d73 : 0xb8dce7;
  const backdrop = night ? undefined : createDaylightBackdrop();
  scene.background = backdrop ?? new THREE.Color(horizon);
  // Atmospheric perspective belongs to the far tree line, not the workbench.
  scene.fog = new THREE.Fog(horizon, night ? 7 : 18, night ? 24 : 55);
  scene.backgroundIntensity = night ? 0.065 : 1;
  scene.backgroundBlurriness = night ? 0.015 : 0;
  scene.environmentIntensity = warmLight ? 0.25 : night ? 0.16 : 0.22;
  scene.backgroundRotation.set(0, 2.2, 0);
  scene.environmentRotation.copy(scene.backgroundRotation);

  const makeMaterial = (color: number) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
    materials.add(material);
    return material;
  };
  const grass = makeMaterial(night ? 0x718e82 : 0x90c65b);
  const sand = makeMaterial(night ? 0x9e9b83 : 0xecdfbd);
  const wood = makeMaterial(night ? 0xa78e70 : 0xd9b98c);
  const trim = makeMaterial(night ? 0x8c846e : 0xbfa07a);
  const addMesh = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    geometries.add(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.userData.toonSurface = { outline: false, shading: "smooth" };
    root.add(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) =>
    addMesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  const groundY = kind === "table" ? floor - 0.14 : floor;
  const spring = id === "celtic-folk-spring";
  let groundGeometry: THREE.BufferGeometry = new THREE.PlaneGeometry(100, 100);
  if (spring) {
    groundGeometry.dispose();
    const shape = new THREE.Shape();
    shape.moveTo(-50, -38); shape.lineTo(50, -38); shape.lineTo(50, 62); shape.lineTo(-50, 62); shape.closePath();
    const hole = new THREE.Path(); hole.absarc(0, 0, 1.36, 0, Math.PI * 2, true); shape.holes.push(hole);
    groundGeometry = new THREE.ShapeGeometry(shape, 48);
    const uv = groundGeometry.getAttribute("uv"), position = groundGeometry.getAttribute("position");
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (position.getX(i) + 50) / 100, (position.getY(i) + 38) / 100);
  }
  const ground = addMesh(groundGeometry, grass, 0, kind === "river" ? groundY - .30 : groundY, spring ? 0 : -12);
  ground.name = "meadow-ground";
  ground.rotation.x = -Math.PI / 2;

  if (!night && !coastal) {
    meadow = createStylizedMeadow({ kind, floor: groundY, id });
    root.add(meadow.mesh); grass.color.set(0xffffff); grass.map = meadow.groundMap;
  }

  if (!night && !coastal) {
    // Two broad meadow silhouettes give depth without adding small visual detail.
    const meadow = makeMaterial(0x86b95c), distantMeadow = makeMaterial(0xa3cb7a);
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
    ground.material = makeMaterial(coastal ? 0x9ab8ad : 0xb3c39b);
    for (const x of coastal ? [] : [-5, 5]) box(5, 0.10, 46, grass, x, floor + 0.025, -13);
  } else {
    let pathGeometry: THREE.BufferGeometry = new THREE.CircleGeometry(2.55, 48);
    if (spring) {
      pathGeometry.dispose();
      const shape = new THREE.Shape(); shape.absellipse(0, 0, 2.55 * 1.15, 2.55 * .86, 0, Math.PI * 2, false, 0);
      const hole = new THREE.Path(); hole.absarc(0, 0, 1.36, 0, Math.PI * 2, true); shape.holes.push(hole);
      pathGeometry = new THREE.ShapeGeometry(shape, 48);
    }
    const path = addMesh(pathGeometry, sand, 0, floor + 0.008, 0);
    path.name = "garden-path";
    path.rotation.x = -Math.PI / 2;
    if (!spring) path.scale.set(1.15, 0.86, 1);
  }

  const propParts = (name: string) => {
    const model = models[name];
    if (!model) throw new Error(`Missing bundled nature prop: ${name}`);
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
    return parts;
  };
  const propMaterial = (name: string, part: Part) => {
    const color = new THREE.Color().setRGB(part.color[0], part.color[1], part.color[2]);
    if (name.startsWith("rock")) color.lerp(new THREE.Color(night ? 0x91a9a4 : 0xc3c6aa), 0.72);
    else if (color.g > color.r * 1.1) color.lerp(new THREE.Color(night ? 0x729988 : 0x6fa84c), night ? 0.48 : 0.65);
    else if (name.startsWith("tree")) color.lerp(new THREE.Color(night ? 0xa78e70 : 0xb5906c), 0.65);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1 });
    materials.add(material);
    return material;
  };
  const prop = (name: string, x: number, z: number, scale: number, rotation = 0) => {
    const parts = propParts(name);
    const group = new THREE.Group();
    group.position.set(x, groundY + 0.014, z);
    group.scale.setScalar(scale);
    group.rotation.y = rotation;
    models[name].parts.forEach((part, index) => {
      const mesh = new THREE.Mesh(parts[index], propMaterial(name, part));
      mesh.userData.toonSurface = { outline: false, shading: "smooth" };
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    });
    root.add(group);
  };
  if (night) {
    // Preserve the quiet night arrangement around the authored lamps.
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
  } else if (!coastal) {
    const planting = new THREE.Group(); planting.name = "daylight-planting"; root.add(planting);
    const layout = gardenLayout(kind, id).filter(item => id !== "chinowa-kuguri" || Math.abs(item.x) > 7.8 || item.z < -5.5), transform = new THREE.Object3D();
    treeCanopies = createStylizedTrees(layout.filter(item => item.model.startsWith("tree-")), groundY);
    planting.add(treeCanopies.root);
    for (const name of new Set(layout.filter(item => !item.model.startsWith("tree-")).map(item => item.model))) {
      const placements = layout.filter(item => item.model === name), parts = propParts(name);
      models[name].parts.forEach((part, index) => {
        const mesh = new THREE.InstancedMesh(parts[index], propMaterial(name, part), placements.length);
        mesh.name = `nature-${name}`;
        mesh.userData.toonSurface = { outline: false, shading: "smooth" };
        mesh.castShadow = mesh.receiveShadow = true;
        placements.forEach((item, i) => {
          transform.position.set(item.x, groundY + .014 + (item.lift ?? 0), item.z);
          transform.rotation.set(0, item.turn, 0); transform.scale.setScalar(item.scale); transform.updateMatrix();
          mesh.setMatrixAt(i, transform.matrix);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        instances.push(mesh); planting.add(mesh);
      });
    }
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
    prepare(renderer: THREE.WebGLRenderer, style: RenderStyleId = "toon-soft") {
      const paintedDay = style === "gouache" && !night;
      const now = performance.now() * .001, motion = readSceneMotion(renderer.domElement);
      if (motion.reducedMotion) windTime = 0;
      else if (motion.active && lastFrame) windTime += Math.min(.05, Math.max(0, now - lastFrame));
      lastFrame = now;
      meadow?.update(windTime);
      treeCanopies?.update(windTime, motion.reducedMotion);
      let keySeen = false;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = night || paintedDay ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
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
          object.intensity = warmLight ? 0.35 : night ? 0.24 : paintedDay ? 0.26 : 0.18;
        } else if (object instanceof THREE.HemisphereLight) {
          object.color.set(night ? 0xaec9e1 : 0xd8eeff);
          object.groundColor.set(warmLight ? 0x988568 : night ? 0x536971 : 0xb9ad8b);
          object.intensity = warmLight ? 0.6 : night ? 0.48 : paintedDay ? 1.0 : 0.6;
        } else if (object instanceof THREE.DirectionalLight) {
          const key = !keySeen;
          keySeen = true;
          object.color.set(warmLight && key ? 0xffd19a : night ? 0xd6e5fb : key ? 0xfff4e5 : 0xecf4ff);
          object.intensity = warmLight && key ? 1.15 : night ? (key ? 0.65 : 0.2) : (key ? (paintedDay ? 2.9 : 3.8) : 0.1);
          // A common high side sun makes shapes and contact shadows legible.
          // Keep authored night directions and animated point lights intact.
          if (key && !night) object.position.set(-6, 9, 5);
          object.castShadow = key;
          if (key && first) {
            object.shadow.mapSize.set(night ? 1024 : 2048, night ? 1024 : 2048);
            Object.assign(object.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.1, far: 35 });
            object.shadow.bias = -0.0003;
            object.shadow.normalBias = night ? 0.035 : 0.015;
            object.shadow.radius = night ? 4 : 1;
            object.shadow.camera.updateProjectionMatrix();
          }
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      meadow?.dispose();
      treeCanopies?.dispose();
      instances.forEach(mesh => mesh.dispose());
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
