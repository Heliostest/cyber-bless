// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createState } from "@wbr/core";
import { assertSafeCopy } from "@wbr/shared";
import { PRODUCT_ORIGINAL, sceneRegistry } from "@wbr/scenes";
import { RitualNarrativeBlurb } from "./ritual-narrative";
import { builtInScenes } from "./scene-library";
import { Context, type AppContext } from "./context";
import { clickOn, renderUI } from "./dom-test-utils";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const cjkCount = (s: string) =>
  [...s].filter((c) => /\p{Script=Han}/u.test(c) && c !== "〇").length;
const render = (sceneId: string) =>
  renderToStaticMarkup(createElement(RitualNarrativeBlurb, { sceneId }));
const withNarrative = builtInScenes.filter((e) => e.narrative);
const mounted: ReturnType<typeof renderUI>[] = [];
afterEach(() => {
  mounted.splice(0).forEach(ui => ui.unmount());
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
function mount(completion?: string, reducedMotion?: boolean) {
  const component = createElement(RitualNarrativeBlurb, { sceneId: "woodfish", completion });
  const ui = renderUI(reducedMotion === undefined ? component : createElement(Context.Provider, {
    value: { state: { ...createState(), settings: { ...createState().settings, reducedMotion } } } as AppContext,
  }, component));
  const result = { ...ui, button: ui.host.querySelector<HTMLButtonElement>(".ritual-narrative-toggle")! };
  mounted.push(result);
  return result;
}

describe("RitualNarrativeBlurb", () => {
  it.each(["no-such-scene"])(
    "renders nothing without a narrative (%s)",
    (id) => {
      expect(render(id)).toBe("");
    },
  );

  it("renders a collapsed accessible trigger with the complete narrative", () => {
    const woodfish = builtInScenes.find((e) => e.id === "woodfish")!;
    const container = document.createElement("div");
    container.innerHTML = render("woodfish");
    const button = container.querySelector<HTMLButtonElement>(".ritual-narrative-toggle")!;
    expect(button).not.toBeNull(); expect(button.type).toBe("button");
    expect(button.textContent).toBe("了解这个仪式");
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-haspopup")).toBe("dialog");
    expect(container.querySelector("details")).toBeNull();
    expect([...container.querySelectorAll(".ritual-narrative-body p")].map(p => p.textContent).join("\n\n")).toBe(woodfish.narrative);
  });

  it("renders separate paragraphs in a named keyboard-scrollable reading region", () => {
    const container = document.createElement("div");
    container.innerHTML = render("woodfish");
    const body = container.querySelector<HTMLElement>(".ritual-narrative-body")!;
    expect(body.getAttribute("role")).toBe("region");
    expect(body.getAttribute("aria-label")).toBe("敲一敲木鱼的介绍");
    expect(body.tabIndex).toBe(0);
    expect(body.getAttribute("aria-hidden")).toBe("true");
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
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });

  it("can show completion when there is no introduction", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(createElement(RitualNarrativeBlurb, {
      sceneId: "no-such-scene", completion: "已完成",
    }));
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelector('[role="status"]')?.textContent).toBe("已完成");
  });

  it("opens a foreground dialog, focuses its reading region and restores focus on Escape", () => {
    const ui = mount("已完成"); ui.button.focus(); clickOn(ui.button);
    const dialog = ui.host.querySelector<HTMLElement>('[role="dialog"]')!;
    const body = ui.host.querySelector<HTMLElement>(".ritual-narrative-body")!;
    expect(dialog).not.toBeNull(); expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe("敲一敲木鱼的介绍");
    expect(ui.button.getAttribute("aria-expanded")).toBe("true");
    expect(ui.button.getAttribute("aria-controls")).toBe(body.id);
    expect(document.activeElement).toBe(body);
    expect(body.getAttribute("aria-hidden")).toBe("false");
    expect(ui.host.querySelector('[role="status"]')?.textContent).toBe("已完成");
    expect(ui.host.querySelector('[role="status"]')?.closest('[role="dialog"]')).toBeNull();
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(ui.button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(ui.button);
    expect(body.getAttribute("aria-hidden")).toBe("true");
  });

  it("dismisses outside clicks before they reach the scene or an underlying control", () => {
    const ui = mount(); clickOn(ui.button);
    const underneath = document.createElement("button"), sceneDown = vi.fn(), sceneClick = vi.fn();
    underneath.addEventListener("pointerdown", sceneDown); underneath.addEventListener("click", sceneClick); document.body.append(underneath);
    act(() => underneath.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true })));
    clickOn(underneath);
    expect(sceneDown).not.toHaveBeenCalled(); expect(sceneClick).not.toHaveBeenCalled();
    expect(ui.button.getAttribute("aria-expanded")).toBe("false");
    underneath.remove();
  });

  it("keeps one anchored shell through rapid open/close reversals without moving completion", () => {
    vi.useFakeTimers(); const ui = mount("已完成"), shell = ui.host.querySelector(".ritual-narrative")!;
    const status = ui.host.querySelector('[role="status"]')!, header = status.parentElement;
    clickOn(ui.button); act(() => vi.advanceTimersByTime(140)); clickOn(ui.button);
    expect(ui.host.querySelector(".ritual-narrative")).toBe(shell);
    act(() => vi.advanceTimersByTime(140)); clickOn(ui.button);
    act(() => vi.advanceTimersByTime(500));
    expect(ui.button.getAttribute("aria-expanded")).toBe("true");
    expect(ui.host.querySelector(".ritual-narrative")).toBe(shell);
    expect(status.parentElement).toBe(header); expect(status.textContent).toBe("已完成");
    clickOn(ui.button); act(() => vi.advanceTimersByTime(500));
    expect(ui.host.querySelector(".ritual-narrative-backdrop")).toBeNull();
  });

  it("confines a long introduction to the space below its fixed corner on a short screen", () => {
    vi.stubGlobal("innerHeight", 420); vi.stubGlobal("innerWidth", 390);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      const height = this.classList.contains("ritual-narrative-copy") ? 900 : 44;
      const width = this.classList.contains("ritual-narrative-toggle") ? 178 : 354;
      return { left: 18, top: 118, right: 18 + width, bottom: 118 + height, width, height, x: 18, y: 118, toJSON() {} };
    });
    const ui = mount(); clickOn(ui.button);
    const shell = ui.host.querySelector<HTMLElement>(".ritual-narrative")!;
    const height = Number.parseFloat(shell.style.getPropertyValue("--ritual-narrative-expanded-height"));
    expect(height).toBeGreaterThan(80); expect(height).toBeLessThanOrEqual(290);
    expect(shell.style.transform).toBe("");
    expect(ui.host.querySelector(".ritual-narrative-body .ritual-narrative-copy")).not.toBeNull();
  });

  it("keeps a large translated trigger and the open reading panel inside a 320px viewport", () => {
    vi.stubGlobal("innerHeight", 568); vi.stubGlobal("innerWidth", 320);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
      const trigger = this.classList.contains("ritual-narrative-toggle");
      const height = trigger ? 86 : this.classList.contains("ritual-narrative-copy") ? 900 : 48;
      const width = trigger ? 460 : 294;
      return { left: 13, top: 60, right: 13 + width, bottom: 60 + height, width, height, x: 13, y: 60, toJSON() {} };
    });
    const ui = mount(); clickOn(ui.button);
    const shell = ui.host.querySelector<HTMLElement>(".ritual-narrative")!;
    expect(parseFloat(shell.style.getPropertyValue("--ritual-narrative-closed-width"))).toBeLessThanOrEqual(294);
    expect(parseFloat(shell.style.getPropertyValue("--ritual-narrative-expanded-width"))).toBeLessThanOrEqual(294);
    expect(parseFloat(shell.style.getPropertyValue("--ritual-narrative-closed-height"))).toBe(90);
    expect(parseFloat(shell.style.getPropertyValue("--ritual-narrative-expanded-height"))).toBeLessThanOrEqual(496);
  });

  it("keeps keyboard focus inside the open shell and releases scroll locking on unmount", () => {
    const originalOverflow = document.body.style.overflow;
    const ui = mount(); clickOn(ui.button); const body = ui.host.querySelector<HTMLElement>(".ritual-narrative-body")!;
    expect(document.body.style.overflow).toBe("hidden");
    act(() => body.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(ui.button);
    act(() => ui.button.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })));
    expect(document.activeElement).toBe(body);
    ui.unmount(); mounted.splice(mounted.indexOf(ui), 1);
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it("does not reclaim a parent scroll lock after the parent releases it before child unmount", () => {
    const originalOverflow = document.body.style.overflow, originalPadding = document.body.style.paddingRight;
    vi.stubGlobal("innerWidth", 390);
    vi.spyOn(document.documentElement, "clientWidth", "get").mockReturnValue(375);
    document.body.style.overflow = "hidden"; document.body.style.paddingRight = "7px";
    const ui = mount();
    try {
      clickOn(ui.button);
      expect(document.body.style.overflow).toBe("hidden");
      expect(document.body.style.paddingRight).toBe("7px");
      // A parent viewport hook cleans up before this still-present child.
      document.body.style.overflow = "auto";
      ui.unmount(); mounted.splice(mounted.indexOf(ui), 1);
      expect(document.body.style.overflow).toBe("auto");
      expect(document.body.style.paddingRight).toBe("7px");
    } finally {
      if (mounted.includes(ui)) { ui.unmount(); mounted.splice(mounted.indexOf(ui), 1); }
      document.body.style.overflow = originalOverflow; document.body.style.paddingRight = originalPadding;
    }
  });

  it("honors both the App setting and live system reduced-motion changes without requiring context for SSR", () => {
    let changed: (() => void) | undefined;
    const query = { matches: false, addEventListener: (_: string, handler: () => void) => { changed = handler; }, removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", vi.fn(() => query));
    const ui = mount(undefined, true); clickOn(ui.button);
    expect(ui.host.querySelector(".ritual-narrative")?.getAttribute("data-reduced-motion")).toBe("true");
    ui.unmount(); mounted.splice(mounted.indexOf(ui), 1);
    const system = mount(); clickOn(system.button);
    act(() => { query.matches = true; changed?.(); });
    expect(system.host.querySelector(".ritual-narrative")?.getAttribute("data-reduced-motion")).toBe("true");
    expect(() => render("woodfish")).not.toThrow();
  });

  it("uses symmetric size transitions with a fixed radius and independently scrollable text", () => {
    const css = readFileSync(join(repoRoot, "packages/app/src/ritual-narrative.css"), "utf8");
    expect(css).toMatch(/420ms/); expect(css).toMatch(/cubic-bezier\(0\.42,\s*0,\s*0\.58,\s*1\)/);
    expect(css).toMatch(/border-radius:\s*var\(--ritual-narrative-radius\)/);
    expect(css).toMatch(/overflow-y:\s*auto/); expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(css).not.toMatch(/scale\(/);
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
      "brat-bride-cloth",
      "breton-banner",
      "bulgarian-survakane",
      "catalan-festival-giant",
      "celtic-folk-spring",
      "chinese-diabolo",
      "chinese-fu-paper",
      "chinese-incense",
      "chinese-longevity-lock",
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
      "finnish-virpominen",
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
      "hindu-coconut-offering",
      "hongsheng-red-string",
      "horseshoe-doorway-luck",
      "hungarian-embroidery-hoop",
      "indian-charkha",
      "indonesian-angklung",
      "irish-bodhran",
      "italian-ex-voto",
      "japanese-daruma-otoshi",
      "japanese-hamaya",
      "japanese-kadomatsu",
      "japanese-kendama",
      "japanese-koinobori",
      "japanese-kumade",
      "japanese-shishi-odoshi",
      "japanese-wagasa",
      "kagami-biraki-sake",
      "kagami-mochi-offering",
      "kameido-usokae",
      "kitano-nadeushi",
      "korean-bojagi-wrap",
      "korean-sotdae",
      "korean-yutnori",
      "lam-tsuen-wishing-tree",
      "lanna-sand-pagoda",
      "lantern",
      "lao-baci-wrist",
      "lithuanian-straw-garden",
      "malawi-sansi",
      "mexican-metate",
      "mexican-molinillo",
      "mexican-tortilla-press",
      "mezuzah-doorpost",
      "milagros",
      "minangkabau-spinning-top",
      "mizuhiki",
      "mochigase-nagashibina",
      "mongolian-felt-ger",
      "mongolian-ovoo",
      "nanakusa-gayu",
      "navruz-sumalak",
      "ndebele-painted-house",
      "neapolitan-cornicello",
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
      "pucara-rooftop-bulls",
      "puerto-rican-guiro",
      "purepecha-copper-bowl",
      "romanian-martisor",
      "rosh-hashanah-apple-honey",
      "russian-matryoshka",
      "scottish-first-footing",
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
      "spanish-twelve-grapes",
      "sri-lankan-bodhi-puja",
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
      "turkish-nazar-bead",
      "uchide-wishing-mallet",
      "udo-undama",
      "uzbek-clay-bowl",
      "valencian-folding-fan",
      "venetian-glass-bead",
      "vietnamese-bamboo-dragonfly",
      "vietnamese-five-fruit-tray",
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
