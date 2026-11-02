// @vitest-environment jsdom
import { createElement, useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createState, reduce, type State } from '@wbr/core';
import { WISH_WRITE_COPY } from '@wbr/gestures';
import { Context, type AppContext } from './context';
import { builtInScenes, SceneLibraryContext } from './scene-library';
import { SceneExperience } from './scene-experience';
import { Opening } from './opening';
import { Complete } from './ritual';
import { clickOn, renderUI, settle, typeInto } from './dom-test-utils';

vi.mock('@wbr/scene-runtime', async original => ({
  ...await original<typeof import('@wbr/scene-runtime')>(),
  mountScene: (config: { ready(): void }) => {
    queueMicrotask(config.ready);
    return { initialized: Promise.resolve(), dispose() {}, setActive() {}, setReducedMotion() {} };
  },
}));
const mounted: ReturnType<typeof renderUI>[] = [];
afterEach(() => mounted.splice(0).forEach(ui => ui.unmount()));
const button = (host: HTMLElement, label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === label)!;
const crane = builtInScenes.find(entry => entry.id === 'crane')!;
const at = '2026-11-03T08:00:00.000Z';
function finishedCrane() {
  return reduce(reduce(createState(), { type: 'scene.visit', entry: crane, at }), { type: 'scene.progress', id: crane.id, progress: 3 });
}
function mount(node: ReactNode, initial = createState(), ready = true) {
  const uiSound = vi.fn(), go = vi.fn(), back = vi.fn(), launchReward = vi.fn();
  const library = { entries: [], ready } as never;
  function Harness() {
    const [state, setState] = useState(initial);
    return createElement(Context.Provider, { value: {
      state, uiSound, go, back, launchReward, active: true, feedback() {}, prepareFeedback() {}, announce() {}, haptic() {},
      dispatch(action) { const next = reduce(state, action); setState(next); return next !== state; },
    } as AppContext }, createElement(SceneLibraryContext.Provider, { value: library }, node));
  }
  const ui = renderUI(createElement(Harness)); mounted.push(ui);
  return { ...ui, uiSound, go, back, launchReward, sounds: () => uiSound.mock.calls.map(([sound]) => sound) };
}

describe('scene shell UI sounds', () => {
  it('opens and cancels the optional wish once, without adding a submission cue', async () => {
    const ui = mount(createElement(SceneExperience, { entry: crane }), finishedCrane()); await settle();
    clickOn(button(ui.host, '祈愿')); clickOn(button(ui.host, '祈愿'));
    expect(ui.sounds()).toEqual(['open']);
    clickOn(button(ui.host, '暂不记录'));
    expect(ui.sounds()).toEqual(['open', 'close']);
    clickOn(button(ui.host, '祈愿'));
    typeInto(ui.host.querySelector<HTMLInputElement>('.scene-post-wish input')!, '愿世界和平');
    clickOn(button(ui.host, '写好了')); await settle();
    expect(ui.sounds()).toEqual(['open', 'close', 'open']);
    expect(ui.host.querySelector('.scene-post-wish')).toBeNull();
    expect(ui.host.textContent).toContain(WISH_WRITE_COPY.saved);
  });

  it('requests a back cue for a plain completed-scene exit', async () => {
    const ui = mount(createElement(SceneExperience, { entry: crane }), finishedCrane()); await settle();
    clickOn(button(ui.host, '完成'));
    expect(ui.back.mock.calls.map(([options]) => options?.sound)).toEqual([true]);
    expect(ui.sounds()).toEqual([]);
  });

  it('requests a back cue when cancelling loading, without sounding preparation', () => {
    const ui = mount(createElement(SceneExperience, { entry: crane }), createState(), false);
    clickOn(button(ui.host, '取消并返回'));
    expect(ui.back.mock.calls.map(([options]) => options?.sound)).toEqual([true]);
    expect(ui.sounds()).toEqual([]);
  });

  it('requests navigation only for the opening start, keeping collect and final completion quiet', () => {
    const opening = { status: 'active', sceneIds: ['furin-wind-chime', 'shinto-torii', 'crane'], completed: 0 } as const;
    const state = { ...createState(), opening: { ...opening, sceneIds: [...opening.sceneIds] } } as State;
    const ui = mount(createElement(Opening), state);
    clickOn(ui.host.querySelector('.opening-start')!);
    expect(ui.go).toHaveBeenCalledWith(expect.objectContaining({ page: 'scene', opening: true }), { sound: 'navigate' });
    expect(ui.sounds()).toEqual([]);
    const completed = mount(createElement(Opening), { ...state, opening: { ...state.opening!, completed: 3 } });
    clickOn(completed.host.querySelector('.opening-finish')!);
    expect(completed.go).toHaveBeenCalledWith({ page: 'today' });
    expect(completed.sounds()).toEqual([]);
  });

  it('uses navigation for a completion-page wish link and keeps reward collection silent', () => {
    const wish = { id: 'w', title: '平安', category: 'life', intention: '', status: 'realized', createdAt: at, notes: [] };
    const session = { id: 's', ritual: 'crane', wishId: 'w', progress: 3, startedAt: at, completedAt: at };
    const state = { ...createState(), wishes: [wish], sessions: [session] } as State;
    const ui = mount(createElement(Complete, { id: 's' }), state);
    clickOn(button(ui.host, '去心愿看看'));
    expect(ui.go).toHaveBeenCalledWith({ page: 'wish', id: 'w' }, { sound: 'navigate' });
    const reward = mount(createElement(Complete, { id: 's' }), { ...state, wishes: [] });
    clickOn(reward.host.querySelector('[data-reward-origin]')!);
    expect(reward.launchReward).toHaveBeenCalledOnce();
    expect(reward.go).toHaveBeenCalledWith({ page: 'world' });
    expect(reward.sounds()).toEqual([]);
  });
});
