// @vitest-environment jsdom
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { assertSafeCopy } from "@wbr/shared";
import { isSceneVisibleInApp } from '@wbr/core/daily-scenes';
import { Context, type AppContext } from "./context";
import {
  builtInScenes,
  CATALOG_EMPTY_COPY,
  CATALOG_SEARCH_COPY,
  SCENE_STATUS_COPY,
  SceneCatalog,
  SceneLibraryContext,
  sceneStatus,
} from "./scene-library";
import { clickOn, renderUI, settle, typeInto } from "./dom-test-utils";
const visibleScenes = builtInScenes.filter(isSceneVisibleInApp);

function renderCatalog(entries = builtInScenes) {
  const ui = renderUI(
    createElement(
      Context.Provider,
      { value: { go: () => {} } as unknown as AppContext },
      createElement(
        SceneLibraryContext.Provider,
        {
          value: {
            entries,
            library: { status: async () => "bundled" },
            stats: undefined,
            error: "",
            ready: true,
            maintain: async () => undefined,
          } as never,
        },
        createElement(SceneCatalog),
      ),
    ),
  );
  return {
    ...ui,
    input: ui.host.querySelector<HTMLInputElement>(".scene-search input")!,
    cards: () => ui.host.querySelectorAll(".scene-card").length,
    empty: () => ui.host.querySelector<HTMLElement>(".empty"),
  };
}

describe("场景目录 search", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("hides the abacus even when a source or remote catalog still contains it", async () => {
    expect(builtInScenes.some(e => e.id === 'chinese-suanpan')).toBe(true);
    const abacus = builtInScenes.find(e => e.id === 'chinese-suanpan')!;
    const ui = renderCatalog([...builtInScenes, { ...abacus, id: 'remote-abacus' }]);
    await settle();
    expect(ui.host.querySelector('[data-scene="chinese-suanpan"]')).toBeNull();
    expect(ui.host.querySelector('[data-scene="remote-abacus"]')).toBeNull();
    typeInto(ui.input, '拨珠见数');await settle();
    expect(ui.cards()).toBe(0);ui.unmount();
  });

  it("says so gently when nothing matches, and clears back to every scene", async () => {
    const ui = renderCatalog();
    await settle();
    expect(ui.cards()).toBe(Math.min(24, builtInScenes.length));
    expect(ui.empty()).toBeNull();

    typeInto(ui.input, "没有这样的场景");
    await settle();
    expect(ui.cards()).toBe(0);
    const empty = ui.empty()!;
    expect(empty.getAttribute("role")).toBe("status");
    expect(empty.textContent).toContain(CATALOG_EMPTY_COPY.title);
    expect(empty.textContent).toContain(CATALOG_EMPTY_COPY.body);

    clickOn(
      [...empty.querySelectorAll("button")].find(
        (b) => b.textContent === CATALOG_EMPTY_COPY.clear,
      )!,
    );
    await settle();
    expect(ui.input.value).toBe("");
    expect(document.activeElement).toBe(ui.input);
    expect(ui.cards()).toBe(Math.min(24, builtInScenes.length));
    expect(ui.empty()).toBeNull();
    ui.unmount();
  });

  it("lists matches without the note, ignoring spaces around the words", async () => {
    const ui = renderCatalog();
    typeInto(ui.input, " 木鱼 ");
    await settle();
    expect(ui.cards()).toBe(1);
    expect(ui.empty()).toBeNull();
    ui.unmount();
  });

  it("is a search field with a magnifier, a placeholder and a label", () => {
    const ui = renderCatalog();
    expect(ui.input.type).toBe("search");
    expect(ui.input.placeholder).toBe(CATALOG_SEARCH_COPY.placeholder);
    const label = ui.input.closest("label")!;
    expect(label.textContent).toBe(CATALOG_SEARCH_COPY.label);
    expect(label.querySelector(":scope > svg")).not.toBeNull();
    ui.unmount();
  });

  it("keeps the search, note and chip copy safe", () => {
    for (const text of [
      ...Object.values(CATALOG_EMPTY_COPY),
      ...Object.values(CATALOG_SEARCH_COPY),
      ...Object.values(SCENE_STATUS_COPY),
    ])
      expect(() => assertSafeCopy(text)).not.toThrow();
  });
});

describe("场景目录 rows", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("lead with the scene's drawn badge and end with a go-to chevron", async () => {
    const ui = renderCatalog();
    await settle();
    for (let visible = 24; visible < visibleScenes.length; visible += 24) {
      clickOn(Array.from(ui.host.querySelectorAll('button')).find(b => b.textContent === '显示更多')!);
      await settle();
      expect(ui.cards()).toBe(Math.min(visible + 24, visibleScenes.length));
    }
    const cards = [...ui.host.querySelectorAll(".scene-card")];
    expect(cards.map((card) => card.getAttribute("data-scene"))).toEqual(
      visibleScenes.map((e) => e.id),
    );
    for (const card of cards) {
      expect(
        card.querySelector(":scope > .scene-badge img.scene-icon"),
      ).not.toBeNull();
      expect(card.lastElementChild!.tagName.toLowerCase()).toBe("svg");
    }
    ui.unmount();
  });

  it("say where a built-in scene's content is with a short chip", async () => {
    const ui = renderCatalog();
    await settle();
    for (let visible = 24; visible < visibleScenes.length; visible += 24) {
      clickOn(Array.from(ui.host.querySelectorAll('button')).find(b => b.textContent === '显示更多')!);
      await settle();
      expect(ui.cards()).toBe(Math.min(visible + 24, visibleScenes.length));
    }
    const chips = [...ui.host.querySelectorAll(".scene-card .scene-status")];
    expect(chips).toHaveLength(visibleScenes.length);
    for (const chip of chips) {
      expect(chip.getAttribute("data-status")).toBe("bundled");
      expect(chip.textContent).toBe(SCENE_STATUS_COPY.bundled);
    }
    ui.unmount();
  });
});

describe("sceneStatus", () => {
  const remote = { ...builtInScenes[0], manifestUrl: "/scene-content/x.json" };
  it.each([
    ["a built-in scene", builtInScenes[0], undefined, "bundled"],
    ["a cached remote scene", remote, "cached", "cached"],
    ["a remote scene whose files were cleared", remote, "missing", "download"],
    ["a remote scene not yet downloaded", remote, "unknown", "download"],
    ["a remote scene before its status loads", remote, undefined, "download"],
    ["a scene this App cannot play", { ...remote, engine: "future@9" }, "cached", "update"],
  ])("labels %s", (_name, entry, cache, status) => {
    expect(sceneStatus(entry, cache)).toBe(status);
  });
});
