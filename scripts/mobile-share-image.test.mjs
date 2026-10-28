import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFqkAAAAASUVORK5CYII=';
const request = { dataUrl: `data:image/png;base64,${png}`, fileName: 'ritual-moment.png', title: '这一刻' };

function setup({ available = true, rejectShare = false, rejectWrite = false } = {}) {
  const files = new Map(), shares = [];
  class Directory {
    constructor(...parts) { this.uri = parts.map(part => part.uri ?? part).join('/'); }
    create() {}
    list() { return [...files.keys()].filter(uri => uri.startsWith(`${this.uri}/`)).map(uri => new File(uri)); }
  }
  class File extends Directory {
    get exists() { return files.has(this.uri); }
    get lastModified() { return files.get(this.uri)?.modified ?? null; }
    create() { files.set(this.uri, { bytes: Buffer.alloc(0), modified: Date.now() }); }
    write(content, options) {
      if (rejectWrite) throw Error('disk full');
      files.set(this.uri, { bytes: Buffer.from(content, options?.encoding), modified: Date.now() });
    }
    delete() { files.delete(this.uri); }
  }
  const filename = path.join(root, 'apps/mobile-expo/share-image.ts');
  const code = transformSync(readFileSync(filename, 'utf8'), { filename, configFile: false, babelrc: false,
    presets: [require.resolve('babel-preset-expo')], caller: { name: 'metro', platform: 'ios', isDev: false, bundler: 'metro', supportsStaticESM: false } }).code;
  const module = { exports: {} };
  const mockedRequire = name => {
    if (name.startsWith('@babel/runtime/')) return require(name);
    if (name === 'expo-file-system') return { Directory, File, Paths: { cache: 'file:///cache' } };
    if (name === 'expo-sharing') return {
      isAvailableAsync: async () => available,
      shareAsync: async (uri, options) => {
        assert.ok(files.get(uri)?.bytes.equals(Buffer.from(png, 'base64')), 'the completed PNG must exist before opening the native sheet');
        shares.push({ uri, ...options });
        if (rejectShare) throw Error('sheet failed');
      },
    };
    throw Error(`Unexpected sharing dependency: ${name}`);
  };
  vm.runInNewContext(code, { module, exports: module.exports, require: mockedRequire });
  return { ...module.exports, files, shares };
}

test('writes PNG bytes before opening the native image sheet and retains the file for delayed readers', async () => {
  const context = setup();
  await context.shareImage(request);
  assert.equal(context.shares.length, 1);
  const share = context.shares[0];
  assert.equal(share.mimeType, 'image/png');
  assert.equal(share.UTI, 'public.png');
  assert.equal(share.dialogTitle, '这一刻');
  assert.match(share.uri, /^file:\/\/\/cache\/wbr-shared-images-v1\/.+ritual-moment\.png$/);
  assert.ok(context.files.has(share.uri));
});

test('gives repeated shares their own retained file instead of overwriting an earlier recipient', async () => {
  const context = setup();
  await context.shareImage(request);
  await context.shareImage(request);
  assert.equal(context.files.size, 2);
  assert.notEqual(context.shares[0].uri, context.shares[1].uri);
});

test('cleans only expired files in the dedicated cache and preserves recent shared images', async () => {
  const context = setup();
  const old = 'file:///cache/wbr-shared-images-v1/old.png';
  const recent = 'file:///cache/wbr-shared-images-v1/recent.png';
  const unrelated = 'file:///cache/scene-model.glb';
  context.files.set(old, { bytes: Buffer.from(png, 'base64'), modified: Date.now() - 49 * 60 * 60 * 1000 });
  context.files.set(recent, { bytes: Buffer.from(png, 'base64'), modified: Date.now() - 60 * 60 * 1000 });
  context.files.set(unrelated, { bytes: Buffer.alloc(1), modified: 1 });
  await context.shareImage(request);
  assert.equal(context.files.has(old), false);
  assert.equal(context.files.has(recent), true);
  assert.equal(context.files.has(unrelated), true);
});

test('rejects unavailable native sharing before writing a temporary file', async () => {
  const context = setup({ available: false });
  await assert.rejects(context.shareImage(request));
  assert.equal(context.files.size, 0);
  assert.equal(context.shares.length, 0);
});

test('rejects malformed, non-PNG and oversized data without touching the filesystem', async () => {
  const context = setup();
  for (const dataUrl of ['data:image/jpeg;base64,' + png, 'data:image/png;base64,', 'data:image/png;base64,Zm9v', 'data:image/png;base64,' + png + '?', 'data:image/png;base64,' + 'A'.repeat(17 * 1024 * 1024)]) {
    await assert.rejects(context.shareImage({ ...request, dataUrl }));
  }
  assert.equal(context.files.size, 0);
  assert.equal(context.shares.length, 0);
});

test('rejects file names that could escape the dedicated PNG cache', async () => {
  const context = setup();
  for (const fileName of ['../secret.png', 'sub/image.png', 'sub\\image.png', 'file:///image.png', 'image.jpg', '', 'a'.repeat(200) + '.png']) {
    await assert.rejects(context.shareImage({ ...request, fileName }));
  }
  assert.equal(context.files.size, 0);
});

test('a failed write removes the incomplete file and never opens the sheet', async () => {
  const context = setup({ rejectWrite: true });
  await assert.rejects(context.shareImage(request), /disk full/);
  assert.equal(context.files.size, 0);
  assert.equal(context.shares.length, 0);
});

test('native sheet errors propagate while the completed PNG remains available', async () => {
  const context = setup({ rejectShare: true });
  await assert.rejects(context.shareImage(request), /sheet failed/);
  assert.equal(context.files.size, 1);
});
