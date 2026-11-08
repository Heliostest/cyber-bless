import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import certificates from '@expo/code-signing-certificates';
const execute = promisify(execFile);

test('source identity attests actual committed tree and rejects tracked or untracked changes', async t => {
  const { captureCleanSource } = await import('./cli.mjs');
  const repo = await mkdtemp(path.join(os.tmpdir(), 'internal-source-')); t.after(() => rm(repo, { recursive: true, force: true }));
  const git = args => execute('git', args, { cwd: repo, windowsHide: true });
  await git(['init']); await git(['config', 'user.name', 'Test']); await git(['config', 'user.email', 'test@example.invalid']);
  await writeFile(path.join(repo, 'scene.js'), 'committed'); await git(['add', '.']); await git(['commit', '-m', 'Fixture']);
  const source = await captureCleanSource(repo);
  assert.equal(source.commit, (await git(['rev-parse', 'HEAD'])).stdout.trim());
  assert.equal(source.tree, (await git(['rev-parse', 'HEAD^{tree}'])).stdout.trim());
  assert.equal(source.dirty, false);
  await writeFile(path.join(repo, 'scene.js'), 'dirty');
  await assert.rejects(captureCleanSource(repo), /clean|uncommitted/i);
  await git(['restore', 'scene.js']); await writeFile(path.join(repo, 'untracked.js'), 'dirty');
  await assert.rejects(captureCleanSource(repo), /clean|uncommitted/i);
});

test('CLI list runs without signing setup and CLI rejects command-shaped selections', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'internal-cli-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const cli = path.resolve('scripts/internal-updates/cli.mjs');
  const { stdout } = await execute(process.execPath, [cli, 'list', '--store', dir, '--public-url', 'https://updates.example.test', '--private-key', path.join(dir, 'missing-key.pem'), '--certificate', path.join(dir, 'missing-cert.pem')], { windowsHide: true });
  assert.equal(JSON.parse(stdout).signingConfigured, false);
  assert.deepEqual(JSON.parse(stdout).releases, []);
  await assert.rejects(execute(process.execPath, [cli, 'publish', '--release', '../../secret', '--command', 'echo hello'], { windowsHide: true }), error => {
    assert.match(error.stderr, /Unknown option|unsupported/i); return true;
  });
});

test('prepare regenerates ignored registered inputs and refuses source or alias mutations during export', async t => {
  const { prepareRelease } = await import('./cli.mjs');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'internal-prepare-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const repo = path.join(dir, 'repo'); await mkdir(repo);
  const git = args => execute('git', args, { cwd: repo, windowsHide: true });
  await git(['init']); await git(['config', 'user.name', 'Test']); await git(['config', 'user.email', 'test@example.invalid']);
  await writeFile(path.join(repo, '.gitignore'), 'node_modules/\npublic/\n');
  await writeFile(path.join(repo, 'scene.js'), 'committed scene bytes');
  await writeFile(path.join(repo, 'package.json'), '{"name":"export-fixture","private":true}');
  await mkdir(path.join(repo, 'scripts')); await mkdir(path.join(repo, 'assets'));
  await writeFile(path.join(repo, 'assets/license.json'), 'committed asset bytes');
  const generator = `const fs=require('node:fs'),crypto=require('node:crypto');
    const bytes=fs.readFileSync('assets/license.json'),md5=crypto.createHash('md5').update(bytes).digest('hex'),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
    fs.mkdirSync('public',{recursive:true});fs.writeFileSync('public/license.json.bin',bytes);
    fs.writeFileSync('public/wbr-assets.json',JSON.stringify([{file:'license.json',bytes:bytes.length,sha256}]));
    fs.writeFileSync('bundled-assets.generated.ts','export const bundledAssetModules = {\\n  "license.json": { module: require("./public/license.json.bin"), bytes: '+bytes.length+', md5: "'+md5+'" },\\n};\\n');`;
  await writeFile(path.join(repo, 'scripts/prepare-app-assets.mjs'), `import { createRequire } from 'node:module';const require=createRequire(import.meta.url);${generator}`);
  await writeFile(path.join(repo, 'scripts/i18n-compile.mjs'), 'import fs from "node:fs";fs.mkdirSync("public",{recursive:true});fs.writeFileSync("public/i18n.json","generated catalogs");');
  await execute(process.execPath, [path.join(repo, 'scripts/prepare-app-assets.mjs')], { cwd: repo, windowsHide: true });
  await git(['add', '.']); await git(['commit', '-m', 'Fixture']);
  // Ignored aliases are invisible to git status but can alter the bytes bundled by Metro.
  await writeFile(path.join(repo, 'public/license.json.bin'), 'tampered ignored bytes');
  assert.equal((await git(['status', '--porcelain'])).stdout.trim(), '');
  // The installed tool process boundary is represented by small real executable packages.
  // Assertions inspect the resulting signed package and source refusal, not child invocation mocks.
  await mkdir(path.join(repo, 'node_modules/expo/bin'), { recursive: true });
  await mkdir(path.join(repo, 'node_modules/expo-updates/bin'), { recursive: true });
  await writeFile(path.join(repo, 'node_modules/expo/package.json'), '{"name":"expo"}');
  await writeFile(path.join(repo, 'node_modules/expo-updates/package.json'), '{"name":"expo-updates"}');
  const exporter = `const fs=require('node:fs'),path=require('node:path');
    if(process.argv[2]==='config'){console.log(JSON.stringify({name:'Fixture',extra:{invitation:'NEVER_COPY_THIS'},updates:{requestHeaders:{token:'NEVER_COPY_THIS'}}}));process.exit(0)}
    const out=process.argv[process.argv.indexOf('--output-dir')+1];fs.mkdirSync(path.join(out,'_expo/static/js/ios'),{recursive:true});fs.mkdirSync(path.join(out,'assets'));
    fs.writeFileSync(path.join(out,'_expo/static/js/ios/index.hbc'),fs.readFileSync('scene.js'));
    const asset=fs.readFileSync('public/license.json.bin'),hash=require('node:crypto').createHash('md5').update(asset).digest('hex');fs.writeFileSync(path.join(out,'assets',hash),asset);
    fs.writeFileSync(path.join(out,'metadata.json'),JSON.stringify({version:0,bundler:'metro',fileMetadata:{ios:{bundle:'_expo/static/js/ios/index.hbc',assets:[{path:'assets/'+hash,ext:'bin'}]}}}));`;
  await writeFile(path.join(repo, 'node_modules/expo/bin/cli'), exporter);
  await writeFile(path.join(repo, 'node_modules/expo-updates/bin/cli.js'), 'console.log(JSON.stringify({runtimeVersion:"actual-native-runtime"}))');
  const pair = certificates.generateKeyPair(), key = certificates.convertKeyPairToPEM(pair);
  const cert = certificates.generateSelfSignedCodeSigningCertificate({ keyPair: pair, validityNotBefore: new Date(Date.now() - 1000), validityNotAfter: new Date(Date.now() + 86400000), commonName: 'Ephemeral test' });
  const privateKeyPath = path.join(dir, 'private.pem'), certificatePath = path.join(dir, 'certificate.pem');
  await writeFile(privateKeyPath, key.privateKeyPEM); await writeFile(certificatePath, certificates.convertCertificateToCertificatePEM(cert));
  const prepare = outputDir => prepareRelease({ repoDir: repo, projectDir: repo, outputDir, platform: 'ios', privateKeyPath, certificatePath });
  const packageDir = path.join(dir, 'prepared'), release = await prepare(packageDir);
  assert.equal(release.runtimeVersion, 'actual-native-runtime');
  assert.equal(release.source.commit, (await git(['rev-parse', 'HEAD'])).stdout.trim());
  assert.equal(await readFile(path.join(packageDir, 'files/_expo/static/js/ios/index.hbc'), 'utf8'), 'committed scene bytes');
  const registeredAsset = release.files.find(file => file.path.startsWith('assets/'));
  assert.equal(await readFile(path.join(packageDir, 'files', registeredAsset.path), 'utf8'), 'committed asset bytes');
  assert.equal(await readFile(path.join(repo, 'public/i18n.json'), 'utf8'), 'generated catalogs');
  assert.equal((await readFile(path.join(packageDir, 'release.json'), 'utf8')).includes('NEVER_COPY_THIS'), false);
  await rm(path.join(repo, 'public'), { recursive: true, force: true });
  assert.equal((await prepare(path.join(dir, 'fresh-output'))).files.length, 2);
  await writeFile(path.join(repo, 'node_modules/expo/bin/cli'), exporter + '\nfs.writeFileSync("public/license.json.bin","modified during export")');
  await assert.rejects(prepare(path.join(dir, 'changed-alias')), /generated|registered|asset|changed/i);
  await assert.rejects(readFile(path.join(dir, 'changed-alias/release.json')), { code: 'ENOENT' });
  const temporaryAliasExporter = exporter.replace("const asset=fs.readFileSync('public/license.json.bin')", "fs.writeFileSync('public/license.json.bin','tainted during Metro read');const asset=fs.readFileSync('public/license.json.bin')") + '\nfs.writeFileSync("public/license.json.bin","committed asset bytes")';
  await writeFile(path.join(repo, 'node_modules/expo/bin/cli'), temporaryAliasExporter);
  await assert.rejects(prepare(path.join(dir, 'tainted-export')), /registered|asset|source/i);
  await assert.rejects(readFile(path.join(dir, 'tainted-export/release.json')), { code: 'ENOENT' });
  await writeFile(path.join(repo, 'node_modules/expo/bin/cli'), exporter + '\nfs.writeFileSync("scene.js","modified during export")');
  await assert.rejects(prepare(path.join(dir, 'dirty-output')), /clean|uncommitted|changed/i);
  await assert.rejects(readFile(path.join(dir, 'dirty-output/release.json')), { code: 'ENOENT' });
});
