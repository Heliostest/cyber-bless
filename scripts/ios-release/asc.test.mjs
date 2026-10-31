import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertIdentity, assertReady, assertUploadAvailable, parseExportReservation, main, assertDeliveryReceipts, assertNumberAvailable } from './asc.mjs';

const config = { appId: '123', bundleIdentifier: 'com.example.app', version: '2.1.0', buildNumber: 27, groupId: 'existing-internal-group' };
const expo = { version: config.version, ios: { bundleIdentifier: config.bundleIdentifier, appleTeamId: 'TEAM' } };
const eas = { submit: { production: { ios: { ascAppId: config.appId, bundleIdentifier: config.bundleIdentifier, appleTeamId: 'TEAM', sku: 'app-sku' } } } };
const ready = () => ({ appId: config.appId, build: { buildNumber: '27', version: config.version, platform: 'IOS', processingState: 'VALID', internalBuildState: 'IN_BETA_TESTING', expired: false, expirationDate: new Date(Date.now() + 86400000).toISOString() }, newBuildInGroup: true, group: { id: config.groupId, isInternalGroup: true, appId: config.appId, testerCount: 1 } });

test('release identity is derived from this project rather than a fixed prior build', () => {
  assert.deepEqual(assertIdentity(config, expo, eas), { teamId: 'TEAM', sku: 'app-sku' });
  for (const change of [{ appId: 'other' }, { bundleIdentifier: 'com.other' }, { version: '1.0.0' }]) assert.throws(() => assertIdentity({ ...config, ...change }, expo, eas));
  assert.throws(() => assertIdentity(config, expo, { submit: { production: { ios: { ...eas.submit.production.ios, appleTeamId: 'OTHER' } } } }));
});

test('completion requires the exact unexpired build and existing group membership', () => {
  assert.doesNotThrow(() => assertReady(config, ready()));
  for (const change of [{ processingState: 'PROCESSING' }, { buildNumber: '26' }, { internalBuildState: 'READY_FOR_BETA_TESTING' }, { expirationDate: null }, { expired: true }]) {
    const state = ready(); Object.assign(state.build, change); assert.throws(() => assertReady(config, state));
  }
  for (const change of [{ id: 'another-group' }, { isInternalGroup: false }, { testerCount: 0 }, { appId: 'another-app' }]) {
    const state = ready(); Object.assign(state.group, change); assert.throws(() => assertReady(config, state));
  }
  assert.throws(() => assertReady(config, { ...ready(), newBuildInGroup: false }));
});

test('CLI rejects an unsupported mode before credentials or remote requests', async () => {
  await assert.rejects(main(['/tmp/release.json', 'invite']), /Usage:/);
});

test('valid ready build may receive notes while automatic group distribution is pending', () => {
  const state = ready(); state.build.internalBuildState = 'READY_FOR_BETA_TESTING'; state.newBuildInGroup = false;
  assert.doesNotThrow(() => assertReady(config, state, false));
  assert.throws(() => assertReady(config, state));
  state.build.processingState = 'PROCESSING';
  assert.throws(() => assertReady(config, state, false));
  state.build.processingState = 'VALID'; state.group.testerCount = 0;
  assert.throws(() => assertReady(config, state, false));
});

test('only this successful export reservation may precede the first upload', () => {
  const release = { ...config, output: pathForTest() };
  const id = '11111111-1111-4111-8111-111111111111';
  const exportStartedAtMs = Date.parse('2026-10-30T15:02:00Z');
  const report = { builtAt: '2026-10-30T15:02:19.213Z' };
  const exportLog = 'Created bundle at path "' + path.join(release.output, 'this-export.xcdistributionlogs') + '"\nExported app to: ' + path.join(release.output, 'export-27') + '\n** EXPORT SUCCEEDED **';
  const deliveryLog = '2026-10-30 23:02:10.706 DEBUG Received buildUploads ID: ' + id;
  const proof = parseExportReservation(release, report, { exportLog, deliveryLog, exportStartedAtMs });
  const upload = { id, cfBundleVersion: '27', cfBundleShortVersionString: release.version, platform: 'IOS', state: { state: 'AWAITING_UPLOAD', errors: [] }, uploadedDate: null, createdDate: '2026-10-30T08:02:10-07:00' };
  const state = { build: null, uploads: [upload] };
  assert.doesNotThrow(() => assertUploadAvailable(release, state, proof));
  assert.doesNotThrow(() => assertUploadAvailable(release, { build: null, uploads: [] }));
  for (const change of [{ state: { state: 'COMPLETE', errors: [] } }, { state: { state: 'PROCESSING', errors: [] } }, { state: { state: 'UNKNOWN', errors: [] } },
    { uploadedDate: '2026-10-30T15:02:12Z' }, { id: '22222222-2222-4222-8222-222222222222' }, { state: { state: 'AWAITING_UPLOAD', errors: [{ code: 'FAILED' }] } },
    { createdDate: '2026-10-30T15:01:59Z' }, { createdDate: '2026-10-30T15:02:20Z' }, { cfBundleShortVersionString: 'another-version' }, { platform: 'MAC_OS' }]) {
    assert.throws(() => assertUploadAvailable(release, { ...state, uploads: [{ ...upload, ...change }] }, proof));
  }
  assert.throws(() => assertUploadAvailable(release, state));
  assert.throws(() => assertUploadAvailable(release, { ...state, build: { id } }, proof));
  assert.throws(() => assertUploadAvailable(release, { ...state, uploads: [upload, upload] }, proof));
  assert.throws(() => parseExportReservation(release, report, { exportLog: exportLog.replace('** EXPORT SUCCEEDED **', ''), deliveryLog, exportStartedAtMs }));
  assert.throws(() => parseExportReservation(release, report, { exportLog, deliveryLog: 'different export', exportStartedAtMs }));
  assert.throws(() => parseExportReservation(release, report, { exportLog, deliveryLog: deliveryLog + '\nReceived buildUploads ID: 22222222-2222-4222-8222-222222222222', exportStartedAtMs }));
});

function pathForTest() { return process.platform === 'win32' ? 'D:\\release-output' : '/tmp/release-output'; }

function delivery() {
  const source = { sourceMode: 'git-tag', sourceTag: 'ios/v2.1.0-build.27', sourceTagObject: 'a'.repeat(40), sourceCommit: 'b'.repeat(40), sourceTree: 'c'.repeat(40), sourceIdentitySha256: 'd'.repeat(64) };
  const release = { ...config, ...source, appleTeamId: 'TEAM', output: pathForTest() };
  const manifest = { schemaVersion: 2, sourceMode: source.sourceMode, sourceTag: source.sourceTag, sourceTagObject: source.sourceTagObject, commit: source.sourceCommit, tree: source.sourceTree, sourceIdentitySha256: source.sourceIdentitySha256, fileCount: 1,
    files: [{ path: 'scripts/validate-mobile-embed.mjs', bytes: 12, sha256: 'e'.repeat(64) }] };
  const common = { ...source, appId: release.appId, bundleIdentifier: release.bundleIdentifier, appleTeamId: release.appleTeamId, version: release.version, buildNumber: release.buildNumber };
  const tooling = { node: '24.12.0', ruby: '3.2.0', xcode: '26.6', xcodeBuild: '17F113' };
  return { release, manifest, receipts: {
    verified: { ...common, filesChecked: 1, allSourceHashesVerified: true },
    prepared: { ...common, sourceFilesChecked: 1, allBusinessSourceHashesVerified: true, tooling },
    report: { ...common, tooling, nativeInputs: { sha256: '9'.repeat(64) }, keychainSearchListRestored: true, isolatedKeychainLocked: true, ipa: path.join(release.output, 'blessing-27.ipa'), sha256: 'f'.repeat(64), bytes: 123 },
    offline: { ...common, nativeInputsSha256: '9'.repeat(64), ipaSha256: 'f'.repeat(64), ipaBytes: 123, ipaMatchesBuildReport: true, offlineAssetsMatchPackagedDom: true, widgetCoverHashesVerified: true, validatorSourceSha256: 'e'.repeat(64) },
  } };
}

test('accepts delivery evidence from the same tagged source and build', () => {
  const { release, manifest, receipts } = delivery();
  assert.doesNotThrow(() => assertDeliveryReceipts(release, manifest, receipts));
});

test('delivery rejects offline checks against different native compilation inputs', () => {
  const { release, manifest, receipts } = delivery();
  receipts.offline.nativeInputsSha256 = '8'.repeat(64);
  assert.throws(() => assertDeliveryReceipts(release, manifest, receipts), /native/i);
});

test('rejects cross-tag and cross-commit evidence in every delivery receipt', () => {
  for (const kind of ['verified', 'prepared', 'report', 'offline']) for (const changed of [{ sourceTag: 'ios/other' }, { sourceCommit: '1'.repeat(40) }, { sourceIdentitySha256: '2'.repeat(64) }]) {
    const { release, manifest, receipts } = delivery();
    Object.assign(receipts[kind], changed);
    assert.throws(() => assertDeliveryReceipts(release, manifest, receipts), /source identity/i);
  }
});

test('rejects config and receipt build-number mismatches before IPA use', () => {
  const { release, manifest, receipts } = delivery();
  assert.throws(() => assertDeliveryReceipts({ ...release, buildNumber: 28 }, manifest, receipts), /release|build/i);
  for (const kind of ['verified', 'prepared', 'report', 'offline']) {
    const fixture = delivery(); fixture.receipts[kind].buildNumber = 26;
    assert.throws(() => assertDeliveryReceipts(fixture.release, fixture.manifest, fixture.receipts), /release|build/i);
  }
});

test('rejects historical archive receipts even if their commit matches', () => {
  for (const kind of ['verified', 'prepared', 'report', 'offline']) {
    const { release, manifest, receipts } = delivery();
    receipts[kind] = { ...receipts[kind], sourceMode: undefined, sourceTag: undefined, sourceArchiveSha256: 'a'.repeat(64) };
    assert.throws(() => assertDeliveryReceipts(release, manifest, receipts), /legacy|source identity/i);
  }
});

test('rejects missing preparation, changed tooling and a different validator receipt', () => {
  for (const change of [
    ({ prepared }) => { prepared.allBusinessSourceHashesVerified = false; },
    ({ report }) => { report.tooling = { ...report.tooling, xcodeBuild: 'OTHER' }; },
    ({ offline }) => { offline.validatorSourceSha256 = '0'.repeat(64); },
  ]) {
    const { release, manifest, receipts } = delivery(); change(receipts);
    assert.throws(() => assertDeliveryReceipts(release, manifest, receipts), /prepar|tool|validat/i);
  }
});

test('preflight accepts an unused increasing number for the same App and version', () => {
  const state = { appId: config.appId, bundleIdentifier: config.bundleIdentifier, version: config.version, build: null, builds: [{ version: config.version, buildNumber: '26', platform: 'IOS' }], uploads: [] };
  assert.doesNotThrow(() => assertNumberAvailable(config, state));
  assert.doesNotThrow(() => assertNumberAvailable(config, { ...state, builds: [...state.builds, { version: '1.0.0', buildNumber: '99', platform: 'IOS' }] }));
});

test('preflight rejects accepted builds, any matching upload, and higher used numbers', () => {
  const state = { appId: config.appId, bundleIdentifier: config.bundleIdentifier, version: config.version, build: null, builds: [], uploads: [] };
  for (const changed of [
    { build: { buildNumber: '27' } },
    { uploads: [{ cfBundleVersion: '27', state: { state: 'AWAITING_UPLOAD' } }] },
    { uploads: [{ cfBundleVersion: '27', state: { state: 'FAILED' } }] },
    { builds: [{ version: config.version, buildNumber: '28', platform: 'IOS' }] },
    { builds: [{ version: config.version, buildNumber: '27', platform: 'IOS' }] },
    { appId: 'another-app' },
    { version: '1.0.0' },
  ]) assert.throws(() => assertNumberAvailable(config, { ...state, ...changed }), /number|app|version|build|upload/i);
});

test('build and verify reject legacy source archives before using prepared outputs or signing paths', async t => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'ios-legacy-entrypoint-'));
  t.after(() => rm(repo, { recursive: true, force: true }));
  const file = path.join(repo, 'release.json');
  await writeFile(file, JSON.stringify({ ...config, repo, output: path.join(repo, 'artifacts/ios-release/27'), sourceCommit: 'a'.repeat(40), sourceArchiveSha256: 'b'.repeat(64) }));
  for (const script of ['build-mac.mjs', 'verify-mac.mjs']) {
    const result = spawnSync(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), file], { encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /legacy source archives are unsupported/, script);
  }
});
