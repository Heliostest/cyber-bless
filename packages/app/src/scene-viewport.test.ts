// @vitest-environment jsdom
import { createElement, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderUI } from "./dom-test-utils";
import { useSceneViewport } from "./scene-viewport";

function Screen({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useSceneViewport(ref, active);
  return createElement("div", { ref });
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.removeAttribute("style");
  document.documentElement.removeAttribute("style");
});

describe("scene viewport", () => {
  it("locks the document only during an immersive route and restores previous styles", () => {
    document.body.style.overflow = "auto";
    document.documentElement.style.overscrollBehavior = "contain";
    const ui = renderUI(createElement(Screen, { active: false }));
    expect(document.body.style.overflow).toBe("auto");
    ui.rerender(createElement(Screen, { active: true }));
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overflow).toBe("hidden");
    ui.rerender(createElement(Screen, { active: false }));
    expect(document.body.style.overflow).toBe("auto");
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.documentElement.style.overscrollBehavior).toBe("contain");
    ui.unmount();
  });

  it("uses the visible keyboard viewport and restores height on keyboard dismissal", () => {
    const viewport = Object.assign(new EventTarget(), { height: 844 });
    vi.stubGlobal("visualViewport", viewport);
    const ui = renderUI(createElement(Screen, { active: true }));
    const shell = ui.host.firstElementChild as HTMLElement;
    expect(shell.style.getPropertyValue("--scene-viewport-height")).toBe("844px");
    viewport.height = 420;
    viewport.dispatchEvent(new Event("resize"));
    expect(shell.style.getPropertyValue("--scene-viewport-height")).toBe("420px");
    viewport.height = 844;
    viewport.dispatchEvent(new Event("resize"));
    expect(shell.style.getPropertyValue("--scene-viewport-height")).toBe("844px");
    ui.unmount();
    viewport.height = 500;
    viewport.dispatchEvent(new Event("resize"));
    expect(shell.style.getPropertyValue("--scene-viewport-height")).toBe("");
    expect(document.body.style.overflow).toBe("");
  });
});
