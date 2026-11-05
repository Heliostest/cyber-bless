import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assetFiles, prepareAppAssets } from './prepare-app-assets.mjs';
import { bundledWoodfishModel } from './publish-scene-content.mjs';
import { UI_SOUND_FILES, RESULT_SOUND_DURATIONS } from '../packages/app/src/ui-sound-assets.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
test('both offline hosts ship each selectable tree and its license without remote dependencies', async () => {
  const assets = await prepareAppAssets();
  const files = [
    ...['quaternius', 'simple-tree'].flatMap(source => ['round.glb', 'cluster.glb', 'LICENSE.txt'].map(name => `environments/trees/${source}/${name}`)),
    ...['cherry', 'cypress', 'willow', 'pine'].flatMap(species => ['round', 'cluster'].map(variant => `environments/trees/simple-tree/${species}-${variant}.glb`)),
  ];
  assert.ok(!assetFiles.some(file => file.startsWith('environments/trees/regional/')), 'archived external cherry is not shipped or selected');
  for (const file of files) {
    const bytes = await readFile(path.join(root, 'assets', file));
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.ok(assetFiles.includes(file));
    assert.deepEqual(assets.find(item => item.file === file), { file, bytes: bytes.length, sha256: hash });
    for (const host of ['apps/mobile-expo/public', 'apps/cyber-bless/public']) {
      assert.equal(createHash('sha256').update(await readFile(path.join(root, host, file))).digest('hex'), hash);
    }
    if (file.endsWith('.glb')) {
      assert.equal(bytes.toString('ascii', 0, 4), 'glTF');
      const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
      assert.ok(json.meshes.length > 0);
      for (const item of [...(json.buffers ?? []), ...(json.images ?? [])]) assert.ok(!item.uri || item.uri.startsWith('data:'), `${file}: embedded buffer/texture`);
    }
  }
});
test('EAS upload rules include every offline resource needed to regenerate the app', async () => {
  const require = createRequire(new URL('../apps/mobile-expo/package.json', import.meta.url));
  const { Ignore } = require('eas-cli/build/vcs/local');
  const ignore = await Ignore.createForCopyingAsync(root);
  for (const file of assetFiles) assert.equal(ignore.ignores(`assets/${file}`), false, file);
});
test('both hosts ship the current woodfish model with the descriptor hash and no old model copy', async () => {
  const assets = await prepareAppAssets();
  const generated = await readFile(path.join(root, 'packages/content/src/bundled.ts'), 'utf8');
  const descriptor = JSON.parse(generated.match(/parsePack\((\{[\s\S]*\})\);/)[1]);
  const source = await readFile(path.join(root, 'assets', bundledWoodfishModel));
  const hash = createHash('sha256').update(source).digest('hex');
  assert.equal(descriptor.model.path, bundledWoodfishModel);
  assert.equal(descriptor.model.bytes, source.length);
  assert.equal(descriptor.model.sha256, hash);
  assert.ok(!assets.some(asset => asset.file === 'woodfish/bundled-v1/woodfish.glb'));
  for (const host of ['apps/mobile-expo/public', 'apps/cyber-bless/public']) {
    const manifest = JSON.parse(await readFile(path.join(root, host, 'wbr-assets.json'), 'utf8'));
    assert.deepEqual(manifest.find(asset => asset.file === descriptor.model.path), {
      file: descriptor.model.path, bytes: source.length, sha256: hash,
    });
    const packaged = await readFile(path.join(root, host, descriptor.model.path));
    assert.equal(createHash('sha256').update(packaged).digest('hex'), hash);
  }
});
test('both offline hosts include the approved original UI and result WAVs with verified provenance', async () => {
  const assets = await prepareAppAssets();
  const sounds = JSON.parse(await readFile(path.join(root, 'assets/ui-sounds/soft-garden-v1/manifest.json'), 'utf8'));
  assert.equal(sounds.provenance, 'product-original');
  assert.equal(sounds.sounds.length, 10);
  assert.equal(sounds.processing.gainFromApprovedAudition, .45);
  assert.equal(sounds.generatorSha256, createHash('sha256').update(await readFile(path.join(root, sounds.generator))).digest('hex'));
  assert.equal(UI_SOUND_FILES.notice, UI_SOUND_FILES.select);
  const files = [...new Set(Object.values(UI_SOUND_FILES)), 'ui-sounds/soft-garden-v1/manifest.json'];
  assert.ok(files.every(file => assetFiles.includes(file)), 'every cue and provenance record must regenerate offline');
  assert.ok(!assetFiles.includes('ui-sounds/License.txt'), 'legacy third-party audio is no longer shipped');
  let wavBytes = 0;
  for (const file of files) {
    const source = await readFile(path.join(root, 'assets', file));
    const sha256 = createHash('sha256').update(source).digest('hex');
    assert.ok(assets.some(asset => asset.file === file && asset.sha256 === sha256 && asset.bytes === source.length));
    if (file.endsWith('.wav')) {
      wavBytes += source.length;
      const entry = sounds.sounds.find(sound => sound.file === file);
      assert.equal(entry.sha256, sha256, `${file} provenance hash`);
      assert.match(entry.auditionSha256, /^[a-f0-9]{64}$/);
      if (Object.hasOwn(RESULT_SOUND_DURATIONS, entry.sound)) assert.equal(entry.duration, RESULT_SOUND_DURATIONS[entry.sound]);
      assert.equal(source.toString('ascii', 0, 4), 'RIFF');
      assert.equal(source.toString('ascii', 8, 16), 'WAVEfmt ');
      assert.equal(source.readUInt16LE(20), 1, 'PCM encoding');
      assert.equal(source.readUInt16LE(22), 1, 'mono channel');
      assert.equal(source.readUInt32LE(24), 48000, '48kHz approved source');
      assert.equal(source.readUInt16LE(34), 16, '16-bit samples');
      assert.equal(source.readUInt32LE(40), source.length - 44, 'complete PCM payload');
      const duration = (source.length - 44) / 96000;
      assert.equal(duration, entry.duration);
      assert.ok(duration >= .16 && duration <= .93, `${file} approved cue duration`);
      let peak = 0, energy = 0;
      for (let offset = 44; offset < source.length; offset += 2) {
        const value = source.readInt16LE(offset) / 32768;
        peak = Math.max(peak, Math.abs(value)); energy += value * value;
      }
      assert.ok(peak >= .05 && peak <= .085, `${file} attenuated audition peak`);
      assert.ok(Math.sqrt(energy / ((source.length - 44) / 2)) < .03, `${file} modest RMS`);
      assert.equal(source.readInt16LE(44), 0, 'silent attack edge');
      assert.equal(source.readInt16LE(source.length - 2), 0, 'silent release edge');
    }
    for (const host of ['apps/mobile-expo/public', 'apps/cyber-bless/public']) {
      const packaged = await readFile(path.join(root, host, file));
      assert.equal(createHash('sha256').update(packaged).digest('hex'), sha256, `${host}/${file}`);
      const manifest = JSON.parse(await readFile(path.join(root, host, 'wbr-assets.json'), 'utf8'));
      assert.deepEqual(manifest.find(asset => asset.file === file), { file, bytes: source.length, sha256 });
    }
  }
  assert.equal(wavBytes, sounds.totalWavBytes);
  assert.ok(wavBytes < 400000, 'ten mono cues fit a 400KB offline budget');
});
