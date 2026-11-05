import { describe, expect, it } from 'vitest';
import { resolveTreeModelSet } from './tree-models';
import { getSceneTreeRecommendation } from './tree-profiles';

describe('landscape tree catalog', () => {
  it('loads dedicated source-generated specialty shapes and retains source comparisons', () => {
    expect(resolveTreeModelSet('cypress')?.round).toBe('simple-tree/cypress-round.glb');
    expect(resolveTreeModelSet('willow')?.cluster).toBe('simple-tree/willow-cluster.glb');
    expect(resolveTreeModelSet('conifer')?.round).toBe('simple-tree/pine-round.glb');
    expect(resolveTreeModelSet('cherry')?.round).toBe('simple-tree/cherry-round.glb');
    expect(resolveTreeModelSet('cherry')?.cluster).toBe('simple-tree/cherry-cluster.glb');
    for (const species of ['toona', 'acer', 'maple'] as const) {
      expect(resolveTreeModelSet(species)?.round).toBe(`simple-tree/${species}-round.glb`);
      expect(resolveTreeModelSet(species)?.cluster).toBe(`simple-tree/${species}-cluster.glb`);
    }
    expect(resolveTreeModelSet('quaternius')?.round).toBe('quaternius/round.glb');
    expect(resolveTreeModelSet('original')).toBeUndefined();
  });
  it('resolves optional scene recommendations and retains unverified or season-sensitive settings', () => {
    expect(getSceneTreeRecommendation('japanese-wagasa')).toBe('cherry');
    expect(getSceneTreeRecommendation('german-nutcracker')).toBe('conifer');
    expect(getSceneTreeRecommendation('chinese-diabolo')).toBe('willow');
    for (const id of ['japanese-kadomatsu', 'kagami-mochi-offering', 'kameido-usokae', 'kitano-nadeushi', 'mongolian-ovoo', 'unknown']) {
      expect(getSceneTreeRecommendation(id), id).toBe('original');
    }
    expect(resolveTreeModelSet('scene', 'cherry')?.round).toBe('simple-tree/cherry-round.glb');
    expect(resolveTreeModelSet('scene', 'original')).toBeUndefined();
  });
});
