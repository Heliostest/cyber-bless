import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  _resetRapierLoaderForTest,
  createClosedTubeWriter,
  createRapierSoftBodyHost,
  isRapierLoaded,
  loadRapier,
  syncParticlesToGeometry,
} from './rapier-soft-body';

describe('rapier-soft-body shared runtime', () => {
  afterEach(() => {
    _resetRapierLoaderForTest();
  });

  it('does not load WASM on module import or host construction until start() is called', () => {
    expect(isRapierLoaded()).toBe(false);
    const loader = vi.fn(async () => loadRapier());
    const host = createRapierSoftBodyHost({ loader });
    expect(host.ready).toBe(false);
    expect(loader).not.toHaveBeenCalled();
    expect(isRapierLoaded()).toBe(false);
    host.dispose();
  });

  it('loads real @dimforge/rapier3d-simd WASM lazily, steps cloth & rope against rigid colliders, and writes back to BufferGeometry', async () => {
    let clothHandle: ReturnType<NonNullable<typeof host.session>['createCloth']> | null = null;
    let ropeHandle: ReturnType<NonNullable<typeof host.session>['createRope']> | null = null;

    const errors: unknown[] = [];
    const host = createRapierSoftBodyHost({
      gravity: { x: 0, y: -9.81, z: 0 },
      onError(err) { errors.push(err); },
      onReady(session) {
        // Fixed floor slab whose top surface is at y = 0.
        session.addFixedBox({ x: 0, y: -0.05, z: 0 }, { x: 4, y: 0.1, z: 4 }, { friction: 0.8 });
        clothHandle = session.createCloth({
          origin: { x: -0.4, y: 0.35, z: -0.2 },
          du: { x: 0.2, y: 0, z: 0 },
          dv: { x: 0, y: 0, z: 0.2 },
          nu: 5,
          nv: 3,
          mass: 0.4,
          particleRadius: 0.015,
          linearDamping: 1.5,
          softness: { naturalFrequency: 24, dampingRatio: 0.8 },
          canSleep: true,
        });
        ropeHandle = session.createRope({
          start: { x: 0, y: 1.2, z: 0 },
          end: { x: 0.8, y: 1.2, z: 0 },
          numParticles: 9,
          pinnedParticles: [0],
          mass: 0.2,
          particleRadius: 0.012,
          linearDamping: 1.2,
          softness: { naturalFrequency: 28, dampingRatio: 0.7 },
          canSleep: true,
        });
      },
    });

    const session = await host.start();
    expect(errors).toEqual([]);
    expect(session).not.toBeNull();
    expect(isRapierLoaded()).toBe(true);
    expect(session!.rapier.version()).toMatch(/^0\.21\./);
    expect(clothHandle).not.toBeNull();
    expect(ropeHandle).not.toBeNull();

    // Prepare Three.js BufferGeometry bound 1:1 to cloth particles.
    const clothGeo = new THREE.BufferGeometry();
    const initialCloth = clothHandle!.particlePositions().slice();
    const posBuf = new Float32Array(initialCloth);
    clothGeo.setAttribute('position', new THREE.BufferAttribute(posBuf, 3));

    const initialRopeTipY = ropeHandle!.particlePosition(8).y;
    for (let i = 0; i < 45; i++) {
      host.step(1 / 60);
    }
    syncParticlesToGeometry(clothHandle!.particlePositions(), clothGeo);

    // Same GPU buffer reused in-place; cloth dropped onto floor and stopped above floor top (y >= -0.02).
    expect(clothGeo.getAttribute('position').array).toBe(posBuf);
    let minY = Infinity;
    let avgY = 0;
    for (let i = 0; i < clothHandle!.numParticles(); i++) {
      const y = clothGeo.getAttribute('position').getY(i);
      expect(Number.isFinite(y)).toBe(true);
      minY = Math.min(minY, y);
      avgY += y / clothHandle!.numParticles();
    }
    expect(avgY).toBeLessThan(0.25);
    expect(minY).toBeGreaterThan(-0.02);

    // Rope pinned at 0 stays at y = 1.2 while free tip sags under gravity.
    expect(ropeHandle!.particlePosition(0).y).toBeCloseTo(1.2, 4);
    expect(ropeHandle!.particlePosition(8).y).toBeLessThan(initialRopeTipY - 0.15);

    clothGeo.dispose();
    host.dispose();
    expect(host.disposed).toBe(true);
    expect(host.session).toBeNull();
    // Idempotent disposal
    expect(() => host.dispose()).not.toThrow();
  });

  it('respects reduced motion, inactive pause gating, and sleep/wakeUp lifecycle', async () => {
    let active = true;
    let reduced = false;
    let rope: ReturnType<NonNullable<typeof host.session>['createRope']> | null = null;

    const host = createRapierSoftBodyHost({
      isActive: () => active,
      isReducedMotion: () => reduced,
      sleepSpeedThreshold: 0.02,
      sleepTimeRequired: 0.2,
      onReady(session) {
        rope = session.createRope({
          start: { x: 0, y: 1, z: 0 },
          end: { x: 0, y: 0.4, z: 0 },
          numParticles: 6,
          pinnedParticles: [0],
          linearDamping: 8,
          canSleep: true,
        });
      },
    });

    await host.start();
    expect(host.ready).toBe(true);

    // Reduced motion blocks stepping.
    reduced = true;
    const beforeReduced = rope!.particlePositions().slice();
    expect(host.step(0.05)).toBe(false);
    expect(Array.from(rope!.particlePositions())).toEqual(Array.from(beforeReduced));

    // Inactive / paused blocks stepping.
    reduced = false;
    active = false;
    expect(host.step(0.05)).toBe(false);
    expect(Array.from(rope!.particlePositions())).toEqual(Array.from(beforeReduced));

    // Active steps until the heavily damped hanging rope settles and enters sleep.
    active = true;
    let stepped = 0;
    for (let i = 0; i < 180; i++) {
      if (host.step(1 / 60)) stepped++;
    }
    expect(stepped).toBeGreaterThan(0);
    expect(host.sleeping).toBe(true);
    // Further steps while sleeping are skipped.
    expect(host.step(1 / 60)).toBe(false);

    // Waking up resumes stepping cleanly.
    host.wakeUp();
    expect(host.sleeping).toBe(false);
    expect(host.step(1 / 60)).toBe(true);

    host.dispose();
  });

  it('cancels an in-flight lazy load cleanly when disposed before resolution', async () => {
    let resolveLoader!: (mod: Awaited<ReturnType<typeof loadRapier>>) => void;
    const realPromise = loadRapier();
    const gatedLoader = () =>
      new Promise<Awaited<ReturnType<typeof loadRapier>>>((resolve) => {
        resolveLoader = resolve;
      });
    const onReady = vi.fn();
    const host = createRapierSoftBodyHost({ loader: gatedLoader, onReady });
    const pending = host.start();
    host.dispose();
    resolveLoader(await realPromise);
    const result = await pending;
    expect(result).toBeNull();
    expect(onReady).not.toHaveBeenCalled();
    expect(host.ready).toBe(false);
  });

  it('updates a closed non-indexed tube solid and its welded outline shell in-place without reallocating buffers', () => {
    const pts = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * 0.4, 0.1, Math.sin(a) * 0.3);
    });
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const tube = new THREE.TubeGeometry(curve, 36, 0.03, 8, true).toNonIndexed();
    const outline = tube.clone();
    const posArray = tube.getAttribute('position').array;
    const outArray = outline.getAttribute('position').array;

    const writer = createClosedTubeWriter(tube, 36, 8, 0.03, outline);
    const sagged = pts.map((p, i) => p.clone().add(new THREE.Vector3(0, i === 6 ? -0.04 : 0, 0)));
    writer.update(sagged);

    expect(tube.getAttribute('position').array).toBe(posArray);
    expect(outline.getAttribute('position').array).toBe(outArray);
    tube.computeBoundingBox();
    outline.computeBoundingBox();
    expect(tube.boundingBox!.min.distanceTo(outline.boundingBox!.min)).toBeLessThan(1e-5);
    expect(tube.boundingBox!.max.distanceTo(outline.boundingBox!.max)).toBeLessThan(1e-5);
    expect(tube.boundingBox!.min.y).toBeLessThan(0.05);

    tube.dispose();
    outline.dispose();
  });
});
