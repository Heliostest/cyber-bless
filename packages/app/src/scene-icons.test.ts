// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createState, dailyCollectibleId, sceneIntention, type State } from "@wbr/core";
import { isSceneVisibleInApp } from "@wbr/core/daily-scenes";
import { Context, type AppContext } from "./context";
import { clickOn, renderUI } from "./dom-test-utils";
import { Today } from "./home";
import { Wishes } from "./pages";
import { SceneLibraryContext, builtInScenes } from "./scene-library";
import { SceneArt, SceneBadge, SceneIcon, hasSceneIcon } from "./scene-icons";
import {
  BLESSING_SCENE_IDS,
  DAILY_COLLECTED_COPY,
  DAILY_SET_COPY,
  WISH_SCENE_IDS,
  dailyCollectedPicks,
  dailyPrimaryScene,
  isWishScene,
} from "./scene-placement";
import { VESSEL_COPY } from "./vessels";
import { NewWish } from "./wishes";

const day = "2026-10-07";

/** Renders `node` in an App with the bundled scenes, as a parsed document. */
function render(node: ReactNode, state: State = createState()) {
  const html = renderToStaticMarkup(
    createElement(
      Context.Provider,
      {
        value: {
          state,
          dispatch: () => true,
          go: () => {},
        } as unknown as AppContext,
      },
      createElement(
        SceneLibraryContext.Provider,
        { value: { entries: builtInScenes } as never },
        node,
      ),
    ),
  );
  return new DOMParser().parseFromString(html, "text/html");
}

/** A wish page, live over `state`; `go` records where each tap leads. */
function openWishes(state: State = createState(), component = Wishes) {
  const go = vi.fn();
  const ui = renderUI(
    createElement(
      Context.Provider,
      { value: { state, dispatch: () => true, go } as unknown as AppContext },
      createElement(
        SceneLibraryContext.Provider,
        { value: { entries: builtInScenes } as never },
        createElement(component),
      ),
    ),
  );
  return {
    ...ui,
    go,
    pray: ui.host.querySelector<HTMLButtonElement>(".pray-button")!,
    picker: () => ui.host.querySelector("#vessel-picker"),
    cards: () => [...ui.host.querySelectorAll(".vessel-card")],
  };
}

const openPicker = (state = createState()) => openWishes(state, NewWish);

/** One collected daily keepsake for `sceneId`, spent for a wish when `spent`. */
function keepsake(day: string, sceneId: string, spent?: string) {
  const entry = builtInScenes.find((e) => e.id === sceneId)!;
  return {
    id: dailyCollectibleId(day, sceneId),
    kind: "scene" as const,
    title: entry.title,
    at: `${day}T08:00:00.000Z`,
    sceneId,
    ...(isWishScene(sceneId) ? { wishScene: true } : {}),
    ...(spent ? { spentAt: spent } : {}),
  };
}

describe("今日's daily set badges", () => {
  // An earlier keepsake of every placed scene: the day's walk, then three picks.
  const state = createState();
  state.collectibles.push(
    ...[...BLESSING_SCENE_IDS, ...WISH_SCENE_IDS].map((id) =>
      keepsake("2026-10-01", id),
    ),
  );
  const primary = dailyPrimaryScene(builtInScenes, day)!;
  const picks = dailyCollectedPicks(builtInScenes, state.collectibles, day);
  const doc = render(createElement(Today, { day }), state);
  const cards = [...doc.querySelectorAll(".daily-set-card")];

  it("leads every card with its scene's drawn icon, keyed by scene id", () => {
    expect(picks).toHaveLength(3);
    expect(cards.map((c) => c.getAttribute("data-scene"))).toEqual(
      [primary, ...picks].map((e) => e.id),
    );
    for (const card of cards) {
      expect(card.firstElementChild!.className).toBe("scene-badge");
      expect(card.querySelector(".scene-badge svg path")).not.toBeNull();
    }
  });

  it("labels cards with words only: no emoji or symbol glyphs", () => {
    const note = (entry: { id: string }, copy: { wishNote: string; blessingNote: string }) =>
      isWishScene(entry.id) ? copy.wishNote : copy.blessingNote;
    // SVG artwork can contain aria-hidden lettering, such as 運 on a wish ball.
    // Check the card's label fields separately from that decorative artwork.
    expect(cards.map((card) => `${card.querySelector(":scope > strong")!.textContent}${card.querySelector(":scope > small")!.textContent}`)).toEqual([
      `${primary.title}${note(primary, DAILY_SET_COPY)}`,
      ...picks.map((entry) => `${entry.title}${note(entry, DAILY_COLLECTED_COPY)}`),
    ]);
  });
});

describe("心愿's ritual picker", () => {
  // One spent vessel, then two usable ones: the picker offers the usable two,
  // newest first, and never the spent one or a 祈福 keepsake.
  const state = createState();
  state.collectibles.push(
    keepsake("2026-10-05", "yeondeunghoe", "2026-10-06T08:00:00.000Z"),
    keepsake("2026-10-06", "tanzaku-tanabata"),
    keepsake("2026-10-07", "crane"),
    keepsake("2026-10-07", "woodfish"),
  );
  let ui: ReturnType<typeof openWishes>;
  afterEach(() => {
    ui.unmount();
  });

  it("has one 去许愿 entrance under the list and opens the picker route", () => {
    ui = openWishes(state);
    expect(ui.picker()).toBeNull();
    expect(ui.cards()).toHaveLength(0);
    expect(ui.host.querySelectorAll(".pray-button")).toHaveLength(1);
    expect(ui.host.querySelector(".page-heading button, .wish-empty button")).toBeNull();
    expect(ui.pray.textContent).toBe("去许愿");
    expect(ui.pray.hasAttribute("aria-expanded")).toBe(false);
    expect(ui.pray.previousElementSibling!.matches(".wish-list, .wish-empty")).toBe(
      true,
    );
    expect(ui.pray.nextElementSibling!.className).toBe("privacy-note");
    clickOn(ui.pray);
    expect(ui.go).toHaveBeenCalledWith({ page: "new" });
    expect(ui.picker()).toBeNull();
  });

  it("offers the unspent wish-type keepsakes only, newest first", () => {
    ui = openPicker(state);
    expect(ui.cards().map((card) => card.getAttribute("data-scene"))).toEqual([
      "crane",
      "tanzaku-tanabata",
    ]);
    for (const card of ui.cards())
      expect(card.querySelector(".scene-badge svg path")).not.toBeNull();
  });

  it("says the one action under the title, without repeating it", () => {
    ui = openPicker(state);
    for (const card of ui.cards()) {
      const title = card.querySelector("strong")!.textContent!;
      const action = card.querySelector("small")!.textContent!;
      expect(action).toBe(VESSEL_COPY.use);
      expect(action).not.toContain(title);
    }
  });

  it("opens the picked keepsake's scene as a vessel visit", () => {
    ui = openPicker(state);
    clickOn(ui.host.querySelector('.vessel-card[data-scene="crane"]')!);
    expect(ui.go).toHaveBeenCalledWith({
      page: "scene",
      id: "crane",
      entry: builtInScenes.find((e) => e.id === "crane"),
      daily: undefined,
      vessel: dailyCollectibleId("2026-10-07", "crane"),
      wishId: undefined,
    });
  });

  it("offers drawn ritual choices without a keepsake and opens one directly", () => {
    ui = openPicker();
    const picker = ui.picker()!;
    const cards = [...picker.querySelectorAll(".wish-practice-card")];
    const eligible = builtInScenes.filter((entry) => {
      const intention = sceneIntention(entry.id);
      return isSceneVisibleInApp(entry) && intention?.kind === "wish" && intention.optionalWish;
    });
    expect(cards.map((card) => card.getAttribute("data-scene")).sort()).toEqual(
      eligible.map((entry) => entry.id).sort(),
    );
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards)
      expect(card.querySelector(".scene-badge svg path")).not.toBeNull();
    expect(ui.cards()).toHaveLength(0);
    clickOn(cards[0]);
    expect(ui.go).toHaveBeenCalledWith(expect.objectContaining({
      page: "scene",
      id: cards[0].getAttribute("data-scene"),
      vessel: undefined,
    }));
  });
});

describe("scene badges", () => {
  it("have a drawn icon for every built-in scene", () => {
    for (const entry of builtInScenes)
      expect(hasSceneIcon(entry.id), entry.id).toBe(true);
  });

  it("show a leaf for a scene without one, so no row is left blank", () => {
    const html = renderToStaticMarkup(
      createElement(SceneBadge, { id: "a-new-remote-scene" }),
    );
    const badge = new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector(".scene-badge")!;
    expect(badge.getAttribute("aria-hidden")).toBe("true");
    expect(badge.querySelector("svg path")).not.toBeNull();
    expect(badge.querySelector(".scene-icon")).toBeNull();
  });
});

function viewport(id: string, component = SceneIcon) {
  const markup = renderToStaticMarkup(createElement(component, { id }));
  const value = markup.match(/viewBox="([^"]+)"/)?.[1];
  expect(value).toBeDefined();
  return value!.split(/\s+/).map(Number);
}

function expectContains(id: string, bounds: number[]) {
  const [x, y, width, height] = viewport(id);
  expect(x).toBeLessThanOrEqual(bounds[0]);
  expect(y).toBeLessThanOrEqual(bounds[1]);
  expect(x + width).toBeGreaterThanOrEqual(bounds[2]);
  expect(y + height).toBeGreaterThanOrEqual(bounds[3]);
}

describe("scene icon framing", () => {
  it.each(["nanakusa-gayu", "korean-sotdae", "puerto-rican-guiro", "ghanaian-oware"])(
    "contains the 64-unit artwork with stroke breathing room for %s",
    id => expectContains(id, [-2, -2, 66, 66]),
  );

  it.each(["woodfish", "crane", "lantern", "german-nutcracker"])(
    "keeps the 48-unit artwork on its smaller padded canvas for %s",
    id => expect(viewport(id)).toEqual([-3, -3, 54, 54]),
  );

  it.each([
    ["chinese-rattle-drum", [2, 3.5, 52, 50.5]],
    ["korean-yutnori", [6.35, 4.35, 47.65, 50.55]],
    ["russian-matryoshka", [5.35, 1, 50.5, 46]],
    ["japanese-koinobori", [6, 4, 48.6, 45.5]],
    ["chinese-incense", [6.9, -3.85, 41.1, 45.5]],
    ["theravada-water", [0, -0.1, 48, 48]],
    ["shrine-suzu-bell", [0, -0.6, 48, 48]],
  ] as const)("contains the extended strokes for %s", (id, bounds) => {
    expectContains(id, [...bounds]);
  });

  it("uses the same viewport in the reveal illustration and scene badges", () => {
    for (const id of ["korean-sotdae", "woodfish", "chinese-incense"]) {
      expect(viewport(id, SceneArt)).toEqual(viewport(id));
      expect(viewport(id, SceneBadge)).toEqual(viewport(id));
    }
  });

  it("keeps both canvas groups available and unknown scenes on their leaf fallback", () => {
    expect(hasSceneIcon("nanakusa-gayu")).toBe(true);
    expect(hasSceneIcon("woodfish")).toBe(true);
    expect(hasSceneIcon("unknown-scene")).toBe(false);
    expect(renderToStaticMarkup(createElement(SceneIcon, { id: "unknown-scene" }))).toBe("");
    expect(renderToStaticMarkup(createElement(SceneArt, { id: "unknown-scene" }))).toContain('viewBox="0 0 24 24"');
  });
});
