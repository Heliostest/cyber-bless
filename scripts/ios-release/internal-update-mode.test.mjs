import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('frozen update mode defaults off, requires a boolean, and creates explicit build environment values', async () => {
  const { internalUpdatesEnabled, releaseUpdateEnvironment, assertInternalUpdateMode } = await import('./internal-update-mode.mjs');
  assert.equal(internalUpdatesEnabled({}), false);
  assert.deepEqual(releaseUpdateEnvironment({}), { EXPO_INTERNAL_UPDATES: '0' });
  assert.deepEqual(releaseUpdateEnvironment({ internalUpdates: true }), { EXPO_INTERNAL_UPDATES: '1' });
  for (const value of ['1', 'false', 0, 1, null]) assert.throws(() => internalUpdatesEnabled({ internalUpdates: value }), /boolean/i);
  assert.throws(() => assertInternalUpdateMode({ internalUpdates: true }, {}), /internal.*update|mode/i);
  assert.throws(() => assertInternalUpdateMode({}, { internalUpdates: true }), /internal.*update|mode/i);
  assert.doesNotThrow(() => assertInternalUpdateMode({ internalUpdates: false }, {}));
});

test('preparation refuses an evaluated Expo config that differs from its frozen update mode', async () => {
  const { assertReleaseUpdateExpoConfig } = await import('./internal-update-mode.mjs');
  const internal = { updates: { enabled: true, url: 'https://feedback.heliosoft.win/api/internal-updates/check', checkAutomatically: 'NEVER',
    fallbackToCacheTimeout: 0, codeSigningCertificate: './certs/internal-updates.pem', codeSigningMetadata: { keyid: 'main', alg: 'rsa-v1_5-sha256' }, requestHeaders: { 'expo-channel-name': 'internal', 'X-Feedback-Token': '' } }, runtimeVersion: { policy: 'fingerprint' } };
  assert.doesNotThrow(() => assertReleaseUpdateExpoConfig({}, { updates: { enabled: false } }));
  assert.doesNotThrow(() => assertReleaseUpdateExpoConfig({ internalUpdates: true }, internal));
  assert.throws(() => assertReleaseUpdateExpoConfig({}, internal), /mode|disabled/i);
  assert.throws(() => assertReleaseUpdateExpoConfig({ internalUpdates: true }, { updates: { enabled: false } }), /mode|enabled/i);
  for (const change of [{ runtimeVersion: 'arbitrary-runtime' }, { updates: { ...internal.updates, codeSigningCertificate: undefined } },
    { updates: { ...internal.updates, requestHeaders: { ...internal.updates.requestHeaders, 'X-Feedback-Token': 'must-not-be-built' } } }]) {
    assert.throws(() => assertReleaseUpdateExpoConfig({ internalUpdates: true }, { ...internal, ...change }), /runtime|sign|header|invitation/i);
  }
});

test('real installed Expo evaluation retains native signing settings without logging the full config', async () => {
  const { inspectEvaluatedReleaseUpdateConfig } = await import('./internal-update-mode.mjs');
  const repo = fileURLToPath(new URL('../../', import.meta.url));
  for (const internalUpdates of [false, true]) {
    const result = await inspectEvaluatedReleaseUpdateConfig({ repo: path.resolve(repo), nodeBinary: process.execPath, internalUpdates }, {
      env: { ...process.env, EXPO_INTERNAL_UPDATES: internalUpdates ? '1' : '0', EXPO_NO_DOTENV: '1', CI: '1' },
    });
    assert.equal(result.internalUpdates, internalUpdates);
    assert.equal(result.runtimePolicy, internalUpdates ? 'fingerprint' : null);
    assert.equal(result.signingKeyId, internalUpdates ? 'main' : null);
    assert.deepEqual(Object.keys(result).sort(), ['internalUpdates', 'runtimePolicy', 'signingKeyId']);
  }
});
