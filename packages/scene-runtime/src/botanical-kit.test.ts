import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createBladeLeafGeometry,
  createCuppedPetalGeometry,
  createFlowerBudGeometry,
  createFoldedBananaLeafFanGeometry,
  createSmoothSolid,
  createSpinyHollyLeafGeometry,
  createWheatKernelGeometry,
} from './botanical-kit';

function triangleCount(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute('position');
  const index = geometry.index;
  return (index ? index.count : pos.count) / 3;
}

function signedVolume(geometry: THREE.BufferGeometry) {
  const pos = geometry.getAttribute('position');
  const index = geometry.index;
  const vertCount = index ? index.count : pos.count;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let volume = 0;
  for (let i = 0; i < vertCount; i += 3) {
    const i0 = index ? index.getX(i) : i;
    const i1 = index ? index.getX(i + 1) : i + 1;
    const i2 = index ? index.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    volume += a.dot(b.clone().cross(c)) / 6;
  }
  return volume;
}

describe('botanical-kit geometry constructors', () => {
  it.each(['acuminate', 'dripTip', 'obtuse', 'spiny'] as const)('builds a blade leaf (%s) within 48–96 tris with authored midrib UV', tip => {
    const geo = createBladeLeafGeometry({ tip, length: 0.22, maxWidth: 0.10, midribFold: 14, thickness: 0.003 });
    expect(triangleCount(geo)).toBeGreaterThanOrEqual(48);
    expect(triangleCount(geo)).toBeLessThanOrEqual(96);

    // Check authored UV spans [0, 1] with midrib vertices at u = 0.5 and x = 0.
    const pos = geo.getAttribute('position');
    const uv = geo.getAttribute('uv');
    let hasMidribUv = false;
    let minV = Infinity;
    let maxV = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      if (Math.abs(uv.getX(i) - 0.5) < 1e-6) {
        expect(Math.abs(pos.getX(i))).toBeLessThan(1e-5);
        hasMidribUv = true;
      }
      minV = Math.min(minV, uv.getY(i));
      maxV = Math.max(maxV, uv.getY(i));
    }
    expect(hasMidribUv).toBe(true);
    expect(minV).toBeCloseTo(0, 5);
    expect(maxV).toBeCloseTo(1, 5);
    geo.dispose();
  });

  it('supports higher widthSegments (4) while staying within 96 tris', () => {
    const geo = createBladeLeafGeometry({ widthSegments: 4, lengthSegments: 4, midribFold: 12 });
    expect(triangleCount(geo)).toBe(96);
    geo.dispose();
  });

  it.each(['rounded', 'pointed', 'notched'] as const)('builds a cupped petal (%s) within 44–80 tris', tipShape => {
    const geo = createCuppedPetalGeometry({ tipShape, length: 0.13, maxWidth: 0.08, cupDepth: 0.018, tipCurl: 0.012 });
    expect(triangleCount(geo)).toBeGreaterThanOrEqual(44);
    expect(triangleCount(geo)).toBeLessThanOrEqual(80);
    expect(geo.boundingBox!.max.y).toBeCloseTo(0.13, 2);
    geo.dispose();
  });

  it('builds a spiny holly leaf, folded banana-leaf fan, wheat kernel, and flower bud', () => {
    const holly = createSpinyHollyLeafGeometry({ spinePairs: 3, spinePitch: 0.006 });
    const banana = createFoldedBananaLeafFanGeometry({ width: 0.30, height: 0.32, ridgeDepth: 0.15 });
    const kernel = createWheatKernelGeometry({ length: 0.11, radius: 0.026, creaseDepth: 0.24 });
    const bud = createFlowerBudGeometry({ length: 0.095, radius: 0.024, lobeCount: 3 });
    const catkin = createFlowerBudGeometry({ length: 0.07, radius: 0.022, lobeCount: 0, tipSharpness: 0.35 });

    expect(triangleCount(banana)).toBe(96);
    expect(triangleCount(kernel)).toBe(64);
    expect(triangleCount(bud)).toBe(80);

    // Holly leaf keeps thin 3.5mm profile (not a 2.2cm extruded slab).
    const hollySize = holly.boundingBox!.getSize(new THREE.Vector3());
    expect(hollySize.z).toBeCloseTo(0.34, 2);
    expect(hollySize.y).toBeLessThan(0.08);

    [holly, banana, kernel, bud, catkin].forEach(g => g.dispose());
  });

  it('produces strictly deterministic geometry across repeated calls', () => {
    const pairs: [THREE.BufferGeometry, THREE.BufferGeometry][] = [
      [createBladeLeafGeometry({ tip: 'dripTip' }), createBladeLeafGeometry({ tip: 'dripTip' })],
      [createCuppedPetalGeometry({ tipShape: 'notched' }), createCuppedPetalGeometry({ tipShape: 'notched' })],
      [createSpinyHollyLeafGeometry(), createSpinyHollyLeafGeometry()],
      [createFoldedBananaLeafFanGeometry(), createFoldedBananaLeafFanGeometry()],
      [createWheatKernelGeometry(), createWheatKernelGeometry()],
      [createFlowerBudGeometry(), createFlowerBudGeometry()],
    ];
    for (const [a, b] of pairs) {
      expect(Array.from(a.getAttribute('position').array)).toEqual(Array.from(b.getAttribute('position').array));
      expect(Array.from(a.getAttribute('normal').array)).toEqual(Array.from(b.getAttribute('normal').array));
      expect(Array.from(a.getAttribute('uv').array)).toEqual(Array.from(b.getAttribute('uv').array));
      a.dispose();
      b.dispose();
    }
  });

  it('preserves smooth normals across non-indexed conversion on deformed spheres (apples & pussy-willow buds)', () => {
    // Reproduce the deformed whole-apple geometry from rosh-hashanah-apple-honey.
    const apple = new THREE.SphereGeometry(1, 24, 16);
    const p = apple.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const angle = Math.atan2(z, x), theta = Math.acos(THREE.MathUtils.clamp(y, -1, 1));
      const r = 0.25 * (1 + 0.035 * Math.cos(5 * angle));
      p.setXYZ(i, x * r, 0.29 * y - 0.045 * Math.exp(-theta * theta / 0.10), z * r);
    }

    const smooth = createSmoothSolid(apple);
    expect(smooth.index).toBeNull();

    // Every pair of non-indexed vertices sharing the same 3D coordinate must share identical smooth normals!
    const sPos = smooth.getAttribute('position');
    const sNorm = smooth.getAttribute('normal');
    const firstNormal = new Map<string, THREE.Vector3>();
    let sharedPairs = 0;
    for (let i = 0; i < sPos.count; i++) {
      const key = [sPos.getX(i), sPos.getY(i), sPos.getZ(i)].map(x => Math.round(x * 1e6)).join(',');
      const n = new THREE.Vector3().fromBufferAttribute(sNorm, i);
      const ref = firstNormal.get(key);
      if (ref) {
        expect(n.dot(ref)).toBeGreaterThan(0.9999);
        sharedPairs++;
      } else {
        firstNormal.set(key, n);
      }
    }
    expect(sharedPairs).toBeGreaterThan(100);

    // Contrast with flat/faceted mode (the old toNonIndexed() + computeVertexNormals() trap).
    const flat = createSmoothSolid(apple, { smooth: false });
    const fPos = flat.getAttribute('position');
    const fNorm = flat.getAttribute('normal');
    const flatFirst = new Map<string, THREE.Vector3>();
    let facetedJumps = 0;
    for (let i = 0; i < fPos.count; i++) {
      const key = [fPos.getX(i), fPos.getY(i), fPos.getZ(i)].map(x => Math.round(x * 1e6)).join(',');
      const n = new THREE.Vector3().fromBufferAttribute(fNorm, i);
      const ref = flatFirst.get(key);
      if (ref && n.dot(ref) < 0.99) facetedJumps++;
      else if (!ref) flatFirst.set(key, n);
    }
    expect(facetedJumps).toBeGreaterThan(100);

    // Crease-angle mode preserves crisp 90-degree box edges while smoothing cylindrical barrels.
    const cyl = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16);
    const creased = createSmoothSolid(cyl, { creaseAngle: Math.PI / 4 });
    const cPos = creased.getAttribute('position');
    const cNorm = creased.getAttribute('normal');
    let capNormals = 0;
    let barrelSmoothPairs = 0;
    const barrelByKey = new Map<string, THREE.Vector3>();
    for (let i = 0; i < cPos.count; i++) {
      const n = new THREE.Vector3().fromBufferAttribute(cNorm, i);
      if (Math.abs(n.y) > 0.999) {
        capNormals++;
      } else {
        const key = [cPos.getX(i), cPos.getY(i), cPos.getZ(i)].map(x => Math.round(x * 1e6)).join(',');
        const ref = barrelByKey.get(key);
        if (ref) {
          expect(n.dot(ref)).toBeGreaterThan(0.999);
          barrelSmoothPairs++;
        } else {
          barrelByKey.set(key, n);
        }
      }
    }
    expect(capNormals).toBeGreaterThan(0);
    expect(barrelSmoothPairs).toBeGreaterThan(20);

    // Inverted-winding input is automatically repaired to positive outward volume.
    const inverted = new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const idx = inverted.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const tmp = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, tmp);
    }
    const repaired = createSmoothSolid(inverted, { creaseAngle: Math.PI / 4, disposeSource: true });
    expect(signedVolume(repaired)).toBeGreaterThan(0);

    [apple, smooth, flat, cyl, creased, repaired].forEach(g => g.dispose());
  });
});
