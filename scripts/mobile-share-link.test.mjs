import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as sceneShare from '../packages/core/src/scene-share.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const url = 'https://yinian.app/share.html?v=1&scene=woodfish&lang=zh-Hans';
const request = { title: '木鱼静听', text: '留下一份此刻的心情。', url };

function setup(platform = 'android', error) {
  const calls = [];
  const filename = path.join(root, 'apps/mobile-expo/share-link.ts');
  const code = transformSync(readFileSync(filename, 'utf8'), { filename, configFile: false, babelrc: false,
    presets: [require.resolve('babel-preset-expo')], caller: { name: 'metro', platform, isDev: false, bundler: 'metro', supportsStaticESM: false } }).code;
  const module = { exports: {} };
  const mockedRequire = name => {
    if (name.startsWith('@babel/runtime/')) return require(name);
    if (name === '@wbr/core/scene-share') return sceneShare;
    if (name === 'react-native') return { Platform: { OS: platform }, Share: {
      share: async (content, options) => {
        calls.push(JSON.parse(JSON.stringify({ content, options })));
        if (error) throw error;
        return { action: 'dismissedAction', activityType: null };
      },
    } };
    throw Error(`Unexpected native share dependency: ${name}`);
  };
  vm.runInNewContext(code, { module, exports: module.exports, require: mockedRequire });
  return { ...module.exports, calls };
}

test('Android receives the actual public scene URL in its text message', async () => {
  const context = setup();
  assert.equal(await context.shareLink(request), undefined);
  assert.deepEqual(context.calls, [{ content: { title: '木鱼静听', message: `留下一份此刻的心情。\n${url}` },
    options: { dialogTitle: '木鱼静听' } }]);
});

test('iOS receives the URL as a URL item and cancellation resolves without claiming delivery', async () => {
  const context = setup('ios');
  assert.equal(await context.shareLink(request), undefined);
  assert.deepEqual(context.calls[0].content, { title: '木鱼静听', message: '留下一份此刻的心情。', url });
});

test('preview, private, external-resource and invalid scene links never open the native share sheet', async () => {
  const context = setup();
  for (const invalid of [
    url.replace('https://yinian.app', 'http://localhost:5173'),
    url.replace('yinian.app', '192.168.1.2'),
    url.replace('yinian.app', 'example.com'),
    url.replace('woodfish', 'paper-pinwheel'),
    url + '&model=https://external.app/model.glb', url + '&wish=PRIVATE',
    'javascript:alert(1)', 'https://yinian.app/',
  ]) await assert.rejects(context.shareLink({ ...request, url: invalid }));
  assert.equal(context.calls.length, 0);
});

test('malformed or oversized bridge content is rejected before calling the system', async () => {
  const context = setup();
  for (const value of [null, {}, { ...request, title: '' }, { ...request, title: 'x'.repeat(201) },
    { ...request, text: 'x'.repeat(2001) }, { ...request, text: null }]) {
    await assert.rejects(context.shareLink(value));
  }
  assert.equal(context.calls.length, 0);
});

test('native sheet failures propagate for the shared UI to present a retry', async () => {
  const context = setup('android', Error('native sheet unavailable'));
  await assert.rejects(context.shareLink(request), /native sheet unavailable/);
});
