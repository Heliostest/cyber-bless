// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createState, dailyCollectibleId, sceneIntention, type State } from "@wbr/core";
import { isSceneVisibleInApp } from "@wbr/core/daily-scenes";
import { Context, type AppContext } from "./context";
import { clickOn, renderUI } from "./dom-test-utils";
import { Today } from "./home";
import { CollectionDetail, Wishes, World } from "./pages";
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

  it("leads every card with its scene's image, keyed by scene id", () => {
    expect(picks).toHaveLength(3);
    expect(cards.map((c) => c.getAttribute("data-scene"))).toEqual(
      [primary, ...picks].map((e) => e.id),
    );
    for (const card of cards) {
      expect(card.firstElementChild!.className).toBe("scene-badge");
      expect(card.querySelector(".scene-badge img.scene-icon")).not.toBeNull();
    }
  });

  it("labels cards with words only: no emoji or symbol glyphs", () => {
    const note = (entry: { id: string }, copy: { wishNote: string; blessingNote: string }) =>
      isWishScene(entry.id) ? copy.wishNote : copy.blessingNote;
    // Check the card's label fields separately from its decorative artwork.
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
      expect(card.querySelector(".scene-badge img.scene-icon")).not.toBeNull();
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
      return isSceneVisibleInApp(entry) && isWishScene(entry.id) && intention?.kind === "wish" && intention.optionalWish;
    });
    expect(cards.map((card) => card.getAttribute("data-scene")).sort()).toEqual(
      eligible.map((entry) => entry.id).sort(),
    );
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards)
      expect(card.querySelector(".scene-badge img.scene-icon")).not.toBeNull();
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
  it("have an image for every built-in scene", () => {
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

describe("historical ritual keepsake illustrations", () => {
  it.each(["woodfish", "crane", "lantern"] as const)("uses the current %s illustration in the room, grid and detail", kind => {
    const state = createState();
    const id = `legacy:${kind}`;
    state.collectibles.push({ id, kind, title: kind, at: "2026-10-01T08:00:00.000Z" });
    const world = render(createElement(World), state);
    const images = world.querySelectorAll(`[data-collectible-id="${id}"] img.scene-icon`);
    expect(images).toHaveLength(2);
    for (const art of images) expect(art.getAttribute("src")).toBe(`/scene-icons/soft3d/${kind}.webp`);
    const detail = render(createElement(CollectionDetail, { id }), state);
    expect(detail.querySelector("img.scene-icon")?.getAttribute("src")).toBe(`/scene-icons/soft3d/${kind}.webp`);
  });

  it("keeps the commemorative badge on its separate wishes artwork", () => {
    const state = createState();
    state.collectibles.push({ id: "legacy:badge", kind: "badge", title: "还愿纪念", at: "2026-10-01T08:00:00.000Z" });
    const detail = render(createElement(CollectionDetail, { id: "legacy:badge" }), state);
    expect(detail.querySelector(".reference-crop img")?.getAttribute("src")).toBe("/reference-ui/wishes.png");
  });
});

function image(id: string, component = SceneIcon) {
  const markup = renderToStaticMarkup(createElement(component, { id }));
  const art = new DOMParser().parseFromString(markup, "text/html").querySelector<HTMLImageElement>("img.scene-icon");
  expect(art, id).not.toBeNull();
  return art!;
}

describe("scene icon images", () => {
  it("maps every built-in scene, including old keepsakes, to its own local WebP", () => {
    for (const { id } of builtInScenes) {
      expect(image(id).getAttribute("src"), id).toBe(`/scene-icons/soft3d/${id}.webp`);
    }
  });

  it("keeps images decorative in every shared scene presentation", () => {
    for (const component of [SceneIcon, SceneArt, SceneBadge]) {
      const art = image("woodfish", component);
      expect(art.getAttribute("alt")).toBe("");
      expect(art.getAttribute("aria-hidden")).toBe("true");
      expect(art.draggable).toBe(false);
      expect(art.getAttribute("width")).toBe("256");
      expect(art.getAttribute("height")).toBe("256");
    }
  });

  it("uses the same image for reveal illustrations and scene badges", () => {
    for (const id of ["korean-sotdae", "woodfish", "chinese-incense"]) {
      expect(image(id, SceneArt).getAttribute("src")).toBe(image(id).getAttribute("src"));
      expect(image(id, SceneBadge).getAttribute("src")).toBe(image(id).getAttribute("src"));
    }
  });

  it.each(["unknown-scene", "toString", "constructor", "__proto__"])("keeps unknown id %s on its leaf fallback", id => {
    expect(hasSceneIcon(id)).toBe(false);
    expect(renderToStaticMarkup(createElement(SceneIcon, { id }))).toBe("");
    expect(renderToStaticMarkup(createElement(SceneArt, { id }))).toContain('viewBox="0 0 24 24"');
  });

  it("shows a leaf after an image fails and retries when navigating away and back", () => {
    const ui = renderUI(createElement(SceneBadge, { id: "woodfish" }));
    try {
      const art = ui.host.querySelector("img.scene-icon")!;
      expect(art).not.toBeNull();
      act(() => art.dispatchEvent(new Event("error")));
      expect(ui.host.querySelector("img")).toBeNull();
      expect(ui.host.querySelector(".scene-badge > svg path")).not.toBeNull();
      expect(ui.host.querySelector(".scene-badge")?.getAttribute("aria-hidden")).toBe("true");
      ui.rerender(createElement(SceneBadge, { id: "crane" }));
      expect(ui.host.querySelector("img")?.getAttribute("src")).toBe("/scene-icons/soft3d/crane.webp");
      ui.rerender(createElement(SceneBadge, { id: "woodfish" }));
      expect(ui.host.querySelector("img")?.getAttribute("src")).toBe("/scene-icons/soft3d/woodfish.webp");
    } finally {
      ui.unmount();
    }
  });

  it("resolves images under the configured Expo or Vite asset base", () => {
    vi.stubEnv("EXPO_BASE_URL", "./embedded/");
    try {
      expect(image("woodfish").getAttribute("src")).toBe("./embedded/scene-icons/soft3d/woodfish.webp");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
