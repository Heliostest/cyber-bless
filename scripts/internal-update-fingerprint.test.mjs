import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import Fingerprint from '@expo/fingerprint';
import Hash from '@expo/fingerprint/build/hash/Hash.js';
import Options from '@expo/fingerprint/build/Options.js';
import Config from '@expo/fingerprint/build/Config.js';

const require = createRequire(import.meta.url);
const repository = fileURLToPath(new URL('../', import.meta.url));
const project = path.join(repository, 'apps/mobile-expo');
const configPath = path.join(project, 'fingerprint.config.cjs');
const digest = bytes => createHash('sha1').update(bytes).digest('hex');
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cyber-fingerprint-')); t.after(() => rm(root, { recursive: true, force: true }));
  const app = path.join(root, 'apps/mobile-expo'); await mkdir(app, { recursive: true }); await mkdir(path.join(root, 'store/ios'), { recursive: true });
  await writeFile(path.join(root, 'store/ios/Podfile.lock'), 'PODS:\n  - EXUpdates (57.0.27)\n');
  await writeFile(path.join(app, 'package.json'), JSON.stringify({ name: 'fingerprint-fixture', version: '1.0.0', private: true }));
  await writeFile(path.join(app, 'app.json'), JSON.stringify({ expo: { name: 'Fixture', slug: 'fixture', sdkVersion: '57.0.0' } }));
  await writeFile(path.join(app, 'bridge.swift'), 'func bridgeVersion() -> Int { 1 }\n');
  await writeFile(path.join(app, 'widget-copy.generated.json'), '{"revision":"native-copy-v1"}\n');
  await writeFile(path.join(app, 'fingerprint.config.cjs'), `const base=require(${JSON.stringify(configPath)});module.exports={...base,extraSources:[...base.extraSources,{type:'file',filePath:'bridge.swift',reasons:['nativeBridge'],overrideHashKey:'fixture-native-bridge'}]};\n`);
  return { root, app };
}

test('installed SDK hashing normalizes CRLF across 1024-byte chunks without changing UTF-8 or a final bare CR', async t => {
  const config = require(configPath), { app } = await fixture(t);
  const expected = 'x'.repeat(1023) + '\n汉🙂\n' + 'y'.repeat(1022) + '\r';
  const lf = path.join(app, 'native.swift'), crlf = path.join(app, 'native-crlf.swift');
  await writeFile(lf, expected); await writeFile(crlf, expected.replaceAll('\n', '\r\n'));
  const options = await Options.normalizeOptionsAsync(app, { ...config, debug: true });
  const source = name => ({ type: 'file', filePath: name, reasons: ['nativeSource'], overrideHashKey: 'same-native-source' });
  const [first, second] = await Promise.all([
    Hash.createFingerprintFromSourcesAsync([source('native.swift')], app, options),
    Hash.createFingerprintFromSourcesAsync([source('native-crlf.swift')], app, options),
  ]);
  assert.equal(first.sources[0].hash, digest(Buffer.from(expected)));
  assert.equal(second.sources[0].hash, digest(Buffer.from(expected)));
  assert.equal(first.hash, second.hash);
  assert.equal(second.sources[0].debugInfo.isTransformed, true);
  const unicode = 'z'.repeat(1023) + '汉🙂\n';
  await writeFile(path.join(app, 'unicode.swift'), unicode.replaceAll('\n', '\r\n'));
  const unicodeResult = await Hash.createFingerprintFromSourcesAsync([source('unicode.swift')], app, options);
  assert.equal(unicodeResult.sources[0].hash, digest(Buffer.from(unicode)));
});

test('binary file bytes remain exact in the installed SDK hasher', async t => {
  const config = require(configPath), { app } = await fixture(t);
  const bytes = Buffer.from([0, 255, 13, 10, 0xE4, 0xB8, 0xAD, 13, 0, 10, 13]);
  await writeFile(path.join(app, 'model.glb'), bytes);
  const options = await Options.normalizeOptionsAsync(app, config);
  const result = await Hash.createFingerprintFromSourcesAsync([{ type: 'file', filePath: 'model.glb', reasons: ['binary'] }], app, options);
  assert.equal(result.sources[0].hash, digest(bytes));
  assert.equal(config.fileHookTransform({ type: 'file', filePath: 'model.glb' }, bytes, false, 'buffer'), bytes);
});

test('SDK config-tooling JavaScript exclusions are portable while native UI and custom plugin sources remain hashed', async t => {
  const config = require(configPath), { app } = await fixture(t);
  const files = [
    ['node_modules/@expo/config/build/index.js', true],
    ['node_modules/@expo/config-plugins/build/ios/Updates.js', true],
    ['node_modules/typescript/lib/typescript.js', true],
    ['node_modules/xml2js/lib/parser.js', true],
    ['node_modules/@expo/ui/ios/Bridge.swift', false],
    ['node_modules/@expo/ui/ios/native-build.js', false],
    ['node_modules/expo-updates/plugin/build/withUpdates.js', false],
    ['node_modules/custom-config-plugin/index.js', false],
    ['plugins/custom.cjs', false],
  ];
  const bytes = Buffer.from('native-or-plugin-input\n');
  for (const [file] of files) { await mkdir(path.dirname(path.join(app, file)), { recursive: true }); await writeFile(path.join(app, file), bytes); }
  const options = await Options.normalizeOptionsAsync(app, config);
  const result = await Hash.createFingerprintFromSourcesAsync(files.map(([file]) => ({ type: 'file', filePath: file, reasons: ['regression'] })), app, options);
  for (let index = 0; index < files.length; index++) assert.equal(result.sources[index].hash, files[index][1] ? null : digest(bytes), files[index][0]);
});

test('the actual Fingerprint API includes the frozen Pod lock and detects native-content or Pod-lock changes', async t => {
  require(configPath); const { app, root } = await fixture(t);
  const create = () => Fingerprint.createFingerprintAsync(app, { platforms: ['ios'], silent: true });
  const first = await create();
  const podSource = first.sources.find(source => source.overrideHashKey === 'cyber-bless:frozen-ios-pod-lock');
  assert.equal(podSource?.type, 'file'); assert.equal(podSource.filePath, '../../store/ios/Podfile.lock'); assert.ok(podSource.hash);
  const nativeCopy = first.sources.find(source => source.overrideHashKey === 'cyber-bless:native-widget-copy');
  assert.equal(nativeCopy?.type, 'file'); assert.equal(nativeCopy.filePath, 'widget-copy.generated.json');
  await writeFile(path.join(app, 'bridge.swift'), 'func bridgeVersion() -> Int { 1 }\r\n');
  await writeFile(path.join(root, 'store/ios/Podfile.lock'), 'PODS:\r\n  - EXUpdates (57.0.27)\r\n');
  await writeFile(path.join(app, 'widget-copy.generated.json'), '{"revision":"native-copy-v1"}\r\n');
  assert.equal((await create()).hash, first.hash);
  await writeFile(path.join(app, 'bridge.swift'), 'func bridgeVersion() -> Int { 2 }\n');
  const nativeChanged = await create(); assert.notEqual(nativeChanged.hash, first.hash);
  await writeFile(path.join(root, 'store/ios/Podfile.lock'), 'PODS:\n  - EXUpdates (57.0.28)\n');
  const podChanged = await create(); assert.notEqual(podChanged.hash, nativeChanged.hash);
  await writeFile(path.join(app, 'widget-copy.generated.json'), '{"revision":"native-copy-v2"}\n');
  assert.notEqual((await create()).hash, podChanged.hash);
});

test('the real app loads the fingerprint config and hashes its actual frozen lock file', async () => {
  const config = await Config.loadConfigAsync(project, true);
  assert.equal(typeof config?.fileHookTransform, 'function');
  const lock = config.extraSources.find(source => source.overrideHashKey === 'cyber-bless:frozen-ios-pod-lock');
  assert.equal(lock.filePath, '../../store/ios/Podfile.lock');
  const bytes = await readFile(path.resolve(project, lock.filePath));
  const options = await Options.normalizeOptionsAsync(project, config);
  const result = await Hash.createFingerprintFromSourcesAsync([lock], project, options);
  assert.equal(result.sources[0].hash, digest(Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'))));
  const copy = config.extraSources.find(source => source.overrideHashKey === 'cyber-bless:native-widget-copy');
  assert.equal(copy.filePath, 'widget-copy.generated.json');
  const copyBytes = await readFile(path.resolve(project, copy.filePath));
  const copyResult = await Hash.createFingerprintFromSourcesAsync([copy], project, options);
  assert.equal(copyResult.sources[0].hash, digest(Buffer.from(copyBytes.toString('utf8').replaceAll('\r\n', '\n'))));
});
