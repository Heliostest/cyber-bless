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
  it.each(["no-such-scene"])(
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
    expect(details.querySelector("summary")?.textContent).toBe("了解这个仪式");
    expect([...details.querySelectorAll(".ritual-narrative-body > p")].map(p => p.textContent).join("\n\n")).toBe(woodfish.narrative);
  });

  it("renders separate paragraphs in a named keyboard-scrollable reading region", () => {
    const container = document.createElement("div");
    container.innerHTML = render("woodfish");
    const body = container.querySelector<HTMLElement>(".ritual-narrative-body")!;
    expect(body.getAttribute("role")).toBe("region");
    expect(body.getAttribute("aria-label")).toBe("敲一敲木鱼的介绍");
    expect(body.tabIndex).toBe(0);
    expect(body.querySelectorAll("p").length).toBeGreaterThan(1);
  });

  it("keeps completion outside the expandable reading region", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(createElement(RitualNarrativeBlurb, {
      sceneId: "woodfish", completion: "已完成",
    }));
    const status = container.querySelector('[role="status"]')!;
    expect(status.textContent).toBe("已完成");
    expect(status.parentElement?.className).toBe("ritual-narrative-header");
    expect(status.closest("details")).toBeNull();
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("can show completion when there is no introduction", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(createElement(RitualNarrativeBlurb, {
      sceneId: "no-such-scene", completion: "已完成",
    }));
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("已完成");
  });
});

describe("builtInScenes narratives", () => {
  it("covers the placed practices and craft scenes", () => {
    expect(withNarrative.map((e) => e.id).sort()).toEqual([
      "aland-votive-ship",
      "alasita-miniature-house",
      "amazigh-woven-rug",
      "andalusian-ceramic-tile",
      "bai-indigo-cloth",
      "balinese-canang-sari",
      "barcelos-clay-rooster",
      "basque-sunflower",
      "blang-tea",
      "bokjori",
      "bonfim-ribbon",
      "breton-banner",
      "bulgarian-survakane",
      "catalan-festival-giant",
      "celtic-folk-spring",
      "chinese-diabolo",
      "chinese-incense",
      "chinese-rattle-drum",
      "chinese-ruyi-scepter",
      "chinese-shadow-puppet",
      "chinese-steelyard",
      "chinese-suanpan",
      "chinese-tangram",
      "chinese-woodblock-print",
      "chinowa-kuguri",
      "clootie-well-rag",
      "crane",
      "croatian-licitar-heart",
      "czech-bead-star",
      "czech-pilgrim-journal",
      "czech-wooden-ratchet",
      "dalarna-wooden-horse",
      "daruma-eye-painting",
      "diya-oil-lamp",
      "ema-votive-plaque",
      "english-hearth-bellows",
      "estonian-village-swing",
      "faroese-wool-knit",
      "fgs-buddha-bathing",
      "fijian-woven-fan",
      "finnish-birch-basket",
      "finnish-kantele",
      "floating-lantern-loy-krathong",
      "french-coffee-mill",
      "french-petanque",
      "furin-wind-chime",
      "garden-croquet",
      "german-jumping-jack",
      "german-nutcracker",
      "ghanaian-oware",
      "greek-new-year-pomegranate",
      "greek-vasilopita",
      "hiiragi-iwashi",
      "hongsheng-red-string",
      "hungarian-embroidery-hoop",
      "indian-charkha",
      "indonesian-angklung",
      "irish-bodhran",
      "italian-ex-voto",
      "japanese-daruma-otoshi",
      "japanese-kendama",
      "japanese-koinobori",
      "japanese-shishi-odoshi",
      "japanese-wagasa",
      "kagami-biraki-sake",
      "kagami-mochi-offering",
      "kameido-usokae",
      "korean-bojagi-wrap",
      "korean-yutnori",
      "lam-tsuen-wishing-tree",
      "lantern",
      "lithuanian-straw-garden",
      "malawi-sansi",
      "mexican-metate",
      "mexican-molinillo",
      "mexican-tortilla-press",
      "milagros",
      "minangkabau-spinning-top",
      "mizuhiki",
      "mochigase-nagashibina",
      "mongolian-felt-ger",
      "mongolian-ovoo",
      "navruz-sumalak",
      "ndebele-painted-house",
      "niue-shell-necklace",
      "omamori-cycle",
      "omikuji",
      "paper-pinwheel",
      "persian-esfand",
      "peruvian-engraved-gourd",
      "phuang-malai",
      "polish-blessing-basket",
      "polish-oplatek-sharing",
      "polish-paper-cut",
      "puerto-rican-guiro",
      "purepecha-copper-bowl",
      "romanian-martisor",
      "rosh-hashanah-apple-honey",
      "russian-matryoshka",
      "scottish-plunge-churn",
      "setsubun-mamemaki",
      "shichigosan-chitose-ame",
      "shinto-torii",
      "shrine-suzu-bell",
      "sicilian-painted-cart",
      "slavic-wreath",
      "slovak-wire-bird",
      "sorbian-painted-egg",
      "spanish-castanets",
      "st-brigids-cross",
      "sternsinger-house-blessing",
      "sumiyoshi-godairiki",
      "tamagushi-offering",
      "tanzaku-tanabata",
      "thai-songkran-elders",
      "theravada-water",
      "tibetan-khata-greeting",
      "tibetan-prayer-flags",
      "tibetan-water-bowls",
      "tibetan-wheel",
      "turkish-ebru-paper",
      "udo-undama",
      "uzbek-clay-bowl",
      "valencian-folding-fan",
      "venetian-glass-bead",
      "vietnamese-bamboo-dragonfly",
      "votive-candle-catholic",
      "weifang-paper-kite",
      "welsh-drop-spindle",
      "welsh-love-spoon",
      "woodfish",
      "yeondeunghoe",
      "yusheng-lohei",
      "zeniarai-coin-washing",
    ]);
  });

  it.each(withNarrative.map((e) => [e.id, e.narrative!]))(
    "%s describes the scene without calling it an exercise",
    (_id, narrative) => {
      expect(narrative).not.toContain("练习");
    },
  );

  it.each(withNarrative.map((e) => [e.id, e.narrative!]))(
    "%s has bounded, safe reading copy",
    (_id, narrative) => {
      const count = cjkCount(narrative);
      expect(count).toBeGreaterThanOrEqual(120);
      expect(count).toBeLessThanOrEqual(600);
      expect(narrative.split(/\n\s*\n/).filter((p) => p.trim()).length).toBeGreaterThanOrEqual(2);
      expect(() => assertSafeCopy(narrative)).not.toThrow();
    },
  );

  const productOriginal = sceneRegistry
    .filter((s) => s.traditionSlug === PRODUCT_ORIGINAL)
    .map((s) => s.id);

  it("product-original scenes claim no tradition", () => {
    expect(productOriginal).toEqual(["minangkabau-spinning-top","hongsheng-red-string","czech-pilgrim-journal","celtic-folk-spring","theravada-water","lantern"]);
    for (const id of productOriginal) {
      const entry = builtInScenes.find((e) => e.id === id)!;
      expect(entry.traditionSlug).toBeUndefined();
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
