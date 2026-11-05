import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCraftMaterial, copyCraftSurface } from './craft-surfaces';
import { createToonSurfaces } from './toon-surfaces';
import { createGallerySurfaces } from './gallery-surfaces';

function compile(material: THREE.Material) {
  const library = material instanceof THREE.MeshToonMaterial ? THREE.ShaderLib.toon : THREE.ShaderLib.standard;
  const shader = { vertexShader: library.vertexShader, fragmentShader: library.fragmentShader, uniforms: THREE.UniformsUtils.clone(library.uniforms) };
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

describe('craft material style compatibility', () => {
  it.each(['wood', 'ceramic', 'metal', 'fabric', 'cord'] as const)('keeps the %s height field free of derivatives before evaluating its gradient', kind => {
    const material = createCraftMaterial({}, { kind }), shader = compile(material);
    const visited = new Set<string>();
    function check(name: string) {
      if (visited.has(name)) return;
      visited.add(name);
      const start = shader.fragmentShader.indexOf(`float ${name}(`);
      expect(start, `Missing height function ${name}`).toBeGreaterThanOrEqual(0);
      const open = shader.fragmentShader.indexOf('{', start);
      let end = open + 1, depth = 1;
      for (; depth && end < shader.fragmentShader.length; end++) {
        if (shader.fragmentShader[end] === '{') depth++;
        if (shader.fragmentShader[end] === '}') depth--;
      }
      const body = shader.fragmentShader.slice(open + 1, end - 1);
      expect(body).not.toMatch(/\b(?:fwidth|dFdx|dFdy)\s*\(/);
      for (const match of body.matchAll(/\b(craft\w+)\s*\(/g)) check(match[1]);
    }
    check('craftHeightPattern'); material.dispose();
  });
  it('keeps preprocessor directives on their own lines when extending Three shaders', () => {
    const material = createCraftMaterial({}, { kind: 'wood' });
    const shader = compile(material);
    expect(shader.fragmentShader.split('\n').filter(line => /\S.*#/.test(line))).toEqual([]);
    material.dispose();
  });
  // A lost onBeforeCompile hook removes the authored surface from the rendered object.
  it.each(['toon-soft', 'toon-ink', 'gouache'] as const)('retains wood detail and pigment in %s, restoring the original material', style => {
    const map = new THREE.Texture(), disposed = vi.fn(); map.addEventListener('dispose', disposed);
    const source = createCraftMaterial({ color: 0xd5af7b, map }, { kind: 'wood', strength: .4 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source), scene = new THREE.Scene(); scene.add(mesh);
    const adapter = createToonSurfaces(style), frame = adapter.apply(scene);
    const target = mesh.material as THREE.MeshToonMaterial;
    expect(target.map).toBe(map); expect(target.color.getHex()).toBe(0xd5af7b);
    expect(compile(target).uniforms.craftStrength.value).toBe(.4);
    source.color.setHex(0xb18e65); frame.restore(); adapter.apply(scene).restore();
    expect(target.color.getHex()).toBe(0xb18e65);
    expect(mesh.material).toBe(source);
    adapter.dispose(); expect(disposed).not.toHaveBeenCalled();
    source.dispose(); map.dispose(); mesh.geometry.dispose();
  });

  // Treating this as ordinary diffuse paint loses the bell's metal reflection.
  it('keeps metal reflection and animated roughness through cached soft styling', () => {
    const source = createCraftMaterial({ color: 0xd8b468, roughness: .52, metalness: .72 }, { kind: 'metal' });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(), [source, source]), scene = new THREE.Scene(); scene.add(mesh);
    const adapter = createToonSurfaces('toon-soft'); let frame = adapter.apply(scene);
    const [target] = mesh.material as THREE.MeshStandardMaterial[];
    expect(target).toBeInstanceOf(THREE.MeshStandardMaterial); expect(target.metalness).toBe(.72);
    expect(target.roughness).toBe(.52); expect(compile(target).uniforms.craftStrength.value).toBeGreaterThan(0);
    frame.restore(); source.roughness = .43; source.emissiveIntensity = .4;
    frame = adapter.apply(scene);
    expect((mesh.material as THREE.MeshStandardMaterial[])[0]).toBe(target);
    expect(target.roughness).toBe(.43); expect(target.emissiveIntensity).toBe(.4);
    frame.restore(); expect(mesh.material).toEqual([source, source]);
    adapter.dispose(); source.dispose(); mesh.geometry.dispose();
  });

  it('keeps a matte ceramic body and a broad physical highlight together in soft styling', () => {
    const source = createCraftMaterial({ color: 0x293c40, roughness: .61 }, { kind: 'ceramic' });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(), source), scene = new THREE.Scene(); scene.add(mesh);
    const adapter = createToonSurfaces('toon-soft'), frame = adapter.apply(scene);
    const target = mesh.material as THREE.MeshStandardMaterial;
    expect(target).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(target.roughness).toBe(.61); expect(target.metalness).toBe(0);
    expect(compile(target).uniforms.craftStrength.value).toBeGreaterThan(0);
    frame.restore(); adapter.dispose(); source.dispose(); mesh.geometry.dispose();
  });

  it('composes with an existing shader hook and does not duplicate the detail in gallery clones', () => {
    const source = createCraftMaterial({}, { kind: 'fabric' });
    const before = source.onBeforeCompile;
    source.onBeforeCompile = function(shader, renderer) {
      before.call(this, shader, renderer); shader.uniforms.authoredDetail = { value: 7 };
    };
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source), scene = new THREE.Scene(); scene.add(mesh);
    const adapter = createGallerySurfaces('pencil-hatch'), frame = adapter.apply(scene);
    const shader = compile(mesh.material as THREE.Material);
    expect(shader.uniforms.authoredDetail.value).toBe(7);
    expect(shader.uniforms.craftStrength.value).toBeGreaterThan(0);
    expect(shader.fragmentShader.match(/#define WBR_CRAFT_SURFACE/g)).toHaveLength(1);
    frame.restore(); adapter.dispose(); source.dispose(); mesh.geometry.dispose();
  });

  it('normalizes invalid artist inputs and leaves ordinary materials alone', () => {
    const source = createCraftMaterial({}, { kind: 'cord', scale: NaN, strength: Infinity });
    const target = new THREE.MeshToonMaterial(); copyCraftSurface(source, target);
    const shader = compile(target);
    expect(shader.uniforms.craftScale.value).toBe(1);
    expect(shader.uniforms.craftStrength.value).toBe(.65);
    const ordinary = new THREE.MeshStandardMaterial(), unpatched = new THREE.MeshToonMaterial();
    copyCraftSurface(ordinary, unpatched);
    expect(compile(unpatched).uniforms.craftStrength).toBeUndefined();
    [source, target, ordinary, unpatched].forEach(material => material.dispose());
  });
});
