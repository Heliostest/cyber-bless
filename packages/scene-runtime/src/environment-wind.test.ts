import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEnvironmentWind, readEnvironmentWind } from './environment-wind';

describe('shared coherent environment wind field', () => {
  it('normalizes direction, samples a spatially coherent travelling wave aligned with direction, and supports out reuse', () => {
    const wind = createEnvironmentWind({ direction: [3, 4], strength: 0.6 });
    expect(wind.direction.length()).toBeCloseTo(1, 6);
    expect(wind.direction.x).toBeCloseTo(0.6, 6);
    expect(wind.direction.y).toBeCloseTo(0.8, 6);
    expect(wind.time).toBe(0);
    expect(wind.strength).toBeCloseTo(0.6, 6);
    expect(wind.gust).toBe(0);

    // Nearby world positions sample smoothly coherent vectors.
    const a = wind.sample(0, 1, 0);
    const b = wind.sample(0.04, 1, 0.04);
    expect(a.distanceTo(b)).toBeLessThan(0.08);
    expect(a).not.toBe(b);

    // Passing `out` writes in place and returns the same Vector3 instance.
    const scratch = new THREE.Vector3();
    const returned = wind.sample(1.2, 0.8, -0.5, scratch);
    expect(returned).toBe(scratch);

    // Average wind over space and time aligns strongly with the wind direction.
    const mean = new THREE.Vector3();
    let count = 0;
    for (let t = 0; t < 12; t++) {
      wind.update(t * 0.45, 0.45, false);
      for (let x = -4; x <= 4; x += 2) {
        for (let z = -4; z <= 4; z += 2) {
          mean.add(wind.sample(x, 1, z, scratch));
          count++;
        }
      }
    }
    mean.divideScalar(count);
    const horizontalDot = mean.x * wind.direction.x + mean.z * wind.direction.y;
    expect(horizontalDot).toBeGreaterThan(0.15);
    const crossDot = Math.abs(-mean.x * wind.direction.y + mean.z * wind.direction.x);
    expect(crossDot).toBeLessThan(horizontalDot * 0.25);

    // Invalid/zero direction falls back to default unit direction (-0.8, 0.6).
    const fallback = createEnvironmentWind({ direction: [0, 0] });
    expect(fallback.direction.length()).toBeCloseTo(1, 6);
    expect(fallback.direction.x).toBeCloseTo(-0.8, 6);
    expect(fallback.direction.y).toBeCloseTo(0.6, 6);
  });

  it('amplifies wind on triggerGust and decays smoothly with a ~1.6s exponential time constant', () => {
    const wind = createEnvironmentWind({ strength: 0.5 });
    wind.update(1.0, 0, false);
    const calm = wind.sample(0.5, 1.0, -0.5);

    wind.triggerGust(1.0);
    expect(wind.gust).toBeCloseTo(1.0, 6);
    const gusted = wind.sample(0.5, 1.0, -0.5);
    expect(gusted.length()).toBeGreaterThan(calm.length() * 1.8);

    // After 1.6s decay constant, gust drops to 1/e of initial peak.
    wind.update(2.6, 1.6, false);
    expect(wind.gust).toBeCloseTo(Math.exp(-1), 4);

    // Further steps decay cleanly to exact 0.
    for (let i = 0; i < 12; i++) {
      wind.update(2.6 + (i + 1) * 1.6, 1.6, false);
    }
    expect(wind.gust).toBe(0);

    // Non-positive / NaN gusts are ignored and bursts clamp at 2.0.
    wind.triggerGust(0);
    wind.triggerGust(-1);
    wind.triggerGust(Number.NaN);
    expect(wind.gust).toBe(0);
    wind.triggerGust(5);
    expect(wind.gust).toBe(2);
  });

  it('returns zero vectors under reducedMotion or zero strength and restores cleanly when motion resumes', () => {
    const wind = createEnvironmentWind({ strength: 0.55 });
    wind.triggerGust(0.9);
    wind.update(2.0, 0.02, false);
    expect(wind.time).toBeCloseTo(2.0, 6);
    expect(wind.gust).toBeGreaterThan(0);

    // Enabling reducedMotion zeroes time, strength, gust, and sampled displacement.
    wind.update(2.5, 0.5, true);
    expect(wind.time).toBe(0);
    expect(wind.strength).toBe(0);
    expect(wind.gust).toBe(0);
    expect(wind.sample(1, 2, -3).toArray()).toEqual([0, 0, 0]);

    // Triggering gusts while reducedMotion is active has no effect.
    wind.triggerGust(1.0);
    expect(wind.gust).toBe(0);
    expect(wind.sample(1, 2, -3).toArray()).toEqual([0, 0, 0]);

    // Leaving reducedMotion restores base strength.
    wind.update(0.25, 0.25, false);
    expect(wind.strength).toBeCloseTo(0.55, 6);
    expect(wind.sample(1, 2, -3).length()).toBeGreaterThan(0);

    // Zero-strength wind always returns zero vector.
    const still = createEnvironmentWind({ strength: 0 });
    still.triggerGust(1.0);
    expect(still.strength).toBe(0);
    expect(still.sample(2, 1, -2).toArray()).toEqual([0, 0, 0]);
  });

  it('reads mounted wind field from a scene or descendant object and ignores absent or invalid entries', () => {
    expect(readEnvironmentWind(null)).toBeUndefined();
    expect(readEnvironmentWind(undefined)).toBeUndefined();

    const scene = new THREE.Scene();
    expect(readEnvironmentWind(scene)).toBeUndefined();

    scene.userData.environmentWind = { invalid: true };
    expect(readEnvironmentWind(scene)).toBeUndefined();

    const wind = createEnvironmentWind();
    scene.userData.environmentWind = wind;
    const group = new THREE.Group();
    const child = new THREE.Mesh();
    group.add(child);
    scene.add(group);

    expect(readEnvironmentWind(scene)).toBe(wind);
    expect(readEnvironmentWind(group)).toBe(wind);
    expect(readEnvironmentWind(child)).toBe(wind);
  });
});
