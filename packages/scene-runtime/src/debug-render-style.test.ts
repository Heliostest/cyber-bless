import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { DEFAULT_STYLE_PARAMETERS } from "./render-style-parameters";
import { createDebugRenderStyle } from "./debug-render-style";
import { createCozyEnvironment } from "./cozy-environment";
import { captureSceneImage } from "./scene-capture";
import { createInteractionCues } from "./interaction-cues";
import { createStylePreviewCapture } from "./style-preview-capture";

const hooks = vi.hoisted(() => ({
  capture: vi.fn(() => "data:image/webp;base64,real"), prepare: vi.fn(), invalidate: vi.fn(),
  ready: Promise.resolve(), resolve: () => {}, render: vi.fn(), resize: vi.fn(), dispose: vi.fn(),
  refresh: vi.fn(), report: vi.fn(), register: vi.fn(), setDefault: vi.fn(),
  cueUpdate: vi.fn(), cueRender: vi.fn(), cueDispose: vi.fn(),
}));
vi.mock("./style-preview-capture", () => ({ createStylePreviewCapture: vi.fn(() => hooks.capture) }));
vi.mock("./render-style", () => ({ createRenderStyle: () => ({
  setStyle: vi.fn(), setParameters: vi.fn(), getStyle: () => "toon-soft", render: hooks.render,
  resize: hooks.resize, dispose: vi.fn(),
}) }));
vi.mock("./interaction-cues", () => ({ createInteractionCues: vi.fn(() => ({
  update: hooks.cueUpdate, render: hooks.cueRender, dispose: hooks.cueDispose,
})) }));
vi.mock("./cozy-environment", () => ({ createCozyEnvironment: vi.fn(() => ({
  kind: "garden", get ready() { return hooks.ready; }, prepare: hooks.prepare, dispose: vi.fn(),
})) }));
vi.mock("./debug-styles", () => ({ debugStyles: { register: hooks.register } }));

beforeEach(() => {
  vi.clearAllMocks();
  hooks.render.mockReset(); hooks.cueUpdate.mockReset(); hooks.cueRender.mockReset();
  hooks.ready = new Promise<void>(resolve => { hooks.resolve = resolve; });
  hooks.register.mockReturnValue({ setDefault: hooks.setDefault, report: hooks.report, refreshPreviews: hooks.refresh, dispose: hooks.dispose });
});

function setup(objectPresentation = false) {
  const encode = vi.fn(() => "data:image/png;base64,c2NlbmU=");
  const renderer = { domElement: { width: 800, height: 600, matches: (selector: string) => selector === "canvas",
    toDataURL: encode, dataset: {}, closest: (selector: string) =>
    objectPresentation && selector === '[data-scene-presentation="object"]' ? {} : undefined } } as unknown as THREE.WebGLRenderer;
  const scene = new THREE.Scene(), camera = new THREE.Camera();
  const style = createDebugRenderStyle(renderer, scene, camera, { id: "tea", label: "茶", invalidate: hooks.invalidate });
  const capture = hooks.register.mock.calls[0][4] as (id: string, parameters: typeof DEFAULT_STYLE_PARAMETERS) => string | null;
  const redraw = vi.mocked(createInteractionCues).mock.calls[0][3]!;
  return { style, capture, renderer, scene, camera, encode, redraw };
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

describe("scene cue drawing and capture isolation", () => {
  it("updates cues before the world, then draws them with the owner's camera layers restored", () => {
    const ui = setup(), order: string[] = [];
    ui.camera.layers.enable(31);
    const originalMask = ui.camera.layers.mask;
    hooks.cueUpdate.mockImplementation(() => order.push("update"));
    hooks.render.mockImplementation(() => {
      expect(ui.camera.layers.isEnabled(0)).toBe(true);
      expect(ui.camera.layers.isEnabled(31)).toBe(false);
      order.push("world");
    });
    hooks.cueRender.mockImplementation(renderer => {
      expect(renderer).toBe(ui.renderer);
      expect(ui.camera.layers.mask).toBe(originalMask);
      order.push("cue");
    });
    ui.style.render();
    expect(order).toEqual(["update", "world", "cue"]);
    expect(ui.camera.layers.mask).toBe(originalMask);
    ui.style.dispose();
  });

  it("restores camera layers when the world render fails and does not draw cues over that failed frame", () => {
    const ui = setup();
    ui.camera.layers.enable(31);
    const originalMask = ui.camera.layers.mask;
    hooks.render.mockImplementation(() => { throw Error("GPU unavailable"); });
    expect(() => ui.style.render()).toThrow("GPU unavailable");
    expect(ui.camera.layers.mask).toBe(originalMask);
    expect(hooks.cueRender).not.toHaveBeenCalled();
    expect(ui.capture("gouache", DEFAULT_STYLE_PARAMETERS)).toBeNull();
    ui.style.dispose();
  });

  it.each([false, true])("keeps cues out of the encoded share and restores them afterward (private writing: %s)", privateWriting => {
    const ui = setup(), order: string[] = [];
    const writing = new THREE.Object3D(); writing.userData.privateShare = true;
    if (privateWriting) ui.scene.add(writing);
    let cuesDrawn = false;
    hooks.render.mockImplementation(() => { cuesDrawn = false; order.push("world"); });
    hooks.cueRender.mockImplementation(() => { cuesDrawn = true; order.push("cue"); });
    ui.style.render(); order.length = 0;
    ui.encode.mockImplementation(() => {
      expect(cuesDrawn).toBe(false);
      if (privateWriting) expect(writing.visible).toBe(false);
      order.push("encode");
      return "data:image/png;base64,c2NlbmU=";
    });
    expect(captureSceneImage(ui.renderer.domElement)).toBe("data:image/png;base64,c2NlbmU=");
    expect(order).toEqual(privateWriting ? ["world", "encode", "world", "cue"] : ["world", "encode", "cue"]);
    expect(cuesDrawn).toBe(true); expect(writing.visible).toBe(true);
    expect(hooks.prepare).toHaveBeenLastCalledWith(ui.renderer, "toon-soft", { advanceMotion: false });
    ui.style.dispose();
  });

  it("restores the on-screen cue pass even when share encoding fails", () => {
    const ui = setup(), order: string[] = [];
    ui.style.render();
    hooks.render.mockImplementation(() => order.push("world"));
    hooks.cueRender.mockImplementation(() => order.push("cue"));
    ui.encode.mockImplementation(() => { order.push("encode"); throw Error("unreadable canvas"); });
    expect(captureSceneImage(ui.renderer.domElement)).toBeUndefined();
    expect(order).toEqual(["world", "encode", "cue"]);
    ui.style.dispose();
  });

  it("gives thumbnail capture a full main-frame redraw so it restores the cue pass", () => {
    const ui = setup(), order: string[] = [];
    ui.style.render();
    const main = vi.mocked(createStylePreviewCapture).mock.calls[0][3];
    expect(main.getStyle()).toBe("toon-soft");
    hooks.render.mockImplementation(() => order.push("world"));
    hooks.cueRender.mockImplementation(() => order.push("cue"));
    main.render();
    expect(order).toEqual(["world", "cue"]);
    ui.style.dispose();
  });

  it("redraws static cue changes only after readiness and stops late callbacks after disposal", () => {
    const ui = setup(), order: string[] = [];
    expect(ui.redraw).toBeTypeOf("function");
    ui.redraw();
    expect(hooks.cueUpdate).not.toHaveBeenCalled(); expect(hooks.render).not.toHaveBeenCalled();
    ui.style.render();
    hooks.prepare.mockClear();
    hooks.cueUpdate.mockImplementation(() => order.push("update"));
    hooks.render.mockImplementation(() => order.push("world"));
    hooks.cueRender.mockImplementation(() => order.push("cue"));
    ui.redraw();
    expect(order).toEqual(["update", "world", "cue"]);
    for (const call of hooks.prepare.mock.calls) expect(call[2]).toEqual({ advanceMotion: false });
    ui.style.dispose(); order.length = 0; hooks.prepare.mockClear();
    ui.redraw();
    expect(order).toEqual([]); expect(hooks.prepare).not.toHaveBeenCalled();
    expect(hooks.cueDispose).toHaveBeenCalledOnce();
  });
});
