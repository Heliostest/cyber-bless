import type * as THREE from "three";
import { debugStyles } from "./debug-styles";
import { createRenderStyle } from "./render-style";
import { createCozyEnvironment } from "./cozy-environment";
import { createInteractionCues } from "./interaction-cues";
import { createStylePreviewCapture } from "./style-preview-capture";

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
  const cues = createInteractionCues(renderer.domElement, scene, camera);
  const environment = createCozyEnvironment(scene, { id, invalidate });
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
  const capture = createStylePreviewCapture(renderer, scene, camera, style,
    selected => environment?.prepare(renderer, selected, { advanceMotion: false }));
  const registration = debugStyles.register(id, label, (selected, parameters) => {
    style.setStyle(selected);
    style.setParameters(parameters);
    invalidate();
  }, renderer.domElement.closest?.(".app-shell") ?? undefined,
  (selected, parameters) => rendered && !disposed ? capture(selected, parameters) : null);
  if (environment) registration.setDefault("toon-soft");
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
      style.render();
      cues.update();
      registration.report(style.getStyle());
      if (!rendered || needsPreviewRefresh) {
        rendered = true; needsPreviewRefresh = false;
        registration.refreshPreviews();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      registration.dispose();
      cues.dispose();
      style.dispose();
      environment?.dispose();
      delete renderer.domElement.dataset.environment;
      delete renderer.domElement.dataset.environmentReady;
    },
  };
}
