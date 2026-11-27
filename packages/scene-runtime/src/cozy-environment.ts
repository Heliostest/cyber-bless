import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { RenderStyleId } from "@wbr/content";
import { isSceneVisibleInApp } from "@wbr/core/daily-scenes";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import nature from "./nature-kit.data.json";
import { gardenLayout } from "./garden-layout";
import { createStylizedMeadow } from "./stylized-meadow";
import type { TreePlacement } from './tree-models';
import { createEnvironmentTrees } from './environment-trees';
import type { TreeRenderMethod, TreeRenderReport } from './debug-trees';
import { getSceneTreeDefault } from './tree-profiles';
import { readSceneMotion } from "./scene-motion";
import { createToonCloudBackdrop } from "./toon-cloud-backdrop";
import { createEnvironmentTone, DELIVERY_PALETTE, KOMOREBI_PALETTE } from './environment-tone';
import type { EnvironmentTone } from './debug-environment-tone';
import { DEFAULT_ENVIRONMENT_TONE, DEFAULT_GRASS_METHOD } from './environment-defaults';
import { createKomorebiMeadow, decorateMeadowGround } from './komorebi-meadow';
import type { GrassRenderMethod } from './debug-grass';
import { createKomorebiSurface } from './komorebi-surface';
import { createCourtyardStonePath } from './courtyard-stone-path';
import { createKomorebiBackdrop, type BackdropRole } from './komorebi-backdrop';
import { applyCraftSurface } from './craft-surfaces';

import { assetUrl } from './asset-urls';
import { getEnvironmentProfile, getEnvironmentSurfaceY } from './environment-profiles';

type Part = { positions: number[]; normals: number[]; indices: number[]; color: number[] };
type NatureModel = { parts: Part[] };
const models = nature as Record<string, NatureModel>;

type WoodAxis = 'x' | 'y' | 'z';
type WoodFlip = 'none' | 'x' | 'y' | 'z';
type DeckPlankRecipe = {
  dh: number;
  ds: number;
  dl: number;
  scale: number;
  strength: number;
  roughness: number;
  flip: WoodFlip;
  offset: readonly [number, number, number];
};

// Keep the shared veranda/table wood noticeably quieter, softer and more matte
// than foreground hero craft furniture (strength 0.35-0.48, roughness 0.72-0.82),
// while letting environment-tone remap day Komorebi, Delivery, and Night palettes.
const DECK_PLANK_RECIPES: readonly DeckPlankRecipe[] = [
  { dh: 0.005, ds: -0.020, dl: 0.032, scale: 0.50, strength: 0.13, roughness: 0.90, flip: 'none', offset: [0.31, 0.14, 0.47] },
  { dh: -0.006, ds: 0.024, dl: -0.042, scale: 0.62, strength: 0.15, roughness: 0.93, flip: 'y', offset: [-0.47, -0.21, 0.83] },
  { dh: 0.002, ds: -0.010, dl: 0.008, scale: 0.56, strength: 0.12, roughness: 0.91, flip: 'x', offset: [0.64, 0.27, -0.52] },
  { dh: -0.004, ds: 0.018, dl: -0.024, scale: 0.66, strength: 0.14, roughness: 0.92, flip: 'z', offset: [-0.29, -0.17, -0.74] },
  { dh: 0.004, ds: -0.015, dl: 0.020, scale: 0.48, strength: 0.12, roughness: 0.89, flip: 'none', offset: [0.53, -0.24, 0.29] },
];

// Asymmetric plank widths summing to exact outer widths (12.00m veranda, 5.80m table)
// with a center plank straddling x = 0 so no hard seam bisects the focal prop.
const VERANDA_PLANK_WIDTHS = [0.82, 0.75, 0.85, 0.76, 0.83, 0.74, 0.84, 0.81, 0.76, 0.85, 0.75, 0.83, 0.78, 0.84, 0.79] as const;
const TABLE_PLANK_WIDTHS = [0.84, 0.79, 0.86, 0.82, 0.85, 0.78, 0.86] as const;

function tintWoodColor(hex: number, dh: number, ds: number, dl: number) {
  return new THREE.Color(hex).offsetHSL(dh, ds, dl);
}

function orientWoodGeometry(geometry: THREE.BufferGeometry, flip: WoodFlip) {
  if (flip === 'x') geometry.rotateX(Math.PI);
  else if (flip === 'y') geometry.rotateY(Math.PI);
  else if (flip === 'z') geometry.rotateZ(Math.PI);
}

/** A clear painted sky, independent of the photographic panorama used for lighting. */
function createSkyBackdrop(clear = false, night = false, delivery = false, komorebi = false) {
  const width = 4, height = 64, pixels = new Uint8Array(width * height * 4);
  const horizon = new THREE.Color(night ? (delivery ? 0x304959 : 0x1b355d) : komorebi ? KOMOREBI_PALETTE.horizon : delivery ? DELIVERY_PALETTE.horizon : clear ? 0x6ec5ff : 0x9ed9f3);
  const zenith = new THREE.Color(night ? (delivery ? 0x14283d : 0x08152f) : komorebi ? KOMOREBI_PALETTE.zenith : delivery ? DELIVERY_PALETTE.zenith : clear ? 0x278fe6 : 0x409ee0);
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
  { id, loadSky = (url: string) => new RGBELoader().loadAsync(url), invalidate = () => {}, loadTree, onTrees, camera }: {
    id: string;
    loadSky?: (url: string) => Promise<THREE.DataTexture>;
    invalidate?: () => void;
    loadTree?: (url: string) => Promise<THREE.Group>;
    onTrees?: (report: TreeRenderReport) => void;
    camera?: THREE.Camera;
  },
) {
  const profile = getEnvironmentProfile(id);
  if (!profile) return null;
  const { kind, floor, night = false, warmLight = false, coastal = false } = profile;
  const surfaceY = getEnvironmentSurfaceY(id);
  const previous = {
    background: scene.background, fog: scene.fog, environment: scene.environment,
    intensity: scene.backgroundIntensity, blur: scene.backgroundBlurriness,
    environmentIntensity: scene.environmentIntensity,
    backgroundRotation: scene.backgroundRotation.clone(), environmentRotation: scene.environmentRotation.clone(),
    environmentNight: scene.userData.environmentNight,
    environmentId: scene.userData.environmentId,
    environmentSurfaceY: scene.userData.environmentSurfaceY,
  };
  const root = new THREE.Group();
  root.name = "cozy-environment";
  root.userData.environment = kind;
  scene.add(root);
  scene.userData.environmentNight = night;
  scene.userData.environmentId = id;
  scene.userData.environmentSurfaceY = surfaceY;
  const toneSurfaces = createEnvironmentTone(root, night);
  const calibrated = createKomorebiBackdrop(root);
  let tone: EnvironmentTone = 'original', toneDirty = false;
  let deliveryBackdrop: THREE.DataTexture | undefined;
  let komorebiBackdrop: THREE.DataTexture | undefined;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const propGeometries = new Map<string, THREE.BufferGeometry[]>();
  const instances: THREE.InstancedMesh[] = [];
  let disposed = false;
  let sky: THREE.DataTexture | undefined;
  let meadow: ReturnType<typeof createStylizedMeadow> | undefined;
  let komorebiMeadow: ReturnType<typeof createKomorebiMeadow> | undefined;
  let stonePath: ReturnType<typeof createCourtyardStonePath> | undefined;
  let grassMethod: GrassRenderMethod = 'original';
  let treePlacements: readonly TreePlacement[] = [];
  const clouds = !coastal && isSceneVisibleInApp({ id }) ? createToonCloudBackdrop(night ? "night" : "day") : undefined;
  if (clouds) root.add(clouds.root);
  const clearDay = !night && !!clouds;
  let windTime = 0, lastFrame = 0;
  const horizon = night ? (clouds ? 0x20395a : 0x415d73) : clearDay ? 0xc1e3ec : 0xb8dce7;
  const backdrop = night && !clouds ? undefined : createSkyBackdrop(clearDay, night);
  scene.background = backdrop ?? new THREE.Color(horizon);
  // Atmospheric perspective belongs to the far tree line, not the workbench.
  scene.fog = new THREE.Fog(horizon, night ? 7 : clearDay ? 24 : 18, night ? 24 : clearDay ? 80 : 55);
  scene.backgroundIntensity = night && !backdrop ? 0.065 : 1;
  scene.backgroundBlurriness = night && !backdrop ? 0.015 : 0;
  scene.environmentIntensity = warmLight ? 0.25 : night ? 0.16 : 0.22;
  scene.backgroundRotation.set(0, 2.2, 0);
  scene.environmentRotation.copy(scene.backgroundRotation);

  const makeMaterial = (color: number, role?: keyof typeof DELIVERY_PALETTE) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
    material.userData.environmentRole = role;
    materials.add(material);
    return material;
  };
  const grass = makeMaterial(night ? 0x718e82 : 0x90c65b, 'grass');
  let komorebiGround: THREE.MeshPhongMaterial | undefined;
  const sand = makeMaterial(night ? 0x9e9b83 : 0xecdfbd, 'sand');
  sand.userData.backdropRole = 'sand';
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
  const makeWoodMaterial = (
    role: 'wood' | 'trim',
    axis: WoodAxis,
    { dh = 0, ds = 0, dl = 0, scale = 0.56, strength = 0.14, roughness = 0.91 }: {
      dh?: number; ds?: number; dl?: number; scale?: number; strength?: number; roughness?: number;
    } = {},
  ) => {
    const baseHex = role === 'wood' ? (night ? 0xa78e70 : 0xd9b98c) : (night ? 0x8c846e : 0xbfa07a);
    const material = new THREE.MeshStandardMaterial({
      color: tintWoodColor(baseHex, dh, ds, dl),
      roughness,
      metalness: 0,
    });
    material.userData.environmentRole = role;
    applyCraftSurface(material, { kind: 'wood', axis, scale, strength });
    materials.add(material);
    return material;
  };
  const woodBox = (
    name: string,
    w: number,
    h: number,
    d: number,
    material: THREE.MeshStandardMaterial,
    x: number,
    y: number,
    z: number,
    radius = 0.015,
    { flip = 'none', offset }: { flip?: WoodFlip; offset?: readonly [number, number, number] } = {},
  ) => {
    const geometry = new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3));
    orientWoodGeometry(geometry, flip);
    let px = x, py = y, pz = z;
    if (offset) {
      // Shift local-space vertices and compensate on mesh.position so world bounds stay
      // exact while each plank/post samples an independent region of 3D wood grain.
      geometry.translate(offset[0], offset[1], offset[2]);
      px -= offset[0];
      py -= offset[1];
      pz -= offset[2];
    }
    const mesh = addMesh(geometry, material, px, py, pz);
    mesh.name = name;
    // Pin matte roughness explicitly so toon-soft keeps background deck calmer than hero wood.
    mesh.userData.toonSurface = { outline: false, shading: "smooth", roughness: material.roughness };
    return mesh;
  };
  const buildPlankDeck = (
    prefix: string,
    widths: readonly number[],
    totalWidth: number,
    height: number,
    depth: number,
    yCenter: number,
    zCenter: number,
    seamGap: number,
    chamfer: number,
  ) => {
    const plankMaterials = DECK_PLANK_RECIPES.map(recipe =>
      makeWoodMaterial('wood', 'z', {
        dh: recipe.dh,
        ds: recipe.ds,
        dl: recipe.dl,
        scale: recipe.scale,
        strength: recipe.strength,
        roughness: recipe.roughness,
      }),
    );
    let cursorX = -totalWidth / 2;
    widths.forEach((slotWidth, index) => {
      const isFirst = index === 0;
      const isLast = index === widths.length - 1;
      const leftInset = isFirst ? 0 : seamGap / 2;
      const rightInset = isLast ? 0 : seamGap / 2;
      const boardWidth = slotWidth - leftInset - rightInset;
      const xCenter = cursorX + leftInset + boardWidth / 2;
      const recipe = DECK_PLANK_RECIPES[index % DECK_PLANK_RECIPES.length]!;
      const mat = plankMaterials[index % plankMaterials.length]!;
      woodBox(`${prefix}-plank`, boardWidth, height, depth, mat, xCenter, yCenter, zCenter, chamfer, {
        flip: recipe.flip,
        offset: [
          recipe.offset[0] + index * 0.37,
          recipe.offset[1] + ((index % 3) - 1) * 0.11,
          recipe.offset[2] + ((index * 5) % 7 - 3) * 0.29,
        ],
      });
      cursorX += slotWidth;
    });
  };
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
    const meadow = makeMaterial(0x86b95c, 'hill'), distantMeadow = makeMaterial(0xa3cb7a, 'distantHill');
    meadow.userData.backdropRole = 'hill'; distantMeadow.userData.backdropRole = 'distantHill';
    const left = addMesh(new THREE.SphereGeometry(1, 32, 12), meadow, kind === "river" ? -15 : -8, groundY - 1.0, -19);
    left.scale.set(12, 2.1, 6);
    const right = addMesh(new THREE.SphereGeometry(1, 32, 12), distantMeadow, kind === "river" ? 17 : 10, groundY - 1.3, -26);
    right.scale.set(14, 2.7, 7);
  }

  if (kind === "courtyard") {
    stonePath = createCourtyardStonePath({ floor, night });
    root.add(stonePath.mesh);
    if (stonePath.mossMesh) root.add(stonePath.mossMesh);
  } else if (kind === "veranda") {
    const deckHeight = 0.12;
    const deckY = floor - 0.055;
    const seamGap = 0.010;
    const edgeDepth = 0.18;
    const plankDepth = 5.3 - edgeDepth - seamGap;
    const plankZ = 0.2 + (edgeDepth + seamGap) / 2;
    const edgeZ = 0.2 - 5.3 / 2 + edgeDepth / 2;
    const seamBacking = makeMaterial(night ? 0x8c846e : 0xbfa07a, 'trim');
    seamBacking.color.copy(tintWoodColor(night ? 0x8c846e : 0xbfa07a, -0.005, 0.015, -0.14));
    seamBacking.roughness = 0.96;
    // Continuous recessed sub-deck strictly above meadow-ground (y = floor) and below
    // deck top (floor + 0.005) prevents green ground bleed while keeping a warm seam valley.
    const backing = box(11.97, 0.098, 5.27, seamBacking, 0, floor - 0.0462, 0.2);
    backing.name = 'veranda-deck-backing';
    backing.userData.toonSurface = { outline: false, shading: "smooth", roughness: 0.96 };
    buildPlankDeck('veranda-deck', VERANDA_PLANK_WIDTHS, 12, deckHeight, plankDepth, deckY, plankZ, seamGap, 0.012);
    const edgeMat = makeWoodMaterial('wood', 'x', { dh: -0.004, ds: 0.014, dl: -0.022, scale: 0.54, strength: 0.15, roughness: 0.90 });
    woodBox('veranda-deck-edge', 12, deckHeight, edgeDepth, edgeMat, 0, deckY, edgeZ, 0.012, { offset: [0.42, -0.15, 0.23] });
    // A low rail anchors the eye without surrounding the subject with a box.
    const postMats = [
      makeWoodMaterial('wood', 'y', { dh: -0.004, ds: 0.016, dl: -0.026, scale: 0.72, strength: 0.21, roughness: 0.88 }),
      makeWoodMaterial('wood', 'y', { dh: 0.004, ds: -0.010, dl: -0.010, scale: 0.84, strength: 0.20, roughness: 0.87 }),
    ];
    const capMat = makeWoodMaterial('trim', 'x', { scale: 0.80, strength: 0.16, roughness: 0.89 });
    const railMat = makeWoodMaterial('wood', 'x', { dh: -0.003, ds: 0.012, dl: -0.018, scale: 0.68, strength: 0.20, roughness: 0.87 });
    const postFlips: readonly WoodFlip[] = ['none', 'y', 'x', 'z'];
    ([-4.6, -2.3, 2.3, 4.6] as const).forEach((x, index) => {
      woodBox('veranda-rail-post', 0.12, 0.66, 0.12, postMats[index % 2]!, x, floor + 0.32, -2.5, 0.016, {
        flip: postFlips[index % 4]!,
        offset: [0.18 * (index - 1.5), 0.31 * (index % 2 ? -1 : 1), 0.22 * (index - 1)],
      });
      woodBox('veranda-rail-cap', 0.146, 0.026, 0.146, capMat, x, floor + 0.653, -2.5, 0.007, {
        flip: index % 2 ? 'y' : 'none',
        offset: [0.24 * (index - 1.5), 0.08, -0.19 * (index % 2 ? 1 : -1)],
      });
    });
    ([-3.5, 3.5] as const).forEach((x, index) => {
      woodBox('veranda-rail-bar', 3, 0.10, 0.10, railMat, x, floor + 0.58, -2.5, 0.016, {
        flip: index === 0 ? 'none' : 'y',
        offset: index === 0 ? [0.46, 0.14, -0.18] : [-0.58, -0.16, 0.25],
      });
    });
  } else if (kind === "table") {
    const seamBacking = makeMaterial(night ? 0x8c846e : 0xbfa07a, 'trim');
    seamBacking.color.copy(tintWoodColor(night ? 0x8c846e : 0xbfa07a, -0.005, 0.015, -0.14));
    seamBacking.roughness = 0.96;
    const backing = box(5.77, 0.104, 3.37, seamBacking, 0, floor - 0.073, 0.35);
    backing.name = 'table-deck-backing';
    backing.userData.toonSurface = { outline: false, shading: "smooth", roughness: 0.96 };
    buildPlankDeck('table-deck', TABLE_PLANK_WIDTHS, 5.8, 0.13, 3.4, floor - 0.08, 0.35, 0.010, 0.013);
    // The paper's existing folding/lifting motion stays unobstructed.
    const legMats = [
      makeWoodMaterial('wood', 'y', { dh: -0.004, ds: 0.015, dl: -0.024, scale: 0.70, strength: 0.20, roughness: 0.88 }),
      makeWoodMaterial('wood', 'y', { dh: 0.004, ds: -0.010, dl: -0.008, scale: 0.82, strength: 0.19, roughness: 0.87 }),
    ];
    ([-2.1, 2.1] as const).forEach((x, index) => {
      woodBox('table-front-post', 0.15, 0.68, 0.15, legMats[index]!, x, floor - 0.43, 1.25, 0.018, {
        flip: index === 0 ? 'none' : 'y',
        offset: index === 0 ? [0.22, 0.28, -0.16] : [-0.26, -0.31, 0.21],
      });
    });
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
  const propMaterial = (name: string, part: Part, index: number) => {
    const color = new THREE.Color().setRGB(part.color[0], part.color[1], part.color[2]);
    const backdropRole: BackdropRole = name.startsWith('rock') ? 'stone' : !name.startsWith('flowers') || index === 0 ? 'foliage'
      : index === 1 ? (name === 'flowers' ? 'flower' : 'bloom') : 'blossomHeart';
    if (name.startsWith("rock")) color.lerp(new THREE.Color(night ? 0x91a9a4 : 0xc3c6aa), 0.72);
    else if (color.g > color.r * 1.1) color.lerp(new THREE.Color(night ? 0x729988 : 0x6fa84c), night ? 0.48 : 0.65);
    else if (name.startsWith("tree")) color.lerp(new THREE.Color(night ? 0xa78e70 : 0xb5906c), 0.65);
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1 });
    if (name.startsWith('rock')) material.userData.environmentRole = 'stone';
    else if (name === 'flowers') material.userData.environmentRole = color.g > color.r * 1.1 ? 'foliage' : 'flower';
    material.userData.backdropRole = backdropRole;
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
      const mesh = new THREE.Mesh(parts[index], propMaterial(name, part, index));
      mesh.userData.toonSurface = { outline: false, shading: "smooth" };
      mesh.castShadow = mesh.receiveShadow = true;
      group.add(mesh);
    });
    root.add(group);
    return group;
  };
  if (night) {
    // Preserve the quiet night arrangement around the authored lamps.
    const trees: [number, number, number][] = [
      [-6.8, -6.5, 3.7], [7.0, -7.5, 3.4], [-7.0, -8.8, 3.9],
      [7.4, -10, 5.5], [-4.4, -11, 2.7], [4.6, -13, 3.1], [-10, -15, 6.3], [10.4, -16, 5.3],
    ];
    treePlacements = trees.map(([x, z, scale], index) => ({ x, z, scale, turn: index * .8 }));
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
    treePlacements = layout.filter(item => item.model.startsWith('tree-'));
    for (const name of new Set(layout.filter(item => !item.model.startsWith("tree-")).map(item => item.model))) {
      const placements = layout.filter(item => item.model === name), parts = propParts(name);
      models[name].parts.forEach((part, index) => {
        const mesh = new THREE.InstancedMesh(parts[index], propMaterial(name, part, index), placements.length);
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

  const treeRecommendation = getSceneTreeDefault(id);
  const treeRendering = createEnvironmentTrees(treePlacements, groundY, { load: loadTree,
    onChange: report => {
      toneDirty = true;
      if (report.status === 'ready') { toneSurfaces.refresh(); toneDirty = false; }
      onTrees?.(report);
    }, invalidate, recommendation: treeRecommendation, camera });
  root.add(treeRendering.root);
  const file = night ? "kloppenheim-02-night-1k.hdr" : "kloppenheim-06-sky-1k.hdr";
  const skyReady = loadSky(assetUrl(`environments/${file}`))
    .then(texture => {
      if (disposed) { texture.dispose(); return; }
      sky = texture;
      texture.mapping = THREE.EquirectangularReflectionMapping;
      scene.environment = texture;
      if (night && !backdrop && tone === 'original') scene.background = texture;
      invalidate();
    })
    .catch(() => { /* Local sky unavailable: the fully built garden still renders. */ });

  const lights = new WeakSet<THREE.Light>();
  const hemiDirections = new Map<THREE.HemisphereLight,THREE.Vector3>();
  const meshes = new WeakSet<THREE.Mesh>();
  const shadowPlanes = new Map<THREE.Mesh, boolean>();
  const previewShadows = new Map<THREE.DirectionalLight, { intensity: number; radius: number }>();
  function restorePreviewShadows() {
    previewShadows.forEach((original, light) => { light.shadow.intensity = original.intensity; light.shadow.radius = original.radius; });
    previewShadows.clear();
  }
  function setTone(next: EnvironmentTone) {
    if (disposed || next === tone) return;
    tone = next;
    stonePath?.setTone(next);
    // Restore PBR sources first, so the shared palette remap also visits them.
    calibrated.setEnabled(false);
    toneSurfaces.setTone(next); meadow?.setTone(next); komorebiMeadow?.setTone(next);
    calibrated.setEnabled(next === 'komorebi' && !night);
    if (next === 'tiny-delivery') {
      deliveryBackdrop ??= createSkyBackdrop(clearDay, night, true);
      scene.background = deliveryBackdrop;
      scene.backgroundIntensity = 1; scene.backgroundBlurriness = 0;
      scene.fog?.color.setHex(night ? 0x304959 : DELIVERY_PALETTE.horizon);
      scene.environmentIntensity = night ? .2 : .26;
    } else if (next === 'komorebi') {
      komorebiBackdrop ??= createSkyBackdrop(clearDay, night, false, true);
      scene.background = komorebiBackdrop; scene.backgroundIntensity = 1; scene.backgroundBlurriness = 0;
      scene.fog?.color.setHex(night ? 0x20395a : KOMOREBI_PALETTE.horizon);
      scene.environmentIntensity = .16;
    } else {
      scene.background = backdrop ?? sky ?? new THREE.Color(horizon);
      scene.backgroundIntensity = night && !backdrop ? .065 : 1;
      scene.backgroundBlurriness = night && !backdrop ? .015 : 0;
      scene.fog?.color.setHex(horizon);
      scene.environmentIntensity = warmLight ? .25 : night ? .16 : .22;
    }
    invalidate();
  }
  setTone(DEFAULT_ENVIRONMENT_TONE);
  function setGrassMethod(next: GrassRenderMethod) {
    if (disposed || !meadow || next === grassMethod) return;
    if (next === 'komorebi' && !komorebiMeadow) {
      komorebiMeadow = createKomorebiMeadow({ kind, floor: groundY, id }); root.add(komorebiMeadow.root); komorebiMeadow.setTone(tone);
    }
    grassMethod = next; meadow.mesh.visible = next === 'original';
    if (komorebiMeadow) komorebiMeadow.root.visible = next === 'komorebi';
    grass.map = next === 'komorebi' ? komorebiMeadow!.groundMap : meadow.groundMap;
    if (next === 'komorebi' && !komorebiGround) {
      komorebiGround = decorateMeadowGround(createKomorebiSurface(), komorebiMeadow!.groundStrokes);
      komorebiGround.name = 'Komorebi meadow ground';
      materials.add(komorebiGround);
    }
    if (komorebiGround) {
      komorebiGround.map=komorebiMeadow!.groundMap;
      root.traverse(object=>{
        if (!(object instanceof THREE.Mesh)) return;
        if (next==='komorebi' && object.material===grass) object.material=komorebiGround!;
        else if (next==='original' && object.material===komorebiGround) object.material=grass;
      });
    }
    invalidate();
  }
  setGrassMethod(DEFAULT_GRASS_METHOD);
  let captureReady = false;
  const ready = Promise.all([skyReady, treeRendering.ready]).then(() => { captureReady = true; });
  return {
    kind, ready,
    get captureReady() { return captureReady; },
    setTone,
    hasGrass: !!meadow,
    setGrassMethod,
    captureDefaultGrass() {
      if (!meadow || grassMethod === DEFAULT_GRASS_METHOD) return undefined;
      const selected = grassMethod; setGrassMethod(DEFAULT_GRASS_METHOD); return () => setGrassMethod(selected);
    },
    captureDefaultTone() {
      const selected = tone;
      if (selected === DEFAULT_ENVIRONMENT_TONE) return undefined;
      setTone(DEFAULT_ENVIRONMENT_TONE);
      return () => setTone(selected);
    },
    treeCount: treePlacements.length,
    treeRecommendation,
    captureDefaultTrees: treeRendering.captureDefault,
    setTreeMethod(method: TreeRenderMethod) { return treeRendering.select(method); },
    prepare(renderer: THREE.WebGLRenderer, style: RenderStyleId = "toon-soft", { advanceMotion = true } = {}) {
      treeRendering.reframe();
      if (toneDirty) { toneSurfaces.refresh(); toneDirty = false; }
      const delivery = tone === 'tiny-delivery';
      const komorebi = tone === 'komorebi';
      const paintedDay = style === "gouache" && !night;
      const softTrees = treeRendering.isPreviewVisible();
      if (!softTrees) restorePreviewShadows();
      if (advanceMotion) {
        const now = performance.now() * .001, motion = readSceneMotion(renderer.domElement);
        if (motion.reducedMotion) windTime = 0;
        else if (motion.active && lastFrame) windTime += Math.min(.05, Math.max(0, now - lastFrame));
        lastFrame = now;
        meadow?.update(windTime);
        if (grassMethod === 'komorebi') komorebiMeadow?.update(windTime);
        treeRendering.update(windTime, motion.reducedMotion);
        clouds?.update(windTime);
      }
      let keySeen = false;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = !softTrees && (night || paintedDay || delivery) ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          const surfaces = Array.isArray(object.material) ? object.material : [object.material];
          if (
            object.userData.keepInOutdoorEnvironment !== true &&
            surfaces.length > 0 &&
            surfaces.every(material => material instanceof THREE.ShadowMaterial)
          ) {
            if (!shadowPlanes.has(object)) shadowPlanes.set(object, object.visible);
            object.visible = false;
          }
          if (!meshes.has(object)) {
            meshes.add(object);
            if (surfaces.some(material => material instanceof THREE.MeshStandardMaterial && !material.transparent)) {
              object.castShadow = !object.userData.komorebiGrass && !object.userData.stonePath;
              object.receiveShadow = !object.userData.importedTreeFoliage;
            }
          }
        }
        if (!(object instanceof THREE.Light)) return;
        const first = !lights.has(object);
        if (first) lights.add(object);
        if (object instanceof THREE.AmbientLight) {
          object.color.set(warmLight ? 0xffe0b9 : night ? 0xa8bddb : delivery ? 0xffedcf : 0xfff8ee);
          object.intensity = warmLight ? 0.35 : night ? 0.24 : paintedDay ? .26 : delivery ? .2 : .18;
          if (komorebi && !night && !warmLight) object.intensity=0;
        } else if (object instanceof THREE.HemisphereLight) {
          object.color.set(night ? 0xaec9e1 : komorebi ? 0x79a8e3 : delivery ? 0xc8e6e6 : 0xd8eeff);
          object.groundColor.set(warmLight ? 0x988568 : night ? 0x536971 : komorebi ? 0x253e57 : delivery ? 0x9fa77c : 0xb9ad8b);
          // Babylon's Color3.FromHexString feeds these lighting floats directly.
          if (komorebi && !night) {
            object.color.setRGB(121 / 255, 168 / 255, 227 / 255);
            if (!warmLight) object.groundColor.setRGB(37 / 255, 62 / 255, 87 / 255);
          }
          object.intensity = warmLight ? 0.6 : night ? 0.48 : paintedDay ? 1 : delivery ? .65 : .6;
          if (komorebi && !night) {
            if (!hemiDirections.has(object)) hemiDirections.set(object,object.position.clone());
            object.intensity=.64*Math.PI; object.position.set(.2,1,.3);
          } else if (hemiDirections.has(object)) {
            object.position.copy(hemiDirections.get(object)!); hemiDirections.delete(object);
          }
        } else if (object instanceof THREE.DirectionalLight) {
          const key = !keySeen;
          keySeen = true;
          object.color.set(warmLight && key ? 0xffd19a : night ? 0xd6e5fb : key ? (komorebi ? 0xfff1dc : delivery ? 0xfff0d5 : 0xfff4e5) : 0xecf4ff);
          if (komorebi && key && !night && !warmLight) object.color.setRGB(1, 241 / 255, 220 / 255);
          object.intensity = warmLight && key ? 1.15 : night ? (key ? 0.65 : 0.2) : (key ? (komorebi ? 3.1 : paintedDay ? 2.9 : delivery ? 3.25 : 3.8) : 0.1);
          if (komorebi && !night && !warmLight) object.intensity=key?1.12*Math.PI:0;
          // A common high side sun makes shapes and contact shadows legible.
          // Keep authored night directions and animated point lights intact.
          if (key && !night) object.position.set(-6, komorebi ? 12 : 9, komorebi ? 6 : 5);
          object.castShadow = key;
          if (key && first) {
            object.shadow.mapSize.set(night ? 1024 : 2048, night ? 1024 : 2048);
            Object.assign(object.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.1, far: 35 });
            object.shadow.bias = -0.0003;
            object.shadow.normalBias = night ? 0.035 : 0.015;
            object.shadow.radius = night ? 4 : 1;
            object.shadow.camera.updateProjectionMatrix();
          }
          if (key && !softTrees) object.shadow.radius = delivery ? 4 : night ? 4 : 1;
          if (softTrees && key) {
            if (!previewShadows.has(object)) previewShadows.set(object, { intensity: object.shadow.intensity, radius: object.shadow.radius });
            object.shadow.intensity = previewShadows.get(object)!.intensity * .52;
            object.shadow.radius = 12;
          }
        }
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      restorePreviewShadows();
      shadowPlanes.forEach((visible, mesh) => { mesh.visible = visible; });
      shadowPlanes.clear();
      hemiDirections.forEach((position,light)=>light.position.copy(position)); hemiDirections.clear();
      root.removeFromParent();
      calibrated.dispose();
      meadow?.dispose();
      komorebiMeadow?.dispose();
      stonePath?.dispose();
      treeRendering.dispose();
      clouds?.dispose();
      instances.forEach(mesh => mesh.dispose());
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      backdrop?.dispose();
      deliveryBackdrop?.dispose();
      komorebiBackdrop?.dispose();
      sky?.dispose();
      scene.background = previous.background;
      scene.environment = previous.environment;
      scene.fog = previous.fog;
      scene.backgroundIntensity = previous.intensity;
      scene.backgroundBlurriness = previous.blur;
      scene.environmentIntensity = previous.environmentIntensity;
      scene.backgroundRotation.copy(previous.backgroundRotation);
      scene.environmentRotation.copy(previous.environmentRotation);
      if (previous.environmentNight === undefined) delete scene.userData.environmentNight;
      else scene.userData.environmentNight = previous.environmentNight;
      if (previous.environmentId === undefined) delete scene.userData.environmentId;
      else scene.userData.environmentId = previous.environmentId;
      if (previous.environmentSurfaceY === undefined) delete scene.userData.environmentSurfaceY;
      else scene.userData.environmentSurfaceY = previous.environmentSurfaceY;
    },
  };
}
