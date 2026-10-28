import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { DEFAULT_STYLE_PARAMETERS } from "./render-style-parameters";
import { createDebugRenderStyle } from "./debug-render-style";
import { createCozyEnvironment } from "./cozy-environment";
import { captureSceneImage } from "./scene-capture";

const hooks = vi.hoisted(() => ({
  capture: vi.fn(() => "data:image/webp;base64,real"), prepare: vi.fn(), invalidate: vi.fn(),
  ready: Promise.resolve(), resolve: () => {}, render: vi.fn(), resize: vi.fn(), dispose: vi.fn(),
  refresh: vi.fn(), report: vi.fn(), register: vi.fn(), setDefault: vi.fn(),
}));
vi.mock("./style-preview-capture", () => ({ createStylePreviewCapture: vi.fn(() => hooks.capture) }));
vi.mock("./render-style", () => ({ createRenderStyle: () => ({
  setStyle: vi.fn(), setParameters: vi.fn(), getStyle: () => "toon-soft", render: hooks.render,
  resize: hooks.resize, dispose: vi.fn(),
}) }));
vi.mock("./interaction-cues", () => ({ createInteractionCues: () => ({ update: vi.fn(), dispose: vi.fn() }) }));
vi.mock("./cozy-environment", () => ({ createCozyEnvironment: vi.fn(() => ({
  kind: "garden", get ready() { return hooks.ready; }, prepare: hooks.prepare, dispose: vi.fn(),
})) }));
vi.mock("./debug-styles", () => ({ debugStyles: { register: hooks.register } }));

beforeEach(() => {
  vi.clearAllMocks();
  hooks.ready = new Promise<void>(resolve => { hooks.resolve = resolve; });
  hooks.register.mockReturnValue({ setDefault: hooks.setDefault, report: hooks.report, refreshPreviews: hooks.refresh, dispose: hooks.dispose });
});

function setup(objectPresentation = false) {
  const renderer = { domElement: { width: 800, height: 600, matches: (selector: string) => selector === "canvas",
    toDataURL: () => "data:image/png;base64,c2NlbmU=", dataset: {}, closest: (selector: string) =>
    objectPresentation && selector === '[data-scene-presentation="object"]' ? {} : undefined } } as unknown as THREE.WebGLRenderer;
  const style = createDebugRenderStyle(renderer, new THREE.Scene(), new THREE.Camera(), { id: "tea", label: "茶", invalidate: hooks.invalidate });
  const capture = hooks.register.mock.calls[0][4] as (id: string, parameters: typeof DEFAULT_STYLE_PARAMETERS) => string | null;
  return { style, capture, renderer };
}

describe("mounted renderer shader thumbnail readiness", () => {
  it("exports a current scene frame only after readiness and unregisters it before renderer teardown", () => {
    const ui = setup(), canvas = ui.renderer.domElement;
    expect(captureSceneImage(canvas)).toBeUndefined();
    ui.style.render();
    const renderedBefore = hooks.render.mock.calls.length;
    expect(captureSceneImage(canvas)).toBe("data:image/png;base64,c2NlbmU=");
    expect(hooks.render.mock.calls.length).toBe(renderedBefore + 1);
    expect(hooks.prepare).toHaveBeenLastCalledWith(ui.renderer, "toon-soft", { advanceMotion: false });
    ui.style.dispose();
    expect(captureSceneImage(canvas)).toBeUndefined();
    expect(hooks.render.mock.calls.length).toBe(renderedBefore + 1);
  });

  it.each([["normal scene", false, 1], ["inline object", true, 0]] as const)("%s keeps the expected environment lifecycle and default shading", async (_label, objectPresentation, environmentCalls) => {
    const ui = setup(objectPresentation);
    expect(createCozyEnvironment).toHaveBeenCalledTimes(environmentCalls);
    expect(hooks.setDefault).toHaveBeenCalledWith("toon-soft");
    ui.style.render();
    expect(hooks.render).toHaveBeenCalledOnce();
    expect(hooks.prepare).toHaveBeenCalledTimes(environmentCalls);
    hooks.resolve(); await hooks.ready;
    expect(hooks.invalidate).toHaveBeenCalledTimes(environmentCalls);
    ui.style.dispose();
  });

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
