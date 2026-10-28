// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareShareImage, shareImageInBrowser, containImage } from './ritual-share-image';

const png = 'data:image/png;base64,iVBORw0KGgo=';
afterEach(() => vi.unstubAllGlobals());

describe('ritual PNG sharing', () => {
  it('contains the entire portrait or landscape frame without cropping', () => {
    expect(containImage(1600, 900, 960, 960)).toEqual({ x: 0, y: 210, width: 960, height: 540 });
    expect(containImage(600, 1200, 960, 960)).toEqual({ x: 240, y: 0, width: 480, height: 960 });
  });
  it('turns the prepared PNG into an actual image file', async () => {
    const image = prepareShareImage(png, 'woodfish', '木鱼静听');
    expect(image.file.name).toBe('ritual-woodfish.png');
    expect(image.file.type).toBe('image/png');
    expect(image.file.size).toBe(8);
    expect(image.dataUrl).toBe(png);
  });
  it('passes the PNG file to Web Share synchronously on the click turn', async () => {
    const image = prepareShareImage(png, 'woodfish', '木鱼静听');
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { canShare: (data: ShareData) => data.files?.[0]?.type === 'image/png', share });
    const pending = shareImageInBrowser(image);
    expect(share).toHaveBeenCalledWith({ files: [image.file], title: '木鱼静听' });
    expect(await pending).toBe('shared');
  });
  it('keeps image download as the fallback when file sharing is unsupported', async () => {
    const share = vi.fn();
    vi.stubGlobal('navigator', { share, canShare: () => false });
    expect(await shareImageInBrowser(prepareShareImage(png, 'crane', '千纸鹤'))).toBe('unsupported');
    expect(share).not.toHaveBeenCalled();
  });
  it('does not report a dismissed share sheet as an error', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: () => Promise.reject(new DOMException('Cancelled', 'AbortError')) });
    expect(await shareImageInBrowser(prepareShareImage(png, 'crane', '千纸鹤'))).toBe('cancelled');
  });
  it('propagates actual share errors so the preview can offer saving', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: () => Promise.reject(new Error('Blocked')) });
    await expect(shareImageInBrowser(prepareShareImage(png, 'crane', '千纸鹤'))).rejects.toThrow('Blocked');
  });
});
