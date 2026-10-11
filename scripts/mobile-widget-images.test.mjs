import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
function setup({ gate = Promise.resolve(), failOnce = false } = {}) {
  const files = new Map(), copies = [];
  class Directory {
    constructor(...parts) { const [first, ...rest] = parts.map(p => p.uri ?? p); this.uri = [first.replace(/\/$/, ''), ...rest].join('/'); }
    create() {}
  }
  class File extends Directory {
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri) ?? 0; }
    delete() { files.delete(this.uri); }
    async copy(target) { copies.push(target.uri); await gate; files.set(target.uri, 100); if (failOnce) { failOnce = false; throw Error('copy failed'); } }
    async move(target) { files.set(target.uri, this.size); this.delete(); }
  }
  const cache = new Map();
  function compile(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const instance = { exports: {} }; cache.set(filename, instance);
    const code = transformSync(readFileSync(filename, 'utf8'), { filename, configFile: false, babelrc: false,
      presets: [require.resolve('babel-preset-expo')], caller: { name: 'metro', platform: 'ios', isDev: false, bundler: 'metro', supportsStaticESM: false } }).code;
    const mockedRequire = name => {
      if (name.startsWith('@babel/runtime/')) return require(name);
      if (name === 'expo-asset') return { Asset: { fromModule: id => ({ downloadAsync: async () => ({ localUri: `file:///asset/${id}`, }) }) } };
      if (name === 'expo-file-system') return { Directory, File };
      if (name.endsWith('.png')) return name;
      if (name.endsWith('.json')) return JSON.parse(readFileSync(path.resolve(path.dirname(filename), name), 'utf8'));
      if (name.startsWith('.')) return compile(path.resolve(path.dirname(filename), `${name}.ts`));
      throw Error(`Unexpected image helper dependency: ${name}`);
    };
    vm.runInNewContext(code, { module: instance, exports: instance.exports, require: mockedRequire });
    return instance.exports;
  }
  return { ...compile(path.join(root, 'apps/mobile-expo/widget-images.ts')), files, copies };
}
test('copies both sizes to versioned App Group paths before returning, then reuses them', async () => {
  let release;
  const context = setup({ gate: new Promise(resolve => { release = resolve; }) });
  let complete = false;
  const pending = context.prepareWidgetImages('file:///group/ExpoWidgets').then(paths => { complete = true; return paths; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(complete, false);
  release();
  const paths = await pending;
  assert.equal(Object.keys(paths).length, 12);
  assert.equal(context.copies.length, 24);
  assert.match(paths.crane.small, /^file:\/\/\/group\/ExpoWidgets\/covers-[a-f0-9]+\/crane-small.png$/);
  assert.ok(paths.crane.medium.endsWith('crane-medium.png'));
  assert.equal([...context.files.keys()].filter(uri => uri.endsWith('.tmp')).length, 0);
  await context.prepareWidgetImages('file:///group/ExpoWidgets');
  assert.equal(context.copies.length, 24);
});
test('a failed copy leaves no partial final image and allows the next refresh to retry', async () => {
  const context = setup({ failOnce: true });
  await assert.rejects(context.prepareWidgetImages('file:///group/ExpoWidgets'), /copy failed/);
  assert.equal(context.files.size, 0);
  const paths = await context.prepareWidgetImages('file:///group/ExpoWidgets');
  assert.ok(context.files.has(paths.generic.small));
  assert.equal(context.files.size, 24);
});
