import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createSoftPlume, createSurfaceRipple } from './soft-plume';
import { getProceduralNoiseAtlas } from './procedural-noise-atlas';

describe('soft plume and surface ripple kit', () => {
  it('builds ribbon strands + instanced wisps marked as non-raycasted, non-outlined effects', () => {
    const plume = createSoftPlume({ kind: 'steam', strands: 2, wisps: 9, seed: 42 });
    expect(plume.root.userData.effect).toBe(true);

    const meshes: THREE.Mesh[] = [];
    plume.root.traverse(obj => {
      if (obj instanceof THREE.Mesh) meshes.push(obj);
    });

    // 2 ribbon strands + 1 InstancedMesh of 9 wisps
    expect(meshes).toHaveLength(3);
    const instanced = meshes.find(m => m instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    expect(instanced).toBeInstanceOf(THREE.InstancedMesh);
    expect(instanced.count).toBe(9);

    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0.2, 2), new THREE.Vector3(0, 0, -1));
    const atlas = getProceduralNoiseAtlas();

    for (const mesh of meshes) {
      expect(mesh.userData.effect).toBe(true);
      expect(mesh.userData.toonSurface).toEqual({ outline: false });
      expect(mesh.castShadow).toBe(false);
      expect(mesh.receiveShadow).toBe(false);
      expect(raycaster.intersectObject(mesh, false)).toEqual([]);

      const mat = mesh.material as THREE.ShaderMaterial;
      expect(mat.transparent).toBe(true);
      expect(mat.depthWrite).toBe(false);
      expect(mat.uniforms.uNoiseAtlas.value).toBe(atlas);
    }

    plume.dispose();
  });

  it('supports all plume kinds, cylindrical camera billboarding, and safe environmentWind sampling', () => {
    for (const kind of ['incense', 'steam', 'hearth', 'aroma'] as const) {
      const handle = createSoftPlume({ kind });
      expect(handle.root.children.length).toBeGreaterThanOrEqual(1);
      handle.dispose();
    }

    const scene = new THREE.Scene();
    const windSample = vi.fn((_x: number, _y: number, _z: number, out?: THREE.Vector3) => {
      const v = out ?? new THREE.Vector3();
      return v.set(0.4, 0.05, -0.2);
    });
    scene.userData.environmentWind = { sample: windSample };

    const plume = createSoftPlume({ kind: 'incense', strands: 2, wisps: 4 });
    plume.root.position.set(0.5, 0.1, 0);
    scene.add(plume.root);

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10);
    camera.position.set(2.5, 0.6, 0);
    camera.lookAt(plume.root.position);

    const strandsGroup = plume.root.getObjectByName('soft-plume-strands')!;
    const firstStrand = strandsGroup.children[0] as THREE.Mesh;
    const mat = firstStrand.material as THREE.ShaderMaterial;
    const t0 = mat.uniforms.uTime.value as number;

    plume.update(0.05, camera, { scene });

    expect(windSample).toHaveBeenCalled();
    expect(mat.uniforms.uTime.value).toBeGreaterThan(t0);
    expect((mat.uniforms.uWind.value as THREE.Vector3).length()).toBeGreaterThan(0);
    // Camera is along +X relative to plume -> cylindrical yaw points toward +X (~PI/2).
    expect(strandsGroup.rotation.y).toBeCloseTo(Math.PI / 2, 3);

    // Intensity = 0 hides children and sets uniform cleanly.
    plume.setIntensity(0);
    expect(mat.uniforms.uIntensity.value).toBe(0);
    expect(strandsGroup.visible).toBe(false);

    plume.dispose();
  });

  it('freezes time advancement in reducedMotion while keeping a calm static wisp', () => {
    const plume = createSoftPlume({ kind: 'incense', strands: 2, wisps: 4 });
    const strandsGroup = plume.root.getObjectByName('soft-plume-strands')!;
    const mat = (strandsGroup.children[0] as THREE.Mesh).material as THREE.ShaderMaterial;
    const tBefore = mat.uniforms.uTime.value as number;

    plume.update(0.08, undefined, { reducedMotion: true });
    plume.update(0.08, undefined, { reducedMotion: true });

    expect(mat.uniforms.uTime.value).toBe(tBefore);
    expect(mat.uniforms.uReducedMotion.value).toBe(1);
    expect(strandsGroup.visible).toBe(true);

    plume.dispose();
  });

  it('disposes owned plume GPU resources cleanly without disposing the shared noise atlas', () => {
    const atlas = getProceduralNoiseAtlas();
    const atlasDisposed = vi.fn();
    atlas.addEventListener('dispose', atlasDisposed);

    const plume = createSoftPlume({ kind: 'hearth', strands: 2, wisps: 6 });
    const disposedMaterials = vi.fn();
    const disposedGeometries = vi.fn();
    const seenGeos = new Set<THREE.BufferGeometry>();

    plume.root.traverse(obj => {
      if (obj instanceof THREE.Mesh) {
        (obj.material as THREE.Material).addEventListener('dispose', disposedMaterials);
        if (!seenGeos.has(obj.geometry)) {
          seenGeos.add(obj.geometry);
          obj.geometry.addEventListener('dispose', disposedGeometries);
        }
      }
    });

    plume.dispose();
    // Second dispose is a safe no-op.
    plume.dispose();

    expect(disposedMaterials).toHaveBeenCalledTimes(3);
    expect(disposedGeometries).toHaveBeenCalledTimes(2);
    expect(atlasDisposed).not.toHaveBeenCalled();
    atlas.removeEventListener('dispose', atlasDisposed);
  });

  it('pools surface ripple rings, guards raycast/outline/effect, handles continuous mode and reducedMotion', () => {
    const ripple = createSurfaceRipple({ radius: 0.22, maxRings: 3, duration: 1.0 });
    expect(ripple.root.userData.effect).toBe(true);

    const rings = ripple.root.children as THREE.Mesh[];
    expect(rings).toHaveLength(3);

    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0));
    for (const ring of rings) {
      expect(ring.userData.effect).toBe(true);
      expect(ring.userData.toonSurface).toEqual({ outline: false });
      expect(ring.castShadow).toBe(false);
      expect(ring.receiveShadow).toBe(false);
      expect(ring.visible).toBe(false);
      expect(raycaster.intersectObject(ring, false)).toEqual([]);
    }

    // Triggering activates a ring at the impact point and advances/fades over duration.
    ripple.trigger(0.05, -0.04, 0.9);
    expect(rings.filter(r => r.visible)).toHaveLength(1);
    expect(rings[0].position.x).toBeCloseTo(0.05, 5);
    expect(rings[0].position.z).toBeCloseTo(-0.04, 5);

    ripple.update(0.1, false);
    const progressMid = (rings[0].material as THREE.ShaderMaterial).uniforms.uProgress.value as number;
    expect(progressMid).toBeCloseTo(0.1, 5);

    // Advance past duration -> ring finishes and hides.
    for (let i = 0; i < 12; i++) ripple.update(0.1, false);
    expect(rings.some(r => r.visible)).toBe(false);

    // Continuous emission staggers multiple rings.
    ripple.setContinuous(true, 0.02, 0.03);
    expect(rings.filter(r => r.visible)).toHaveLength(1);
    for (let i = 0; i < 8; i++) ripple.update(0.06, false);
    expect(rings.filter(r => r.visible).length).toBeGreaterThanOrEqual(2);

    // Reduced motion hides all rings immediately.
    ripple.update(0.05, true);
    expect(rings.every(r => !r.visible)).toBe(true);

    // Clean disposal without harming the shared noise atlas.
    const matDisposed = vi.fn();
    for (const ring of rings) (ring.material as THREE.Material).addEventListener('dispose', matDisposed);
    ripple.dispose();
    ripple.dispose();
    expect(matDisposed).toHaveBeenCalledTimes(3);
  });
});
