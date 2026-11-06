import * as THREE from 'three';
import { createTreeRendering } from './imported-trees';
import type { TreePlacement } from './stylized-trees';
import type { TreeRenderMethod, TreeRenderReport } from './debug-trees';
import type { TreeSpecies } from './tree-models';
import { DEFAULT_TREE_METHOD } from './environment-defaults';

/** Retain the production trees while temporary comparisons load independently. */
export function createEnvironmentTrees(originals: THREE.Object3D[], placements: readonly TreePlacement[], floor: number, options: {
  load?: (url: string) => Promise<THREE.Group>; recommendation: TreeSpecies; camera?: THREE.Camera;
  onChange?: (report: TreeRenderReport) => void; invalidate?: () => void;
}) {
  const root = new THREE.Group(); root.name = 'environment-trees';
  let method: TreeRenderMethod = DEFAULT_TREE_METHOD, capturing = false, disposed = false;
  let baselineReport: TreeRenderReport = { count: placements.length, actual: 'original', status: 'ready' };
  let previewReport: TreeRenderReport = { ...baselineReport };
  function visible() {
    const selected = capturing ? DEFAULT_TREE_METHOD : method;
    const previewVisible = selected !== DEFAULT_TREE_METHOD && selected !== 'original' && previewReport.status === 'ready' && previewReport.actual !== 'original';
    preview.root.visible = previewVisible;
    baseline.root.visible = selected !== 'original' && !previewVisible;
    originals.forEach(object => { object.visible = selected === 'original' || (!previewVisible && baselineReport.actual === 'original'); });
  }
  function report() {
    if (disposed) return;
    visible();
    const state = method === DEFAULT_TREE_METHOD ? baselineReport : method === 'original' ? { ...baselineReport, actual: 'original' as const, status: 'ready' as const } : {
      ...previewReport, actual: previewReport.actual === 'original' ? baselineReport.actual : previewReport.actual,
    };
    options.onChange?.(state); options.invalidate?.();
  }
  const common = { load: options.load, recommendation: options.recommendation, camera: options.camera };
  const baseline = createTreeRendering(originals, placements, floor, { ...common, onChange: next => { baselineReport = next; report(); } });
  baseline.root.name = 'recommended-environment-trees';
  const preview = createTreeRendering([], placements, floor, { ...common, onChange: next => { previewReport = next; report(); } });
  root.add(baseline.root, preview.root);
  const ready = options.recommendation === 'original' || !placements.length ? Promise.resolve() : baseline.select(DEFAULT_TREE_METHOD);
  visible();
  return {
    root, ready,
    reframe() { baseline.reframe(); preview.reframe(); },
    isPreviewVisible() { return baseline.isPreviewVisible() || preview.isPreviewVisible(); },
    async select(next: TreeRenderMethod) {
      if (disposed) return;
      method = next;
      if (next === DEFAULT_TREE_METHOD || next === 'original') { await preview.select('original'); report(); }
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
