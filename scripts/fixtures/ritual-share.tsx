import React from 'react';
import { createRoot } from 'react-dom/client';
import { createState } from '@wbr/core';
import { createContentClient } from '@wbr/content';
import { bundledWoodfish } from '@wbr/content/bundled';
import { Context, type AppContext } from '../../packages/app/src/context';
import { SceneShareButton } from '../../packages/app/src/ritual-share';
import { Woodfish } from '../../packages/app/src/woodfish';
import { sceneStyles } from '../../packages/scene-runtime/src/debug-styles';
import { configureLocale } from '../../packages/i18n/src';

async function start() {
  configureLocale('zh-Hans', ['zh-CN']);
  const bytes = Uint8Array.from(atob((window as unknown as { shareModelBase64: string }).shareModelBase64), character => character.charCodeAt(0));
  const contentClient = createContentClient({
    bundled: bundledWoodfish, bundledBase: 'https://ritual-share.test/',
    io: {
      readHistory: async () => null, writeHistory: async () => {},
      readManifest: async () => bundledWoodfish,
      readAsset: async () => bytes.buffer,
      readCachedAsset: async () => undefined,
    },
  });
  createRoot(document.getElementById('root')!).render(
    <Context.Provider value={{ active: true, state: createState(), decodeSound: async () => { throw Error('No sound in bundled pack'); } } as AppContext}>
      <div className="app-shell" data-immersive style={{ height: '100dvh', padding: 18 }}>
        <h1 style={{ fontSize: 22 }}>木鱼静听</h1>
        <main className="app-content"><section className="scene-experience">
          <Woodfish sceneId="woodfish" active reducedMotion view="front" disabled strikes={12} minimumStrikes={12}
            contentClient={contentClient} onStrike={() => false} onImpact={() => {}} onInstruction={() => {}}/>
          <div className="scene-done-row"><div className="scene-completion-actions">
            <button className="button">收藏</button><button className="button primary">收下</button>
          </div><SceneShareButton sceneId="woodfish" title="木鱼静听"/></div>
        </section></main>
      </div>
    </Context.Provider>,
  );
  for (let attempt = 0; !document.querySelector('.woodfish-stage[data-ready="true"] canvas[data-environment-ready="true"]'); attempt++) {
    if (attempt > 600) throw new Error('Production woodfish renderer did not become ready');
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  Object.assign(window, {
    shareVerificationReady: true,
    shareRendering: { style: sceneStyles.getSnapshot().find(scene => scene.id === 'woodfish')?.actual },
  });
}
void start().catch(error => { console.error(error); throw error; });
