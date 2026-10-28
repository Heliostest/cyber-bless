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
      state, active: true, dispatch: action => {
        const next = reduce(state, action);
        if (next === state) return false;
        setState(next); return true;
      },
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

  it("closes Done after browsing back to the saved style without a state change", () => {
    const initial = reduce(createState(), { type: "scene.visual", id: "scope-tea", style: "pixel-art", parameters: { pixelSize: 7 } });
    const ui = setup(initial);
    try {
      ui.select("moebius"); ui.select("pixel-art");
      expect(ui.frames["scope-tea"]).toEqual({ style: "pixel-art", pixelSize: 7 });
      clickOn(ui.button("完成"));
      expect(ui.state()).toBe(initial);
      expect(ui.shell.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(ui.trigger);
    } finally { ui.dispose(); }
  });

  it("closes Done when applying an unchanged global preference with no local overrides", () => {
    const initial = reduce(createState(), { type: "scene.visual.all", style: "pixel-art", parameters: { pixelSize: 7 } });
    const ui = setup(initial);
    try {
      clickOn(ui.button("应用到全部仪式"));
      clickOn(ui.button("完成"));
      expect(ui.state()).toBe(initial);
      expect(ui.shell.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(ui.trigger);
    } finally { ui.dispose(); }
  });

  it("previews successive cards in one dialog and writes only when Done is pressed", () => {
    const ui = setup(); ui.register("scope-crane");
    try {
      const before = ui.state();
      expect(ui.button("仅当前仪式").getAttribute("aria-pressed")).toBe("true");
      ui.select("pixel-art");
      expect(ui.frames["scope-tea"].style).toBe("pixel-art");
      expect(ui.state()).toBe(before);
      expect(ui.shell.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe("视觉风格");
      ui.select("moebius");
      expect(ui.frames["scope-tea"].style).toBe("moebius");
      expect(ui.frames["scope-crane"].style).toBe("toon-soft");
      expect(ui.state()).toBe(before);
      clickOn(ui.button("完成"));
      expect(ui.state().visualStyles?.["scope-tea"].style).toBe("moebius");
      expect(ui.shell.querySelector('[role="dialog"]')).toBeNull();
      expect(ui.frames["scope-tea"].style).toBe("moebius");
      expect(document.activeElement).toBe(ui.trigger);
    } finally { ui.dispose(); }
  });

  it("previews the card nearest the scrolling center without saving or showing confirmation", () => {
    const ui = setup();
    try {
      const before = ui.state(), strip = ui.shell.querySelector<HTMLElement>(".visual-style-filmstrip")!;
      const cards = [...strip.querySelectorAll<HTMLElement>("button[data-style]")];
      Object.defineProperties(strip, { clientWidth: { value: 300 }, scrollWidth: { value: 1070 } });
      Object.defineProperty(strip, "scrollTo", { value: ({ left }: ScrollToOptions) => { strip.scrollLeft = left ?? 0; } });
      cards.forEach((card, index) => Object.defineProperties(card, {
        offsetLeft: { value: 102 + index * 110 }, offsetWidth: { value: 96 },
      }));
      for (const index of [2, 5, 6, 1]) {
        act(() => { strip.scrollLeft = index * 110; strip.dispatchEvent(new Event("scroll", { bubbles: true })); });
        expect(cards[index].getAttribute("aria-pressed")).toBe("true");
        expect(ui.frames["scope-tea"].style).toBe(cards[index].dataset.style);
        expect(ui.state()).toBe(before);
        expect(ui.shell.querySelector('[role="dialog"]')?.getAttribute("aria-label")).toBe("视觉风格");
      }
      clickOn(ui.button("完成"));
      expect(ui.state().visualStyles?.["scope-tea"].style).toBe("original");
    } finally { ui.dispose(); }
  });

  it.each(["Escape", "native", "outside", "close"])("discards draft styles and parameters on %s", dismissal => {
    const ui = setup();
    try {
      const before = ui.state();
      ui.select("pixel-art");
      const details = ui.shell.querySelector("details")!; details.open = true;
      typeInto(ui.shell.querySelector<HTMLInputElement>('input[type="range"]')!, "8");
      expect(ui.frames["scope-tea"]).toEqual({ style: "pixel-art", pixelSize: 8 });
      expect(ui.state()).toBe(before);
      act(() => { document.dispatchEvent(new Event("visibilitychange")); window.dispatchEvent(new Event("pagehide")); });
      expect(ui.state()).toBe(before);
      if (dismissal === "Escape") act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
      else if (dismissal === "native") act(() => { expect(dismissVisualStyleMenu(ui.shell)).toBe(true); });
      else if (dismissal === "outside") clickOn(ui.shell.querySelector(".visual-style-backdrop")!);
      else clickOn(ui.shell.querySelector('[data-visual-style-close]')!);
      expect(ui.shell.querySelector('[role="dialog"]')).toBeNull();
      expect(ui.frames["scope-tea"].style).toBe("toon-soft");
      expect(ui.state()).toBe(before);
      expect(document.activeElement).toBe(ui.trigger);
    } finally { ui.dispose(); }
  });

  it("keeps global scope and parameter edits as a local preview until Done, then permits a local exception", () => {
    const initial = reduce(createState(), { type: "scene.visual", id: "scope-crane", style: "moebius" });
    const ui = setup(initial);
    try {
      ui.select("pixel-art"); clickOn(ui.button("应用到全部仪式"));
      ui.register("scope-crane");
      expect(ui.button("应用到全部仪式").getAttribute("aria-pressed")).toBe("true");
      expect(ui.frames["scope-crane"].style).toBe("moebius");
      const details = ui.shell.querySelector("details")!; details.open = true;
      typeInto(ui.shell.querySelector<HTMLInputElement>('input[type="range"]')!, "8");
      expect(ui.frames["scope-tea"]).toEqual({ style: "pixel-art", pixelSize: 8 });
      expect(ui.frames["scope-crane"].style).toBe("moebius");
      expect(ui.state()).toBe(initial);
      clickOn(ui.button("完成"));
      expect(ui.frames["scope-crane"]).toEqual({ style: "pixel-art", pixelSize: 8 });
      expect(ui.state().visualStyles ?? {}).toEqual({});
      clickOn(ui.trigger);
      ui.select("moebius");
      expect(ui.button("仅当前仪式").getAttribute("aria-pressed")).toBe("true");
      clickOn(ui.button("完成"));
      expect(ui.frames["scope-tea"].style).toBe("moebius");
      expect(ui.frames["scope-crane"]).toEqual({ style: "pixel-art", pixelSize: 8 });
    } finally { ui.dispose(); }
  });

  it("restores a saved style and its parameters when closing an unsaved preview", () => {
    const initial = reduce(createState(), { type: "scene.visual", id: "scope-tea", style: "pixel-art", parameters: { pixelSize: 7 } });
    const ui = setup(initial);
    try {
      ui.select("moebius");
      expect(ui.frames["scope-tea"].style).toBe("moebius");
      clickOn(ui.shell.querySelector('[data-visual-style-close]')!);
      expect(ui.frames["scope-tea"]).toEqual({ style: "pixel-art", pixelSize: 7 });
      expect(ui.state()).toBe(initial);
    } finally { ui.dispose(); }
  });

  it("never writes an unsaved draft when the scene host unmounts", () => {
    const initial = reduce(createState(), { type: "scene.visual", id: "scope-tea", style: "pixel-art", parameters: { pixelSize: 7 } });
    const ui = setup(initial);
    ui.select("moebius");
    expect(ui.frames["scope-tea"].style).toBe("moebius");
    ui.dispose();
    expect(ui.state()).toBe(initial);
    // Both scene preference owners are disposed with the host; the renderer
    // falls back to its content default without writing a replacement save.
    expect(ui.frames["scope-tea"].style).toBe("toon-soft");
  });

  it("previews resets and saves local defaults or all defaults only on Done", () => {
    const initial = reduce(createState(), { type: "scene.visual.all", style: "pixel-art" });
    const ui = setup(initial); ui.register("scope-crane");
    try {
      clickOn(ui.button("恢复默认"));
      expect(ui.frames["scope-tea"].style).toBe("toon-soft");
      expect(ui.frames["scope-crane"].style).toBe("pixel-art");
      expect(ui.state()).toBe(initial);
      clickOn(ui.button("完成"));
      expect(ui.frames["scope-tea"].style).toBe("toon-soft");
      expect(ui.frames["scope-crane"].style).toBe("pixel-art");
      expect(ui.state().visualStyles?.["scope-tea"].style).toBe("toon-soft");
      const locallyReset = ui.state();
      clickOn(ui.trigger); clickOn(ui.button("恢复默认")); clickOn(ui.button("应用到全部仪式"));
      expect(ui.state()).toBe(locallyReset);
      expect(ui.frames["scope-crane"].style).toBe("pixel-art");
      clickOn(ui.button("完成"));
      expect(ui.frames["scope-tea"].style).toBe("toon-soft");
      expect(ui.frames["scope-crane"].style).toBe("toon-soft");
      expect(ui.state().visualStyles ?? {}).toEqual({});
      expect(ui.state().globalVisualStyle).toBeUndefined();
    } finally { ui.dispose(); }
  });

  it("leaves an untouched local menu alone and can apply its default to all on Done", () => {
    const ui = setup();
    try {
      const before = ui.state();
      clickOn(ui.button("完成"));
      expect(ui.state()).toBe(before);
      clickOn(ui.trigger); clickOn(ui.button("应用到全部仪式"));
      expect(ui.state()).toBe(before);
      clickOn(ui.button("完成"));
      expect(ui.state().globalVisualStyle?.style).toBe("toon-soft");
    } finally { ui.dispose(); }
  });
});
