import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const filename = new URL('../apps/mobile-expo/internal-tools.ts', import.meta.url);

function detector({ dev = false, platform = 'ios', native = null, throws = false } = {}) {
  const { code } = transformSync(readFileSync(filename, 'utf8'), { filename: filename.pathname, babelrc: false, configFile: false,
    presets: [require.resolve('babel-preset-expo')], caller: { name: 'metro', platform, isDev: dev, isServer: false, bundler: 'metro', supportsStaticESM: false } });
  const module = { exports: {} };
  const context = { module, exports: module.exports, __DEV__: dev, require: name => {
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === 'expo') return { requireOptionalNativeModule: () => { if (throws) throw Error('unavailable'); return native; } };
    if (name.startsWith('@babel/runtime/')) return require(name);
    throw Error(`Unexpected import ${name}`);
  } };
  vm.runInNewContext(code, context);
  return module.exports.detectInternalToolsEnabled;
}

test('development enables tools without a native module', async () => {
  assert.equal(await detector({ dev: true, throws: true })(), true);
});
test('release enables tools only for an affirmative iOS TestFlight runtime result', async () => {
  assert.equal(await detector({ native: { isTestFlightAsync: async () => true } })(), true);
  for (const value of [false, undefined, 'true', 1]) {
    assert.equal(await detector({ native: { isTestFlightAsync: async () => value } })(), false);
  }
  assert.equal(await detector({ platform: 'android', native: { isTestFlightAsync: async () => true } })(), false);
});
test('missing or failed native detection closes tools without failing startup', async () => {
  assert.equal(await detector()(), false);
  assert.equal(await detector({ throws: true })(), false);
  assert.equal(await detector({ native: { isTestFlightAsync: async () => { throw Error('offline'); } } })(), false);
});
test('a fresh runtime decision cannot retain TestFlight access after store promotion', async () => {
  let sandbox = true;
  const detect = detector({ native: { isTestFlightAsync: async () => sandbox } });
  assert.equal(await detect(), true);
  sandbox = false;
  assert.equal(await detect(), false);
});
