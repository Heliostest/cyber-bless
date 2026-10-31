import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('../', import.meta.url));
const defaultOutput = path.join(root, 'assets/scene-icons/soft3d');
const defaultSubjects = path.join(defaultOutput, 'subjects.json');
const defaultReport = path.join(root, '.tmp/scene-soft3d-icons/report.json');
const size = 256;
const contentSize = Math.round(size * 0.88);
const visualAlphaThreshold = 32;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const safeId = id => {
  if (typeof id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw Error(`Unsafe scene ID: ${id}`);
  return id;
};
async function optionalFile(file) {
  try { return await readFile(file); } catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
}
async function save(file, bytes) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
}
function alphaBounds(data, width, height, channels = 4, threshold = 0) {
  let left = width, top = height, right = -1, bottom = -1, min = 255, max = 0, translucent = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + channels - 1];
      min = Math.min(min, alpha);
      max = Math.max(max, alpha);
      if (alpha > 0 && alpha < 255) translucent++;
      if (alpha <= threshold) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  return { min, max, translucent, bounds: right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 } };
}

// Alpha>32 decides visual scale and center. The complete continuous-alpha
// image is resized, and only pixels outside the final canvas are clipped.
// Never infer transparency from RGB colors or binarize translucent materials.
export async function prepareIcon(source) {
  const metadata = await sharp(source).metadata();
  if (metadata.format !== 'png' || (metadata.pages ?? 1) !== 1) throw Error('Expected a single-frame generated PNG source');
  const { data, info } = await sharp(source).rotate().toColourspace('srgb').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = alphaBounds(data, info.width, info.height, info.channels);
  if (!alpha.bounds) throw Error('Source image is entirely transparent');
  const visual = alphaBounds(data, info.width, info.height, info.channels, visualAlphaThreshold);
  const sourceBounds = visual.bounds ?? alpha.bounds;
  const threshold = visual.bounds ? visualAlphaThreshold : 0;
  let factor = contentSize / Math.max(sourceBounds.width, sourceBounds.height), resized, resizedBounds;
  // Resampling can move the threshold edge by one pixel. Fit the measured
  // resized silhouette before centering, while sampling the original each time.
  for (let attempt = 0; attempt < 5; attempt++) {
    resized = await sharp(data, { raw: info }).resize(
      Math.max(1, Math.round(info.width * factor)), Math.max(1, Math.round(info.height * factor)),
      { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
    resizedBounds = alphaBounds(resized.data, resized.info.width, resized.info.height, resized.info.channels, threshold).bounds;
    if (!resizedBounds) throw Error('Visual subject disappeared during resizing');
    const longest = Math.max(resizedBounds.width, resizedBounds.height);
    if (longest >= contentSize - 2 && longest <= contentSize) break;
    factor *= (contentSize - 0.5) / longest;
  }
  if (Math.max(resizedBounds.width, resizedBounds.height) > contentSize) throw Error('Visual subject could not fit the 225px box');
  const placement = {
    left: Math.floor((size - resizedBounds.width) / 2), top: Math.floor((size - resizedBounds.height) / 2),
    width: resizedBounds.width, height: resizedBounds.height,
  };
  const imageLeft = placement.left - resizedBounds.left, imageTop = placement.top - resizedBounds.top;
  const canvasCrop = {
    left: Math.max(0, -imageLeft), top: Math.max(0, -imageTop),
    width: Math.min(resized.info.width - Math.max(0, -imageLeft), size - Math.max(0, imageLeft)),
    height: Math.min(resized.info.height - Math.max(0, -imageTop), size - Math.max(0, imageTop)),
  };
  const clipped = await sharp(resized.data, { raw: resized.info }).extract(canvasCrop).png().toBuffer();
  const buffer = await sharp({ create: { width: size, height: size, channels: 4, background: '#00000000' } })
    .composite([{ input: clipped, left: Math.max(0, imageLeft), top: Math.max(0, imageTop) }])
    .webp({ lossless: true, effort: 6, alphaQuality: 100 }).toBuffer();
  return { buffer, record: {
    sourceSha256: hash(source), outputSha256: hash(buffer),
    sourceWidth: info.width, sourceHeight: info.height, sourceBounds, sourceAlphaBounds: alpha.bounds,
    visualAlphaThreshold, visualBoundsFallback: !visual.bounds,
    sourceTransparency: alpha.min === 255 ? 'opaque' : 'transparent',
    sourceTranslucentPixels: alpha.translucent, placement,
    sourceTransform: { width: resized.info.width, height: resized.info.height, left: imageLeft, top: imageTop, canvasCrop },
    width: size, height: size, bytes: buffer.length, encoding: 'lossless-webp',
  } };
}

async function preservePng(directory, name, bytes) {
  const destination = path.join(directory, `${name}.png`);
  const previous = await optionalFile(destination);
  if (previous && hash(previous) !== hash(bytes))
    await save(path.join(directory, 'archive', `${name}-${hash(previous)}.png`), previous);
  await save(destination, bytes);
}

async function storeIcon(id, source, outputDir, details = {}) {
  safeId(id);
  const { buffer, record } = await prepareIcon(source);
  // Keep fixed source paths and retain earlier PNG revisions byte for byte.
  await preservePng(path.join(outputDir, 'sources'), id, source);
  await save(path.join(outputDir, `${id}.webp`), buffer);
  const item = { id, ...record, ...details, sourceFile: `sources/${id}.png`, outputFile: `${id}.webp` };
  await save(path.join(outputDir, 'sources', `${id}.json`), JSON.stringify(item, null, 2) + '\n');
  console.log(`${id}: ${size}x${size}, ${buffer.length} bytes${record.sourceTransparency === 'opaque' ? ' (opaque background retained; no color key)' : ''}`);
  return item;
}

export async function importIcons(mapping, { outputDir = defaultOutput } = {}) {
  if (!mapping || Array.isArray(mapping) || typeof mapping !== 'object' || !Object.keys(mapping).length)
    throw Error('Import manifest must be a nonempty object mapping scene IDs to PNG paths');
  const results = [];
  for (const [id, sourceFile] of Object.entries(mapping)) {
    safeId(id);
    if (typeof sourceFile !== 'string' || !sourceFile) throw Error(`${id}: expected a PNG path`);
    results.push(await storeIcon(id, await readFile(sourceFile), outputDir));
  }
  return results;
}

export async function rebuildIcons({ outputDir = defaultOutput, subjects } = {}) {
  subjects ??= await loadSubjects(path.join(outputDir, 'subjects.json'));
  const results = [];
  for (const subject of subjects) {
    const id = safeId(typeof subject === 'string' ? subject : subject.id);
    const source = await readFile(path.join(outputDir, 'sources', `${id}.png`));
    const previous = JSON.parse(await readFile(path.join(outputDir, 'sources', `${id}.json`), 'utf8'));
    results.push(await storeIcon(id, source, outputDir, previous.atlas ? { atlas: previous.atlas } : {}));
  }
  return results;
}

async function suggestAtlasGutters(png, columns, rows) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alphaThreshold = 32, transparentPadding = 4;
  const searchRadius = Math.round(info.height / rows * 0.2);
  return Array.from({ length: columns }, (_, column) => {
    const left = Math.floor(column * info.width / columns), right = Math.floor((column + 1) * info.width / columns);
    const counts = new Uint32Array(info.height);
    for (let y = 0; y < info.height; y++) for (let x = left; x < right; x++)
      if (data[(y * info.width + x) * info.channels + info.channels - 1] > alphaThreshold) counts[y]++;
    const boundaries = Array.from({ length: rows - 1 }, (_, index) => {
      const nominal = Math.floor((index + 1) * info.height / rows);
      let selected = nominal;
      for (let y = Math.max(1, nominal - searchRadius); y <= Math.min(info.height - 1, nominal + searchRadius); y++)
        if (counts[y] < counts[selected] || (counts[y] === counts[selected] && Math.abs(y - nominal) < Math.abs(selected - nominal))) selected = y;
      let clearAbove = 0, clearBelow = 0;
      // Expand crops only within empty/very faint rows. This keeps up to four
      // pixels of gutter padding on each side without modifying any alpha.
      while (clearAbove < transparentPadding && selected - clearAbove > 0 && counts[selected - clearAbove - 1] === 0) clearAbove++;
      while (clearBelow < transparentPadding && selected + clearBelow < info.height && counts[selected + clearBelow] === 0) clearBelow++;
      return { nominal, selected, occupiedPixels: counts[selected], clearAbove, clearBelow };
    });
    return {
      record: { alphaThreshold, searchRadius, transparentPadding, boundaries },
      rectangles: Array.from({ length: rows }, (_, row) => {
        const top = row === 0 ? 0 : boundaries[row - 1].selected - boundaries[row - 1].clearAbove;
        const bottom = row === rows - 1 ? info.height : boundaries[row].selected + boundaries[row].clearBelow;
        return { left, top, width: right - left, height: bottom - top };
      }),
    };
  });
}

export async function importAtlas(manifest, { outputDir = defaultOutput } = {}) {
  const { sourcePath, ids, columns = 3, rows = 3, name, rectangles, autoGutters = false } = manifest ?? {};
  safeId(name);
  if (typeof sourcePath !== 'string' || !sourcePath) throw Error('Atlas sourcePath must be a PNG path');
  if (!Number.isSafeInteger(columns) || !Number.isSafeInteger(rows) || columns < 1 || rows < 1)
    throw Error('Atlas columns and rows must be positive integers');
  if (!Array.isArray(ids) || !ids.length || ids.length > columns * rows)
    throw Error('Atlas ids must fit the declared grid, in row-major order');
  if (rectangles != null && (!Array.isArray(rectangles) || rectangles.length > columns * rows))
    throw Error('Atlas crop rectangles must be an array aligned with ids');
  if (typeof autoGutters !== 'boolean') throw Error('Atlas autoGutters must be a boolean');
  const nonempty = ids.filter(id => id !== null).map(safeId);
  if (!nonempty.length || new Set(nonempty).size !== nonempty.length) throw Error('Atlas requires unique non-null scene IDs');
  const original = await readFile(sourcePath);
  const metadata = await sharp(original).metadata();
  if (metadata.format !== 'png' || (metadata.pages ?? 1) !== 1) throw Error('Expected a single-frame generated PNG atlas');
  const { data, info } = await sharp(original).rotate().png().toBuffer({ resolveWithObject: true });
  if (info.width < columns || info.height < rows) throw Error('Atlas dimensions are smaller than its grid');
  // Validate every explicit rectangle before writing any files. Null/missing
  // entries use their regular grid cell, so overrides can be added selectively.
  for (const rectangle of rectangles ?? []) {
    if (rectangle == null) continue;
    const { left, top, width, height } = rectangle;
    if (![left, top, width, height].every(Number.isSafeInteger) || left < 0 || top < 0 || width < 1 || height < 1 ||
        left + width > info.width || top + height > info.height)
      throw Error(`Atlas crop rectangle must have integer positive dimensions inside ${info.width}x${info.height}: ${JSON.stringify(rectangle)}`);
  }
  const gutters = autoGutters && ids.some((id, index) => id !== null && rectangles?.[index] == null)
    ? await suggestAtlasGutters(data, columns, rows) : null;
  if (gutters) for (let column = 0; column < gutters.length; column++)
    console.log(`${name}: column ${column + 1} gutters ${gutters[column].record.boundaries.map(boundary => `${boundary.selected} (${boundary.occupiedPixels} pixels with alpha>32)`).join(', ')}`);
  await preservePng(path.join(outputDir, 'atlases'), name, original);
  const results = [];
  for (let index = 0; index < ids.length; index++) {
    const id = ids[index];
    if (id === null) continue;
    const column = index % columns, row = Math.floor(index / columns);
    const left = Math.floor(column * info.width / columns), top = Math.floor(row * info.height / rows);
    // Integer boundaries cover every pixel even for a 1024px source / 3 cells.
    const gridBounds = { left, top,
      width: Math.floor((column + 1) * info.width / columns) - left,
      height: Math.floor((row + 1) * info.height / rows) - top };
    const override = rectangles?.[index];
    const bounds = override == null ? (gutters?.[column].rectangles[row] ?? gridBounds) : {
      left: override.left, top: override.top, width: override.width, height: override.height,
    };
    const source = await sharp(data).extract(bounds).png().toBuffer();
    results.push(await storeIcon(id, source, outputDir, { atlas: {
      file: `atlases/${name}.png`, sha256: hash(original), width: info.width, height: info.height,
      columns, rows, index, column, row, bounds,
      cropMode: override != null ? 'manual' : gutters ? 'auto-gutters' : 'grid',
      ...(override == null && gutters ? { autoGutters: gutters[column].record } : {}),
    } }));
  }
  return results;
}

async function loadSubjects(file = defaultSubjects) {
  const parsed = JSON.parse(await readFile(file, 'utf8'));
  const subjects = Array.isArray(parsed) ? parsed : parsed.subjects;
  if (!Array.isArray(subjects) || !subjects.length) throw Error(`${file}: expected a nonempty subjects array`);
  const ids = subjects.map(subject => safeId(typeof subject === 'string' ? subject : subject.id));
  if (new Set(ids).size !== ids.length) throw Error(`${file}: duplicate scene IDs`);
  return ids.map((id, index) => ({ ...(typeof subjects[index] === 'object' ? subjects[index] : {}), id }));
}

export async function verifyIcons({ outputDir = defaultOutput, subjects, maxBytes = 256 * 1024 } = {}) {
  subjects ??= await loadSubjects(path.join(outputDir, 'subjects.json'));
  const items = [];
  for (const subject of subjects) {
    const id = safeId(typeof subject === 'string' ? subject : subject.id);
    const item = { id, file: `${id}.webp`, ok: false, errors: [], warnings: [] };
    const bytes = await optionalFile(path.join(outputDir, item.file));
    if (!bytes) { item.errors.push('Missing WebP icon'); items.push(item); continue; }
    item.bytes = bytes.length;
    item.sha256 = hash(bytes);
    try {
      const metadata = await sharp(bytes).metadata();
      Object.assign(item, { format: metadata.format, width: metadata.width, height: metadata.height, hasAlpha: metadata.hasAlpha });
      if (metadata.format !== 'webp') item.errors.push('Expected WebP');
      if (metadata.width !== size || metadata.height !== size) item.errors.push(`Expected ${size}x${size}`);
      if (!metadata.hasAlpha) item.errors.push('Missing alpha channel');
      if (bytes.length > maxBytes) item.errors.push(`Exceeds ${maxBytes} byte budget`);
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let alpha = alphaBounds(data, info.width, info.height, info.channels, visualAlphaThreshold);
      if (!alpha.bounds && alpha.max > 0) {
        alpha = alphaBounds(data, info.width, info.height, info.channels);
        item.warnings.push('No pixels exceed the visual alpha threshold; using all nonzero alpha');
      }
      Object.assign(item, { bounds: alpha.bounds, visualAlphaThreshold, alphaMin: alpha.min, alphaMax: alpha.max, translucentPixels: alpha.translucent });
      if (!alpha.bounds) item.errors.push('Entirely transparent icon');
      else {
        if (alpha.min !== 0) item.errors.push('Canvas has no transparent padding');
        const longest = Math.max(alpha.bounds.width, alpha.bounds.height);
        item.occupancy = Number((longest / size).toFixed(4));
        if (longest > contentSize) item.errors.push(`Content exceeds the ${contentSize}px fit box`);
        if (longest < contentSize - 4) item.warnings.push('Visible pixels occupy less than the standard 88% fit box');
        if (Math.abs(alpha.bounds.left * 2 + alpha.bounds.width - size) > 2 || Math.abs(alpha.bounds.top * 2 + alpha.bounds.height - size) > 2)
          item.warnings.push('Visible alpha bounds are not centered; review faint edge pixels');
      }
      const source = await optionalFile(path.join(outputDir, 'sources', `${id}.png`));
      const recordBytes = await optionalFile(path.join(outputDir, 'sources', `${id}.json`));
      if (!source) item.errors.push('Missing preserved source PNG');
      if (!recordBytes) item.errors.push('Missing source processing record');
      if (recordBytes) {
        const record = JSON.parse(recordBytes.toString('utf8'));
        if (source && hash(source) !== record.sourceSha256) item.errors.push('Preserved source checksum differs from processing record');
        if (item.sha256 !== record.outputSha256) item.errors.push('Output checksum differs from processing record');
        if (record.sourceTransparency === 'opaque') item.warnings.push('Opaque source background retained; inspect the cream rectangle in context');
        if (record.atlas) {
          if (!/^atlases\/[a-z0-9]+(?:-[a-z0-9]+)*\.png$/.test(record.atlas.file)) throw Error('Invalid preserved atlas path');
          const atlas = await optionalFile(path.join(outputDir, record.atlas.file));
          if (!atlas) item.errors.push('Missing preserved atlas PNG');
          else if (hash(atlas) !== record.atlas.sha256) item.errors.push('Preserved atlas checksum differs from processing record');
        }
      }
    } catch (error) { item.errors.push(error.message); }
    item.ok = item.errors.length === 0;
    items.push(item);
  }
  const expected = new Set(items.map(item => item.file));
  const files = await readdir(outputDir).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  return {
    ok: items.every(item => item.ok), expected: items.length, present: items.filter(item => item.bytes != null).length,
    totalBytes: items.reduce((total, item) => total + (item.bytes ?? 0), 0), maxBytes,
    extraWebps: files.filter(file => file.endsWith('.webp') && !expected.has(file)), items,
  };
}

export async function createContactSheet({ outputDir = defaultOutput, subjects, destination = path.join(root, '.tmp/scene-soft3d-icons/contact-sheet.png') } = {}) {
  subjects ??= await loadSubjects(path.join(outputDir, 'subjects.json'));
  const columns = 6, cellWidth = 280, cellHeight = 296, composites = [];
  let count = 0;
  for (const subject of subjects) {
    const id = safeId(typeof subject === 'string' ? subject : subject.id);
    const bytes = await optionalFile(path.join(outputDir, `${id}.webp`));
    if (!bytes) continue;
    const metadata = await sharp(bytes).metadata();
    if (metadata.width !== size || metadata.height !== size) throw Error(`${id}: contact sheet expects prepared ${size}px icons`);
    const left = (count % columns) * cellWidth, top = Math.floor(count / columns) * cellHeight;
    // The prepared pixels are composited at 1:1. The cream background and ID
    // labels belong to this inspection sheet only, never to exported icons.
    composites.push({ input: bytes, left: left + 12, top: top + 8 });
    composites.push({ input: Buffer.from(`<svg width="280" height="28"><text x="140" y="18" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#473d31">${id}</text></svg>`), left, top: top + 266 });
    count++;
  }
  if (!count) throw Error('No prepared icons available for a contact sheet');
  const buffer = await sharp({ create: { width: columns * cellWidth, height: Math.ceil(count / columns) * cellHeight, channels: 3, background: '#f5eedc' } })
    .composite(composites).png().toBuffer();
  await save(destination, buffer);
  return { file: destination, count };
}

async function main(args) {
  const options = {};
  const positional = [];
  for (let index = 0; index < args.length; index++) {
    if (!args[index].startsWith('--')) { positional.push(args[index]); continue; }
    const key = args[index].slice(2);
    if (!['output', 'subjects', 'report', 'max-bytes'].includes(key) || !args[index + 1]) throw Error(`Unknown or incomplete option: ${args[index]}`);
    options[key] = args[++index];
  }
  const [command, ...rest] = positional;
  const outputDir = options.output ? path.resolve(options.output) : defaultOutput;
  if (command === 'import') {
    let mapping;
    if (rest.length === 2) mapping = { [safeId(rest[0])]: path.resolve(rest[1]) };
    else if (rest.length === 1) {
      const manifestFile = path.resolve(rest[0]);
      mapping = JSON.parse(await readFile(manifestFile, 'utf8'));
      if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) throw Error('Expected { "scene-id": "path/to/generated.png" }');
      mapping = Object.fromEntries(Object.entries(mapping).map(([id, file]) => {
        if (typeof file !== 'string') throw Error(`${id}: expected a PNG path`);
        return [id, path.resolve(path.dirname(manifestFile), file)];
      }));
    } else throw Error('Use import <scene-id> <source.png> OR import <manifest.json>');
    await importIcons(mapping, { outputDir });
  } else if (command === 'import-atlas') {
    if (rest.length !== 1) throw Error('Use import-atlas <manifest.json>');
    const manifestFile = path.resolve(rest[0]);
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    if (typeof manifest?.sourcePath !== 'string') throw Error('Atlas manifest requires sourcePath');
    await importAtlas({ ...manifest, sourcePath: path.resolve(path.dirname(manifestFile), manifest.sourcePath) }, { outputDir });
  } else if (command === 'rebuild') {
    if (rest.length) throw Error('rebuild does not accept positional arguments');
    const subjects = await loadSubjects(options.subjects ? path.resolve(options.subjects) : path.join(outputDir, 'subjects.json'));
    await rebuildIcons({ outputDir, subjects });
  } else if (command === 'verify' || command === 'contact-sheet') {
    if (rest.length) throw Error(`${command} does not accept positional arguments`);
    const subjects = await loadSubjects(options.subjects ? path.resolve(options.subjects) : path.join(outputDir, 'subjects.json'));
    if (command === 'contact-sheet') {
      const result = await createContactSheet({ outputDir, subjects, ...(options.report ? { destination: path.resolve(options.report) } : {}) });
      console.log(`Inspection sheet: ${result.count} icons, ${result.file}`);
    } else {
      const maxBytes = options['max-bytes'] ? Number(options['max-bytes']) : 256 * 1024;
      if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw Error('--max-bytes must be a positive integer');
      const report = await verifyIcons({ outputDir, subjects, maxBytes });
      const reportFile = options.report ? path.resolve(options.report) : defaultReport;
      await save(reportFile, JSON.stringify(report, null, 2) + '\n');
      for (const item of report.items) if (!item.ok || item.warnings.length) console.log(`${item.id}: ${[...item.errors, ...item.warnings].join('; ')}`);
      console.log(`${report.present}/${report.expected} icons, ${report.totalBytes} bytes, ${report.items.filter(item => !item.ok).length} failures. Report: ${reportFile}`);
      if (!report.ok) process.exitCode = 1;
    }
  } else {
    console.log(`Prepare generated scene icons without color-keying or background removal.
  node scripts/prepare-scene-soft3d-icons.mjs import <scene-id> <source.png>
  node scripts/prepare-scene-soft3d-icons.mjs import <manifest.json>
  node scripts/prepare-scene-soft3d-icons.mjs import-atlas <manifest.json>
  node scripts/prepare-scene-soft3d-icons.mjs rebuild [--subjects path]
  node scripts/prepare-scene-soft3d-icons.mjs verify [--subjects path] [--report path] [--max-bytes 262144]
  node scripts/prepare-scene-soft3d-icons.mjs contact-sheet [--subjects path] [--report sheet.png]
  All commands accept --output <directory>. Manifest paths resolve relative to the JSON file.
  Sources are retained byte for byte in sources/<id>.png; older revisions in sources/archive/.
  Atlases are retained byte for byte in atlases/<name>.png; ids use row-major order, with null for empty cells.
  Optional atlas rectangles[i] = {left,top,width,height} overrides the corresponding grid crop; null uses the grid.
  Atlas autoGutters:true finds sparse alpha rows per column within +/-20% of each cell height; explicit crops take priority.
  Only <id>.webp belongs in the app bundle. Source PNGs and inspection reports are authoring files.`);
    if (command && command !== 'help') process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
