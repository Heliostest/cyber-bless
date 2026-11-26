import * as THREE from 'three';
import { createTreeRendering } from './imported-trees';
import type { TreeRenderMethod, TreeRenderReport } from './debug-trees';
import type { TreePlacement, TreeSpecies } from './tree-models';
import { DEFAULT_TREE_METHOD } from './environment-defaults';

/** Retain far-planted production Simple Trees while temporary debug comparisons load independently. */
export function createEnvironmentTrees(placements: readonly TreePlacement[], floor: number, options: {
  load?: (url: string) => Promise<THREE.Group>; recommendation: TreeSpecies; camera?: THREE.Camera;
  onChange?: (report: TreeRenderReport) => void; invalidate?: () => void;
}) {
  const root = new THREE.Group(); root.name = 'environment-trees';
  let method: TreeRenderMethod = DEFAULT_TREE_METHOD, capturing = false, disposed = false;
  let baselineReport: TreeRenderReport = { count: placements.length, actual: 'none', status: 'ready' };
  let previewReport: TreeRenderReport = { ...baselineReport };
  function visible() {
    const selected = capturing ? DEFAULT_TREE_METHOD : method;
    const previewVisible = selected !== DEFAULT_TREE_METHOD && previewReport.status === 'ready' && previewReport.actual !== 'none';
    preview.root.visible = previewVisible;
    baseline.root.visible = !previewVisible;
  }
  function report() {
    if (disposed) return;
    visible();
    const state = method === DEFAULT_TREE_METHOD ? baselineReport : {
      ...previewReport, actual: previewReport.actual === 'none' ? baselineReport.actual : previewReport.actual,
    };
    options.onChange?.(state); options.invalidate?.();
  }
  // Production defaults stay on authored far garden placements (no camera-aware near preview framing).
  const baseline = createTreeRendering(placements, floor, {
    load: options.load, recommendation: options.recommendation, previewLayout: false,
    onChange: next => { baselineReport = next; report(); },
  });
  baseline.root.name = 'recommended-environment-trees';
  // Explicit debug overrides may use camera-aware preview framing without affecting production defaults.
  const preview = createTreeRendering(placements, floor, {
    load: options.load, recommendation: options.recommendation, camera: options.camera, previewLayout: !!options.camera,
    onChange: next => { previewReport = next; report(); },
  });
  root.add(baseline.root, preview.root);
  const ready = !placements.length ? Promise.resolve() : baseline.select(DEFAULT_TREE_METHOD);
  visible();
  return {
    root, ready,
    reframe() { preview.reframe(); },
    /** Only true for explicit debug preview overrides, never for production default trees or captures. */
    isPreviewVisible() { return !disposed && !capturing && preview.root.visible && preview.isPreviewVisible(); },
    async select(next: TreeRenderMethod) {
      if (disposed) return;
      method = next;
      if (next === DEFAULT_TREE_METHOD) { preview.unload(); report(); }
      else { await preview.select(next); }
    },
    captureDefault() {
      if (disposed || method === DEFAULT_TREE_METHOD) return undefined;
      capturing = true; visible();
      return () => { capturing = false; if (!disposed) visible(); };
    },
    update(time: number, reducedMotion: boolean) {
      if (baseline.root.visible) baseline.update(time, reducedMotion);
      if (preview.root.visible) preview.update(time, reducedMotion);
    },
    dispose() { if (disposed) return; disposed = true; preview.dispose(); baseline.dispose(); root.removeFromParent(); },
  };
}
