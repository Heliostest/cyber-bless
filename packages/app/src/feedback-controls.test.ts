// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createState, reduce } from "@wbr/core";
import { sceneStyles } from "@wbr/scene-runtime/debug-styles";
import { assertSafeCopy } from "@wbr/shared";
import { Context, type AppContext } from "./context";
import { clickOn, renderUI } from "./dom-test-utils";
import { dismissFeedbackMenu, FeedbackControls } from "./feedback-controls";
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
      const buttons = new DOMParser().parseFromString(html, "text/html").querySelectorAll('.feedback-controls-options button[aria-pressed]');
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

const mounted: ReturnType<typeof renderUI>[] = [];
const registrations: ReturnType<typeof sceneStyles.register>[] = [];
afterEach(() => {
  mounted.splice(0).forEach(ui => ui.unmount());
  registrations.splice(0).forEach(registration => registration.dispose());
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
function mountSettings({ canHaptic = true, reducedMotion = false, renderer = false } = {}) {
  const actions: unknown[] = [], underlying = vi.fn();
  function Harness() {
    const initial = createState(); initial.settings.reducedMotion = reducedMotion;
    const [state, setState] = useState(initial);
    return createElement(Context.Provider, { value: { state, canHaptic, dispatch: action => {
      actions.push(action); setState(previous => reduce(previous, action)); return true;
    } } as AppContext }, createElement("div", { className: "app-shell" },
      createElement(FeedbackControls, { sceneId: "feedback-menu-test" }),
      createElement("button", { className: "underlying", onPointerDown: underlying, onPointerUp: underlying,
        onPointerCancel: underlying, onClick: underlying }, "场景操作")));
  }
  const ui = renderUI(createElement(Harness)); mounted.push(ui);
  const scope = ui.host.querySelector<HTMLElement>(".app-shell")!;
  if (renderer) act(() => {
    registrations.push(sceneStyles.register("feedback-menu-test", "茶山一盏", () => {}, scope));
  });
  return { ...ui, actions, underlying, scope,
    gear: ui.host.querySelector<HTMLButtonElement>('button[aria-label="仪式设置"]')!,
    outside: ui.host.querySelector<HTMLButtonElement>(".underlying")! };
}
const key = (value: string, shiftKey = false) => act(() => document.dispatchEvent(
  new KeyboardEvent("keydown", { key: value, shiftKey, bubbles: true, cancelable: true })));

describe("scene settings menu", () => {
  it("starts with one gear control and keeps its settings mounted but inaccessible until opened", () => {
    const ui = mountSettings();
    expect(ui.gear).not.toBeNull();
    expect(ui.gear.getAttribute("aria-expanded")).toBe("false");
    expect(ui.gear.getAttribute("aria-pressed")).toBe("false");
    const options = ui.host.querySelector<HTMLElement>(".feedback-controls-options")!;
    expect(options.getAttribute("aria-hidden")).toBe("true");
    expect(options.hasAttribute("inert")).toBe(true);
    expect(options.querySelectorAll("button")).toHaveLength(2);
    ui.gear.focus(); clickOn(ui.gear);
    expect(ui.gear.getAttribute("aria-expanded")).toBe("true");
    expect(ui.gear.getAttribute("aria-pressed")).toBe("true");
    expect(options.getAttribute("aria-hidden")).toBe("false");
    expect(options.hasAttribute("inert")).toBe(false);
  });

  it.each([true, false])("preserves sound and supported haptic toggle dispatch (%s)", canHaptic => {
    const ui = mountSettings({ canHaptic }); clickOn(ui.gear);
    const sound = ui.host.querySelector<HTMLButtonElement>('button[aria-label="音效"]')!;
    const soundBefore = sound.getAttribute("aria-pressed") === "true";
    clickOn(sound);
    expect(ui.actions.at(-1)).toEqual({ type: "settings", key: "sound", value: !soundBefore });
    expect(sound.getAttribute("aria-pressed")).toBe(String(!soundBefore));
    const haptic = ui.host.querySelector<HTMLButtonElement>('button[aria-label="震动"]');
    expect(!!haptic).toBe(canHaptic);
    if (haptic) {
      const hapticBefore = haptic.getAttribute("aria-pressed") === "true"; clickOn(haptic);
      expect(ui.actions.at(-1)).toEqual({ type: "settings", key: "haptics", value: !hapticBefore });
    }
    expect(ui.gear.getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on an outside gesture, blocks its click and continues shielding the closing shell", () => {
    vi.useFakeTimers(); const ui = mountSettings(); clickOn(ui.gear);
    act(() => ui.outside.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true })));
    clickOn(ui.outside);
    expect(ui.gear.getAttribute("aria-expanded")).toBe("false");
    expect(ui.underlying).not.toHaveBeenCalled();
    clickOn(ui.outside); expect(ui.underlying).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(421));
    clickOn(ui.outside); expect(ui.underlying).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(ui.gear);
  });

  it("swallows the closing gesture click when reduced motion removes the transition immediately", () => {
    const ui = mountSettings({ reducedMotion: true }); clickOn(ui.gear);
    act(() => ui.outside.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true })));
    clickOn(ui.outside);
    expect(ui.underlying).not.toHaveBeenCalled();
    expect(ui.gear.getAttribute("aria-expanded")).toBe("false");
    act(() => ui.outside.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true })));
    clickOn(ui.outside); expect(ui.underlying).toHaveBeenCalledTimes(2);
  });

  it.each([true, false])("keeps the entire closing pointer gesture away from the scene (reduced motion: %s)", reducedMotion => {
    const ui = mountSettings({ reducedMotion }); clickOn(ui.gear);
    act(() => {
      ui.outside.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
      ui.outside.dispatchEvent(new Event("pointerup", { bubbles: true, cancelable: true }));
    });
    clickOn(ui.outside); expect(ui.underlying).not.toHaveBeenCalled();
  });

  it("blocks cancellation of the outside gesture and releases the next gesture with reduced motion", () => {
    const ui = mountSettings({ reducedMotion: true }); clickOn(ui.gear);
    act(() => {
      ui.outside.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
      ui.outside.dispatchEvent(new Event("pointercancel", { bubbles: true, cancelable: true }));
    });
    expect(ui.underlying).not.toHaveBeenCalled();
    act(() => ui.outside.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true })));
    clickOn(ui.outside); expect(ui.underlying).toHaveBeenCalledTimes(2);
  });

  it("cycles Tab within the visible controls and restores the gear on Escape or attempted outside focus", () => {
    const ui = mountSettings(); ui.gear.focus(); clickOn(ui.gear);
    const sound = ui.host.querySelector<HTMLButtonElement>('button[aria-label="音效"]')!;
    const haptic = ui.host.querySelector<HTMLButtonElement>('button[aria-label="震动"]')!;
    key("Tab"); expect(document.activeElement).toBe(sound);
    key("Tab"); expect(document.activeElement).toBe(haptic);
    key("Tab"); expect(document.activeElement).toBe(ui.gear);
    key("Tab", true); expect(document.activeElement).toBe(haptic);
    act(() => ui.outside.focus()); expect(document.activeElement).toBe(ui.gear);
    key("Escape"); expect(document.activeElement).toBe(ui.gear);
    expect(ui.gear.getAttribute("aria-expanded")).toBe("false");
  });

  it("handles scoped native dismissal before and throughout closing without affecting a different App", () => {
    vi.useFakeTimers(); const ui = mountSettings(); clickOn(ui.gear);
    act(() => { expect(dismissFeedbackMenu(document.createElement("div"))).toBe(false); });
    expect(ui.gear.getAttribute("aria-expanded")).toBe("true");
    act(() => { expect(dismissFeedbackMenu(ui.scope)).toBe(true); });
    expect(ui.gear.getAttribute("aria-expanded")).toBe("false");
    act(() => { expect(dismissFeedbackMenu(ui.scope)).toBe(true); vi.advanceTimersByTime(421); });
    act(() => { expect(dismissFeedbackMenu(ui.scope)).toBe(false); });
  });

  it("reverses quickly within the same shell and never removes its existing setting controls", () => {
    vi.useFakeTimers(); const ui = mountSettings(), shell = ui.host.querySelector(".feedback-controls");
    const sound = ui.host.querySelector('button[aria-label="音效"]');
    clickOn(ui.gear); act(() => vi.advanceTimersByTime(140)); clickOn(ui.gear);
    act(() => vi.advanceTimersByTime(140)); clickOn(ui.gear); act(() => vi.advanceTimersByTime(500));
    expect(ui.gear.getAttribute("aria-pressed")).toBe("true");
    expect(ui.host.querySelector(".feedback-controls")).toBe(shell);
    clickOn(ui.gear); act(() => vi.advanceTimersByTime(500));
    expect(ui.host.querySelector('button[aria-label="音效"]')).toBe(sound);
    expect(ui.host.querySelector("[data-feedback-present]")).toBeNull();
  });

  it("leaves document body scroll styles untouched and releases capture handlers on unmount", () => {
    const overflow = document.body.style.overflow, padding = document.body.style.paddingRight;
    const ui = mountSettings(); clickOn(ui.gear);
    expect(document.body.style.overflow).toBe(overflow); expect(document.body.style.paddingRight).toBe(padding);
    const outside = document.createElement("button"), clicked = vi.fn(); outside.addEventListener("click", clicked); document.body.append(outside);
    ui.unmount(); mounted.splice(mounted.indexOf(ui), 1); clickOn(outside);
    expect(clicked).toHaveBeenCalledOnce(); outside.remove();
  });

  it("honors both the App and live system reduced motion preferences", () => {
    let changed: (() => void) | undefined;
    const query = { matches: false, addEventListener: (_: string, fn: () => void) => { changed = fn; }, removeEventListener: vi.fn() };
    vi.stubGlobal("matchMedia", vi.fn(() => query));
    const app = mountSettings({ reducedMotion: true });
    expect(app.host.querySelector(".feedback-controls")?.getAttribute("data-reduced-motion")).toBe("true");
    app.unmount(); mounted.splice(mounted.indexOf(app), 1);
    const ui = mountSettings(); clickOn(ui.gear);
    act(() => { query.matches = true; changed?.(); });
    expect(ui.host.querySelector(".feedback-controls")?.getAttribute("data-reduced-motion")).toBe("true");
    clickOn(ui.gear); expect(ui.host.querySelector("[data-feedback-present]")).toBeNull();
  });

  it("lets its portaled visual dialog own outside clicks, Escape and focus, then resumes the open menu", () => {
    const ui = mountSettings({ renderer: true }); clickOn(ui.gear);
    const visual = ui.host.querySelector<HTMLButtonElement>('button[aria-label="视觉风格"]')!;
    expect(visual).not.toBeNull(); visual.focus(); clickOn(visual);
    const dialog = ui.scope.querySelector<HTMLElement>('[role="dialog"][aria-label="视觉风格"]')!;
    expect(dialog).not.toBeNull();
    expect(document.activeElement).toBe(dialog.querySelector('button[aria-label="关闭视觉风格"]'));
    clickOn(dialog.querySelector('[data-style="pixel-art"]')!);
    expect(dialog.getAttribute("aria-label")).toBe("视觉风格");
    expect(ui.actions.filter(action => action.type === "scene.visual")).toHaveLength(0);
    key("Tab"); expect(dialog.contains(document.activeElement)).toBe(true);
    key("Escape"); expect(ui.scope.querySelector('[role="dialog"][aria-label="视觉风格"]')).toBeNull();
    expect(document.activeElement).toBe(visual);
    expect(ui.gear.getAttribute("aria-expanded")).toBe("true");
    expect(ui.actions.filter(action => action.type === "scene.visual")).toHaveLength(0);
    clickOn(visual);
    const reopened = ui.scope.querySelector<HTMLElement>('[role="dialog"][aria-label="视觉风格"]')!;
    clickOn(reopened.querySelector('[data-style="pixel-art"]')!);
    clickOn(reopened.querySelector('.visual-style-done')!);
    expect(ui.actions.at(-1)).toEqual(expect.objectContaining({ type: "scene.visual", style: "pixel-art" }));
    expect(document.activeElement).toBe(visual);
    key("Escape"); expect(ui.gear.getAttribute("aria-expanded")).toBe("false");
  });
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
