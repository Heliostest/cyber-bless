import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  bakeCreviceAO,
  createCurvedStreamGeometry,
  createThrownVessel,
  updateCurvedStream,
} from './prop-geometry';

function averageBrightness(geometry: THREE.BufferGeometry, predicate: (x: number, y: number, z: number, nx: number, ny: number, nz: number) => boolean): number {
  const pos = geometry.getAttribute('position');
  const nor = geometry.getAttribute('normal');
  const col = geometry.getAttribute('color');
  let sum = 0;
  let count = 0;
  for (let i = 0; i < pos.count; i++) {
    if (predicate(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getX(i), nor.getY(i), nor.getZ(i))) {
      sum += (col.getX(i) + col.getY(i) + col.getZ(i)) / 3;
      count++;
    }
  }
  expect(count).toBeGreaterThan(0);
  return sum / count;
}

describe('prop geometry and crevice AO kit', () => {
  it('bakes warm purple-umber crevice AO near ground contact and interior cavities while preserving existing vertex colors', () => {
    const cylinder = new THREE.CylinderGeometry(0.12, 0.12, 0.3, 24, 8);
    cylinder.translate(0, 0.15, 0);

    // Pre-paint existing vertex colors (warm cream) to verify multiplication rather than overwrite.
    const count = cylinder.getAttribute('position').count;
    const baseColors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      baseColors[i * 3] = 0.8;
      baseColors[i * 3 + 1] = 0.7;
      baseColors[i * 3 + 2] = 0.6;
    }
    cylinder.setAttribute('color', new THREE.BufferAttribute(baseColors, 3));

    bakeCreviceAO(cylinder, { groundY: 0, groundRange: 0.08, strength: 0.45 });

    const bottomLuma = averageBrightness(cylinder, (_x, y) => y < 0.02);
    const upperLuma = averageBrightness(cylinder, (_x, y, _z, _nx, ny) => y > 0.24 && ny >= 0);

    expect(bottomLuma).toBeLessThan(upperLuma * 0.9);
    // Preserved existing color ratio: upper R remains around 0.8 (not overwritten to 1.0).
    const col = cylinder.getAttribute('color');
    const pos = cylinder.getAttribute('position');
    let checked = 0;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0.28) {
        expect(col.getX(i)).toBeLessThanOrEqual(0.801);
        expect(col.getX(i)).toBeGreaterThan(0.75);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
    cylinder.dispose();
  });

  it('builds a thrown vessel with welded seam normals, valid manifold indices, wall thickness, and darkened base/interior AO', () => {
    const profile: [number, number][] = [
      [0.055, 0.0],
      [0.068, 0.02],
      [0.092, 0.075],
      [0.086, 0.125],
      [0.090, 0.145],
    ];
    const segments = 24;
    const vessel = createThrownVessel(profile, {
      segments,
      wallThickness: 0.008,
      footRing: true,
      rolledLip: true,
      bodyColor: 0xe6ece4,
      rimColor: 0xf4f0e4,
      footColor: 0xd8c3a0,
      insideColor: 0xe6ece4,
      creviceAO: true,
    });

    const pos = vessel.getAttribute('position');
    const nor = vessel.getAttribute('normal');
    const col = vessel.getAttribute('color');
    const idx = vessel.getIndex();

    expect(pos).toBeDefined();
    expect(nor).toBeDefined();
    expect(col).toBeDefined();
    expect(idx).not.toBeNull();
    expect(idx!.count).toBeGreaterThan(0);
    expect(idx!.count % 3).toBe(0);

    // Every index is in bounds and every triangle is non-degenerate.
    for (let i = 0; i < idx!.count; i += 3) {
      const a = idx!.getX(i);
      const b = idx!.getX(i + 1);
      const c = idx!.getX(i + 2);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(pos.count);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(pos.count);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(pos.count);
      expect(a).not.toBe(b);
      expect(b).not.toBe(c);
      expect(a).not.toBe(c);
    }

    // Welded u=0 / u=1 seam normals across every latitude row.
    const stride = segments + 1;
    const rowCount = pos.count / stride;
    expect(Number.isInteger(rowCount)).toBe(true);
    for (let r = 0; r < rowCount; r++) {
      const start = r * stride;
      const end = r * stride + segments;
      expect(nor.getX(start)).toBeCloseTo(nor.getX(end), 5);
      expect(nor.getY(start)).toBeCloseTo(nor.getY(end), 5);
      expect(nor.getZ(start)).toBeCloseTo(nor.getZ(end), 5);
      expect(pos.getX(start)).toBeCloseTo(pos.getX(end), 5);
      expect(pos.getY(start)).toBeCloseTo(pos.getY(end), 5);
      expect(pos.getZ(start)).toBeCloseTo(pos.getZ(end), 5);
    }

    // All normals are finite unit vectors.
    for (let i = 0; i < nor.count; i++) {
      const len = Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i));
      expect(Number.isFinite(len)).toBe(true);
      expect(len).toBeCloseTo(1, 3);
    }

    // Interior cavity and base are darker than the sunlit upper outer wall.
    const upperOuter = averageBrightness(vessel, (x, y, z, nx, _ny, nz) => {
      const rad = Math.hypot(x, z);
      const dot = rad > 1e-4 ? (x * nx + z * nz) / rad : 0;
      return y > 0.08 && y < 0.135 && dot > 0.5;
    });
    const deepInner = averageBrightness(vessel, (x, y, z, nx, _ny, nz) => {
      const rad = Math.hypot(x, z);
      const dot = rad > 1e-4 ? (x * nx + z * nz) / rad : 0;
      return y < 0.075 && y > 0.012 && dot < -0.5;
    });
    expect(deepInner).toBeLessThan(upperOuter * 0.92);

    // Supports disabling footRing, rolledLip, and creviceAO cleanly.
    const plain = createThrownVessel(profile, { footRing: false, rolledLip: false, creviceAO: false });
    expect(plain.getAttribute('position').count).toBeGreaterThan(0);
    expect(plain.getIndex()!.count).toBeGreaterThan(0);

    vessel.dispose();
    plain.dispose();
  });

  it('creates and updates a parabolic gravity-curved liquid stream with tapering radius, shimmer, and welded seam normals', () => {
    const radial = 10;
    const tubular = 16;
    const stream = createCurvedStreamGeometry(radial, tubular);

    const start = new THREE.Vector3(0, 0.32, 0);
    const end = new THREE.Vector3(0.18, 0.0, 0.04);

    updateCurvedStream(stream, start, end, {
      startRadius: 0.012,
      endRadius: 0.004,
      sag: 0.07,
      time: 0.25,
      flow: 1.0,
    });

    const pos = stream.getAttribute('position');
    const nor = stream.getAttribute('normal');
    const stride = radial + 1;

    // Helper to compute ring center and average radius for ring index i.
    const ringStats = (ringIndex: number) => {
      const center = new THREE.Vector3();
      for (let j = 0; j < radial; j++) {
        const idx = ringIndex * stride + j;
        center.x += pos.getX(idx);
        center.y += pos.getY(idx);
        center.z += pos.getZ(idx);
      }
      center.divideScalar(radial);
      let avgR = 0;
      for (let j = 0; j < radial; j++) {
        const idx = ringIndex * stride + j;
        avgR += Math.hypot(pos.getX(idx) - center.x, pos.getY(idx) - center.y, pos.getZ(idx) - center.z);
      }
      return { center, avgR: avgR / radial };
    };

    const startRing = ringStats(0);
    const midRing = ringStats(tubular / 2);
    const endRing = ringStats(tubular);

    expect(startRing.center.distanceTo(start)).toBeLessThan(1e-4);
    expect(endRing.center.distanceTo(end)).toBeLessThan(1e-4);

    // Gravity arc lifts midpoint above the straight chord by sag (0.07).
    const chordMidY = (start.y + end.y) * 0.5;
    expect(midRing.center.y).toBeCloseTo(chordMidY + 0.07, 4);

    // Radius tapers naturally from spout to impact.
    expect(startRing.avgR).toBeCloseTo(0.012, 4);
    expect(endRing.avgR).toBeCloseTo(0.004, 4);
    expect(startRing.avgR).toBeGreaterThan(endRing.avgR * 2.5);

    // Seam normals welded at u=0 / u=1 for every ring.
    for (let i = 0; i <= tubular; i++) {
      const a = i * stride;
      const b = i * stride + radial;
      expect(nor.getX(a)).toBeCloseTo(nor.getX(b), 5);
      expect(nor.getY(a)).toBeCloseTo(nor.getY(b), 5);
      expect(nor.getZ(a)).toBeCloseTo(nor.getZ(b), 5);
    }

    // Advancing time produces subtle surface shimmer on interior rings without moving endpoints.
    const midBefore = midRing.avgR;
    updateCurvedStream(stream, start, end, {
      startRadius: 0.012,
      endRadius: 0.004,
      sag: 0.07,
      time: 0.36,
      flow: 1.0,
    });
    const midAfter = ringStats(tubular / 2).avgR;
    expect(Math.abs(midAfter - midBefore)).toBeGreaterThan(1e-5);
    expect(ringStats(0).center.distanceTo(start)).toBeLessThan(1e-4);
    expect(ringStats(tubular).center.distanceTo(end)).toBeLessThan(1e-4);

    stream.dispose();
  });
});
