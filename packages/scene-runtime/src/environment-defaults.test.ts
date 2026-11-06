import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { createCozyEnvironment } from './cozy-environment';
import { createDebugTrees } from './debug-trees';
import { createDebugEnvironmentTone } from './debug-environment-tone';
import { createDebugGrass } from './debug-grass';

it.each(['woodfish','shinto-torii','diya-oil-lamp','udo-undama'])('uses Komorebi grass and tone with the previous scene trees without a console: %s', async id => {
  const scene = new THREE.Scene(),report=vi.fn(), world = createCozyEnvironment(scene, { id, loadSky: async () => new THREE.DataTexture(),onTrees:report,loadTree:async()=>{
    const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial());mesh.position.y=1;root.add(mesh);return root;
  } })!;
  await world.ready;
  const approved = scene.background;
  world.setTone('komorebi'); expect(scene.background).toBe(approved);
  expect(world.captureDefaultTone()).toBeUndefined();expect(world.captureDefaultGrass()).toBeUndefined();expect(world.captureDefaultTrees()).toBeUndefined();
  if(world.hasGrass)expect(scene.getObjectByName('komorebi-meadow')?.visible).toBe(true);
  if(world.treeRecommendation !== 'original')expect(report).toHaveBeenLastCalledWith({count:world.treeCount,actual:'scene',status:'ready'});
  if(!world.treeCount)expect(scene.getObjectByName('komorebi-meadow')).toBeUndefined();
  world.setTone('original'); expect(scene.background).not.toBe(approved);
  const restore = world.captureDefaultTone(); expect(scene.background).toBe(approved);
  restore?.(); expect(scene.background).not.toBe(approved); world.dispose();
});
it('restores the same three production defaults when the last console owner exits', () => {
  const trees = createDebugTrees(), tones = createDebugEnvironmentTone(),grasses=createDebugGrass(), scope = {}, tree = vi.fn(), tone = vi.fn(),grass=vi.fn();
  const a = trees.register('tea', '茶', tree, scope), b = tones.register('tea', '茶', tone, scope);
  const c=grasses.register('tea','Tea',grass,scope);
  expect(tree).toHaveBeenLastCalledWith('scene'); expect(tone).toHaveBeenLastCalledWith('komorebi');expect(grass).toHaveBeenLastCalledWith('komorebi');
  const releaseTree = trees.enable(scope), releaseTone = tones.enable(scope),releaseGrass=grasses.enable(scope);
  trees.select('tea', 'komorebi', scope); tones.select('original', scope);
  grasses.select('original',scope);
  expect(tree).toHaveBeenLastCalledWith('komorebi'); expect(tone).toHaveBeenLastCalledWith('original');expect(grass).toHaveBeenLastCalledWith('original');
  releaseTree(); releaseTone();releaseGrass();
  expect(tree).toHaveBeenLastCalledWith('scene'); expect(tone).toHaveBeenLastCalledWith('komorebi');expect(grass).toHaveBeenLastCalledWith('komorebi');
  a.dispose(); b.dispose();c.dispose();
});
