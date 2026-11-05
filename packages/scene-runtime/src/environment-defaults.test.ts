import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { createCozyEnvironment } from './cozy-environment';
import { createDebugTrees } from './debug-trees';
import { createDebugEnvironmentTone } from './debug-environment-tone';

it('uses warm village lighting immediately without developer tools and restores it for capture', async () => {
  const scene = new THREE.Scene(), world = createCozyEnvironment(scene, { id: 'woodfish', loadSky: async () => new THREE.DataTexture() })!;
  await world.ready;
  const approved = scene.background;
  world.setTone('tiny-delivery'); expect(scene.background).toBe(approved);
  world.setTone('original'); expect(scene.background).not.toBe(approved);
  const restore = world.captureDefaultTone(); expect(scene.background).toBe(approved);
  restore?.(); expect(scene.background).not.toBe(approved); world.dispose();
});
it('restores production defaults rather than legacy settings when the last console owner exits', () => {
  const trees = createDebugTrees(), tones = createDebugEnvironmentTone(), scope = {}, tree = vi.fn(), tone = vi.fn();
  const a = trees.register('tea', '茶', tree, scope), b = tones.register('tea', '茶', tone, scope);
  expect(tree).toHaveBeenLastCalledWith('scene'); expect(tone).toHaveBeenLastCalledWith('tiny-delivery');
  const releaseTree = trees.enable(scope), releaseTone = tones.enable(scope);
  trees.select('tea', 'original', scope); tones.select('original', scope);
  expect(tree).toHaveBeenLastCalledWith('original'); expect(tone).toHaveBeenLastCalledWith('original');
  releaseTree(); releaseTone();
  expect(tree).toHaveBeenLastCalledWith('scene'); expect(tone).toHaveBeenLastCalledWith('tiny-delivery');
  a.dispose(); b.dispose();
});
