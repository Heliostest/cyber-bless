import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createCozyEnvironment } from './cozy-environment';
import { courtyardSkinAssignments, getCourtyardSkin } from './courtyard-skins';
import { getEnvironmentProfile, getEnvironmentSurfaceY } from './environment-profiles';

const loadSky = async () => new THREE.DataTexture();
const loadTree = async () => new THREE.Group();

describe('regional courtyard skins & layered garden paving', () => {
  it('maps three shared regional courtyard skins while leaving open/unrelated/product-original scenes on none', () => {
    expect(getCourtyardSkin('shinto-torii')).toBe('japanese-karesansui');
    expect(getCourtyardSkin('kitano-nadeushi')).toBe('japanese-karesansui');
    expect(getCourtyardSkin('tanzaku-tanabata')).toBe('japanese-karesansui');
    expect(getCourtyardSkin('chinese-incense')).toBe('chinese-jiangnan');
    expect(getCourtyardSkin('yusheng-lohei')).toBe('chinese-jiangnan');
    expect(getCourtyardSkin('andalusian-ceramic-tile')).toBe('warm-terracotta-arch');
    expect(getCourtyardSkin('diya-oil-lamp')).toBe('warm-terracotta-arch');
    expect(getCourtyardSkin('rosh-hashanah-apple-honey')).toBe('warm-terracotta-arch');

    // Open highlands/steppes, river/coastal, Korean, Nordic/Slavic/Celtic, SE Asian & product-original stay unframed.
    for (const openId of [
      'udo-undama',
      'mochigase-nagashibina',
      'weifang-paper-kite',
      'blang-tea',
      'tibetan-prayer-flags',
      'mongolian-ovoo',
      'korean-jangdokdae',
      'celtic-folk-spring',
      'ukrainian-didukh',
      'phuang-malai',
      'thai-songkran',
      'hongsheng-red-string',
    ]) {
      expect(getCourtyardSkin(openId), openId).toBe('none');
    }

    // Every mapped scene should exist as a known non-river, non-coastal environment profile.
    for (const [id, skin] of Object.entries(courtyardSkinAssignments)) {
      const profile = getEnvironmentProfile(id);
      expect(profile, `${id} (${skin})`).not.toBeNull();
      expect(profile!.coastal, id).not.toBe(true);
      expect(profile!.kind, id).not.toBe('river');
    }
  });

  it('mounts low-draw-call regional courtyard backdrops outside foreground, veranda, and chinowa corridors', async () => {
    const protectedSpace = new THREE.Box3(new THREE.Vector3(-1.85, -0.2, -1.2), new THREE.Vector3(1.85, 5.2, 2.2));
    const chinowaCorridor = new THREE.Box3(new THREE.Vector3(-3.65, 0.05, -1.4), new THREE.Vector3(3.65, 2.6, 10));

    const cases: [string, string][] = [
      ['shinto-torii', 'japanese-karesansui'],
      ['kitano-nadeushi', 'japanese-karesansui'],
      ['ema-votive-plaque', 'japanese-karesansui'],
      ['chinowa-kuguri', 'japanese-karesansui'],
      ['chinese-incense', 'chinese-jiangnan'],
      ['yusheng-lohei', 'chinese-jiangnan'],
      ['andalusian-ceramic-tile', 'warm-terracotta-arch'],
      ['diya-oil-lamp', 'warm-terracotta-arch'],
      ['rosh-hashanah-apple-honey', 'warm-terracotta-arch'],
    ];

    for (const [id, expectedSkin] of cases) {
      const scene = new THREE.Scene();
      const world = createCozyEnvironment(scene, { id, loadSky, loadTree })!;
      try {
        await world.ready;
        const root = scene.getObjectByName('cozy-environment')!;
        expect(root.userData.courtyardSkin, id).toBe(expectedSkin);

        const courtyard = root.getObjectByName('regional-courtyard');
        expect(courtyard, id).toBeInstanceOf(THREE.Group);

        const meshes: THREE.Mesh[] = [];
        courtyard!.traverse(obj => {
          if (obj instanceof THREE.Mesh) meshes.push(obj);
        });
        // Strict mobile draw-call budget: 1 merged structure mesh + 1 merged lantern glow mesh.
        expect(meshes.length, id).toBe(2);

        const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 1.2, 4), new THREE.Vector3(0, 0, -1));
        for (const mesh of meshes) {
          expect(mesh.userData.toonSurface?.outline, id).toBe(false);
          expect(mesh.castShadow, id).toBe(false);
          expect(mesh.userData.courtyardSkin, id).toBe(true);
          expect(raycaster.intersectObject(mesh, false).length, id).toBe(0);
        }

        const bounds = new THREE.Box3().setFromObject(courtyard!);
        expect(bounds.intersectsBox(protectedSpace), `${id} foreground clearance`).toBe(false);
        expect(bounds.max.z, `${id} stays in mid-background`).toBeLessThan(-2.2);

        if (world.kind === 'veranda' || world.kind === 'table') {
          expect(bounds.max.z, `${id} stays cleanly behind veranda/table`).toBeLessThan(-3.5);
        }
        if (id === 'chinowa-kuguri') {
          expect(bounds.intersectsBox(chinowaCorridor), 'chinowa-kuguri corridor clearance').toBe(false);
          expect(bounds.max.z, 'chinowa-kuguri compact wing').toBeLessThan(-3.5);
        }
      } finally {
        world.dispose();
      }
    }
  });

  it('keeps unmapped garden & courtyard scenes free of regional-courtyard walls', async () => {
    for (const id of ['phuang-malai', 'celtic-folk-spring', 'ukrainian-didukh']) {
      const scene = new THREE.Scene();
      const world = createCozyEnvironment(scene, { id, loadSky, loadTree })!;
      try {
        await world.ready;
        const root = scene.getObjectByName('cozy-environment')!;
        expect(root.userData.courtyardSkin, id).toBe('none');
        expect(root.getObjectByName('regional-courtyard'), id).toBeUndefined();
      } finally {
        world.dispose();
      }
    }
  });

  it('replaces bare garden sand circles with bordered layered paving while honoring getEnvironmentSurfaceY', async () => {
    const gardenCases = [
      'kitano-nadeushi',
      'yusheng-lohei',
      'rosh-hashanah-apple-honey',
      'phuang-malai',
      'celtic-folk-spring',
    ] as const;

    for (const id of gardenCases) {
      const scene = new THREE.Scene();
      const world = createCozyEnvironment(scene, { id, loadSky, loadTree })!;
      try {
        await world.ready;
        const pad = scene.getObjectByName('garden-path') as THREE.Mesh;
        expect(pad, id).toBeInstanceOf(THREE.Mesh);
        expect(Math.abs(pad.position.y - getEnvironmentSurfaceY(id)), id).toBeLessThan(0.0025);

        const pos = pad.geometry.getAttribute('position') as THREE.BufferAttribute;
        const colors = pad.geometry.getAttribute('color') as THREE.BufferAttribute;
        expect(colors, `${id} has vertex color variation`).toBeInstanceOf(THREE.BufferAttribute);
        if (id !== 'celtic-folk-spring') {
          // Layered raked gravel / flagstones + beveled curb blocks have far richer geometry than CircleGeometry(2.55, 48).
          expect(pos.count, id).toBeGreaterThan(400);
          // Central ritual footprint stays flat within ±5mm of getEnvironmentSurfaceY.
          let centerMaxY = -Infinity;
          for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            if (Math.hypot(x, z) < 1.5) {
              centerMaxY = Math.max(centerMaxY, pos.getY(i));
            }
          }
          expect(centerMaxY, `${id} central top relief`).toBeLessThanOrEqual(0.005);
        } else {
          expect(scene.getObjectByName('garden-path-border')).toBeInstanceOf(THREE.Mesh);
        }

        const bounds = new THREE.Box3().setFromObject(pad);
        expect(bounds.getSize(new THREE.Vector3()).z, id).toBeLessThan(6);
        expect((pad.material as THREE.Material).userData.komorebiSurface, id).toBe(true);
        expect(scene.getObjectByName('garden-path-moss'), id).toBeInstanceOf(THREE.Mesh);
      } finally {
        world.dispose();
      }
    }
  });

  it('uses Komorebi architectural surfaces in daylight, HDR lantern glow at night, and disposes cleanly once', async () => {
    // Daylight Komorebi + tone round-trip + exact once-only disposal.
    const dayScene = new THREE.Scene();
    const dayWorld = createCozyEnvironment(dayScene, { id: 'chinese-incense', loadSky, loadTree })!;
    await dayWorld.ready;
    const structure = dayScene.getObjectByName('regional-courtyard-structure') as THREE.Mesh;
    expect(structure.material).toBeInstanceOf(THREE.MeshPhongMaterial);
    expect((structure.material as THREE.MeshPhongMaterial).customProgramCacheKey()).toBe('komorebi-courtyard-arch-v1');
    const colorAttr = structure.geometry.getAttribute('color') as THREE.BufferAttribute;
    const beforeColors = Array.from(colorAttr.array as Float32Array).slice(0, 24);

    dayWorld.setTone('tiny-delivery');
    expect(structure.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    dayWorld.setTone('original');
    expect(structure.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    dayWorld.setTone('komorebi');
    expect(structure.material).toBeInstanceOf(THREE.MeshPhongMaterial);
    expect(Array.from(colorAttr.array as Float32Array).slice(0, 24)).toEqual(beforeColors);

    const geoSpy = vi.spyOn(structure.geometry, 'dispose');
    dayWorld.dispose();
    dayWorld.dispose();
    expect(geoSpy).toHaveBeenCalledTimes(1);
    geoSpy.mockRestore();

    // Night scene uses moonlit PBR wall + un-tonemapped warm lantern glow for AgX + Bloom.
    const nightScene = new THREE.Scene();
    const nightWorld = createCozyEnvironment(nightScene, { id: 'diya-oil-lamp', loadSky, loadTree })!;
    try {
      await nightWorld.ready;
      const nightStructure = nightScene.getObjectByName('regional-courtyard-structure') as THREE.Mesh;
      const nightGlow = nightScene.getObjectByName('regional-courtyard-glow') as THREE.Mesh;
      expect(nightStructure.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      expect(nightGlow.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      expect((nightGlow.material as THREE.MeshBasicMaterial).toneMapped).toBe(false);
    } finally {
      nightWorld.dispose();
    }
  });
});
