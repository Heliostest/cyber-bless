import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createFurinPaintedFlowers } from './painted-flowers';

describe('furin painted flowers', () => {
  it('keeps two four-petal motifs opaque so they remain legible on transmissive glass', () => {
    const flowers = createFurinPaintedFlowers(.26);
    expect(flowers.children).toHaveLength(2);
    for (const flower of flowers.children) {
      expect(flower.children.filter(part => part.name.includes('petal'))).toHaveLength(4);
      for (const part of flower.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[]) {
        expect(part.material.transparent).toBe(false);
        expect(part.material.opacity).toBe(1);
        expect(part.material.metalness).toBe(0);
        expect(part.castShadow).toBe(false);
        expect(part.userData.toonSurface.outline).toBe(false);
      }
    }
  });

  it('conforms paint and outward normals to the glass rather than floating as flat decals', () => {
    const radius = .26, flowers = createFurinPaintedFlowers(radius);
    flowers.traverse(part => {
      if (!(part instanceof THREE.Mesh)) return;
      const positions = part.geometry.getAttribute('position'), normals = part.geometry.getAttribute('normal');
      for (let i = 0; i < positions.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(positions, i);
        const normal = new THREE.Vector3().fromBufferAttribute(normals, i);
        expect(point.length()).toBeCloseTo(radius + .0015, 6);
        expect(normal.dot(point.clone().normalize())).toBeGreaterThan(.999);
        expect(point.z).toBeGreaterThan(0);
        expect(point.y).toBeGreaterThan(radius * Math.cos(Math.PI * .55));
      }
    });
  });
});
