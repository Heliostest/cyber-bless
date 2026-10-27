// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createState, reduce } from "@wbr/core";
import { sceneStyles } from "@wbr/scene-runtime/debug-styles";
import { Context, type AppContext } from "./context";
import { FeedbackControls, dismissFeedbackMenu } from "./feedback-controls";
import { dismissVisualStyleMenu, VisualStyleControl } from "./visual-style-menu";
import { clickOn, renderUI, typeInto } from "./dom-test-utils";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("App visual style menu", () => {
  it("notifies a parent before focusing the portal and leaves an existing body lock alone", () => {
    const changed = vi.fn(), focusStates: boolean[] = [];
    let childOpen = false;
    const onOpenChange = (open: boolean) => { childOpen = open; changed(open); };
    const ui = renderUI(createElement(Context.Provider, { value: {
      state: createState(), dispatch: () => true,
    } as unknown as AppContext }, createElement("div", { className: "app-shell" },
      createElement(VisualStyleControl, { sceneId: "nested-menu", onOpenChange }))));
    const scope = ui.host.querySelector<HTMLElement>(".app-shell")!;
    let registration: ReturnType<typeof sceneStyles.register>;
    act(() => { registration = sceneStyles.register("nested-menu", "茶山一盏", () => {}, scope); });
    document.body.style.overflow = "hidden";
    const onFocus = (event: FocusEvent) => {
      if ((event.target as HTMLElement).closest('.visual-style-menu')) focusStates.push(childOpen);
    };
    document.addEventListener("focusin", onFocus, true);
    clickOn(ui.host.querySelector('button[aria-label="视觉风格"]')!);
    expect(changed).toHaveBeenLastCalledWith(true);
    expect(focusStates.length).toBeGreaterThan(0);
    expect(focusStates.every(Boolean)).toBe(true);
    // Simulate the outer viewport releasing its own lock before this child unmounts.
    document.body.style.overflow = "auto";
    ui.unmount();
    expect(changed).toHaveBeenLastCalledWith(false);
    expect(document.body.style.overflow).toBe("auto");
    document.removeEventListener("focusin", onFocus, true);
    document.body.style.removeProperty("overflow");
    registration!.dispose();
  });
  it("only offers visual settings when this ritual has a mounted renderer", () => {
    const ui = renderUI(createElement(Context.Provider, { value: { state: createState(), dispatch: () => true, canHaptic: true } as unknown as AppContext },
      createElement(FeedbackControls, { sceneId: "no-renderer" })));
    expect(ui.host.querySelector('button[aria-label="视觉风格"]')).toBeNull(); ui.unmount();
  });

  it.each(["outside", "native"])("returns control to the settings menu after its renderer disappears (%s dismissal)", dismissal => {
    const state = createState(); state.settings.reducedMotion = true;
    const underneath = vi.fn();
    const ui = renderUI(createElement(Context.Provider, { value: {
      state, canHaptic: true, dispatch: () => true,
    } as unknown as AppContext }, createElement("div", { className: "app-shell" },
      createElement(FeedbackControls, { sceneId: "renderer-disconnect" }),
      createElement("button", { className: "underneath", onClick: underneath }, "场景操作"))));
    const scope = ui.host.querySelector<HTMLElement>(".app-shell")!;
    const gear = scope.querySelector<HTMLButtonElement>('button[aria-label="仪式设置"]')!;
    let registration: ReturnType<typeof sceneStyles.register> | undefined;
    try {
      act(() => { registration = sceneStyles.register("renderer-disconnect", "茶山一盏", () => {}, scope); });
      clickOn(gear);
      expect(scope.querySelector('.feedback-controls-options')?.getAttribute("aria-hidden")).toBe("false");
      clickOn(scope.querySelector('button[aria-label="视觉风格"]')!);
      expect(scope.querySelector('[role="dialog"][aria-label="视觉风格"]')).not.toBeNull();

      act(() => { registration!.dispose(); });
      expect(scope.querySelector('[role="dialog"][aria-label="视觉风格"]')).toBeNull();
      expect(gear.getAttribute("aria-expanded")).toBe("true");
      if (dismissal === "native") {
        act(() => { expect(dismissFeedbackMenu(scope)).toBe(true); });
      } else {
        const outside = scope.querySelector<HTMLButtonElement>(".underneath")!;
        act(() => outside.dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true })));
        clickOn(outside);
        expect(underneath).not.toHaveBeenCalled();
      }
      expect(gear.getAttribute("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(gear);

      act(() => { registration = sceneStyles.register("renderer-disconnect", "茶山一盏", () => {}, scope); });
      expect(scope.querySelector('[role="dialog"][aria-label="视觉风格"]')).toBeNull();
      clickOn(gear);
      expect(scope.querySelector('[role="dialog"][aria-label="视觉风格"]')).toBeNull();
      clickOn(scope.querySelector('button[aria-label="视觉风格"]')!);
      expect(scope.querySelector('[role="dialog"][aria-label="视觉风格"]')).not.toBeNull();
    } finally {
      ui.unmount(); registration?.dispose();
    }
  });

  it("previews without debug mode, saves per ritual, flushes slider edits on Escape and restores focus", () => {
    vi.useFakeTimers();
    const rendered: string[] = [], actions: unknown[] = [], cancel = vi.fn();
    function Harness() {
      const [state, setState] = useState(createState());
      return createElement(Context.Provider, { value: { state, canHaptic: true, dispatch: action => {
        actions.push(action); setState(previous => reduce(previous, action)); return true;
      } } as AppContext }, createElement("div", { className: "app-shell" }, createElement(FeedbackControls, { sceneId: "menu-test" })));
    }
    const ui = renderUI(createElement(Harness));
    const scope = ui.host.querySelector<HTMLElement>(".app-shell")!;
    let base: ReturnType<typeof sceneStyles.connectUserPreference>;
    let registration: ReturnType<typeof sceneStyles.register>;
    act(() => { base = sceneStyles.connectUserPreference("menu-test", null, cancel, scope); registration = sceneStyles.register("menu-test", "茶山一盏", style => rendered.push(style), scope); registration.setDefault("toon-soft"); });
    clickOn(ui.host.querySelector('button[aria-label="仪式设置"]')!);
    const button = ui.host.querySelector<HTMLButtonElement>('button[aria-label="视觉风格"]')!;
    expect(button).not.toBeNull(); button.focus(); clickOn(button);
    expect(cancel).toHaveBeenCalledOnce();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-label="视觉风格"]')!;
    expect(dialog).not.toBeNull();
    clickOn(dialog.querySelector('[data-style="pixel-art"]')!);
    expect(rendered.at(-1)).toBe("pixel-art");
    expect(actions).toHaveLength(0);
    clickOn(dialog.querySelector('.visual-style-scope-current')!);
    expect(actions).toContainEqual(expect.objectContaining({ type: "scene.visual", id: "menu-test", style: "pixel-art" }));
    const details = dialog.querySelector("details")!; details.open = true;
    const slider = dialog.querySelector<HTMLInputElement>('input[type="range"]')!;
    expect(slider.min).toBe("1"); expect(slider.max).toBe("12");
    const count = actions.length;
    typeInto(slider, "8");
    expect(actions).toHaveLength(count);
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(actions).toContainEqual(expect.objectContaining({ parameters: expect.objectContaining({ pixelSize: 8 }) }));
    hidden.mockReturnValue(false);
    typeInto(slider, "7");
    act(() => { window.dispatchEvent(new Event("pagehide")); });
    expect(actions).toContainEqual(expect.objectContaining({ parameters: expect.objectContaining({ pixelSize: 7 }) }));
    typeInto(slider, "9");
    act(() => { expect(dismissVisualStyleMenu(document.createElement("div"))).toBe(false); });
    expect(document.querySelector('[role="dialog"][aria-label="视觉风格"]')).not.toBeNull();
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(actions).toContainEqual(expect.objectContaining({ type: "scene.visual", id: "menu-test", style: "pixel-art", parameters: expect.objectContaining({ pixelSize: 9 }) }));
    expect(document.querySelector('[role="dialog"][aria-label="视觉风格"]')).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(ui.host.querySelector('button[aria-label="仪式设置"]')?.getAttribute('aria-pressed')).toBe('true');
    clickOn(button);
    act(() => { expect(dismissVisualStyleMenu(scope)).toBe(true); });
    expect(document.querySelector('[role="dialog"][aria-label="视觉风格"]')).toBeNull();
    act(() => { expect(dismissFeedbackMenu(scope)).toBe(true); });
    expect(ui.host.querySelector('button[aria-label="仪式设置"]')?.getAttribute('aria-expanded')).toBe('false');
    ui.unmount(); registration!.dispose(); base!.dispose();
  });
});
