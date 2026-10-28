import * as THREE from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRenderStyle } from "./render-style";

const hooks = vi.hoisted(() => ({ passes: [] as any[], render: vi.fn(), dispose: vi.fn(), size: vi.fn() }));
vi.mock("postprocessing", async importOriginal => {
  const original = await importOriginal<typeof import("postprocessing")>();
  return { ...original,
    EffectComposer: class {
      constructor() { hooks.passes = []; }
      addPass(pass: unknown) { hooks.passes.push(pass); }
      setSize = hooks.size;
      render = hooks.render;
      dispose() { hooks.dispose(); for (const pass of hooks.passes) pass.dispose?.(); }
    },
    EffectPass: class { constructor(_camera: unknown, ...effects: unknown[]) { this.effects = effects; } effects: any[]; dispose() { this.effects.forEach(e => e.dispose()); } },
  };
});

function setup() {
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const material = new THREE.MeshStandardMaterial({ color: "#b46137" });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material); scene.add(mesh);
  const target = new THREE.WebGLRenderTarget(64, 64);
  const renderer = {
    getSize: (value: THREE.Vector2) => value.set(320, 480), getPixelRatio: () => 2,
    getRenderTarget: () => target, setRenderTarget: vi.fn(),
    getClearColor: (value: THREE.Color) => value.set("#182433"), getClearAlpha: () => .6,
    setClearColor: vi.fn(), autoClear: true, toneMapping: THREE.ACESFilmicToneMapping,
    debug: { onShaderError: undefined }, shadowMap: { enabled: true, autoUpdate: true }, render: vi.fn(),
  } as unknown as THREE.WebGLRenderer;
  return { style: createRenderStyle(renderer, scene, camera), renderer, material, mesh, scene, target };
}
beforeEach(() => { vi.clearAllMocks(); hooks.passes = []; hooks.render.mockReset(); });

describe("Gallery styles in the shared renderer", () => {
  it.each([
    ["sketch-contour", "GallerySketch"], ["gallery-outline", "GalleryOutline"],
    ["depth-rim", "GalleryDepthRim"], ["space-grade", "GallerySpaceGrade"],
  ] as const)("selects %s without falling back or stacking the old outline", (id, effectName) => {
    const { style, mesh, material } = setup(); style.setStyle(id as never); style.render();
    const effects = hooks.passes.flatMap(pass => pass.effects ?? []);
    expect(effects.map(effect => effect.name)).toContain(effectName);
    expect(effects.some(effect => effect.name.includes("Outline") && effect.name !== effectName)).toBe(false);
    expect(style.getStyle()).toBe(id); expect(mesh.material).toBe(material);
    style.dispose();
  });

  it("updates rim parameters, retains CSS sizing and releases the previous pipeline", () => {
    const { style } = setup(); style.setStyle("depth-rim" as never); style.render();
    const effect = hooks.passes.flatMap(pass => pass.effects ?? []).find(effect => effect.name === "GalleryDepthRim");
    expect(effect).toBeDefined();
    style.setParameters({ rimWidth: 6, rimStrength: .4, rimDirection: 180 } as never); style.resize(390, 844); style.render();
    expect(effect.uniforms.get("lineWidth").value).toBe(6);
    expect(effect.uniforms.get("strength").value).toBe(.4);
    expect(effect.uniforms.get("direction").value).toBe(180);
    expect(effect.uniforms.get("pixelRatio").value).toBe(2);
    expect(hooks.size).toHaveBeenLastCalledWith(390, 844);
    style.setStyle("original"); expect(hooks.dispose).toHaveBeenCalledOnce(); style.dispose();
    expect(hooks.dispose).toHaveBeenCalledOnce();
  });

  it("restores authored materials and renderer state before fallback on a failed frame", () => {
    const { style, mesh, material, renderer, target } = setup();
    hooks.render.mockImplementationOnce(() => { throw new Error("GPU unavailable"); });
    style.setStyle("gallery-toon" as never); style.render();
    expect(mesh.material).toBe(material); expect(style.getStyle()).toBe("original");
    expect(renderer.render).toHaveBeenCalledOnce(); expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(target);
    expect(renderer.autoClear).toBe(true); expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping);
    expect(renderer.debug.onShaderError).toBeUndefined(); style.dispose();
  });
});
