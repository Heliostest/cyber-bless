// @vitest-environment jsdom
import { act, createElement, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createState, reduce } from "@wbr/core";
import { sceneStyles } from "@wbr/scene-runtime/debug-styles";
import { Context, type AppContext } from "./context";
import { FeedbackControls } from "./feedback-controls";
import { dismissVisualStyleMenu } from "./visual-style-menu";
import { clickOn, renderUI, typeInto } from "./dom-test-utils";

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe("App visual style menu", () => {
  it("only offers visual settings when this ritual has a mounted renderer", () => {
    const ui = renderUI(createElement(Context.Provider, { value: { state: createState(), dispatch: () => true, canHaptic: true } as unknown as AppContext },
      createElement(FeedbackControls, { sceneId: "no-renderer" })));
    expect(ui.host.querySelector('button[aria-label="视觉风格"]')).toBeNull(); ui.unmount();
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
    const button = ui.host.querySelector<HTMLButtonElement>('button[aria-label="视觉风格"]')!;
    expect(button).not.toBeNull(); button.focus(); clickOn(button);
    expect(cancel).toHaveBeenCalledOnce();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-label="视觉风格"]')!;
    expect(dialog).not.toBeNull();
    clickOn(dialog.querySelector('[data-style="pixel-art"]')!);
    expect(rendered.at(-1)).toBe("pixel-art");
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
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
    expect(actions).toContainEqual(expect.objectContaining({ type: "scene.visual", id: "menu-test", style: "pixel-art", parameters: expect.objectContaining({ pixelSize: 9 }) }));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(button);
    clickOn(button);
    act(() => { expect(dismissVisualStyleMenu(scope)).toBe(true); });
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    ui.unmount(); registration!.dispose(); base!.dispose();
  });
});
