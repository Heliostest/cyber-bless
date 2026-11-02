import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const filename = new URL('../apps/mobile-expo/internal-tools.ts', import.meta.url);

function detector({ enabled = true, dev = false, platform = 'ios' } = {}) {
  const { code } = transformSync(readFileSync(filename, 'utf8'), { filename: filename.pathname, babelrc: false, configFile: false,
    presets: [require.resolve('babel-preset-expo')], caller: { name: 'metro', platform, isDev: dev, isServer: false, bundler: 'metro', supportsStaticESM: false } });
  const module = { exports: {} };
  const context = { module, exports: module.exports, __DEV__: dev, require: name => {
    if (name === '@wbr/app/internal-tools-config') return { INTERNAL_TOOLS_ENABLED: enabled };
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === 'expo') return { requireOptionalNativeModule: () => { throw Error('Build access must not depend on a store receipt'); } };
    if (name.startsWith('@babel/runtime/')) return require(name);
    throw Error(`Unexpected import ${name}`);
  } };
  vm.runInNewContext(code, context);
  return module.exports.detectInternalToolsEnabled;
}

test('enabled builds open tools on iOS and Android without native receipt detection', async () => {
  for (const platform of ['ios', 'android']) for (const dev of [true, false]) {
    assert.equal(await detector({ platform, dev })(), true);
  }
});

test('the build switch closes tools consistently when internal testing is finished', async () => {
  for (const platform of ['ios', 'android']) for (const dev of [true, false]) {
    assert.equal(await detector({ enabled: false, platform, dev })(), false);
  }
});

test('native startup and the browser host use the same small build configuration', () => {
  const native = readFileSync(new URL('../apps/mobile-expo/App.tsx', import.meta.url), 'utf8');
  const browser = readFileSync(new URL('../apps/cyber-bless/src/App.tsx', import.meta.url), 'utf8');
  assert.match(native, /useState\(INTERNAL_TOOLS_ENABLED\)/);
  assert.match(browser, /if \(INTERNAL_TOOLS_ENABLED\) host\.testFeedback/);
  assert.match(browser, /internalToolsEnabled=\{INTERNAL_TOOLS_ENABLED\}/);
});
