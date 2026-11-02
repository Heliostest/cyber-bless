import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { assetFiles, prepareAppAssets } from './prepare-app-assets.mjs';
import { bundledWoodfishModel } from './publish-scene-content.mjs';

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
