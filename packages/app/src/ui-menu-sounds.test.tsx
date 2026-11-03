// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createState, reduce } from '@wbr/core';
import { configureLocale } from '@wbr/i18n';
import { sceneStyles } from '@wbr/scene-runtime/debug-styles';
import { Context, type AppContext } from './context';
import { clickOn, renderUI, settle, typeInto } from './dom-test-utils';
import { FeedbackControls, dismissFeedbackMenu } from './feedback-controls';
import { LanguageSetting, dismissLanguageSetting } from './language-setting';
import { RitualNarrativeBlurb } from './ritual-narrative';
import { VisualStyleControl, dismissVisualStyleMenu } from './visual-style-menu';
import { SceneShareButton, dismissRitualShare } from './ritual-share';
import { SceneLoadFailure } from './scene-load-failure';

const shares = vi.hoisted(() => ({
  copy: vi.fn<() => Promise<'copied' | 'manual'>>(),
  shareLink: vi.fn<() => Promise<'shared' | 'cancelled' | 'copied' | 'manual'>>(),
  image: undefined as Promise<{ dataUrl: string; fileName: string; title: string }> | undefined,
}));
vi.mock('./visual-style-thumbnails', () => ({ useVisualStyleThumbnails: () => ({}) }));
vi.mock('./ritual-share-link', () => ({ copySceneLink: shares.copy, shareSceneLinkInBrowser: shares.shareLink }));
vi.mock('./ritual-share-image', () => ({
  createRitualShareCard: async () => shares.image ?? ({ dataUrl: 'data:image/png;base64,iVBORw0KGgo=', fileName: 'ritual.png', title: '木鱼' }),
  shareImageInBrowser: async () => 'cancelled',
}));

const mounted: ReturnType<typeof renderUI>[] = [];
const registrations: ReturnType<typeof sceneStyles.register>[] = [];
beforeEach(() => {
  shares.copy.mockReset().mockResolvedValue('copied');
  shares.shareLink.mockReset().mockResolvedValue('cancelled');
  shares.image = undefined;
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')); } });
});
afterEach(() => {
  mounted.splice(0).forEach(ui => ui.unmount());
  registrations.splice(0).forEach(item => item.dispose());
  configureLocale('zh-Hans');
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});
function mount(node: ReactNode, extra: Partial<AppContext> = {}) {
  const uiSound = vi.fn(), dispatch = vi.fn(() => true);
  const value = { state: createState(), active: true, canHaptic: true, dispatch, uiSound, ...extra } as AppContext;
  const render = (context = value) => createElement(Context.Provider, { value: context }, createElement('div', { className: 'app-shell' }, node));
  const ui = renderUI(render()); mounted.push(ui);
  return { ...ui, value, uiSound, dispatch, sounds: () => uiSound.mock.calls.map(([sound]) => sound),
    context: (next: Partial<AppContext>) => ui.rerender(render({ ...value, ...next })) };
}
const button = (host: HTMLElement, label: string) => [...host.querySelectorAll<HTMLButtonElement>('button')].find(item => item.textContent?.trim() === label)!;
function pointer(element: Element, type: string, x = 0, buttons = type === 'pointerup' ? 0 : 1) {
  act(() => {
    const event = new MouseEvent(type, { clientX: x, buttons, bubbles: true, cancelable: true });
    Object.defineProperties(event, { pointerId: { value: 1 }, pointerType: { value: 'mouse' } });
    element.dispatchEvent(event);
  });
}
function visual() {
  const ui = mount(createElement(VisualStyleControl, { sceneId: 'sound-style' }));
  act(() => {
    const registration = sceneStyles.register('sound-style', '画面', () => {}, ui.host.querySelector<HTMLElement>('.app-shell')!);
    registration.setDefault('toon-soft'); registrations.push(registration);
  });
  clickOn(ui.host.querySelector('[aria-label="视觉风格"]')!);
  return { ...ui, strip: ui.host.querySelector<HTMLElement>('.visual-style-filmstrip')! };
}
function share() {
  const ui = mount(createElement(SceneShareButton, { sceneId: 'woodfish', title: '木鱼', snapshot: 'data:image/png;base64,iVBORw0KGgo=' }),
    { publicShareBaseUrl: 'https://bless.helio.dev/app/' });
  clickOn(button(ui.host, '分享仪式'));
  return ui;
}
function deferred<T>() { let resolve!: (value: T) => void; return { promise: new Promise<T>(done => { resolve = done; }), resolve: (value: T) => resolve(value) }; }

describe('menu sounds at real UI transitions', () => {
  it('deduplicates settings pointerdown, click and native close during its closing animation', () => {
    const ui = mount(createElement(FeedbackControls));
    const outside = document.createElement('button'); document.body.append(outside);
    clickOn(ui.host.querySelector('.feedback-controls-trigger')!);
    pointer(outside, 'pointerdown'); clickOn(outside);
    act(() => { dismissFeedbackMenu(); });
    expect(ui.sounds()).toEqual(['open', 'close']);
    outside.remove();
  });

  it('voices changed language once and closes same-language selection once', () => {
    const uiSound = vi.fn();
    function Harness() {
      const [state, setState] = useState(createState());
      return createElement(Context.Provider, { value: { state, uiSound, dispatch: action => {
        setState(previous => reduce(previous, action)); return true;
      } } as AppContext }, createElement(LanguageSetting));
    }
    const ui = renderUI(createElement(Harness)); mounted.push(ui);
    clickOn(ui.host.querySelector('.language-setting-trigger')!);
    clickOn(ui.host.querySelector('input[value="en"]')!);
    expect(uiSound.mock.calls.map(([sound]) => sound)).toEqual(['open', 'select']);
    clickOn(ui.host.querySelector('.language-setting-trigger')!);
    clickOn(ui.host.querySelector('input[value="en"]')!);
    expect(uiSound.mock.calls.map(([sound]) => sound)).toEqual(['open', 'select', 'open', 'close']);
    clickOn(ui.host.querySelector('.language-setting-trigger')!);
    act(() => { dismissLanguageSetting(); });
    expect(uiSound.mock.calls.map(([sound]) => sound)).toEqual(['open', 'select', 'open', 'close', 'open', 'close']);
  });

  it('keeps language selection open and quiet across unrelated context renders', () => {
    const ui = mount(createElement(LanguageSetting));
    clickOn(ui.host.querySelector('.language-setting-trigger')!);
    ui.context({ uiSound: vi.fn() });
    expect(ui.host.querySelector('dialog[open]')).not.toBeNull();
    expect(ui.sounds()).toEqual(['open']);
  });

  it('voices narrative opening and only one close while the panel remains present', () => {
    const ui = mount(createElement(RitualNarrativeBlurb, { sceneId: 'woodfish' }));
    clickOn(ui.host.querySelector('.ritual-narrative-toggle')!);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(ui.sounds()).toEqual(['open', 'close']);
  });

  it('voices explicit style and scope selection; scroll, range and drag release stay quiet', () => {
    const ui = visual();
    const card = ui.strip.querySelector('[data-style="depth-rim"]')!;
    clickOn(card); clickOn(card);
    expect(ui.sounds()).toEqual(['open', 'select']);
    typeInto(ui.host.querySelector<HTMLInputElement>('input[type="range"]')!, '0.6');
    Object.defineProperties(ui.strip, { clientWidth: { value: 300 }, scrollWidth: { value: 1000 }, scrollTo: { value: vi.fn() } });
    act(() => ui.strip.dispatchEvent(new Event('scroll', { bubbles: true })));
    pointer(card, 'pointerdown', 200); pointer(card, 'pointermove', 100); pointer(card, 'pointerup', 100);
    act(() => card.dispatchEvent(new MouseEvent('click', { detail: 1, bubbles: true, cancelable: true })));
    expect(ui.sounds()).toEqual(['open', 'select']);
    clickOn(ui.host.querySelector('.visual-style-scope-all')!); clickOn(ui.host.querySelector('.visual-style-scope-all')!);
    expect(ui.sounds()).toEqual(['open', 'select', 'select']);
  });

  it('voices one keyboard style selection and no duplicate boundary or focus cue', () => {
    const ui = visual();
    const cards = [...ui.strip.querySelectorAll<HTMLButtonElement>('button')];
    act(() => cards[0].focus());
    act(() => cards[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })));
    expect(ui.sounds()).toEqual(['open', 'select']);
    act(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })));
    act(() => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })));
    expect(ui.sounds()).toEqual(['open', 'select', 'select']);
  });

  it('leaves changed-style save feedback to persistence and closes untouched style with close', () => {
    const ui = visual();
    expect(ui.host.querySelector('.visual-style-done')?.getAttribute('data-audio-cue')).toBe('close');
    expect(ui.host.querySelector('[data-visual-style-close]')?.getAttribute('data-audio-cue')).toBe('close');
    clickOn(ui.strip.querySelector('[data-style="original"]')!);
    expect(ui.host.querySelector('.visual-style-done')?.getAttribute('data-audio-cue')).toBe('saved');
    clickOn(ui.host.querySelector('.visual-style-done')!);
    expect(ui.dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'scene.visual', style: 'original' }));
    expect(ui.sounds()).toEqual(['open', 'select']);
    clickOn(ui.host.querySelector('[aria-label="视觉风格"]')!);
    clickOn(ui.host.querySelector('.visual-style-done')!);
    expect(ui.sounds()).toEqual(['open', 'select', 'open', 'close']);
    clickOn(ui.host.querySelector('[aria-label="视觉风格"]')!);
    act(() => { dismissVisualStyleMenu(); dismissVisualStyleMenu(); });
    expect(ui.sounds()).toEqual(['open', 'select', 'open', 'close', 'open', 'close']);
  });

  it('voices copying only after a confirmed clipboard result and keeps manual fallback quiet', async () => {
    const copy = deferred<'copied' | 'manual'>(); shares.copy.mockReturnValueOnce(copy.promise);
    const ui = share(); await settle();
    clickOn(button(ui.host, '复制链接'));
    expect(ui.sounds()).toEqual(['open']);
    await act(async () => copy.resolve('copied')); await settle();
    expect(ui.sounds()).toEqual(['open', 'saved']);
    shares.copy.mockResolvedValueOnce('manual');
    clickOn(button(ui.host, '复制链接')); await settle();
    expect(ui.sounds()).toEqual(['open', 'saved']);
    expect(ui.host.querySelector('.ritual-share-url')).not.toBeNull();
  });

  it.each(['close', 'background', 'blur', 'hidden', 'mute'] as const)('drops late clipboard audio after %s while retaining valid UI results', async reason => {
    const copy = deferred<'copied' | 'manual'>(); shares.copy.mockReturnValue(copy.promise);
    const ui = share(); await settle();
    clickOn(button(ui.host, '复制链接'));
    if (reason === 'close') act(() => { dismissRitualShare(); dismissRitualShare(); });
    else if (reason === 'background') { ui.context({ active: false }); ui.context({ active: true }); }
    else if (reason === 'blur') act(() => { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); });
    else if (reason === 'hidden') {
      const hidden = vi.spyOn(document, 'hidden', 'get');
      hidden.mockReturnValue(true); act(() => document.dispatchEvent(new Event('visibilitychange')));
      hidden.mockReturnValue(false); act(() => document.dispatchEvent(new Event('visibilitychange')));
    } else {
      ui.context({ state: { ...ui.value.state, settings: { ...ui.value.state.settings, sound: false } } });
      ui.context({ state: ui.value.state });
    }
    await act(async () => copy.resolve('copied')); await settle();
    expect(ui.sounds()).toEqual(reason === 'close' ? ['open', 'close'] : ['open']);
    if (reason !== 'close') expect(ui.host.textContent).toContain('链接已复制');
  });

  it('keeps an in-progress preview image across mute and background transitions', async () => {
    const image = deferred<{ dataUrl: string; fileName: string; title: string }>(); shares.image = image.promise;
    const ui = share(); await settle();
    ui.context({ state: { ...ui.value.state, settings: { ...ui.value.state.settings, sound: false } } });
    ui.context({ active: false }); ui.context({ active: true });
    await act(async () => image.resolve({ dataUrl: 'data:image/png;base64,iVBORw0KGgo=', fileName: 'ritual.png', title: '木鱼' })); await settle();
    expect(ui.host.querySelector('.ritual-share-picture img')).not.toBeNull();
    expect(ui.sounds()).toEqual(['open']);
  });

  it('does not claim success for system sharing cancellation', async () => {
    const ui = share(); await settle();
    clickOn(button(ui.host, '分享互动场景')); await settle();
    expect(ui.sounds()).not.toContain('saved');
    expect(ui.host.textContent).not.toContain('链接已复制');
  });

  it('voices explicit retry and technical disclosure without sounding automatic errors', () => {
    const retry = vi.fn(), ui = mount(createElement(SceneLoadFailure, { message: 'GPU lost', onRetry: retry }));
    expect(ui.sounds()).toEqual([]);
    const details = ui.host.querySelector('details')!;
    act(() => { details.open = true; details.dispatchEvent(new Event('toggle')); });
    act(() => { details.open = false; details.dispatchEvent(new Event('toggle')); });
    clickOn(button(ui.host, '重试打开'));
    expect(ui.sounds()).toEqual(['open', 'close', 'select']);
    expect(retry).toHaveBeenCalledOnce();
  });
});
