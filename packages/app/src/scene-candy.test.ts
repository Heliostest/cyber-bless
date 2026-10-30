// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { createState, dailyCollectibleId, sceneIntention, type State } from "@wbr/core";
import { isSceneVisibleInApp } from '@wbr/core/daily-scenes';
import { Context, type AppContext } from "./context";
import { Today } from "./home";
import { SceneLibraryContext, builtInScenes } from "./scene-library";
import { NewWish } from "./wishes";
import {
  dailyCollectedPicks,
  dailyPrimaryScene,
  isWishScene,
  WISH_SCENE_IDS,
} from "./scene-placement";

const day = "2026-10-07";

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "style.css"),
  "utf8",
);
let rules: CSSStyleRule[] = [];
beforeAll(() => {
  const style = document.createElement("style");
  style.textContent = css;
  document.head.append(style);
  rules = [...style.sheet!.cssRules].filter(
    (r): r is CSSStyleRule => r instanceof CSSStyleRule,
  );
});

/** Renders `node` in an App with the bundled scenes, as a parsed document. */
function render(node: ReactNode, state: State = createState()) {
  const html = renderToStaticMarkup(
    createElement(
      Context.Provider,
      {
        value: { state, dispatch: () => true, go: () => {} } as unknown as AppContext,
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

describe("scene candy", () => {
  /** The rules of the shared map: bare [data-scene] selectors. */
  const map = () => rules.filter((r) => r.selectorText.startsWith("[data-scene"));

  it("colours no list by position", () => {
    for (const rule of rules)
      if (/ritual-tile|wish-practice|daily-set|scene-card|scene-badge/.test(rule.selectorText))
        expect(rule.selectorText).not.toMatch(/nth-(child|of-type)/);
  });

  it("is one map that names each scene once and sets every candy tier", () => {
    const ids = map().flatMap((r) =>
      [...r.selectorText.matchAll(/\[data-scene="([^"]+)"\]/g)].map((m) => m[1]),
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(map().some((r) => r.selectorText === "[data-scene]")).toBe(true);
    for (const rule of map())
      for (const tier of ["--candy", "--candy-hi", "--candy-ledge", "--candy-tint", "--candy-ring"])
        expect(rule.style.getPropertyValue(tier), `${rule.selectorText} ${tier}`).not.toBe("");
    // No tile, card, badge or button picks a candy for one scene by itself.
    for (const rule of rules)
      if (!rule.selectorText.startsWith("[data-scene") && /\[data-scene="/.test(rule.selectorText))
        expect(rule.selectorText).not.toMatch(/ritual-tile|wish-practice|daily-set|scene-card|scene-badge|button/);
  });

  it("is what the cards and badges are painted with", () => {
    const declared = (selector: string) =>
      rules
        .filter((r) => r.selectorText === selector)
        .map((r) => r.style.cssText)
        .join(" ");
    expect(declared(".scene-badge")).toMatch(/var\(--candy-tint/);
    expect(declared(".scene-badge")).toMatch(/var\(--candy,/);
  });

  it("follows a scene from 今日 to 心愿 by its id", () => {
    // A keepsake from yesterday for every writable wish scene lets both
    // 今日 and the new-wish picker offer the same collected scene.
    const yesterday = "2026-10-06";
    const state = createState();
    for (const id of WISH_SCENE_IDS) {
      if (!sceneIntention(id)?.optionalWish) continue;
      state.collectibles.push({
        id: dailyCollectibleId(yesterday, id),
        kind: "scene",
        title: builtInScenes.find((e) => e.id === id)!.title,
        at: `${yesterday}T08:00:00.000Z`,
        sceneId: id,
        ...(isWishScene(id) ? { wishScene: true } : {}),
      });
    }
    const today = render(createElement(Today, { day }), state);
    const picks = dailyCollectedPicks(builtInScenes, state.collectibles, day);
    const wishes = render(createElement(NewWish), state);
    expect(
      [...today.querySelectorAll(".daily-set-card")].map((t) => t.getAttribute("data-scene")),
    ).toEqual([dailyPrimaryScene(builtInScenes, day)!, ...picks].map((e) => e.id));
    for (const id of WISH_SCENE_IDS) {
      const badge = wishes.querySelector(`.wish-practice-card[data-scene="${id}"] .scene-badge[data-scene="${id}"]`);
      if (builtInScenes.filter(isSceneVisibleInApp).some(e => e.id === id) && sceneIntention(id)?.optionalWish) expect(badge, id).not.toBeNull();
      else expect(badge, id).toBeNull();
    }
    // The day's 许愿 pick is the same candy on both surfaces: one id, one map.
    const shared = picks.find((e) => isWishScene(e.id))!.id;
    expect(
      today.querySelector(`.daily-set-card[data-scene="${shared}"] .scene-badge[data-scene="${shared}"]`),
    ).not.toBeNull();
    expect(
      wishes.querySelector(`.wish-practice-card[data-scene="${shared}"] .scene-badge[data-scene="${shared}"]`),
    ).not.toBeNull();
  });
});
