import { spawn } from 'node:child_process';
import { createHash, randomBytes, X509Certificate } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, open, readFile, readdir, stat, writeFile, rm, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { assertReleaseSource, assertSourceReceipt, sourceReceipt } from './source-identity.mjs';
import { inspectToolchain } from './dependencies.mjs';
import { assertReleaseLock, assertOfficialBuildRoot } from './release-lock.mjs';
import { assertNativeInputs, captureNativeInputs, assertNativeWriteTargets } from './native-inputs.mjs';

// Run only after the caller has installed dependencies, prepared assets and
// generated the iOS workspace/Pods. This script never invokes npm or prebuild.
// Usage: node scripts/ios-release/build-mac.mjs /absolute/release-config.json
const release = JSON.parse(await readFile(process.argv[2], 'utf8'));
const { manifest } = await assertReleaseSource(release, { entrypoint: import.meta.url, allowPrebuildChanges: true, requirePrepared: true });
assertOfficialBuildRoot(release.buildRoot);
await assertReleaseLock(release.buildRoot);
const home = '/Users/heli';
const repo = path.resolve(release.repo);
const output = path.resolve(release.output);
const privateDir = path.resolve(release.privateDir);
const app = path.join(repo, 'apps/mobile-expo');
const ios = path.join(app, 'ios');
const developerDir = release.developerDir;
const nodeBinary = release.nodeBinary;
const rubyBinary = release.rubyBinary;
const bundleIdentifier = 'com.helio.cyberbless';
const appleTeamId = '6PG2WW6L6N';
const widgetBundleIdentifier = 'com.helio.cyberbless.widgets';
const appGroup = 'group.com.helio.cyberbless.widgets';
const targets = new Map([['app', bundleIdentifier], ['ExpoWidgetsTarget', widgetBundleIdentifier]]);
const buildNumber = release.buildNumber;
if (!Number.isSafeInteger(buildNumber) || buildNumber < 1) throw Error('Explicit positive build number required');
if (repo !== await realpath(repo) || !repo.startsWith(home + '/') || output !== path.join(repo, 'artifacts/ios-release', String(buildNumber)) || privateDir !== '/Users/heli/.wbr/testflight-20261026') throw Error('Unexpected project release paths');
if (release.bundleIdentifier !== bundleIdentifier || release.appId !== '6821271597') throw Error('Release app identity mismatch');
const sourceCheck = JSON.parse(await readFile(path.join(output, 'source-verification-mac.json'), 'utf8'));
const prepared = JSON.parse(await readFile(path.join(output, 'source-post-prebuild.json'), 'utf8'));
assertSourceReceipt(sourceCheck, manifest);
assertSourceReceipt(prepared, manifest);
if (sourceCheck.filesChecked !== manifest.files.length || sourceCheck.allSourceHashesVerified !== true || prepared.sourceFilesChecked !== manifest.files.length || prepared.allBusinessSourceHashesVerified !== true) throw Error('Unverified tagged source preparation');
for (const receipt of [sourceCheck, prepared]) if (Number(receipt.buildNumber) !== buildNumber || ['version', 'bundleIdentifier', 'appId', 'appleTeamId'].some(field => receipt[field] !== release[field])) throw Error('Source preparation belongs to a different App or build');
await assertNativeInputs(repo, prepared.nativeInputs);
await assertNativeWriteTargets(repo);
const derivedData = path.resolve(release.derivedData);
if (derivedData !== path.join(repo, 'artifacts/ios-release/DerivedData')) throw Error('Unexpected shared build cache');
if (process.platform !== 'darwin' || os.homedir() !== home) throw Error('This helper is restricted to the designated Mac account');
const tooling = await inspectToolchain(release);
if (process.versions.node !== tooling.node) throw Error('Run this helper with the configured and verified Node version');
if (!prepared.tooling || !isDeepStrictEqual(prepared.tooling, tooling)) throw Error('Toolchain or dependency inputs changed after preparation');
const require = createRequire(path.join(app, 'package.json'));
const plist = require('plist');
const xcode = require('xcode');
// Keep inherited tokens and private signing values out of Xcode's environment
// and build logs. Signing secrets are passed only to local security commands.
const env = {
  HOME: home, USER: 'heli', LOGNAME: 'heli', SHELL: '/bin/zsh',
  ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
  DEVELOPER_DIR: developerDir,
  PATH: `${path.dirname(nodeBinary)}:${path.dirname(rubyBinary)}:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
  NODE_BINARY: nodeBinary, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8',
  CI: '1', EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1', RCT_METRO_PORT: '8081',
};
await mkdir(output, { recursive: true });
async function run(command, args, { log, cwd = repo } = {}) {
  const handle = log ? await open(path.join(output, log), 'w', 0o600) : null;
  try {
    return await new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, env, stdio: handle ? ['ignore', handle.fd, handle.fd] : ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      child.stdout?.on('data', bytes => { stdout += bytes; });
      child.stderr?.on('data', bytes => { stderr += bytes; });
      child.on('error', () => reject(Error(`Unable to start ${path.basename(command)}`)));
      child.on('close', code => code === 0 ? resolve({ stdout, stderr }) : reject(Error(`${path.basename(command)} failed (${code})${log ? `; see ${log}` : '; private command output withheld'}`)));
    });
  } finally { await handle?.close(); }
}
async function exists(file) {
  try { await stat(file); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
}
function privateFile(value) {
  if (typeof value !== 'string' || !value) throw Error('Missing private signing file reference');
  const file = path.resolve(privateDir, value);
  const relative = path.relative(privateDir, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Signing files must stay inside the designated private directory');
  return file;
}
async function readPlist(file) {
  return plist.parse((await run('/usr/bin/plutil', ['-convert', 'xml1', '-o', '-', file])).stdout);
}
async function decodeProfile(file) {
  return plist.parse((await run('/usr/bin/security', ['cms', '-D', '-i', file])).stdout);
}
function validateStoreProfile(profile, expectedBundle, expectedUuid) {
  const entitlements = profile.Entitlements ?? {};
  const expiry = new Date(profile.ExpirationDate);
  if (!Array.isArray(profile.TeamIdentifier) || profile.TeamIdentifier.length !== 1 || profile.TeamIdentifier[0] !== appleTeamId) throw Error(`Provisioning Team mismatch: ${expectedBundle}`);
  if (entitlements['application-identifier'] !== `${appleTeamId}.${expectedBundle}` || entitlements['com.apple.developer.team-identifier'] !== appleTeamId) throw Error(`Provisioning application identity mismatch: ${expectedBundle}`);
  if ('ProvisionedDevices' in profile || profile.ProvisionsAllDevices === true || entitlements['get-task-allow'] === true || entitlements['beta-reports-active'] !== true) throw Error(`Expected an App Store/TestFlight distribution profile: ${expectedBundle}`);
  if (!Number.isFinite(expiry.getTime()) || expiry <= new Date()) throw Error(`Expired provisioning profile: ${expectedBundle}`);
  if (!/^[A-F0-9-]{36}$/i.test(profile.UUID ?? '') || (expectedUuid && profile.UUID !== expectedUuid)) throw Error(`Provisioning UUID mismatch: ${expectedBundle}`);
  if (!Array.isArray(entitlements['com.apple.security.application-groups']) || !entitlements['com.apple.security.application-groups'].includes(appGroup)) throw Error(`Provisioning App Group missing: ${expectedBundle}`);
  if (!Array.isArray(profile.DeveloperCertificates) || !profile.DeveloperCertificates.length) throw Error(`Profile has no authorized certificate: ${expectedBundle}`);
  return { profileUuid: profile.UUID, teamId: appleTeamId, appGroup, profileExpiresAt: expiry.toISOString(), distribution: 'app-store-connect', deviceRestricted: false, allowsDebugging: false, betaReportsActive: true };
}
const config = JSON.parse(await readFile(path.join(app, 'app.json'), 'utf8'));
let credentials;
try { credentials = JSON.parse(await readFile(path.join(privateDir, 'credentials.json'), 'utf8')); }
catch { throw Error('Unable to read private signing credentials JSON; content withheld'); }
if (config.expo?.ios?.bundleIdentifier !== bundleIdentifier || config.expo.ios.appleTeamId !== appleTeamId || credentials.applicationId !== bundleIdentifier || credentials.appleTeamId !== appleTeamId) throw Error('Application or Apple Team mismatch');
if (typeof credentials.p12Password !== 'string' || !Array.isArray(credentials.profiles) || credentials.profiles.length !== targets.size) throw Error('Expected one distribution certificate and exactly two target profiles');
const widgetOptions = config.expo.plugins?.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-widgets')?.[1];
if (widgetOptions?.bundleIdentifier !== widgetBundleIdentifier || widgetOptions.groupIdentifier !== appGroup) throw Error('Widget application configuration mismatch');
const version = config.expo.ios.version ?? config.expo.version;
if (version !== release.version) throw Error('Marketing version mismatch');
if (typeof version !== 'string' || !/^\d+(?:\.\d+){1,2}$/.test(version)) throw Error('Unexpected marketing version');
const workspace = path.join(ios, 'app.xcworkspace');
const projectFile = path.join(ios, 'app.xcodeproj/project.pbxproj');
if (!(await stat(workspace)).isDirectory() || !(await stat(projectFile)).isFile()) throw Error('Generate the app workspace and Pods before running this helper');
const archive = path.join(output, `Blessing-${buildNumber}.xcarchive`);
const exported = path.join(output, `export-${buildNumber}`);
const extracted = path.join(output, `verified-${buildNumber}`);
const ipa = path.join(output, `blessing-${buildNumber}.ipa`);
for (const target of [archive, exported, extracted, ipa, path.join(output, 'build-report.json')]) if (await exists(target)) throw Error('Build output already exists; use a reviewed fresh output directory');

const profiles = new Map();
let commonCertificates;
for (const item of credentials.profiles) {
  if (![...targets.values()].includes(item.bundleIdentifier) || profiles.has(item.bundleIdentifier)) throw Error('Unexpected or duplicated provisioning target');
  const file = privateFile(item.file);
  const profile = await decodeProfile(file);
  const summary = validateStoreProfile(profile, item.bundleIdentifier);
  const certs = new Map(profile.DeveloperCertificates.map(bytes => {
    const certificate = new X509Certificate(bytes);
    const fingerprint = certificate.fingerprint.replaceAll(':', '').toUpperCase();
    return [fingerprint, certificate];
  }).filter(([, certificate]) => new Date(certificate.validFrom) <= new Date() && new Date(certificate.validTo) > new Date() && /(?:Apple Distribution|iPhone Distribution):/.test(certificate.subject)));
  commonCertificates = commonCertificates ? new Map([...commonCertificates].filter(([fingerprint]) => certs.has(fingerprint))) : certs;
  profiles.set(item.bundleIdentifier, { profile, file, summary });
}
if (profiles.size !== targets.size || !commonCertificates?.size) throw Error('Target profiles do not share a valid Apple distribution certificate');
const originalKeychains = [...(await run('/usr/bin/security', ['list-keychains', '-d', 'user'])).stdout.matchAll(/"([^"]+)"/g)].map(match => match[1]);
if (!originalKeychains.length) throw Error('Unable to snapshot the original user keychain search list');
const keychain = path.join(privateDir, `store-build-${buildNumber}-${Date.now()}-${randomBytes(6).toString('hex')}.keychain-db`);
const password = randomBytes(32).toString('hex');
let keychainCreated = false;
let report;
let failure;
const cleanupFailures = [];
try {
  await run('/usr/bin/security', ['create-keychain', '-p', password, keychain]);
  keychainCreated = true;
  await run('/usr/bin/security', ['unlock-keychain', '-p', password, keychain]);
  await run('/usr/bin/security', ['set-keychain-settings', '-lut', '21600', keychain]);
  await run('/usr/bin/security', ['import', privateFile(credentials.p12Path), '-k', keychain, '-P', credentials.p12Password, '-T', '/usr/bin/codesign', '-T', '/usr/bin/security']);
  await run('/usr/bin/security', ['set-key-partition-list', '-S', 'apple-tool:,apple:,codesign:', '-s', '-k', password, keychain]);
  const identities = (await run('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning', keychain])).stdout.toUpperCase();
  const identity = [...commonCertificates.keys()].find(fingerprint => identities.includes(fingerprint));
  if (!identity) throw Error('Imported private key does not match the distribution profiles');
  await run('/usr/bin/security', ['list-keychains', '-d', 'user', '-s', ...new Set([...originalKeychains, keychain])]);
  for (const { profile, file } of profiles.values()) {
    for (const folder of ['Library/MobileDevice/Provisioning Profiles', 'Library/Developer/Xcode/UserData/Provisioning Profiles']) {
      const destination = path.join(home, folder, `${profile.UUID}.mobileprovision`);
      await mkdir(path.dirname(destination), { recursive: true });
      if (await exists(destination)) {
        if (await hashFile(destination) !== await hashFile(file)) throw Error('Installed provisioning profile with the same UUID has different content');
      } else await copyFile(file, destination);
    }
  }
  const project = xcode.project(projectFile);
  project.parseSync();
  const configured = new Map([...targets.values()].map(id => [id, new Set()]));
  const unquote = value => typeof value === 'string' ? value.replace(/^"|"$/g, '') : value;
  const nativeTargets = Object.entries(project.pbxNativeTargetSection()).filter(([, value]) => value && typeof value === 'object');
  for (const [name] of targets) if (!nativeTargets.some(([, value]) => unquote(value.name) === name)) throw Error(`Missing Xcode target ${name}`);
  for (const value of Object.values(project.pbxXCBuildConfigurationSection())) {
    const settings = value?.buildSettings;
    const id = unquote(settings?.PRODUCT_BUNDLE_IDENTIFIER);
    const selected = profiles.get(id);
    if (!selected) continue;
    Object.assign(settings, {
      DEVELOPMENT_TEAM: appleTeamId, CODE_SIGN_STYLE: 'Manual',
      CODE_SIGN_IDENTITY: `"${identity}"`, '"CODE_SIGN_IDENTITY[sdk=iphoneos*]"': `"${identity}"`,
      PROVISIONING_PROFILE: `"${selected.profile.UUID}"`,
      PROVISIONING_PROFILE_SPECIFIER: `"${selected.profile.UUID}"`,
      '"PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]"': `"${selected.profile.UUID}"`,
      CURRENT_PROJECT_VERSION: String(buildNumber), MARKETING_VERSION: `"${version}"`,
    });
    configured.get(id).add(unquote(value.name));
  }
  for (const [id, configurations] of configured) if (!configurations.has('Release')) throw Error(`Missing Release signing configuration: ${id}`);
  const projectAttributes = project.getFirstProject().firstProject.attributes;
  projectAttributes.TargetAttributes ??= {};
  for (const [uuid, nativeTarget] of nativeTargets) if (targets.has(unquote(nativeTarget.name))) {
    projectAttributes.TargetAttributes[uuid] ??= {};
    Object.assign(projectAttributes.TargetAttributes[uuid], { ProvisioningStyle: 'Manual', DevelopmentTeam: appleTeamId });
  }
  for (const [name] of targets) {
    const file = path.join(ios, name, 'Info.plist');
    const info = await readPlist(file);
    info.CFBundleVersion = '$(CURRENT_PROJECT_VERSION)';
    info.CFBundleShortVersionString = '$(MARKETING_VERSION)';
    await writeFile(file, plist.build(info));
  }
  await writeFile(projectFile, project.writeSync());
  const signedNativeInputs = await captureNativeInputs(repo);
  await assertReleaseSource(release, { entrypoint: import.meta.url, allowPrebuildChanges: true, requirePrepared: true });
  console.log(`Archiving ${bundleIdentifier} ${version} (${buildNumber}) with its widget extension. See xcode-archive.log.`);
  await run('/usr/bin/xcodebuild', ['archive', '-workspace', workspace, '-scheme', 'app', '-configuration', 'Release', '-sdk', 'iphoneos', '-destination', 'generic/platform=iOS', '-archivePath', archive, '-derivedDataPath', derivedData, '-disableAutomaticPackageResolution', '-skipPackageUpdates', '-jobs', '4'], { cwd: ios, log: 'xcode-archive.log' });
  if (!(await stat(path.join(archive, 'Products/Applications/app.app'))).isDirectory()) throw Error('Archive application missing');
  console.log('Completed archive retained; shared DerivedData retained for the next build.');
  const exportOptions = path.join(output, 'ExportOptions.plist');
  await writeFile(exportOptions, plist.build({
    method: 'app-store-connect', destination: 'export', signingStyle: 'manual',
    signingCertificate: identity, teamID: appleTeamId,
    provisioningProfiles: Object.fromEntries([...profiles].map(([id, value]) => [id, value.profile.UUID])),
    stripSwiftSymbols: true, manageAppVersionAndBuildNumber: false, uploadSymbols: false,
  }));
  await run('/usr/bin/xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportPath', exported, '-exportOptionsPlist', exportOptions], { log: 'xcode-export.log' });
  const exportedIpas = (await readdir(exported)).filter(name => name.endsWith('.ipa'));
  if (exportedIpas.length !== 1) throw Error('Expected exactly one exported IPA');
  const exportedIpa = path.join(exported, exportedIpas[0]);
  await run('/usr/bin/ditto', ['-xk', exportedIpa, extracted]);
  const payload = path.join(extracted, 'Payload');
  const mainApps = (await readdir(payload)).filter(name => name.endsWith('.app'));
  if (mainApps.length !== 1) throw Error('Expected exactly one main application in IPA');
  const builtApp = path.join(payload, mainApps[0]);
  const extensions = [];
  async function collectExtensions(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) if (entry.isDirectory()) {
      const file = path.join(directory, entry.name);
      if (entry.name.endsWith('.appex')) extensions.push(file);
      await collectExtensions(file);
    }
  }
  await collectExtensions(builtApp);
  if (extensions.length !== targets.size - 1) throw Error('Unexpected number of embedded application extensions');
  const summaries = [];
  const verifiedBundles = new Set();
  for (const file of [builtApp, ...extensions]) {
    const info = await readPlist(path.join(file, 'Info.plist'));
    const id = info.CFBundleIdentifier;
    const selected = profiles.get(id);
    if (!selected || verifiedBundles.has(id) || String(info.CFBundleVersion) !== String(buildNumber) || info.CFBundleShortVersionString !== version) throw Error('Exported target bundle/version/build mismatch');
    if ((file === builtApp) !== (id === bundleIdentifier)) throw Error('Main application identity mismatch');
    verifiedBundles.add(id);
    await run('/usr/bin/codesign', ['--verify', '--strict', file]);
    const signed = plist.parse((await run('/usr/bin/codesign', ['-d', '--entitlements', ':-', file])).stdout);
    if (signed['application-identifier'] !== `${appleTeamId}.${id}` || signed['com.apple.developer.team-identifier'] !== appleTeamId || signed['get-task-allow'] === true || !signed['com.apple.security.application-groups']?.includes(appGroup)) throw Error(`Signed target entitlement mismatch: ${id}`);
    const signature = await run('/usr/bin/codesign', ['-d', '--verbose=4', file]);
    if (!`${signature.stdout}\n${signature.stderr}`.split(/\r?\n/).includes(`TeamIdentifier=${appleTeamId}`)) throw Error(`Code signature Team mismatch: ${id}`);
    const embedded = await decodeProfile(path.join(file, 'embedded.mobileprovision'));
    const profileSummary = validateStoreProfile(embedded, id, selected.profile.UUID);
    const authorized = embedded.DeveloperCertificates.some(bytes => new X509Certificate(bytes).fingerprint.replaceAll(':', '').toUpperCase() === identity);
    if (!authorized) throw Error(`Exported profile does not authorize the selected certificate: ${id}`);
    const certificatePrefix = path.join(output, `verified-signer-${summaries.length}-`);
    await run('/usr/bin/codesign', ['-d', `--extract-certificates=${certificatePrefix}`, file]);
    const actualSigner = new X509Certificate(await readFile(`${certificatePrefix}0`));
    if (actualSigner.fingerprint.replaceAll(':', '').toUpperCase() !== identity) throw Error(`Exported code signature certificate mismatch: ${id}`);
    summaries.push({ bundleIdentifier: id, version: info.CFBundleShortVersionString, buildNumber: String(info.CFBundleVersion), ...profileSummary, codeSignatureVerified: true, signingCertificateSha256: actualSigner.fingerprint256.replaceAll(':', '').toLowerCase() });
  }
  if (verifiedBundles.size !== targets.size) throw Error('An expected signing target was not verified');
  await run('/usr/bin/codesign', ['--verify', '--deep', '--strict', builtApp]);
  const nativeJsBytes = (await stat(path.join(builtApp, 'main.jsbundle'))).size;
  if (!nativeJsBytes) throw Error('Missing native main.jsbundle');
  const domBundles = [];
  async function collectDomBundles(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) if (entry.isDirectory()) {
      const file = path.join(directory, entry.name);
      if (entry.name === 'www.bundle') domBundles.push(file);
      else if (!entry.name.endsWith('.appex') && !entry.name.endsWith('.framework')) await collectDomBundles(file);
    }
  }
  await collectDomBundles(builtApp);
  if (domBundles.length !== 1 || !(await readdir(domBundles[0])).length) throw Error('Missing or ambiguous DOM www.bundle');
  await copyFile(exportedIpa, ipa);
  await assertNativeInputs(repo, signedNativeInputs);
  report = { ...sourceReceipt(manifest), builtAt: new Date().toISOString(), version, buildNumber, bundleIdentifier, appId: release.appId, appleTeamId: release.appleTeamId, builtApp, ipa, bytes: (await stat(ipa)).size, sha256: await hashFile(ipa), targets: summaries, runtime: { nativeJsBytes, domBundle: path.relative(builtApp, domBundles[0]) }, derivedDataRemovedAfterArchive: false, derivedData, tooling, nativeInputs: signedNativeInputs };
} catch (error) { failure = error; }
finally {
  try { await run('/usr/bin/security', ['list-keychains', '-d', 'user', '-s', ...originalKeychains]); }
  catch { cleanupFailures.push('Unable to restore original user keychain search list'); }
  if (keychainCreated) {
    try { await run('/usr/bin/security', ['lock-keychain', keychain]); }
    catch { cleanupFailures.push('Unable to lock the isolated build keychain'); }
  }
}
if (failure || cleanupFailures.length) throw Error([failure?.message, ...cleanupFailures].filter(Boolean).join('; '));
report.keychainSearchListRestored = true;
report.isolatedKeychainLocked = true;
await writeFile(path.join(output, 'build-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ ...report, nativeInputs: { sha256: report.nativeInputs.sha256, fileCount: report.nativeInputs.files.length } }, null, 2));
