// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copySceneLink, shareSceneLinkInBrowser } from './ritual-share-link';
const link = { title: '木鱼静听', text: '打开互动场景', url: 'https://bless.helio.dev/share.html?v=1&scene=woodfish&lang=zh-Hans' };
afterEach(() => vi.unstubAllGlobals());
describe('interactive scene link sharing', () => {
  it('sends the public URL directly on the click turn', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    const pending = shareSceneLinkInBrowser(link);
    expect(share).toHaveBeenCalledWith(link);
    expect(await pending).toBe('shared');
  });
  it('copies the URL if system sharing is unavailable', async () => {
    let copied = '';
    vi.stubGlobal('navigator', { clipboard: { writeText: async (text: string) => { copied = text; } } });
    expect(await shareSceneLinkInBrowser(link)).toBe('copied');
    expect(copied).toBe(link.url);
  });
  it('keeps cancellation quiet and does not copy without another user choice', async () => {
    const copy = vi.fn();
    vi.stubGlobal('navigator', { share: async () => { throw new DOMException('Cancel', 'AbortError'); }, clipboard: { writeText: copy } });
    expect(await shareSceneLinkInBrowser(link)).toBe('cancelled');
    expect(copy).not.toHaveBeenCalled();
  });
  it('offers manual selection when the clipboard is blocked', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: async () => { throw Error('denied'); } } });
    expect(await copySceneLink(link.url)).toBe('manual');
  });
});
