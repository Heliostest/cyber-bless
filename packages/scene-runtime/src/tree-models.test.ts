import { describe, expect, it } from 'vitest';
import { resolveTreeModelSet } from './tree-models';
import { getSceneTreeDefault, getSceneTreeRecommendation } from './tree-profiles';
import nature from './nature-kit.data.json';

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
  it('replaces primitive night trees with varied art choices without inventing regional recommendations', () => {
    expect(nature).not.toHaveProperty('tree-round');
    expect(nature).not.toHaveProperty('tree-pine');
    const choices = {
      'brat-bride-cloth': 'acer', 'scottish-first-footing': 'conifer', 'chinese-shadow-puppet': 'toona',
      'diya-oil-lamp': 'acer', 'votive-candle-catholic': 'cypress', lantern: 'acer', yeondeunghoe: 'toona',
    } as const;
    for (const [id, choice] of Object.entries(choices)) {
      expect(getSceneTreeDefault(id), id).toBe(choice);
      expect(getSceneTreeRecommendation(id), id).toBe('original');
      expect(resolveTreeModelSet('scene', choice)).toBeDefined();
    }
    expect(getSceneTreeDefault('shinto-torii')).toBe('cherry');
    expect(getSceneTreeDefault('woodfish')).toBe('original');
    expect(getSceneTreeDefault('udo-undama')).toBe('original');
    expect(getSceneTreeDefault('unknown')).toBe('original');
  });
});
