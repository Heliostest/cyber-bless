import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
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

test('read-only widgets remove the upstream APNs entitlement while preserving the shared group', async () => {
  const upstream = require(path.join(path.dirname(require.resolve('expo-widgets/package.json')),
    'plugin/build/ios/withPushNotifications.js')).default;
  for (const enabled of [false, true]) {
    const input = config();
    input.plugins = [['expo-widgets', { enablePushNotifications: enabled }]];
    // Expo runs entitlement mod actions in reverse plugin registration order.
    const result = upstream(withBlessingWidgets(input), { enablePushNotifications: enabled });
    const entitlements = (await result.mods.ios.entitlements({
      ...result,
      modResults: { 'com.apple.security.application-groups': ['group.com.helio.cyberbless.widgets'] },
      modRequest: { platform: 'ios', modName: 'entitlements', introspect: true },
    })).modResults;
    assert.deepEqual(entitlements['com.apple.security.application-groups'], ['group.com.helio.cyberbless.widgets']);
    assert.equal(entitlements['aps-environment'], enabled ? 'development' : undefined);
  }
});

test('Android keeps a replacement widget intent for Linking after the process is restored', async () => {
  const original = `package com.helio.cyberbless
import com.facebook.react.ReactActivity
class MainActivity : ReactActivity() {
  override fun getMainComponentName(): String = "main"
}
`;
  async function mainActivity(contents) {
    const result = withBlessingWidgets(config());
    assert.equal(typeof result.mods.android.mainActivity, 'function');
    return (await result.mods.android.mainActivity({
      ...result,
      modResults: { language: 'kt', contents },
      modRequest: { platform: 'android', modName: 'mainActivity', introspect: true },
    })).modResults.contents;
  }
  const first = await mainActivity(original);
  const second = await mainActivity(first);
  assert.equal(second, first);
  assert.match(first, /override fun onNewIntent\(intent: android\.content\.Intent\)/);
  assert.ok(first.indexOf('setIntent(intent)') < first.indexOf('super.onNewIntent(intent)'));
  assert.equal(first.match(/override fun onNewIntent/g).length, 1);
  assert.match(first, /override fun getMainComponentName\(\): String = "main"/);
});
