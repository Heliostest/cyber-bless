import { afterEach, describe, expect, it, vi } from 'vitest';
import { assetUrl, installNativeAssetMap } from './asset-urls';

afterEach(() => { installNativeAssetMap({}); vi.unstubAllEnvs(); });

describe('asset URL resolution', () => {
  it('uses the current downloaded asset rather than the embedded public copy', () => {
    vi.stubEnv('EXPO_BASE_URL', './embedded/');
    const map = { 'environments/kloppenheim-06-sky-1k.hdr': 'file:///updates/b/sky.hdr' };
    installNativeAssetMap(map);
    map['environments/kloppenheim-06-sky-1k.hdr'] = 'file:///old/sky.hdr';
    expect(assetUrl('/environments/kloppenheim-06-sky-1k.hdr')).toBe('file:///updates/b/sky.hdr');
  });

  it('keeps browser and embedded paths when no native map is installed', () => {
    expect(assetUrl('fonts/noto-sans-sc.woff2')).toBe('/fonts/noto-sans-sc.woff2');
    vi.stubEnv('EXPO_BASE_URL', './embedded/');
    expect(assetUrl('/fonts/noto-sans-sc.woff2')).toBe('./embedded/fonts/noto-sans-sc.woff2');
    expect(assetUrl('')).toBe('./embedded/');
  });

  it('does not silently read an old public file when a native map is incomplete', () => {
    installNativeAssetMap({ 'fonts/noto-sans-sc.woff2': 'file:///updates/font.woff2' });
    expect(() => assetUrl('fonts/nunito-latin-500-normal.woff2')).toThrow(/missing/i);
  });

  it.each(['../secret', 'fonts/../secret', 'https://example.test/a', '//host/a', 'fonts/%2e%2e/a', 'fonts\\a', 'unknown.glb'])('rejects unregistered or ambiguous paths: %s', file => {
    expect(() => installNativeAssetMap({ [file]: 'file:///updates/a' })).toThrow();
    expect(() => assetUrl(file)).toThrow();
  });

  it.each(['https://example.test/a', 'data:text/plain,a', 'file://host/a', 'file:///updates/../a', 'file:///updates/%2e%2e/a', 'file:///updates/a?secret', 'file:///updates/a#hash'])('rejects nonlocal or ambiguous native URIs: %s', uri => {
    installNativeAssetMap({ 'fonts/noto-sans-sc.woff2': 'file:///valid/font' });
    expect(() => installNativeAssetMap({ 'fonts/noto-sans-sc.woff2': uri })).toThrow();
    expect(assetUrl('fonts/noto-sans-sc.woff2')).toBe('file:///valid/font');
  });
});
