import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { DEFAULT_STYLE_PARAMETERS } from "./render-style-parameters";
import { createStylePreviewCapture } from "./style-preview-capture";

const temporary = vi.hoisted(() => ({
  selected: "original", fallback: false, render: vi.fn(), dispose: vi.fn(), parameters: vi.fn(),
}));
vi.mock("./render-style", () => ({ createRenderStyle: vi.fn(() => ({
  setStyle: (value: string) => { temporary.selected = value; },
  getStyle: () => temporary.fallback ? "original" : temporary.selected,
  setParameters: temporary.parameters, render: temporary.render, dispose: temporary.dispose,
})) }));

beforeEach(() => {
  vi.clearAllMocks(); temporary.selected = "original"; temporary.fallback = false;
  temporary.render.mockReset(); temporary.dispose.mockReset();
});
afterEach(() => { vi.unstubAllGlobals(); });

function setup() {
  const state = {
    viewport: new THREE.Vector4(3, 4, 800, 600), scissor: new THREE.Vector4(5, 6, 700, 500),
    scissorTest: true, target: new THREE.WebGLRenderTarget(1, 1), color: new THREE.Color(0x123456), alpha: .4,
  };
  const originalError = vi.fn(), source = { width: 800, height: 600 };
  const renderer = {
    domElement: source, autoClear: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2,
    outputColorSpace: THREE.SRGBColorSpace, debug: { onShaderError: originalError }, xr: { enabled: true },
    shadowMap: { enabled: true, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap },
    getViewport: (value: THREE.Vector4) => value.copy(state.viewport), setViewport: (value: THREE.Vector4) => state.viewport.copy(value),
    getScissor: (value: THREE.Vector4) => value.copy(state.scissor), setScissor: (value: THREE.Vector4) => state.scissor.copy(value),
    getScissorTest: () => state.scissorTest, setScissorTest: (value: boolean) => { state.scissorTest = value; },
    getRenderTarget: () => state.target, setRenderTarget: vi.fn(), getActiveCubeFace: () => 2, getActiveMipmapLevel: () => 1,
    getClearColor: (value: THREE.Color) => value.copy(state.color), getClearAlpha: () => state.alpha,
    setClearColor: (value: THREE.Color, alpha: number) => { state.color.copy(value); state.alpha = alpha; },
    setSize: vi.fn(), setPixelRatio: vi.fn(),
  } as unknown as THREE.WebGLRenderer;
  const drawImage = vi.fn(), encode = vi.fn(() => "data:image/webp;base64,real-scene");
  const image = { width: 0, height: 0, getContext: () => ({ drawImage, clearRect: vi.fn() }), toDataURL: encode };
  vi.stubGlobal("document", { createElement: vi.fn(() => image) });
  const main = { getStyle: () => "toon-soft" as const, render: vi.fn() }, prepare = vi.fn();
  const capture = createStylePreviewCapture(renderer, new THREE.Scene(), new THREE.Camera(), main, prepare);
  return { state, renderer, source, drawImage, encode, image, main, prepare, capture, originalError };
}

describe("real scene shader thumbnail capture", () => {
  it("copies the actual rendered canvas without changing its proportions or the main pipeline", () => {
    const ui = setup();
    expect(ui.capture("gouache", { ...DEFAULT_STYLE_PARAMETERS, pixelSize: 7 })).toBe("data:image/webp;base64,real-scene");
    expect(ui.drawImage).toHaveBeenCalledWith(ui.source, 0, 0, 800, 600, 0, 0, 160, 120);
    expect(ui.image).toMatchObject({ width: 160, height: 120 });
    expect(ui.encode).toHaveBeenCalledWith("image/webp", .82);
    expect(temporary.parameters).toHaveBeenCalledWith(expect.objectContaining({ pixelSize: 7 }));
    expect(temporary.dispose).toHaveBeenCalledOnce();
    expect(ui.prepare.mock.calls.map(call => call[0])).toEqual(["gouache", "toon-soft"]);
    expect(ui.main.render).toHaveBeenCalledOnce();
    expect(ui.renderer.setSize).not.toHaveBeenCalled(); expect(ui.renderer.setPixelRatio).not.toHaveBeenCalled();
    expect(ui.source).toEqual({ width: 800, height: 600 });
  });

  it("fills the thumbnail with a centered crop of a tall camera frame instead of adding empty side bars", () => {
    const ui = setup(); ui.source.width = 400; ui.source.height = 800;
    ui.capture("pixel-art", { ...DEFAULT_STYLE_PARAMETERS });
    expect(ui.drawImage).toHaveBeenCalledWith(ui.source, 0, 0, 400, 800, 0, -100, 160, 320);
  });

  it("fills a wide frame without empty top and bottom bars or stretching", () => {
    const ui = setup(); ui.source.width = 1600; ui.source.height = 400;
    ui.capture("gouache", { ...DEFAULT_STYLE_PARAMETERS });
    expect(ui.drawImage).toHaveBeenCalledWith(ui.source, 0, 0, 1600, 400, -160, 0, 480, 120);
  });

  it.each(["render failure", "encoding failure", "shader fallback"])("restores all renderer state and the main frame after %s", failure => {
    const ui = setup(), viewport = ui.state.viewport.clone(), scissor = ui.state.scissor.clone();
    temporary.render.mockImplementation(() => {
      ui.renderer.autoClear = false; ui.renderer.toneMapping = THREE.NoToneMapping;
      ui.renderer.toneMappingExposure = 9; ui.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
      ui.renderer.shadowMap.enabled = false; ui.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      ui.renderer.shadowMap.autoUpdate = false; ui.renderer.shadowMap.needsUpdate = true;
      ui.state.viewport.set(0, 0, 1, 1); ui.state.scissor.set(0, 0, 1, 1);
      if (failure === "render failure") throw new Error("GPU unavailable");
    });
    if (failure === "encoding failure") ui.encode.mockImplementation(() => { throw new Error("canvas unreadable"); });
    if (failure === "shader fallback") temporary.fallback = true;
    expect(ui.capture("gouache", { ...DEFAULT_STYLE_PARAMETERS })).toBeNull();
    expect(ui.main.render).toHaveBeenCalledOnce(); expect(temporary.dispose).toHaveBeenCalledOnce();
    expect(ui.renderer).toMatchObject({ autoClear: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2,
      outputColorSpace: THREE.SRGBColorSpace, xr: { enabled: true },
      shadowMap: { enabled: true, autoUpdate: true, needsUpdate: false, type: THREE.PCFShadowMap } });
    expect(ui.state.viewport).toEqual(viewport); expect(ui.state.scissor).toEqual(scissor);
    expect(ui.state.scissorTest).toBe(true);
    expect(ui.renderer.setRenderTarget).toHaveBeenLastCalledWith(ui.state.target, 2, 1);
    expect(ui.renderer.debug.onShaderError).toBe(ui.originalError);
  });

  it("contains thumbnail shader errors without invoking the scene's fatal error callback", () => {
    const ui = setup();
    temporary.render.mockImplementation(() => ui.renderer.debug.onShaderError?.(null!, null!, null!, null!));
    expect(ui.capture("original", { ...DEFAULT_STYLE_PARAMETERS })).toBeNull();
    expect(ui.originalError).not.toHaveBeenCalled(); expect(ui.main.render).toHaveBeenCalledOnce();
  });
});
