import { describe, expect, it } from 'vitest';
import { builtInScenes } from '@wbr/core/daily-scenes';
import { getSceneVisualFeatures } from './scene-visual-features';

describe('scene visual inventory', () => {
  it('covers each bundled scene without inventing features for unknown scenes', () => {
    for (const scene of builtInScenes) {
      const features = getSceneVisualFeatures(scene.id);
      expect(features, scene.id).toContain('lighting');
      expect(features.filter(id => id === 'day' || id === 'night'), scene.id).toHaveLength(1);
      expect(new Set(features).size).toBe(features.length);
    }
    expect(getSceneVisualFeatures('future-scene')).toEqual([]);
    expect(getSceneVisualFeatures('__proto__')).toEqual([]);
  });

  it('distinguishes actual water from other liquids and painted symbols', () => {
    expect(getSceneVisualFeatures('sri-lankan-bodhi-puja')).toEqual(expect.arrayContaining(['water', 'transparent', 'bodhi']));
    expect(getSceneVisualFeatures('udo-undama')).toContain('water');
    expect(getSceneVisualFeatures('udo-undama')).not.toContain('broadleaf');
    for (const id of ['kagami-biraki-sake', 'turkish-ebru-paper', 'blang-tea', 'rosh-hashanah-apple-honey']) {
      expect(getSceneVisualFeatures(id)).toContain('liquid');
      expect(getSceneVisualFeatures(id)).not.toContain('water');
    }
    expect(getSceneVisualFeatures('czech-pilgrim-journal')).not.toContain('water');
  });

  it('uses the rendered default trees, rather than assigning species by country', () => {
    expect(getSceneVisualFeatures('ema-votive-plaque')).toContain('cherry');
    expect(getSceneVisualFeatures('neapolitan-cornicello')).toContain('cypress');
    expect(getSceneVisualFeatures('chinese-diabolo')).toContain('willow');
    expect(getSceneVisualFeatures('german-nutcracker')).toContain('conifer');
    expect(getSceneVisualFeatures('japanese-kendama')).toContain('broadleaf');
    expect(getSceneVisualFeatures('japanese-kendama')).not.toContain('cherry');
    expect(getSceneVisualFeatures('tanzaku-tanabata')).toContain('bamboo');
  });

  it('separates night, local lights, transparent objects and smoke from hidden hit targets', () => {
    expect(getSceneVisualFeatures('votive-candle-catholic')).toEqual(expect.arrayContaining(['night', 'point-light', 'flame']));
    expect(getSceneVisualFeatures('furin-wind-chime')).toEqual(expect.arrayContaining(['glass', 'transparent', 'day']));
    expect(getSceneVisualFeatures('persian-esfand')).toContain('smoke');
    expect(getSceneVisualFeatures('bokjori')).not.toContain('transparent');
    expect(getSceneVisualFeatures('czech-bead-star')).not.toContain('glass');
  });
});
