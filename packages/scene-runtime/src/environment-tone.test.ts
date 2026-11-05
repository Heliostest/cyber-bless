import * as THREE from 'three';
import { expect, it } from 'vitest';
import { createEnvironmentTone } from './environment-tone';
import { readFileSync } from 'node:fs';

it.each(['cherry-round', 'cherry-cluster'])('keeps %s authored pink base color with grey AO vertices in the delivery palette', name => {
  const file = readFileSync(new URL(`../../../assets/environments/trees/simple-tree/${name}.glb`, import.meta.url));
  const gltf = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString('utf8'));
  const rgba = gltf.materials.find((material: { name: string }) => material.name === 'leaves').pbrMetallicRoughness.baseColorFactor;
  const root = new THREE.Group(), geometry = new THREE.BufferGeometry(), map = new THREE.Texture();
  geometry.setAttribute('color', new THREE.Float32BufferAttribute([.6, .6, .6], 3));
  const material = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(rgba[0], rgba[1], rgba[2]), vertexColors: true, map, alphaTest: .5 });
  const mesh = new THREE.Mesh(geometry, material); mesh.userData.treeRole = 'leaves'; root.add(mesh);
  const pink = material.color.clone(), ao = Array.from(geometry.attributes.color.array);
  expect(pink.r).toBeGreaterThan(pink.g);
  const tone = createEnvironmentTone(root); tone.setTone('tiny-delivery'); tone.refresh();
  expect(material.color).toEqual(pink);
  expect(Array.from(geometry.attributes.color.array)).toEqual(ao);
  expect(material.map).toBe(map); expect(material.alphaTest).toBe(.5);
  tone.setTone('original'); expect(material.color).toEqual(pink);
  geometry.dispose(); material.dispose(); map.dispose();
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
