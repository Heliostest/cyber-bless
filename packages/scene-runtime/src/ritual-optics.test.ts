import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createRitualMaterial, copyRitualOptics } from './ritual-optics';
import { createToonSurfaces } from './toon-surfaces';
import { createCozyEnvironment } from './cozy-environment';

function compile(material: THREE.Material, type: 'standard' | 'physical' | 'toon' = 'standard') {
  const library = THREE.ShaderLib[type];
  const shader = { uniforms: THREE.UniformsUtils.clone(library.uniforms), vertexShader: library.vertexShader, fragmentShader: library.fragmentShader };
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

describe('ritual optical surfaces', () => {
  it('applies opt-in paper structure to both reflected and internal light and retains it in styled clones', () => {
    const structure = { layout: 'bands' as const, spacing: .085, width: .13, contrast: .6, halfHeight: .34 };
    const paper = createRitualMaterial({ emissive: 0xff9530, emissiveIntensity: .4 }, { kind: 'paper', fiber: false, paper: structure });
    const original = compile(paper);
    expect(original.uniforms.ritualPaperSpacing?.value).toBe(.085);
    expect(original.uniforms.ritualPaperContrast?.value).toBe(.6);
    expect(original.fragmentShader).toContain('ritualPaperClearance');
    expect(original.fragmentShader).toContain('totalEmissiveRadiance *=');
    expect(paper.userData.ritualOptics.paper).toEqual(structure);
    const scene = new THREE.Scene(), mesh = new THREE.Mesh(new THREE.PlaneGeometry(), paper); scene.add(mesh);
    for (const style of ['toon-soft', 'toon-ink', 'gouache'] as const) {
      const adapter = createToonSurfaces(style), frame = adapter.apply(scene);
      const styled = mesh.material as THREE.MeshStandardMaterial;
      const shader = compile(styled, styled instanceof THREE.MeshToonMaterial ? 'toon' : 'standard');
      expect(shader.uniforms.ritualPaperSpacing?.value).toBe(.085);
      expect(shader.uniforms.ritualPaperContrast?.value).toBe(.6);
      expect(shader.fragmentShader).toContain('totalEmissiveRadiance *=');
      expect([styled.transparent, styled.opacity]).toEqual([false, 1]);
      frame.restore(); adapter.dispose();
    }
    paper.dispose(); mesh.geometry.dispose();
  });

  it('separates radial, banded and ordinary paper shader topology without changing ordinary paper', () => {
    const ordinary = createRitualMaterial({}, { kind: 'paper', fiber: false });
    const bands = createRitualMaterial({}, { kind: 'paper', fiber: false, paper: { layout: 'bands', spacing: .1, width: .1, contrast: .6 } });
    const radial = createRitualMaterial({}, { kind: 'paper', fiber: false, paper: { layout: 'radial', spacing: Math.PI / 12, width: .1, contrast: .48 } });
    expect(new Set([ordinary, bands, radial].map(m => m.customProgramCacheKey())).size).toBe(3);
    expect(compile(ordinary).fragmentShader).not.toContain('ritualPaperClearance');
    expect(compile(radial).fragmentShader).toContain('atan(ritualLocalPosition.z, ritualLocalPosition.x)');
    [ordinary, bands, radial].forEach(m => m.dispose());
  });

  it('adds light-driven paper scattering without see-through alpha or emissive', () => {
    const map = new THREE.Texture();
    const paper = createRitualMaterial({ color: 0xe99c68, side: THREE.DoubleSide, map, vertexColors: true, roughness: .91 }, { kind: 'paper' });
    const shader = compile(paper);
    expect(shader.fragmentShader).toContain('ritualScatterStrength');
    expect(shader.fragmentShader).toContain('directLight.color');
    expect(shader.fragmentShader).toContain('ritualFiberMap');
    expect([paper.transparent, paper.opacity, paper.emissive.getHex()]).toEqual([false, 1, 0]);
    expect([paper.map, paper.side, paper.vertexColors]).toEqual([map, THREE.DoubleSide, true]);
    paper.dispose(); map.dispose();
  });

  it.each(['toon-soft', 'toon-outline', 'gouache', 'toon-ink'] as const)('keeps scattering and fiber shader through %s and restores original material', style => {
    const original = createRitualMaterial({ color: 0x99b6a8, emissive: 0xff9966, emissiveIntensity: .1 }, { kind: 'cloth' });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), original), scene = new THREE.Scene(); scene.add(mesh);
    const surfaces = createToonSurfaces(style), frame = surfaces.apply(scene);
    const material = mesh.material as THREE.MeshStandardMaterial;
    const shader = compile(material, material instanceof THREE.MeshToonMaterial ? 'toon' : 'standard');
    expect(shader.fragmentShader).toContain('ritualScatterStrength');
    expect(shader.fragmentShader).toContain('ritualFiberMap');
    expect(frame.outlined).toContain(mesh);
    frame.restore(); expect(mesh.material).toBe(original);
    original.emissiveIntensity = .73;
    const next = surfaces.apply(scene);
    expect((mesh.material as THREE.MeshStandardMaterial).emissiveIntensity).toBe(.73);
    next.restore(); surfaces.dispose(); original.dispose(); mesh.geometry.dispose();
  });

  it('uses Physical glass and tinted volume without losing original paint and side', () => {
    const glass = createRitualMaterial({ color: 0x6098cc, opacity: .55, transparent: true, side: THREE.DoubleSide, roughness: .08 }, { kind: 'glass', thickness: .025 });
    expect(glass).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    const physical = glass as THREE.MeshPhysicalMaterial;
    expect([physical.opacity, physical.metalness, physical.side]).toEqual([1, 0, THREE.DoubleSide]);
    expect(physical.transmission).toBeGreaterThan(0);
    expect(physical.thickness).toBe(.025);
    expect(physical.color.getHex()).toBe(0x6098cc);
    physical.dispose();
  });

  it('keeps opaque wet food and respects an animated water stream starting invisible', () => {
    const wet = createRitualMaterial({ color: 0xf2ead0, roughness: .78 }, { kind: 'wet' });
    expect(wet.roughness).toBeLessThan(.4);
    expect([wet.opacity, wet.transparent]).toEqual([1, false]);
    const water = createRitualMaterial({ opacity: 0 }, { kind: 'water' });
    expect(water.opacity).toBe(0);
    expect(water.transparent).toBe(true);
    expect(createRitualMaterial({}, { kind: 'water' }).opacity).toBeGreaterThanOrEqual(.5);
    wet.dispose(); water.dispose();
  });

  it('copies custom optics once and retains another shader hook with a distinct cache key', () => {
    const source = createRitualMaterial({}, { kind: 'jade', fiber: false });
    const target = new THREE.MeshStandardMaterial();
    const hook = vi.fn(); target.onBeforeCompile = hook;
    copyRitualOptics(source, target); copyRitualOptics(source, target);
    const shader = compile(target);
    expect(hook).toHaveBeenCalledOnce();
    expect(shader.fragmentShader.match(/void ritualScatter\(/g)).toHaveLength(1);
    expect(target.customProgramCacheKey()).toContain('ritual-optics-v1');
    source.dispose(); target.dispose();
  });

  it('keeps shared fiber alive while a styled material uses it and releases at the last owner', () => {
    const source = createRitualMaterial({}, { kind: 'paper' });
    const target = new THREE.MeshStandardMaterial(); copyRitualOptics(source, target);
    const texture = compile(source).uniforms.ritualFiberMap.value as THREE.Texture;
    expect(compile(target).uniforms.ritualFiberMap.value).toBe(texture);
    const disposed = vi.fn(); texture.addEventListener('dispose', disposed);
    source.dispose(); expect(disposed).not.toHaveBeenCalled();
    target.dispose(); expect(disposed).toHaveBeenCalledOnce();
  });

  it('keeps alpha-one glass and honey out of the hosts opaque shadow promotion', async () => {
    const scene = new THREE.Scene();
    const glass = createRitualMaterial({}, { kind: 'glass' }), honey = createRitualMaterial({}, { kind: 'honey' });
    const paper = createRitualMaterial({}, { kind: 'paper' });
    const meshes = [glass, honey, paper].map(material => new THREE.Mesh(new THREE.SphereGeometry(.2, 8, 6), material));
    scene.add(...meshes);
    const world = createCozyEnvironment(scene, { id: 'furin-wind-chime', loadSky: async () => new THREE.DataTexture() })!;
    const renderer = { shadowMap: { enabled: false, type: THREE.PCFShadowMap } } as THREE.WebGLRenderer;
    world.prepare(renderer);
    expect([glass.opacity, honey.opacity]).toEqual([1, 1]);
    expect(meshes.map(mesh => mesh.castShadow)).toEqual([false, false, true]);
    await world.ready; world.dispose();
    meshes.forEach(mesh => mesh.geometry.dispose()); [glass, honey, paper].forEach(material => material.dispose());
  });

  it('synchronizes animated optical PBR parameters on cached styled clones', () => {
    const source = createRitualMaterial({ transparent: false }, { kind: 'honey' }) as THREE.MeshPhysicalMaterial;
    const scene = new THREE.Scene(), mesh = new THREE.Mesh(new THREE.SphereGeometry(), source); scene.add(mesh);
    const surfaces = createToonSurfaces('toon-ink'); let frame = surfaces.apply(scene);
    const styled = mesh.material as THREE.MeshPhysicalMaterial;
    expect(styled).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    frame.restore();
    source.transmission = .42; source.roughness = .17; source.clearcoat = .58; source.attenuationColor.setHex(0xddaa33);
    frame = surfaces.apply(scene);
    expect(mesh.material).toBe(styled);
    expect([styled.transmission, styled.roughness, styled.clearcoat, styled.attenuationColor.getHex()]).toEqual([.42, .17, .58, 0xddaa33]);
    frame.restore(); surfaces.dispose(); source.dispose(); mesh.geometry.dispose();
  });
});
