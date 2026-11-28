import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  SKIN_TONE_PRESETS,
  analyzeMeshManifold,
  applyRobeDraperyFolds,
  applyStylizedHumanSurfaceHint,
  buildStylizedHandRig,
  createStylizedFingerGeometry,
  createStylizedForearmGeometry,
  createStylizedGarmentMaterial,
  createStylizedHairGeometry,
  createStylizedHeadGeometry,
  createStylizedLimbGeometry,
  createStylizedLotusPedestalGeometry,
  createStylizedPalmGeometry,
  createStylizedSeatedStatueGeometry,
  createStylizedShoeGeometry,
  createStylizedSkinMaterial,
  createStylizedSleeveCuffGeometry,
  createStylizedThumbGeometry,
  createStylizedTorsoGeometry,
  isClosedTwoManifold,
  type StylizedCollarStyle,
  type StylizedHairStyle,
} from './stylized-human';

function countTriangles(geometry: THREE.BufferGeometry): number {
  return geometry.index
    ? geometry.index.count / 3
    : geometry.getAttribute('position').count / 3;
}

describe('@wbr/scene-runtime/stylized-human', () => {
  it('produces strictly closed 2-manifold hand, forearm, and rolled sleeve cuff geometries (indexed & non-indexed)', () => {
    const builders: [string, () => THREE.BufferGeometry][] = [
      ['palm-down', () => createStylizedPalmGeometry({ palmUp: false })],
      ['palm-up-flat', () => createStylizedPalmGeometry({ palmUp: true, flatContactFace: true })],
      ['finger-default', () => createStylizedFingerGeometry()],
      [
        'finger-curved-grip',
        () => {
          const pts = Array.from({ length: 7 }, (_, i) => {
            const a = Math.PI * 0.8 + (i / 6) * Math.PI * 1.1;
            return new THREE.Vector3(Math.cos(a) * 0.036, 0, Math.sin(a) * 0.036);
          });
          return createStylizedFingerGeometry({
            curve: new THREE.CatmullRomCurve3(pts),
            radiusX: 0.013,
            radiusY: 0.013,
            indexed: false,
          });
        },
      ],
      ['thumb-default', () => createStylizedThumbGeometry()],
      ['forearm-default', () => createStylizedForearmGeometry()],
      ['sleeve-cuff-thick', () => createStylizedSleeveCuffGeometry()],
      ['sleeve-cuff-nonindexed', () => createStylizedSleeveCuffGeometry({ indexed: false })],
    ];

    for (const [label, build] of builders) {
      const geo = build();
      const report = analyzeMeshManifold(geo);
      expect(report.isClosedTwoManifold, `${label}: ${JSON.stringify(report)}`).toBe(true);
      expect(report.degenerateTriangles, label).toBe(0);
      expect(report.boundaryEdges, label).toBe(0);
      expect(report.nonManifoldEdges, label).toBe(0);
      expect(report.invertedEdges, label).toBe(0);
      expect(report.signedVolume, label).toBeGreaterThan(0);
      expect(geo.getAttribute('normal'), label).toBeTruthy();
      expect(geo.getAttribute('uv'), label).toBeTruthy();
      expect(geo.getAttribute('color'), label).toBeTruthy();
      geo.dispose();
    }
  });

  it('keeps an assembled stylized hand within the 400–1,200 triangle mobile budget', () => {
    const rig = buildStylizedHandRig({
      namePrefix: 'test-hand',
      handedness: 'right',
      pose: 'gentle-rest',
    });
    let totalTriangles = 0;
    rig.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        expect(isClosedTwoManifold(obj.geometry), obj.name).toBe(true);
        totalTriangles += countTriangles(obj.geometry);
        expect(obj.userData.toonSurface).toMatchObject({ outline: false, shading: 'smooth' });
      }
    });
    expect(totalTriangles).toBeGreaterThanOrEqual(400);
    expect(totalTriangles).toBeLessThanOrEqual(1200);
    rig.root.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
    (rig.palm.material as THREE.Material).dispose();
  });

  it('produces strictly closed 2-manifold full-body and statue geometries within the 1,500–3,500 triangle budget', () => {
    const head = createStylizedHeadGeometry();
    const hairStyles: StylizedHairStyle[] = ['short', 'bun', 'bob', 'topknot', 'cap-base'];
    const hairs = hairStyles.map((style) => [style, createStylizedHairGeometry({ style })] as const);
    const collarStyles: StylizedCollarStyle[] = ['round', 'crossed', 'mandarin', 'robe'];
    const torsos = collarStyles.map(
      (collarStyle) => [collarStyle, createStylizedTorsoGeometry({ collarStyle })] as const,
    );
    const limb = createStylizedLimbGeometry();
    const shoe = createStylizedShoeGeometry();
    const statue = createStylizedSeatedStatueGeometry();
    const lotus = createStylizedLotusPedestalGeometry();

    expect(isClosedTwoManifold(head), 'head').toBe(true);
    for (const [style, geo] of hairs) {
      expect(isClosedTwoManifold(geo), `hair:${style}`).toBe(true);
    }
    for (const [collar, geo] of torsos) {
      expect(isClosedTwoManifold(geo), `torso:${collar}`).toBe(true);
    }
    expect(isClosedTwoManifold(limb), 'limb').toBe(true);
    expect(isClosedTwoManifold(shoe), 'shoe').toBe(true);
    expect(isClosedTwoManifold(statue), 'statue').toBe(true);
    expect(isClosedTwoManifold(lotus), 'lotus').toBe(true);

    // Shoes, seated statue, and lotus pedestal ground cleanly at y = 0.
    expect(shoe.boundingBox!.min.y).toBeCloseTo(0, 6);
    expect(statue.boundingBox!.min.y).toBeCloseTo(0, 6);
    expect(lotus.boundingBox!.min.y).toBeCloseTo(0, 6);

    // Full stylized figure triangle count (head + hair + torso + 4 limbs + 2 shoes) stays in 1,500–3,500 budget.
    const fullFigureTriangles =
      countTriangles(head) +
      countTriangles(hairs[0]![1]) +
      countTriangles(torsos[0]![1]) +
      countTriangles(limb) * 4 +
      countTriangles(shoe) * 2;
    expect(fullFigureTriangles).toBeGreaterThanOrEqual(1500);
    expect(fullFigureTriangles).toBeLessThanOrEqual(3500);

    // Drapery helper preserves closed 2-manifold topology.
    const drapedTorso = createStylizedTorsoGeometry({ collarStyle: 'robe' });
    applyRobeDraperyFolds(drapedTorso, { amplitude: 0.01, frequency: 6 });
    expect(isClosedTwoManifold(drapedTorso), 'draped-torso').toBe(true);

    for (const geo of [head, limb, shoe, statue, lotus, drapedTorso]) geo.dispose();
    for (const [, geo] of hairs) geo.dispose();
    for (const [, geo] of torsos) geo.dispose();
  });

  it('builds warm Komorebi skin and garment materials compatible with ritual-optics, craft-surfaces, and toon-soft', () => {
    const skin = createStylizedSkinMaterial({ tone: 'warm-caramel' });
    expect(skin.color.getHex()).toBe(SKIN_TONE_PRESETS['warm-caramel']);
    expect(skin.roughness).toBeGreaterThanOrEqual(0.74);
    expect(skin.metalness).toBe(0);
    expect(skin.userData.ritualOptics).toMatchObject({ kind: 'skin' });

    const garment = createStylizedGarmentMaterial({ color: 0x57938b });
    expect(garment.roughness).toBeGreaterThanOrEqual(0.82);
    expect(garment.metalness).toBe(0);
    expect(garment.userData.ritualOptics).toMatchObject({ kind: 'cloth' });
    expect(garment.userData.craftSurface).toMatchObject({ kind: 'fabric' });

    const mesh = new THREE.Mesh(createStylizedPalmGeometry(), skin);
    applyStylizedHumanSurfaceHint(mesh, 'skin');
    expect(mesh.userData.toonSurface).toEqual({
      outline: false,
      roughness: 0.88,
      shading: 'smooth',
    });

    mesh.geometry.dispose();
    skin.dispose();
    garment.dispose();
  });

  it('handles micro-scale finger dimensions without three-subdivide vertex-hash collapse', () => {
    // 1.4cm finger radius would collapse under three-subdivide's 2-decimal hash without our scaling guard.
    const tinyFinger = createStylizedFingerGeometry({
      length: 0.055,
      radiusX: 0.008,
      radiusY: 0.0075,
      iterations: 2,
    });
    const report = analyzeMeshManifold(tinyFinger, 1e-6);
    expect(report.isClosedTwoManifold, JSON.stringify(report)).toBe(true);
    expect(report.degenerateTriangles).toBe(0);
    expect(report.triangleCount).toBeGreaterThan(200);
    tinyFinger.dispose();
  });

  it('produces an exact flush palm contact face when flatContactFace is enabled', () => {
    const thickness = 0.086;
    const palm = createStylizedPalmGeometry({
      width: 0.42,
      thickness,
      length: 0.34,
      palmUp: true,
      flatContactFace: true,
    });
    expect(isClosedTwoManifold(palm)).toBe(true);
    expect(palm.boundingBox!.max.y).toBeCloseTo(thickness * 0.5, 6);
    const mesh = new THREE.Mesh(palm, new THREE.MeshStandardMaterial());
    const ray = new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(mesh)[0];
    expect(hit).toBeDefined();
    expect(hit!.point.y).toBeCloseTo(thickness * 0.5, 6);
    palm.dispose();
    mesh.material.dispose();
  });

  it('returns independent cloned BufferGeometry instances from the template cache', () => {
    const a = createStylizedPalmGeometry({ width: 0.24, length: 0.26 });
    const b = createStylizedPalmGeometry({ width: 0.24, length: 0.26 });
    expect(a).not.toBe(b);
    expect(a.getAttribute('position').array).not.toBe(b.getAttribute('position').array);
    a.translate(10, 0, 0);
    a.dispose();
    const c = createStylizedPalmGeometry({ width: 0.24, length: 0.26 });
    expect(c.boundingBox!.min.x).toBeLessThan(1);
    expect(isClosedTwoManifold(b)).toBe(true);
    expect(isClosedTwoManifold(c)).toBe(true);
    b.dispose();
    c.dispose();
  });
});
