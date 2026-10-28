import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {
  assetDirectory,
  generateRitualFiberData,
  runtimeDataPath,
  serializeRitualFiberData,
} from '../../../scripts/prepare-ritual-optics-assets.mjs';

test('retained CC0 maps are actual pinned grayscale derivatives, at most 512px', async () => {
  const sources = JSON.parse(await readFile(path.join(assetDirectory, 'sources.json'), 'utf8'));
  assert.equal(sources.license, 'CC0-1.0');
  for (const source of Object.values(sources.assets)) {
    const bytes = await readFile(path.join(assetDirectory, source.storedFile));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.storedSha256);
    assert.equal(bytes.length, source.storedBytes);
    const image = await sharp(bytes).metadata();
    assert.equal(image.format, 'png');
    assert.equal(image.channels, 1);
    assert.equal(image.hasAlpha, false);
    assert.equal(image.hasProfile, false);
    assert.ok(image.width <= 512 && image.height <= 512);
    assert.deepEqual([image.width, image.height], source.storedDimensions);
  }
  const license = await readFile(path.join(assetDirectory, 'CC0-1.0.txt'), 'utf8');
  assert.match(license, /CC0 1\.0 Universal/);
  assert.match(license, /Public License Fallback/);
  assert.match(license, /Limitations and Disclaimers/);
});

test('runtime bytes reproduce exactly from saved sources and remain gentle scalar detail', async () => {
  const generated = await generateRitualFiberData();
  assert.equal(await readFile(runtimeDataPath, 'utf8'), serializeRitualFiberData(generated));
  assert.deepEqual(Object.keys(generated), ['paper', 'linen']);
  for (const texture of Object.values(generated)) {
    assert.deepEqual(Object.keys(texture), ['width', 'height', 'data']);
    assert.equal(texture.width, 64);
    assert.equal(texture.height, 64);
    assert.equal(texture.data.length, 4096);
    assert.ok(texture.data.every(value => Number.isInteger(value) && value >= 96 && value <= 160));
    const mean = texture.data.reduce((sum, value) => sum + value, 0) / 4096;
    assert.ok(Math.abs(mean - 128) < 1);
    assert.ok(new Set(texture.data).size > 20, 'surface variation must not be constant');
  }
  assert.notDeepEqual(generated.paper.data, generated.linen.data);
});
