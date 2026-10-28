// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createState, reduce, type State, type Action } from '@wbr/core';
import { BlessingApp } from './App';
import type { AppContext } from './context';
import { builtInScenes } from './scene-library';
import { renderUI, settle } from './dom-test-utils';

const probe = vi.hoisted(() => ({ app: null as AppContext | null }));
// Keep the real App/store and replace only the home view with a context probe.
vi.mock('./home', async importOriginal => {
  const original = await importOriginal<typeof import('./home')>();
  const { useApp } = await import('./context');
  return { ...original, Today: () => { probe.app = useApp(); return null; } };
});

const mounted: ReturnType<typeof renderUI>[] = [];
const started: { stop: ReturnType<typeof vi.fn> }[] = [];
let audioContexts = 0;
class AudioBoundary {
  currentTime = 0;
  sampleRate = 24000;
  state = 'running';
  destination = {};
  constructor() { audioContexts++; }
  resume = vi.fn(async () => {});
  suspend = vi.fn(async () => {});
  close = vi.fn(async () => {});
  createGain() {
    return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} }, connect: (node: unknown) => node, disconnect() {} };
  }
  createOscillator() {
    const source = { type: 'sine', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (node: unknown) => node, disconnect() {}, start() { started.push(source); }, stop: vi.fn(), onended: null as (() => void) | null };
    return source;
  }
  createBuffer(_channels: number, frames: number) { return { getChannelData: () => new Float32Array(frames) }; }
  createBufferSource() {
    const source = { buffer: null, playbackRate: { value: 1 }, connect: (node: unknown) => node, disconnect() {}, start() { started.push(source); }, stop: vi.fn(), onended: null as (() => void) | null };
    return source;
  }
}

beforeEach(() => {
  started.length = 0; audioContexts = 0;
  vi.stubGlobal('AudioContext', AudioBoundary);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
});
afterEach(() => {
  mounted.splice(0).forEach(ui => ui.unmount());
  probe.app = null; vi.restoreAllMocks(); vi.unstubAllGlobals();
});

const entry = builtInScenes.find(e => e.id === 'crane')!;
const AT = '2026-10-28T08:00:00.000Z';
const wish = { type: 'wish.create', id: 'new-wish', title: '明天顺利', intention: '', at: AT } as const;
async function open(state: State = createState(), write: (raw: string) => Promise<void> = async () => {}, strict = false) {
  const host = { read: async () => JSON.stringify(state), write, haptic: vi.fn(async () => {}) };
  const app = createElement(BlessingApp, { host });
  const ui = renderUI(strict ? createElement(StrictMode, null, app) : app);
  mounted.push(ui); await settle();
  return { ...ui, hostBridge: host };
}
const dispatch = (action: Parameters<AppContext['dispatch']>[0]) => act(() => { probe.app!.dispatch(action); });

describe('App gentle sound feedback', () => {
  it('synthesizes a requested object material cue instead of treating its name as decoded audio', async () => {
    await open();
    act(() => probe.app!.feedback('paper'));
    expect(started).toHaveLength(1);
    const buffer = (started[0] as unknown as { buffer: { getChannelData(channel: number): Float32Array } }).buffer;
    expect(typeof buffer).toBe('object');
    expect(buffer.getChannelData(0).length).toBe(9120);
    const first = started.length;
    dispatch({ type: 'settings', key: 'sound', value: false });
    act(() => probe.app!.feedback('paper'));
    expect(started).toHaveLength(first);
    await settle();
  });
  it('sounds only on the first incomplete-to-complete transition, never on load or duplicate progress', async () => {
    await open({ ...createState(), sceneRecords: [{ ...entry, progress: 2, favorite: false, lastOpened: AT }] });
    expect(started).toHaveLength(0);
    dispatch({ type: 'scene.progress', id: 'crane', progress: 3 });
    expect(started.length).toBeGreaterThan(0);
    const first = started.length;
    dispatch({ type: 'scene.progress', id: 'crane', progress: 3 });
    expect(started).toHaveLength(first);
  });

  it('waits for a successful local write before sounding saved, and ignores duplicate wish IDs', async () => {
    let finish: (() => void) | undefined;
    await open(createState(), () => new Promise<void>(resolve => { finish = resolve; }));
    dispatch(wish); await settle();
    expect(started).toHaveLength(0);
    await act(async () => { finish!(); await Promise.resolve(); });
    await settle();
    expect(started.length).toBeGreaterThan(0);
    const first = started.length;
    dispatch(wish); await settle();
    expect(started).toHaveLength(first);
  });

  it('keeps failed writes and invalid wishes silent', async () => {
    await open(createState(), async () => { throw Error('disk full'); });
    dispatch(wish); await settle();
    expect(started).toHaveLength(0);
    dispatch({ ...wish, id: 'invalid', title: '' }); await settle();
    expect(started).toHaveLength(0);
  });

  it('preserves the legacy completion haptic while replacing its old fallback sound', async () => {
    let state = createState();
    for (let i = 0; i < 12; i++) state = reduce(state, { type: 'ritual.strike', id: 'legacy', ritual: 'woodfish', at: AT });
    const ui = await open(state);
    dispatch({ type: 'ritual.finish', id: 'legacy', at: AT });
    expect(ui.hostBridge.haptic).toHaveBeenCalledOnce();
    expect(started.length).toBeGreaterThan(0);
    await settle();
  });

  it.each([
    { type: 'wish.note', id: 'new-wish', noteId: 'n1', text: '今天更近了一点', at: AT },
    { type: 'wish.realize', id: 'new-wish', at: AT },
    { type: 'wish.fulfill', id: 'new-wish', noteId: 'n1', text: '谢谢今天的帮助', method: 'kindness', at: AT },
  ] satisfies Action[])('sounds only after $type is persisted', async action => {
    let state = reduce(createState(), wish);
    if (action.type === 'wish.fulfill') state = reduce(state, { type: 'wish.realize', id: wish.id, at: AT });
    await open(state);
    dispatch(action);
    expect(started).toHaveLength(0);
    await settle();
    expect(started.length).toBeGreaterThan(0);
  });

  it('sounds when an explicit reward flight starts and ignores repeated clicks during that flight', async () => {
    await open();
    const flight = { kind: 'scene', sceneId: 'crane', from: { x: 0, y: 0, width: 30, height: 30 }, collectibleId: 'collected-crane', tab: 'world', announce: '已收好' } as const;
    let first = 0;
    act(() => {
      probe.app!.launchReward(flight);
      first = started.length;
      probe.app!.launchReward(flight);
    });
    expect(started.length).toBeGreaterThan(0);
    expect(started).toHaveLength(first);
  });

  it('still sounds after React StrictMode replays mount effects', async () => {
    await open(createState(), async () => {}, true);
    act(() => probe.app!.feedback());
    expect(started.length).toBeGreaterThan(0);
  });

  it('uses the live sound switch, cancels current sounds immediately and does not replay on unmute', async () => {
    await open();
    act(() => probe.app!.feedback());
    expect(started.length).toBeGreaterThan(0);
    const first = started.length;
    const stops = started.map(source => source.stop.mock.calls.length);
    dispatch({ type: 'settings', key: 'sound', value: false });
    expect(started.some((source, i) => source.stop.mock.calls.length > stops[i])).toBe(true);
    act(() => probe.app!.feedback()); dispatch(wish); await settle();
    expect(started).toHaveLength(first);
    dispatch({ type: 'settings', key: 'sound', value: true }); await settle();
    expect(started).toHaveLength(first);
  });

  it('can stop the woodfish tail without cutting off a completion melody', async () => {
    await open({ ...createState(), sceneRecords: [{ ...entry, progress: 2, favorite: false, lastOpened: AT }] });
    dispatch({ type: 'scene.progress', id: 'crane', progress: 3 });
    act(() => probe.app!.feedback());
    const priorStops = started.map(source => source.stop.mock.calls.length);
    act(() => (probe.app as AppContext & { stopInteractionSound?(): void }).stopInteractionSound?.());
    const material = started.filter(source => 'buffer' in source);
    expect(material.length).toBeGreaterThan(0);
    expect(material.every(source => source.stop.mock.calls.length > priorStops[started.indexOf(source)])).toBe(true);
    expect(started.filter(source => !('buffer' in source)).every(source => source.stop.mock.calls.length === priorStops[started.indexOf(source)])).toBe(true);
    await settle();
  });

  it('never creates audio while muted and suppresses delayed success after backgrounding', async () => {
    await open({ ...createState(), settings: { sound: false, haptics: true, reducedMotion: false } });
    act(() => probe.app!.feedback()); dispatch(wish); await settle();
    expect(audioContexts).toBe(0);
    mounted.pop()!.unmount();
    let finish: (() => void) | undefined;
    await open(createState(), () => new Promise<void>(resolve => { finish = resolve; }));
    dispatch(wish); await settle();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => { finish!(); await Promise.resolve(); }); await settle();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    act(() => document.dispatchEvent(new Event('visibilitychange'))); await settle();
    expect(started).toHaveLength(0);
  });
});
