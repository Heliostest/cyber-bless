// @vitest-environment jsdom
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createState } from "@wbr/core";
import { assertSafeCopy } from "@wbr/shared";
import { Context, type AppContext } from "./context";
import { clickOn, renderUI } from "./dom-test-utils";
import { FeedbackControls } from "./feedback-controls";
import { Me } from "./pages";
import { FavoriteChip, SCENE_FAVORITE_LABEL } from "./scene-experience";

/** Renders `node` inside an App whose host can, or cannot, vibrate. */
const render = (node: ReactNode, canHaptic: boolean) =>
  renderToStaticMarkup(
    createElement(
      Context.Provider,
      {
        value: {
          state: createState(),
          dispatch: () => true,
          go: () => {},
          canHaptic,
        } as unknown as AppContext,
      },
      node,
    ),
  );

describe("震动 toggle", () => {
  it.each([true, false])(
    "appears beside 音效 in scenes only where the host can vibrate (%s)",
    (canHaptic) => {
      const html = render(createElement(FeedbackControls), canHaptic);
      expect(html).toContain("音效");
      expect(html.includes("震动")).toBe(canHaptic);
      const buttons = new DOMParser().parseFromString(html, "text/html").querySelectorAll("button[aria-pressed]");
      expect(buttons).toHaveLength(canHaptic ? 2 : 1);
      expect(html).not.toContain('type="checkbox"');
    },
  );

  it.each([true, false])(
    "appears in 我的 settings only where the host can vibrate (%s)",
    (canHaptic) => {
      const html = render(createElement(Me), canHaptic);
      expect(html).toContain("仪式声音");
      expect(html).toContain("减少动态效果");
      expect(html.includes("轻触反馈")).toBe(canHaptic);
    },
  );
});

describe("收藏 on a scene page", () => {
  const chip = (favorite: boolean, dispatch: (a: unknown) => boolean = () => true) =>
    renderUI(
      createElement(
        Context.Provider,
        { value: { dispatch } as unknown as AppContext },
        createElement(FavoriteChip, { id: "crane", favorite }),
      ),
    );

  it.each([false, true])(
    "is a heart toggle whose state is aria-pressed, not its name (favourite: %s)",
    (favorite) => {
      const ui = chip(favorite);
      const button = ui.host.querySelector("button.favorite-chip")!;
      expect(button.getAttribute("aria-pressed")).toBe(String(favorite));
      expect(button.textContent).toBe(SCENE_FAVORITE_LABEL);
      expect(button.querySelector("svg path")).not.toBeNull();
      ui.unmount();
    },
  );

  it.each([false, true])("toggles the scene's favourite (from %s)", (favorite) => {
    const actions: unknown[] = [];
    const ui = chip(favorite, (a) => (actions.push(a), true));
    clickOn(ui.host.querySelector("button.favorite-chip")!);
    expect(actions).toEqual([{ type: "scene.favorite", id: "crane", favorite: !favorite }]);
    ui.unmount();
  });

  it("keeps its copy safe", () => {
    expect(() => assertSafeCopy(SCENE_FAVORITE_LABEL)).not.toThrow();
  });
});
