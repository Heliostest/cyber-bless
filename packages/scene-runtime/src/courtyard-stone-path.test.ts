import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createCozyEnvironment as createEnvironment } from './cozy-environment';
import {
  courtyardPathCenterX,
  courtyardPathEdgeLateral,
  courtyardPathHalfWidth,
  courtyardPathT,
  createCourtyardStonePath,
  isInsideCourtyardStonePath,
} from './courtyard-stone-path';
import { gardenLayout } from './garden-layout';
import { canMeadowGrow } from './stylized-meadow';

const createCozyEnvironment: typeof createEnvironment = (scene, options) =>
  createEnvironment(scene, {
    ...options,
    loadTree:
      options.loadTree ??
      (async () => {
        const root = new THREE.Group();
        root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial()));
        return root;
      }),
  });

describe('stylized courtyard stone-slab road', () => {
  it.each(['chinese-longevity-lock', 'shinto-torii', 'omikuji', 'chinese-incense'])(
    'builds a named Komorebi-calibrated stone-slab road for day courtyard scene %s',
    async id => {
      const scene = new THREE.Scene();
      const world = createCozyEnvironment(scene, { id, loadSky: async () => new THREE.DataTexture() })!;
      try {
        await world.ready;
        const road = scene.getObjectByName('courtyard-stone-path') as THREE.Mesh | undefined;
        expect(road).toBeInstanceOf(THREE.Mesh);
        expect(scene.getObjectByName('garden-path')).toBeUndefined();

        const material = road!.material as THREE.Material;
        expect(material).toBeInstanceOf(THREE.MeshPhongMaterial);
        expect(material.userData.komorebiSurface).toBe(true);
        expect(material.userData.komorebiPigment).toBe(true);
        expect((material as THREE.MeshPhongMaterial).vertexColors).toBe(true);
        expect((material as THREE.MeshPhongMaterial).shininess).toBeLessThanOrEqual(8);

        // Switching tones swaps between Komorebi surface and standard material cleanly without mutating vertex colors.
        const colorsBefore = Array.from(road!.geometry.attributes.color!.array);
        world.setTone('original');
        expect(road!.material).toBeInstanceOf(THREE.MeshStandardMaterial);
        world.setTone('tiny-delivery');
        expect(road!.material).toBeInstanceOf(THREE.MeshStandardMaterial);
        world.setTone('komorebi');
        expect(road!.material).toBe(material);
        expect(Array.from(road!.geometry.attributes.color!.array)).toEqual(colorsBefore);
      } finally {
        world.dispose();
      }
    },
  );

  it('covers the S-curve work area continuously so ritual props sit on the stone road', async () => {
    const scene = new THREE.Scene();
    const world = createCozyEnvironment(scene, {
      id: 'chinese-longevity-lock',
      loadSky: async () => new THREE.DataTexture(),
    })!;
    try {
      await world.ready;
      scene.updateMatrixWorld(true);
      const road = scene.getObjectByName('courtyard-stone-path') as THREE.Mesh;
      const samples: [number, number][] = [
        [0, 3.0],
        [0, 0],
        [0.8, 0],
        [1.1, -2.0],
        [courtyardPathCenterX(courtyardPathT(-6)), -6],
        [courtyardPathCenterX(courtyardPathT(-14)), -14],
        [courtyardPathCenterX(courtyardPathT(-24)), -24],
      ];
      for (const [x, z] of samples) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, 2, z), new THREE.Vector3(0, -1, 0));
        const hits = ray.intersectObject(road, false);
        expect(hits.length, `expected stone road hit at (${x}, ${z})`).toBeGreaterThan(0);
        expect(hits[0]!.point.y).toBeGreaterThan(0);
        expect(hits[0]!.point.y).toBeLessThan(0.025);
      }
    } finally {
      world.dispose();
    }
  });

  it('gives night courtyards the same named stone road with a darker night material', async () => {
    const dayScene = new THREE.Scene();
    const nightScene = new THREE.Scene();
    const dayWorld = createCozyEnvironment(dayScene, {
      id: 'shinto-torii',
      loadSky: async () => new THREE.DataTexture(),
    })!;
    const nightWorld = createCozyEnvironment(nightScene, {
      id: 'diya-oil-lamp',
      loadSky: async () => new THREE.DataTexture(),
    })!;
    try {
      await Promise.all([dayWorld.ready, nightWorld.ready]);
      const dayRoad = dayScene.getObjectByName('courtyard-stone-path') as THREE.Mesh;
      const nightRoad = nightScene.getObjectByName('courtyard-stone-path') as THREE.Mesh;
      expect(nightRoad).toBeInstanceOf(THREE.Mesh);
      expect(nightScene.getObjectByName('courtyard-path-moss')).toBeUndefined();
      expect(nightRoad.material).toBeInstanceOf(THREE.MeshStandardMaterial);
      const nightMat = nightRoad.material as THREE.MeshStandardMaterial;
      expect(nightMat.color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(0.7);
      expect(nightRoad.geometry.attributes.position!.count).toBe(dayRoad.geometry.attributes.position!.count);
    } finally {
      dayWorld.dispose();
      nightWorld.dispose();
    }
  });

  it('keeps garden oval pads, veranda wood, river, coastal, and table environments free of a courtyard stone road', async () => {
    const cases: [string, string, boolean][] = [
      ['kitano-nadeushi', 'garden', true],
      ['celtic-folk-spring', 'garden', true],
      ['ema-votive-plaque', 'veranda', false],
      ['furin-wind-chime', 'veranda', false],
      ['floating-lantern-loy-krathong', 'river', false],
      ['udo-undama', 'river', false],
      ['crane', 'table', false],
    ];
    for (const [id, expectedKind, expectsGardenPad] of cases) {
      const scene = new THREE.Scene();
      const world = createCozyEnvironment(scene, { id, loadSky: async () => new THREE.DataTexture() })!;
      try {
        await world.ready;
        expect(world.kind).toBe(expectedKind);
        expect(scene.getObjectByName('courtyard-stone-path'), id).toBeUndefined();
        expect(scene.getObjectByName('courtyard-path-moss'), id).toBeUndefined();
        const pad = scene.getObjectByName('garden-path') as THREE.Mesh | undefined;
        if (expectsGardenPad) {
          expect(pad, id).toBeInstanceOf(THREE.Mesh);
          const bounds = new THREE.Box3().setFromObject(pad!);
          // Oval pad spans ~5.9m × ~4.4m, not a 36m S-curve road.
          expect(bounds.getSize(new THREE.Vector3()).z).toBeLessThan(6);
          expect((pad!.material as THREE.Material).userData.komorebiSurface).toBe(true);
        } else {
          expect(pad, id).toBeUndefined();
        }
      } finally {
        world.dispose();
      }
    }
  });

  it('removes on-path decorative rock-flat clutter from courtyards while retaining planted-bed rocks', () => {
    const items = gardenLayout('courtyard', 'chinese-longevity-lock');
    const rocks = items.filter(item => item.model === 'rock-flat');
    expect(rocks.length).toBeGreaterThan(0);
    for (const rock of rocks) {
      const t = courtyardPathT(rock.z);
      const center = courtyardPathCenterX(t);
      const half = courtyardPathHalfWidth(t);
      expect(Math.abs(rock.x - center), `rock at (${rock.x}, ${rock.z}) should sit off the stone road`).toBeGreaterThan(half);
    }
  });

  it('keeps canMeadowGrow clear across the full stone-slab S-curve width', () => {
    for (let z = 3.5; z >= -24; z -= 1.25) {
      const t = courtyardPathT(z);
      const center = courtyardPathCenterX(t);
      const half = courtyardPathHalfWidth(t);
      expect(canMeadowGrow('courtyard', center, z)).toBe(false);
      expect(canMeadowGrow('courtyard', center - half * 0.95, z)).toBe(false);
      expect(canMeadowGrow('courtyard', center + half * 0.95, z)).toBe(false);
    }
  });

  it('disposes all stone-road GPU resources cleanly once', async () => {
    const scene = new THREE.Scene();
    const world = createCozyEnvironment(scene, {
      id: 'shinto-torii',
      loadSky: async () => new THREE.DataTexture(),
    })!;
    await world.ready;
    const road = scene.getObjectByName('courtyard-stone-path') as THREE.Mesh;
    const moss = scene.getObjectByName('courtyard-path-moss') as THREE.Mesh;
    const geoDispose = vi.spyOn(road.geometry, 'dispose');
    const matDispose = vi.spyOn(road.material as THREE.Material, 'dispose');
    const mossGeoDispose = vi.spyOn(moss.geometry, 'dispose');
    world.dispose();
    world.dispose();
    expect(scene.getObjectByName('courtyard-stone-path')).toBeUndefined();
    expect(scene.getObjectByName('courtyard-path-moss')).toBeUndefined();
    expect(geoDispose).toHaveBeenCalledOnce();
    expect(matDispose).toHaveBeenCalledOnce();
    expect(mossGeoDispose).toHaveBeenCalledOnce();
  });

  it('produces genuinely irregular asymmetric organic stone edges, borderless stone atlas, and consistent vertex budgets across all 4 skins', () => {
    const skins = ['none', 'japanese-karesansui', 'chinese-jiangnan', 'warm-terracotta-arch'] as const;
    let referenceVertexCount = -1;

    for (const skin of skins) {
      const dayHandle = createCourtyardStonePath({ floor: 0, night: false, skin });
      const nightHandle = createCourtyardStonePath({ floor: 0, night: true, skin });
      try {
        const dayVerts = dayHandle.mesh.geometry.attributes.position!.count;
        const nightVerts = nightHandle.mesh.geometry.attributes.position!.count;
        expect(dayVerts).toBe(nightVerts);
        expect(dayVerts).toBeGreaterThan(2500);
        expect(dayVerts).toBeLessThan(14000);
        if (referenceVertexCount < 0) referenceVertexCount = dayVerts;
        else expect(dayVerts).toBe(referenceVertexCount);

        expect(dayHandle.mossMesh).toBeInstanceOf(THREE.Mesh);
        expect(dayHandle.mossMesh!.name).toBe('courtyard-path-moss');
        expect((dayHandle.mossMesh!.material as THREE.MeshPhongMaterial).shininess).toBeLessThanOrEqual(8);
        expect(nightHandle.mossMesh).toBeUndefined();

        // Check that stone atlas quadrant (0,0) has no dark rectangular ink border around UV edges.
        if (skin === 'none') {
          const map = (dayHandle.mesh.material as THREE.MeshPhongMaterial).map as THREE.DataTexture;
          const img = map.image as { data: Uint8Array; width: number; height: number };
          const half = img.width / 2;
          let borderSum = 0;
          let borderCount = 0;
          let innerSum = 0;
          let innerCount = 0;
          for (let py = 0; py < half; py++) {
            for (let px = 0; px < half; px++) {
              const idx = (py * img.width + px) * 4;
              const luma = (img.data[idx]! + img.data[idx + 1]! + img.data[idx + 2]!) / (3 * 255);
              const isEdge = px < 4 || px >= half - 4 || py < 4 || py >= half - 4;
              if (isEdge) {
                borderSum += luma;
                borderCount++;
              } else if (px > 16 && px < half - 16 && py > 16 && py < half - 16) {
                innerSum += luma;
                innerCount++;
              }
            }
          }
          expect(Math.abs(borderSum / borderCount - innerSum / innerCount)).toBeLessThan(0.035);
        }
      } finally {
        dayHandle.dispose();
        nightHandle.dispose();
      }
    }

    // Verify strong organic edge excursion and left/right asymmetry along the S-curve.
    const leftDeltas: number[] = [];
    const rightDeltas: number[] = [];
    let asymmetrySum = 0;
    for (let i = 2; i <= 140; i++) {
      const t = i / 180;
      const half = courtyardPathHalfWidth(t);
      const leftExt = -courtyardPathEdgeLateral(t, -1) - half;
      const rightExt = courtyardPathEdgeLateral(t, 1) - half;
      leftDeltas.push(leftExt);
      rightDeltas.push(rightExt);
      asymmetrySum += Math.abs(leftExt - rightExt);
    }
    const leftSwing = Math.max(...leftDeltas) - Math.min(...leftDeltas);
    const rightSwing = Math.max(...rightDeltas) - Math.min(...rightDeltas);
    expect(leftSwing).toBeGreaterThan(0.14);
    expect(rightSwing).toBeGreaterThan(0.14);
    expect(asymmetrySum / leftDeltas.length).toBeGreaterThan(0.035);

    // Verify isInsideCourtyardStonePath protects protruding shoulders while letting recessed bays open to grass.
    const maxRightIdx = rightDeltas.indexOf(Math.max(...rightDeltas));
    const minRightIdx = rightDeltas.indexOf(Math.min(...rightDeltas));
    const tProtrude = (maxRightIdx + 2) / 180;
    const tBay = (minRightIdx + 2) / 180;
    const zProtrude = 4 - tProtrude * 36;
    const zBay = 4 - tBay * 36;
    const probeOffset = (rightDeltas[maxRightIdx]! + rightDeltas[minRightIdx]!) * 0.5;
    expect(isInsideCourtyardStonePath(courtyardPathCenterX(tProtrude) + courtyardPathHalfWidth(tProtrude) + probeOffset, zProtrude, 0.05)).toBe(true);
    expect(isInsideCourtyardStonePath(courtyardPathCenterX(tBay) + courtyardPathHalfWidth(tBay) + rightDeltas[maxRightIdx]! + 0.14, zBay, 0.05)).toBe(false);
  });
});
