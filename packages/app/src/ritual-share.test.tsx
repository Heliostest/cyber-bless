// @vitest-environment jsdom
import { act, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Context, type AppContext } from './context';
import { SceneShareButton, dismissRitualShare } from './ritual-share';
import { clickOn, renderUI, settle } from './dom-test-utils';

const card = vi.hoisted(() => ({ fail: false }));
vi.mock('./ritual-share-image', async importOriginal => {
  const actual = await importOriginal<typeof import('./ritual-share-image')>();
  return { ...actual, createRitualShareCard: async ({ sceneId, title }: { sceneId: string; title: string }) => {
    if (card.fail) throw new Error('GPU lost');
    return actual.prepareShareImage('data:image/png;base64,iVBORw0KGgo=', sceneId, title);
  } };
});

beforeEach(() => {
  card.fail = false;
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); } });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

const button = (root: HTMLElement, label: string) => [...root.querySelectorAll('button')].find(element => element.textContent?.trim() === label)!;
function openShare(shareImage?: AppContext['shareImage'], extra: Partial<AppContext> = {}) {
  const ui = renderUI(createElement(Context.Provider, { value: { active: true, shareImage, ...extra } as AppContext },
    createElement(SceneShareButton, { sceneId: 'woodfish', title: '木鱼静听', snapshot: 'data:image/png;base64,iVBORw0KGgo=' })));
  clickOn(button(ui.host, '分享仪式'));
  return ui;
}

describe('completed ritual image preview', () => {
  it('previews the image before invoking native sharing without a WebView download link', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const ui = openShare(share); await settle();
    expect(ui.host.querySelector('dialog[open]')).not.toBeNull();
    expect(ui.host.querySelector('img')?.alt).toBe('木鱼静听');
    expect(share).not.toHaveBeenCalled();
    expect(ui.host.querySelector('a[download]')).toBeNull();
    clickOn(button(ui.host, '分享图片')); await settle();
    expect(share).toHaveBeenCalledWith({ dataUrl: 'data:image/png;base64,iVBORw0KGgo=', fileName: 'ritual-woodfish.png', title: '木鱼静听' });
    expect(ui.host.textContent).not.toContain('发送成功');
    ui.unmount();
  });
  it('keeps the preview and save link on unsupported browsers', async () => {
    vi.stubGlobal('navigator', {});
    const ui = openShare(); await settle();
    clickOn(button(ui.host, '分享图片')); await settle();
    expect(ui.host.textContent).toContain('当前设备不支持直接分享图片，请保存后发送。');
    expect(ui.host.querySelector('a[download]')).not.toBeNull();
    expect(ui.host.querySelector('a[download]')?.getAttribute('download')).toBe('ritual-woodfish.png');
    ui.unmount();
  });
  it('can retry generating after a frame error', async () => {
    card.fail = true;
    const ui = openShare(); await settle();
    expect(ui.host.textContent).toContain('画面暂时无法生成，请重试。');
    expect(ui.host.querySelector('a[download]')).toBeNull();
    card.fail = false;
    clickOn(button(ui.host, '重新生成')); await settle();
    expect(ui.host.querySelector('img')).not.toBeNull();
    ui.unmount();
  });
  it('consumes Android back by closing only the preview', async () => {
    const ui = openShare(); await settle();
    act(() => { expect(dismissRitualShare(ui.host)).toBe(true); }); await settle();
    expect(ui.host.querySelector('dialog')).toBeNull();
    expect(button(ui.host, '分享仪式')).toBeDefined();
    expect(dismissRitualShare(ui.host)).toBe(false);
    ui.unmount();
  });
  it('keeps the prepared image available to retry after native sharing fails', async () => {
    const ui = openShare(async () => { throw new Error('Native bridge unavailable'); }); await settle();
    clickOn(button(ui.host, '分享图片')); await settle();
    expect(ui.host.textContent).toContain('这一步暂时没有完成，请再试一次');
    expect(ui.host.querySelector('img')).not.toBeNull();
    expect(button(ui.host, '分享图片').disabled).toBe(false);
    ui.unmount();
  });
  it('shares a playable scene URL and the App Store link through the native bridge', async () => {
    card.fail = true;
    const shareLink = vi.fn().mockResolvedValue(undefined);
    const ui = openShare(async () => {}, { publicShareBaseUrl: 'https://bless.helio.dev/app/', shareLink }); await settle();
    clickOn(button(ui.host, '分享互动场景')); await settle();
    const payload = shareLink.mock.calls[0][0];
    const url = new URL(payload.url);
    expect(url.pathname).toBe('/app/share.html');
    expect(url.searchParams.get('scene')).toBe('woodfish');
    expect(payload.text).toContain('https://apps.apple.com/app/id6821271597');
    expect(ui.host.querySelector('a[href="https://apps.apple.com/app/id6821271597"]')).not.toBeNull();
    ui.unmount();
  });
  it('never offers a localhost or unconfigured link for public sharing', async () => {
    const ui = openShare(undefined, { publicShareBaseUrl: 'http://localhost:5173/' }); await settle();
    expect(button(ui.host, '分享互动场景')).toBeUndefined();
    expect(ui.host.textContent).toContain('互动链接分享暂未开放。');
    expect(ui.host.querySelector('a[href="https://apps.apple.com/app/id6821271597"]')).not.toBeNull();
    ui.unmount();
  });
});
