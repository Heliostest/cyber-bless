import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createTreeRendering } from './imported-trees';

const placements = [{ x: 3, z: -4, scale: 2, turn: .4, variant: 'round' as const }];
function model() {
  const root = new THREE.Group(), texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, alphaTest: .5, vertexColors: true });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), material); mesh.position.y = 2; root.add(mesh);
  return { root, material, texture, mesh };
}
describe('source tree switching', () => {
  it('frames near trees beside the viewer, crops their roots and reframes only when the viewport changes', async () => {
    const camera = new THREE.PerspectiveCamera(42, 1.5, .1, 100);
    camera.position.set(0, 1.45, 7.6); camera.lookAt(0, 1.55, 0); camera.updateMatrixWorld(true);
    const original = new THREE.Group(), load = vi.fn(async () => model().root);
    const pair = [...placements, { ...placements[0], variant: 'cluster' as const, x: -3 }];
    const trees = createTreeRendering([original], pair, 0, { load, camera });
    await trees.select('cherry');
    const instance = trees.root.children[0] as THREE.InstancedMesh, transform = new THREE.Matrix4();
    instance.getMatrixAt(0, transform);
    instance.geometry.computeBoundingBox();
    const base = new THREE.Vector3(0, instance.geometry.boundingBox!.min.y, 0).applyMatrix4(transform).project(camera);
    expect(base.y).toBeLessThan(-1);
    const first = instance.instanceMatrix.array.slice();
    camera.position.z -= .5; camera.updateMatrixWorld(true); trees.reframe();
    expect(instance.instanceMatrix.array).toEqual(first);
    camera.aspect = .8; camera.updateProjectionMatrix(); trees.reframe();
    expect(instance.instanceMatrix.array).not.toEqual(first); expect(load).toHaveBeenCalledTimes(2);
    expect(original.visible).toBe(false);
    await trees.select('original'); expect(original.visible).toBe(true); trees.dispose();
  });
  it('loads and releases both source-generated cherry variants for scene recommendations', async () => {
    const round = model(), cluster = model(), load = vi.fn(async (url: string) => url.includes('cherry-round') ? round.root : cluster.root), onChange = vi.fn();
    const pair = [...placements, { ...placements[0], variant: 'cluster' as const, x: -3 }];
    const trees = createTreeRendering([], pair, 0, { load, onChange, recommendation: 'cherry' });
    await trees.select('scene');
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenCalledWith('/environments/trees/simple-tree/cherry-round.glb');
    expect(load).toHaveBeenCalledWith('/environments/trees/simple-tree/cherry-cluster.glb');
    expect(trees.root.children).toHaveLength(2);
    const disposeRound = vi.spyOn(round.material, 'dispose'), disposeCluster = vi.spyOn(cluster.material, 'dispose'); await trees.select('original');
    expect(disposeRound).toHaveBeenCalledOnce(); expect(disposeCluster).toHaveBeenCalledOnce(); trees.dispose();
  });
  it('releases a fulfilled variant immediately when another load is still pending', async () => {
    const source = model(), dispose = vi.spyOn(source.material, 'dispose');
    let resolve!: (tree: THREE.Group) => void;
    const pair = [...placements, { ...placements[0], variant: 'cluster' as const, x: -3 }];
    const trees = createTreeRendering([], pair, 0, { load: url => url.includes('/round.') ? Promise.resolve(source.root) : new Promise(done => { resolve = done; }) });
    const pending = trees.select('simple-tree');
    await Promise.resolve(); await Promise.resolve(); trees.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    const late = model(), lateDispose = vi.spyOn(late.material, 'dispose'); resolve(late.root); await pending;
    expect(lateDispose).toHaveBeenCalledOnce();
  });
  it('reports a failed variant without waiting for an unrelated stalled download', async () => {
    const onChange = vi.fn(), pair = [...placements, { ...placements[0], variant: 'cluster' as const, x: -3 }];
    const trees = createTreeRendering([], pair, 0, { onChange,
      load: url => url.includes('/round.') ? Promise.reject(Error('missing')) : new Promise(() => {}) });
    void trees.select('quaternius');
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(onChange).toHaveBeenLastCalledWith({ count: 2, actual: 'original', status: 'error' }); trees.dispose();
  });
  it('normalizes real source geometry, preserves cutout leaves, restores originals and frees resources', async () => {
    const original = new THREE.Group(), source = model(), onChange = vi.fn();
    const dispose = vi.spyOn(source.mesh.geometry, 'dispose'), disposeTexture = vi.spyOn(source.texture, 'dispose');
    const trees = createTreeRendering([original], placements, -.1, { load: async () => source.root, onChange });
    await trees.select('simple-tree');
    expect(original.visible).toBe(false);
    const instance = trees.root.children[0] as THREE.InstancedMesh;
    expect(instance.isInstancedMesh).toBe(true); expect(instance.material).toBe(source.material);
    expect(instance.castShadow).toBe(true); expect(instance.receiveShadow).toBe(false);
    expect(source.material.alphaTest).toBe(.5); expect(source.material.side).toBe(THREE.DoubleSide);
    const restoreCapture = trees.captureOriginal();
    expect(original.visible).toBe(true); expect(trees.root.visible).toBe(false);
    restoreCapture?.(); restoreCapture?.();
    expect(original.visible).toBe(false); expect(trees.root.visible).toBe(true);
    const box = new THREE.Box3().setFromObject(trees.root);
    expect(box.max.y - box.min.y).toBeCloseTo(2); expect(box.min.y).toBeCloseTo(-.086);
    expect(onChange).toHaveBeenLastCalledWith({ count: 1, actual: 'simple-tree', status: 'ready' });
    trees.update(4, true); const matrix = instance.instanceMatrix.array.slice();
    trees.update(5, true); expect(instance.instanceMatrix.array).toEqual(matrix);
    await trees.select('original'); expect(original.visible).toBe(true); expect(trees.root.children).toHaveLength(0);
    expect(dispose).toHaveBeenCalledOnce(); expect(disposeTexture).toHaveBeenCalledOnce();
    trees.dispose(); trees.dispose();
  });
  it('keeps originals on failure and disposes late arrivals after switching or exiting', async () => {
    const original = new THREE.Group(), source = model();
    let resolve!: (model: THREE.Group) => void;
    const load = vi.fn(() => new Promise<THREE.Group>(done => { resolve = done; })), onChange = vi.fn();
    const release = vi.spyOn(source.material, 'dispose');
    const trees = createTreeRendering([original], placements, 0, { load, onChange });
    const pending = trees.select('quaternius');
    expect(original.visible).toBe(true); expect(onChange).toHaveBeenLastCalledWith({ count: 1, actual: 'original', status: 'loading' });
    await trees.select('original'); resolve(source.root); await pending;
    expect(original.visible).toBe(true); expect(release).toHaveBeenCalledOnce(); expect(trees.root.children).toHaveLength(0);
    const pendingAgain = trees.select('simple-tree'); trees.dispose();
    const late = model(), lateDispose = vi.spyOn(late.material, 'dispose'); resolve(late.root); await pendingAgain;
    expect(lateDispose).toHaveBeenCalledOnce();
    const failure = createTreeRendering([original], placements, 0, { load: async () => { throw Error('missing'); }, onChange });
    await failure.select('quaternius'); expect(original.visible).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith({ count: 1, actual: 'original', status: 'error' }); failure.dispose();
  });
  it('keeps the previous tree visible while loading and commits only the newest request', async () => {
    const original = new THREE.Group(), first = model(), second = model(), stale = model();
    const pending = new Map<string, (tree: THREE.Group) => void>();
    const load = (url: string) => new Promise<THREE.Group>(resolve => { pending.set(url, resolve); });
    const trees = createTreeRendering([original], placements, 0, { load });
    const selectFirst = trees.select('simple-tree'); pending.get('/environments/trees/simple-tree/round.glb')!(first.root); await selectFirst;
    const selectStale = trees.select('quaternius'); expect(trees.root.children[0]).toHaveProperty('material', first.material);
    const staleDispose = vi.spyOn(stale.material, 'dispose');
    await trees.select('original');
    const selectSecond = trees.select('simple-tree'); pending.get('/environments/trees/simple-tree/round.glb')!(second.root); await selectSecond;
    pending.get('/environments/trees/quaternius/round.glb')!(stale.root); await selectStale;
    expect(trees.root.children[0]).toHaveProperty('material', second.material); expect(original.visible).toBe(false);
    expect(staleDispose).toHaveBeenCalledOnce(); trees.dispose();
  });
});
