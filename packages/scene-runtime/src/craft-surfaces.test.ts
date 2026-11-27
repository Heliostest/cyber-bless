import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCraftMaterial, copyCraftSurface, applyCraftSurface, hasCraftFinish } from './craft-surfaces';
import { getProceduralNoiseAtlas } from './procedural-noise-atlas';
import { createRitualMaterial } from './ritual-optics';
import { createToonSurfaces } from './toon-surfaces';
import { createGallerySurfaces } from './gallery-surfaces';

function compile(material: THREE.Material) {
  const library = material instanceof THREE.MeshToonMaterial ? THREE.ShaderLib.toon : THREE.ShaderLib.standard;
  const shader = { vertexShader: library.vertexShader, fragmentShader: library.fragmentShader, uniforms: THREE.UniformsUtils.clone(library.uniforms) };
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

describe('craft material style compatibility', () => {
  it('applies detail to the same Physical material without replacing its finish or owned maps', () => {
    const map = new THREE.Texture(), original = new THREE.MeshPhysicalMaterial({ color: 0x996633, map, clearcoat: .4, roughness: .67 });
    const result = applyCraftSurface(original, { kind: 'wood', strength: .3 });
    expect(result).toBe(original); expect(result.clearcoat).toBe(.4); expect(result.roughness).toBe(.67); expect(result.map).toBe(map);
    const first = compile(original);
    applyCraftSurface(original, { kind: 'wood', strength: .3 });
    expect(compile(original).fragmentShader.match(/#define WBR_CRAFT_SURFACE/g)).toHaveLength(1);
    expect(first.uniforms.craftStrength.value).toBe(.3);
    original.dispose(); map.dispose();
  });

  it('combines existing cloth light transmission and new weave through both style adapters', () => {
    const source = createRitualMaterial({ color: 0x99b6a8 }, { kind: 'cloth', fiber: false });
    applyCraftSurface(source, { kind: 'fabric', strength: .35 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), source), scene = new THREE.Scene(); scene.add(mesh);
    for (const adapter of [createToonSurfaces('toon-soft'), createGallerySurfaces('pencil-hatch')]) {
      const frame = adapter.apply(scene), shader = compile(mesh.material as THREE.Material);
      expect(shader.uniforms.craftStrength.value).toBe(.35);
      expect(shader.uniforms.ritualScatterStrength.value).toBe(.16);
      expect(shader.fragmentShader.match(/#define WBR_CRAFT_SURFACE/g)).toHaveLength(1);
      frame.restore(); expect(mesh.material).toBe(source); adapter.dispose();
    }
    source.dispose(); mesh.geometry.dispose();
  });
  it.each(['wood', 'ceramic', 'metal', 'fabric', 'cord', 'bamboo', 'straw', 'stone', 'lacquer', 'terracotta'] as const)('keeps the %s height field free of derivatives before evaluating its gradient', kind => {
    const material = createCraftMaterial({}, { kind }), shader = compile(material);
    const visited = new Set<string>();
    const executable = shader.fragmentShader.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(executable).not.toMatch(/\b(?:undefined|NaN|Infinity)\b/);
    expect(shader.vertexShader.split('\n').filter(line => /\S.*#/.test(line))).toEqual([]);
    expect(shader.fragmentShader.split('\n').filter(line => /\S.*#/.test(line))).toEqual([]);
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

  it('uses mean-attenuated 3D wood rings with per-mesh seed, sparse knots, highlight shoulder, and non-zero bamboo fiber pigment', () => {
    const wood = createCraftMaterial({ color: 0xd5af7b }, { kind: 'wood', strength: .4 });
    const bamboo = applyCraftSurface(new THREE.MeshStandardMaterial({ color: 0x9cc66e, roughness: .9 }), { kind: 'bamboo', strength: .38, axis: 'y' });
    const stone = createCraftMaterial({ color: 0xb9b9a5 }, { kind: 'stone', strength: .4 });
    const woodShader = compile(wood), bambooShader = compile(bamboo), stoneShader = compile(stone);
    expect(woodShader.vertexShader).toContain('modelMatrix[3].xyz');
    expect(woodShader.vertexShader).toContain('craftMeshSeed');
    expect(woodShader.vertexShader.split('\n').filter(line => /\S.*#/.test(line))).toEqual([]);
    expect(woodShader.fragmentShader).toContain('craftWoodRing');
    expect(woodShader.fragmentShader).toContain('craftWoodKnotField');
    expect(woodShader.fragmentShader).toContain('craftKnotAmber');
    expect(woodShader.fragmentShader).not.toMatch(/smoothstep\s*\(\s*0\.45/);
    expect(woodShader.fragmentShader).toContain('craftPeak > 0.72');
    expect(bambooShader.vertexShader).not.toContain('craftMeshSeed');
    expect(bambooShader.fragmentShader).toContain('craftBambooStriation');
    expect(bambooShader.fragmentShader).toContain('0.22');
    expect(bambooShader.fragmentShader).toContain('craftPeak > 0.78');
    expect(stoneShader.fragmentShader).not.toContain('craftPeak');
    [wood, bamboo, stone].forEach(material => material.dispose());
  });

  it('upgrades straw with stylized longitudinal fibers, culm nodes, warm/dry hue shift, highlight shoulder, and optional woven/reed patterns', () => {
    const stalk = applyCraftSurface(new THREE.MeshStandardMaterial({ color: 0xdabb78, roughness: .85 }), { kind: 'straw', strength: .3, axis: 'y' });
    const woven = createCraftMaterial({ color: 0xc5a15b }, { kind: 'straw', pattern: 'woven', strength: .42, axis: 'y' });
    const reed = createCraftMaterial({ color: 0x91a36c }, { kind: 'straw', pattern: 'reed', strength: .36, axis: 'y' });
    const stalkShader = compile(stalk), wovenShader = compile(woven), reedShader = compile(reed);

    // Default kind: 'straw' stays backward compatible while lifting fiber relief, hue variation, and Komorebi highlight protection.
    expect(stalk.userData.craftSurface).toEqual({ kind: 'straw', scale: 1, strength: .3, axis: 'y', pattern: 'stalk' });
    expect(stalkShader.vertexShader).toContain('craftStrawSeed');
    expect(stalkShader.vertexShader.split('\n').filter(line => /\S.*#/.test(line))).toEqual([]);
    expect(stalkShader.fragmentShader.split('\n').filter(line => /\S.*#/.test(line))).toEqual([]);
    expect(stalkShader.fragmentShader).toContain('craftStrawStalkField');
    expect(stalkShader.fragmentShader).toContain('craftStrawTint');
    expect(stalkShader.fragmentShader).toContain('craftStrawFurrow');
    expect(stalkShader.fragmentShader).toContain('craftPeak > 0.70');
    expect(stalkShader.fragmentShader).not.toContain('craftGrain * 0.08');

    // Optional woven and reed modes compile cleanly with distinct program cache keys and derivative-free height fields.
    expect(woven.roughness).toBeCloseTo(.72, 5);
    expect(woven.userData.craftSurface).toMatchObject({ kind: 'straw', pattern: 'woven' });
    expect(reed.userData.craftSurface).toMatchObject({ kind: 'straw', pattern: 'reed' });
    expect(new Set([stalk.customProgramCacheKey(), woven.customProgramCacheKey(), reed.customProgramCacheKey()]).size).toBe(3);
    expect(wovenShader.fragmentShader).toContain('craftStrawWovenField');
    expect(wovenShader.fragmentShader).toContain('craftPeak > 0.70');
    expect(reedShader.fragmentShader).toContain('164.0');
    expect(reedShader.fragmentShader).toContain('13.5');

    // Verify woven and reed height fields stay free of screen-space derivatives before normal gradient evaluation.
    for (const shader of [wovenShader, reedShader]) {
      const visited = new Set<string>();
      const check = (name: string) => {
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
      };
      check('craftHeightPattern');
    }

    // Style adapter copy preserves optional straw pattern mode.
    const copied = new THREE.MeshStandardMaterial();
    copyCraftSurface(woven, copied);
    expect(copied.userData.craftSurface).toEqual(woven.userData.craftSurface);
    expect(compile(copied).fragmentShader).toContain('craftStrawWovenField');

    [stalk, woven, reed, copied].forEach(material => material.dispose());
  });

  it('binds the shared noise atlas on ceramic, metal, stone, fabric, cord, lacquer, and terracotta with craft-specific shading and finish guards', () => {
    const atlas = getProceduralNoiseAtlas();
    const ceramic = createCraftMaterial({ color: 0xb8ccb8 }, { kind: 'ceramic', axis: 'y' });
    const metal = createCraftMaterial({ color: 0xc9a054 }, { kind: 'metal', axis: 'y' });
    const stone = createCraftMaterial({ color: 0x99988f }, { kind: 'stone' });
    const fabric = createCraftMaterial({ color: 0xd8cdb8 }, { kind: 'fabric' });
    const cord = createCraftMaterial({ color: 0xc95a4b }, { kind: 'cord' });
    const lacquer = createCraftMaterial({ color: 0x7a1c16 }, { kind: 'lacquer' });
    const terracotta = createCraftMaterial({ color: 0xb86b49 }, { kind: 'terracotta' });

    expect(lacquer).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect((lacquer as THREE.MeshPhysicalMaterial).clearcoat).toBeCloseTo(0.76, 5);
    expect((lacquer as THREE.MeshPhysicalMaterial).clearcoatRoughness).toBeCloseTo(0.16, 5);
    expect(lacquer.roughness).toBeCloseTo(0.32, 5);
    expect(lacquer.metalness).toBe(0);
    expect(terracotta.roughness).toBeCloseTo(0.88, 5);

    expect(hasCraftFinish(ceramic)).toBe(true);
    expect(hasCraftFinish(metal)).toBe(true);
    expect(hasCraftFinish(lacquer)).toBe(true);
    expect(hasCraftFinish(terracotta)).toBe(false);
    expect(hasCraftFinish(stone)).toBe(false);

    for (const mat of [ceramic, metal, stone, fabric, cord, lacquer, terracotta]) {
      const shader = compile(mat);
      expect(shader.uniforms.craftNoiseAtlas?.value).toBe(atlas);
      expect(shader.fragmentShader).toContain('wbrAtlasTriplanar');
    }

    const ceramicShader = compile(ceramic);
    expect(ceramicShader.fragmentShader).toContain('craftCeramicPattern');
    expect(ceramicShader.fragmentShader).toContain('craftGlazePool');
    expect(ceramicShader.fragmentShader).toContain('craftPeak > 0.80');
    expect(ceramicShader.fragmentShader).toContain('0.18');

    const metalShader = compile(metal);
    expect(metalShader.fragmentShader).toContain('craftMetalPattern');
    expect(metalShader.fragmentShader).toContain('craftMetalPatina');
    expect(metalShader.fragmentShader).toContain('0.18, 0.68');

    const fabricShader = compile(fabric);
    const cordShader = compile(cord);
    expect(fabricShader.fragmentShader).toContain('craftClothSheen');
    expect(cordShader.fragmentShader).toContain('craftClothSheen');

    const lacquerShader = compile(lacquer);
    expect(lacquerShader.fragmentShader).toContain('craftLacquerPattern');
    expect(lacquerShader.fragmentShader).toContain('craftPeak > 0.78');

    const terracottaShader = compile(terracotta);
    expect(terracottaShader.fragmentShader).toContain('craftTerracottaPattern');
    expect(terracottaShader.fragmentShader).toContain('craftPeak > 0.76');

    [ceramic, metal, stone, fabric, cord, lacquer, terracotta].forEach(material => material.dispose());
  });
});
