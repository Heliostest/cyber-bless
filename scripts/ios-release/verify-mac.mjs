import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assertReleaseSource, assertSourceReceipt, sourceReceipt } from './source-identity.mjs';
import { assertReleaseLock, assertOfficialBuildRoot } from './release-lock.mjs';
import { assertNativeInputs } from './native-inputs.mjs';

// Read-only product validation. Assets, the native project and the IPA must
// already exist; this helper only writes offline-validation.json on success.
const release = JSON.parse(await readFile(process.argv[2], 'utf8'));
const { manifest: sourceManifest } = await assertReleaseSource(release, { entrypoint: import.meta.url, allowPrebuildChanges: true, requirePrepared: true });
assertOfficialBuildRoot(release.buildRoot);
await assertReleaseLock(release.buildRoot);
const repo = path.resolve(release.repo);
const output = path.resolve(release.output);
if (output !== path.join(repo, 'artifacts/ios-release', String(release.buildNumber))) throw Error('Unexpected release output path');
const expectedBundleIdentifier = 'com.helio.cyberbless';
const expectedWidgetCoverCount = sourceManifest.validation.widgetImagesChecked + 3;
if (!Number.isSafeInteger(expectedWidgetCoverCount) || expectedWidgetCoverCount < 1) throw Error('Missing frozen source widget cover count');
const report = JSON.parse(await readFile(path.join(output, 'build-report.json'), 'utf8'));
await assertNativeInputs(repo, report.nativeInputs, { allowSigningChanges: true });
assertSourceReceipt(report, sourceManifest);
if (report.bundleIdentifier !== expectedBundleIdentifier || report.appId !== release.appId || report.appleTeamId !== release.appleTeamId || report.buildNumber !== release.buildNumber || report.version !== release.version) throw Error('Unexpected application/build in build report');
if (typeof report.builtApp !== 'string' || typeof report.ipa !== 'string' || !/^[a-f0-9]{64}$/.test(report.sha256 ?? '')) throw Error('Incomplete build report');
const builtApp = path.resolve(report.builtApp);
const relativeApp = path.relative(output, builtApp);
if (relativeApp.startsWith('..') || path.isAbsolute(relativeApp) || !new RegExp(`^verified-${report.buildNumber}/Payload/[^/]+\\.app$`).test(relativeApp)) throw Error('Built app is outside the expected current build output');
const ipa = path.resolve(report.ipa);
const relativeIpa = path.relative(output, ipa);
if (relativeIpa.startsWith('..') || path.isAbsolute(relativeIpa) || relativeIpa !== `blessing-${report.buildNumber}.ipa`) throw Error('IPA is outside the expected current build output');
if (!(await stat(builtApp)).isDirectory()) throw Error('Built app directory is missing');
async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(file)) hash.update(bytes);
  return hash.digest('hex');
}
if ((await stat(ipa)).size !== report.bytes || await hashFile(ipa) !== report.sha256) throw Error('IPA no longer matches the signed build report');
const config = JSON.parse(await readFile(path.join(repo, 'apps/mobile-expo/app.json'), 'utf8'));
if (report.version !== (config.expo.ios.version ?? config.expo.version)) throw Error('Build report marketing version differs from current source');

// The shared validator operates on Expo export:embed's main.bundle. An Xcode
// archive calls the same native entry main.jsbundle; adapt only this filename.
const validatorFile = path.join(repo, 'scripts/validate-mobile-embed.mjs');
const original = await readFile(validatorFile, 'utf8');
const nativeEntryExpression = "path.join(root, 'main.bundle')";
if (original.split(nativeEntryExpression).length !== 2) throw Error('Review the shared validator native entry filename adaptation');
const adapted = original.replace(nativeEntryExpression, "path.join(root, 'main.jsbundle')");
const { validateMobileEmbed, walk } = await import(`data:text/javascript;base64,${Buffer.from(adapted).toString('base64')}`);

const assetsManifestFile = path.join(repo, 'apps/mobile-expo/public/wbr-assets.json');
const assetsManifestBytes = await readFile(assetsManifestFile);
const assets = JSON.parse(assetsManifestBytes.toString('utf8'));
if (!Array.isArray(assets) || !assets.length) throw Error('Offline assets manifest is missing or empty');
const assetNames = new Set();
for (const asset of assets) {
  if (typeof asset.file !== 'string' || !asset.file || asset.file.includes('\\') || path.isAbsolute(asset.file) || asset.file.split('/').some(part => !part || part === '.' || part === '..') || assetNames.has(asset.file)) throw Error('Unsafe or duplicate offline source asset');
  if (!Number.isSafeInteger(asset.bytes) || asset.bytes < 1 || !/^[a-f0-9]{64}$/.test(asset.sha256 ?? '')) throw Error(`Invalid offline asset metadata: ${asset.file}`);
  assetNames.add(asset.file);
  const source = path.join(repo, 'assets', asset.file);
  if ((await stat(source)).size !== asset.bytes || await hashFile(source) !== asset.sha256) throw Error(`Offline source asset does not match the prepared manifest: ${asset.file}`);
}
const validation = await validateMobileEmbed(builtApp, assets);
const files = await walk(builtApp);
const domDirectory = path.dirname(path.join(builtApp, validation.page));
const domBundleSegment = path.relative(builtApp, domDirectory).split(path.sep).find(segment => segment === 'www.bundle');
if (!domBundleSegment) throw Error('Validated DOM page is not inside www.bundle');
const nativeJs = path.join(builtApp, 'main.jsbundle');
const nativeBundleBytes = (await stat(nativeJs)).size;
if (!nativeBundleBytes) throw Error('Native main.jsbundle is empty');

const coversManifestFile = path.join(repo, 'assets/widgets/today/manifest.json');
const coversManifestBytes = await readFile(coversManifestFile);
const covers = JSON.parse(coversManifestBytes.toString('utf8'));
if (!Array.isArray(covers.scenes) || !covers.scenes.length) throw Error('Widget cover source manifest is empty');
const generic = covers.scenes.find(scene => scene.id === 'woodfish');
if (!generic) throw Error('Widget fallback source scene is missing');
const sizes = ['small', 'medium', 'large'];
const expected = covers.scenes.flatMap(scene => sizes.map(size => ({ ...scene[size], sceneId: scene.id, size })));
for (const size of sizes) expected.push({ ...generic[size], sceneId: 'generic', size, file: `generic-${size}.png` });
if (expected.length !== expectedWidgetCoverCount) throw Error(`Review widget cover count: expected ${expectedWidgetCoverCount}, source declares ${expected.length}`);
const coverNames = new Set();
const coverResults = [];
for (const cover of expected) {
  if (typeof cover.file !== 'string' || !/^[a-z0-9-]+\.png$/.test(cover.file) || coverNames.has(cover.file) || !/^[a-f0-9]{64}$/.test(cover.sha256 ?? '')) throw Error('Invalid or duplicate widget image metadata');
  coverNames.add(cover.file);
  const source = path.join(repo, 'assets/widgets/today', cover.file);
  if (await hashFile(source) !== cover.sha256) throw Error(`Widget source image does not match its source manifest: ${cover.file}`);
  const suffix = `/assets/__assets/widgets/today/${cover.file}`;
  const matches = files.filter(file => file.endsWith(suffix));
  if (matches.length !== 1) throw Error(`Expected exactly one bundled widget image: ${cover.file}; found ${matches.length}`);
  const file = matches[0];
  if (await hashFile(file) !== cover.sha256) throw Error(`Bundled widget image hash mismatch: ${cover.file}`);
  coverResults.push({ file: cover.file, bytes: (await stat(file)).size, sha256: cover.sha256 });
}
const result = {
  nativeInputsSha256: report.nativeInputs.sha256,
  ...sourceReceipt(sourceManifest),
  checkedAt: new Date().toISOString(),
  version: report.version, buildNumber: report.buildNumber, bundleIdentifier: report.bundleIdentifier, appId: release.appId, appleTeamId: release.appleTeamId,
  ipa: report.ipa, ipaBytes: report.bytes, ipaSha256: report.sha256, ipaMatchesBuildReport: true,
  ...validation,
  nativeBundleBytes, nativeBundleSha256: await hashFile(nativeJs),
  mainJsBundleVerified: true, wwwBundleVerified: true,
  offlineSourceManifestSha256: createHash('sha256').update(assetsManifestBytes).digest('hex'),
  offlineAssetsMatchCurrentSource: true, offlineAssetsMatchPackagedDom: true,
  validatorSourceSha256: createHash('sha256').update(original).digest('hex'),
  widgetSourceManifestSha256: createHash('sha256').update(coversManifestBytes).digest('hex'),
  widgetSceneCount: covers.scenes.length, widgetCoverCount: coverResults.length,
  widgetCoverHashesVerified: true, widgetCovers: coverResults,
};
await writeFile(path.join(output, 'offline-validation.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ ...result, widgetCovers: undefined }, null, 2));
