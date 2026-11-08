import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// React Native modules cannot run in Node. The boundary below supplies Expo's
// downloaded module URI; file validation/base64 still read real fixture bytes.
const boundary = vi.hoisted(() => ({
  local: {} as Record<number, string | null>,
  resources: {} as Record<string, string>,
  moduleResources: {} as Record<number, string>,
  registry: {} as Record<string, { module: number; bytes: number; md5: string }>,
}));
vi.mock('./bundled-assets.generated', () => ({ bundledAssetModules: boundary.registry }));
vi.mock('expo-asset', () => ({ Asset: class {
  localUri: string | null;
  constructor({ uri }: { uri: string }) {
    this.localUri = uri.startsWith('fixture:') ? boundary.local[Number(uri.slice(8))] : boundary.resources[uri] ?? uri;
  }
  static fromModule(module: number) {
    if (!Object.hasOwn(boundary.local, module)) throw Error('Module not registered');
    return { name: 'fixture', type: 'bin', uri: boundary.moduleResources[module] ?? `fixture:${module}` };
  }
  async downloadAsync() { return this; }
} }));
vi.mock('expo-file-system', async () => {
  const { existsSync, readFileSync, statSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const { createHash } = await import('node:crypto');
  return { File: class {
    file: string;
    constructor(uri: string) { this.file = fileURLToPath(uri); }
    get exists() { return existsSync(this.file); }
    get size() { return statSync(this.file).size; }
    get md5() { return createHash('md5').update(readFileSync(this.file)).digest('hex'); }
    async base64() { return readFileSync(this.file).toString('base64'); }
  } };
});

const sound = 'ui-sounds/soft-garden-v1/navigate.wav';
let directory: string;
function fixture(file: string, module: number, bytes: Uint8Array | string) {
  const local = path.join(directory, `${module}.asset`);
  writeFileSync(local, bytes);
  boundary.local[module] = pathToFileURL(local).href;
  boundary.registry[file] = { module, bytes: Buffer.byteLength(bytes), md5: createHash('md5').update(bytes).digest('hex') };
  return boundary.local[module]!;
}
beforeEach(() => {
  vi.resetModules();
  for (const key of Object.keys(boundary.registry)) delete boundary.registry[key];
  for (const key of Object.keys(boundary.local)) delete boundary.local[Number(key)];
  for (const key of Object.keys(boundary.resources)) delete boundary.resources[key];
  for (const key of Object.keys(boundary.moduleResources)) delete boundary.moduleResources[Number(key)];
  directory = mkdtempSync(path.join(tmpdir(), 'wbr-assets-test-'));
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('native registered assets', () => {
  it('materializes a registered Android embedded drawable before returning a DOM file URI', async () => {
    const uri = fixture('scene-icons/soft3d/woodfish.webp', 103, 'WEBP');
    boundary.moduleResources[103] = 'assets_sceneicons_soft3d_woodfish';
    boundary.resources.assets_sceneicons_soft3d_woodfish = uri;
    const { resolveBundledAssetUris } = await import('./bundled-assets');
    expect(await resolveBundledAssetUris()).toEqual({ 'scene-icons/soft3d/woodfish.webp': uri });
  });

  it('returns downloaded module files and reads sounds from those same files', async () => {
    const font = fixture('fonts/noto-sans-sc.woff2', 101, 'FONT');
    const wav = fixture(sound, 102, 'WAVE');
    const { resolveBundledAssetUris } = await import('./bundled-assets');
    expect(await resolveBundledAssetUris()).toEqual({ 'fonts/noto-sans-sc.woff2': font, [sound]: wav });
    const { readUiSound } = await import('./ui-sound');
    expect(await readUiSound(sound)).toBe('V0FWRQ==');
  });

  it('rejects incomplete downloads, then permits a repaired local file', async () => {
    const uri = fixture(sound, 102, 'WAVE');
    writeFileSync(new URL(uri), 'WA');
    const { resolveBundledAssetUris } = await import('./bundled-assets');
    await expect(resolveBundledAssetUris()).rejects.toThrow(/unavailable|changed/i);
    writeFileSync(new URL(uri), 'WAVE');
    expect(await resolveBundledAssetUris()).toEqual({ [sound]: uri });
  });

  it('rejects a stale same-size local file', async () => {
    const uri = fixture(sound, 102, 'WAVE');
    writeFileSync(new URL(uri), 'OLD!');
    const { resolveBundledAssetUris } = await import('./bundled-assets');
    await expect(resolveBundledAssetUris()).rejects.toThrow(/unavailable|changed/i);
  });

  it('rejects a missing local file', async () => {
    const uri = fixture(sound, 102, 'WAVE');
    rmSync(new URL(uri));
    const { resolveBundledAssetUris } = await import('./bundled-assets');
    await expect(resolveBundledAssetUris()).rejects.toThrow(/unavailable|changed/i);
  });

  it.each([null, 'https://example.test/model.glb', 'file://host/a', 'file:///updates/../a'])('rejects a module without a safe downloaded URI: %s', async uri => {
    fixture(sound, 102, 'WAVE');
    boundary.local[102] = uri;
    const { resolveBundledAssetUris } = await import('./bundled-assets');
    await expect(resolveBundledAssetUris()).rejects.toThrow(/unsafe/i);
  });

  it('rejects a URI masquerading as a Metro module', async () => {
    fixture(sound, 102, 'WAVE');
    Object.assign(boundary.registry[sound], { module: 'https://example.test/asset.wav' });
    const { resolveBundledAssetUris } = await import('./bundled-assets');
    await expect(resolveBundledAssetUris()).rejects.toThrow(/unregistered/i);
  });

  it.each(['../secret', 'ui-sounds/other.wav', 'fonts/noto-sans-sc.woff2'])('blocks non-allowlisted sound reads: %s', async file => {
    const { readUiSound } = await import('./ui-sound');
    await expect(readUiSound(file)).rejects.toThrow(/unknown ui sound/i);
  });

  it.each([0, 100001])('blocks registered sound files outside the bridge size limit: %s', async size => {
    fixture(sound, 102, new Uint8Array(size));
    const { readUiSound } = await import('./ui-sound');
    await expect(readUiSound(sound)).rejects.toThrow(/sound unavailable/i);
  });
});
