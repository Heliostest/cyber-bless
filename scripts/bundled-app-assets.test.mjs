import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assetFiles, prepareAppAssets } from './prepare-app-assets.mjs';
import { bundledWoodfishModel } from './publish-scene-content.mjs';
import { UI_SOUND_FILES } from '../packages/app/src/ui-sound-assets.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
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
test('both offline hosts include quiet mono UI WAVs and the original license with verified hashes', async () => {
  const assets = await prepareAppAssets();
  const sounds = JSON.parse(await readFile(path.join(root, 'assets/ui-sounds/manifest.json'), 'utf8'));
  assert.equal(sounds.license, 'CC0-1.0');
  assert.equal(sounds.sounds.length, 8);
  const files = [...Object.values(UI_SOUND_FILES), 'ui-sounds/License.txt'];
  assert.ok(files.every(file => assetFiles.includes(file)), 'every cue and license must regenerate offline');
  let wavBytes = 0;
  for (const file of files) {
    const source = await readFile(path.join(root, 'assets', file));
    const sha256 = createHash('sha256').update(source).digest('hex');
    assert.ok(assets.some(asset => asset.file === file && asset.sha256 === sha256 && asset.bytes === source.length));
    if (file.endsWith('License.txt')) assert.deepEqual(sounds.licenseFile, { file, bytes: source.length, sha256 });
    if (file.endsWith('.wav')) {
      wavBytes += source.length;
      const entry = sounds.sounds.find(sound => sound.file === file);
      assert.equal(entry.sha256, sha256, `${file} provenance hash`);
      assert.match(entry.original.sha256, /^[a-f0-9]{64}$/);
      assert.equal(source.toString('ascii', 0, 4), 'RIFF');
      assert.equal(source.toString('ascii', 8, 16), 'WAVEfmt ');
      assert.equal(source.readUInt16LE(20), 1, 'PCM encoding');
      assert.equal(source.readUInt16LE(22), 1, 'mono channel');
      assert.equal(source.readUInt32LE(24), 24000, '24kHz source');
      assert.equal(source.readUInt16LE(34), 16, '16-bit samples');
      assert.equal(source.readUInt32LE(40), source.length - 44, 'complete PCM payload');
      const duration = (source.length - 44) / 48000;
      assert.ok(duration > .035 && duration <= .35, `${file} short UI duration`);
      let peak = 0, energy = 0;
      for (let offset = 44; offset < source.length; offset += 2) {
        const value = source.readInt16LE(offset) / 32768;
        peak = Math.max(peak, Math.abs(value)); energy += value * value;
      }
      assert.ok(peak >= .025 && peak <= .04, `${file} normalized quiet peak`);
      assert.ok(Math.sqrt(energy / ((source.length - 44) / 2)) < .025, `${file} modest RMS`);
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
  assert.ok(wavBytes < 80000, 'short mono cues fit an 80KB offline budget');
});
