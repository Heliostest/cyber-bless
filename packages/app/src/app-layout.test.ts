// @vitest-environment jsdom
import { createElement as h, useRef } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { renderUI } from "./dom-test-utils";
import { useAppLayout } from "./page-heading";

function Screen({ writing }: { writing: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useAppLayout(ref);
  return h("div", { ref, "data-immersive": "" },
    h("main", { className: "app-content" },
      h("div", { className: "scene-experience" },
        h("div", { className: "library-scene-stage" }),
        writing && h("div", { className: "scene-post-wish", style: { position: "absolute" } },
          h("form", null, h("input"))))));
}

afterEach(() => vi.restoreAllMocks());

it("keeps the wish editor inside the short viewport, then restores scene scrolling", () => {
  // The keyboard leaves 300px for content, less than the minimum scene stage.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    return { height: this.classList.contains("app-content") ? 300 : 44 } as DOMRect;
  });
  const ui = renderUI(h(Screen, { writing: false }));
  const shell = ui.host.firstElementChild!;
  expect(shell.hasAttribute("data-layout-scroll")).toBe(true);
  ui.rerender(h(Screen, { writing: true }));
  expect(shell.hasAttribute("data-layout-scroll")).toBe(false);
  ui.rerender(h(Screen, { writing: false }));
  expect(shell.hasAttribute("data-layout-scroll")).toBe(true);
  ui.unmount();
});

it('leaves the stable scene frame in its own scroller when supporting copy grows', () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return { height: this.classList.contains('app-content') ? 300 : 100 } as DOMRect;
  });
  function StableScreen({ text }: { text: string }) {
    const ref = useRef<HTMLDivElement>(null);
    useAppLayout(ref);
    return h('div', { ref, 'data-immersive': '' },
      h('main', { className: 'app-content' },
        h('section', { className: 'scene-experience', 'data-stable-stage': '' },
          h('div', { className: 'scene-stage-card' },
            h('div', { className: 'library-scene-stage' }),
            h('aside', { className: 'scene-intention' }, text)))));
  }
  const ui = renderUI(h(StableScreen, { text: 'Short instruction' }));
  expect(ui.host.firstElementChild!.hasAttribute('data-layout-scroll')).toBe(false);
  ui.rerender(h(StableScreen, { text: 'A longer translated instruction that needs its own scrolling area' }));
  expect(ui.host.firstElementChild!.hasAttribute('data-layout-scroll')).toBe(false);
  ui.unmount();
});
