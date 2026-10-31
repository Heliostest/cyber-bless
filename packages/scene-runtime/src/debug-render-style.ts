import type * as THREE from "three";
import { debugStyles } from "./debug-styles";
import { createRenderStyle } from "./render-style";
import { createCozyEnvironment } from "./cozy-environment";
import { createInteractionCues } from "./interaction-cues";
import { createStylePreviewCapture } from "./style-preview-capture";
import { captureSceneFrame, registerSceneCapture } from "./scene-capture";
import { CUE_LAYER } from "./cue-placard";

/** Content defaults remain independent of browser-local debug overrides. */
export function createDebugRenderStyle(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  { id, label, invalidate = () => {} }: { id: string; label: string; invalidate?: () => void },
) {
  let disposed = false, rendered = false, needsPreviewRefresh = true;
  let lastWidth = 0, lastHeight = 0;
  const style = createRenderStyle(renderer, scene, camera);
  const cues = createInteractionCues(renderer.domElement, scene, camera, () => {
    // A pause can stop the scene loop before another frame clears its labels.
    if (!disposed && rendered) { cues.update(); draw(); }
  });
  function draw(includeCues = true) {
    const mask = camera.layers.mask;
    try { camera.layers.disable(CUE_LAYER); style.render(); }
    finally { camera.layers.mask = mask; }
    if (includeCues) cues.render(renderer);
  }
  const objectPresentation = !!renderer.domElement.closest?.('[data-scene-presentation="object"]');
  const environment = objectPresentation ? undefined : createCozyEnvironment(scene, { id, invalidate });
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
  const capture = createStylePreviewCapture(renderer, scene, camera, { getStyle: style.getStyle, render: draw },
    selected => environment?.prepare(renderer, selected, { advanceMotion: false }));
  const releaseCapture = registerSceneCapture(renderer.domElement, () => {
    if (!rendered || disposed) return undefined;
    try {
      return captureSceneFrame(renderer.domElement, scene, () => {
        environment?.prepare(renderer, style.getStyle(), { advanceMotion: false });
        draw(false);
      });
    } finally { cues.render(renderer); }
  });
  const registration = debugStyles.register(id, label, (selected, parameters) => {
    style.setStyle(selected);
    style.setParameters(parameters);
    invalidate();
  }, renderer.domElement.closest?.(".app-shell") ?? undefined,
  (selected, parameters) => {
    if (!rendered || disposed) return null;
    const mask = camera.layers.mask;
    try { camera.layers.disable(CUE_LAYER); return capture(selected, parameters); }
    finally { camera.layers.mask = mask; }
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
      environment?.prepare(renderer, style.getStyle());
      cues.update();
      draw();
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
      registration.dispose();
      cues.dispose();
      style.dispose();
      environment?.dispose();
      delete renderer.domElement.dataset.environment;
      delete renderer.domElement.dataset.environmentReady;
    },
  };
}
