import * as THREE from "three";
import { BlendFunction, EffectComposer, EffectPass, OutlineEffect, RenderPass, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import type { RenderStyleId } from "@wbr/content";
import { createToonSurfaces } from "./toon-surfaces";
import { createGouacheEffect } from "./gouache-effect";
import { createMoebiusEffect } from "./moebius-effect";
import { MoebiusNormals } from "./moebius-normals";
import { createHalftoneEffect } from "./halftone-effect";
import { PixelArtPass } from "./pixel-art-pass";
import { normalizeStyleParameters, type RenderStyleParameters } from "./render-style-parameters";
import { AdjustableOutlineEffect } from "./adjustable-outline-effect";

/** Shared material styling, color treatment and restrained contours. */
export function createRenderStyle(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  let active: RenderStyleId = "original";
  let composer: EffectComposer | undefined;
  let outline: OutlineEffect | undefined;
  let normals: MoebiusNormals | undefined;
  let surfaces: ReturnType<typeof createToonSurfaces> | undefined;
  let halftone: ReturnType<typeof createHalftoneEffect> | undefined;
  let pixels: PixelArtPass | undefined;
  let moebius: ReturnType<typeof createMoebiusEffect> | undefined;
  let parameters = normalizeStyleParameters(undefined);
  let width = renderer.getSize(new THREE.Vector2()).width;
  let height = renderer.getSize(new THREE.Vector2()).height;

  function release() {
    outline?.selection.clear();
    composer?.dispose();
    surfaces?.dispose();
    composer = undefined;
    outline = undefined;
    normals = undefined;
    surfaces = undefined;
    halftone = undefined;
    pixels = undefined;
    moebius = undefined;
  }

  function setStyle(id: RenderStyleId) {
    if (active === id) return;
    release();
    active = id;
  }

  function prepare() {
    if (composer || active === "original") return;
    composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 2 });
    if (active === "pixel-art") {
      pixels = new PixelArtPass(scene,camera);
      composer.addPass(pixels);
      composer.addPass(new EffectPass(camera,new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })));
      composer.setSize(width,height);
      return;
    }
    composer.addPass(new RenderPass(scene, camera));
    if (active === "halftone") {
      halftone = createHalftoneEffect(renderer.getPixelRatio());
      composer.addPass(new EffectPass(camera,new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })));
      composer.addPass(new EffectPass(camera,halftone));
      composer.setSize(width,height);
      return;
    }
    surfaces = createToonSurfaces(active);
    if (active === "moebius") {
      normals = new MoebiusNormals(scene, camera);
      composer.addPass(normals);
      composer.addPass(new EffectPass(camera, new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC })));
      moebius = createMoebiusEffect(normals.target.texture, normals.target.depthTexture!, renderer.getPixelRatio());
      composer.addPass(new EffectPass(camera, moebius));
      composer.setSize(width, height);
      return;
    }
    const Outline = active === "toon-outline" ? AdjustableOutlineEffect : OutlineEffect;
    outline = new Outline(scene, camera, {
      blendFunction: BlendFunction.ALPHA,
      visibleEdgeColor: active === "toon-outline" ? 0x252832 : active === "gouache" ? 0x53616a : 0x584235,
      hiddenEdgeColor: active === "toon-outline" ? 0x252832 : active === "gouache" ? 0x53616a : 0x584235,
      edgeStrength: active === "toon-outline" ? 3.0 : active === "toon-ink" ? 1.8 : active === "gouache" ? 0.22 : 0.45,
      resolutionScale: 1,
      xRay: false,
      multisampling: 2,
    });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    // Tone-map before compositing ink, so dark lines are not blown out by exposure.
    if (active === "gouache") {
      composer.addPass(new EffectPass(camera, tone));
      // Separate pass: the brush samples the tone-mapped image, not HDR input.
      composer.addPass(new EffectPass(camera, createGouacheEffect(), outline));
    } else composer.addPass(new EffectPass(camera, tone, outline));
    composer.setSize(width, height);
  }

  function resize(nextWidth: number, nextHeight: number) {
    width = nextWidth;
    height = nextHeight;
    composer?.setSize(width, height);
  }

  function render() {
    if (active === "original") {
      renderer.render(scene, camera);
      return;
    }
    const previous = {
      target: renderer.getRenderTarget(),
      autoClear: renderer.autoClear,
      toneMapping: renderer.toneMapping,
      color: renderer.getClearColor(new THREE.Color()),
      alpha: renderer.getClearAlpha(),
      shaderError: renderer.debug.onShaderError,
      background: scene.background,
      override: scene.overrideMaterial,
      cameraMask: camera.layers.mask,
      shadowEnabled: renderer.shadowMap.enabled,
      shadowAutoUpdate: renderer.shadowMap.autoUpdate,
    };
    // Outline rendering changes visibility/layers internally. Restore even on a failed pass.
    const objects: [THREE.Object3D, boolean, number][] = [];
    scene.traverse((object) => objects.push([object, object.visible, object.layers.mask]));
    let frame: ReturnType<ReturnType<typeof createToonSurfaces>["apply"]> | undefined;
    let failed = false;
    try {
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.debug.onShaderError = () => { failed = true; };
      prepare();
      if (active === "toon-outline") {
        surfaces?.setColorLevels(parameters.toonLevels);
        outline!.uniforms.get("lineWidth")!.value = parameters.toonWidth;
      }
      frame = surfaces?.apply(scene);
      if (frame) { outline?.selection.set(frame.outlined); normals?.selection.set(frame.outlined); }
      if (halftone) {
        halftone.uniforms.get("pixelRatio")!.value = renderer.getPixelRatio();
        halftone.uniforms.get("pitch")!.value = parameters.halftoneSize;
        halftone.uniforms.get("strength")!.value = parameters.halftoneStrength;
      }
      if (pixels) pixels.pixelSize = parameters.pixelSize;
      if (moebius) {
        moebius.uniforms.get("pixelRatio")!.value = renderer.getPixelRatio();
        moebius.uniforms.get("lineWidth")!.value = parameters.moebiusWidth;
        moebius.uniforms.get("colorLevels")!.value = parameters.moebiusLevels;
        moebius.uniforms.get("hatchStrength")!.value = parameters.hatchStrength;
      }
      renderer.autoClear = false;
      composer!.render();
    } catch {
      failed = true;
    } finally {
      frame?.restore();
      scene.background = previous.background;
      scene.overrideMaterial = previous.override;
      camera.layers.mask = previous.cameraMask;
      objects.forEach(([object, visible, mask]) => { object.visible = visible; object.layers.mask = mask; });
      renderer.setRenderTarget(previous.target);
      renderer.autoClear = previous.autoClear;
      renderer.toneMapping = previous.toneMapping;
      renderer.shadowMap.enabled = previous.shadowEnabled;
      renderer.shadowMap.autoUpdate = previous.shadowAutoUpdate;
      renderer.setClearColor(previous.color, previous.alpha);
      renderer.debug.onShaderError = previous.shaderError;
    }
    if (failed) {
      setStyle("original");
      // Original materials are restored first: a genuine scene failure still reaches the host.
      renderer.render(scene, camera);
    }
  }

  return { setStyle, getStyle: () => active,
    setParameters(patch: Partial<RenderStyleParameters>) { parameters = normalizeStyleParameters(patch, parameters); },
    resize, render, dispose: release };
}
