import { describe, expect, it } from 'vitest';
import { isSceneVisibleInApp } from '@wbr/core/daily-scenes';
import { environmentProfiles } from './environment-profiles';
import { resolveTreeModelSet, TREE_RENDER_METHODS, TREE_SPECIES } from './tree-models';
import { DEFAULT_FALLBACK_TREE_SPECIES, getSceneTreeDefault, getSceneTreeRecommendation } from './tree-profiles';
import nature from './nature-kit.data.json';

describe('landscape tree catalog', () => {
  it('resolves all eight Simple Tree species plus optional debug comparisons, with KayKit retired', () => {
    expect(TREE_RENDER_METHODS).not.toContain('original');
    expect(TREE_SPECIES).toEqual(['oak', 'cherry', 'cypress', 'willow', 'conifer', 'toona', 'acer', 'maple']);
    expect(resolveTreeModelSet('oak')).toEqual({ round: 'simple-tree/round.glb', cluster: 'simple-tree/cluster.glb' });
    expect(resolveTreeModelSet('simple-tree')).toEqual({ round: 'simple-tree/round.glb', cluster: 'simple-tree/cluster.glb' });
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
    expect(resolveTreeModelSet('komorebi')?.round).toBe('komorebi/round.glb');
  });

  it('preserves the nine evidence-backed regional recommendations separately from general landscape art', () => {
    const evidence = {
      'japanese-wagasa': 'cherry',
      'ema-votive-plaque': 'cherry',
      'shrine-suzu-bell': 'cherry',
      omikuji: 'cherry',
      'shinto-torii': 'cherry',
      'german-nutcracker': 'conifer',
      'chinese-diabolo': 'willow',
      'neapolitan-cornicello': 'cypress',
      'valencian-folding-fan': 'cypress',
    } as const;
    for (const [id, species] of Object.entries(evidence)) {
      expect(getSceneTreeRecommendation(id), id).toBe(species);
      expect(getSceneTreeDefault(id), id).toBe(species);
    }
    for (const id of ['japanese-kadomatsu', 'kagami-mochi-offering', 'kameido-usokae', 'kitano-nadeushi', 'mongolian-ovoo', 'unknown']) {
      expect(getSceneTreeRecommendation(id), id).toBeUndefined();
    }
    expect(resolveTreeModelSet('scene', 'cherry').round).toBe('simple-tree/cherry-round.glb');
    expect(resolveTreeModelSet('scene', 'oak').round).toBe('simple-tree/round.glb');
  });

  it('preserves the seven night art assignments without inventing regional recommendations', () => {
    expect(nature).not.toHaveProperty('tree-round');
    expect(nature).not.toHaveProperty('tree-pine');
    const choices = {
      'brat-bride-cloth': 'acer', 'scottish-first-footing': 'conifer', 'chinese-shadow-puppet': 'toona',
      'diya-oil-lamp': 'acer', 'votive-candle-catholic': 'cypress', lantern: 'acer', yeondeunghoe: 'toona',
    } as const;
    for (const [id, choice] of Object.entries(choices)) {
      expect(getSceneTreeDefault(id), id).toBe(choice);
      expect(getSceneTreeRecommendation(id), id).toBeUndefined();
      expect(resolveTreeModelSet('scene', choice).round).toMatch(/^simple-tree\//);
    }
  });

  it('assigns every non-coastal scene to one of the eight Simple Tree species and uses all eight across App-visible scenes', () => {
    const valid = new Set<string>(TREE_SPECIES);
    const visibleSpecies = new Set<string>();
    const allSpecies = new Set<string>();
    const nonCoastal = Object.entries(environmentProfiles).filter(([, profile]) => !profile.coastal);
    expect(nonCoastal.length).toBe(157);
    for (const [id] of nonCoastal) {
      const species = getSceneTreeDefault(id);
      expect(valid.has(species), `${id} -> ${species}`).toBe(true);
      const modelSet = resolveTreeModelSet('scene', species);
      expect(modelSet.round, id).toMatch(/^simple-tree\//);
      expect(modelSet.cluster, id).toMatch(/^simple-tree\//);
      allSpecies.add(species);
      if (isSceneVisibleInApp({ id })) visibleSpecies.add(species);
    }
    expect(allSpecies.size).toBe(8);
    expect(visibleSpecies.size).toBe(8);
    // Excluded winter/plum/summer scenes never receive spring cherry or fir-as-pine.
    for (const id of ['kitano-nadeushi', 'kameido-usokae', 'japanese-kadomatsu', 'kagami-mochi-offering', 'furin-wind-chime', 'chinowa-kuguri', 'tanzaku-tanabata']) {
      expect(getSceneTreeDefault(id), id).not.toBe('cherry');
    }
    expect(getSceneTreeDefault('japanese-kadomatsu')).not.toBe('conifer');
    expect(getSceneTreeDefault('unknown')).toBe(DEFAULT_FALLBACK_TREE_SPECIES);
  });
});
