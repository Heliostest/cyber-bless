import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
export const assetDirectory = path.join(root, 'assets/materials/ritual-optics');
export const runtimeDataPath = path.join(root, 'packages/scene-runtime/src/ritual-fibers.data.json');
const size = 64;

// This script only reads the checked-in CC0 derivatives. No network or runtime
// image decoder is needed by the application. These are surface detail signals,
// not measured thickness, transmission, or a substitute for the base roughness.
export async function generateRitualFiberData() {
  const sources = JSON.parse(await readFile(path.join(assetDirectory, 'sources.json'), 'utf8'));
  const result = {};
  for (const key of ['paper', 'linen']) {
    const source = sources.assets[key];
    const bytes = await readFile(path.join(assetDirectory, source.storedFile));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), source.storedSha256,
      `${key}: source checksum changed; review provenance before regenerating`);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.channels, 1, `${key}: expected grayscale scalar data`);
    assert.ok(metadata.width <= 512 && metadata.height <= 512);
    const pixels = await sharp(bytes).extractChannel(0)
      .resize(size, size, { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer();
    assert.equal(pixels.length, size * size);
    const mean = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
    // A periodic 7x7 low-pass lets us retain source-derived fine detail while
    // reducing broad illumination-like gradients. Wrap at edges for tiling.
    const detail = Array.from(pixels, (value, index) => {
      const x = index % size;
      const y = Math.floor(index / size);
      let localMean = 0;
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          localMean += pixels[((y + dy + size) % size) * size + (x + dx + size) % size];
        }
      }
      localMean /= 49;
      return value - localMean + 0.25 * (localMean - mean);
    });
    const detailMean = detail.reduce((sum, value) => sum + value, 0) / detail.length;
    const deviation = Math.sqrt(detail.reduce((sum, value) => sum + (value - detailMean) ** 2, 0) / detail.length);
    assert.ok(deviation > 0, `${key}: source has no surface detail`);
    const data = detail.map(value => Math.round(128 + Math.max(-32, Math.min(32, (value - detailMean) * 10 / deviation))));
    result[key] = { width: size, height: size, data };
  }
  return result;
}

export function serializeRitualFiberData(data) {
  // One row per line keeps reviewable diffs without inflating the bundle.
  return '{\n' + Object.entries(data).map(([key, { width, height, data: pixels }]) => {
    const rows = Array.from({ length: height }, (_, row) => '      ' + pixels.slice(row * width, (row + 1) * width).join(','));
    return `  "${key}": {"width":${width},"height":${height},"data":[\n${rows.join(',\n')}\n    ]}`;
  }).join(',\n') + '\n}\n';
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const generated = serializeRitualFiberData(await generateRitualFiberData());
  if (process.argv.includes('--check')) {
    assert.equal(await readFile(runtimeDataPath, 'utf8'), generated,
      'Runtime fiber data is stale. Run node scripts/prepare-ritual-optics-assets.mjs');
    console.log('CC0 source checksums and runtime fiber data match.');
  } else {
    await writeFile(runtimeDataPath, generated);
    console.log('Generated paper + linen offline scalar fiber data (64x64 each).');
  }
}
