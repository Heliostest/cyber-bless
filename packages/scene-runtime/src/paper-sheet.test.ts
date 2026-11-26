import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  createHangingPaperRig,
  createPaperStripSurface,
  poseRestingPaperStrip,
} from './paper-sheet';
import { _resetRapierLoaderForTest } from './rapier-soft-body';

describe('stiff hanging paper sheet helper', () => {
  afterEach(() => {
    _resetRapierLoaderForTest();
  });

  it('builds a subdivided PlaneGeometry with matching parameters and synchronized perimeter edge ribbon', () => {
    const surface = createPaperStripSurface(0.12, 0.42, { segX: 4, segY: 12, thickness: 0.0028 });
    expect(surface.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    expect(surface.geometry.parameters.width).toBe(0.12);
    expect(surface.geometry.parameters.height).toBe(0.42);

    poseRestingPaperStrip(surface, { yaw: 0.2, bendZ: 0.25, twist: 0.08 });
    const pos = surface.geometry.getAttribute('position') as THREE.BufferAttribute;
    const edgePos = surface.edgeGeometry.getAttribute('position') as THREE.BufferAttribute;

    // Top center remains anchored at (0, 0, 0).
    const topCenter = 2; // segX = 4 -> index 2 is u = 0.5
    expect(pos.getX(topCenter)).toBeCloseTo(0, 4);
    expect(pos.getY(topCenter)).toBeCloseTo(0, 4);

    // Strip bends in Z without stretching vertically beyond its authored length.
    let minY = Infinity;
    let maxAbsZ = 0;
    for (let i = 0; i < pos.count; i++) {
      minY = Math.min(minY, pos.getY(i));
      maxAbsZ = Math.max(maxAbsZ, Math.abs(pos.getZ(i)));
    }
    expect(minY).toBeGreaterThan(-0.421);
    expect(minY).toBeLessThan(-0.38);
    expect(maxAbsZ).toBeGreaterThan(0.02);

    // Edge geometry has finite non-degenerate thickness around the perimeter.
    for (let i = 0; i < edgePos.count; i++) {
      expect(Number.isFinite(edgePos.getX(i) + edgePos.getY(i) + edgePos.getZ(i))).toBe(true);
    }
    surface.geometry.dispose();
    surface.edgeGeometry.dispose();
  });

  it('simulates stiff hanging paper in Rapier without cloth-like sag or stretch', async () => {
    const surface = createPaperStripSurface(0.12, 0.42, { segX: 4, segY: 12, thickness: 0.0026 });
    const posArray = surface.geometry.getAttribute('position').array;
    const edgeArray = surface.edgeGeometry.getAttribute('position').array;

    const rig = createHangingPaperRig({
      strips: [{ surface, phase: 0.4, baseYaw: 0.18, curlBias: 0.7 }],
      settleSteps: 36,
    });
    const session = await rig.start();
    expect(session).not.toBeNull();
    expect(rig.ready).toBe(true);

    for (let i = 0; i < 60; i++) {
      rig.update(1 / 60, i / 60);
    }

    // Reuses GPU buffers in-place.
    expect(surface.geometry.getAttribute('position').array).toBe(posArray);
    expect(surface.edgeGeometry.getAttribute('position').array).toBe(edgeArray);

    // Measure centerline arc length: stiff paper must stay inextensible (~0.42m)
    // and curve smoothly rather than folding over or collapsing.
    const pos = surface.geometry.getAttribute('position') as THREE.BufferAttribute;
    const cols = surface.segX + 1;
    const midCol = Math.floor(surface.segX / 2);
    let arcLen = 0;
    const prev = new THREE.Vector3();
    const curr = new THREE.Vector3();
    let maxCurvatureDelta = 0;
    let maxDeflection = 0;
    prev.fromBufferAttribute(pos, midCol);
    expect(prev.length()).toBeLessThan(0.005);

    const segDirs: THREE.Vector3[] = [];
    for (let y = 1; y <= surface.segY; y++) {
      curr.fromBufferAttribute(pos, y * cols + midCol);
      const d = curr.distanceTo(prev);
      arcLen += d;
      segDirs.push(curr.clone().sub(prev).normalize());
      maxDeflection = Math.max(maxDeflection, Math.hypot(curr.x, curr.z));
      prev.copy(curr);
    }
    for (let i = 1; i < segDirs.length; i++) {
      const dot = THREE.MathUtils.clamp(segDirs[i - 1]!.dot(segDirs[i]!), -1, 1);
      maxCurvatureDelta = Math.max(maxCurvatureDelta, Math.acos(dot));
    }

    // Non-stretching (within 2.5% of authored 0.42 length).
    expect(arcLen).toBeGreaterThan(0.41);
    expect(arcLen).toBeLessThan(0.432);
    // Noticeably curved 3D paper silhouette, not a flat rigid board or crumpled cloth.
    expect(maxDeflection).toBeGreaterThan(0.012);
    expect(maxDeflection).toBeLessThan(0.22);
    // Smooth elastic bend without sharp cloth-like kinks between adjacent segments.
    expect(maxCurvatureDelta).toBeLessThan(0.25);

    rig.dispose();
    surface.geometry.dispose();
    surface.edgeGeometry.dispose();
  });

  it('respects reduced motion by holding a deterministic curved pose without starting Rapier', async () => {
    let reduced = true;
    const surface = createPaperStripSurface(0.12, 0.42);
    const rig = createHangingPaperRig({
      strips: [{ surface, baseYaw: 0.2, curlBias: 0.6 }],
      isReducedMotion: () => reduced,
    });
    expect(await rig.start()).toBeNull();
    expect(rig.ready).toBe(false);
    rig.update(0.05, 0);
    const snap1 = Array.from(surface.geometry.getAttribute('position').array);
    rig.update(0.05, 2.5);
    const snap2 = Array.from(surface.geometry.getAttribute('position').array);
    expect(snap2).toEqual(snap1);

    rig.dispose();
    surface.geometry.dispose();
    surface.edgeGeometry.dispose();
    void reduced;
  });
});
