// Browser-side integration audit. Import through Vite in an isolated browser
// page, then call startSceneStageAudit(). Real App, real engines, real buttons;
// no checkpoint injection, timer acceleration, or player storage is used.
import React from 'react';
import { createRoot } from 'react-dom/client';
import * as THREE from 'three';
import { BlessingApp } from '../packages/app/src/App.tsx';
import { createState } from '../packages/core/src/index.ts';
import { builtInScenes, isSceneVisibleInApp } from '../packages/core/src/daily-scenes.ts';
import { sceneIntention } from '../packages/core/src/scene-intentions.ts';
import { sceneStepCount } from '../packages/core/src/scene-steps.ts';
import { sceneEngines } from '../packages/app/src/scene-engines.ts';
import '../packages/app/src/style.css';

const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const box = element => {
  if (!element) return null;
  const r = element.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
};
const visible = element => element?.isConnected && !element.closest('[hidden], [inert]') &&
  getComputedStyle(element).display !== 'none' && element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0;
const clickable = element => visible(element) && !element.disabled && element.getAttribute('aria-disabled') !== 'true';
const geometryKeys = ['width', 'height'];
const assert = (value, message) => { if (!value) throw Error(message); };

export function startSceneStageAudit(config = {}) {
  if (window.__sceneStageAudit?.running) throw Error('An audit is already running');
  const entries = config.ids ? config.ids.map(id => {
    const entry = builtInScenes.find(scene => scene.id === id);
    assert(entry, `Unknown scene: ${id}`); return entry;
  }) : builtInScenes;
  const state = window.__sceneStageAudit = {
    version: 2, name: config.name || 'audit', startedAt: new Date().toISOString(),
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    normalMotion: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    total: entries.length, running: true, current: null, results: [], fatal: null,
    method: 'BlessingApp initial scene route, in-memory host; real helper/choice/finish/form handlers',
  };
  let cancelled = false, current = null;
  window.stopSceneStageAudit = () => { cancelled = true; };
  const originalRoot = document.getElementById('root');
  const previousDisplay = originalRoot?.style.display;
  if (originalRoot) originalRoot.style.display = 'none';
  const container = document.createElement('div');
  container.id = 'scene-stage-audit-root';
  document.body.append(container);
  const root = createRoot(container);
  const realBeforeRender = THREE.Object3D.prototype.onBeforeRender;
  const realLoad = sceneEngines.load;
  THREE.Object3D.prototype.onBeforeRender = function (renderer, scene, camera, ...args) {
    const active = current;
    // Postprocessing's screen triangle uses an origin-centred default
    // orthographic camera (near .1 / far 2000), with a square clip-space plane.
    const screenCamera = camera?.isOrthographicCamera && camera.position.lengthSq() === 0;
    const worldCamera = !screenCamera && (camera?.isPerspectiveCamera || camera?.isOrthographicCamera);
    // Environment probes render square cube faces, independently of the player
    // viewport. Only validate cameras rendering the visible world/composer.
    if (active?.monitoring && worldCamera && !renderer.getRenderTarget()?.isWebGLCubeRenderTarget &&
      renderer.domElement.closest('[data-stable-stage]') && active.lastRenderFrame !== renderer.info.render.frame) {
      active.lastRenderFrame = renderer.info.render.frame;
      active.renders++;
      const canvas = renderer.domElement, expected = canvas.clientWidth / Math.max(canvas.clientHeight, 1);
      const actual = camera.isPerspectiveCamera ? camera.aspect : (camera.right - camera.left) / (camera.top - camera.bottom);
      const error = Math.abs(actual - expected);
      active.maxAspectError = Math.max(active.maxAspectError, error);
      if (error > .012) issue(active, 'camera-aspect', { expected, actual,
        camera: { type: camera.type, near: camera.near, far: camera.far, position: camera.position.toArray(), name: camera.name },
        scene: scene?.type, object: this.name, target: renderer.getRenderTarget()?.texture?.name });
    }
    return realBeforeRender.call(this, renderer, scene, camera, ...args);
  };
  sceneEngines.load = function (id) {
    return realLoad.call(this, id).then(engine => ({
      ...engine,
      create(host, context, options) {
        const owner = current;
        const checkpoint = context.checkpoint;
        const wrapped = checkpoint ? { ...context, checkpoint(n) {
          if (owner) owner.checkpoints.push({ at: performance.now() - owner.started, value: n, phase: owner.phase });
          return checkpoint(n);
        } } : context;
        return engine.create(host, wrapped, options);
      },
    }));
  };
  const pageError = event => {
    if (current) issue(current, 'page-error', { message: event.message || String(event.reason) });
  };
  window.addEventListener('error', pageError);
  window.addEventListener('unhandledrejection', pageError);

  function issue(result, kind, data) {
    result.issueCount++;
    if (result.issues.length < 30) result.issues.push({ kind, at: performance.now() - result.started, phase: result.phase, ...data });
  }
  function measure() {
    const shell = container.querySelector('.app-shell'), main = shell?.querySelector('.app-content');
    const card = main?.querySelector('.scene-stage-card'), canvas = card?.querySelector('canvas.scene-canvas');
    if (!card || !canvas) return null;
    const cardBox = box(card), canvasBox = box(canvas), mainBox = box(main);
    return {
      card: cardBox, canvas: canvasBox,
      cardOffset: { x: cardBox.x - mainBox.x + main.scrollLeft, y: cardBox.y - mainBox.y + main.scrollTop },
      canvasOffset: { x: canvasBox.x - cardBox.x, y: canvasBox.y - cardBox.y },
      buffer: { width: canvas.width, height: canvas.height },
      scroll: { top: main.scrollTop, height: main.clientHeight, content: main.scrollHeight },
    };
  }
  function record(result) {
    const value = measure();
    if (!value) { if (result.monitoring) issue(result, 'missing-canvas', {}); return; }
    result.frames++;
    if (!result.baseline) return;
    for (const target of ['card', 'canvas', 'buffer']) for (const key of geometryKeys) {
      const delta = Math.abs(value[target][key] - result.baseline[target][key]);
      result.maxDelta[target][key] = Math.max(result.maxDelta[target][key], delta);
      if (delta > .75) issue(result, `${target}-size`, { key, before: result.baseline[target][key], actual: value[target][key] });
    }
    for (const target of ['cardOffset', 'canvasOffset']) for (const key of ['x', 'y']) {
      const delta = Math.abs(value[target][key] - result.baseline[target][key]);
      if (delta > 1) issue(result, `${target}-position`, { key, before: result.baseline[target][key], actual: value[target][key] });
    }
  }
  async function waitFor(predicate, label, timeout = 20000) {
    const started = performance.now();
    while (!predicate()) {
      assert(!cancelled, 'Audit cancelled');
      assert(performance.now() - started < timeout, `Timeout: ${label}`);
      await delay(35);
    }
  }
  async function observe(result, phase, ms = 180) {
    result.phase = phase;
    state.current.phase = phase;
    const start = performance.now();
    do { await frame(); record(result); } while (performance.now() - start < ms);
    const progress = result.saved?.sceneRecords?.find(scene => scene.id === result.id)?.progress ?? 0;
    result.snapshots.push({ phase, progress, at: performance.now() - result.started, geometry: measure() });
  }
  function button(result) {
    const stage = container.querySelector('.library-scene-stage');
    const candidates = [...(stage?.querySelectorAll('button.scene-bow-tap, button.scene-yut-finish') ?? [])].filter(clickable);
    const finish = candidates.find(element => element.matches('.scene-continuous-finish, .scene-sansi-finish, .scene-woodfish-finish, .scene-yut-finish'));
    if (finish) return finish;
    if (candidates.length) return candidates[0];
    // The Sansi's first real note unlocks its finish action. It intentionally
    // has no generic helper before that interaction.
    if (result.id === 'malawi-sansi') return [...stage.querySelectorAll('button.scene-sansi-key')].find(clickable);
    return null;
  }
  function changeInput(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  async function runEntry(entry) {
    const result = current = {
      id: entry.id, title: entry.title, public: isSceneVisibleInApp(entry), steps: sceneStepCount(entry),
      expectedWish: !!sceneIntention(entry.id)?.optionalWish, status: 'running', phase: 'mount', started: performance.now(),
      frames: 0, renders: 0, checkpoints: [], actions: [], snapshots: [], issues: [], issueCount: 0,
      maxAspectError: 0, maxDelta: { card: { width: 0, height: 0 }, canvas: { width: 0, height: 0 }, buffer: { width: 0, height: 0 } },
      baseline: null, monitoring: false, saved: null, completed: false, wish: null,
    };
    state.current = { id: entry.id, title: entry.title, index: state.results.length + 1, phase: 'mount' };
    let raf = 0;
    const sample = () => { if (result.monitoring) record(result); raf = requestAnimationFrame(sample); };
    try {
      let raw = JSON.stringify(createState({ sound: false, haptics: false, reducedMotion: false, locale: 'zh-Hans' }));
      result.saved = JSON.parse(raw);
      const host = {
        initialLocalePreference: 'zh-Hans', read: async () => raw,
        write: async next => {
          raw = next; result.saved = JSON.parse(next);
          const progress = result.saved.sceneRecords.find(scene => scene.id === entry.id)?.progress;
          if (entry.id === 'woodfish' && progress !== undefined && result.checkpoints.at(-1)?.value !== progress)
            result.checkpoints.push({ at: performance.now() - result.started, value: progress, phase: result.phase });
        },
      };
      root.render(React.createElement(BlessingApp, {
        key: `${entry.id}-${result.started}`, host, internalToolsEnabled: false,
        initialRoute: { page: 'scene', id: entry.id, entry, replay: true },
      }));
      await waitFor(() => container.querySelector('.library-scene-stage[data-ready="true"] canvas'), 'real engine ready', 45000);
      await document.fonts.ready; await frame(); await frame();
      result.baseline = measure();
      assert(result.baseline?.canvas.height >= 223 && result.baseline.canvas.width > 100, 'Visible initialized canvas');
      result.monitoring = true; raf = requestAnimationFrame(sample);
      await observe(result, 'initial');
      const choices = [...container.querySelectorAll('.scene-craft-choices button')].filter(clickable);
      for (let index = 0; index < choices.length; index++) {
        if (!clickable(choices[index])) continue;
        result.phase = `choice-${index}`; choices[index].click(); await observe(result, result.phase, 100);
      }
      const limit = Math.max(50, result.steps * 6);
      for (let action = 0; action < limit; action++) {
        if (container.querySelector('.scene-done-row')) break;
        await waitFor(() => container.querySelector('.scene-done-row') || button(result), 'next real scene control');
        if (container.querySelector('.scene-done-row')) break;
        const control = button(result);
        result.phase = `action-${action + 1}`;
        result.actions.push({ label: control.getAttribute('aria-label') || control.textContent.trim(), at: performance.now() - result.started });
        control.click(); await observe(result, result.phase, 160);
        assert(performance.now() - result.started < 150000, 'Ritual action budget exceeded');
      }
      await waitFor(() => container.querySelector('.scene-done-row'), 'actual completion');
      result.completed = true;
      await observe(result, 'completed', 260);
      const invite = container.querySelector('.scene-wish-invite');
      if (result.expectedWish) {
        assert(clickable(invite), 'Optional wish invitation is present after completion');
        result.wish = { opened: false, cancelled: false, reopened: false, saved: false };
        invite.click(); await waitFor(() => container.querySelector('.scene-post-wish input'), 'wish editor');
        result.wish.opened = true; await observe(result, 'wish-open');
        changeInput(container.querySelector('.scene-post-wish input'), '尚未保存的校验草稿'); await observe(result, 'wish-draft', 120);
        container.querySelector('.scene-wish-cancel').click();
        await waitFor(() => !container.querySelector('.scene-post-wish input'), 'wish cancellation');
        result.wish.cancelled = true; await observe(result, 'wish-cancelled');
        assert((result.saved.wishes?.length ?? 0) === 0, 'Cancellation must not save a wish');
        container.querySelector('.scene-wish-invite').click();
        await waitFor(() => container.querySelector('.scene-post-wish input'), 'wish reopening');
        assert(container.querySelector('.scene-post-wish input').value === '', 'Reopening clears only the cancelled draft');
        result.wish.reopened = true; await observe(result, 'wish-reopened', 120);
        changeInput(container.querySelector('.scene-post-wish input'), '愿牵挂的人平安'); await frame(); await frame();
        const submit = container.querySelector('.scene-post-wish button[type="submit"]');
        assert(clickable(submit), 'Written wish can be submitted'); submit.click();
        await waitFor(() => !container.querySelector('.scene-post-wish input') && result.saved.wishes?.length === 1, 'explicit wish save');
        result.wish.saved = true; await observe(result, 'wish-saved');
      } else {
        assert(!invite, 'Scenes without optional wishes do not invent a wish action');
        result.wish = { applicable: false };
      }
      // Observe removal as well as appearance of the actual four-second reward.
      await waitFor(() => !container.querySelector('.scene-reward-reveal'), 'reward animation finishes', 6500);
      await observe(result, 'settled', 220);
      assert(result.frames >= 12 && result.renders >= 5, 'Collect live layout and world-camera render frames');
      assert(result.issueCount === 0, `${result.issueCount} geometry/render issues`);
      result.status = 'pass';
    } catch (error) {
      result.status = 'fail'; result.failure = { message: error.message, stack: error.stack, last: measure() };
    } finally {
      result.monitoring = false; cancelAnimationFrame(raf);
      result.durationMs = performance.now() - result.started;
      delete result.started; delete result.monitoring; delete result.saved;
      state.results.push(result);
      current = null;
      root.render(null); await frame(); await frame();
    }
  }
  (async () => {
    try {
      for (const entry of entries) { if (cancelled) break; await runEntry(entry); }
    } catch (error) { state.fatal = { message: error.message, stack: error.stack }; }
    finally {
      current = null; root.unmount(); container.remove();
      THREE.Object3D.prototype.onBeforeRender = realBeforeRender;
      sceneEngines.load = realLoad;
      window.removeEventListener('error', pageError); window.removeEventListener('unhandledrejection', pageError);
      if (originalRoot) originalRoot.style.display = previousDisplay;
      state.current = null; state.running = false; state.finishedAt = new Date().toISOString();
      state.passed = state.results.filter(result => result.status === 'pass').length;
      state.failed = state.results.filter(result => result.status === 'fail').length;
    }
  })();
  return { started: true, name: state.name, total: entries.length };
}
