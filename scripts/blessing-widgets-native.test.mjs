import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const require = createRequire(import.meta.url);
const mobile = fileURLToPath(new URL('../apps/mobile-expo/', import.meta.url));
const autolink = require.resolve('expo-modules-autolinking/bin/expo-modules-autolinking');

function resolve(platform) {
  return JSON.parse(execFileSync(process.execPath, [autolink, 'resolve', '--platform', platform, '--json'], {
    cwd: mobile, encoding: 'utf8', timeout: 30_000,
  }));
}

test('Expo discovers the local Android module once with the real module class', () => {
  const resolved = resolve('android');
  const native = resolved.modules.filter((module) => module.packageName === 'blessing-widgets');
  assert.equal(native.length, 1);
  assert.deepEqual(native[0].projects.flatMap((project) => project.modules.map((module) => module.classifier)),
    ['com.helio.blessingwidgets.BlessingWidgetsModule']);
  assert.ok(native[0].coreFeatures.includes('compose'));
  assert.equal(native[0].projects.length, 1);
});

test('Android-only module does not create a second Apple extension', () => {
  assert.equal(resolve('apple').modules.filter((module) => module.packageName === 'blessing-widgets').length, 0);
});
