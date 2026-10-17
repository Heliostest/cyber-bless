// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { assertSafeCopy } from "@wbr/shared";
import { PRODUCT_ORIGINAL, sceneRegistry } from "@wbr/scenes";
import { RitualNarrativeBlurb } from "./ritual-narrative";
import { builtInScenes } from "./scene-library";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cjkCount = (s: string) =>
  [...s].filter((c) => /\p{Script=Han}/u.test(c) && c !== "〇").length;
const render = (sceneId: string) =>
  renderToStaticMarkup(createElement(RitualNarrativeBlurb, { sceneId }));
const withNarrative = builtInScenes.filter((e) => e.narrative);

describe("RitualNarrativeBlurb", () => {
  it.each(["celtic-folk-spring", "theravada-water", "no-such-scene"])(
    "renders nothing without a narrative (%s)",
    (id) => {
      expect(render(id)).toBe("");
    },
  );

  it("renders a collapsed details block with the narrative", () => {
    const woodfish = builtInScenes.find((e) => e.id === "woodfish")!;
    const container = document.createElement("div");
    container.innerHTML = render("woodfish");
    const details = container.querySelector("details.ritual-narrative")!;
    expect(details).not.toBeNull();
    expect(details.hasAttribute("open")).toBe(false);
    expect(details.querySelector("summary")?.textContent).toBe("了解此仪式");
    expect(details.querySelector("p")?.textContent).toBe(woodfish.narrative);
  });
});

describe("builtInScenes narratives", () => {
  it("covers the placed practices and craft scenes", () => {
    expect(withNarrative.map((e) => e.id).sort()).toEqual([
      "aland-votive-ship",
      "amazigh-woven-rug",
      "andalusian-ceramic-tile",
      "bai-indigo-cloth",
      "barcelos-clay-rooster",
      "basque-sunflower",
      "blang-tea",
      "bokjori",
      "breton-banner",
      "catalan-festival-giant",
      "chinese-diabolo",
      "chinese-incense",
      "chinese-rattle-drum",
      "chinese-shadow-puppet",
      "chinese-suanpan",
      "chinese-tangram",
      "chinese-woodblock-print",
      "clootie-well-rag",
      "crane",
      "croatian-licitar-heart",
      "czech-bead-star",
      "czech-pilgrim-journal",
      "dalarna-wooden-horse",
      "daruma-eye-painting",
      "diya-oil-lamp",
      "ema-votive-plaque",
      "faroese-wool-knit",
      "fijian-woven-fan",
      "finnish-birch-basket",
      "floating-lantern-loy-krathong",
      "furin-wind-chime",
      "german-nutcracker",
      "ghanaian-oware",
      "hongsheng-red-string",
      "hungarian-embroidery-hoop",
      "indian-charkha",
      "indonesian-angklung",
      "italian-ex-voto",
      "japanese-kendama",
      "japanese-koinobori",
      "korean-bojagi-wrap",
      "korean-yutnori",
      "lantern",
      "lithuanian-straw-garden",
      "malawi-sansi",
      "mexican-molinillo",
      "milagros",
      "minangkabau-spinning-top",
      "mizuhiki",
      "mongolian-felt-ger",
      "navruz-sumalak",
      "ndebele-painted-house",
      "niue-shell-necklace",
      "omamori-cycle",
      "omikuji",
      "peruvian-engraved-gourd",
      "phuang-malai",
      "polish-blessing-basket",
      "polish-paper-cut",
      "purepecha-copper-bowl",
      "russian-matryoshka",
      "shinto-torii",
      "shrine-suzu-bell",
      "sicilian-painted-cart",
      "slavic-wreath",
      "slovak-wire-bird",
      "sorbian-painted-egg",
      "st-brigids-cross",
      "tanzaku-tanabata",
      "tibetan-wheel",
      "turkish-ebru-paper",
      "uzbek-clay-bowl",
      "venetian-glass-bead",
      "vietnamese-bamboo-dragonfly",
      "votive-candle-catholic",
      "weifang-paper-kite",
      "welsh-love-spoon",
      "woodfish",
      "yeondeunghoe",
    ]);
  });

  it.each(withNarrative.map((e) => [e.id, e.narrative!]))(
    "%s describes the scene without calling it an exercise",
    (_id, narrative) => {
      expect(narrative).not.toContain("练习");
    },
  );

  it.each(withNarrative.map((e) => [e.id, e.narrative!]))(
    "%s has 80–120 汉字 and safe copy",
    (_id, narrative) => {
      const count = cjkCount(narrative);
      expect(count).toBeGreaterThanOrEqual(80);
      expect(count).toBeLessThanOrEqual(120);
      expect(() => assertSafeCopy(narrative)).not.toThrow();
    },
  );

  const productOriginal = sceneRegistry
    .filter((s) => s.traditionSlug === PRODUCT_ORIGINAL)
    .map((s) => s.id);

  it("product-original scenes claim no tradition and say so", () => {
    expect(productOriginal).toEqual(["crane", "lantern"]);
    for (const id of productOriginal) {
      const entry = builtInScenes.find((e) => e.id === id)!;
      expect(entry.traditionSlug).toBeUndefined();
      expect(entry.narrative).toMatch(/产品(原创|改编)/);
    }
  });

  it.each(
    builtInScenes
      .filter((e) => !productOriginal.includes(e.id))
      .map((e) => [e.id, e.traditionSlug]),
  )(
    "%s traditionSlug points to an existing tradition card",
    (id, slug) => {
      expect(slug).toBeTruthy();
      expect(
        existsSync(join(repoRoot, "content/traditions", `${slug}.md`)),
      ).toBe(true);
      const registered = sceneRegistry.find((s) => s.id === id);
      if (registered) expect(slug).toBe(registered.traditionSlug);
      else expect(id).toBe("woodfish");
    },
  );
});
