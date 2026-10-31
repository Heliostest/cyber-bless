// Mac-only ASC delivery for this project's parameterized release configuration.
import { readFile, writeFile, rename, mkdir, open, stat, realpath } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash, sign } from 'node:crypto';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { assertReleaseSource, assertSourceReceipt, sourceReceipt } from './source-identity.mjs';
import { assertReleaseLock, assertOfficialBuildRoot } from './release-lock.mjs';
import { assertNativeInputs } from './native-inputs.mjs';

const json = async file => JSON.parse(await readFile(file, 'utf8'));
async function save(file, value) { await writeFile(file + '.tmp', JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); await rename(file + '.tmp', file); }
async function hash(file) { const h = createHash('sha256'); for await (const bytes of createReadStream(file)) h.update(bytes); return h.digest('hex'); }
const within = (parent, file) => { const relative = path.relative(parent, file); return Boolean(relative && !relative.startsWith('..') && !path.isAbsolute(relative)); };

export function assertIdentity(config, expo, eas) {
  const submission = eas.submit?.production?.ios;
  if (expo.ios?.bundleIdentifier !== config.bundleIdentifier || (expo.ios.version ?? expo.version) !== config.version ||
      submission?.ascAppId !== config.appId || submission.bundleIdentifier !== config.bundleIdentifier ||
      submission.appleTeamId !== expo.ios.appleTeamId || !submission.sku || !expo.ios.appleTeamId)
    throw Error('Release configuration does not match this App, version and Apple Team');
  return { teamId: expo.ios.appleTeamId, sku: submission.sku };
}

async function loadConfig(file) {
  if (process.platform !== 'darwin' || !path.isAbsolute(file ?? '')) throw Error('Run on the Mac with an absolute release-config path');
  const config = await json(file);
  if (!Number.isSafeInteger(config.buildNumber) || config.buildNumber < 1 || !/^\d+$/.test(config.appId ?? '') ||
      !path.isAbsolute(config.repo ?? '') || !path.isAbsolute(config.output ?? '') || !path.isAbsolute(config.privateDir ?? '') ||
      !within(config.repo, config.output) || !within(os.homedir(), config.privateDir) || !config.groupId)
    throw Error('Invalid release configuration');
  if (await realpath(config.repo) !== config.repo) throw Error('Unexpected source-root symlink');
  await mkdir(config.output, { recursive: true });
  if (await realpath(config.output) !== config.output || await realpath(config.privateDir) !== config.privateDir) throw Error('Unexpected output/private-directory symlink');
  const [{ expo }, eas] = await Promise.all([json(path.join(config.repo, 'apps/mobile-expo/app.json')), json(path.join(config.repo, 'apps/mobile-expo/eas.json'))]);
  return { ...config, ...assertIdentity(config, expo, eas), expo };
}

async function clientFor(config) {
  let keyInfo, privateKey;
  try {
    keyInfo = await json(path.join(config.privateDir, 'api-key.json'));
    if (!/^[A-Z0-9]{6,20}$/.test(keyInfo.keyId ?? '') || !/^[a-f0-9-]{36}$/i.test(keyInfo.issuerId ?? '')) throw Error();
    const file = path.join(config.privateDir, 'private_keys', 'AuthKey_' + keyInfo.keyId + '.p8');
    if (await realpath(file) !== file) throw Error();
    privateKey = await readFile(file, 'utf8');
  } catch { throw Error('Unable to use this App private ASC key; contents withheld'); }
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  async function request(route, options = {}) {
    const url = new URL(route, 'https://api.appstoreconnect.apple.com');
    if (url.origin !== 'https://api.appstoreconnect.apple.com' || !/^\/v[12]\//.test(url.pathname)) throw Error('Unexpected Apple API route');
    const now = Math.floor(Date.now() / 1000);
    const payload = encode({ alg: 'ES256', kid: keyInfo.keyId, typ: 'JWT' }) + '.' + encode({ iss: keyInfo.issuerId, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' });
    const token = payload + '.' + sign('sha256', Buffer.from(payload), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');
    let response;
    try { response = await fetch(url, { method: options.method ?? 'GET', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(options.body ? { body: JSON.stringify(options.body) } : {}), redirect: 'error', signal: AbortSignal.timeout(45000) }); }
    catch { throw Error('Apple request outcome unavailable; no automatic retry and no credentials logged'); }
    if (response.status === 204) return {};
    const body = await response.json();
    if (!response.ok) throw Error('Apple API ' + response.status + ': ' + (body.errors ?? []).map(e => e.code ?? 'UNKNOWN').join(', '));
    return body;
  }
  const app = (await request('/v1/apps/' + config.appId)).data;
  if (app?.id !== config.appId || app.attributes.bundleId !== config.bundleIdentifier || app.attributes.sku !== config.sku) throw Error('ASC App identity mismatch');
  return { request, keyInfo };
}

async function list(request, route) {
  const result = { data: [], included: [] }, seen = new Set();
  const initial = new URL(route, 'https://api.appstoreconnect.apple.com');
  let next = route;
  while (next) {
    if (seen.has(next)) throw Error('Apple pagination loop');
    seen.add(next);
    const response = await request(next);
    if (!Array.isArray(response.data)) throw Error('Expected Apple collection');
    result.data.push(...response.data); result.included.push(...response.included ?? []);
    next = null;
    if (response.links?.next) {
      const url = new URL(response.links.next, initial);
      if (url.origin !== initial.origin || url.pathname !== initial.pathname) throw Error('Unexpected Apple pagination destination');
      next = url.pathname + url.search;
    }
  }
  return result;
}

async function readState(config, request) {
  const [builds, uploads, group, groupApp, members, groupBuilds, versions] = await Promise.all([
    list(request, '/v1/builds?filter[app]=' + config.appId + '&include=preReleaseVersion,buildBetaDetail&limit=200'),
    list(request, '/v1/apps/' + config.appId + '/buildUploads?limit=200'),
    request('/v1/betaGroups/' + config.groupId), request('/v1/betaGroups/' + config.groupId + '/relationships/app'),
    list(request, '/v1/betaGroups/' + config.groupId + '/betaTesters?fields[betaTesters]=state&limit=200'),
    list(request, '/v1/betaGroups/' + config.groupId + '/relationships/builds?limit=200'),
    list(request, '/v1/apps/' + config.appId + '/appStoreVersions?filter[platform]=IOS&include=build&limit=200'),
  ]);
  if (group.data.id !== config.groupId || groupApp.data?.id !== config.appId || !group.data.attributes.isInternalGroup) throw Error('Requested group is not this App internal test group');
  const mapped = builds.data.map(build => {
    const pre = builds.included.find(v => v.type === 'preReleaseVersions' && v.id === build.relationships?.preReleaseVersion?.data?.id)?.attributes;
    const beta = builds.included.find(v => v.type === 'buildBetaDetails' && v.id === build.relationships?.buildBetaDetail?.data?.id)?.attributes;
    return { id: build.id, buildNumber: build.attributes.version, version: pre?.version, platform: pre?.platform, processingState: build.attributes.processingState, internalBuildState: beta?.internalBuildState ?? null, expired: build.attributes.expired, expirationDate: build.attributes.expirationDate, uploadedDate: build.attributes.uploadedDate };
  }).filter(build => build.version === config.version && build.platform === 'IOS');
  const matching = mapped.filter(build => build.buildNumber === String(config.buildNumber));
  if (matching.length > 1) throw Error('Multiple matching builds');
  const build = matching[0] ?? null;
  const localizations = build ? (await list(request, '/v1/builds/' + build.id + '/betaBuildLocalizations?limit=200')).data.filter(n => n.attributes.locale === 'zh-Hans') : [];
  if (localizations.length > 1) throw Error('Duplicate zh-Hans test information');
  const note = localizations[0] ? { id: localizations[0].id, whatsNew: localizations[0].attributes.whatsNew } : null;
  return { ...sourceReceipt(config.sourceManifest), checkedAt: new Date().toISOString(), appId: config.appId, bundleIdentifier: config.bundleIdentifier, appleTeamId: config.appleTeamId, version: config.version, buildNumber: String(config.buildNumber), builds: mapped,
    uploads: uploads.data.filter(u => u.attributes.cfBundleShortVersionString === config.version && u.attributes.platform === 'IOS').map(u => ({ id: u.id, ...u.attributes })), build,
    group: { id: group.data.id, name: group.data.attributes.name, isInternalGroup: true, appId: groupApp.data.id, automaticDistribution: group.data.attributes.hasAccessToAllBuilds === true, testerCount: members.data.length },
    newBuildInGroup: Boolean(build && groupBuilds.data.some(b => b.id === build.id)), note, testInformationMatches: Boolean(config.whatToTest && note?.whatsNew === config.whatToTest),
    formalSelection: versions.data.map(v => ({ versionId: v.id, version: v.attributes.versionString, appStoreState: v.attributes.appStoreState, releaseType: v.attributes.releaseType, buildId: v.relationships?.build?.data?.id ?? null })) };
}

export function assertReady(config, state, requireDistribution = true) {
  if (state.appId !== config.appId || state.build?.buildNumber !== String(config.buildNumber) || state.build.version !== config.version || state.build.platform !== 'IOS' ||
      state.build.processingState !== 'VALID' || state.build.expired !== false || Date.parse(state.build.expirationDate) <= Date.now() || !Number.isFinite(Date.parse(state.build.expirationDate)) ||
      !(requireDistribution ? ['IN_BETA_TESTING'] : ['READY_FOR_BETA_TESTING', 'IN_BETA_TESTING']).includes(state.build.internalBuildState) ||
      (requireDistribution && !state.newBuildInGroup) || state.group?.id !== config.groupId || !state.group.isInternalGroup || state.group.appId !== config.appId || state.group.testerCount < 1)
    throw Error('Target build is not yet VALID and available to the existing internal test group');
}

export function assertDeliveryReceipts(config, manifest, { verified, prepared, report, offline }) {
  assertSourceReceipt(config, manifest);
  for (const receipt of [verified, prepared, report, offline]) {
    assertSourceReceipt(receipt, manifest);
    if (receipt.sourceArchiveSha256 !== undefined || receipt.archiveSha256 !== undefined) throw Error('Legacy source identity is unsupported for delivery');
    if (Number(receipt.buildNumber) !== config.buildNumber || ['version', 'bundleIdentifier', 'appId', 'appleTeamId'].some(field => receipt[field] !== config[field])) throw Error('Delivery receipt App, version or build number differs from this release');
  }
  if (verified.filesChecked !== manifest.files.length || verified.allSourceHashesVerified !== true || prepared.sourceFilesChecked !== manifest.files.length || prepared.allBusinessSourceHashesVerified !== true) throw Error('Source preparation verification does not match this release');
  if (!prepared.tooling || !isDeepStrictEqual(prepared.tooling, report.tooling)) throw Error('Build tooling differs from source preparation');
  if (!/^[a-f0-9]{64}$/.test(report.nativeInputs?.sha256 ?? '') || offline.nativeInputsSha256 !== report.nativeInputs.sha256) throw Error('Offline validation belongs to different native inputs');
  const validator = manifest.files.find(file => file.path === 'scripts/validate-mobile-embed.mjs');
  if (!validator || offline.validatorSourceSha256 !== validator.sha256) throw Error('Offline validation used a different source validator');
  if (report.keychainSearchListRestored !== true || report.isolatedKeychainLocked !== true || !within(config.output, report.ipa) ||
      offline.ipaSha256 !== report.sha256 || offline.ipaBytes !== report.bytes ||
      !offline.ipaMatchesBuildReport || !offline.offlineAssetsMatchPackagedDom || !offline.widgetCoverHashesVerified)
    throw Error('Signed IPA or offline validation does not match this release');
}

async function verifyEvidence(config) {
  const { manifest } = await assertReleaseSource(config, { entrypoint: import.meta.url, allowPrebuildChanges: true, requirePrepared: true });
  const verified = await json(path.join(config.output, 'source-verification-mac.json'));
  const prepared = await json(path.join(config.output, 'source-post-prebuild.json'));
  const report = await json(path.join(config.output, 'build-report.json'));
  await assertNativeInputs(config.repo, report.nativeInputs, { allowSigningChanges: true });
  const offline = await json(path.join(config.output, 'offline-validation.json'));
  assertDeliveryReceipts(config, manifest, { verified, prepared, report, offline });
  const widget = config.expo.plugins?.find(p => Array.isArray(p) && p[0] === 'expo-widgets')?.[1];
  const expected = new Set([config.bundleIdentifier, widget?.bundleIdentifier]);
  if (expected.size !== 2 || report.targets?.length !== 2) throw Error('Expected App and widget signing evidence');
  for (const target of report.targets) if (!expected.delete(target.bundleIdentifier) || target.teamId !== config.teamId || target.version !== config.version || Number(target.buildNumber) !== config.buildNumber || !target.codeSignatureVerified || target.distribution !== 'app-store-connect' || target.appGroup !== widget.groupIdentifier) throw Error('Target signing identity mismatch');
  if (expected.size || await realpath(report.ipa) !== report.ipa || (await stat(report.ipa)).size !== report.bytes || await hash(report.ipa) !== report.sha256) throw Error('Actual IPA size or SHA-256 mismatch');
  if (await hash(path.join(config.repo, 'apps/mobile-expo/public/wbr-assets.json')) !== offline.offlineSourceManifestSha256) throw Error('Prepared offline assets changed after IPA verification');
  return report;
}

export function parseExportReservation(config, report, { exportLog, deliveryLog, exportStartedAtMs }) {
  const loggingBundles = [...exportLog.matchAll(/Created bundle at path "([^"\r\n]+\.xcdistributionlogs)"/g)].map(match => match[1]);
  const ids = new Set([...deliveryLog.matchAll(/Received buildUploads ID:\s*([a-f0-9-]{36})/gi)].map(match => match[1].toLowerCase()));
  const exportFinishedAtMs = Date.parse(report.builtAt);
  if (loggingBundles.length !== 1 || !path.isAbsolute(loggingBundles[0]) || ids.size !== 1 ||
      !exportLog.includes('Exported app to: ' + path.join(config.output, 'export-' + config.buildNumber)) ||
      !exportLog.includes('** EXPORT SUCCEEDED **') || !Number.isFinite(exportStartedAtMs) || exportStartedAtMs <= 0 ||
      !Number.isFinite(exportFinishedAtMs) || exportStartedAtMs > exportFinishedAtMs)
    throw Error('No unique reservation proven by this successful Xcode export');
  return { uploadId: [...ids][0], loggingBundle: loggingBundles[0], exportStartedAtMs, exportFinishedAtMs };
}

export function assertUploadAvailable(config, state, reservation = null) {
  const uploads = state.uploads.filter(upload => String(upload.cfBundleVersion) === String(config.buildNumber));
  if (state.build) throw Error('Apple already has this build; query its state instead of sending again');
  if (!uploads.length) return;
  const upload = uploads[0], createdAtMs = Date.parse(upload.createdDate);
  if (uploads.length !== 1 || upload.cfBundleShortVersionString !== config.version || upload.platform !== 'IOS' ||
      upload.state?.state !== 'AWAITING_UPLOAD' || upload.uploadedDate !== null || !Array.isArray(upload.state.errors) || upload.state.errors.length ||
      !reservation || upload.id.toLowerCase() !== reservation.uploadId || !Number.isFinite(createdAtMs) ||
      createdAtMs < reservation.exportStartedAtMs || createdAtMs > reservation.exportFinishedAtMs)
    throw Error('Apple already has an unproven or started upload; query its state instead of sending again');
}

export function assertNumberAvailable(config, state) {
  if (!Number.isSafeInteger(config.buildNumber) || config.buildNumber < 1 || state.appId !== config.appId || state.bundleIdentifier !== config.bundleIdentifier || state.version !== config.version || !Array.isArray(state.builds) || !Array.isArray(state.uploads)) throw Error('Build-number check App or version mismatch');
  if (state.build || state.uploads.some(upload => Number(upload.cfBundleVersion) === config.buildNumber)) throw Error('Apple already has this build number or an upload attempt');
  for (const build of state.builds) if (build.version === config.version && build.platform === 'IOS') {
    if (!Number.isSafeInteger(Number(build.buildNumber)) || Number(build.buildNumber) >= config.buildNumber) throw Error('Release build number must exceed every used number for this App version');
  }
}

async function exportReservation(config, report) {
  const file = path.join(config.output, 'xcode-export.log');
  const exportLog = await readFile(file, 'utf8'), info = await stat(file);
  const loggingBundles = [...exportLog.matchAll(/Created bundle at path "([^"\r\n]+\.xcdistributionlogs)"/g)].map(match => match[1]);
  if (loggingBundles.length !== 1 || !path.isAbsolute(loggingBundles[0])) throw Error('Unable to locate this Xcode export distribution log');
  const deliveryLog = await readFile(path.join(loggingBundles[0], 'ContentDelivery.log'), 'utf8');
  return { ...sourceReceipt(config.sourceManifest), ...parseExportReservation(config, report, { exportLog, deliveryLog, exportStartedAtMs: info.birthtimeMs }),
    exportLogSha256: createHash('sha256').update(exportLog).digest('hex'), contentDeliveryLogSha256: createHash('sha256').update(deliveryLog).digest('hex') };
}

async function upload(config, client) {
  const report = await verifyEvidence(config);
  const state = await readState(config, client.request);
  await save(path.join(config.output, 'asc-state.json'), state);
  const matching = state.uploads.filter(u => String(u.cfBundleVersion) === String(config.buildNumber));
  const reservation = !state.build && matching.length === 1 ? await exportReservation(config, report) : null;
  assertUploadAvailable(config, state, reservation);
  if (reservation) await save(path.join(config.output, 'export-reservation.json'), reservation);
  const receiptFile = path.join(config.output, 'upload-receipt.json');
  const startedAt = new Date().toISOString();
  const receipt = { ...sourceReceipt(config.sourceManifest), startedAt, state: 'STARTED', appId: config.appId, bundleIdentifier: config.bundleIdentifier, appleTeamId: config.appleTeamId, version: config.version, buildNumber: config.buildNumber, sha256: report.sha256, ...(reservation ? { reservedUploadId: reservation.uploadId } : {}) };
  try { await writeFile(receiptFile, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
  catch (error) { if (error.code === 'EEXIST') throw Error('An upload was already attempted; inspect its receipt and ASC state before any retry'); throw error; }
  const log = await open(path.join(config.output, 'apple-upload.json'), 'w', 0o600);
  try {
    const code = await new Promise((resolve, reject) => {
      const child = spawn('/usr/bin/xcrun', ['altool', '--upload-app', '-f', report.ipa, '--type', 'ios', '--apiKey', client.keyInfo.keyId, '--apiIssuer', client.keyInfo.issuerId, '--output-format', 'json'],
        { cwd: config.privateDir, env: { HOME: os.homedir(), PATH: '/usr/bin:/bin:/usr/sbin:/sbin', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', DEVELOPER_DIR: config.developerDir ?? '/Applications/Xcode-26.6.0.app/Contents/Developer', API_PRIVATE_KEYS_DIR: path.join(config.privateDir, 'private_keys') }, stdio: ['ignore', log.fd, log.fd] });
      child.on('error', () => reject(Error('Unable to start uploader; consult receipt before retrying'))); child.on('close', resolve);
    });
    Object.assign(receipt, { finishedAt: new Date().toISOString(), state: code === 0 ? 'UPLOAD_ACCEPTED' : 'FAILED', exitCode: code });
    await save(receiptFile, receipt); console.log(JSON.stringify(receipt, null, 2));
    if (code !== 0) throw Error('Apple uploader failed; inspect apple-upload.json and query ASC before retrying');
  } finally { await log.close(); }
}

async function finish(config, client) {
  await verifyEvidence(config);
  let state = await readState(config, client.request);
  await save(path.join(config.output, 'asc-state.json'), state);
  try { assertReady(config, state, false); }
  catch (error) {
    if (state.build && ['INVALID', 'FAILED'].includes(state.build.processingState)) throw error;
    console.log(JSON.stringify({ pending: true, ...state }, null, 2)); return;
  }
  if (typeof config.whatToTest !== 'string' || !config.whatToTest.trim()) throw Error('Supply accurate test information before finishing');
  const formal = JSON.stringify(state.formalSelection), journalFile = path.join(config.output, 'notes-journal.json');
  if (!state.testInformationMatches) {
    const operation = { ...sourceReceipt(config.sourceManifest), startedAt: new Date().toISOString(), appId: config.appId, bundleIdentifier: config.bundleIdentifier, appleTeamId: config.appleTeamId, version: config.version, buildNumber: config.buildNumber, buildId: state.build.id, whatToTest: config.whatToTest, state: 'STARTED' };
    try { await writeFile(journalFile, JSON.stringify(operation, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code === 'EEXIST') throw Error('A notes write was already attempted and is not read back; inspect notes-journal.json without retrying'); throw error; }
    if (state.note) await client.request('/v1/betaBuildLocalizations/' + state.note.id, { method: 'PATCH', body: { data: { type: 'betaBuildLocalizations', id: state.note.id, attributes: { whatsNew: config.whatToTest } } } });
    else await client.request('/v1/betaBuildLocalizations', { method: 'POST', body: { data: { type: 'betaBuildLocalizations', attributes: { locale: 'zh-Hans', whatsNew: config.whatToTest }, relationships: { build: { data: { type: 'builds', id: state.build.id } } } } } });
    await save(journalFile, { ...operation, state: 'ACKNOWLEDGED', finishedAt: new Date().toISOString() });
    state = await readState(config, client.request);
  }
  if (!state.testInformationMatches || JSON.stringify(state.formalSelection) !== formal) throw Error('Test information or formal selection readback mismatch');
  await save(path.join(config.output, 'asc-state.json'), state);
  try { assertReady(config, state); }
  catch { console.log(JSON.stringify({ pending: true, ...state }, null, 2)); return; }
  const result = { ...state, ...sourceReceipt(config.sourceManifest), completedAt: new Date().toISOString(), internalBuildState: state.build.internalBuildState, formalStoreBuildUnchanged: true, permissionsChanged: false, invitationsCreated: false, reviewSubmitted: false, whatToTest: config.whatToTest };
  await save(path.join(config.output, 'testflight-completion.json'), result);
  console.log(JSON.stringify(result, null, 2));
}

export async function main(argv = process.argv.slice(2)) {
  const [file, mode] = argv;
  if (argv.length !== 2 || !['status', 'preflight', 'upload', 'finish'].includes(mode)) throw Error('Usage: node asc.mjs <absolute-release-config.json> status|preflight|upload|finish');
  const config = await loadConfig(file);
  assertOfficialBuildRoot(config.buildRoot);
  await assertReleaseLock(config.buildRoot);
  const { manifest } = await assertReleaseSource(config, { entrypoint: import.meta.url, allowPrebuildChanges: true, requirePrepared: !['status', 'preflight'].includes(mode) });
  config.sourceManifest = manifest;
  const client = await clientFor(config);
  if (mode === 'upload') return upload(config, client);
  if (mode === 'finish') return finish(config, client);
  const state = await readState(config, client.request);
  if (mode === 'preflight') {
    assertNumberAvailable(config, state);
    const result = { ...sourceReceipt(manifest), checkedAt: state.checkedAt, appId: config.appId, bundleIdentifier: config.bundleIdentifier, appleTeamId: config.appleTeamId, version: config.version, buildNumber: config.buildNumber, available: true };
    await save(path.join(config.output, 'build-number-check.json'), result);
    console.log(JSON.stringify(result, null, 2));
    return result;
  }
  await save(path.join(config.output, 'asc-state.json'), state); console.log(JSON.stringify(state, null, 2));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
