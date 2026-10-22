import { describe, expect, it } from "vitest";
import {
  dailyCollectibleId,
  rituals,
  type Collectible,
  type RitualId,
} from "@wbr/core";
import type { CatalogEntry } from "@wbr/content/catalog";
import { assertSafeCopy } from "@wbr/shared";
import { isSceneVisibleInApp } from '@wbr/core/daily-scenes';
import { builtInScenes, supportsScene } from "./scene-library";
import { hasSceneIcon } from "./scene-icons";
import {
  BLESSING_SCENE_IDS,
  DAILY_COLLECTED_COPY,
  DAILY_SET_COPY,
  NIGHT_STAGE_SCENE_IDS,
  WISH_SCENE_IDS,
  dailyCollectedPicks,
  dailyPrimaryScene,
  isWishScene,
  ritualSceneEntry,
  sceneRitual,
  sceneStage,
  sceneSteps,
} from "./scene-placement";

const bundled = (id: string, title: string): CatalogEntry => ({
  id,
  title,
  engine: `${id}@1`,
  revision: "bundled",
  manifestUrl: "",
});

const entries: CatalogEntry[] = [
  {
    id: "woodfish",
    title: "敲一敲木鱼",
    engine: "woodfish@1",
    revision: "bundled",
    manifestUrl: "",
  },
  {
    id: "tanzaku-tanabata",
    title: "短册系竹",
    engine: "tanzaku-tanabata@1",
    revision: "bundled",
    manifestUrl: "",
  },
  {
    id: "yeondeunghoe",
    title: "燃灯上浮",
    engine: "yeondeunghoe@1",
    revision: "bundled",
    manifestUrl: "",
  },
  {
    id: "furin-wind-chime",
    title: "风铃一响",
    engine: "furin-wind-chime@1",
    revision: "bundled",
    manifestUrl: "",
  },
  bundled("shinto-torii", "庭前一礼"),
  bundled("tibetan-wheel", "廊前轻转"),
  bundled("celtic-folk-spring", "泉边一念"),
  bundled("theravada-water", "花水位一倾"),
  bundled("crane", "折一只纸鹤"),
  bundled("lantern", "月下一灯"),
  bundled("slavic-wreath", "火边花环"),
];

describe("scene placement", () => {
  it.each([
    ["malawi-sansi", "mbira-sansi-craft", false],
    ["japanese-kendama", "japanese-kendama-craft", false],
    ["japanese-koinobori", "japanese-koinobori", false],
    ["russian-matryoshka", "russian-matryoshka", false],
    ["korean-yutnori", "korean-yutnori", false],
    ["chinese-diabolo", "chinese-diabolo", false],
    ["chinese-tangram", "chinese-tangram", false],
    ["finnish-virpominen", "finnish-virpominen", false],
    ["hiiragi-iwashi", "hiiragi-iwashi", false],
    ["tamagushi-offering", "tamagushi-offering", false],
    ["tibetan-water-bowls", "tibetan-water-bowls", false],
    ["kagami-biraki-sake", "kagami-biraki-sake", false],
    ["tibetan-prayer-flags", "tibetan-prayer-flags", false],
    ["rosh-hashanah-apple-honey", "rosh-hashanah-apple-honey", false],
    ["thai-songkran-elders", "thai-songkran-elders", false],
    ["kameido-usokae", "kameido-usokae", false],
    ["persian-esfand", "persian-esfand", false],
    ["mochigase-nagashibina", "mochigase-nagashibina", false],
    ["greek-vasilopita", "greek-vasilopita", false],
    ["tibetan-khata-greeting", "tibetan-khata-greeting", false],
    ["shichigosan-chitose-ame", "shichigosan-chitose-ame", false],
    ["mongolian-ovoo", "mongolian-ovoo", false],
    ["fgs-buddha-bathing", "fgs-buddha-bathing", false],
    ["balinese-canang-sari", "balinese-canang-sari", false],
    ["bulgarian-survakane", "bulgarian-survakane", false],
    ["setsubun-mamemaki", "setsubun-mamemaki", false],
    ["sternsinger-house-blessing", "sternsinger-house-blessing", false],
    ["lam-tsuen-wishing-tree", "lam-tsuen-wishing-tree", true],
    ["kagami-mochi-offering", "kagami-mochi-offering", false],
    ["romanian-martisor", "romanian-martisor", false],
    ["sumiyoshi-godairiki", "sumiyoshi-godairiki", true],
    ["polish-oplatek-sharing", "polish-oplatek-sharing", false],
    ["greek-new-year-pomegranate", "greek-new-year-pomegranate", false],
    ["bonfim-ribbon", "bonfim-ribbon", false],
    ["chinowa-kuguri", "chinowa-kuguri", false],
    ["zeniarai-coin-washing", "zeniarai-coin-washing", true],
    ["udo-undama", "udo-undama", true],
    ["japanese-daruma-otoshi", "japanese-daruma-otoshi", false],
    ["paper-pinwheel", "paper-pinwheel", false],
    ["chinese-steelyard", "chinese-steelyard", false],
    ["garden-croquet", "garden-croquet", false],
    ["welsh-drop-spindle", "welsh-drop-spindle", false],
    ["scottish-plunge-churn", "scottish-plunge-churn", false],
    ["irish-bodhran", "irish-bodhran", false],
    ["french-coffee-mill", "french-coffee-mill", false],
    ["japanese-wagasa", "japanese-wagasa", false],
    ["spanish-castanets", "spanish-castanets", false],
    ["japanese-shishi-odoshi", "japanese-shishi-odoshi", false],
    ["german-jumping-jack", "german-jumping-jack", false],
    ["finnish-kantele", "finnish-kantele", false],
    ["estonian-village-swing", "estonian-village-swing", false],
    ["french-petanque", "french-petanque", false],
    ["english-hearth-bellows", "english-hearth-bellows", false],
    ["mexican-metate", "mexican-metate", false],
    ["czech-wooden-ratchet", "czech-wooden-ratchet", false],
    ["puerto-rican-guiro", "puerto-rican-guiro", false],
    ["valencian-folding-fan", "valencian-folding-fan", false],
    ["mexican-tortilla-press", "mexican-tortilla-press", false],
    ["ghanaian-oware", "ghanaian-oware", false],
    ["chinese-rattle-drum", "chinese-rattle-drum", false],
    ["indian-charkha", "indian-charkha-craft", false],
    ["german-nutcracker", "erzgebirge-nutcracker-craft", false],
    ["mexican-molinillo", "molinillo-chocolate-craft", false],
    ["chinese-suanpan", "chinese-zhusuan", false],
    ["mongolian-felt-ger", "mongolian-ger-craft", false],
    ["peruvian-engraved-gourd", "peruvian-mate-burilado", true], ["venetian-glass-bead", "italian-glass-beads", false],
    ["korean-bojagi-wrap", "korean-bojagi", true], ["vietnamese-bamboo-dragonfly", "thach-xa-bamboo-dragonfly", false],
    ["turkish-ebru-paper", "turkish-ebru", true], ["indonesian-angklung", "indonesian-angklung", false],
    ["weifang-paper-kite", "weifang-kite-craft", false], ["chinese-shadow-puppet", "chinese-shadow-puppet", true],
    ["faroese-wool-knit", "faroese-wool-knitting", false], ["niue-shell-necklace", "niue-kahoa-hihi", true],
    ["polish-paper-cut", "polish-wycinanki", true], ["uzbek-clay-bowl", "uzbek-ceramic-craft", false],
    ["chinese-woodblock-print", "chinese-woodblock-print", true], ["czech-bead-star", "czech-glass-bead-ornaments", false],
    ["fijian-woven-fan", "fijian-iri-fan", false], ["amazigh-woven-rug", "moroccan-amazigh-textiles", true],
    ["slovak-wire-bird", "slovak-wire-craft", false], ["hungarian-embroidery-hoop", "hungarian-embroidery", true],
    ["andalusian-ceramic-tile", "andalusian-ceramic-tile", true], ["sicilian-painted-cart", "sicilian-carretto-craft", false],
    ["bai-indigo-cloth", "bai-tie-dye", true], ["ndebele-painted-house", "ndebele-wall-painting", false],
    ["purepecha-copper-bowl", "santa-clara-copper-craft", false], ["welsh-love-spoon", "welsh-love-spoons", true],
    ["barcelos-clay-rooster", "barcelos-clay-rooster", true], ["finnish-birch-basket", "finnish-birch-bark-craft", false],
    ["croatian-licitar-heart", "croatian-licitar", true], ["catalan-festival-giant", "catalan-gegants", false],
    ["sorbian-painted-egg", "sorbian-easter-eggs", true], ["basque-sunflower", "basque-eguzkilore", true],
    ["breton-banner", "breton-pardons", false], ["lithuanian-straw-garden", "lithuanian-straw-gardens", false],
    ["dalarna-wooden-horse", "dalarna-wooden-horse", false], ["aland-votive-ship", "aland-votive-ship", true],
    ["blang-tea", "jingmai-tea-forest", false], ["minangkabau-spinning-top", undefined, true],
    ["chinese-incense", "chinese-incense", false], ["hongsheng-red-string", undefined, true],
    ["italian-ex-voto", "italian-ex-voto", true], ["czech-pilgrim-journal", undefined, false],
    ["omikuji", "omikuji", false], ["polish-blessing-basket", "polish-folk-catholic", true],
    ["navruz-sumalak", "uzbek-sumalak-cooking", false], ["floating-lantern-loy-krathong", "floating-lantern-loy-krathong", true],
  ] as const)("places %s in the enlarged native-safe catalog", (id, slug, wish) => {
    const entry = builtInScenes.find(e => e.id === id)!;
    expect(entry).toBeDefined(); expect(supportsScene(entry.engine)).toBe(true);
    expect(hasSceneIcon(id)).toBe(true); expect(entry.traditionSlug).toBe(slug);
    expect(isWishScene(id)).toBe(wish); expect(sceneSteps(entry)).toBe(3);
  });
  it.each([
    ["omamori-cycle", true, false], ["shrine-suzu-bell", false, false],
    ["st-brigids-cross", false, false], ["bokjori", false, false],
    ["ema-votive-plaque", true, false], ["clootie-well-rag", false, false],
    ["diya-oil-lamp", false, true], ["votive-candle-catholic", true, true],
  ] as const)("places %s with its own object icon, pool and stage", (id, wish, night) => {
    const entry = builtInScenes.find(e => e.id === id)!;
    expect(entry).toBeDefined(); expect(supportsScene(entry.engine)).toBe(true);
    expect(hasSceneIcon(id)).toBe(true); expect(entry.traditionSlug).toBe(id);
    expect(isWishScene(id)).toBe(wish); expect(sceneStage(id)).toBe(night ? "night" : "day");
  });
  it.each(["daruma-eye-painting", "mizuhiki", "milagros", "phuang-malai"])("makes %s a playable wish keepsake with a distinct icon", id => {
    const entry = builtInScenes.find(entry => entry.id === id)!;
    expect(entry).toBeDefined();
    expect(supportsScene(entry.engine)).toBe(true);
    expect(isWishScene(id)).toBe(true);
    expect(sceneSteps(entry)).toBe(3);
    expect(hasSceneIcon(id)).toBe(true);
    expect(entry.traditionSlug).toBe(id);
  });
  it("splits blessing vs wish scene ids", () => {
    expect([...BLESSING_SCENE_IDS]).toEqual([
      "finnish-virpominen",
      "hiiragi-iwashi",
      "tamagushi-offering",
      "tibetan-water-bowls",
      "kagami-biraki-sake",
      "tibetan-prayer-flags",
      "rosh-hashanah-apple-honey",
      "thai-songkran-elders",
      "kameido-usokae",
      "persian-esfand",
      "mochigase-nagashibina",
      "greek-vasilopita",
      "tibetan-khata-greeting",
      "shichigosan-chitose-ame",
      "mongolian-ovoo",
      "fgs-buddha-bathing",
      "balinese-canang-sari",
      "bulgarian-survakane",
      "setsubun-mamemaki",
      "sternsinger-house-blessing",
      "kagami-mochi-offering",
      "romanian-martisor",
      "polish-oplatek-sharing",
      "greek-new-year-pomegranate",
      "bonfim-ribbon",
      "chinowa-kuguri",
      "woodfish",
      "furin-wind-chime",
      "shinto-torii",
      "tibetan-wheel",
      "celtic-folk-spring",
      "theravada-water",
      "clootie-well-rag", "diya-oil-lamp",
      "shrine-suzu-bell", "st-brigids-cross", "bokjori",
      "omikuji", "navruz-sumalak",
      "chinese-incense", "czech-pilgrim-journal",
      "dalarna-wooden-horse", "blang-tea",
      "breton-banner", "lithuanian-straw-garden",
      "finnish-birch-basket", "catalan-festival-giant",
      "ndebele-painted-house", "purepecha-copper-bowl",
      "slovak-wire-bird", "sicilian-painted-cart",
      "fijian-woven-fan",
      "czech-bead-star", "uzbek-clay-bowl",
      "faroese-wool-knit",
      "weifang-paper-kite",
      "indonesian-angklung",
      "vietnamese-bamboo-dragonfly",
      "venetian-glass-bead",
      "malawi-sansi",
      "japanese-kendama",
      "japanese-koinobori",
      "russian-matryoshka",
      "korean-yutnori",
      "chinese-diabolo",
      "chinese-tangram",
      "japanese-daruma-otoshi",
      "paper-pinwheel",
      "chinese-steelyard",
      "garden-croquet",
      "welsh-drop-spindle",
      "scottish-plunge-churn",
      "irish-bodhran",
      "french-coffee-mill",
      "japanese-wagasa",
      "spanish-castanets",
      "japanese-shishi-odoshi",
      "german-jumping-jack",
      "finnish-kantele",
      "estonian-village-swing",
      "french-petanque",
      "english-hearth-bellows",
      "mexican-metate",
      "czech-wooden-ratchet",
      "puerto-rican-guiro",
      "valencian-folding-fan",
      "mexican-tortilla-press",
      "ghanaian-oware",
      "chinese-rattle-drum",
      "indian-charkha",
      "german-nutcracker",
      "mexican-molinillo",
      "chinese-suanpan",
      "mongolian-felt-ger",
    ]);
    expect([...WISH_SCENE_IDS]).toEqual([
      "lam-tsuen-wishing-tree",
      "sumiyoshi-godairiki",
      "zeniarai-coin-washing",
      "udo-undama",
      "tanzaku-tanabata",
      "yeondeunghoe",
      "crane",
      "lantern",
      "slavic-wreath",
      "daruma-eye-painting", "mizuhiki", "milagros", "phuang-malai",
      "ema-votive-plaque", "votive-candle-catholic",
      "omamori-cycle",
      "polish-blessing-basket", "floating-lantern-loy-krathong",
      "hongsheng-red-string", "italian-ex-voto",
      "aland-votive-ship", "minangkabau-spinning-top",
      "sorbian-painted-egg", "basque-sunflower",
      "barcelos-clay-rooster", "croatian-licitar-heart",
      "bai-indigo-cloth", "welsh-love-spoon",
      "hungarian-embroidery-hoop", "andalusian-ceramic-tile",
      "amazigh-woven-rug",
      "chinese-woodblock-print", "polish-paper-cut",
      "niue-shell-necklace",
      "chinese-shadow-puppet",
      "turkish-ebru-paper",
      "korean-bojagi-wrap",
      "peruvian-engraved-gourd",
    ]);
    expect(isWishScene("tanzaku-tanabata")).toBe(true);
    expect(isWishScene("slavic-wreath")).toBe(true);
    expect(isWishScene("furin-wind-chime")).toBe(false);
  });

  it("places every placed scene on exactly one surface, and all are bundled", () => {
    for (const id of BLESSING_SCENE_IDS) expect(isWishScene(id)).toBe(false);
    const bundledIds = builtInScenes.map((e) => e.id);
    for (const id of [...BLESSING_SCENE_IDS, ...WISH_SCENE_IDS]) {
      expect(bundledIds).toContain(id);
    }
  });

  it("opens every core ritual as the bundled scene of the same id", () => {
    for (const ritual of Object.keys(rituals) as RitualId[]) {
      const entry = ritualSceneEntry(builtInScenes, ritual)!;
      expect(entry.id, ritual).toBe(ritual);
      expect(supportsScene(entry.engine), ritual).toBe(true);
      expect(sceneRitual(entry.id)).toBe(ritual);
    }
    expect(ritualSceneEntry([], "crane")).toBeUndefined();
    for (const id of ["tanzaku-tanabata", "toString", ""])
      expect(sceneRitual(id), id).toBeUndefined();
    expect(sceneSteps(ritualSceneEntry(builtInScenes, "woodfish")!)).toBe(12);
    expect(sceneSteps(ritualSceneEntry(builtInScenes, "crane")!)).toBe(3);
    expect(sceneSteps(ritualSceneEntry(builtInScenes, "lantern")!)).toBe(3);
  });

  it("shows the light scenes on the night stage, every other scene by day", () => {
    expect([...NIGHT_STAGE_SCENE_IDS]).toEqual(["lantern", "yeondeunghoe", "diya-oil-lamp", "votive-candle-catholic", "chinese-shadow-puppet"]);
    for (const id of NIGHT_STAGE_SCENE_IDS) expect(sceneStage(id)).toBe("night");
    for (const id of [
      ...BLESSING_SCENE_IDS.filter(id => sceneStage(id) !== 'night'),
      "crane",
      "tanzaku-tanabata",
      "slavic-wreath",
    ])
      expect(sceneStage(id), id).toBe("day");
  });

  it("gives every placed scene a drawn icon, keyed by its id", () => {
    for (const id of [...BLESSING_SCENE_IDS, ...WISH_SCENE_IDS])
      expect(hasSceneIcon(id), id).toBe(true);
    expect(hasSceneIcon("no-such-scene")).toBe(false);
  });
});

const days = Array.from(
  { length: 28 },
  (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`,
);
const ids = (list: CatalogEntry[]) => list.map((e) => e.id);
const placed: string[] = [...BLESSING_SCENE_IDS, ...WISH_SCENE_IDS];

/** The keepsake a daily walk of `sceneId` left on `day`. */
const keepsake = (sceneId: string, day = "2026-09-30"): Collectible => ({
  id: dailyCollectibleId(day, sceneId),
  kind: "scene",
  title: entries.find((e) => e.id === sceneId)?.title ?? sceneId,
  at: `${day}T08:00:00.000Z`,
  sceneId,
  ...(isWishScene(sceneId) ? { wishScene: true } : {}),
});

describe("今日's main walk", () => {
  it("is one placed scene a day, the same all day", () => {
    for (const day of days) {
      const primary = dailyPrimaryScene(entries, day)!;
      expect(placed, day).toContain(primary.id);
      expect(dailyPrimaryScene(entries, day)).toBe(primary);
    }
  });

  it("changes across days, the types mostly taking turns", () => {
    const seen = days.map((day) => dailyPrimaryScene(entries, day)!.id);
    expect(new Set(seen).size).toBeGreaterThan(5);
    const turns = seen
      .slice(1)
      .filter((id, i) => isWishScene(id) !== isWishScene(seen[i])).length;
    expect(turns).toBeGreaterThan(seen.length / 2);
  });

  it("includes each craft scene across the yearly daily rotation", () => {
    const seen = new Set(Array.from({ length: 365 }, (_, i) => {
      const day = new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10);
      return dailyPrimaryScene(builtInScenes, day)?.id;
    }));
    for (const { id } of builtInScenes.filter(isSceneVisibleInApp))
      expect(seen).toContain(id);
  });

  it("skips scenes the catalog cannot open, without failing the day", () => {
    const partial = entries.filter((e) => e.id !== "woodfish");
    for (const day of days)
      expect(dailyPrimaryScene(partial, day)!.id).not.toBe("woodfish");
    expect(dailyPrimaryScene([entries[1]], "2026-10-01")!.id).toBe(
      "tanzaku-tanabata",
    );
    expect(dailyPrimaryScene([], "2026-10-01")).toBeUndefined();
  });
});

describe("今日's picks from 小天地", () => {
  const all = placed.map((id) => keepsake(id));

  it('keeps hidden scenes out of recommendations without deleting their old keepsakes', () => {
    const kept = [keepsake('chinese-suanpan'), keepsake('woodfish')];
    expect(ids(dailyCollectedPicks(builtInScenes, kept, '2026-10-19'))).toEqual(['woodfish']);
    expect(kept).toHaveLength(2);
  });

  it("offers three kept scenes a day: exactly one 许愿, two 祈福", () => {
    for (const day of days) {
      const picks = dailyCollectedPicks(entries, all, day);
      expect(picks, day).toHaveLength(3);
      expect(picks.filter((e) => isWishScene(e.id)), day).toHaveLength(1);
      expect(new Set(ids(picks)).size).toBe(3);
    }
  });

  it("stays put all day, in any save order, and changes across days", () => {
    const day = "2026-10-11";
    const picks = ids(dailyCollectedPicks(entries, all, day));
    expect(ids(dailyCollectedPicks(entries, [...all].reverse(), day))).toEqual(
      picks,
    );
    // Collecting the day's walk leaves the picks as they were.
    const walked = [...all, keepsake(dailyPrimaryScene(entries, day)!.id, day)];
    expect(ids(dailyCollectedPicks(entries, walked, day))).toEqual(picks);
    const seen = new Set(
      days.flatMap((d) => ids(dailyCollectedPicks(entries, all, d))),
    );
    expect(seen.size).toBeGreaterThan(3);
  });

  it("leaves a keepsake collected today for tomorrow", () => {
    const today = [keepsake("crane", "2026-10-11"), keepsake("woodfish", "2026-10-11")];
    expect(dailyCollectedPicks(entries, today, "2026-10-11")).toEqual([]);
    expect(ids(dailyCollectedPicks(entries, today, "2026-10-12"))).toEqual([
      "woodfish",
      "crane",
    ]);
  });

  it("shows fewer cards for a short pool, never a second 许愿 or a made-up one", () => {
    for (const day of days) {
      expect(dailyCollectedPicks(entries, [], day)).toEqual([]);
      // Only 许愿 kept: the one 许愿 card.
      const wishes = dailyCollectedPicks(
        entries,
        WISH_SCENE_IDS.map((id) => keepsake(id)),
        day,
      );
      expect(wishes).toHaveLength(1);
      expect(isWishScene(wishes[0].id)).toBe(true);
      // One 祈福 kept beside the 许愿: two cards.
      const short = dailyCollectedPicks(
        entries,
        [keepsake("crane"), keepsake("lantern"), keepsake("woodfish")],
        day,
      );
      expect(short).toHaveLength(2);
      expect(short[0].id).toBe("woodfish");
      expect(["crane", "lantern"]).toContain(short[1].id);
      // No 许愿 kept yet: up to three 祈福.
      const blessings = dailyCollectedPicks(
        entries,
        BLESSING_SCENE_IDS.map((id) => keepsake(id)),
        day,
      );
      expect(blessings).toHaveLength(3);
      expect(blessings.some((e) => isWishScene(e.id))).toBe(false);
      expect(
        dailyCollectedPicks(entries, [keepsake("woodfish"), keepsake("shinto-torii")], day),
      ).toHaveLength(2);
    }
  });

  it("gives a scene kept on several days one card", () => {
    const repeats = ["2026-09-28", "2026-09-29", "2026-09-30"].flatMap((d) => [
      keepsake("woodfish", d),
      keepsake("crane", d),
    ]);
    for (const day of days)
      expect(ids(dailyCollectedPicks(entries, repeats, day))).toEqual([
        "woodfish",
        "crane",
      ]);
  });

  it("picks only scene keepsakes the catalog can open, spent ones too", () => {
    const mixed: Collectible[] = [
      { ...keepsake("crane"), spentAt: "2026-10-01T08:00:00.000Z" },
      { ...keepsake("lantern"), id: "lost", sceneId: "no-such-scene" },
      { id: "b1", kind: "badge", title: "还愿纪念", at: "2026-10-01T08:00:00.000Z" },
      { id: "c1", kind: "crane", title: "纸鹤", at: "2026-10-01T08:00:00.000Z" },
    ];
    expect(ids(dailyCollectedPicks(entries, mixed, "2026-10-11"))).toEqual([
      "crane",
    ]);
    expect(dailyCollectedPicks([], all, "2026-10-11")).toEqual([]);
  });
});

describe("今日's copy", () => {
  it("keeps it safe", () => {
    for (const text of [
      ...Object.values(DAILY_SET_COPY),
      ...Object.values(DAILY_COLLECTED_COPY),
    ]) {
      expect(() => assertSafeCopy(text)).not.toThrow();
    }
  });
});
