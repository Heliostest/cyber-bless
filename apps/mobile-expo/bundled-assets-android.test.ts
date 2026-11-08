import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const boundary = vi.hoisted(() => ({
  directory: '',
  metadata: { name: 'wishes', type: 'png', hash: '', scales: [1], width: 1, height: 1, httpServerLocation: '/assets' },
  registry: {} as Record<string, { module: number; bytes: number; md5: string }>,
  source: new Uint8Array(),
  managed: false,
  installed: {} as Record<string, string>,
}));
const resource = 'assets_referenceui_wishes';
const image = 'reference-ui/wishes.png';
const md5 = (bytes: Uint8Array | string) => createHash('md5').update(bytes).digest('hex');

vi.mock('./bundled-assets.generated', () => ({ bundledAssetModules: boundary.registry }));
// Use the installed Expo Asset class (constructor, fromModule, fromURI and
// downloadAsync), replacing only its native/React Native dependency boundaries.
vi.mock('expo-asset', async () => await import('../../node_modules/expo-asset/build/Asset.js'));
vi.mock('@react-native/assets-registry/registry', () => ({ getAssetByID: () => boundary.metadata }));
vi.mock('expo-modules-core', () => ({ Platform: { OS: 'android' } }));
vi.mock('../../node_modules/expo-asset/build/AssetSources.js', () => ({ selectAssetSource: () => ({ uri: '', hash: boundary.metadata.hash }) }));
vi.mock('../../node_modules/expo-asset/build/ImageAssets.js', () => ({}));
vi.mock('../../node_modules/expo-asset/build/LocalAssets.js', () => ({ getLocalAssetUri: (hash: string) => boundary.installed[hash] ?? null }));
vi.mock('../../node_modules/expo-asset/build/PlatformUtils.js', () => ({ get IS_ENV_WITH_LOCAL_ASSETS() { return boundary.managed; } }));
vi.mock('../../node_modules/expo-asset/build/resolveAssetSource.js', () => ({ default: () => ({ uri: 'assets_referenceui_wishes' }) }));
vi.mock('../../node_modules/expo-asset/build/ExpoAsset.js', () => ({
  async downloadAsync(uri: string, hash: string | null, type: string) {
    if (uri !== resource) throw Error('Unknown registered resource');
    // This is AssetModule.kt's actual cache policy: hash or hash(uri) names
    // the file, and a supplied hash repairs existing bytes that no longer fit.
    const target = path.join(boundary.directory, `ExponentAsset-${hash ?? md5(uri)}.${type}`);
    if (!existsSync(target) || (hash && md5(readFileSync(target)) !== hash)) writeFileSync(target, boundary.source);
    return pathToFileURL(target).href;
  },
}));
vi.mock('expo-file-system', () => ({ File: class {
  file: string;
  constructor(uri: string) { this.file = fileURLToPath(uri); }
  get exists() { return existsSync(this.file); }
  get size() { return readFileSync(this.file).length; }
  get md5() { return md5(readFileSync(this.file)); }
} }));

beforeEach(() => {
  vi.stubGlobal('__DEV__', false);
  vi.resetModules();
  for (const key of Object.keys(boundary.registry)) delete boundary.registry[key];
  for (const key of Object.keys(boundary.installed)) delete boundary.installed[key];
  boundary.managed = false;
  boundary.metadata.type = 'png';
  boundary.directory = mkdtempSync(path.join(tmpdir(), 'wbr-android-assets-'));
  boundary.source = Buffer.from('old image bytes');
});
afterEach(() => { rmSync(boundary.directory, { recursive: true, force: true }); vi.unstubAllGlobals(); });

function setCurrent(bytes: string) {
  boundary.source = Buffer.from(bytes);
  boundary.metadata.hash = md5(boundary.source);
  boundary.registry[image] = { module: 103, bytes: boundary.source.length, md5: boundary.metadata.hash };
}

it('ignores an older hashless image cache when the APK keeps the same resource filename', async () => {
  const { Asset } = await import('expo-asset');
  const previous = await Asset.fromURI(resource).downloadAsync();
  expect(readFileSync(new URL(previous.localUri!), 'utf8')).toBe('old image bytes');
  setCurrent('new image bytes');
  const { resolveBundledAssetUris } = await import('./bundled-assets');
  const map = await resolveBundledAssetUris();
  expect(readFileSync(new URL(map[image]), 'utf8')).toBe('new image bytes');
  expect(map[image]).not.toBe(previous.localUri);
});

it('repairs a stale content cache without trusting an already downloaded hashless Asset instance', async () => {
  const { Asset } = await import('expo-asset');
  await Asset.fromURI(resource).downloadAsync();
  setCurrent('new image bytes');
  const contentCache = path.join(boundary.directory, `ExponentAsset-${boundary.metadata.hash}.png`);
  writeFileSync(contentCache, 'bad cache bytes');
  const { resolveBundledAssetUris } = await import('./bundled-assets');
  const map = await resolveBundledAssetUris();
  expect(readFileSync(new URL(map[image]), 'utf8')).toBe('new image bytes');
  expect(readFileSync(contentCache, 'utf8')).toBe('new image bytes');
});

it('uses Expo Updates installed localAssets by the current content hash without downloading', async () => {
  setCurrent('updated OTA image');
  boundary.managed = true;
  boundary.metadata.type = 'bin';
  const installed = path.join(boundary.directory, 'current-update-asset');
  writeFileSync(installed, boundary.source);
  const uri = pathToFileURL(installed).href;
  boundary.installed[boundary.metadata.hash] = uri;
  const { resolveBundledAssetUris } = await import('./bundled-assets');
  expect(await resolveBundledAssetUris()).toEqual({ [image]: uri });
});
