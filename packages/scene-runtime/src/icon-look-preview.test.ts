import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { applyCraftSurface } from './craft-surfaces';
import { createRitualMaterial } from './ritual-optics';
import { applyIconLookLighting, createIconLookPreview, createIconLookSurfaces } from './icon-look-preview';

describe('four-object icon-look trial', () => {
  it('releases partial material arrays when a later clone fails', () => {
    const first=new THREE.MeshStandardMaterial(), last=new THREE.MeshPhysicalMaterial(), derived=first.clone(), released=vi.fn(); derived.addEventListener('dispose',released);
    vi.spyOn(first,'clone').mockReturnValue(derived); vi.spyOn(last,'clone').mockImplementation(()=>{throw Error('clone failure')});
    const scene=new THREE.Scene(), sources=[first,last], mesh=new THREE.Mesh(new THREE.BoxGeometry(),sources); scene.add(mesh);
    const adapter=createIconLookSurfaces('omamori-cycle'); expect(()=>adapter.apply(scene)).toThrow('clone failure'); expect(mesh.material).toBe(sources);
    adapter.dispose(); expect(released).toHaveBeenCalledTimes(1);
  });
  it('does not activate or allocate for the regular App host or unsupported scene', () => {
    const renderer = { domElement: { closest: () => null } } as unknown as THREE.WebGLRenderer;
    expect(createIconLookPreview(renderer, new THREE.Scene(), new THREE.Camera(), 'woodfish')).toBeUndefined();
    renderer.domElement.closest = () => ({ dataset: { iconLookPreview: 'icon' } }) as unknown as HTMLElement;
    expect(createIconLookPreview(renderer, new THREE.Scene(), new THREE.Camera(), 'crane')).toBeUndefined();
  });

  it('restores an exact material array and never disposes scene-owned maps', () => {
    const map = new THREE.Texture(), release = vi.fn(); map.addEventListener('dispose', release);
    const cloth = applyCraftSurface(new THREE.MeshStandardMaterial({ color: 0xd79485, map }), { kind: 'fabric' });
    const unlit = new THREE.MeshBasicMaterial(), originals = [cloth, unlit];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), originals), scene = new THREE.Scene(); scene.add(mesh);
    const adapter = createIconLookSurfaces('omamori-cycle'), before = cloth.color.clone();
    const frame = adapter.apply(scene), styled = mesh.material as THREE.Material[];
    expect(styled).not.toBe(originals); expect(styled[1]).toBe(unlit);
    expect((styled[0] as THREE.MeshStandardMaterial).map).toBe(map);
    expect(cloth.color.equals(before)).toBe(true);
    expect(styled[0].customProgramCacheKey()).toContain('wbr-craft');
    const derivedReleased = vi.fn(); styled[0].addEventListener('dispose', derivedReleased);
    frame.restore(); expect(mesh.material).toBe(originals);
    cloth.opacity = .43; cloth.emissive.set(0x935a32); cloth.emissiveIntensity = .24;
    const next = adapter.apply(scene);
    expect((mesh.material as THREE.MeshStandardMaterial[])[0].opacity).toBe(.43);
    expect((mesh.material as THREE.MeshStandardMaterial[])[0].emissive.equals(cloth.emissive)).toBe(true);
    next.restore(); adapter.dispose(); adapter.dispose();
    expect(derivedReleased).toHaveBeenCalledTimes(1); expect(release).not.toHaveBeenCalled();
  });

  it('preserves the glass optics and leaves the surrounding world materials alone', () => {
    const glass = createRitualMaterial({ color: 0xd2efff, transmission: .76 }, { kind: 'glass', thickness: .035 });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(), glass), scene = new THREE.Scene(); scene.add(mesh);
    const environment = new THREE.Group(); environment.name = 'cozy-environment'; scene.add(environment);
    const foliage = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); environment.add(foliage);
    const original = foliage.material, adapter = createIconLookSurfaces('furin-wind-chime'), frame = adapter.apply(scene);
    const styled = mesh.material as THREE.MeshPhysicalMaterial;
    expect(styled).toBeInstanceOf(THREE.MeshPhysicalMaterial); expect(styled.transmission).toBe(.8); expect((glass as THREE.MeshPhysicalMaterial).transmission).toBe(.76);
    expect(styled.thickness).toBe(.035); expect(styled.customProgramCacheKey()).toContain('ritual');
    expect(foliage.material).toBe(original); frame.restore(); expect(mesh.material).toBe(glass); adapter.dispose();
  });

  it('releases replaced and detached derived surfaces without releasing their sources', () => {
    const scene = new THREE.Scene(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); scene.add(mesh);
    const adapter = createIconLookSurfaces('woodfish'), first = adapter.apply(scene);
    const released = vi.fn(); (mesh.material as THREE.Material).addEventListener('dispose', released); first.restore();
    mesh.material = new THREE.MeshStandardMaterial(); adapter.apply(scene).restore(); expect(released).toHaveBeenCalledTimes(1);
    const frame = adapter.apply(scene), detached = vi.fn(); (mesh.material as THREE.Material).addEventListener('dispose', detached); frame.restore();
    scene.remove(mesh); adapter.apply(scene).restore(); expect(detached).toHaveBeenCalledTimes(1); adapter.dispose();
  });

  it('restores light and shadow properties exactly and preserves animated local lights', () => {
    const scene = new THREE.Scene(), sun = new THREE.DirectionalLight(0xffaadd, 3.8), sky = new THREE.HemisphereLight(0xaabbff, 0x886633, .6);
    const lamp = new THREE.PointLight(0xff7700, .73); sun.shadow.radius = 1; sun.shadow.intensity = .92; scene.add(sun, sky, lamp);
    const color = sun.color.clone(), ground = sky.groundColor.clone(), position = sun.position.clone();
    const frame = applyIconLookLighting(scene); expect(sun.shadow.intensity).toBeLessThan(.92); expect(lamp.intensity).toBe(.73);
    frame.restore(); expect(sun.color.equals(color)).toBe(true); expect(sun.intensity).toBe(3.8);
    expect(sun.shadow.radius).toBe(1); expect(sun.shadow.intensity).toBe(.92); expect(sky.groundColor.equals(ground)).toBe(true);
    expect(sun.position.equals(position)).toBe(true);
  });

  it('adds pouch fullness with the same outline, restores its geometry and keeps decoration above the cloth', () => {
    const shape = new THREE.Shape(); shape.moveTo(-.22,-.34); shape.lineTo(.22,-.34); shape.lineTo(.23,.2); shape.lineTo(.15,.34); shape.lineTo(-.15,.34); shape.lineTo(-.23,.2); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .17, bevelEnabled: true, bevelSize: .02, bevelThickness: .025, bevelSegments: 3 }); geometry.translate(0,0,-.085); geometry.computeBoundingBox();
    const root = new THREE.Group(); root.name = 'omamori-pouch-coral'; const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()); mesh.name = 'omamori-pouch-body-coral'; root.add(mesh);
    const motif = new THREE.Mesh(new THREE.CircleGeometry(.04), new THREE.MeshStandardMaterial()); motif.position.z = .12; root.add(motif);
    const scene = new THREE.Scene(); scene.add(root); const adapter = createIconLookSurfaces('omamori-cycle'); const frame = adapter.apply(scene);
    expect(mesh.geometry.boundingBox!.max.z).toBeGreaterThan(geometry.boundingBox!.max.z);
    expect(mesh.geometry.boundingBox!.max.x).toBeCloseTo(geometry.boundingBox!.max.x, 5);
    expect(motif.position.z).toBeGreaterThan(mesh.geometry.boundingBox!.max.z);
    const sourceReleased = vi.fn(); geometry.addEventListener('dispose', sourceReleased);
    frame.restore(); expect(mesh.geometry).toBe(geometry); expect(motif.position.z).toBe(.12);
    adapter.dispose(); expect(sourceReleased).not.toHaveBeenCalled();
  });
});
