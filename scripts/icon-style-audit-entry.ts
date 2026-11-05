import * as THREE from 'three';
import { loadScene } from '../packages/scenes/src/registry';
import { builtInScenes, isSceneVisibleInApp } from '../packages/core/src/daily-scenes';
import * as shared from '../packages/shared/src/index';
import * as gestures from '../packages/gestures/src/index';
import { debugStyles } from '../packages/scene-runtime/src/debug-styles';
import { createWoodfishScene } from '../packages/app/src/woodfish-scene';
import { woodfishContent } from '../packages/app/src/content';
import type { SceneInstance } from '../packages/scenes/src/contract';
import { captureSceneImage } from '../packages/scene-runtime/src/scene-capture';

debugStyles.enable();
let instance: SceneInstance | undefined, controller: ReturnType<typeof createWoodfishScene> | undefined;
let renderedScene: THREE.Scene | undefined;
const progressEvents: number[] = [];
const before = THREE.Object3D.prototype.onBeforeRender;
THREE.Object3D.prototype.onBeforeRender = function(renderer, scene, camera, ...rest) {
  if (camera.isPerspectiveCamera || camera.isOrthographicCamera && camera.position.lengthSq() > 0) renderedScene = scene;
  return before.call(this, renderer, scene, camera, ...rest);
};
const audit = {
  entries: builtInScenes.map(entry => ({ id: entry.id, title: entry.title, source: entry.traditionSlug, visible: isSceneVisibleInApp(entry) })),
  async mount(id: string, { world = false, stage = 'day', progress = 1 }: { world?: boolean; stage?: 'day' | 'night'; progress?: number } = {}) {
    audit.dispose(); renderedScene = undefined; progressEvents.length = 0;
    const host = document.querySelector<HTMLDivElement>('#stage')!;
    if (world) delete host.dataset.scenePresentation; else host.dataset.scenePresentation = 'object';
    host.replaceChildren();
    if (id === 'woodfish') {
      await new Promise<void>((resolve, reject) => {
        controller = createWoodfishScene(host, { sceneId: id, active: false, reducedMotion: true, signal: new AbortController().signal,
          content: woodfishContent({}), decodeSound: async () => { throw Error('No sound asset expected'); }, onInstruction() {}, impact() { progressEvents.push(progressEvents.length + 1); }, ready: resolve, failed: reject });
      });
      const button = document.createElement('button'); button.className = 'woodfish-hit'; button.setAttribute('aria-label','轻点木鱼');
      button.style.cssText='position:absolute;inset:0;border:0;background:transparent;cursor:pointer'; button.onclick=()=>{controller?.setActive(true);controller?.strike()}; host.append(button);
    } else {
      const canvas = document.createElement('canvas'), overlay = document.createElement('div'); overlay.className = 'overlay'; host.append(canvas, overlay);
      const mod = await loadScene(id);
      instance = mod.create({ canvas, overlay, shared, gestures, sceneId: id, initialProgress: progress,
        isActive: () => true, isReducedMotion: () => true, isSoundEnabled: () => false, stage, deferWishWriting: true, onProgress(value) {progressEvents.push(value)} });
      instance.start(); instance.update(0);
    }
    const canvas = host.querySelector('canvas')!;
    if (world) for (let attempt = 0; attempt < 150 && canvas.dataset.environment && canvas.dataset.environmentReady !== 'true'; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 30)); instance?.update(0);
    }
    instance?.update(0);
    return audit.inspect(id);
  },
  inspect(id: string) {
    const actual = debugStyles.getSnapshot().find(entry => entry.id === id)?.actual;
    if (actual !== 'toon-soft') throw Error(`${id}: expected toon-soft, got ${actual}`);
    if (!renderedScene) throw Error(`${id}: no actual scene`);
    const materials = new Set<THREE.Material>(), kinds: Record<string, number> = {};
    renderedScene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material); const kind = material.userData.craftSurface?.kind ?? material.userData.ritualOptics?.kind;
        if (kind) kinds[kind] = (kinds[kind] ?? 0) + 1;
      }
    });
    return { actual, materialCount: materials.size, kinds };
  },
  capture() { return captureSceneImage(document.querySelector('#stage')!); },
  progress() { return [...progressEvents]; },
  advance(seconds: number) { if (!seconds) instance?.update(0); for (let i=0;i<Math.ceil(seconds/.025);i++) instance?.update(.025); },
  async styles(id: string) {
    const originals: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    renderedScene?.traverse(object => { if (object instanceof THREE.Mesh) originals.push([object, object.material]); });
    for (const style of ['original', 'toon-ink', 'toon-soft'] as const) {
      debugStyles.select(id, style); instance?.update(0); controller?.setActive(false);
      await new Promise(requestAnimationFrame);
      if (debugStyles.getSnapshot().find(entry => entry.id === id)?.actual !== style) throw Error(`Style fallback ${id}/${style}`);
      if (originals.some(([mesh, material]) => mesh.material !== material)) throw Error(`Source restoration ${id}/${style}`);
    }
  },
  dispose() { instance?.dispose(); instance = undefined; controller?.dispose(); controller = undefined; },
};
(globalThis as typeof globalThis & { iconAudit: typeof audit }).iconAudit = audit;
