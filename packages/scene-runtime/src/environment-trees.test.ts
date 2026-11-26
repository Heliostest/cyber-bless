import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { createEnvironmentTrees } from './environment-trees';

const placements = [{ x: -5.4, z: -6.9, scale: 2.7, turn: .4, variant: 'round' as const }];
function model() {
  const root = new THREE.Group(), mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial());
  mesh.position.y = 1; root.add(mesh); return root;
}

it('loads far-planted scene Simple Trees without preview framing, isolates debug previews, and restores defaults on capture', async () => {
  const camera = new THREE.PerspectiveCamera(42, 1.5, .1, 100);
  camera.position.set(0, 1.45, 7.6); camera.lookAt(0, 1.55, 0); camera.updateMatrixWorld(true);
  const load = vi.fn(async () => model()), onChange = vi.fn();
  const trees = createEnvironmentTrees(placements, 0, { load, recommendation: 'cherry', camera, onChange });
  await trees.ready;
  expect(load).toHaveBeenCalledWith('/environments/trees/simple-tree/cherry-round.glb');
  expect(load).not.toHaveBeenCalledWith('/environments/trees/komorebi/round.glb');
  expect(onChange).toHaveBeenLastCalledWith({ count: 1, actual: 'scene', status: 'ready' });
  // Production default must not activate near preview layout or preview shadow weakening.
  expect(trees.isPreviewVisible()).toBe(false);
  const baseline = trees.root.getObjectByName('recommended-environment-trees')!;
  const preview = trees.root.getObjectByName('alternative-environment-trees')!;
  expect(baseline.visible).toBe(true); expect(preview.visible).toBe(false);
  const baseMesh = baseline.children[0] as THREE.InstancedMesh, m = new THREE.Matrix4(), pos = new THREE.Vector3();
  baseMesh.getMatrixAt(0, m); pos.setFromMatrixPosition(m);
  expect(pos.x).toBeCloseTo(-5.4, 3); expect(pos.z).toBeCloseTo(-6.9, 3);

  await trees.select('komorebi');
  expect(load).toHaveBeenCalledWith('/environments/trees/komorebi/round.glb');
  expect(onChange).toHaveBeenLastCalledWith({ count: 1, actual: 'komorebi', status: 'ready' });
  expect(preview.visible).toBe(true); expect(baseline.visible).toBe(false);
  expect(trees.isPreviewVisible()).toBe(true);

  const calls = load.mock.calls.length, restore = trees.captureDefault();
  expect(baseline.visible).toBe(true); expect(preview.visible).toBe(false);
  expect(trees.isPreviewVisible()).toBe(false);
  expect(load).toHaveBeenCalledTimes(calls);
  restore?.(); expect(preview.visible).toBe(true); expect(baseline.visible).toBe(false);
  expect(trees.isPreviewVisible()).toBe(true);

  await trees.select('scene'); expect(preview.visible).toBe(false); expect(baseline.visible).toBe(true);
  expect(trees.isPreviewVisible()).toBe(false);
  expect(load).toHaveBeenCalledTimes(calls);
  expect(onChange).toHaveBeenLastCalledWith({ count: 1, actual: 'scene', status: 'ready' });
  trees.dispose();
});

it('keeps the loaded scene baseline visible if an optional debug tree fails to load, and loads oak for neutral defaults', async () => {
  const onChange = vi.fn();
  const load = vi.fn(async (url: string) => {
    if (url.includes('komorebi')) throw Error('unavailable');
    return model();
  });
  const trees = createEnvironmentTrees(placements, 0, { recommendation: 'oak', load, onChange });
  await trees.ready;
  expect(load).toHaveBeenCalledWith('/environments/trees/simple-tree/round.glb');
  const baseline = trees.root.getObjectByName('recommended-environment-trees')!;
  expect(baseline.visible).toBe(true);
  await trees.select('komorebi');
  expect(baseline.visible).toBe(true);
  expect(onChange).toHaveBeenLastCalledWith({ count: 1, actual: 'scene', status: 'error' });
  trees.dispose();
});

it('loads zero tree assets when placements are empty (coastal staging)', async () => {
  const load = vi.fn(async () => model());
  const trees = createEnvironmentTrees([], 0, { recommendation: 'oak', load });
  await trees.ready;
  expect(load).not.toHaveBeenCalled();
  expect(trees.isPreviewVisible()).toBe(false);
  trees.dispose();
});
