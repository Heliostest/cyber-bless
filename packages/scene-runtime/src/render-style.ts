import * as THREE from "three";
import { BlendFunction, EffectComposer, EffectPass, OutlineEffect, RenderPass, ToneMappingEffect, ToneMappingMode, type Effect } from "postprocessing";
import type { RenderStyleId } from "@wbr/content";
import { createToonSurfaces } from "./toon-surfaces";
import { softenObjectLighting } from './icon-style';
import { createGouacheEffect } from "./gouache-effect";
import { createMoebiusEffect } from "./moebius-effect";
import { MoebiusNormals } from "./moebius-normals";
import { createHalftoneEffect } from "./halftone-effect";
import { PixelArtPass } from "./pixel-art-pass";
import { normalizeStyleParameters, type RenderStyleParameters } from "./render-style-parameters";
import { AdjustableOutlineEffect } from "./adjustable-outline-effect";
import { createGallerySurfaces, gallerySubjects, isGallerySurfaceStyle } from "./gallery-surfaces";
import { createGalleryEffect, isGalleryPostStyle } from "./gallery-effects";
import { createKomorebiGrade } from './komorebi-grade';
import type { EnvironmentTone } from './debug-environment-tone';

/** Shared material styling, color treatment and restrained contours. */
export function createRenderStyle(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, { sceneId = '' }: { sceneId?: string } = {}) {
  let active: RenderStyleId = "original";
  let environmentTone: EnvironmentTone = 'original';
  let composer: EffectComposer | undefined;
  let outline: OutlineEffect | undefined;
  let normals: MoebiusNormals | undefined;
  let surfaces: ReturnType<typeof createToonSurfaces> | undefined;
  let halftone: ReturnType<typeof createHalftoneEffect> | undefined;
  let pixels: PixelArtPass | undefined;
  let moebius: ReturnType<typeof createMoebiusEffect> | undefined;
  let gallerySurfaces: ReturnType<typeof createGallerySurfaces> | undefined;
  let galleryEffect: ReturnType<typeof createGalleryEffect> | undefined;
  let parameters = normalizeStyleParameters(undefined);
  let width = renderer.getSize(new THREE.Vector2()).width;
  let height = renderer.getSize(new THREE.Vector2()).height;

  function release() {
    outline?.selection.clear();
    composer?.dispose();
    surfaces?.dispose();
    gallerySurfaces?.dispose();
    composer = undefined;
    outline = undefined;
    normals = undefined;
    surfaces = undefined;
    halftone = undefined;
    pixels = undefined;
    moebius = undefined;
    gallerySurfaces = undefined;
    galleryEffect = undefined;
  }

  function setStyle(id: RenderStyleId) {
    if (active === id) return;
    release();
    active = id;
  }

  function prepare() {
    if (composer || active === "original" && environmentTone !== 'komorebi') return;
    composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 2 });
    function finish() {
      if (environmentTone === 'komorebi') composer!.addPass(new EffectPass(camera, createKomorebiGrade(!!scene.userData.environmentNight)));
      composer!.setSize(width, height);
    }
    function addTonePass(...effects: Effect[]) {
      // The source's daytime image processor clips and grades diffuse RGB;
      // applying ACES first changes both green hue and highlight saturation.
      if (environmentTone !== 'komorebi' || scene.userData.environmentNight)
        effects.unshift(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
      if (effects.length) composer!.addPass(new EffectPass(camera,...effects));
    }
    if (active === "pixel-art") {
      pixels = new PixelArtPass(scene,camera);
      composer.addPass(pixels);
      addTonePass();
      finish();
      return;
    }
    composer.addPass(new RenderPass(scene, camera));
    if (active === 'original') {
      addTonePass();
      finish(); return;
    }
    if (isGallerySurfaceStyle(active) || isGalleryPostStyle(active)) {
      if (isGallerySurfaceStyle(active)) gallerySurfaces = createGallerySurfaces(active);
      if (isGalleryPostStyle(active) && active !== "space-grade") {
        normals = new MoebiusNormals(scene, camera);
        composer.addPass(normals);
      }
      addTonePass();
      if (isGalleryPostStyle(active)) {
        galleryEffect = createGalleryEffect(active, normals?.target.texture ?? null, normals?.target.depthTexture ?? null, renderer.getPixelRatio());
        composer.addPass(new EffectPass(camera, galleryEffect.effect));
      }
      finish();
      return;
    }
    if (active === "halftone") {
      halftone = createHalftoneEffect(renderer.getPixelRatio());
      addTonePass();
      composer.addPass(new EffectPass(camera,halftone));
      finish();
      return;
    }
    surfaces = createToonSurfaces(active, sceneId);
    if (active === "moebius") {
      normals = new MoebiusNormals(scene, camera);
      composer.addPass(normals);
      addTonePass();
      moebius = createMoebiusEffect(normals.target.texture, normals.target.depthTexture!, renderer.getPixelRatio());
      composer.addPass(new EffectPass(camera, moebius));
      finish();
      return;
    }
    const Outline = active === "toon-outline" ? AdjustableOutlineEffect : OutlineEffect;
    outline = new Outline(scene, camera, {
      blendFunction: BlendFunction.ALPHA,
      visibleEdgeColor: active === "toon-outline" ? 0x252832 : active === "gouache" ? 0x53616a : 0x584235,
      hiddenEdgeColor: active === "toon-outline" ? 0x252832 : active === "gouache" ? 0x53616a : 0x584235,
      edgeStrength: active === "toon-outline" ? 3.0 : active === "toon-ink" ? 1.8 : active === "gouache" ? 0.22 : 0.18,
      resolutionScale: 1,
      xRay: false,
      multisampling: 2,
    });
    // Tone-map before compositing ink, so dark lines are not blown out by exposure.
    if (active === "gouache") {
      addTonePass();
      // Separate pass: the brush samples the tone-mapped image, not HDR input.
      composer.addPass(new EffectPass(camera, createGouacheEffect(), outline));
    } else addTonePass(outline);
    finish();
  }

  function resize(nextWidth: number, nextHeight: number) {
    width = nextWidth;
    height = nextHeight;
    composer?.setSize(width, height);
  }

  function render() {
    if (active === "original" && environmentTone !== 'komorebi') {
      renderer.render(scene, camera);
      return;
    }
    const previous = {
      target: renderer.getRenderTarget(),
      autoClear: renderer.autoClear,
      toneMapping: renderer.toneMapping,
      exposure: renderer.toneMappingExposure,
      color: renderer.getClearColor(new THREE.Color()),
      alpha: renderer.getClearAlpha(),
      shaderError: renderer.debug.onShaderError,
      background: scene.background,
      override: scene.overrideMaterial,
      cameraMask: camera.layers.mask,
      shadowEnabled: renderer.shadowMap.enabled,
      shadowAutoUpdate: renderer.shadowMap.autoUpdate,
      shadowType: renderer.shadowMap.type,
    };
    // Outline rendering changes visibility/layers internally. Restore even on a failed pass.
    const objects: [THREE.Object3D, boolean, number][] = [];
    scene.traverse((object) => objects.push([object, object.visible, object.layers.mask]));
    let frame: ReturnType<ReturnType<typeof createToonSurfaces>["apply"]> | undefined;
    let galleryFrame: ReturnType<ReturnType<typeof createGallerySurfaces>["apply"]> | undefined;
    let failed = false;
    let lights: ReturnType<typeof softenObjectLighting> | undefined;
    try {
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.debug.onShaderError = () => { failed = true; };
      prepare();
      if (gallerySurfaces) {
        gallerySurfaces.setParameters(parameters);
        galleryFrame = gallerySurfaces.apply(scene);
      }
      if (galleryEffect) {
        galleryEffect.update(parameters, renderer.getPixelRatio());
        normals?.selection.set(gallerySubjects(scene));
      }
      if (active === "toon-outline") {
        surfaces?.setColorLevels(parameters.toonLevels);
        outline!.uniforms.get("lineWidth")!.value = parameters.toonWidth;
      }
      frame = surfaces?.apply(scene);
      if (active === 'toon-soft' && (environmentTone !== 'komorebi' || scene.userData.environmentNight)) lights = softenObjectLighting(scene, sceneId);
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
      lights?.restore();
      galleryFrame?.restore();
      scene.background = previous.background;
      scene.overrideMaterial = previous.override;
      camera.layers.mask = previous.cameraMask;
      objects.forEach(([object, visible, mask]) => { object.visible = visible; object.layers.mask = mask; });
      renderer.setRenderTarget(previous.target);
      renderer.autoClear = previous.autoClear;
      renderer.toneMapping = previous.toneMapping;
      renderer.toneMappingExposure = previous.exposure;
      renderer.shadowMap.enabled = previous.shadowEnabled;
      renderer.shadowMap.autoUpdate = previous.shadowAutoUpdate;
      renderer.shadowMap.type = previous.shadowType;
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
    setEnvironmentTone(tone: EnvironmentTone) { if (tone === environmentTone) return; release(); environmentTone = tone; },
    setParameters(patch: Partial<RenderStyleParameters>) { parameters = normalizeStyleParameters(patch, parameters); },
    resize, render, dispose: release };
}
