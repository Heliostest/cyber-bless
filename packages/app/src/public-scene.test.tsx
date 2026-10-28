// @vitest-environment jsdom
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicScenePage } from './public-scene';
import { clickOn, renderUI, settle } from './dom-test-utils';

type Mounted = {
  active: boolean;
  context: { checkpoint?(n: number): void; isSoundEnabled?(): boolean; deferWishWriting?: boolean; saveWish?: (text: string) => void };
  ready(): void; failed(error?: unknown): void;
};
const scene = vi.hoisted(() => ({ mounts: [] as Mounted[], dispose: vi.fn(), setActive: vi.fn(), setReducedMotion: vi.fn() }));
vi.mock('@wbr/scene-runtime', async original => ({
  ...(await original<typeof import('@wbr/scene-runtime')>()),
  mountScene: (options: Mounted) => {
    scene.mounts.push(options);
    queueMicrotask(() => options.ready());
    const lifecycle = { setActive: scene.setActive, setReducedMotion: scene.setReducedMotion, dispose: scene.dispose };
    return { ...lifecycle, initialized: Promise.resolve(), controller: { ...lifecycle, strike() {}, stopFollowing() {}, inspect() {}, movePointer() {}, whenIdle: () => Promise.resolve() } };
  },
}));

const base = 'http://localhost:4173/share.html?v=1&scene=crane&lang=zh-Hans';
beforeEach(() => {
  scene.mounts.length = 0;
  scene.dispose.mockClear(); scene.setActive.mockClear(); scene.setReducedMotion.mockClear();
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
const button = (host: HTMLElement, label: string) => [...host.querySelectorAll('button')].find(element => element.textContent?.trim() === label)!;

describe('public interactive scene page', () => {
  it('offers App Store access on an invalid link without mounting an engine', async () => {
    const ui = renderUI(createElement(PublicScenePage, { url: base + '&scene=woodfish' })); await settle();
    expect(ui.host.textContent).toContain('这个场景暂时无法打开');
    expect(ui.host.querySelector('a')?.getAttribute('href')).toBe('https://apps.apple.com/app/id6821271597');
    expect(scene.mounts).toHaveLength(0);
    ui.unmount();
  });
  it('uses a real scene host with no wish writer, storage, or reward flow', async () => {
    const read = vi.spyOn(Storage.prototype, 'getItem'), write = vi.spyOn(Storage.prototype, 'setItem');
    const ui = renderUI(createElement(PublicScenePage, { url: base })); await settle();
    expect(scene.mounts).toHaveLength(1);
    expect(scene.mounts[0].context.deferWishWriting).toBe(true);
    expect(scene.mounts[0].context.saveWish).toBeUndefined();
    expect(ui.host.querySelector('.library-scene-stage[data-scene="crane"]')).not.toBeNull();
    expect(ui.host.querySelector('.bottom-nav, .scene-reward-reveal, textarea')).toBeNull();
    expect(read).not.toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
    expect(ui.host.querySelector('a[href="https://apps.apple.com/app/id6821271597"]')).not.toBeNull();
    ui.unmount(); expect(scene.dispose).toHaveBeenCalledTimes(1);
  });
  it('starts muted and only unlocks audio on the sound button gesture', async () => {
    const resume = vi.fn().mockResolvedValue(undefined), close = vi.fn().mockResolvedValue(undefined), suspend = vi.fn().mockResolvedValue(undefined);
    const Audio = vi.fn(function () { return { resume, close, suspend, state: 'running' }; });
    vi.stubGlobal('AudioContext', Audio);
    const ui = renderUI(createElement(PublicScenePage, { url: base })); await settle();
    expect(scene.mounts[0].context.isSoundEnabled?.()).toBe(false);
    expect(Audio).not.toHaveBeenCalled();
    clickOn(button(ui.host, '开启声音')); await settle();
    expect(scene.mounts[0].context.isSoundEnabled?.()).toBe(true);
    expect(Audio).toHaveBeenCalledTimes(1); expect(resume).toHaveBeenCalled();
    clickOn(button(ui.host, '关闭声音')); await settle();
    expect(scene.mounts[0].context.isSoundEnabled?.()).toBe(false);
    expect(suspend).toHaveBeenCalled();
    ui.unmount(); expect(close).toHaveBeenCalled();
  });
  it('completes only in memory and can mount a fresh replay', async () => {
    const ui = renderUI(createElement(PublicScenePage, { url: base })); await settle();
    act(() => scene.mounts[0].context.checkpoint?.(3)); await settle();
    expect(ui.host.textContent).toContain('已完成');
    clickOn(button(ui.host, '重新体验')); await settle();
    expect(scene.mounts).toHaveLength(2);
    expect(ui.host.querySelector('.public-scene-completed')).toBeNull();
    expect(scene.dispose).toHaveBeenCalledTimes(1);
    ui.unmount();
  });
  it('allows retry after a scene failure while keeping the store link visible', async () => {
    const ui = renderUI(createElement(PublicScenePage, { url: base })); await settle();
    act(() => scene.mounts[0].failed(new Error('Shader failed'))); await settle();
    expect(ui.host.textContent).toContain('这个场景暂时无法打开');
    expect(ui.host.querySelector('a[href="https://apps.apple.com/app/id6821271597"]')).not.toBeNull();
    clickOn(button(ui.host, '重试')); await settle();
    expect(scene.mounts).toHaveLength(2);
    ui.unmount();
  });
  it('pauses the mounted scene on background and resumes it on return', async () => {
    const ui = renderUI(createElement(PublicScenePage, { url: base })); await settle();
    act(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    expect(scene.setActive).toHaveBeenLastCalledWith(false);
    act(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    expect(scene.setActive).toHaveBeenLastCalledWith(true);
    ui.unmount();
  });
});
