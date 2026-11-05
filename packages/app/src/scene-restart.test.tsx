// @vitest-environment jsdom
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createState, reduce, restore, sceneStepCount, type State } from '@wbr/core';
import { BlessingApp } from './App';
import { builtInScenes } from './scene-library';
import type { Route } from './context';
import { clickOn, renderUI, settle } from './dom-test-utils';

type Given = { progress?: number; checkpoint?(n: number): void; saveWish?(line: string): void; onVariantChange?(variant: string): void };
const engines = vi.hoisted(() => ({ mounts: [] as { context: Given; disposed: boolean; fail(error?: unknown): void }[] }));
vi.mock('@wbr/scene-runtime', async original => ({
  ...(await original<typeof import('@wbr/scene-runtime')>()),
  mountScene(config: { context: Given; ready(): void; failed(error?: unknown): void }) {
    const mounted = { context: config.context, disposed: false, fail: config.failed }; engines.mounts.push(mounted);
    queueMicrotask(() => config.ready());
    const lifecycle = { dispose() { mounted.disposed = true; }, setActive() {}, setReducedMotion() {} };
    return { ...lifecycle, initialized: Promise.resolve(), controller: { ...lifecycle,
      strike() {}, stopFollowing() {}, movePointer() {}, inspect() {}, whenIdle: () => Promise.resolve() } };
  },
}));
const live: ReturnType<typeof renderUI>[] = [];
const AT = '2026-11-05T08:00:00.000Z';
const entryOf = (id: string) => builtInScenes.find(entry => entry.id === id)!;
beforeEach(() => { engines.mounts.length = 0; vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { live.splice(0).forEach(ui => ui.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
function stateFor(id: string, done = true) {
  const entry = entryOf(id), initial = createState();
  initial.settings.reducedMotion = true; initial.settings.sound = false; initial.settings.haptics = false;
  let state = reduce(initial, { type: 'scene.visit', entry, at: AT });
  state = reduce(state, { type: 'scene.favorite', id, favorite: true });
  if (done) state = reduce(state, { type: 'scene.progress', id, progress: sceneStepCount(entry) });
  return state;
}
async function open(id: string, state = stateFor(id), route: Partial<Route> = {}) {
  let raw = JSON.stringify(state);
  const props = {
    host: { read: async () => raw, write: async next => { raw = next; } },
    initialRoute: { page: 'scene', id, entry: entryOf(id), replay: true, ...route } as Route,
  };
  const ui = renderUI(createElement(BlessingApp, props));
  live.push(ui); await settle();
  return { ...ui, saved: () => restore(raw), restart: () => ui.host.querySelector<HTMLButtonElement>('.scene-restart')!,
    setActive: (active: boolean) => ui.rerender(createElement(BlessingApp, { ...props, active })) };
}

describe('restart a completed ritual', () => {
  it.each(builtInScenes.map(entry => entry.id))('offers a fresh run for %s and disposes the completed presentation', async id => {
    const s = await open(id), old = engines.mounts.at(-1)!;
    expect(s.restart(), id).not.toBeNull();
    expect(s.restart().textContent).toBe('从头体验');
    clickOn(s.restart()); await settle();
    expect(s.saved().sceneRecords.find(record => record.id === id)).toMatchObject({ progress: 0, favorite: true });
    expect(old.disposed).toBe(true);
    expect(engines.mounts.at(-1)).not.toBe(old);
    expect(s.restart()).toBeNull();
    expect(s.host.querySelector('.scene-done-row')).toBeNull();
  });
  it('appears only after completion and can restart consecutive fresh runs', async () => {
    const s = await open('paper-pinwheel', stateFor('paper-pinwheel', false));
    expect(s.restart()).toBeNull();
    for (let run = 0; run < 2; run++) {
      act(() => engines.mounts.at(-1)!.context.checkpoint!(3)); await settle();
      expect(s.restart()).not.toBeNull();
      clickOn(s.restart()); await settle();
      expect(s.saved().sceneRecords[0].progress).toBe(0);
      expect(engines.mounts.at(-1)!.context.progress).toBe(0);
    }
  });
  it('ignores old engine callbacks after restarting and clears saved cloth substeps', async () => {
    let state = stateFor('korean-bojagi-wrap');
    state = reduce(state, { type: 'scene.variant', id: 'korean-bojagi-wrap', variant: 'bojagi-step-6' });
    const s = await open('korean-bojagi-wrap', state), old = engines.mounts.at(-1)!.context;
    clickOn(s.restart()); await settle();
    act(() => { old.checkpoint?.(3); old.saveWish?.('stale line'); old.onVariantChange?.('bojagi-step-6'); });
    await settle();
    expect(s.saved().sceneRecords[0]).toMatchObject({ progress: 0, variant: 'bojagi-step-0' });
    expect(s.saved().wishes).toEqual([]);
    expect(s.host.querySelector('.scene-done-row')).toBeNull();
  });
  it('retains daily rewards and saved wishes without granting another reward on replay', async () => {
    let state = stateFor('crane', false);
    state = reduce(state, { type: 'wish.create', id: 'kept', title: 'keep this', intention: '', at: AT });
    const day = '2026-11-05', s = await open('crane', state, { replay: false, daily: day });
    act(() => engines.mounts.at(-1)!.context.checkpoint!(3)); await settle();
    const completed = s.saved();
    expect(completed.collectibles.length).toBeGreaterThan(0);
    clickOn(s.restart()); await settle();
    act(() => engines.mounts.at(-1)!.context.checkpoint!(3)); await settle();
    expect(s.saved().collectibles).toEqual(completed.collectibles);
    expect(s.saved().sessions).toEqual(completed.sessions);
    expect(s.saved().wishes).toEqual(completed.wishes);
  });
  it('ignores an old engine failure after the new run is already mounted', async () => {
    const s = await open('paper-pinwheel'), old = engines.mounts.at(-1)!;
    clickOn(s.restart()); await settle();
    act(() => old.fail(new Error('old engine failed late'))); await settle();
    expect(s.host.querySelector('.library-scene-stage')).not.toBeNull();
    expect(s.host.querySelector('.scene-load-error')).toBeNull();
    expect(s.saved().sceneRecords[0].progress).toBe(0);
  });
  it('does not restart an inactive scene or accept a double-click tail as a new replay', async () => {
    const s = await open('paper-pinwheel');
    act(() => s.restart().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 })));
    await settle(); expect(s.saved().sceneRecords[0].progress).toBe(3);
    s.setActive(false); await settle();
    expect(s.restart().disabled).toBe(true);
    clickOn(s.restart()); await settle();
    expect(s.saved().sceneRecords[0].progress).toBe(3);
  });
  it('keeps an unresolved vessel line while starting an independent replay', async () => {
    const id = 'crane', state = stateFor(id);
    state.collectibles.push({ id: 'vessel', kind: 'scene', sceneId: id, title: entryOf(id).title, at: AT, wishScene: true, spentAt: AT });
    state.vesselDrafts = { vessel: { line: 'keep my draft', at: AT } };
    const s = await open(id, state, { replay: false, vessel: 'vessel' });
    expect(s.host.querySelector('.scene-keep-choice')).not.toBeNull();
    clickOn(s.restart()); await settle();
    expect(s.saved().vesselDrafts).toEqual(state.vesselDrafts);
    expect(s.host.querySelector('.scene-keep-choice')).toBeNull();
    expect(engines.mounts.at(-1)!.context.progress).toBe(0);
  });
  it('keeps the opening next-step action available after a replay', async () => {
    const state = stateFor('furin-wind-chime');
    state.opening = { status: 'active', sceneIds: ['furin-wind-chime', 'shinto-torii', 'crane'], completed: 0 };
    const s = await open('furin-wind-chime', state, { opening: true, replay: false });
    clickOn(s.restart()); await settle();
    act(() => engines.mounts.at(-1)!.context.checkpoint!(5)); await settle();
    expect(s.host.querySelector('[data-opening-collect]')).not.toBeNull();
    expect(s.saved().opening?.completed).toBe(0);
  });
  it.each((['crane', 'woodfish'] as const).flatMap(id => [1, sceneStepCount(entryOf(id))].map(progress => ({ id, progress }))))('also restarts a legacy $id completion from saved progress $progress', async ({ id, progress }) => {
    let state = stateFor(id);
    state = reduce(state, { type: 'scene.progress', id, progress });
    for (let n = 0; n < (id === 'crane' ? 4 : 12); n++) state = reduce(state, { type: 'ritual.strike', ritual: id, id: `legacy-${n}`, at: AT });
    const sessionId = state.activeSession!.id;
    state = reduce(state, { type: 'ritual.finish', id: sessionId, at: AT });
    const s = await open(id, state, { page: 'complete', id: sessionId });
    clickOn(s.restart()); await settle();
    expect(s.host.querySelector('.app-shell')?.getAttribute('data-page')).toBe('scene');
    expect(s.saved().sceneRecords.find(record => record.id === id)?.progress).toBe(0);
    expect(s.saved().sessions).toEqual(state.sessions);
    expect(s.restart()).toBeNull();
  });
});
