import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyBotanicalSurface,
  copyBotanicalSurface,
  createBotanicalMaterial,
  hasBotanicalSurface,
  type BotanicalSurfaceOptions,
} from './botanical-surfaces';
import { createRitualMaterial } from './ritual-optics';
import { createToonSurfaces } from './toon-surfaces';

function compile(material: THREE.Material, type?: 'standard' | 'physical' | 'toon') {
  const resolved = type ?? (material instanceof THREE.MeshToonMaterial ? 'toon' : material instanceof THREE.MeshPhysicalMaterial ? 'physical' : 'standard');
  const library = THREE.ShaderLib[resolved];
  const shader = {
    vertexShader: library.vertexShader,
    fragmentShader: library.fragmentShader,
    uniforms: THREE.UniformsUtils.clone(library.uniforms),
  };
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

function assertHeightFieldDerivativeFree(fragmentShader: string) {
  const executable = fragmentShader.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  expect(executable).not.toMatch(/\b(?:undefined|NaN|Infinity)\b/);
  const visited = new Set<string>();
  const check = (name: string) => {
    if (visited.has(name)) return;
    visited.add(name);
    const start = fragmentShader.indexOf(`float ${name}(`);
    expect(start, `Missing helper function ${name}`).toBeGreaterThanOrEqual(0);
    const open = fragmentShader.indexOf('{', start);
    let end = open + 1;
    let depth = 1;
    for (; depth && end < fragmentShader.length; end++) {
      if (fragmentShader[end] === '{') depth++;
      if (fragmentShader[end] === '}') depth--;
    }
    const body = fragmentShader.slice(open + 1, end - 1);
    expect(body).not.toMatch(/\b(?:fwidth|dFdx|dFdy)\s*\(/);
    for (const match of body.matchAll(/\b(botanical\w+)\s*\(/g)) {
      if (match[1] !== 'botanicalCoords' && match[1] !== 'botanicalAlignedPos') check(match[1]!);
    }
  };
  check('botanicalHeight');
}

describe('procedural botanical surfaces', () => {
  const modes: [string, BotanicalSurfaceOptions][] = [
    ['petal (auto gradient)', { kind: 'petal' }],
    ['petal (3-color explicit)', { kind: 'petal', throatColor: 0xf0a629, midColor: 0xffe4b8, tipColor: 0xfffaf0, veinCount: 7 }],
    ['petal (local fallback)', { kind: 'petal', coord: 'local', axis: 'z', axialRange: [0, 0.2] }],
    ['leaf pinnate', { kind: 'leaf', venation: 'pinnate' }],
    ['leaf parallel', { kind: 'leaf', venation: 'parallel', foldRidge: 0.45 }],
    ['leaf needle (soft cluster)', { kind: 'leaf', venation: 'needle', softenClusterNormals: true }],
    ['leaf needle (crisp)', { kind: 'leaf', venation: 'needle', softenClusterNormals: false }],
    ['bud (instanced jasmine)', { kind: 'bud', calyxColor: 0x7ea053, bellyColor: 0xfff7e4 }],
    ['grain (instanced wheat)', { kind: 'grain', calyxColor: 0xa67c3b, bellyColor: 0xf1ca69 }],
    ['peel citrus', { kind: 'peel', peel: 'citrus' }],
    ['peel pome', { kind: 'peel', peel: 'pome', blushColor: 0xc94238, underColor: 0xd8c86c }],
    ['peel berry', { kind: 'peel', peel: 'berry' }],
    ['peel rind', { kind: 'peel', peel: 'rind' }],
  ];

  it.each(modes)('compiles %s cleanly with derivative-free height fields, clean preprocessor lines, and C1 shoulder', (_label, options) => {
    const material = createBotanicalMaterial({ color: 0x89aa64 }, options);
    expect(hasBotanicalSurface(material)).toBe(true);
    expect(material.metalness).toBe(0);
    for (const type of ['standard', 'physical', 'toon'] as const) {
      const shader = compile(material, type);
      expect(shader.fragmentShader).toContain('#define WBR_BOTANICAL_SURFACE');
      expect(shader.fragmentShader).toContain('WBR_BOTANICAL_SHOULDER');
      expect(shader.fragmentShader).toContain('botanicalPeak > 0.74');
      expect(shader.vertexShader.split('\n').filter(line => /\S.*#/.test(line))).toEqual([]);
      expect(shader.fragmentShader.split('\n').filter(line => /\S.*#/.test(line))).toEqual([]);
      // Never derive instance seed from modelMatrix so draggable flowers/fruits never swim.
      expect(shader.vertexShader).not.toContain('modelMatrix[3]');
      expect(shader.vertexShader).toContain('USE_INSTANCING');
      expect(shader.vertexShader).toContain('instanceMatrix[3].xyz');
      const vNormalRef = shader.fragmentShader.indexOf('vNormal');
      const normalPars = shader.fragmentShader.indexOf('#include <normal_pars_fragment>');
      if (vNormalRef >= 0 && normalPars >= 0) {
        expect(vNormalRef).toBeGreaterThan(normalPars);
      }
      assertHeightFieldDerivativeFree(shader.fragmentShader);
    }
    material.dispose();
  });

  it('produces distinct program cache keys across kinds, venations, peels, and explicit color topologies', () => {
    const materials = modes.map(([, opts]) => createBotanicalMaterial({}, opts));
    const keys = materials.map(m => m.customProgramCacheKey());
    expect(new Set(keys).size).toBe(materials.length);
    materials.forEach(m => m.dispose());
  });

  it('wires petal 2/3-color gradients, faint radial velvet veins, and local coordinate fallback', () => {
    const auto = createBotanicalMaterial({ color: 0xf8c6cf }, { kind: 'petal' });
    const threeColor = createBotanicalMaterial({ color: 0xffffff }, {
      kind: 'petal',
      throatColor: 0xf5b82e,
      midColor: 0xfff0cc,
      tipColor: 0xfffcf5,
      veinCount: 7,
    });
    const local = createBotanicalMaterial({ color: 0xf8c6cf }, { kind: 'petal', coord: 'local', axis: 'y', axialRange: [0, 0.15] });

    expect(auto.roughness).toBeCloseTo(0.86, 5);
    const autoShader = compile(auto);
    expect(autoShader.uniforms.botanicalStrength.value).toBeCloseTo(0.45, 5);
    expect(autoShader.uniforms.botanicalVeinCount.value).toBe(6);
    expect(autoShader.vertexShader).toContain('botanicalUv = uv;');
    expect(autoShader.fragmentShader).toContain('0.04 * botanicalStrength');

    const threeShader = compile(threeColor);
    expect(threeShader.uniforms.botanicalVeinCount.value).toBe(7);
    expect((threeShader.uniforms.botanicalThroatColor.value as THREE.Color).getHex()).toBe(0xf5b82e);
    expect((threeShader.uniforms.botanicalMidColor.value as THREE.Color).getHex()).toBe(0xfff0cc);
    expect((threeShader.uniforms.botanicalTipColor.value as THREE.Color).getHex()).toBe(0xfffcf5);
    expect(threeShader.fragmentShader).toContain('botanicalMidMask');

    const localShader = compile(local);
    expect(localShader.vertexShader).not.toContain('botanicalUv = uv;');
    expect((localShader.uniforms.botanicalAxialRange.value as THREE.Vector2).toArray()).toEqual([0, 0.15]);

    [auto, threeColor, local].forEach(m => m.dispose());
  });

  it('supports pinnate, parallel, and needle leaf modes including optional cluster-normal softening', () => {
    const pinnate = createBotanicalMaterial({ color: 0x668743 }, { kind: 'leaf', venation: 'pinnate' });
    const parallel = createBotanicalMaterial({ color: 0x7ba470 }, { kind: 'leaf', venation: 'parallel' });
    const needleSoft = createBotanicalMaterial({ color: 0x2f684d }, { kind: 'leaf', venation: 'needle' });
    const needleCrisp = createBotanicalMaterial({ color: 0x2f684d }, { kind: 'leaf', venation: 'needle', softenClusterNormals: false });

    const pShader = compile(pinnate);
    expect(pShader.uniforms.botanicalStrength.value).toBeCloseTo(0.42, 5);
    expect(pShader.fragmentShader).toContain('botanicalMidrib');
    expect(pShader.fragmentShader).toContain('botanicalSideVeins');

    const parShader = compile(parallel);
    expect(parallel.roughness).toBeLessThan(pinnate.roughness);
    expect(parShader.fragmentShader).toContain('botanicalParallel');
    expect(parShader.fragmentShader).toContain('botanicalFoldRidge');
    expect(parShader.fragmentShader).toContain('0.12 * botanicalStrength');

    const softShader = compile(needleSoft);
    const crispShader = compile(needleCrisp);
    expect(softShader.fragmentShader).toContain('botanicalSheath');
    expect(softShader.fragmentShader).toContain('+ 0.48 ) / 1.48');
    expect(crispShader.fragmentShader).not.toContain('+ 0.48 ) / 1.48');

    [pinnate, parallel, needleSoft, needleCrisp].forEach(m => m.dispose());
  });

  it('composes cleanly with createRitualMaterial without fighting cache keys or duplicating the highlight shoulder', () => {
    const leaf = createRitualMaterial({ color: 0x608c49, roughness: 0.68 }, { kind: 'leaf', strength: 0.16, fiber: false });
    const opticsOnlyKey = leaf.customProgramCacheKey();
    applyBotanicalSurface(leaf, { kind: 'leaf', venation: 'pinnate', strength: 0.42 });
    const combinedKey = leaf.customProgramCacheKey();

    expect(combinedKey).toContain('ritual-optics-v1:leaf');
    expect(combinedKey).toContain('wbr-botanical-v1:leaf:pinnate');
    expect(combinedKey).not.toBe(opticsOnlyKey);

    const shader = compile(leaf);
    expect(shader.uniforms.ritualScatterStrength.value).toBeCloseTo(0.16, 5);
    expect(shader.uniforms.botanicalStrength.value).toBeCloseTo(0.42, 5);
    expect(shader.fragmentShader.match(/#define WBR_RITUAL_OPTICS/g)).toHaveLength(1);
    expect(shader.fragmentShader.match(/#define WBR_BOTANICAL_SURFACE/g)).toHaveLength(1);
    // Highlight shoulder is injected exactly once (never double-compressed).
    expect(shader.fragmentShader.match(/#define WBR_BOTANICAL_SHOULDER/g)).toHaveLength(1);

    // Styled clones across toon-soft, toon-ink, and gouache retain BOTH ritual-optics and botanical-surfaces.
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), leaf);
    scene.add(mesh);
    for (const style of ['toon-soft', 'toon-ink', 'gouache'] as const) {
      const adapter = createToonSurfaces(style);
      const frame = adapter.apply(scene);
      const styled = mesh.material as THREE.Material;
      const styledShader = compile(styled);
      expect(styledShader.uniforms.ritualScatterStrength.value).toBeCloseTo(0.16, 5);
      expect(styledShader.uniforms.botanicalStrength.value).toBeCloseTo(0.42, 5);
      expect(styledShader.fragmentShader.match(/#define WBR_BOTANICAL_SURFACE/g)).toHaveLength(1);
      expect(styledShader.fragmentShader.match(/#define WBR_BOTANICAL_SHOULDER/g)).toHaveLength(1);
      frame.restore();
      expect(mesh.material).toBe(leaf);
      adapter.dispose();
    }

    mesh.geometry.dispose();
    leaf.dispose();
  });

  it('normalizes invalid numeric inputs, stays idempotent on duplicate attach, and leaves plain materials untouched on copy', () => {
    const source = createBotanicalMaterial({}, { kind: 'bud', scale: NaN, strength: Infinity, instanceVariation: -5, seed: NaN });
    applyBotanicalSurface(source, { kind: 'petal', strength: 0.9 }); // idempotent no-op
    expect(source.userData.botanicalSurface.kind).toBe('bud');

    const target = new THREE.MeshStandardMaterial();
    copyBotanicalSurface(source, target);
    const shader = compile(target);
    expect(shader.uniforms.botanicalScale.value).toBe(1);
    expect(shader.uniforms.botanicalStrength.value).toBeCloseTo(0.45, 5);
    expect(shader.uniforms.botanicalInstVariation.value).toBe(0);
    expect(shader.uniforms.botanicalSeed.value).toBe(0);

    const ordinary = new THREE.MeshStandardMaterial();
    const unpatched = new THREE.MeshToonMaterial();
    copyBotanicalSurface(ordinary, unpatched);
    expect(hasBotanicalSurface(unpatched)).toBe(false);
    expect(compile(unpatched).uniforms.botanicalStrength).toBeUndefined();

    [source, target, ordinary, unpatched].forEach(m => m.dispose());
  });
});
