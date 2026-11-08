import { afterEach, expect, it } from 'vitest';
import * as THREE from 'three';
import { createCozyEnvironment } from './cozy-environment';
import { installNativeAssetMap } from './asset-urls';

afterEach(() => installNativeAssetMap({}));

it('loads the current update HDR and tree models through the actual environment', async () => {
  installNativeAssetMap({
    'environments/kloppenheim-06-sky-1k.hdr': 'file:///updates/b/day.hdr',
    'environments/trees/simple-tree/cherry-round.glb': 'file:///updates/b/cherry-round.glb',
    'environments/trees/simple-tree/cherry-cluster.glb': 'file:///updates/b/cherry-cluster.glb',
  });
  const skyRequests: string[] = [], treeRequests: string[] = [];
  const world = createCozyEnvironment(new THREE.Scene(), {
    id: 'shinto-torii',
    async loadSky(url) { skyRequests.push(url); return new THREE.DataTexture(); },
    async loadTree(url) {
      treeRequests.push(url);
      const root = new THREE.Group();
      root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshStandardMaterial()));
      return root;
    },
  })!;
  try {
    await world.ready;
    expect(skyRequests).toEqual(['file:///updates/b/day.hdr']);
    expect(treeRequests.sort()).toEqual(['file:///updates/b/cherry-cluster.glb', 'file:///updates/b/cherry-round.glb']);
  } finally { world.dispose(); }
});

it('resolves the night panorama from the same installed map', async () => {
  installNativeAssetMap({ 'environments/kloppenheim-02-night-1k.hdr': 'file:///updates/b/night.hdr' });
  const requests: string[] = [];
  const world = createCozyEnvironment(new THREE.Scene(), {
    id: 'diya-oil-lamp', loadTree: async () => new THREE.Group(),
    async loadSky(url) { requests.push(url); return new THREE.DataTexture(); },
  })!;
  try {
    await world.ready;
    expect(requests).toEqual(['file:///updates/b/night.hdr']);
  } finally { world.dispose(); }
});
