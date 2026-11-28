import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import type { CourtyardSkinId } from './courtyard-skins';
import {
  createGardenCourtyardPad,
  gardenPavingEdgeScale,
  isInsideGardenPaving,
} from './garden-courtyard-paving';

describe('organic garden courtyard paving', () => {
  const skins: readonly CourtyardSkinId[] = [
    'none',
    'japanese-karesansui',
    'chinese-jiangnan',
    'warm-terracotta-arch',
  ];

  it.each(skins)(
    'builds organic undulating curbs, flat central footprint, matte Komorebi stone, and clean disposal for skin %s',
    skin => {
      const pad = createGardenCourtyardPad({ floor: -0.04, night: false, skin, spring: false });
      try {
        expect(pad.mesh.name).toBe('garden-path');
        expect(pad.mossMesh).toBeInstanceOf(THREE.Mesh);
        expect(pad.mossMesh!.name).toBe('garden-path-moss');

        const mat = pad.mesh.material as THREE.MeshPhongMaterial;
        expect(mat).toBeInstanceOf(THREE.MeshPhongMaterial);
        expect(mat.userData.komorebiSurface).toBe(true);
        expect(mat.userData.komorebiPigment).toBe(true);
        expect(mat.vertexColors).toBe(true);
        expect(mat.shininess).toBeLessThanOrEqual(8);

        const pos = pad.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        expect(pos.count).toBeGreaterThan(800);
        expect(pos.count).toBeLessThan(18000);

        // Keep central ritual footprint flat within <= 5mm.
        let centerMaxY = -Infinity;
        // Measure outer curb normalized elliptical radius variation to prove organic silhouette.
        let minOuterEr = Infinity;
        let maxOuterEr = -Infinity;
        const binMaxEr = new Float32Array(36).fill(0);

        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          const z = pos.getZ(i);
          if (Math.hypot(x, z) < 1.5) {
            centerMaxY = Math.max(centerMaxY, y);
          }
          const er = Math.hypot(x / 2.86, z / 2.20);
          if (er > 0.90) {
            const angle = (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2);
            const bin = Math.min(35, Math.floor((angle / (Math.PI * 2)) * 36));
            if (er > binMaxEr[bin]!) binMaxEr[bin] = er;
          }
        }
        for (let b = 0; b < 36; b++) {
          if (binMaxEr[b]! > 0) {
            minOuterEr = Math.min(minOuterEr, binMaxEr[b]!);
            maxOuterEr = Math.max(maxOuterEr, binMaxEr[b]!);
          }
        }

        expect(centerMaxY).toBeLessThanOrEqual(0.005);
        // Non-uniform organic outer edge silhouette (not a fixed geometric oval).
        expect(maxOuterEr - minOuterEr).toBeGreaterThan(0.06);

        const bounds = new THREE.Box3().setFromObject(pad.mesh);
        expect(bounds.getSize(new THREE.Vector3()).z).toBeLessThan(6);

        // Tone switch round-trip without mutating vertex colors.
        const beforeColors = Array.from(pad.mesh.geometry.attributes.color!.array);
        pad.setTone('original');
        expect(pad.mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
        pad.setTone('komorebi');
        expect(pad.mesh.material).toBe(mat);
        expect(Array.from(pad.mesh.geometry.attributes.color!.array)).toEqual(beforeColors);

        const geoSpy = vi.spyOn(pad.mesh.geometry, 'dispose');
        const mossGeoSpy = vi.spyOn(pad.mossMesh!.geometry, 'dispose');
        pad.dispose();
        pad.dispose();
        expect(geoSpy).toHaveBeenCalledOnce();
        expect(mossGeoSpy).toHaveBeenCalledOnce();
      } finally {
        pad.dispose();
      }
    },
  );

  it('preserves the exact r = 1.36 spring center hole while giving the outer border organic stonework', () => {
    const pad = createGardenCourtyardPad({ floor: -0.025, night: false, skin: 'none', spring: true });
    try {
      expect(pad.mesh.name).toBe('garden-path');
      expect(pad.borderMesh).toBeInstanceOf(THREE.Mesh);
      expect(pad.borderMesh!.name).toBe('garden-path-border');
      expect((pad.borderMesh!.material as THREE.MeshPhongMaterial).shininess).toBeLessThanOrEqual(8);

      // Center spring basin stays unobstructed (raycast at origin misses the sand ring).
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0));
      expect(ray.intersectObject(pad.mesh, false)).toHaveLength(0);
      expect(ray.intersectObject(pad.borderMesh!, false)).toHaveLength(0);

      // Inner spring rim vertices stay strictly on or outside r = 1.36.
      const pos = pad.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      let minR = Infinity;
      for (let i = 0; i < pos.count; i++) {
        minR = Math.min(minR, Math.hypot(pos.getX(i), pos.getZ(i)));
      }
      expect(minR).toBeGreaterThanOrEqual(1.355);
    } finally {
      pad.dispose();
    }
  });

  it('provides seamless 2pi-periodic organic edge scaling and meadow avoidance bounds', () => {
    expect(gardenPavingEdgeScale(0, 101)).toBeCloseTo(gardenPavingEdgeScale(Math.PI * 2, 101), 6);
    const scales: number[] = [];
    for (let i = 0; i < 64; i++) {
      scales.push(gardenPavingEdgeScale((i / 64) * Math.PI * 2, 101));
    }
    expect(Math.max(...scales) - Math.min(...scales)).toBeGreaterThan(0.055);
    expect(isInsideGardenPaving(0, 0)).toBe(true);
    expect(isInsideGardenPaving(2.85, 0)).toBe(true);
    expect(isInsideGardenPaving(4.2, 0)).toBe(false);
    expect(isInsideGardenPaving(0, -3.5)).toBe(false);
  });
});
