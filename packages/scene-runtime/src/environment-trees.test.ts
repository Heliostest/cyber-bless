import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { createEnvironmentTrees } from './environment-trees';

const placements = [{ x: 3, z: -4, scale: 2, turn: .4, variant: 'round' as const }];
function model() {
  const root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial());
  mesh.position.y = 1; root.add(mesh); return root;
}
it('restores the previous scene trees and captures them while Komorebi remains an optional comparison', async () => {
  const legacy = new THREE.Group(), load = vi.fn(async () => model()), onChange = vi.fn();
  const trees = createEnvironmentTrees([legacy], placements, 0, { load, recommendation: 'cherry', onChange });
  await trees.ready;
  expect(load).toHaveBeenCalledWith('/environments/trees/simple-tree/cherry-round.glb');
  expect(load).not.toHaveBeenCalledWith('/environments/trees/komorebi/round.glb');
  expect(onChange).toHaveBeenLastCalledWith({ count: 1, actual: 'scene', status: 'ready' });
  const baseline = trees.root.getObjectByName('recommended-environment-trees')!;
  const preview = trees.root.getObjectByName('alternative-environment-trees')!;
  expect(baseline.visible).toBe(true); expect(legacy.visible).toBe(false);
  await trees.select('komorebi');
  expect(load).toHaveBeenCalledWith('/environments/trees/komorebi/round.glb');
  expect(onChange).toHaveBeenLastCalledWith({ count: 1, actual: 'komorebi', status: 'ready' });
  expect(preview.visible).toBe(true); expect(baseline.visible).toBe(false);
  const calls = load.mock.calls.length, restore = trees.captureDefault();
  expect(baseline.visible).toBe(true); expect(preview.visible).toBe(false);
  expect(load).toHaveBeenCalledTimes(calls);
  restore?.(); expect(preview.visible).toBe(true); expect(baseline.visible).toBe(false);
  await trees.select('original'); expect(legacy.visible).toBe(true);
  const reset = trees.captureDefault(); expect(legacy.visible).toBe(false); expect(baseline.visible).toBe(true); reset?.();
  await trees.select('scene'); expect(preview.visible).toBe(false);expect(baseline.visible).toBe(true);
  expect(load).toHaveBeenCalledTimes(calls);
  expect(onChange).toHaveBeenLastCalledWith({ count: 1, actual: 'scene', status: 'ready' });
  trees.dispose();
});

it('keeps the original scenery without loading any optional tree until selected, then falls back on failure', async () => {
  const legacy = new THREE.Group(), onChange = vi.fn(), load = vi.fn(async () => { throw Error('unavailable'); });
  const trees = createEnvironmentTrees([legacy], placements, 0, { recommendation: 'original', load, onChange });
  await trees.ready; expect(load).not.toHaveBeenCalled(); expect(legacy.visible).toBe(true);
  await trees.select('scene');expect(legacy.visible).toBe(true);expect(load).not.toHaveBeenCalled();
  await trees.select('komorebi'); expect(legacy.visible).toBe(true);
  expect(onChange).toHaveBeenLastCalledWith({ count: 1, actual: 'original', status: 'error' });
  trees.dispose();
});
