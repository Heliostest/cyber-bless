// Standalone official-stage capture harness for scripts/capture-ritual-sheets.mjs.
// Mounts only the requested scene engine on the official stage without app state or HUD.
import * as THREE from 'three';
import '@src/packages/app/src/style.css';
import { builtInScenes } from '@src/packages/core/src/daily-scenes';
import { sceneEngines } from '@src/packages/app/src/scene-engines';
import { sceneStage } from '@src/packages/app/src/scene-placement';
import { debugWater } from '@wbr/scene-runtime/debug-water';
import { debugGrass } from '@wbr/scene-runtime/debug-grass';
import { debugTrees } from '@wbr/scene-runtime/debug-trees';
import { debugEnvironmentTone } from '@wbr/scene-runtime/debug-environment-tone';

const win = window as unknown as {
  __threeRevision?: string;
  __ready?: boolean;
  __error?: string;
  __controller?: unknown;
};

win.__threeRevision = THREE.REVISION;

async function mountOfficialStage(): Promise<void> {
  if (THREE.REVISION !== '170') {
    throw new Error(`Expected THREE.REVISION 170, got ${THREE.REVISION}`);
  }

  const params = new URLSearchParams(location.search);
  const id = params.get('scene') ?? 'ukrainian-didukh';
  const entry = builtInScenes.find((s) => s.id === id);
  if (!entry) {
    throw new Error(`Unknown scene id: ${id}`);
  }

  const host = document.querySelector<HTMLDivElement>('#stage');
  if (!host) {
    throw new Error('Missing #stage container');
  }
  host.dataset.scene = entry.id;
  host.dataset.stage = sceneStage(entry.id);

  document.head.insertAdjacentHTML(
    'beforeend',
    `<style>
:root,html,body,*{scrollbar-gutter:auto !important}
html,body{margin:0;padding:0;width:100vw;height:100vh;overflow:hidden;background:#cdf1e6}
#stage{--canvas-h:100%;position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:0;box-shadow:none}
#stage>canvas{display:block;position:absolute;inset:0;width:100%;height:100%;opacity:1}
${params.get('overlay') === '0' ? '#stage .scene-overlay-host{display:none !important}' : ''}
</style>`,
  );

  const water = params.get('water');
  const grass = params.get('grass');
  const tree = params.get('tree');
  const tone = params.get('tone');
  if (water) {
    debugWater.enable(undefined);
    debugWater.select(id, water as never, undefined);
  }
  if (grass) {
    debugGrass.enable(undefined);
    debugGrass.select(grass as never, undefined);
  }
  if (tree) {
    debugTrees.enable(undefined);
    debugTrees.select(id, tree as never, undefined);
  }
  if (tone) {
    debugEnvironmentTone.enable(undefined);
    debugEnvironmentTone.select(tone as never, undefined);
  }

  const progress = Number(params.get('progress') ?? 0);
  const options = {
    active: true,
    reducedMotion: params.get('reduced') === '1',
    signal: new AbortController().signal,
    ready: () => {
      win.__ready = true;
    },
    failed: (err?: unknown) => {
      win.__error = err instanceof Error ? err.message : String(err ?? 'fail');
    },
  };

  const engine = await sceneEngines.load(entry.engine as Parameters<typeof sceneEngines.load>[0]);
  if (entry.engine === 'woodfish@1') {
    const { woodfishContent } = await import('@src/packages/app/src/content');
    const content = woodfishContent({});
    win.__controller = (engine as any).create(
      host,
      {
        sceneId: entry.id,
        content: {
          prepareUpdate: async () => {},
          load: async (initialize: any, settings: any) => {
            const lease = await content.load(initialize, settings);
            return { ...lease, confirm: async () => {} };
          },
        },
        decodeSound: () => Promise.reject(new Error('No preview sound')),
        onInstruction: () => {},
        impact: () => {},
      },
      options,
    );
  } else {
    win.__controller = (engine as any).create(
      host,
      {
        sceneId: entry.id,
        progress,
        checkpoint: () => {},
        isSoundEnabled: () => false,
        stage: sceneStage(entry.id),
      },
      options,
    );
  }
}

mountOfficialStage().catch((err) => {
  win.__error = err instanceof Error ? err.message : String(err);
  throw err;
});
