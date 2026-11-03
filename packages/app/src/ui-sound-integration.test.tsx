// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createState, reduce, type State } from '@wbr/core';
import type { AppContext } from './context';
import { BlessingApp } from './App';
import { renderUI, settle, clickOn } from './dom-test-utils';

const boundary = vi.hoisted(() => ({
  app: null as AppContext | null,
  play: vi.fn(), stop: vi.fn(), prepare: vi.fn(), preload: vi.fn(), results: vi.fn(), softStop: vi.fn(),
}));
vi.mock('./ui-sounds', () => ({ createUiSoundPlayer: (options: { enabled(): boolean }) => ({
  play: (sound: string) => { if (options.enabled()) boundary.play(sound); },
  stop: boundary.stop, prepare: boundary.prepare, preload: boundary.preload, dispose: vi.fn(),
}) }));
vi.mock('@wbr/shared', async original => ({
  ...await original<object>(),
  createSoftSoundPlayer: (options: { enabled(): boolean }) => ({
    play: (sound: string) => { if (options.enabled()) boundary.results(sound); }, stop: boundary.softStop, dispose: vi.fn(),
  }),
}));
vi.mock('./home', async original => {
  const { useApp } = await import('./context');
  return { ...await original<object>(), Today: () => { boundary.app = useApp(); return null; } };
});
vi.mock('./pages', async original => {
  const { useApp } = await import('./context');
  function Probe() { boundary.app = useApp(); return null; }
  return { ...await original<object>(), Me: Probe, Wishes: Probe, World: Probe, History: Probe };
});
const mounted: ReturnType<typeof renderUI>[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => {
  mounted.splice(0).forEach(ui => ui.unmount());
  boundary.app = null; vi.restoreAllMocks();
});
async function open(state: State = createState(), write: (raw: string) => Promise<void> = async () => {}, strict = false) {
  const host = { read: async () => JSON.stringify(state), write, haptic: vi.fn(async () => {}) };
  const props = { host, active: true };
  const element = createElement(BlessingApp, props);
  const ui = renderUI(strict ? createElement(StrictMode, null, element) : element);
  mounted.push(ui); await settle();
  return { ...ui, hostBridge: host, props };
}
const app = () => boundary.app!;

describe('semantic UI sound integration', () => {
  it('auditions through the existing sound boundary without navigation, storage or haptics', async () => {
    const ui = await open();
    const write = vi.fn(async () => {});
    const host = { read: async () => JSON.stringify(createState()), write, haptic: vi.fn(async () => {}) };
    ui.rerender(createElement(BlessingApp, { host, debugOverlay: createElement('span', { 'data-debug-probe': true }) }));
    await settle();
    write.mockClear(); boundary.play.mockClear(); boundary.results.mockClear();
    const initialPage = ui.host.querySelector('.app-shell')?.getAttribute('data-page');
    expect(app().audioInspector).toBeDefined();
    act(() => { app().audioInspector!.prepare(); app().audioInspector!.play('navigate'); });
    act(() => app().audioInspector!.play('saved'));
    expect(boundary.play).toHaveBeenCalledWith('navigate');
    expect(boundary.play).toHaveBeenCalledWith('saved');
    expect(boundary.results).not.toHaveBeenCalled();
    expect(ui.host.querySelector('.app-shell')?.getAttribute('data-page')).toBe(initialPage);
    expect(write).not.toHaveBeenCalled();
    expect(host.haptic).not.toHaveBeenCalled();
    act(() => app().audioInspector!.play('woodTap'));
    boundary.softStop.mockClear();
    act(() => app().uiSound?.('navigate'));
    expect(boundary.softStop).toHaveBeenCalledOnce();
    act(() => app().dispatch({ type: 'settings', key: 'sound', value: false }));
    boundary.play.mockClear(); boundary.results.mockClear();
    expect(app().audioInspector!.play('collect')).toBe('disabled');
    expect(boundary.play).not.toHaveBeenCalled(); expect(boundary.results).not.toHaveBeenCalled();
    ui.rerender(createElement(BlessingApp, { host })); await settle();
    expect(app().audioInspector).toBeUndefined();
  });
  it('keeps the UI sound callback stable across unrelated save renders', async () => {
    await open();
    const first = app().uiSound;
    act(() => app().dispatch({ type: 'settings', key: 'haptics', value: false }));
    await settle();
    expect(app().uiSound).toBe(first);
  });
  it('keeps startup and automatic navigation quiet, sounds a changed user tab once', async () => {
    const ui = await open();
    expect(boundary.play).not.toHaveBeenCalled();
    act(() => app().go({ page: 'me' }));
    expect(boundary.play).not.toHaveBeenCalled();
    clickOn(ui.host.querySelector('[data-tab="wishes"]')!);
    expect(boundary.play.mock.calls.map(call => call[0])).toEqual(['navigate']);
    clickOn(ui.host.querySelector('[data-tab="wishes"]')!);
    expect(boundary.play).toHaveBeenCalledTimes(1);
    expect(ui.hostBridge.haptic).not.toHaveBeenCalled();
  });

  it('sounds explicitly requested navigation outside React state updaters in StrictMode', async () => {
    await open(createState(), undefined, true);
    act(() => app().go({ page: 'me' }, { sound: 'navigate' }));
    expect(boundary.play.mock.calls.map(call => call[0])).toEqual(['navigate']);
    act(() => app().go({ page: 'me' }, { sound: 'navigate' }));
    expect(boundary.play).toHaveBeenCalledTimes(1);
  });

  it('responds only to effective settings changes and never sounds the mute action', async () => {
    await open();
    act(() => app().dispatch({ type: 'settings', key: 'reducedMotion', value: true }));
    expect(boundary.play).toHaveBeenLastCalledWith('toggleOn');
    boundary.play.mockClear();
    act(() => app().dispatch({ type: 'settings', key: 'reducedMotion', value: true }));
    expect(boundary.play).not.toHaveBeenCalled();
    act(() => app().dispatch({ type: 'settings', key: 'sound', value: false }));
    act(() => app().uiSound?.('select'));
    expect(boundary.play).not.toHaveBeenCalled();
    expect(boundary.stop).toHaveBeenCalled();
    act(() => app().dispatch({ type: 'settings', key: 'sound', value: true }));
    expect(boundary.play).toHaveBeenCalledOnce();
    expect(boundary.play).toHaveBeenLastCalledWith('toggleOn');
  });

  it('marks an archive state change without treating it as a reward or duplicating a no-op', async () => {
    const state = reduce(createState(), { type: 'wish.create', id: 'w1', title: '顺利', intention: '', at: '2026-11-03T01:00:00Z' });
    await open(state);
    act(() => app().dispatch({ type: 'wish.archive', id: 'w1', archived: true }));
    expect(boundary.play).toHaveBeenLastCalledWith('toggleOff');
    boundary.play.mockClear();
    act(() => app().dispatch({ type: 'wish.archive', id: 'w1', archived: true }));
    expect(boundary.play).not.toHaveBeenCalled();
    expect(boundary.results).not.toHaveBeenCalled();
  });

  it('waits for actual visual-preference persistence and does not give failed writes a saved sound', async () => {
    let finish!: () => void;
    await open(createState(), () => new Promise<void>(resolve => { finish = resolve; }));
    act(() => app().dispatch({ type: 'scene.visual', id: 'crane', style: 'toon-outline' }));
    await settle();
    expect(boundary.play).not.toHaveBeenCalled();
    await act(async () => finish()); await settle();
    expect(boundary.play).toHaveBeenCalledExactlyOnceWith('saved');
    expect(boundary.results).not.toHaveBeenCalled();
    mounted.pop()!.unmount(); boundary.play.mockClear();
    await open(createState(), async () => { throw Error('disk full'); });
    act(() => app().dispatch({ type: 'scene.visual', id: 'crane', style: 'toon-outline' }));
    await settle();
    expect(boundary.play).not.toHaveBeenCalled();
  });

  it('stops UI feedback on background and blur and never replays on return', async () => {
    const ui = await open();
    act(() => app().uiSound?.('open'));
    expect(boundary.play).toHaveBeenLastCalledWith('open');
    boundary.play.mockClear(); boundary.stop.mockClear();
    act(() => window.dispatchEvent(new Event('blur')));
    act(() => app().uiSound?.('select'));
    expect(boundary.stop).toHaveBeenCalled();
    expect(boundary.play).not.toHaveBeenCalled();
    act(() => window.dispatchEvent(new Event('focus')));
    ui.rerender(createElement(BlessingApp, { ...ui.props, active: false }));
    act(() => app().uiSound?.('select'));
    expect(boundary.play).not.toHaveBeenCalled();
    ui.rerender(createElement(BlessingApp, ui.props));
    expect(boundary.play).not.toHaveBeenCalled();
  });

  it('gives existing result sounds priority over UI navigation without changing haptics', async () => {
    const ui = await open();
    act(() => {
      app().launchReward({ kind: 'leaf', from: { x: 0, y: 0, width: 20, height: 20 }, tab: 'wishes', announce: '收下' });
      app().go({ page: 'wishes' }, { sound: 'navigate' });
    });
    expect(boundary.play).toHaveBeenCalledExactlyOnceWith('collect');
    expect(boundary.results).not.toHaveBeenCalled();
    expect(ui.hostBridge.haptic).not.toHaveBeenCalled();
  });

  it('protects the full new completion phrase from navigation and leaves material sounds synthesized', async () => {
    await open();
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    act(() => app().uiSound?.('complete'));
    expect(boundary.play).toHaveBeenCalledExactlyOnceWith('complete');
    now = 1650;
    act(() => app().uiSound?.('navigate'));
    expect(boundary.play).toHaveBeenCalledTimes(1);
    now = 1940;
    act(() => app().uiSound?.('navigate'));
    expect(boundary.play).toHaveBeenLastCalledWith('navigate');
    act(() => app().feedback('woodTap'));
    expect(boundary.results).toHaveBeenCalledExactlyOnceWith('woodTap');
  });
});
