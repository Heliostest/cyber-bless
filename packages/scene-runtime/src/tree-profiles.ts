import type { TreeSpecies } from './tree-models';

/** Neutral broadleaf Simple Tree fallback when a scene has no strong landscape species match. */
export const DEFAULT_FALLBACK_TREE_SPECIES: TreeSpecies = 'oak';

/** Evidence-backed regional landscape art choices, not ritual plant claims or national defaults.
 * Exact place/season evidence and exclusions: docs/research/2026-11-05-regional-tree-evidence.md.
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
export function getSceneTreeRecommendation(id: string): TreeSpecies | undefined { return recommendations[id]; }

/** Product landscape compositions replacing the retired primitive night trees.
 * These choices describe silhouette and foliage only, with no regional or ritual claim.
 * Existing evidence-backed recommendations above remain separate and unchanged.
 */
const nightArt: Readonly<Record<string, TreeSpecies>> = {
  'brat-bride-cloth': 'acer',
  'scottish-first-footing': 'conifer',
  'chinese-shadow-puppet': 'toona',
  'diya-oil-lamp': 'acer',
  'votive-candle-catholic': 'cypress',
  lantern: 'acer',
  yeondeunghoe: 'toona',
};

/** Product landscape art assignments replacing the retired KayKit broadleaf shapes across
 * non-coastal daylight scenes. These choices reflect visual landscape atmosphere and
 * seasonal silhouette compatibility only — never ritual requirements, botanical claims,
 * or national defaults. Scenes not listed here resolve to neutral broadleaf `oak`.
 */
const landscapeArt: Readonly<Record<string, TreeSpecies>> = {
  // Spring / general Japanese shrine & vernal contexts (excluding winter, plum-specific, summer, autumn).
  'tamagushi-offering': 'cherry',
  'mochigase-nagashibina': 'cherry',
  'mizuhiki': 'cherry',
  'sumiyoshi-godairiki': 'cherry',
  'uchide-wishing-mallet': 'cherry',

  // Spreading green maple (`acer`): Japanese summer, plum-shrine/general gardens, verandas, and Korean folk scenes.
  'furin-wind-chime': 'acer',
  'chinowa-kuguri': 'acer',
  'tanzaku-tanabata': 'acer',
  'japanese-koinobori': 'acer',
  'kitano-nadeushi': 'acer',
  'kameido-usokae': 'acer',
  'zeniarai-coin-washing': 'acer',
  'omamori-cycle': 'acer',
  'crane': 'acer',
  'japanese-shishi-odoshi': 'acer',
  'korean-bojagi-wrap': 'acer',
  'bokjori': 'acer',
  'korean-yutnori': 'acer',

  // Autumn rust-red maple (`maple`): late-autumn festivals, autumn harvest, and warm temperate woodcraft.
  'shichigosan-chitose-ame': 'maple',
  'japanese-kumade': 'maple',
  'daruma-eye-painting': 'maple',
  'rosh-hashanah-apple-honey': 'maple',
  'ukrainian-didukh': 'maple',
  'korean-sotdae': 'maple',
  'chinese-ruyi-scepter': 'maple',
  'welsh-love-spoon': 'maple',
  'hungarian-embroidery-hoop': 'maple',
  'czech-pilgrim-journal': 'maple',
  'german-jumping-jack': 'maple',
  'french-coffee-mill': 'maple',
  'english-hearth-bellows': 'maple',
  'purepecha-copper-bowl': 'maple',

  // Compound-leaf summer green (`toona`): Chinese, Mainland SE Asian, South Asian, and warm subtropical courtyards.
  'chinese-longevity-lock': 'toona',
  'chinese-fu-paper': 'toona',
  'chinese-incense': 'toona',
  'woodfish': 'toona',
  'lam-tsuen-wishing-tree': 'toona',
  'vietnamese-five-fruit-tray': 'toona',
  'yusheng-lohei': 'toona',
  'lao-baci-wrist': 'toona',
  'thai-songkran-elders': 'toona',
  'lanna-sand-pagoda': 'toona',
  'phuang-malai': 'toona',
  'fgs-buddha-bathing': 'toona',
  'balinese-canang-sari': 'toona',
  'hindu-coconut-offering': 'toona',
  'sri-lankan-bodhi-puja': 'toona',
  'chinese-tangram': 'toona',
  'chinese-steelyard': 'toona',
  'chinese-rattle-drum': 'toona',
  'chinese-suanpan': 'toona',
  'chinese-woodblock-print': 'toona',
  'bai-indigo-cloth': 'toona',
  'blang-tea': 'toona',
  'vietnamese-bamboo-dragonfly': 'toona',
  'indonesian-angklung': 'toona',
  'indian-charkha': 'toona',

  // Weeping willow (`willow`): riverbanks, water/spring motifs, oasis gardens, and spring-branch traditions.
  'slavic-wreath': 'willow',
  'floating-lantern-loy-krathong': 'willow',
  'finnish-virpominen': 'willow',
  'romanian-martisor': 'willow',
  'bulgarian-survakane': 'willow',
  'navruz-sumalak': 'willow',
  'st-brigids-cross': 'willow',
  'uzbek-clay-bowl': 'willow',
  'weifang-paper-kite': 'willow',
  'hongsheng-red-string': 'willow',
  'celtic-folk-spring': 'willow',
  'theravada-water': 'willow',

  // Columnar cypress (`cypress`): Mediterranean, Anatolian, Levantine, Iranian, North African, and Iberian/Latin courtyards.
  'italian-ex-voto': 'cypress',
  'greek-vasilopita': 'cypress',
  'greek-new-year-pomegranate': 'cypress',
  'spanish-twelve-grapes': 'cypress',
  'turkish-nazar-bead': 'cypress',
  'mezuzah-doorpost': 'cypress',
  'persian-esfand': 'cypress',
  'milagros': 'cypress',
  'venetian-glass-bead': 'cypress',
  'sicilian-painted-cart': 'cypress',
  'andalusian-ceramic-tile': 'cypress',
  'catalan-festival-giant': 'cypress',
  'spanish-castanets': 'cypress',
  'french-petanque': 'cypress',
  'turkish-ebru-paper': 'cypress',
  'amazigh-woven-rug': 'cypress',

  // Tiered evergreen conifer (`conifer`): Alpine, Nordic, Baltic, Scottish Highland, Russian, and Tibetan/Himalayan highlands.
  // Never assigned as a stand-in for Japanese garden pine.
  'sternsinger-house-blessing': 'conifer',
  'polish-oplatek-sharing': 'conifer',
  'aland-votive-ship': 'conifer',
  'lithuanian-straw-garden': 'conifer',
  'clootie-well-rag': 'conifer',
  'tibetan-prayer-flags': 'conifer',
  'tibetan-water-bowls': 'conifer',
  'tibetan-khata-greeting': 'conifer',
  'tibetan-wheel': 'conifer',
  'dalarna-wooden-horse': 'conifer',
  'finnish-birch-basket': 'conifer',
  'finnish-kantele': 'conifer',
  'estonian-village-swing': 'conifer',
  'russian-matryoshka': 'conifer',
  'czech-bead-star': 'conifer',
};

export function getSceneTreeDefault(id: string): TreeSpecies {
  return recommendations[id] ?? nightArt[id] ?? landscapeArt[id] ?? DEFAULT_FALLBACK_TREE_SPECIES;
}
