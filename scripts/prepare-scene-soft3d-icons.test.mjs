import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { importIcons, prepareIcon, verifyIcons } from './prepare-scene-soft3d-icons.mjs';

test('fits the visible subject while keeping translucent glass on a centered 256 canvas', async () => {
  const glass = await sharp({ create: { width: 20, height: 40, channels: 4, background: '#83b0cc66' } }).png().toBuffer();
  const source = await sharp({ create: { width: 100, height: 100, channels: 4, background: '#00000000' } })
    .composite([{ input: glass, left: 13, top: 45 }]).png().toBuffer();
  const { buffer, record } = await prepareIcon(source);
  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 256);
  assert.equal(metadata.height, 256);
  assert.equal(metadata.hasAlpha, true);
  assert.deepEqual(record.sourceBounds, { left: 13, top: 45, width: 20, height: 40 });
  assert.ok(record.placement.height >= 223 && record.placement.height <= 225);
  assert.ok(Math.abs(record.placement.left * 2 + record.placement.width - 256) <= 1);
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0);
  assert.equal(data[(128 * info.width + 128) * 4 + 3], 102);
});

test('keeps an opaque cream background instead of removing matching object colors', async () => {
  const source = await sharp({ create: { width: 80, height: 60, channels: 3, background: '#f5eedc' } }).png().toBuffer();
  const { buffer, record } = await prepareIcon(source);
  assert.equal(record.sourceTransparency, 'opaque');
  assert.deepEqual(record.sourceBounds, { left: 0, top: 0, width: 80, height: 60 });
  const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data.subarray((128 * 256 + 128) * 4, (128 * 256 + 128) * 4 + 4)], [245, 238, 220, 255]);
});

test('faint remote pixels do not move or shrink the translucent visual subject', async () => {
  const glass = await sharp({ create: { width: 20, height: 40, channels: 4, background: '#83b0cc66' } }).png().toBuffer();
  const faintDot = await sharp({ create: { width: 2, height: 2, channels: 4, background: '#f0201008' } }).png().toBuffer();
  const source = await sharp({ create: { width: 100, height: 100, channels: 4, background: '#00000000' } })
    .composite([{ input: glass, left: 13, top: 45 }, { input: faintDot, left: 94, top: 4 }]).png().toBuffer();
  const { buffer, record } = await prepareIcon(source);
  assert.deepEqual(record.sourceBounds, { left: 13, top: 45, width: 20, height: 40 });
  assert.equal(record.visualAlphaThreshold, 32);
  assert.ok(record.placement.height >= 223 && record.placement.height <= 225);
  assert.ok(Math.abs(record.placement.left * 2 + record.placement.width - 256) <= 1);
  assert.ok(Math.abs(record.placement.top * 2 + record.placement.height - 256) <= 1);
  const { data } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[(128 * 256 + 128) * 4 + 3], 102);
  assert.equal(data[3], 0);
});

test('imports a batch, preserves source bytes, and reports missing catalog icons', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'scene-soft3d-icons-'));
  const sourceFile = path.join(outputDir, 'input.png');
  const source = await sharp({ create: { width: 8, height: 12, channels: 4, background: '#73a8c899' } }).png().toBuffer();
  await writeFile(sourceFile, source);
  await importIcons({ 'glass-bell': sourceFile }, { outputDir });
  assert.deepEqual(await readFile(path.join(outputDir, 'sources/glass-bell.png')), source);
  const report = await verifyIcons({ outputDir, subjects: [{ id: 'glass-bell' }, { id: 'missing-bell' }] });
  assert.equal(report.ok, false);
  assert.equal(report.items[0].ok, true);
  assert.match(report.items[1].errors.join(' '), /missing/i);
  assert.equal(report.present, 1);
});

test('CLI batch manifest resolves relative PNG paths and produces a verified report and contact sheet', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'scene-soft3d-cli-'));
  const script = fileURLToPath(new URL('./prepare-scene-soft3d-icons.mjs', import.meta.url));
  const source = await sharp({ create: { width: 12, height: 20, channels: 4, background: '#73a8c899' } }).png().toBuffer();
  await writeFile(path.join(directory, 'generated bell.png'), source);
  await writeFile(path.join(directory, 'imports.json'), JSON.stringify({ 'glass-bell': './generated bell.png' }));
  await writeFile(path.join(directory, 'subjects.json'), JSON.stringify({ version: 1, subjects: [{ id: 'glass-bell', visible: true }] }));
  const run = (...args) => execFileSync(process.execPath, [script, ...args, '--output', directory], { encoding: 'utf8' });
  run('import', path.join(directory, 'imports.json'));
  run('verify', '--report', path.join(directory, 'report.json'));
  const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'));
  assert.equal(report.ok, true);
  assert.equal(report.expected, 1);
  run('contact-sheet', '--report', path.join(directory, 'contact.png'));
  assert.equal((await sharp(path.join(directory, 'contact.png')).metadata()).width, 1680);
});

test('atlas import keeps row-major cell positions, alpha and original atlas bytes while skipping null cells', async () => {
  const { importAtlas } = await import('./prepare-scene-soft3d-icons.mjs');
  assert.equal(typeof importAtlas, 'function');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'scene-soft3d-atlas-'));
  const width = 120, height = 90, pixels = Buffer.alloc(width * height * 4);
  const ids = Array.from({ length: 9 }, (_, index) => index === 1 ? null : `cell-${index}`);
  for (let index = 0; index < 9; index++) {
    const left = (index % 3) * 40 + 11, top = Math.floor(index / 3) * 30 + 7;
    for (let y = top; y < top + 6; y++) for (let x = left; x < left + 4; x++)
      pixels.set([40 + index * 20, 160, 200, 128], (y * width + x) * 4);
  }
  const original = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const sourcePath = path.join(directory, 'generated atlas.png');
  await writeFile(sourcePath, original);
  const records = await importAtlas({ sourcePath, ids, columns: 3, rows: 3, name: 'batch-01' }, { outputDir: directory });
  assert.equal(records.length, 8);
  assert.deepEqual(await readFile(path.join(directory, 'atlases/batch-01.png')), original);
  for (const record of records) {
    const index = Number(record.id.slice(5));
    assert.equal(record.atlas.index, index);
    assert.deepEqual(record.atlas.bounds, { left: (index % 3) * 40, top: Math.floor(index / 3) * 30, width: 40, height: 30 });
    const tile = await sharp(await readFile(path.join(directory, `sources/${record.id}.png`))).ensureAlpha().raw().toBuffer();
    assert.equal(tile[3], 0);
    assert.deepEqual([...tile.subarray((7 * 40 + 11) * 4, (7 * 40 + 11) * 4 + 4)], [40 + index * 20, 160, 200, 128]);
    const exported = await sharp(await readFile(path.join(directory, `${record.id}.webp`))).ensureAlpha().raw().toBuffer();
    assert.equal(exported[3], 0);
    assert.equal(exported[(128 * 256 + 128) * 4 + 3], 128);
  }
  const script = fileURLToPath(new URL('./prepare-scene-soft3d-icons.mjs', import.meta.url));
  await writeFile(path.join(directory, 'atlas.json'), JSON.stringify({ sourcePath: './generated atlas.png', ids, columns: 3, rows: 3, name: 'batch-01' }));
  execFileSync(process.execPath, [script, 'import-atlas', path.join(directory, 'atlas.json'), '--output', directory], { encoding: 'utf8' });
  assert.equal((await verifyIcons({ outputDir: directory, subjects: ids.filter(Boolean) })).ok, true);
});

test('atlas manual rectangles preserve objects across nominal grid lines and reject out-of-bounds crops', async () => {
  const { importAtlas } = await import('./prepare-scene-soft3d-icons.mjs');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'scene-soft3d-rectangles-'));
  const object = await sharp({ create: { width: 8, height: 26, channels: 4, background: '#83b0cc66' } }).png().toBuffer();
  const source = await sharp({ create: { width: 90, height: 90, channels: 4, background: '#00000000' } })
    .composite([{ input: object, left: 10, top: 18 }]).png().toBuffer();
  const sourcePath = path.join(directory, 'atlas.png');
  await writeFile(sourcePath, source);
  const rectangle = { left: 4, top: 10, width: 24, height: 42 };
  const manifest = { sourcePath, ids: ['tall-object'], columns: 3, rows: 3, name: 'manual-crops', rectangles: [rectangle] };
  const [record] = await importAtlas(manifest, { outputDir: directory });
  assert.deepEqual(record.atlas.bounds, rectangle);
  assert.deepEqual(record.sourceBounds, { left: 6, top: 8, width: 8, height: 26 });
  assert.equal(record.sourceWidth, 24);
  assert.equal(record.sourceHeight, 42);
  for (const invalid of [
    { left: 80, top: 10, width: 20, height: 20 },
    { left: 10, top: 80, width: 20, height: 20 },
    { left: -1, top: 10, width: 20, height: 20 },
    { left: 1.5, top: 10, width: 20, height: 20 },
    { left: 10, top: 10, width: 0, height: 20 },
  ]) await assert.rejects(importAtlas({ ...manifest, rectangles: [invalid] }, { outputDir: directory }), /crop rectangle/i);
});

test('automatic gutters follow each column alpha gaps and keep explicit crop overrides', async () => {
  const { importAtlas } = await import('./prepare-scene-soft3d-icons.mjs');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'scene-soft3d-gutters-'));
  const width = 120, height = 300, pixels = Buffer.alloc(width * height * 4);
  const spans = [[[20, 60], [85, 160], [185, 260]], [[20, 60], [115, 160], [230, 280]], [[20, 60], [98, 175], [230, 280]]];
  for (let column = 0; column < 3; column++) for (const [top, bottom] of spans[column])
    for (let y = top; y < bottom; y++) for (let x = column * 40 + 10; x < column * 40 + 14; x++)
      pixels.set([80, 160, 200, 128], (y * width + x) * 4);
  const source = await sharp(pixels, { raw: { width, height, channels: 4 } }).png().toBuffer();
  const sourcePath = path.join(directory, 'atlas.png');
  await writeFile(sourcePath, source);
  const rectangles = [null, null, null, null, { left: 40, top: 105, width: 40, height: 85 }];
  const records = await importAtlas({ sourcePath, ids: Array.from({ length: 9 }, (_, index) => `cell-${index}`),
    columns: 3, rows: 3, name: 'auto-crops', autoGutters: true, rectangles }, { outputDir: directory });
  assert.deepEqual(records[3].atlas.autoGutters.boundaries.map(boundary => boundary.selected), [84, 184]);
  assert.deepEqual(records[1].atlas.autoGutters.boundaries.map(boundary => boundary.selected), [100, 200]);
  assert.deepEqual(records[2].atlas.autoGutters.boundaries.map(boundary => boundary.selected), [97, 200]);
  assert.deepEqual(records[3].sourceBounds, { left: 10, top: 5, width: 4, height: 75 });
  assert.deepEqual(records[6].sourceBounds, { left: 10, top: 5, width: 4, height: 75 });
  assert.equal(records[4].atlas.cropMode, 'manual');
  assert.deepEqual(records[4].atlas.bounds, rectangles[4]);
  const slice = await sharp(await readFile(path.join(directory, 'sources/cell-6.png'))).ensureAlpha().raw().toBuffer();
  assert.equal(slice[3], 0);
  assert.equal(slice[(5 * 40 + 10) * 4 + 3], 128);
  assert.deepEqual(await readFile(path.join(directory, 'atlases/auto-crops.png')), source);
});
