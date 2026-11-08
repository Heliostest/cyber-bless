import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createHash, verify } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, rename } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import certificates from '@expo/code-signing-certificates';

// All keys are ephemeral test fixtures, generated in the OS temporary directory.
async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cyber-internal-updates-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const pair = certificates.generateKeyPair();
  const { privateKeyPEM } = certificates.convertKeyPairToPEM(pair);
  const cert = certificates.generateSelfSignedCodeSigningCertificate({ keyPair: pair,
    validityNotBefore: new Date(Date.now() - 60000), validityNotAfter: new Date(Date.now() + 86400000), commonName: 'Ephemeral test' });
  const certificate = certificates.convertCertificateToCertificatePEM(cert);
  const privateKeyPath = path.join(dir, 'private.pem'), certificatePath = path.join(dir, 'certificate.pem');
  await writeFile(privateKeyPath, privateKeyPEM); await writeFile(certificatePath, certificate);
  const mod = await import('./service.mjs');
  const exportDir = path.join(dir, 'export');
  await mkdir(path.join(exportDir, '_expo', 'static', 'js', 'ios'), { recursive: true });
  await mkdir(path.join(exportDir, '_expo', 'static', 'js', 'android'), { recursive: true });
  await mkdir(path.join(exportDir, 'dom'), { recursive: true });
  await mkdir(path.join(exportDir, 'assets'), { recursive: true });
  const html = '<html><script src="./bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.js"></script><link rel="stylesheet" href="./cccccccccccccccccccccccccccccccc.css"></html>';
  const files = { '_expo/static/js/ios/index.hbc': 'ios bytecode', '_expo/static/js/android/index.hbc': 'android bytecode',
    'dom/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.html': html, 'dom/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.js': 'console.log("DOM v1")',
    'dom/cccccccccccccccccccccccccccccccc.css': 'body{color:red}', 'assets/dddddddddddddddddddddddddddddddd': 'font bytes' };
  await Promise.all(Object.entries(files).map(([name, value]) => writeFile(path.join(exportDir, name), value)));
  const assets = [{ path: 'assets/dddddddddddddddddddddddddddddddd', ext: 'ttf' },
    { path: 'dom/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.html', ext: 'html' }, { path: 'dom/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.js', ext: 'js' },
    { path: 'dom/cccccccccccccccccccccccccccccccc.css', ext: 'css' }];
  const metadata = { version: 0, bundler: 'metro', fileMetadata: {
    ios: { bundle: '_expo/static/js/ios/index.hbc', assets }, android: { bundle: '_expo/static/js/android/index.hbc', assets } } };
  await writeFile(path.join(exportDir, 'metadata.json'), JSON.stringify(metadata));
  const signing = { privateKeyPath, certificatePath };
  const source = { commit: '1'.repeat(40), tree: '2'.repeat(40), dirty: false, method: 'clean-git-metro-export' };
  const packageDir = path.join(dir, 'package');
  await mod.packageExpoExport({ exportDir, outputDir: packageDir, runtimeVersion: 'test-native-1', source, message: 'First release', ...signing });
  const service = mod.createInternalUpdateService({ storageDir: path.join(dir, 'store'), publicBaseUrl: 'https://updates.example.test', ...signing });
  return { ...mod, dir, service, signing, source, metadata, exportDir, packageDir, certificate };
}

async function serve(t, service) {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.headers['x-local-admin'] === 'test' && await service.handleAdmin(req, res)) return;
      if (await service.handlePublic(req, res, { authorized: req.headers['x-feedback-token'] === 'test-invite' })) return;
      res.writeHead(404).end();
    } catch (error) { res.writeHead(500).end(error.message); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}
const expoHeaders = { 'expo-protocol-version': '1', 'expo-platform': 'ios', 'expo-runtime-version': 'test-native-1',
  'x-feedback-token': 'test-invite', accept: 'application/expo+json', 'expo-expect-signature': 'sig, keyid="main", alg="rsa-v1_5-sha256"' };
const signatureBytes = header => Buffer.from(/sig="([^"]+)"/.exec(header)[1], 'base64');

test('real HTTP serves signed compatible immutable launch and DOM assets only after authorized publication', async t => {
  const f = await fixture(t), base = await serve(t, f.service);
  const release = await f.service.importRelease(f.packageDir);
  let response = await fetch(`${base}/api/internal-updates/check`, { headers: expoHeaders });
  assert.equal(response.status, 204);
  await f.service.publish({ releaseId: release.id });
  response = await fetch(`${base}/api/internal-updates/check`, { headers: expoHeaders });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('expo-protocol-version'), '1');
  const body = await response.text(), manifest = JSON.parse(body);
  assert.equal(verify('RSA-SHA256', Buffer.from(body), f.certificate, signatureBytes(response.headers.get('expo-signature'))), true);
  assert.equal(manifest.runtimeVersion, 'test-native-1');
  assert.equal(manifest.extra.internalUpdates.sourceCommit, '1'.repeat(40));
  assert.equal(manifest.extra.internalUpdates.sourceTree, '2'.repeat(40));
  assert.equal(manifest.assets.length, 4);
  assert.equal(manifest.assets.find(a => a.fileExtension === '.html').key, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  for (const asset of [manifest.launchAsset, ...manifest.assets]) {
    const url = new URL(asset.url);
    assert.equal(url.origin, 'https://updates.example.test');
    const assetResponse = await fetch(`${base}${url.pathname}`);
    assert.equal(assetResponse.status, 200);
    const bytes = Buffer.from(await assetResponse.arrayBuffer());
    assert.equal(createHash('sha256').update(bytes).digest('base64url'), asset.hash);
  }
  assert.equal((await fetch(`${base}/api/internal-updates/check`, { headers: { ...expoHeaders, 'x-feedback-token': '' } })).status, 401);
  assert.equal((await fetch(`${base}/api/internal-updates/check`, { headers: { ...expoHeaders, 'expo-runtime-version': 'other' } })).status, 204);
  assert.equal((await fetch(`${base}/api/internal-updates/assets/${'0'.repeat(64)}`)).status, 404);
  assert.equal((await fetch(`${base}/api/internal-updates/assets/%2e%2e%2fprivate.pem`)).status, 400);
  assert.equal((await fetch(`${base}/api/internal-updates/check`, { headers: { ...expoHeaders, 'expo-expect-signature': 'sig, keyid="wrong"' } })).status, 406);
});

test('import rejects changed hashes, unsigned provenance, unsafe metadata, and missing DOM files without creating candidates', async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.packageDir, 'files', 'assets', 'dddddddddddddddddddddddddddddddd'), 'changed bytes');
  await assert.rejects(f.service.importRelease(f.packageDir), /hash|integrity/i);
  assert.equal((await f.service.list()).releases.length, 0);
  await f.packageExpoExport({ exportDir: f.exportDir, outputDir: path.join(f.dir, 'package2'), runtimeVersion: 'test-native-1', source: f.source, ...f.signing });
  const receiptPath = path.join(f.dir, 'package2', 'release.json');
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8')); receipt.source.commit = 'f'.repeat(40);
  await writeFile(receiptPath, JSON.stringify(receipt));
  await assert.rejects(f.service.importRelease(path.dirname(receiptPath)), /signature/i);
  f.metadata.fileMetadata.ios.assets.push({ path: '../private.pem', ext: 'pem' });
  await writeFile(path.join(f.exportDir, 'metadata.json'), JSON.stringify(f.metadata));
  await assert.rejects(f.packageExpoExport({ exportDir: f.exportDir, outputDir: path.join(f.dir, 'bad'), runtimeVersion: 'test-native-1', source: f.source, ...f.signing }), /path/i);
  f.metadata.fileMetadata.ios.assets.pop();
  await writeFile(path.join(f.exportDir, 'metadata.json'), JSON.stringify(f.metadata));
  await rm(path.join(f.exportDir, 'dom', 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.js'));
  await assert.rejects(f.packageExpoExport({ exportDir: f.exportDir, outputDir: path.join(f.dir, 'partial'), runtimeVersion: 'test-native-1', source: f.source, ...f.signing }), /missing|ENOENT/i);
});

test('rollback republishes old bytes with a newer UUID and timestamp and signs embedded rollback directives', async t => {
  const f = await fixture(t), base = await serve(t, f.service), old = await f.service.importRelease(f.packageDir);
  const first = await f.service.publish({ releaseId: old.id });
  await writeFile(path.join(f.exportDir, '_expo/static/js/ios/index.hbc'), 'new ios bytes');
  await f.packageExpoExport({ exportDir: f.exportDir, outputDir: path.join(f.dir, 'new'), runtimeVersion: 'test-native-1', source: f.source, ...f.signing });
  const next = await f.service.importRelease(path.join(f.dir, 'new'));
  const second = await f.service.publish({ releaseId: next.id });
  const rolled = await f.service.rollback({ releaseId: old.id });
  const response = await fetch(`${base}/api/internal-updates/check`, { headers: expoHeaders }), manifest = await response.json();
  assert.notEqual(manifest.id, first.publications.find(p => p.platform === 'ios').updateId);
  assert.notEqual(manifest.id, second.publications.find(p => p.platform === 'ios').updateId);
  assert.ok(Date.parse(manifest.createdAt) > Date.parse(second.publications.find(p => p.platform === 'ios').createdAt));
  assert.equal(manifest.extra.internalUpdates.releaseId, old.id);
  assert.equal(rolled.publications.find(p => p.platform === 'ios').rollbackFromReleaseId, next.id);
  await f.service.rollback({ embedded: true, platform: 'ios', runtimeVersion: 'test-native-1' });
  assert.equal((await fetch(`${base}/api/internal-updates/check`, { headers: expoHeaders })).status, 406);
  const directiveResponse = await fetch(`${base}/api/internal-updates/check`, { headers: { ...expoHeaders, accept: 'multipart/mixed' } });
  assert.equal(directiveResponse.status, 200);
  const body = await directiveResponse.text();
  const json = /\r\n\r\n(\{[^\r]+\})\r\n--/.exec(body)[1];
  const signature = /expo-signature: ([^\r]+)/i.exec(body)[1];
  assert.equal(verify('RSA-SHA256', Buffer.from(json), f.certificate, signatureBytes(signature)), true);
  assert.equal(JSON.parse(json).type, 'rollBackToEmbedded');
  assert.ok(Date.parse(JSON.parse(json).parameters.commitTime));
});

test('embedded rollback reaches a client still running embedded A after downloading B', async t => {
  const f = await fixture(t), base = await serve(t, f.service), release = await f.service.importRelease(f.packageDir);
  const embeddedId = '11111111-1111-4111-8111-111111111111';
  const headers = { ...expoHeaders, 'expo-current-update-id': embeddedId, 'expo-embedded-update-id': embeddedId };
  await f.service.publish({ releaseId: release.id });
  const downloaded = await (await fetch(`${base}/api/internal-updates/check`, { headers })).json();
  // Downloading does not change the running update ID. B is now cached but A is still running.
  for (const asset of [downloaded.launchAsset, ...downloaded.assets]) {
    const response = await fetch(`${base}${new URL(asset.url).pathname}`);
    assert.equal(response.status, 200);
    await response.arrayBuffer();
  }
  await f.service.rollback({ embedded: true, platform: 'ios', runtimeVersion: 'test-native-1' });
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`${base}/api/internal-updates/check`, { headers: { ...headers, accept: 'multipart/mixed' } });
    assert.equal(response.status, 200, 'Native selection must receive the directive even while embedded A is running');
    const body = await response.text(), directiveBody = /\r\n\r\n(\{[^\r]+\})\r\n--/.exec(body)[1];
    const signature = /expo-signature: ([^\r]+)/i.exec(body)[1];
    assert.equal(verify('RSA-SHA256', Buffer.from(directiveBody), f.certificate, signatureBytes(signature)), true);
    const directive = JSON.parse(directiveBody);
    assert.equal(directive.type, 'rollBackToEmbedded');
    assert.ok(Date.parse(directive.parameters.commitTime) > Date.parse(downloaded.createdAt));
  }
});

test('admin HTTP accepts only verified IDs and publishes all platform pointers atomically', async t => {
  const f = await fixture(t), base = await serve(t, f.service), release = await f.service.importRelease(f.packageDir);
  const post = (url, data) => fetch(`${base}${url}`, { method: 'POST', headers: { 'x-local-admin': 'test', 'content-type': 'application/json' }, body: JSON.stringify(data) });
  assert.equal((await post('/api/internal-updates/publish', { releaseId: '../../private.pem' })).status, 400);
  assert.equal((await post('/api/internal-updates/publish', { releaseId: release.id, command: 'echo nope' })).status, 400);
  assert.equal((await post('/api/internal-updates/publish', { releaseId: release.id })).status, 200);
  const list = await (await fetch(`${base}/api/internal-updates`, { headers: { 'x-local-admin': 'test' } })).json();
  assert.equal(list.releases[0].verified, true);
  assert.equal(list.channels.length, 2);
  await writeFile(path.join(f.dir, 'store', 'blobs', (await readFile(path.join(f.packageDir, 'release.json'), 'utf8')).match(/"sha256":\s*"([a-f0-9]+)"/)[1]), 'corrupt');
  const previous = await readFile(path.join(f.dir, 'store', 'channel.json'), 'utf8');
  await assert.rejects(f.service.publish({ releaseId: release.id }), /hash|integrity/i);
  assert.equal(await readFile(path.join(f.dir, 'store', 'channel.json'), 'utf8'), previous);
});

test('missing signing configuration disables publication without preventing service creation', async t => {
  const { createInternalUpdateService } = await import('./service.mjs');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cyber-no-signing-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const service = createInternalUpdateService({ storageDir: dir, publicBaseUrl: 'https://updates.example.test' });
  assert.equal((await service.list()).signingConfigured, false);
  await assert.rejects(service.publish({ releaseId: '11111111-1111-4111-8111-111111111111' }), /signing/i);
});

test('Windows Metro metadata paths normalize while unregistered workspace files stay outside the package', async t => {
  const f = await fixture(t);
  for (const platform of ['ios', 'android']) {
    f.metadata.fileMetadata[platform].bundle = f.metadata.fileMetadata[platform].bundle.replaceAll('/', '\\');
    f.metadata.fileMetadata[platform].assets = f.metadata.fileMetadata[platform].assets.map(asset => ({ ...asset, path: asset.path.replaceAll('/', '\\') }));
  }
  await writeFile(path.join(f.exportDir, 'metadata.json'), JSON.stringify(f.metadata));
  await writeFile(path.join(f.exportDir, 'private.key'), 'must never be included');
  const packageDir = path.join(f.dir, 'windows-package');
  const release = await f.packageExpoExport({ exportDir: f.exportDir, outputDir: packageDir, runtimeVersion: 'test-native-1', source: f.source, ...f.signing });
  assert.equal(release.files.some(file => file.path.includes('\\')), false);
  assert.equal(release.files.length, 6);
  await assert.rejects(readFile(path.join(packageDir, 'files', 'private.key')), { code: 'ENOENT' });
  await f.service.importRelease(packageDir);
});

test('incomplete LFS objects and executable external DOM dependencies cannot become a signed package', async t => {
  const f = await fixture(t), htmlPath = path.join(f.exportDir, 'dom/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.html');
  const packageIt = output => f.packageExpoExport({ exportDir: f.exportDir, outputDir: path.join(f.dir, output), runtimeVersion: 'test-native-1', source: f.source, ...f.signing });
  await writeFile(htmlPath, '<script src=https://example.invalid/runtime.js></script>');
  await assert.rejects(packageIt('external-html'), /external|dependency/i);
  await writeFile(htmlPath, '<script src="./bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.js"></script>');
  await writeFile(path.join(f.exportDir, 'dom/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.js'), 'import("https://example.invalid/runtime.js")');
  await assert.rejects(packageIt('external-js'), /external|dependency/i);
  await writeFile(path.join(f.exportDir, 'dom/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.js'), 'console.log("local")');
  await writeFile(path.join(f.exportDir, 'assets/dddddddddddddddddddddddddddddddd'), 'version https://git-lfs.github.com/spec/v1\noid sha256:' + 'a'.repeat(64) + '\nsize 100\n');
  await assert.rejects(packageIt('lfs-pointer'), /LFS|pointer/i);
});

test('published history stays downloadable after channel switches and republishing cannot mutate prepared identities', async t => {
  const f = await fixture(t), base = await serve(t, f.service), release = await f.service.importRelease(f.packageDir);
  await f.service.publish({ releaseId: release.id });
  const oldManifest = await (await fetch(`${base}/api/internal-updates/check`, { headers: expoHeaders })).json();
  await f.service.rollback({ embedded: true, platform: 'ios', runtimeVersion: 'test-native-1' });
  const oldAsset = new URL(oldManifest.launchAsset.url);
  assert.equal((await fetch(`${base}${oldAsset.pathname}`)).status, 200);
  await assert.rejects(f.packageExpoExport({ exportDir: f.exportDir, outputDir: f.packageDir, runtimeVersion: 'test-native-1', source: f.source, ...f.signing }), /already exists/i);
  assert.equal((await f.service.importRelease(f.packageDir)).id, release.id);
});

test('public protocol rejects platform/version/method mismatch and local admin returns a bounded body error', async t => {
  const f = await fixture(t), base = await serve(t, f.service);
  const check = headers => fetch(`${base}/api/internal-updates/check`, { headers: { ...expoHeaders, ...headers } });
  assert.equal((await check({ 'expo-platform': 'web' })).status, 400);
  assert.equal((await check({ 'expo-protocol-version': '0' })).status, 406);
  assert.equal((await check({ 'expo-channel-name': 'production' })).status, 400);
  assert.equal((await fetch(`${base}/api/internal-updates/check`, { method: 'POST', headers: expoHeaders })).status, 405);
  assert.equal((await fetch(`${base}/api/internal-updates/publish`, { method: 'POST', headers: { 'x-local-admin': 'test', 'content-type': 'application/json' }, body: JSON.stringify({ releaseId: 'x'.repeat(20000) }) })).status, 413);
});

test('corrupted stored publication labels cannot misreport signed source or select an incompatible runtime', async t => {
  const f = await fixture(t), base = await serve(t, f.service), release = await f.service.importRelease(f.packageDir);
  const { publications } = await f.service.publish({ releaseId: release.id });
  const ios = publications.find(p => p.platform === 'ios'), publicationPath = path.join(f.dir, 'store/publications', `${ios.updateId}.json`);
  const publication = JSON.parse(await readFile(publicationPath, 'utf8'));
  publication.sourceCommit = 'f'.repeat(40);
  await writeFile(publicationPath, JSON.stringify(publication));
  assert.equal((await fetch(`${base}/api/internal-updates/check`, { headers: expoHeaders })).status, 503);
  publication.sourceCommit = '1'.repeat(40); await writeFile(publicationPath, JSON.stringify(publication));
  const statePath = path.join(f.dir, 'store/channel.json'), state = JSON.parse(await readFile(statePath, 'utf8'));
  state.entries.find(entry => entry.platform === 'ios').runtimeVersion = 'wrong-native-runtime';
  await writeFile(statePath, JSON.stringify(state));
  assert.equal((await fetch(`${base}/api/internal-updates/check`, { headers: { ...expoHeaders, 'expo-runtime-version': 'wrong-native-runtime' } })).status, 503);
});

test('an unavailable configured private key reports disabled signing rather than admitting a publication', async t => {
  const f = await fixture(t), release = await f.service.importRelease(f.packageDir);
  await rm(f.signing.privateKeyPath);
  assert.equal((await f.service.list()).signingConfigured, false);
  await assert.rejects(f.service.publish({ releaseId: release.id }), /signing.*unavailable|not configured/i);
});

test('SDK57 www.bundle hashed DOM files package and import while hostile paths and external JS imports are rejected', async t => {
  const f = await fixture(t);
  await rename(path.join(f.exportDir, 'dom'), path.join(f.exportDir, 'www.bundle'));
  for (const platform of ['ios', 'android']) f.metadata.fileMetadata[platform].assets = f.metadata.fileMetadata[platform].assets.map(asset => ({ ...asset, path: asset.path.replace(/^dom\//, 'www.bundle/') }));
  const save = () => writeFile(path.join(f.exportDir, 'metadata.json'), JSON.stringify(f.metadata));
  const packageIt = name => f.packageExpoExport({ exportDir: f.exportDir, outputDir: path.join(f.dir, name), runtimeVersion: 'test-native-1', source: f.source, ...f.signing });
  await save();
  const release = await packageIt('sdk57-www');
  assert.equal(release.files.filter(file => file.path.startsWith('www.bundle/')).length, 3);
  assert.equal(release.files.find(file => file.ext === 'html').key, 'a'.repeat(32));
  assert.equal((await f.service.importRelease(path.join(f.dir, 'sdk57-www'))).id, release.id);
  const original = f.metadata.fileMetadata.ios.assets[1].path;
  for (const [index, hostile] of [
    'www.bundle/../../private.pem', `www.bundle/${'a'.repeat(31)}.html`, 'www.bundle/ordinary.html',
    `www.bundle/${'a'.repeat(32)}.map`, `www.bundle/${'a'.repeat(32)}.pem`,
    `www.bundle/subdir/${'a'.repeat(32)}.html`, `www.bundle/${'a'.repeat(32)}.html/child`,
    `www.bundle/${'a'.repeat(32)}.html?token=bad`, `www.bundleX/${'a'.repeat(32)}.html`,
  ].entries()) {
    f.metadata.fileMetadata.ios.assets[1].path = hostile; await save();
    await assert.rejects(packageIt(`hostile-${index}`), /path|allowlist/i);
  }
  f.metadata.fileMetadata.ios.assets[1].path = original; await save();
  await writeFile(path.join(f.exportDir, 'www.bundle', `${'b'.repeat(32)}.js`), 'import("https://example.invalid/runtime.js")');
  await assert.rejects(packageIt('external-www-js'), /external|dependency/i);
});

test('real existing SDK57 export validates using only ephemeral test signing and synthetic test provenance', { skip: !process.env.INTERNAL_UPDATES_REAL_EXPORT_DIR }, async t => {
  const f = await fixture(t);
  const release = await f.packageExpoExport({ exportDir: path.resolve(process.env.INTERNAL_UPDATES_REAL_EXPORT_DIR), outputDir: path.join(f.dir, 'real-export-test-only'),
    runtimeVersion: 'TEST-ONLY-NOT-A-PRODUCTION-RUNTIME', source: f.source, message: 'TEST ONLY: synthetic fixture provenance, never publish this attestation', ...f.signing });
  assert.ok(release.files.some(file => /^www\.bundle\/[a-f0-9]{32}\.html$/.test(file.path)));
  assert.ok(release.files.some(file => /^www\.bundle\/[a-f0-9]{32}\.js$/.test(file.path)));
  assert.equal((await f.service.importRelease(path.join(f.dir, 'real-export-test-only'))).id, release.id);
  t.diagnostic(`Structurally validated ${release.files.length} files (${release.files.reduce((sum, file) => sum + file.size, 0)} bytes) with synthetic test provenance only`);
});
