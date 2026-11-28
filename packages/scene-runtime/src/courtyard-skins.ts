/**
 * Shared product landscape & architectural courtyard atmosphere themes for outdoor scenes.
 *
 * Provenance boundary (see docs/scene-provenance.md):
 * - These skins are shared visual environment styles (framing walls, eaves, paving,
 *   planters, and ambient garden accents), never claims that a ritual requires a specific
 *   architectural venue, shrine, temple, or historical monument.
 * - Scenes in open highlands/steppes, riverbanks/coasts, Northern/Eastern European,
 *   Korean, Southeast Asian, or product-original contexts stay on `'none'` so regional
 *   architecture is never force-bound across unrelated traditions.
 */
export type CourtyardSkinId =
  | 'none'
  | 'japanese-karesansui'
  | 'chinese-jiangnan'
  | 'warm-terracotta-arch';

const COURTYARD_SKIN_MAP: Readonly<Record<string, Exclude<CourtyardSkinId, 'none'>>> = {
  // East Asian Japanese timber-eave & karesansui bamboo-stone courtyard
  // (Excludes coastal `udo-undama` and riverside stream `mochigase-nagashibina`.)
  'shinto-torii': 'japanese-karesansui',
  'shrine-suzu-bell': 'japanese-karesansui',
  omikuji: 'japanese-karesansui',
  'tamagushi-offering': 'japanese-karesansui',
  'japanese-kadomatsu': 'japanese-karesansui',
  'nanakusa-gayu': 'japanese-karesansui',
  'uchide-wishing-mallet': 'japanese-karesansui',
  'shichigosan-chitose-ame': 'japanese-karesansui',
  'japanese-hamaya': 'japanese-karesansui',
  'japanese-kumade': 'japanese-karesansui',
  'setsubun-mamemaki': 'japanese-karesansui',
  'kagami-mochi-offering': 'japanese-karesansui',
  'sumiyoshi-godairiki': 'japanese-karesansui',
  'chinowa-kuguri': 'japanese-karesansui',
  'zeniarai-coin-washing': 'japanese-karesansui',
  'kitano-nadeushi': 'japanese-karesansui',
  'hiiragi-iwashi': 'japanese-karesansui',
  'kagami-biraki-sake': 'japanese-karesansui',
  'kameido-usokae': 'japanese-karesansui',
  'tanzaku-tanabata': 'japanese-karesansui',
  'japanese-koinobori': 'japanese-karesansui',
  'furin-wind-chime': 'japanese-karesansui',
  'ema-votive-plaque': 'japanese-karesansui',
  'omamori-cycle': 'japanese-karesansui',
  'daruma-eye-painting': 'japanese-karesansui',
  mizuhiki: 'japanese-karesansui',
  crane: 'japanese-karesansui',
  'japanese-daruma-otoshi': 'japanese-karesansui',
  'japanese-wagasa': 'japanese-karesansui',
  'japanese-shishi-odoshi': 'japanese-karesansui',
  'japanese-kendama': 'japanese-karesansui',

  // Chinese whitewashed-wall & dark-tile courtyard
  // (Excludes Tibetan/Mongolian highland/steppe, open-sky kite `weifang-paper-kite`,
  // mountain tea forest `blang-tea`, and product-original `hongsheng-red-string`.)
  'chinese-incense': 'chinese-jiangnan',
  'chinese-longevity-lock': 'chinese-jiangnan',
  'chinese-fu-paper': 'chinese-jiangnan',
  'chinese-ruyi-scepter': 'chinese-jiangnan',
  'fgs-buddha-bathing': 'chinese-jiangnan',
  'lam-tsuen-wishing-tree': 'chinese-jiangnan',
  'yusheng-lohei': 'chinese-jiangnan',
  woodfish: 'chinese-jiangnan',
  'chinese-shadow-puppet': 'chinese-jiangnan',
  'chinese-woodblock-print': 'chinese-jiangnan',
  'chinese-steelyard': 'chinese-jiangnan',
  'chinese-rattle-drum': 'chinese-jiangnan',
  'chinese-tangram': 'chinese-jiangnan',
  'chinese-diabolo': 'chinese-jiangnan',
  'chinese-suanpan': 'chinese-jiangnan',
  'bai-indigo-cloth': 'chinese-jiangnan',

  // Warm sunlit terracotta-arch & stucco courtyard
  // (Mediterranean, South Asian, West/Central Asian, North African, and Latin American warm-palette scenes.)
  'greek-vasilopita': 'warm-terracotta-arch',
  'greek-new-year-pomegranate': 'warm-terracotta-arch',
  'neapolitan-cornicello': 'warm-terracotta-arch',
  'spanish-twelve-grapes': 'warm-terracotta-arch',
  'italian-ex-voto': 'warm-terracotta-arch',
  'barcelos-clay-rooster': 'warm-terracotta-arch',
  'basque-sunflower': 'warm-terracotta-arch',
  'votive-candle-catholic': 'warm-terracotta-arch',
  'persian-esfand': 'warm-terracotta-arch',
  'turkish-nazar-bead': 'warm-terracotta-arch',
  'navruz-sumalak': 'warm-terracotta-arch',
  'mezuzah-doorpost': 'warm-terracotta-arch',
  'rosh-hashanah-apple-honey': 'warm-terracotta-arch',
  'diya-oil-lamp': 'warm-terracotta-arch',
  'hindu-coconut-offering': 'warm-terracotta-arch',
  'sri-lankan-bodhi-puja': 'warm-terracotta-arch',
  milagros: 'warm-terracotta-arch',
  'bonfim-ribbon': 'warm-terracotta-arch',
  'pucara-rooftop-bulls': 'warm-terracotta-arch',
  'alasita-miniature-house': 'warm-terracotta-arch',
  'andalusian-ceramic-tile': 'warm-terracotta-arch',
  'sicilian-painted-cart': 'warm-terracotta-arch',
  'catalan-festival-giant': 'warm-terracotta-arch',
  'venetian-glass-bead': 'warm-terracotta-arch',
  'spanish-castanets': 'warm-terracotta-arch',
  'valencian-folding-fan': 'warm-terracotta-arch',
  'amazigh-woven-rug': 'warm-terracotta-arch',
  'turkish-ebru-paper': 'warm-terracotta-arch',
  'uzbek-clay-bowl': 'warm-terracotta-arch',
  'indian-charkha': 'warm-terracotta-arch',
  'mexican-metate': 'warm-terracotta-arch',
  'mexican-molinillo': 'warm-terracotta-arch',
  'mexican-tortilla-press': 'warm-terracotta-arch',
  'purepecha-copper-bowl': 'warm-terracotta-arch',
  'peruvian-engraved-gourd': 'warm-terracotta-arch',
  'puerto-rican-guiro': 'warm-terracotta-arch',
};

/** Resolve the shared regional courtyard skin for a scene ID, defaulting to `'none'`. */
export function getCourtyardSkin(id: string): CourtyardSkinId {
  return Object.hasOwn(COURTYARD_SKIN_MAP, id) ? COURTYARD_SKIN_MAP[id]! : 'none';
}

/** Read-only map of all explicit regional courtyard skin assignments (for audits and tests). */
export const courtyardSkinAssignments: Readonly<Record<string, Exclude<CourtyardSkinId, 'none'>>> =
  COURTYARD_SKIN_MAP;
