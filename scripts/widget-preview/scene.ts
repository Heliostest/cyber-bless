import '../../packages/app/src/style.css';
import { builtInScenes } from '../../packages/core/src/daily-scenes';
import { sceneEngines } from '../../packages/app/src/scene-engines';
import { sceneStage } from '../../packages/app/src/scene-placement';
import { woodfishContent } from '../../packages/app/src/content';
import type { SceneController } from '../../packages/scene-runtime/src';

// This page mounts only the scene engine. No app store, user data, reward or sound.
const params = new URLSearchParams(location.search);
const entry = builtInScenes.find(scene => scene.id === params.get('scene'));
if (!entry) throw Error('Unknown capture scene');
const host = document.querySelector<HTMLDivElement>('#stage')!;
host.dataset.scene = entry.id;
host.dataset.stage = sceneStage(entry.id);
const width = Number(params.get('width')), height = Number(params.get('height'));
document.head.insertAdjacentHTML('beforeend', `<style>
html,body{margin:0;padding:0;width:${width}px;height:${height}px;overflow:hidden;background:#cdf1e6}
#stage{--canvas-h:100%;position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:0;box-shadow:none}
#stage>canvas{display:block;position:absolute;inset:0;width:100%;height:100%;opacity:1}
#stage>.scene-overlay-host{display:none!important}
</style>`);
const previewProgress = entry.id === 'tibetan-prayer-flags' ? 3 : entry.id === 'crane' || entry.id === 'lantern' ? 1 : 0;
let controller: SceneController;
const options = { active: true, reducedMotion: true, signal: new AbortController().signal,
  ready: () => { (window as any).__widgetReady = true; },
  failed: (error?: unknown) => { (window as any).__widgetError = String(error ?? 'Scene failed'); } };
const engine = await sceneEngines.load(entry.engine as Parameters<typeof sceneEngines.load>[0]);
if (entry.engine === 'woodfish@1') {
  const content = woodfishContent({});
  controller = (engine as any).create(host, { sceneId: entry.id,
    content: { prepareUpdate: async () => {}, load: async (initialize: any, settings: any) => {
      const lease = await content.load(initialize, settings); return { ...lease, confirm: async () => {} };
    } }, decodeSound: () => Promise.reject(Error('No preview sound')), onInstruction: () => {}, impact: () => {},
  }, options);
} else {
  controller = (engine as any).create(host, { sceneId: entry.id, progress: previewProgress,
    checkpoint: () => {}, isSoundEnabled: () => false, stage: sceneStage(entry.id) }, options);
}
(window as any).__widgetCapture = () => {
  controller.setActive(false);
  const canvas = host.querySelector('canvas')!;
  const gl = canvas.getContext('webgl2');
  if (!gl || gl.isContextLost()) throw Error('No valid WebGL2 scene');
  return { webgl: true, canvasWidth: canvas.width, canvasHeight: canvas.height, progress: previewProgress };
};
