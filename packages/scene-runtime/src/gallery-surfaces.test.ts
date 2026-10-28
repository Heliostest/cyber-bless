import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createGallerySurfaces, gallerySubjects, isGallerySurfaceStyle } from './gallery-surfaces';
import { createRitualMaterial } from './ritual-optics';
import { normalizeStyleParameters } from './render-style-parameters';

function compile(material: THREE.Material, kind: keyof typeof THREE.ShaderLib = 'standard') {
  const source = THREE.ShaderLib[kind];
  const shader = { uniforms: THREE.UniformsUtils.clone(source.uniforms), vertexShader: source.vertexShader, fragmentShader: source.fragmentShader };
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

describe('optional gallery surface adapters', () => {
  it('recognizes surface modes without claiming postprocess modes', () => {
    expect(['gallery-toon', 'pencil-hatch', 'height-palette', 'normal-palette'].every(isGallerySurfaceStyle)).toBe(true);
    expect(isGallerySurfaceStyle('space-grade')).toBe(false);
    expect(isGallerySurfaceStyle('original')).toBe(false);
  });

  it.each(['gallery-toon', 'pencil-hatch', 'height-palette', 'normal-palette'] as const)('preserves authored textures and restores the exact material after %s', style => {
    const map = new THREE.Texture(), normalMap = new THREE.Texture();
    const original = new THREE.MeshPhysicalMaterial({ map, normalMap, color: 0x78a993, clearcoat: .6, side: THREE.DoubleSide, vertexColors: true });
    const scene = new THREE.Scene(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), original); scene.add(mesh);
    const surfaces = createGallerySurfaces(style), frame = surfaces.apply(scene);
    const styled = mesh.material as THREE.MeshPhysicalMaterial;
    expect(styled).not.toBe(original);
    expect(styled).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect([styled.map, styled.normalMap, styled.side, styled.vertexColors, styled.clearcoat]).toEqual([map, normalMap, THREE.DoubleSide, true, .6]);
    expect(frame.outlined).toEqual([mesh]);
    const mapDisposed = vi.fn(), originalDisposed = vi.fn(); map.addEventListener('dispose', mapDisposed); original.addEventListener('dispose', originalDisposed);
    frame.restore(); frame.restore(); surfaces.dispose(); surfaces.dispose();
    expect(mesh.material).toBe(original);
    expect(mapDisposed).not.toHaveBeenCalled(); expect(originalDisposed).not.toHaveBeenCalled();
    original.dispose(); map.dispose(); normalMap.dispose(); mesh.geometry.dispose();
  });

  it('omits transparent, cutout and specialized meshes, keeping no-outline hints out of normal selection', () => {
    const scene = new THREE.Scene(), geometry = new THREE.BoxGeometry();
    const materials = [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial({ transparent: true }),
      new THREE.MeshPhysicalMaterial({ transmission: .4 }), new THREE.MeshStandardMaterial({ alphaTest: .3 }),
      new THREE.MeshBasicMaterial(), new THREE.ShaderMaterial(), new THREE.MeshStandardMaterial()];
    const meshes = materials.map(material => new THREE.Mesh(geometry, material));
    meshes[6].userData.toonSurface = { outline: false };
    scene.add(...meshes);
    const hidden = new THREE.Group(), child = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()); hidden.visible = false; hidden.add(child); scene.add(hidden);
    expect(gallerySubjects(scene)).toEqual([meshes[0]]);
    const adapter = createGallerySurfaces('gallery-toon'), frame = adapter.apply(scene);
    expect(frame.outlined).toEqual([meshes[0]]);
    expect(meshes.slice(1,6).every((mesh, i) => mesh.material === materials[i + 1])).toBe(true);
    frame.restore(); adapter.dispose(); geometry.dispose(); materials.forEach(material => material.dispose());
  });

  it.each(['gallery-toon', 'pencil-hatch', 'height-palette', 'normal-palette'] as const)('still applies %s when every subject opts out of outlines', style => {
    const scene = new THREE.Scene(), source = new THREE.MeshStandardMaterial({ color: 0x6d997b });
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(), source); mesh.userData.toonSurface = { outline: false }; scene.add(mesh);
    const adapter = createGallerySurfaces(style), frame = adapter.apply(scene);
    expect(mesh.material).not.toBe(source);
    expect(frame.outlined).toEqual([]); expect(gallerySubjects(scene)).toEqual([]);
    frame.restore(); expect(mesh.material).toBe(source);
    adapter.dispose(); source.dispose(); mesh.geometry.dispose();
  });

  it('keeps height palette independent of another mode shade-level controls', () => {
    const scene = new THREE.Scene(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); scene.add(mesh);
    const adapter = createGallerySurfaces('height-palette'); let frame = adapter.apply(scene);
    const styled = mesh.material as THREE.Material, shader = compile(styled);
    expect(shader.uniforms.galleryLevels).toBeUndefined();
    frame.restore(); adapter.setParameters(normalizeStyleParameters({ galleryLevels: 8 })); frame = adapter.apply(scene);
    expect(mesh.material).toBe(styled); expect(compile(styled).uniforms.galleryLevels).toBeUndefined();
    frame.restore(); adapter.dispose(); (mesh.material as THREE.Material).dispose(); mesh.geometry.dispose();
  });

  it('keeps animated colors, glow and optical finish on a cached material', () => {
    const source = new THREE.MeshPhysicalMaterial({ clearcoat: .3 }), scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source); scene.add(mesh);
    const adapter = createGallerySurfaces('gallery-toon'); let frame = adapter.apply(scene);
    const styled = mesh.material as THREE.MeshPhysicalMaterial; frame.restore();
    source.color.setHex(0x993377); source.emissive.setHex(0xee6633); source.emissiveIntensity = .72;
    source.opacity = .45; source.roughness = .17; source.clearcoat = .8; source.attenuationColor.setHex(0xcca844);
    frame = adapter.apply(scene);
    expect(mesh.material).toBe(styled);
    expect([styled.color.getHex(), styled.emissive.getHex(), styled.emissiveIntensity, styled.opacity, styled.roughness, styled.clearcoat, styled.attenuationColor.getHex()])
      .toEqual([0x993377, 0xee6633, .72, .45, .17, .8, 0xcca844]);
    frame.restore(); adapter.dispose(); source.dispose(); mesh.geometry.dispose();
  });

  it('retains shader defines required by an authored compile hook', () => {
    const source = new THREE.MeshStandardMaterial();
    source.defines = { ...source.defines, AUTHORED_PATTERN: 1 };
    const scene = new THREE.Scene(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), source); scene.add(mesh);
    const adapter = createGallerySurfaces('gallery-toon'); let frame = adapter.apply(scene);
    const styled = mesh.material as THREE.MeshStandardMaterial;
    expect(styled.defines.AUTHORED_PATTERN).toBe(1);
    frame.restore(); source.defines.AUTHORED_PATTERN = 2; source.needsUpdate = true;
    frame = adapter.apply(scene);
    expect(mesh.material).toBe(styled); expect(styled.defines.AUTHORED_PATTERN).toBe(2);
    frame.restore(); adapter.dispose(); source.dispose(); mesh.geometry.dispose();
  });

  it('owns clone lifetimes across source replacement, in-place material-array edits and removal', () => {
    const a = new THREE.MeshStandardMaterial(), b = new THREE.MeshLambertMaterial(), c = new THREE.MeshPhongMaterial();
    const originals = [a, b], mesh = new THREE.Mesh(new THREE.BoxGeometry(), originals), scene = new THREE.Scene(); scene.add(mesh);
    const adapter = createGallerySurfaces('pencil-hatch'); let frame = adapter.apply(scene);
    const first = mesh.material as THREE.Material[], released = vi.fn(); first.forEach(material => material.addEventListener('dispose', released));
    expect(first.map(material => material.type)).toEqual(['MeshStandardMaterial', 'MeshLambertMaterial']);
    frame.restore(); expect(mesh.material).toBe(originals); originals[1] = c;
    frame = adapter.apply(scene); const next = mesh.material as THREE.Material[];
    expect(next[1]).toBeInstanceOf(THREE.MeshPhongMaterial); expect(released).toHaveBeenCalledTimes(2); frame.restore();
    const removed = vi.fn(); next.forEach(material => material.addEventListener('dispose', removed)); scene.remove(mesh);
    adapter.apply(scene).restore(); expect(removed).toHaveBeenCalledTimes(2);
    adapter.dispose(); expect(removed).toHaveBeenCalledTimes(2);
    [a,b,c].forEach(material => material.dispose()); mesh.geometry.dispose();
  });

  it('retains source shader hooks and keeps shared optical fibers alive until clone disposal', () => {
    const source = createRitualMaterial({ color: 0xe7ba78 }, { kind: 'paper' });
    const originalHook = source.onBeforeCompile; source.onBeforeCompile = function(shader, renderer) {
      originalHook.call(this, shader, renderer); shader.uniforms.authoredUniform = { value: .42 };
    };
    const texture = compile(source).uniforms.ritualFiberMap.value as THREE.Texture;
    const textureDisposed = vi.fn(); texture.addEventListener('dispose', textureDisposed);
    const scene = new THREE.Scene(), mesh = new THREE.Mesh(new THREE.BoxGeometry(), source); scene.add(mesh);
    const adapter = createGallerySurfaces('pencil-hatch'), frame = adapter.apply(scene), styled = mesh.material as THREE.Material;
    const shader = compile(styled);
    expect(shader.uniforms.authoredUniform.value).toBe(.42);
    expect(shader.uniforms.ritualFiberMap.value).toBe(texture);
    expect(shader.uniforms.galleryPencilScale.value).toBe(24);
    expect(styled.customProgramCacheKey()).not.toBe(source.customProgramCacheKey());
    frame.restore(); source.dispose(); expect(textureDisposed).not.toHaveBeenCalled();
    adapter.dispose(); expect(textureDisposed).toHaveBeenCalledOnce(); mesh.geometry.dispose();
  });

  it('updates uniforms and normalized world height bounds without rebuilding cached materials', () => {
    const source = new THREE.MeshStandardMaterial(), mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), source), scene = new THREE.Scene(); mesh.position.y = 5; scene.add(mesh);
    const adapter = createGallerySurfaces('height-palette'); let frame = adapter.apply(scene);
    const styled = mesh.material as THREE.Material, shader = compile(styled);
    expect(shader.uniforms.galleryHeightRange.value.toArray()).toEqual([4,6]);
    frame.restore(); adapter.setParameters(normalizeStyleParameters({ galleryLevels: 7, pencilScale: 38, paletteStrength: .3 }));
    mesh.position.y = 8; frame = adapter.apply(scene);
    expect(mesh.material).toBe(styled);
    expect(shader.uniforms.galleryHeightRange.value.toArray()).toEqual([7,9]);
    expect(shader.uniforms.galleryPaletteStrength.value).toBe(.3);
    frame.restore(); adapter.dispose(); source.dispose(); mesh.geometry.dispose();
  });
});
