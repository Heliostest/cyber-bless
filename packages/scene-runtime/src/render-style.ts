import * as THREE from "three";
import { BlendFunction, BloomEffect, EffectComposer, EffectPass, OutlineEffect, RenderPass, ToneMappingEffect, ToneMappingMode, type Effect } from "postprocessing";
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

const BLOOM_DAY_OPTIONS = {
  blendFunction: BlendFunction.ADD,
  mipmapBlur: true,
  luminanceThreshold: 1.01,
  luminanceSmoothing: 0.20,
  intensity: 0.16,
  levels: 4,
  radius: 0.62,
} as const;

const BLOOM_NIGHT_OPTIONS = {
  blendFunction: BlendFunction.ADD,
  mipmapBlur: true,
  luminanceThreshold: 0.78,
  luminanceSmoothing: 0.26,
  intensity: 0.44,
  levels: 4,
  radius: 0.68,
} as const;

const GOVERNOR_MAX_ACTIVE_DT_MS = 120;
const GOVERNOR_EMA_ALPHA = 0.2;
const GOVERNOR_DOWNGRADE_MS = 25;
const GOVERNOR_DOWNGRADE_FRAMES = 24;
const GOVERNOR_RECOVER_MS = 17;
const GOVERNOR_RECOVER_FRAMES = 45;
const GOVERNOR_RAMP_STEP = 0.12;

/** Shared material styling, color treatment and restrained contours. */
export function createRenderStyle(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, { sceneId = '' }: { sceneId?: string } = {}) {
  let active: RenderStyleId = "original";
  let environmentTone: EnvironmentTone = 'original';
  let composer: EffectComposer | undefined;
  let bloom: BloomEffect | undefined;
  let bloomBaseIntensity = 0;
  let preparedNight = false;
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

  // Lightweight, zero-allocation mobile frame-time governor for continuous rendering.
  let lastFrameTime = 0;
  let hasActiveSample = false;
  let avgFrameMs = 16.67;
  let slowStreak = 0;
  let fastStreak = 0;
  let bloomGovernorTarget = 1;
  let bloomScale = 1;

  function resetGovernor() {
    lastFrameTime = 0;
    hasActiveSample = false;
    avgFrameMs = 16.67;
    slowStreak = 0;
    fastStreak = 0;
    bloomGovernorTarget = 1;
    bloomScale = 1;
  }

  function updateBloomGovernor() {
    if (!bloom) return;
    const now = performance.now();
    if (lastFrameTime > 0) {
      const dt = now - lastFrameTime;
      if (dt > 0 && dt <= GOVERNOR_MAX_ACTIVE_DT_MS) {
        if (!hasActiveSample) {
          avgFrameMs = dt;
          hasActiveSample = true;
        } else {
          avgFrameMs += (dt - avgFrameMs) * GOVERNOR_EMA_ALPHA;
        }
        if (avgFrameMs > GOVERNOR_DOWNGRADE_MS) {
          slowStreak++;
          fastStreak = 0;
          if (slowStreak >= GOVERNOR_DOWNGRADE_FRAMES) bloomGovernorTarget = 0;
        } else if (avgFrameMs < GOVERNOR_RECOVER_MS) {
          fastStreak++;
          slowStreak = 0;
          if (fastStreak >= GOVERNOR_RECOVER_FRAMES) bloomGovernorTarget = 1;
        } else {
          slowStreak = 0;
          fastStreak = 0;
        }
        if (bloomScale !== bloomGovernorTarget) {
          bloomScale = bloomScale > bloomGovernorTarget
            ? Math.max(bloomGovernorTarget, bloomScale - GOVERNOR_RAMP_STEP)
            : Math.min(bloomGovernorTarget, bloomScale + GOVERNOR_RAMP_STEP);
        }
      } else if (dt > GOVERNOR_MAX_ACTIVE_DT_MS) {
        // Idle pause, shader compile stall, or single-frame capture: restore 100% quality.
        hasActiveSample = false;
        avgFrameMs = 16.67;
        slowStreak = 0;
        fastStreak = 0;
        bloomGovernorTarget = 1;
        bloomScale = 1;
      }
    }
    lastFrameTime = now;
    bloom.intensity = bloomBaseIntensity * bloomScale;
  }

  function release() {
    outline?.selection.clear();
    composer?.dispose();
    bloom?.dispose();
    surfaces?.dispose();
    gallerySurfaces?.dispose();
    composer = undefined;
    bloom = undefined;
    bloomBaseIntensity = 0;
    preparedNight = false;
    outline = undefined;
    normals = undefined;
    surfaces = undefined;
    halftone = undefined;
    pixels = undefined;
    moebius = undefined;
    gallerySurfaces = undefined;
    galleryEffect = undefined;
    resetGovernor();
  }

  function setStyle(id: RenderStyleId) {
    if (active === id) return;
    release();
    active = id;
  }

  function createBloom(night: boolean) {
    const options = night ? BLOOM_NIGHT_OPTIONS : BLOOM_DAY_OPTIONS;
    const effect = new BloomEffect(options);
    bloomBaseIntensity = options.intensity;
    // Skip luminance + mipmap GPU work completely when the mobile governor ramps bloom to 0.
    const baseUpdate = effect.update.bind(effect);
    effect.update = (renderTargetRenderer, inputBuffer, deltaTime) => {
      if (effect.intensity <= 1e-4) return;
      baseUpdate(renderTargetRenderer, inputBuffer, deltaTime);
    };
    bloom = effect;
    return effect;
  }

  function prepare() {
    const night = !!scene.userData.environmentNight;
    if (composer && preparedNight !== night) release();
    if (composer || active === "original" && environmentTone !== 'komorebi') return;
    preparedNight = night;
    const komorebi = environmentTone === 'komorebi';
    composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 2 });
    function finish(graded = false) {
      if (komorebi && !graded) composer!.addPass(new EffectPass(camera, createKomorebiGrade(night)));
      composer!.setSize(width, height);
    }
    function addTonePass(withBloom: boolean, ...effects: Effect[]) {
      const merged: Effect[] = [];
      if (withBloom) merged.push(createBloom(night));
      // Komorebi daylight skips ACES (C1 shoulder in KomorebiGrade preserves calibrated greens
      // and ritual-optics paper); Komorebi night uses Troy Sobotka AgX inside KomorebiGrade.
      const inlineKomorebi = komorebi && (withBloom || night);
      if (inlineKomorebi) merged.push(createKomorebiGrade(night));
      else if (!komorebi) merged.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
      merged.push(...effects);
      if (merged.length) composer!.addPass(new EffectPass(camera, ...merged));
      return inlineKomorebi;
    }
    if (active === "pixel-art") {
      pixels = new PixelArtPass(scene, camera);
      composer.addPass(pixels);
      const graded = addTonePass(false);
      finish(graded);
      return;
    }
    composer.addPass(new RenderPass(scene, camera));
    if (active === 'original') {
      const graded = addTonePass(true);
      finish(graded);
      return;
    }
    if (isGallerySurfaceStyle(active) || isGalleryPostStyle(active)) {
      if (isGallerySurfaceStyle(active)) gallerySurfaces = createGallerySurfaces(active);
      if (isGalleryPostStyle(active) && active !== "space-grade") {
        normals = new MoebiusNormals(scene, camera);
        composer.addPass(normals);
      }
      const graded = addTonePass(false);
      if (isGalleryPostStyle(active)) {
        galleryEffect = createGalleryEffect(active, normals?.target.texture ?? null, normals?.target.depthTexture ?? null, renderer.getPixelRatio());
        composer.addPass(new EffectPass(camera, galleryEffect.effect));
      }
      finish(graded);
      return;
    }
    if (active === "halftone") {
      halftone = createHalftoneEffect(renderer.getPixelRatio());
      const graded = addTonePass(false);
      composer.addPass(new EffectPass(camera, halftone));
      finish(graded);
      return;
    }
    surfaces = createToonSurfaces(active, sceneId);
    if (active === "moebius") {
      normals = new MoebiusNormals(scene, camera);
      composer.addPass(normals);
      const graded = addTonePass(false);
      moebius = createMoebiusEffect(normals.target.texture, normals.target.depthTexture!, renderer.getPixelRatio());
      composer.addPass(new EffectPass(camera, moebius));
      finish(graded);
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
    // Bloom linear HDR first, then tone-map / grade before compositing ink or brush
    // so dark contours are never washed out by exposure or bloom halos.
    if (active === "gouache") {
      const graded = addTonePass(true);
      // Separate pass: the brush samples the bloomed, tone-mapped image, not HDR input.
      composer.addPass(new EffectPass(camera, createGouacheEffect(), outline));
      finish(graded);
    } else {
      const graded = addTonePass(true, outline);
      finish(graded);
    }
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
      updateBloomGovernor();
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
