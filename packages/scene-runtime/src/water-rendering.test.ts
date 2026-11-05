import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createStylizedWater } from './stylized-water';
import { createRitualMaterial } from './ritual-optics';
import { createWaterRendering } from './water-rendering';

describe('water rendering override', () => {
  it('uses the actual hit geometry and restores materials even when drawing fails', () => {
    const scene = new THREE.Scene(), geometry = new THREE.CircleGeometry(1, 32);
    const water = createStylizedWater({ geometry });
    water.surface.rotation.x = -Math.PI / 2; scene.add(water.surface); scene.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(.2, 2, .1), new THREE.Vector3(0, -1, 0));
    const before = ray.intersectObject(water.surface)[0];
    const original = water.surface.material, bed = water.bed.material;
    const override = createWaterRendering(scene);
    const frame = override.apply('toon-water');
    try {
      expect(frame.surfaces).toBe(1);
      const material = water.surface.material as unknown as THREE.ShaderMaterial;
      expect(material).toBeInstanceOf(THREE.ShaderMaterial);
      expect(material.uniforms.uWaveHeight.value).toBe(0);
      expect(material.uniforms.uOpacity.value).toBe(original.opacity);
      expect(water.bed.material).toBe(bed);
      expect(water.surface.geometry).toBe(geometry);
      expect(ray.intersectObject(water.surface)[0].point.distanceTo(before.point)).toBeLessThan(1e-6);
      throw Error('draw failed');
    } catch (error) { expect((error as Error).message).toBe('draw failed'); }
    finally { frame.restore(); }
    expect(water.surface.material).toBe(original);
    override.dispose(); water.dispose();
  });

  it('supports UV-less pools, mixed materials and changing opacity without overriding pigment or sake', () => {
    const scene = new THREE.Scene();
    const material = createRitualMaterial({ transparent: true, opacity: .6 }, { kind: 'water' });
    const pigment = createRitualMaterial({}, { kind: 'water' }); pigment.userData.waterRendering = false;
    const solid = new THREE.MeshStandardMaterial();
    const geometry = new THREE.PlaneGeometry(3, 3).rotateX(-Math.PI / 2); geometry.deleteAttribute('uv');
    const mesh = new THREE.Mesh(geometry, [solid, material]), excluded = new THREE.Mesh(geometry, pigment);
    scene.add(mesh, excluded);
    const override = createWaterRendering(scene), original = mesh.material;
    let frame = override.apply('toon-water');
    const toon = mesh.material[1] as THREE.ShaderMaterial;
    expect(frame.surfaces).toBe(1);
    expect(mesh.material[0]).toBe(solid); expect(excluded.material).toBe(pigment);
    expect(toon.defines.WBR_WATER_PROJECTED).toBe(1);
    frame.restore(); expect(mesh.material).toBe(original);
    material.opacity = .25;
    frame = override.apply('toon-water');
    expect(mesh.material[1]).toBe(toon); expect(toon.uniforms.uOpacity.value).toBe(.25);
    frame.restore();
    const release = vi.spyOn(toon, 'dispose'), sourceRelease = vi.spyOn(material, 'dispose');
    override.dispose(); override.dispose();
    expect(release).toHaveBeenCalledOnce(); expect(sourceRelease).not.toHaveBeenCalled();
  });

  it('freezes time during reduced motion or inactivity and clamps resume deltas', () => {
    const override = createWaterRendering(new THREE.Scene());
    override.update(10, { active: true, reducedMotion: false });
    expect(override.time).toBeCloseTo(.1);
    for (const state of [{ active: false, reducedMotion: false }, { active: true, reducedMotion: true }]) override.update(1, state);
    for (const dt of [NaN, Infinity, -1]) override.update(dt, { active: true, reducedMotion: false });
    expect(override.time).toBeCloseTo(.1);
    override.update(.02, { active: true, reducedMotion: false });
    expect(override.time).toBeCloseTo(.12);
    override.dispose();
    override.update(.02, { active: true, reducedMotion: false });
    expect(override.time).toBeCloseTo(.12);
  });
});
