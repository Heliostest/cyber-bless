import type * as THREE from "three";
import { debugStyles } from "./debug-styles";
import { createRenderStyle } from "./render-style";
import { createIconLookPreview } from './icon-look-preview';
import { createCozyEnvironment } from "./cozy-environment";
import { createInteractionCues } from "./interaction-cues";
import { createStylePreviewCapture } from "./style-preview-capture";
import { captureSceneFrame, registerSceneCapture } from "./scene-capture";
import { CUE_LAYER } from "./cue-placard";
import { debugWater, type WaterRenderMethod } from './debug-water';
import { createWaterRendering } from './water-rendering';
import { readSceneMotion } from './scene-motion';
import { debugTrees, type TreeRenderReport } from './debug-trees';
import { debugEnvironmentTone, type EnvironmentTone } from './debug-environment-tone';
import { DEFAULT_ENVIRONMENT_TONE } from './environment-defaults';

/** Content defaults remain independent of browser-local debug overrides. */
export function createDebugRenderStyle(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  { id, label, invalidate = () => {} }: { id: string; label: string; invalidate?: () => void },
) {
  let disposed = false, rendered = false, needsPreviewRefresh = true;
  let lastWidth = 0, lastHeight = 0;
  const style = createRenderStyle(renderer, scene, camera, { sceneId: id });
  const iconLook = createIconLookPreview(renderer, scene, camera, id);
  const water = createWaterRendering(scene);
  let waterMethod: WaterRenderMethod = 'original', lastWaterFrame: number | undefined;
  const cues = createInteractionCues(renderer.domElement, scene, camera, () => {
    // A pause can stop the scene loop before another frame clears its labels.
    if (!disposed && rendered) { cues.update(); draw(); }
  });
  function draw(includeCues = true) {
    iconLook?.prepare();
    const mask = camera.layers.mask;
    // Production has no developer subscribers and needs no water inventory scan.
    const frame = waterMethod === 'original' && !debugWater.observed ? { surfaces: 0, restore() {} } : water.apply(waterMethod);
    try { camera.layers.disable(CUE_LAYER); if (iconLook?.enabled) iconLook.render(); else style.render(); }
    finally { camera.layers.mask = mask; frame.restore(); }
    if (includeCues && iconLook?.showCues !== false) cues.render(renderer);
    return frame.surfaces;
  }
  const waterRegistration = debugWater.register(id, label, method => {
    renderer.domElement.dataset.waterMethod = method;
    if (method === waterMethod) return;
    waterMethod = method;
    invalidate();
    if (rendered && !disposed) draw();
  }, renderer.domElement.closest?.('.app-shell') ?? undefined);
  const objectPresentation = !!renderer.domElement.closest?.('[data-scene-presentation="object"]');
  let treeRegistration: ReturnType<typeof debugTrees.register> | undefined;
  let treeReport: TreeRenderReport | undefined;
  const environment = objectPresentation ? undefined : createCozyEnvironment(scene, { id, camera, invalidate, onTrees: report => {
    if (disposed) return;
    treeReport = report;
    renderer.domElement.dataset.treeMethod = report.actual;
    renderer.domElement.dataset.treeStatus = report.status;
    treeRegistration?.report(report);
    needsPreviewRefresh = true;
    if (rendered) { environment?.prepare(renderer, style.getStyle(), { advanceMotion: false }); draw(); }
  } });
  if (environment?.treeCount) {
    renderer.domElement.dataset.treeMethod = treeReport?.actual ?? 'original';
    renderer.domElement.dataset.treeStatus = treeReport?.status ?? 'ready';
    treeRegistration = debugTrees.register(id, label, method => { void environment.setTreeMethod(method); }, renderer.domElement.closest?.('.app-shell') ?? undefined, environment.treeRecommendation);
    treeRegistration.report(treeReport ?? { count: environment.treeCount, actual: 'original', status: 'ready' });
  }
  if (environment) {
    renderer.domElement.dataset.environment = environment.kind;
    void environment.ready.then(() => {
      if (!disposed && renderer.domElement.dataset.environment) {
        renderer.domElement.dataset.environmentReady = "true";
        needsPreviewRefresh = true;
        invalidate();
      }
    });
  }
  let environmentTone: EnvironmentTone = DEFAULT_ENVIRONMENT_TONE;
  const toneRegistration = environment ? debugEnvironmentTone.register(id, label, tone => {
    renderer.domElement.dataset.environmentTone = tone;
    if (tone === environmentTone) return;
    environmentTone = tone;
    environment.setTone?.(tone);
    needsPreviewRefresh = true;
    invalidate();
    if (rendered && !disposed) { environment.prepare(renderer, style.getStyle(), { advanceMotion: false }); draw(); }
  }, renderer.domElement.closest?.('.app-shell') ?? undefined) : undefined;
  const capture = createStylePreviewCapture(renderer, scene, camera, { getStyle: style.getStyle, render: draw },
    selected => environment?.prepare(renderer, selected, { advanceMotion: false }));
  const releaseCapture = registerSceneCapture(renderer.domElement, () => {
    if (!rendered || disposed || environment?.captureReady === false) return undefined;
    // Shares use approved defaults; temporary comparisons stay in the console.
    const restoreTrees = environment?.captureDefaultTrees?.();
    const restoreTone = environment?.captureDefaultTone?.();
    try {
      return captureSceneFrame(renderer.domElement, scene, () => {
        environment?.prepare(renderer, style.getStyle(), { advanceMotion: false });
        draw(false);
      });
    } finally {
      restoreTrees?.();
      restoreTone?.();
      if (restoreTrees || restoreTone) { environment?.prepare(renderer, style.getStyle(), { advanceMotion: false }); draw(); }
      else cues.render(renderer);
    }
  });
  const registration = debugStyles.register(id, label, (selected, parameters) => {
    style.setStyle(selected);
    style.setParameters(parameters);
    invalidate();
  }, renderer.domElement.closest?.(".app-shell") ?? undefined,
  (selected, parameters) => {
    if (!rendered || disposed) return null;
    const mask = camera.layers.mask;
    const frame = water.apply(waterMethod);
    try { camera.layers.disable(CUE_LAYER); return capture(selected, parameters); }
    finally { camera.layers.mask = mask; frame.restore(); }
  });
  if (environment || objectPresentation) registration.setDefault("toon-soft");
  return {
    setStyle(selected: Parameters<typeof registration.setDefault>[0]) {
      // Content loaders also set their default after attaching a newly loaded model.
      needsPreviewRefresh = true;
      registration.setDefault(selected);
    },
    resize(width: number, height: number) {
      if (width !== lastWidth || height !== lastHeight) {
        lastWidth = width; lastHeight = height; needsPreviewRefresh = true;
      }
      style.resize(width, height);
    },
    render() {
      if (disposed) return;
      const now = performance.now() * .001;
      water.update(lastWaterFrame === undefined ? 0 : now - lastWaterFrame, readSceneMotion(renderer.domElement));
      lastWaterFrame = now;
      environment?.prepare(renderer, style.getStyle());
      cues.update();
      const waterSurfaces = draw();
      waterRegistration.report(waterSurfaces);
      renderer.domElement.dataset.waterSurfaces = String(waterSurfaces);
      registration.report(style.getStyle());
      if (!rendered || needsPreviewRefresh) {
        rendered = true; needsPreviewRefresh = false;
        registration.refreshPreviews();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      releaseCapture();
      waterRegistration.dispose();
      treeRegistration?.dispose();
      toneRegistration?.dispose();
      water.dispose();
      registration.dispose();
      cues.dispose();
      style.dispose();
      iconLook?.dispose();
      environment?.dispose();
      delete renderer.domElement.dataset.environment;
      delete renderer.domElement.dataset.environmentReady;
      delete renderer.domElement.dataset.environmentTone;
      delete renderer.domElement.dataset.waterMethod;
      delete renderer.domElement.dataset.waterSurfaces;
      delete renderer.domElement.dataset.treeMethod;
      delete renderer.domElement.dataset.treeStatus;
    },
  };
}
