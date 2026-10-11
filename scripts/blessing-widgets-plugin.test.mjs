import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const withBlessingWidgets = require('../apps/mobile-expo/plugins/withBlessingWidgets.cjs');

function config() {
  return {
    name: '一日一念', slug: 'cyber-bless', scheme: 'cyber-bless',
    android: { package: 'com.helio.cyberbless' },
    ios: { bundleIdentifier: 'com.helio.cyberbless', appleTeamId: '6PG2WW6L6N' },
  };
}

async function gradleProperties(input, properties) {
  const result = withBlessingWidgets(input);
  return (await result.mods.android.gradleProperties({
    ...result,
    modResults: properties,
    modRequest: { platform: 'android', modName: 'gradleProperties', introspect: true },
  })).modResults;
}

test('repeated CNG application preserves identity and raises an older min SDK once', async () => {
  const input = config();
  const before = structuredClone(input);
  const first = await gradleProperties(input, [
    { type: 'property', key: 'android.minSdkVersion', value: '21' },
    { type: 'property', key: 'some.user.property', value: 'kept' },
  ]);
  const second = await gradleProperties(config(), first);
  assert.deepEqual(second, [
    { type: 'property', key: 'android.minSdkVersion', value: '24' },
    { type: 'property', key: 'some.user.property', value: 'kept' },
  ]);
  assert.deepEqual(input.android, before.android);
  assert.deepEqual(input.ios, before.ios);
  assert.equal(input.scheme, before.scheme);
});

test('higher Android minimum and existing extra schemes are preserved', async () => {
  const input = config();
  input.scheme = ['cyber-bless', 'exp+cyber-bless'];
  assert.deepEqual(await gradleProperties(input, [
    { type: 'property', key: 'android.minSdkVersion', value: '28' },
  ]), [{ type: 'property', key: 'android.minSdkVersion', value: '28' }]);
  assert.deepEqual(input.scheme, ['cyber-bless', 'exp+cyber-bless']);
});

test('configuration fails early when the app cannot receive the widget URL', () => {
  const input = config();
  input.scheme = 'wrong';
  assert.throws(() => withBlessingWidgets(input), /cyber-bless/);
});

test('missing Android identity fails without inventing an application id', () => {
  const input = config();
  delete input.android.package;
  assert.throws(() => withBlessingWidgets(input), /android.package/);
});
