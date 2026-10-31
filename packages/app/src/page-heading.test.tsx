// @vitest-environment jsdom
import { createRef, type CSSProperties } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { renderUI } from "./dom-test-utils";
import { PageTitle, useAppLayout } from "./page-heading";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("shows a complete long title without deriving its font size from character count", () => {
  const text = "Escreva um desejo de Tanabata";
  const ui = renderUI(<PageTitle title={text} />);
  const title = ui.host.querySelector("h1")!;
  expect(title.textContent).toBe(text);
  expect(title.style.getPropertyValue("--ribbon-letters")).toBe("");
  ui.unmount();
});

it("reserves the measured dock height and enables scene reflow when controls leave too little canvas", () => {
  vi.stubGlobal("innerHeight", 568);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    const dock = this.classList.contains("bottom-nav");
    const stage = this.classList.contains("library-scene-stage");
    const content = this.classList.contains("app-content");
    const width = 320, height = dock ? 120 : stage ? 100 : content ? 500 : 150;
    const top = dock ? 430 : content ? 68 : 0;
    return { left: 0, top, right: width, bottom: top + height, width, height, x: 0, y: top, toJSON() {} };
  });
  const shell = createRef<HTMLDivElement>();
  function Host() { useAppLayout(shell); return <div ref={shell} className="app-shell" data-immersive="true">
    <main className="app-content"><div className="scene-experience"><header /><div className="library-scene-stage" style={{ "--tray": "150px" } as CSSProperties} /><footer /></div></main>
    <nav className="bottom-nav" />
  </div>; }
  const ui = renderUI(<Host />);
  expect(parseFloat(shell.current!.style.getPropertyValue("--app-dock-space"))).toBeGreaterThanOrEqual(138);
  expect(shell.current!.dataset.layoutScroll).toBe("true");
  expect(parseFloat(shell.current!.style.getPropertyValue("--scene-min-canvas"))).toBeGreaterThanOrEqual(180);
  ui.unmount();
});

it("starts measuring when the app shell appears after asynchronous storage bootstrap", () => {
  const shell = createRef<HTMLDivElement>();
  function Host({ ready }: { ready: boolean }) {
    useAppLayout(shell);
    return ready ? <div ref={shell} className="app-shell"><nav className="bottom-nav" /></div> : <p>Loading</p>;
  }
  const ui = renderUI(<Host ready={false} />);
  ui.rerender(<Host ready />);
  expect(shell.current!.style.getPropertyValue("--app-dock-space")).not.toBe("");
  ui.unmount();
});

it("counts a card footer once when reserving the canvas in a short viewport", () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    const height = this.classList.contains("app-content") ? 450
      : this.classList.contains("scene-intention") ? 100 : 0;
    return { left: 0, top: 0, right: 320, bottom: height, width: 320, height } as DOMRect;
  });
  const shell = createRef<HTMLDivElement>();
  function Host() {
    useAppLayout(shell);
    return <div ref={shell} className="app-shell" data-immersive="true">
      <main className="app-content"><div className="scene-experience">
        <div className="scene-stage-card">
          <div className="library-scene-stage" style={{ "--tray": "132px" } as CSSProperties} />
          <aside className="scene-intention">A complete intention below the scene</aside>
        </div>
      </div></main>
    </div>;
  }
  const ui = renderUI(<Host />);
  expect(shell.current!.style.getPropertyValue("--scene-min-stage")).toBe("464px");
  expect(shell.current!.dataset.layoutScroll).toBe("true");
  ui.unmount();
});
