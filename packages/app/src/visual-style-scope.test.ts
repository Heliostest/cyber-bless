// @vitest-environment jsdom
import { act, createElement, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createState, reduce } from "@wbr/core";
import { sceneStyles } from "@wbr/scene-runtime/debug-styles";
import { Context, type AppContext } from "./context";
import { clickOn, renderUI, typeInto } from "./dom-test-utils";
import { useSceneVisualPreference } from "./scene-visual-preference";
import { dismissVisualStyleMenu, VisualStyleControl } from "./visual-style-menu";

afterEach(() => { vi.useRealTimers(); });

function setup(initial = createState()) {
  let saved = initial;
  const frames: Record<string, { style: string; pixelSize: number }> = {};
  function Scene({ id }: { id: string }) {
    const host = useRef<HTMLDivElement>(null);
    useSceneVisualPreference(id, () => {}, host);
    return createElement("div", { ref: host }, createElement(VisualStyleControl, { sceneId: id }));
  }
  function Harness() {
    const [state, setState] = useState(initial); saved = state;
    return createElement(Context.Provider, { value: {
      state, active: true, dispatch: action => { setState(previous => reduce(previous, action)); return true; },
    } as AppContext }, createElement("div", { className: "app-shell" },
      createElement(Scene, { id: "scope-tea" }), createElement(Scene, { id: "scope-crane" })));
  }
  const ui = renderUI(createElement(Harness));
  const shell = ui.host.querySelector<HTMLElement>(".app-shell")!;
  const registrations: ReturnType<typeof sceneStyles.register>[] = [];
  function register(id: string) {
    act(() => {
      const registration = sceneStyles.register(id, id === "scope-tea" ? "茶山一盏" : "纸鹤", (style, parameters) => {
        frames[id] = { style, pixelSize: parameters.pixelSize };
      }, shell);
      registration.setDefault("toon-soft"); registrations.push(registration);
    });
  }
  register("scope-tea");
  const trigger = ui.host.querySelector<HTMLButtonElement>('button[aria-label="视觉风格"]')!;
  clickOn(trigger);
  return {
    ...ui, shell, trigger, frames, register,
    state: () => saved,
    select(style: string) { clickOn(shell.querySelector(`[data-style="${style}"]`)!); },
    button(text: string) { return [...shell.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === text)!; },
    dispose() { ui.unmount(); act(() => { registrations.forEach(registration => registration.dispose()); }); },
  };
}

describe("visual style application scope", () => {
  it("previews a choice without saving and cancels only the confirmation on Escape or native back", () => {
    const ui = setup();
    try {
      const before = ui.state();
      ui.select("pixel-art");
      expect(ui.frames["scope-tea"].style).toBe("pixel-art");
      expect(ui.state()).toBe(before);
      expect(ui.shell.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe("应用视觉风格");
      expect(document.activeElement).toBe(ui.button("仅当前仪式"));
      act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
      expect(ui.frames["scope-tea"].style).toBe("toon-soft");
      expect(ui.state()).toBe(before);
      expect(ui.shell.querySelector('[role="dialog"][aria-label="视觉风格"]')).not.toBeNull();
      expect(document.activeElement).toBe(ui.shell.querySelector('[data-style="pixel-art"]'));
      ui.select("moebius");
      act(() => { expect(dismissVisualStyleMenu(ui.shell)).toBe(true); });
      expect(ui.frames["scope-tea"].style).toBe("toon-soft");
      expect(ui.shell.querySelector('[role="dialog"][aria-label="视觉风格"]')).not.toBeNull();
      act(() => { expect(dismissVisualStyleMenu(ui.shell)).toBe(true); });
      expect(ui.shell.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(ui.trigger);
    } finally { ui.dispose(); }
  });

  it("saves only this ritual when requested", () => {
    const ui = setup(); ui.register("scope-crane");
    try {
      ui.select("pixel-art"); clickOn(ui.button("仅当前仪式"));
      expect(ui.state().visualStyles?.["scope-tea"].style).toBe("pixel-art");
      expect(ui.frames["scope-crane"].style).toBe("toon-soft");
      clickOn(ui.button("完成"));
      expect(ui.frames["scope-tea"].style).toBe("pixel-art");
    } finally { ui.dispose(); }
  });

  it("applies to unopened renderers, keeps parameter edits in the chosen scope and allows a later local exception", () => {
    vi.useFakeTimers();
    const initial = reduce(createState(), { type: "scene.visual", id: "scope-crane", style: "moebius" });
    const ui = setup(initial);
    try {
      ui.select("pixel-art"); clickOn(ui.button("应用到全部仪式"));
      ui.register("scope-crane");
      expect(ui.frames["scope-crane"].style).toBe("pixel-art");
      const details = ui.shell.querySelector("details")!; details.open = true;
      typeInto(ui.shell.querySelector<HTMLInputElement>('input[type="range"]')!, "8");
      act(() => { vi.advanceTimersByTime(180); });
      expect(ui.frames["scope-crane"].pixelSize).toBe(8);
      expect(ui.state().visualStyles ?? {}).toEqual({});
      clickOn(ui.button("完成")); clickOn(ui.trigger);
      ui.select("moebius"); clickOn(ui.button("仅当前仪式"));
      expect(ui.frames["scope-tea"].style).toBe("moebius");
      expect(ui.frames["scope-crane"]).toEqual({ style: "pixel-art", pixelSize: 8 });
      clickOn(ui.button("完成"));
      expect(ui.frames["scope-tea"].style).toBe("moebius");
    } finally { ui.dispose(); }
  });

  it("restores this ritual's own default or all defaults according to the confirmation", () => {
    const ui = setup(); ui.register("scope-crane");
    try {
      ui.select("pixel-art"); clickOn(ui.button("应用到全部仪式"));
      clickOn(ui.button("恢复默认")); clickOn(ui.button("仅当前仪式"));
      expect(ui.frames["scope-tea"].style).toBe("toon-soft");
      expect(ui.frames["scope-crane"].style).toBe("pixel-art");
      clickOn(ui.button("完成"));
      expect(ui.frames["scope-tea"].style).toBe("toon-soft");
      clickOn(ui.trigger); clickOn(ui.button("恢复默认")); clickOn(ui.button("应用到全部仪式"));
      expect(ui.frames["scope-tea"].style).toBe("toon-soft");
      expect(ui.frames["scope-crane"].style).toBe("toon-soft");
      expect(ui.state().visualStyles ?? {}).toEqual({});
      expect(ui.shell.querySelector('[role="dialog"]')?.contains(document.activeElement)).toBe(true);
      expect(document.activeElement?.hasAttribute("disabled")).toBe(false);
    } finally { ui.dispose(); }
  });
});
