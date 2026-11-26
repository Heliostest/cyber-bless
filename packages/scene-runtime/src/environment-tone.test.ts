import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createEnvironmentTone, KOMOREBI_PALETTE } from './environment-tone';
import { createToonCloudBackdrop } from './toon-cloud-backdrop';
import { readFileSync } from 'node:fs';

function readGlbMaterialRgba(fileName: string, materialName: string): [number, number, number, number] {
  const file = readFileSync(new URL(`../../../assets/environments/trees/simple-tree/${fileName}.glb`, import.meta.url));
  const gltf = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString('utf8'));
  return gltf.materials.find((material: { name: string }) => material.name === materialName).pbrMetallicRoughness.baseColorFactor;
}

it.each(['cherry-round', 'cherry-cluster', 'maple-round', 'maple-cluster'])('keeps %s authored accent color with grey AO vertices across tones', name => {
  const rgba = readGlbMaterialRgba(name, 'leaves');
  const root = new THREE.Group(), geometry = new THREE.BufferGeometry(), map = new THREE.Texture();
  geometry.setAttribute('color', new THREE.Float32BufferAttribute([.6, .6, .6], 3));
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(rgba[0], rgba[1], rgba[2]), vertexColors: true, map, alphaTest: .5 });
  const mesh = new THREE.Mesh(geometry, material); mesh.userData.treeRole = 'leaves'; mesh.userData.simpleTree = true; root.add(mesh);
  const accent = material.color.clone(), ao = Array.from(geometry.attributes.color.array);
  expect(accent.r).toBeGreaterThan(accent.g);
  const tone = createEnvironmentTone(root);
  for (const next of ['komorebi', 'tiny-delivery', 'original'] as const) {
    tone.setTone(next); tone.refresh();
    expect(material.color).toEqual(accent);
    expect(Array.from(geometry.attributes.color.array)).toEqual(ao);
  }
  expect(material.map).toBe(map); expect(material.alphaTest).toBe(.5);
  geometry.dispose(); material.dispose(); map.dispose();
});

it.each(['cypress-round', 'willow-round', 'pine-round', 'round'])('honors userData.treeRole === "wood" so low-chroma %s trunks stay warm brown wood instead of stone grey', name => {
  const rgba = readGlbMaterialRgba(name, 'bark');
  // Verify the regression precondition: linear chroma < 0.12 previously triggered stone classification.
  expect(Math.max(rgba[0], rgba[1], rgba[2]) - Math.min(rgba[0], rgba[1], rgba[2])).toBeLessThan(.12);
  const root = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(rgba[0], rgba[1], rgba[2]) });
  const woodMesh = new THREE.Mesh(new THREE.BoxGeometry(), woodMat);
  woodMesh.userData.treeRole = 'wood';
  woodMesh.userData.simpleTree = true;
  const stoneMat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(rgba[0], rgba[1], rgba[2]) });
  const stoneMesh = new THREE.Mesh(new THREE.BoxGeometry(), stoneMat);
  root.add(woodMesh, stoneMesh);

  const original = woodMat.color.clone();
  const tone = createEnvironmentTone(root, false);
  tone.setTone('komorebi');
  // Warm brown wood retains R > G > B; lavender-grey stone flips to B > R.
  expect(woodMat.color.r).toBeGreaterThan(woodMat.color.g);
  expect(woodMat.color.g).toBeGreaterThan(woodMat.color.b);
  expect(stoneMat.color.b).toBeGreaterThan(stoneMat.color.r);

  tone.setTone('original');
  expect(woodMat.color.equals(original)).toBe(true);
  woodMesh.geometry.dispose(); woodMat.dispose();
  stoneMesh.geometry.dispose(); stoneMat.dispose();
});

it('calibrates daylight Simple Tree green leaves into warm meadow green while preserving species depth and avoiding dark teal crush', () => {
  const root = new THREE.Group();
  const makeLeaf = (name: string) => {
    const rgba = readGlbMaterialRgba(name, 'leaves');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('color', new THREE.Float32BufferAttribute([.65, .65, .65], 3));
    const material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(rgba[0], rgba[1], rgba[2]), vertexColors: true });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.treeRole = 'leaves';
    mesh.userData.simpleTree = true;
    root.add(mesh);
    return { geometry, material };
  };
  const oak = makeLeaf('round'), cypress = makeLeaf('cypress-round'), acer = makeLeaf('acer-round'), toona = makeLeaf('toona-round');
  const oldTeal = new THREE.Color(KOMOREBI_PALETTE.foliage);

  const tone = createEnvironmentTone(root, false);
  tone.setTone('komorebi');
  // All green species move into warm yellow-green (R > B), unlike cold teal KOMOREBI_PALETTE.foliage (B > R).
  expect(oldTeal.b).toBeGreaterThan(oldTeal.r);
  for (const sample of [oak, cypress, acer, toona]) {
    expect(sample.material.color.r).toBeGreaterThan(sample.material.color.b);
    expect(sample.material.color.g).toBeGreaterThan(sample.material.color.r);
  }
  // Lighter broadleaf oak remains visibly brighter than deep evergreen cypress.
  expect(oak.material.color.g).toBeGreaterThan(cypress.material.color.g);

  for (const sample of [oak, cypress, acer, toona]) { sample.geometry.dispose(); sample.material.dispose(); }
});

it('keeps night Simple Tree green leaves legible instead of crushing them to near-black teal', () => {
  const root = new THREE.Group();
  const makeNightLeaf = (name: string) => {
    const rgba = readGlbMaterialRgba(name, 'leaves');
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('color', new THREE.Float32BufferAttribute([.77, .77, .77], 3));
    const material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(rgba[0], rgba[1], rgba[2]), vertexColors: true });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.treeRole = 'leaves';
    mesh.userData.simpleTree = true;
    root.add(mesh);
    return { geometry, material };
  };
  const toona = makeNightLeaf('toona-round'), acer = makeNightLeaf('acer-round'), cypress = makeNightLeaf('cypress-round');
  const oldNightTeal = new THREE.Color(KOMOREBI_PALETTE.foliage).multiplyScalar(.62);

  const tone = createEnvironmentTone(root, true);
  tone.setTone('komorebi');
  for (const sample of [toona, acer, cypress]) {
    expect(sample.material.color.g).toBeGreaterThan(oldNightTeal.g * 1.7);
    expect(sample.material.color.r).toBeGreaterThan(oldNightTeal.r * 3);
  }
  for (const sample of [toona, acer, cypress]) { sample.geometry.dispose(); sample.material.dispose(); }
});

it('retains flowering tree colors when a palette is applied after the tree loads', () => {
  const root = new THREE.Group(), geometry = new THREE.BufferGeometry();
  geometry.setAttribute('color', new THREE.Float32BufferAttribute([.9, .3, .5], 3));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geometry, material); mesh.userData.treeRole = 'leaves'; root.add(mesh);
  createEnvironmentTone(root).setTone('tiny-delivery');
  const color = new THREE.Color().fromBufferAttribute(geometry.attributes.color, 0);
  expect(color.r).toBeGreaterThan(color.g);
  geometry.dispose(); material.dispose();
});

it('recolors background props and vertex foliage reversibly, including late loaded trees', () => {
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial({ color: 0x609030 });
  const geometry = new THREE.BoxGeometry();
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(geometry.attributes.position.count).fill([.2, .5, .1]).flat(), 3));
  const mesh = new THREE.Mesh(geometry, material); root.add(mesh);
  const colors = Array.from(geometry.attributes.color.array), original = material.color.clone();
  const tone = createEnvironmentTone(root);
  tone.setTone('tiny-delivery');
  expect(Array.from(geometry.attributes.color.array)).not.toEqual(colors);
  const late = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color: 0x876543 })); root.add(late);
  const lateColor = late.material.color.clone(); tone.refresh();
  expect(late.material.color.equals(lateColor)).toBe(false);
  tone.setTone('original');
  expect(Array.from(geometry.attributes.color.array)).toEqual(colors);
  expect(material.color.equals(original)).toBe(true);
  expect(late.material.color.equals(lateColor)).toBe(true);
  geometry.dispose(); material.dispose(); late.geometry.dispose(); late.material.dispose();
});

it('applies display-referred Komorebi daylight shade to day clouds and restores on other tones or night', () => {
  const dayRoot = new THREE.Group();
  const dayClouds = createToonCloudBackdrop('day');
  dayRoot.add(dayClouds.root);
  const dayLayer = dayClouds.root.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  const originalColor = (dayLayer.material.uniforms.uColor.value as THREE.Color).clone();
  const daylight = dayLayer.material.userData.komorebiDaylight;

  const dayTone = createEnvironmentTone(dayRoot, false);
  dayTone.setTone('komorebi');
  expect(dayLayer.material.uniforms.uShadeAmount.value).toBeCloseTo(daylight.amount);
  expect((dayLayer.material.uniforms.uColor.value as THREE.Color).equals(daylight.color)).toBe(true);
  expect((dayLayer.material.uniforms.uShade.value as THREE.Color).equals(daylight.shade)).toBe(true);

  dayTone.setTone('tiny-delivery');
  expect(dayLayer.material.uniforms.uShadeAmount.value).toBe(0);
  expect((dayLayer.material.uniforms.uColor.value as THREE.Color).equals(daylight.color)).toBe(false);

  dayTone.setTone('original');
  expect(dayLayer.material.uniforms.uShadeAmount.value).toBe(0);
  expect((dayLayer.material.uniforms.uColor.value as THREE.Color).equals(originalColor)).toBe(true);

  const nightRoot = new THREE.Group();
  const nightClouds = createToonCloudBackdrop('night');
  nightRoot.add(nightClouds.root);
  const nightLayer = nightClouds.root.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  const nightTone = createEnvironmentTone(nightRoot, true);
  nightTone.setTone('komorebi');
  expect(nightLayer.material.uniforms.uShadeAmount.value).toBe(0);

  dayClouds.dispose();
  nightClouds.dispose();
});

it('routes backdropCanopy leaves to KOMOREBI_PALETTE.canopy while keeping non-canopy foliage and pink blossoms distinct', () => {
  const root = new THREE.Group();
  const makeLeaves = (backdropCanopy: boolean) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.2, 0.55, 0.15, 0.85, 0.35, 0.55], 3));
    const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData.treeRole = 'leaves';
    if (backdropCanopy) mesh.userData.backdropCanopy = true;
    root.add(mesh);
    return { geometry, material, mesh };
  };
  const canopy = makeLeaves(true);
  const foliage = makeLeaves(false);
  const original = Array.from(canopy.geometry.attributes.color.array);

  const tone = createEnvironmentTone(root, false);
  tone.setTone('komorebi');

  const canopyGreen = new THREE.Color().fromBufferAttribute(canopy.geometry.attributes.color, 0);
  const foliageGreen = new THREE.Color().fromBufferAttribute(foliage.geometry.attributes.color, 0);
  const canopyPink = new THREE.Color().fromBufferAttribute(canopy.geometry.attributes.color, 1);

  expect(canopyGreen.r).toBeGreaterThan(foliageGreen.r);
  expect(canopyGreen.b).toBeLessThan(foliageGreen.b);
  expect(canopyPink.r).toBeCloseTo(0.85);
  expect(canopyPink.g).toBeCloseTo(0.35);
  expect(canopyPink.b).toBeCloseTo(0.55);

  tone.setTone('original');
  expect(Array.from(canopy.geometry.attributes.color.array)).toEqual(original);
  expect(Array.from(foliage.geometry.attributes.color.array)).toEqual(original);

  canopy.geometry.dispose(); canopy.material.dispose();
  foliage.geometry.dispose(); foliage.material.dispose();
});

it('does not remap vertex colors on userData.stonePath meshes during environment-tone visitation', () => {
  const root = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.78, 0.73, 0.63, 0.72, 0.68, 0.59], 3));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'courtyard-stone-path';
  mesh.userData.stonePath = true;
  root.add(mesh);

  const original = Array.from(geometry.attributes.color.array);
  const tone = createEnvironmentTone(root, false);
  tone.setTone('komorebi');
  tone.refresh();
  expect(Array.from(geometry.attributes.color.array)).toEqual(original);
  tone.setTone('tiny-delivery');
  tone.refresh();
  expect(Array.from(geometry.attributes.color.array)).toEqual(original);
  tone.setTone('original');
  expect(Array.from(geometry.attributes.color.array)).toEqual(original);

  geometry.dispose();
  material.dispose();
});
