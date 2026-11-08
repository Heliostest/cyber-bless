/** Optional for historical inputs; new release inputs should state the decision explicitly. */
export function internalUpdatesEnabled(input = {}) {
  if (input.internalUpdates === undefined) return false;
  if (typeof input.internalUpdates !== 'boolean') throw Error('Frozen internalUpdates must be a boolean');
  return input.internalUpdates;
}

export function releaseUpdateEnvironment(input) {
  return { EXPO_INTERNAL_UPDATES: internalUpdatesEnabled(input) ? '1' : '0' };
}

export function assertInternalUpdateMode(expected, actual) {
  if (internalUpdatesEnabled(expected) !== internalUpdatesEnabled(actual)) throw Error('Frozen internal update mode differs from the release input or stage receipt');
}

/** Check the actual evaluated config before generating a native project or fingerprint. */
export function assertReleaseUpdateExpoConfig(release, expo) {
  const enabled = internalUpdatesEnabled(release);
  if (expo?.updates?.enabled !== enabled) throw Error('Evaluated Expo update mode differs from frozen release mode; formal updates must be disabled');
  if (!enabled) return { internalUpdates: false, runtimePolicy: null, signingKeyId: null };
  const updates = expo.updates;
  if (expo.runtimeVersion?.policy !== 'fingerprint') throw Error('Internal native builds require the actual fingerprint runtime policy');
  if (updates.url !== 'https://feedback.heliosoft.win/api/internal-updates/check' || updates.checkAutomatically !== 'NEVER' || updates.fallbackToCacheTimeout !== 0 ||
      updates.codeSigningCertificate !== './certs/internal-updates.pem' || updates.codeSigningMetadata?.keyid !== 'main' || updates.codeSigningMetadata?.alg !== 'rsa-v1_5-sha256') throw Error('Internal native update transport/signing configuration differs from the reviewed configuration');
  const headers = updates.requestHeaders;
  if (!headers || Object.keys(headers).length !== 2 || headers['expo-channel-name'] !== 'internal' || headers['X-Feedback-Token'] !== '') throw Error('Native update headers must contain only the internal channel and an empty invitation override placeholder');
  return { internalUpdates: true, runtimePolicy: 'fingerprint', signingKeyId: 'main' };
}
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);


/** Capture evaluated non-public config privately; public mode deliberately removes native signing fields. */
export async function inspectEvaluatedReleaseUpdateConfig(release, { env }) {
  if (!path.isAbsolute(release.repo ?? '') || !path.isAbsolute(release.nodeBinary ?? '')) throw Error('Expected absolute release config evaluation paths');
  let stdout;
  try {
    ({ stdout } = await execute(release.nodeBinary, [path.join(release.repo, 'node_modules/expo/bin/cli'), 'config', '--json'], {
      cwd: path.join(release.repo, 'apps/mobile-expo'), env: { ...env, ...releaseUpdateEnvironment(release), EXPO_NO_DOTENV: '1' },
      windowsHide: true, maxBuffer: 16 * 1024 * 1024,
    }));
  } catch { throw Error('Unable to evaluate the native Expo update config; process output withheld'); }
  let evaluated;
  try { evaluated = JSON.parse(stdout); } catch { throw Error('Native Expo configuration evaluation returned invalid JSON'); }
  return assertReleaseUpdateExpoConfig(release, evaluated);
}
