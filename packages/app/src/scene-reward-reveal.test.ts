// @vitest-environment jsdom
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderUI } from "./dom-test-utils";
import { SceneRewardReveal } from "./scene-reward-reveal";

const mounted: ReturnType<typeof renderUI>[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  mounted.splice(0).forEach(ui => ui.unmount());
  vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren();
});
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
function mount(sceneId = "puerto-rican-guiro", reducedMotion = false) {
  const ui = renderUI(createElement(SceneRewardReveal, { sceneId, reducedMotion }));
  mounted.push(ui);
  return { ...ui, reveal: () => document.querySelector<HTMLElement>(".scene-reward-reveal") };
}

describe("completed scene keepsake reveal", () => {
  it("shows the existing scene icon as a decorative, noninteractive foreground layer", () => {
    const ui = mount(), reveal = ui.reveal()!;
    expect(reveal).not.toBeNull(); expect(reveal.getAttribute("aria-hidden")).toBe("true");
    expect(reveal.querySelector('.scene-art[data-scene="puerto-rican-guiro"] .scene-icon')).not.toBeNull();
    expect(reveal.querySelector("button,input,a,[tabindex]")).toBeNull();
    expect(reveal.dataset.phase).toBe("appear");
  });

  it.each([false, true])("keeps its actual CSS inert and its first frame intentional, reduced=%s", reduced => {
    const style = document.createElement("style");
    style.textContent = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "scene-reward-reveal.css"), "utf8");
    document.head.append(style);
    try {
      const ui = mount("puerto-rican-guiro", reduced), reveal = ui.reveal()!;
      expect(getComputedStyle(reveal).position).toBe("absolute");
      for (const el of [reveal, ...reveal.querySelectorAll("*")]) expect(getComputedStyle(el).pointerEvents).toBe("none");
      expect(getComputedStyle(reveal.querySelector(".scene-reward-reveal__item")!).opacity).toBe(reduced ? "1" : "0");
    } finally { style.remove(); }
  });

  it("allows a gentle arrival, a long visible hover and an upward exit before removing itself", () => {
    const ui = mount();
    advance(699); expect(ui.reveal()?.dataset.phase).toBe("appear");
    advance(1); expect(ui.reveal()?.dataset.phase).toBe("hold");
    advance(2499); expect(ui.reveal()?.dataset.phase).toBe("hold");
    advance(1); expect(ui.reveal()?.dataset.phase).toBe("leave");
    advance(799); expect(ui.reveal()).not.toBeNull();
    advance(1); expect(ui.reveal()).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps a static visible keepsake briefly when motion is reduced", () => {
    const ui = mount("spanish-castanets", true);
    expect(ui.reveal()?.dataset.reduced).toBe("true");
    expect(ui.reveal()?.dataset.phase).toBe("hold");
    advance(1999); expect(ui.reveal()).not.toBeNull();
    advance(1); expect(ui.reveal()).toBeNull();
  });

  it("also honors the system motion preference", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const ui = mount(); expect(ui.reveal()?.dataset.reduced).toBe("true");
    advance(2000); expect(ui.reveal()).toBeNull();
  });

  it("moves to the nearest app shell without using another rendered app's shell", () => {
    const unrelated = document.createElement("div"); unrelated.className = "app-shell"; document.body.append(unrelated);
    const ui = renderUI(createElement("div", { className: "app-shell", "data-current": "" },
      createElement("main", null, createElement(SceneRewardReveal, { sceneId: "tibetan-wheel" })),
      createElement("button", null, "collect")));
    mounted.push(ui);
    const shell = ui.host.querySelector('[data-current]')!, reveal = shell.querySelector(".scene-reward-reveal")!;
    expect(reveal).not.toBeNull(); expect(reveal.parentElement).toBe(shell);
    expect(shell.querySelector("main .scene-reward-reveal")).toBeNull();
    expect(unrelated.querySelector(".scene-reward-reveal")).toBeNull();
  });

  it("does not restart when the completed host rerenders with the same scene", () => {
    const ui = mount(); advance(2100);
    ui.rerender(createElement(SceneRewardReveal, { sceneId: "puerto-rican-guiro" }));
    expect(ui.reveal()?.dataset.phase).toBe("hold");
    advance(1900); expect(ui.reveal()).toBeNull();
    ui.rerender(createElement(SceneRewardReveal, { sceneId: "puerto-rican-guiro" }));
    expect(ui.reveal()).toBeNull();
  });

  it("can stop spatial motion immediately when the in-app preference changes", () => {
    const ui = mount(); advance(900);
    ui.rerender(createElement(SceneRewardReveal, { sceneId: "puerto-rican-guiro", reducedMotion: true }));
    expect(ui.reveal()?.dataset.reduced).toBe("true"); expect(ui.reveal()?.dataset.phase).toBe("hold");
    advance(2000); expect(ui.reveal()).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  });

  it("does not show a finished reveal again when motion preferences change", () => {
    const ui = mount(); advance(4000);
    ui.rerender(createElement(SceneRewardReveal, { sceneId: "puerto-rican-guiro", reducedMotion: true }));
    expect(ui.reveal()).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  });

  it("uses a fresh reveal and cancels the old scene's pending exit when the scene changes", () => {
    const ui = mount(); advance(1000);
    ui.rerender(createElement(SceneRewardReveal, { sceneId: "spanish-castanets" }));
    expect(ui.reveal()?.querySelector('.scene-art[data-scene="spanish-castanets"]')).not.toBeNull();
    expect(ui.reveal()?.dataset.phase).toBe("appear");
    advance(3000); expect(ui.reveal()?.dataset.phase).toBe("hold");
    advance(1000); expect(ui.reveal()).toBeNull(); expect(vi.getTimerCount()).toBe(0);
  });

  it("clears pending work and removes a portalled keepsake when unmounted", () => {
    const ui = renderUI(createElement("div", { className: "app-shell" },
      createElement(SceneRewardReveal, { sceneId: "chinese-rattle-drum" })));
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    ui.unmount(); expect(document.querySelector(".scene-reward-reveal")).toBeNull();
    expect(vi.getTimerCount()).toBe(0); advance(10000);
  });

  it("can render its first decorative frame without a mounted shell", () => {
    const markup = renderToStaticMarkup(createElement(SceneRewardReveal, { sceneId: "woodfish" }));
    expect(markup).toContain('class="scene-reward-reveal"'); expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('data-scene="woodfish"'); expect(vi.getTimerCount()).toBe(0);
  });
});
