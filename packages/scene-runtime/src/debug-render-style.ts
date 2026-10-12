import type * as THREE from "three";
import { debugStyles } from "./debug-styles";
import { createRenderStyle } from "./render-style";
import { createCozyEnvironment } from "./cozy-environment";
import { createInteractionCues } from "./interaction-cues";

/** Content defaults remain independent of browser-local debug overrides. */
export function createDebugRenderStyle(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  { id, label, invalidate = () => {} }: { id: string; label: string; invalidate?: () => void },
) {
  const style = createRenderStyle(renderer, scene, camera);
  const cues = createInteractionCues(renderer.domElement, scene, camera);
  const environment = createCozyEnvironment(scene, { id, invalidate });
  if (environment) {
    renderer.domElement.dataset.environment = environment.kind;
    void environment.ready.then(() => {
      if (renderer.domElement.dataset.environment) {
        renderer.domElement.dataset.environmentReady = "true";
        invalidate();
      }
    });
  }
  const registration = debugStyles.register(id, label, (selected) => {
    style.setStyle(selected);
    invalidate();
  });
  if (environment) registration.setDefault("toon-soft");
  return {
    setStyle: registration.setDefault,
    resize: style.resize,
    render() {
      environment?.prepare(renderer);
      style.render();
      cues.update();
      registration.report(style.getStyle());
    },
    dispose() {
      registration.dispose();
      cues.dispose();
      style.dispose();
      environment?.dispose();
      delete renderer.domElement.dataset.environment;
      delete renderer.domElement.dataset.environmentReady;
    },
  };
}
