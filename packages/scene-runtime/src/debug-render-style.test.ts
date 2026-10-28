import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as THREE from "three";
import { DEFAULT_STYLE_PARAMETERS } from "./render-style-parameters";
import { createDebugRenderStyle } from "./debug-render-style";

const hooks = vi.hoisted(() => ({
  capture: vi.fn(() => "data:image/webp;base64,real"), prepare: vi.fn(), invalidate: vi.fn(),
  ready: Promise.resolve(), resolve: () => {}, render: vi.fn(), resize: vi.fn(), dispose: vi.fn(),
  refresh: vi.fn(), report: vi.fn(), register: vi.fn(),
}));
vi.mock("./style-preview-capture", () => ({ createStylePreviewCapture: vi.fn(() => hooks.capture) }));
vi.mock("./render-style", () => ({ createRenderStyle: () => ({
  setStyle: vi.fn(), setParameters: vi.fn(), getStyle: () => "toon-soft", render: hooks.render,
  resize: hooks.resize, dispose: vi.fn(),
}) }));
vi.mock("./interaction-cues", () => ({ createInteractionCues: () => ({ update: vi.fn(), dispose: vi.fn() }) }));
vi.mock("./cozy-environment", () => ({ createCozyEnvironment: () => ({
  kind: "garden", get ready() { return hooks.ready; }, prepare: hooks.prepare, dispose: vi.fn(),
}) }));
vi.mock("./debug-styles", () => ({ debugStyles: { register: hooks.register } }));

beforeEach(() => {
  vi.clearAllMocks();
  hooks.ready = new Promise<void>(resolve => { hooks.resolve = resolve; });
  hooks.register.mockReturnValue({ setDefault: vi.fn(), report: hooks.report, refreshPreviews: hooks.refresh, dispose: hooks.dispose });
});

function setup() {
  const renderer = { domElement: { dataset: {}, closest: () => undefined } } as unknown as THREE.WebGLRenderer;
  const style = createDebugRenderStyle(renderer, {} as THREE.Scene, {} as THREE.Camera, { id: "tea", label: "茶", invalidate: hooks.invalidate });
  const capture = hooks.register.mock.calls[0][4] as (id: string, parameters: typeof DEFAULT_STYLE_PARAMETERS) => string | null;
  return { style, capture };
}

describe("mounted renderer shader thumbnail readiness", () => {
  it("publishes capture readiness only after a completed frame and cancels it on disposal", () => {
    const ui = setup();
    expect(ui.capture("gouache", DEFAULT_STYLE_PARAMETERS)).toBeNull();
    expect(hooks.capture).not.toHaveBeenCalled(); expect(hooks.refresh).not.toHaveBeenCalled();
    ui.style.render(); expect(hooks.refresh).toHaveBeenCalledOnce();
    expect(ui.capture("gouache", DEFAULT_STYLE_PARAMETERS)).toBe("data:image/webp;base64,real");
    ui.style.render(); expect(hooks.refresh).toHaveBeenCalledOnce();
    ui.style.dispose(); ui.style.dispose();
    expect(ui.capture("gouache", DEFAULT_STYLE_PARAMETERS)).toBeNull();
    expect(hooks.dispose).toHaveBeenCalledOnce();
  });

  it("refreshes resized and asynchronously lit previews only after their next completed frame", async () => {
    const ui = setup(); ui.style.render();
    hooks.resolve(); await hooks.ready;
    expect(hooks.invalidate).toHaveBeenCalledOnce(); expect(hooks.refresh).toHaveBeenCalledOnce();
    ui.style.render(); expect(hooks.refresh).toHaveBeenCalledTimes(2);
    ui.style.resize(320, 568); expect(hooks.refresh).toHaveBeenCalledTimes(2);
    ui.style.render(); expect(hooks.refresh).toHaveBeenCalledTimes(3);
    ui.style.resize(320, 568); ui.style.render(); expect(hooks.refresh).toHaveBeenCalledTimes(3);
    ui.style.setStyle("toon-soft"); expect(hooks.refresh).toHaveBeenCalledTimes(3);
    ui.style.render(); expect(hooks.refresh).toHaveBeenCalledTimes(4);
    ui.style.dispose();
  });

  it("ignores a late lighting arrival after the renderer has gone away", async () => {
    const ui = setup(); ui.style.dispose();
    hooks.resolve(); await hooks.ready;
    expect(hooks.invalidate).not.toHaveBeenCalled(); expect(hooks.refresh).not.toHaveBeenCalled();
  });
});
