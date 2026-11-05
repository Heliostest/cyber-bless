import { environmentProfiles } from './environment-profiles';
import { getSceneTreeRecommendation } from './tree-profiles';

/** Render inventory, not cultural provenance. Includes elements revealed during interaction.
 * Evidence and exclusions: docs/research/2026-11-05-scene-visual-features.md.
 * Keep this entry point free of Three.js, DOM and asset loaders: lists need no renderer.
 */
export type SceneVisualFeature = 'day' | 'night' | 'lighting' | 'warm-light' | 'point-light'
  | 'water' | 'liquid' | 'transparent' | 'glass' | 'flame' | 'smoke'
  | 'broadleaf' | 'mixed-trees' | 'cherry' | 'cypress' | 'willow' | 'conifer'
  | 'toona' | 'acer' | 'maple' | 'bamboo' | 'bodhi' | 'wish-tree';

const water = new Set([
  'celtic-folk-spring', 'floating-lantern-loy-krathong', 'japanese-shishi-odoshi',
  'mochigase-nagashibina', 'slavic-wreath', 'theravada-water', 'udo-undama',
  'zeniarai-coin-washing', 'bai-indigo-cloth', 'clootie-well-rag', 'fgs-buddha-bathing',
  'thai-songkran-elders', 'tibetan-water-bowls', 'sri-lankan-bodhi-puja', 'hindu-coconut-offering',
]);
const liquid = new Set(['kagami-biraki-sake', 'turkish-ebru-paper', 'blang-tea', 'chinese-incense', 'czech-pilgrim-journal', 'rosh-hashanah-apple-honey']);
const glass = new Set(['furin-wind-chime', 'venetian-glass-bead', 'turkish-nazar-bead']);
const pointLight = new Set([
  'celtic-folk-spring', 'chinese-shadow-puppet', 'crane', 'diya-oil-lamp',
  'floating-lantern-loy-krathong', 'furin-wind-chime', 'lantern', 'scottish-first-footing',
  'slavic-wreath', 'tanzaku-tanabata', 'theravada-water', 'votive-candle-catholic', 'yeondeunghoe',
]);
const flame = new Set(['diya-oil-lamp', 'floating-lantern-loy-krathong', 'scottish-first-footing', 'slavic-wreath', 'votive-candle-catholic']);
const smoke = new Set(['chinese-incense', 'persian-esfand']);

export function getSceneVisualFeatures(id: string): SceneVisualFeature[] {
  if (!Object.hasOwn(environmentProfiles, id)) return [];
  const profile = environmentProfiles[id];
  const features: SceneVisualFeature[] = [];
  if (water.has(id)) features.push('water');
  if (liquid.has(id)) features.push('liquid');
  features.push(profile.night ? 'night' : 'day', 'lighting');
  if (profile.warmLight) features.push('warm-light');
  if (pointLight.has(id)) features.push('point-light');
  // Ignore invisible hit meshes, UI guides, shadows and halos. Smoke has its own badge.
  if (water.has(id) || glass.has(id) || (liquid.has(id) && id !== 'turkish-ebru-paper') || id === 'mexican-tortilla-press') features.push('transparent');
  if (glass.has(id)) features.push('glass');
  if (flame.has(id)) features.push('flame');
  if (smoke.has(id)) features.push('smoke');
  if (!profile.coastal) {
    const tree = getSceneTreeRecommendation(id);
    features.push(tree === 'original' ? (profile.night ? 'mixed-trees' : 'broadleaf') : tree);
  }
  if (id === 'tanzaku-tanabata' || id === 'japanese-kadomatsu') features.push('bamboo');
  if (id === 'sri-lankan-bodhi-puja') features.push('bodhi');
  if (id === 'lam-tsuen-wishing-tree') features.push('wish-tree');
  return features;
}
