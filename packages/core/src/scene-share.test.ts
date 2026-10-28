import { describe, expect, it } from 'vitest';
import { APP_STORE_URL, buildSceneShareUrl, isPublicShareBaseUrl, parseSceneShareUrl } from './scene-share';
import { DEFAULT_STYLE_PARAMETERS } from './visual-style';

const base = 'https://yinian.app';
const simple = `${base}/share.html?v=1&scene=woodfish&lang=zh-Hans`;

describe('public scene share links', () => {
  it('builds a versioned scene-only URL in the configured site subdirectory', () => {
    expect(buildSceneShareUrl(`${base}/bless?session=PRIVATE#private`, { sceneId: 'woodfish', locale: 'zh-Hans' }))
      .toBe(`${base}/bless/share.html?v=1&scene=woodfish&lang=zh-Hans`);
    expect(parseSceneShareUrl(simple)).toEqual({ sceneId: 'woodfish', locale: 'zh-Hans' });
    expect(APP_STORE_URL).toBe('https://apps.apple.com/app/id6821271597');
  });

  it('retains a recognized shader and normalized numeric controls for the recipient', () => {
    const visual = { style: 'toon-soft' as const, parameters: { ...DEFAULT_STYLE_PARAMETERS, pixelSize: 99, galleryRim: 0.3333 } };
    const url = buildSceneShareUrl(`${base}/bless/`, { sceneId: 'crane', locale: 'ja', visual })!;
    expect(new URL(url).pathname).toBe('/bless/share.html');
    expect(parseSceneShareUrl(url)).toEqual({ sceneId: 'crane', locale: 'ja', visual: {
      style: 'toon-soft', parameters: { ...DEFAULT_STYLE_PARAMETERS, pixelSize: 12, galleryRim: 0.33 },
    } });
  });

  it('accepts local preview links without classifying them as publicly shareable', () => {
    for (const site of ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173']) {
      const url = buildSceneShareUrl(site, { sceneId: 'woodfish', locale: 'en' });
      expect(url).toBeDefined();
      expect(parseSceneShareUrl(url!)).toEqual({ sceneId: 'woodfish', locale: 'en' });
      expect(isPublicShareBaseUrl(site)).toBe(false);
    }
  });

  it('accepts an already configured share.html path without nesting another page', () => {
    expect(buildSceneShareUrl(`${base}/bless/share.html?old=value`, { sceneId: 'crane', locale: 'en' }))
      .toBe(`${base}/bless/share.html?v=1&scene=crane&lang=en`);
  });

  it.each(['unknown-scene', 'lantern', 'paper-pinwheel', 'remote.Scene@1', '../woodfish'])('rejects hidden or unbundled scene %s', sceneId => {
    expect(buildSceneShareUrl(base, { sceneId, locale: 'en' })).toBeUndefined();
    expect(parseSceneShareUrl(`${base}/share.html?v=1&scene=${encodeURIComponent(sceneId)}&lang=en`)).toBeUndefined();
  });

  it.each([
    'http://yinian.app', 'https://user:password@yinian.app', 'file:///tmp', 'javascript:alert(1)',
    'https://localhost', 'https://127.0.0.1', 'https://0x7f000001', 'https://2130706433',
    'https://10.0.0.1', 'https://172.20.0.1', 'https://192.168.1.2', 'https://169.254.1.1',
    'https://100.64.1.1', 'https://0.0.0.0', 'https://224.0.0.1', 'https://192.0.2.1',
    'https://[::1]', 'https://[::ffff:192.168.1.2]', 'https://[fc00::1]', 'https://[fe80::1]', 'https://[2001:db8::1]',
    'https://bless.local', 'https://site.test', 'https://site.invalid', 'https://example.com',
    'https://share.example.org', 'https://example.net', 'https://your-domain.com', 'https://intranet',
    'https://bless.home.arpa', 'https://localhost.localdomain', 'https://bless.corp',
    'http://127.yinian.app', 'http://127.0.0.1.yinian.app',
  ])('keeps private, unsafe or placeholder base %s out of outward shares', site => {
    expect(isPublicShareBaseUrl(site)).toBe(false);
    expect(buildSceneShareUrl(site, { sceneId: 'woodfish', locale: 'en' })).toBeUndefined();
  });

  it('recognizes public HTTPS hosts while ignoring removable base query and fragment', () => {
    expect(isPublicShareBaseUrl(`${base}/app?old=value#anchor`)).toBe(true);
    expect(isPublicShareBaseUrl('https://8.8.8.8')).toBe(true);
    expect(isPublicShareBaseUrl('https://[2606:4700:4700::1111]')).toBe(true);
    expect(isPublicShareBaseUrl('https://yini\nan.app')).toBe(false);
  });

  it.each([
    simple + '&wish=PRIVATE', simple + '&model=https://external.app/model.glb', simple + '&user=private',
    simple + '&scene=crane', simple + '&%73cene=crane', simple + '&v=1', simple + '&lang=en',
    simple.replace('v=1', 'v=2'), simple.replace('lang=zh-Hans', 'lang=unknown'),
    simple.replace('share.html', 'index.html'), simple + '#fragment',
    simple + '&style=unknown', simple + '&params=%7B%7D',
    simple + '&style=toon-soft&params=null', simple + '&style=toon-soft&params=%5B1%5D',
    simple + '&style=toon-soft&params=%7B%22pixelSize%22%3A%22https%3A%2F%2Fexternal.app%22%7D',
    simple + '&style=toon-soft&params=%7B%22model%22%3A1%7D',
    simple + '&style=toon-soft&params=%7B%22pixelSize%22%3A1e999%7D',
    simple + '&style=toon-soft&params=%7B%22pixelSize%22%3A2%2C%22pixelSize%22%3A3%7D',
    simple + '&style=toon-soft&params=' + 'x'.repeat(3000),
    simple + '&unknown=' + 'x'.repeat(5000),
  ].map(raw => [raw.slice(0, 130), raw]))('rejects malformed, duplicate or untrusted payload %s', (_label, raw) => {
    expect(parseSceneShareUrl(raw)).toBeUndefined();
  });

  it('defaults missing shader controls and rounds only known finite numbers', () => {
    expect(parseSceneShareUrl(simple + '&style=pixel-art')).toEqual({ sceneId: 'woodfish', locale: 'zh-Hans',
      visual: { style: 'pixel-art', parameters: { ...DEFAULT_STYLE_PARAMETERS } } });
    expect(parseSceneShareUrl(simple + '&style=pixel-art&params=%7B%22pixelSize%22%3A4.9%7D')?.visual?.parameters.pixelSize).toBe(5);
  });

  it('validates caller-supplied details instead of serializing arbitrary fields', () => {
    expect(buildSceneShareUrl(base, { sceneId: 'crane', locale: 'unknown' } as never)).toBeUndefined();
    expect(buildSceneShareUrl(base, { sceneId: 'crane', locale: 'en', visual: { style: 'evil', parameters: {} } } as never)).toBeUndefined();
    expect(buildSceneShareUrl(base, { sceneId: 'crane', locale: 'en', visual: { style: 'toon-soft', parameters: { pixelSize: Infinity } } } as never)).toBeUndefined();
    expect(buildSceneShareUrl(base, { sceneId: 'crane', locale: 'en', visual: { style: 'toon-soft', parameters: { model: 1 } } } as never)).toBeUndefined();
    const url = buildSceneShareUrl(base, { sceneId: 'crane', locale: 'en', wish: 'PRIVATE' } as never)!;
    expect(url).not.toContain('PRIVATE');
    expect(parseSceneShareUrl(url)).toEqual({ sceneId: 'crane', locale: 'en' });
  });
});
