import React from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { BlessingApp } from '../packages/app/src/App.tsx';
import { createState } from '../packages/core/src/index.ts';
import { builtInScenes } from '../packages/core/src/daily-scenes.ts';
import { debugStyles } from '../packages/scene-runtime/src/debug-styles.ts';
import '../packages/app/src/style.css';

export function mountWoodfishMaterialProbe() {
  const container = document.createElement('div'); document.body.replaceChildren(container);
  const root = createRoot(container), meshes = new Set();
  const before = THREE.Object3D.prototype.onBeforeRender;
  THREE.Object3D.prototype.onBeforeRender = function(...args) {
    if (this.isMesh && (this.name === 'WoodfishBody' || this.name === 'Mallet')) meshes.add(this);
    return before.apply(this, args);
  };
  let raw = JSON.stringify(createState({ sound: false, haptics: false, reducedMotion: true, locale: 'zh-Hans' }));
  const entry = builtInScenes.find(item => item.id === 'woodfish');
  const host = { initialLocalePreference: 'zh-Hans', read: async () => raw, write: async next => { raw = next; } };
  root.render(React.createElement(BlessingApp, { host, internalToolsEnabled: false,
    initialRoute: { page: 'scene', id: 'woodfish', entry, replay: true } }));
  debugStyles.enable();
  return window.woodfishMaterialProbe = { meshes, debugStyles, dispose() {
    root.unmount(); THREE.Object3D.prototype.onBeforeRender = before;
  } };
}
