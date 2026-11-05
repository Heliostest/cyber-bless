import type { TreeSpecies } from './tree-models';

/** Approved landscape art choices, not ritual plant claims or national defaults.
 * Exact place/season evidence and exclusions: docs/research/2026-11-05-regional-tree-evidence.md.
 * No country-prefix fallback: unknown, winter, plum-specific and open-land
 * settings retain the original scenery rather than inventing an association.
 */
const recommendations: Readonly<Record<string, TreeSpecies>> = {
  'japanese-wagasa': 'cherry',
  'ema-votive-plaque': 'cherry',
  'shrine-suzu-bell': 'cherry',
  'omikuji': 'cherry',
  'shinto-torii': 'cherry',
  'german-nutcracker': 'conifer',
  'chinese-diabolo': 'willow',
  'neapolitan-cornicello': 'cypress',
  'valencian-folding-fan': 'cypress',
};
export function getSceneTreeRecommendation(id: string): TreeSpecies { return recommendations[id] ?? 'original'; }
