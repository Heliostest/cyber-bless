// @vitest-environment jsdom
import { act, createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STYLE_PARAMETERS, visualStyleOptions } from "@wbr/core/visual-style";
import { sceneStyles } from "@wbr/scene-runtime/debug-styles";
import { renderUI } from "./dom-test-utils";
import { useVisualStyleThumbnails } from "./visual-style-thumbnails";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("current ritual shader thumbnails", () => {
  function setup() {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 16));
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    const scope = {}, capture = vi.fn((style: string, parameters: typeof DEFAULT_STYLE_PARAMETERS) => `data:image/png;base64,${style}:${parameters.pixelSize}`);
    const registration = sceneStyles.register("preview-test", "Preview", () => {}, scope, capture);
    registration.refreshPreviews();
    function Harness({ parameters = DEFAULT_STYLE_PARAMETERS }: { parameters?: typeof DEFAULT_STYLE_PARAMETERS }) {
      const scene = sceneStyles.getSnapshot().find(scene => scene.id === "preview-test" && scene.scope === scope)!;
      const images = useVisualStyleThumbnails(scene, parameters);
      return createElement("output", {}, JSON.stringify(images));
    }
    const ui = renderUI(createElement(Harness));
    return { ui, capture, registration, Harness, images: () => JSON.parse(ui.host.textContent!), dispose() { ui.unmount(); registration.dispose(); } };
  }

  it("renders each shader through the registered scene without changing its selected style", () => {
    const s = setup();
    try {
      const before = sceneStyles.getSnapshot();
      act(() => vi.advanceTimersByTime(1500));
      expect(s.capture).toHaveBeenCalledTimes(visualStyleOptions.length);
      expect(s.images()["pixel-art"]).toBe("data:image/png;base64,pixel-art:3");
      expect(sceneStyles.getSnapshot()).toBe(before);
    } finally { s.dispose(); }
  });

  it("refreshes only affected shader parameters and drops a replaced renderer's cached images", () => {
    const s = setup();
    try {
      act(() => vi.advanceTimersByTime(1500));
      s.capture.mockClear();
      const parameters = { ...DEFAULT_STYLE_PARAMETERS, pixelSize: 8 };
      s.ui.rerender(createElement(s.Harness, { parameters }));
      act(() => vi.advanceTimersByTime(1500));
      expect(s.capture).toHaveBeenCalledTimes(1);
      expect(s.images()["pixel-art"]).toBe("data:image/png;base64,pixel-art:8");
      s.capture.mockClear();
      act(() => s.registration.refreshPreviews());
      s.ui.rerender(createElement(s.Harness, { parameters }));
      expect(s.images()["pixel-art"]).toBeUndefined();
      act(() => vi.advanceTimersByTime(1500));
      expect(s.capture).toHaveBeenCalledTimes(visualStyleOptions.length);
    } finally { s.dispose(); }
  });


  it("cancels queued rendering immediately when the menu closes", () => {
    const s = setup();
    act(() => vi.advanceTimersByTime(20));
    expect(s.capture).toHaveBeenCalledTimes(1);
    s.ui.unmount();
    const count = s.capture.mock.calls.length;
    act(() => vi.advanceTimersByTime(1500));
    expect(s.capture).toHaveBeenCalledTimes(count);
    s.registration.dispose();
  });
});
