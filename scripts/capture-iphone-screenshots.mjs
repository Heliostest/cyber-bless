// Import audited native screenshots; this entry point never captures or renders UI.
// WBR_SCREENSHOT_NATIVE_DIR contains capture-source.json and medium/large folders,
// each with 01-today.png ... 05-world.png from the actual native Release app.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile, realpath, stat, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const VIEWS = ['01-today', '02-wishes', '03-windchime', '04-crane', '05-world'];
const TARGETS = {
  APP_IPHONE_61: { width: 1206, height: 2622, directory: '.', nativeDirectory: 'medium' },
  APP_IPHONE_67: { width: 1320, height: 2868, directory: 'iphone-67', nativeDirectory: 'large' },
};
const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const fail = message => { throw Error(message); };
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function resolveWithin(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || path.win32.isAbsolute(relative)) fail('Path must be relative to its permitted directory');
  const target = path.resolve(root, relative);
  const remainder = path.relative(root, target);
  if (remainder === '..' || remainder.startsWith(`..${path.sep}`) || path.isAbsolute(remainder)) fail('Path points outside its permitted directory');
  return target;
}

async function checkedRealPath(root, relative) {
  const resolved = await realpath(resolveWithin(root, relative));
  resolveWithin(root, path.relative(root, resolved));
  return resolved;
}

export async function ensureDirectoryWithin(root, relative) {
  const target = resolveWithin(root, relative);
  let current = await realpath(root);
  resolveWithin(root, path.relative(root, current));
  for (const segment of path.relative(root, target).split(path.sep).filter(Boolean)) {
    const candidate = path.join(current, segment);
    let resolved;
    try { resolved = await realpath(candidate); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      // The parent has already been canonicalized and checked. Never create a
      // deeper path through an unchecked existing symlink or junction.
      try { await mkdir(candidate); } catch (creationError) { if (creationError.code !== 'EEXIST') throw creationError; }
      resolved = await realpath(candidate);
    }
    resolveWithin(root, path.relative(root, resolved));
    if (!(await stat(resolved)).isDirectory()) fail('Output path component is not a directory');
    current = resolved;
  }
  return current;
}

export function validateCaptureSource(source, expected) {
  if (!isRecord(source)) fail('capture-source.json must be an object');
  if (typeof source.captureId !== 'string' || !/^\d{8}$/.test(source.captureId)) fail('captureId must be eight date digits');
  if (typeof source.capturedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(source.capturedAt) || !Number.isFinite(Date.parse(source.capturedAt))) fail('capturedAt must be a valid ISO timestamp');
  if (source.appId !== expected.appId || source.bundleIdentifier !== expected.bundleIdentifier || source.version !== expected.version) fail('Native capture identity/version does not match this project');
  if (typeof source.buildNumber !== 'string' || !/^[1-9]\d*$/.test(source.buildNumber) || (expected.buildNumber && source.buildNumber !== expected.buildNumber)) fail('Invalid or mismatched native buildNumber');
  if (typeof source.sourceCommit !== 'string' || !/^[a-f0-9]{40}$/i.test(source.sourceCommit)) fail('sourceCommit must be a full 40-character commit hash');
  if (typeof source.source !== 'string' || !/iOS/i.test(source.source) || !/Simulator/i.test(source.source) || !/Release/i.test(source.source) || !/Xcode/i.test(source.source)) fail('Source must identify the iOS Simulator, Release build and Xcode version');
  if (!isRecord(source.devices) || ['medium', 'large'].some(key => !isRecord(source.devices[key]) || !Object.keys(source.devices[key]).length)) fail('Native source requires medium and large device records');
}

export async function normalizeNativePng(original, dimensions) {
  const metadata = await sharp(original).metadata();
  if (metadata.format !== 'png' || metadata.width !== dimensions.width || metadata.height !== dimensions.height || (metadata.pages ?? 1) !== 1) fail('Native screenshot PNG dimensions/format mismatch; resizing is forbidden');
  let buffer = original;
  if (metadata.hasAlpha) {
    // Never flatten transparency. Only an entirely opaque alpha channel may go.
    const stats = await sharp(original).stats();
    const alpha = stats.channels[metadata.channels - 1];
    const opaque = metadata.depth === 'ushort' ? 65535 : 255;
    if (!alpha || alpha.min !== opaque || alpha.max !== opaque) fail('Native screenshot alpha must be completely opaque (255 for every 8-bit sample)');
    buffer = await sharp(original).removeAlpha().keepMetadata().png().toBuffer();
  }
  const normalized = await sharp(buffer).metadata();
  if (normalized.format !== 'png' || normalized.width !== dimensions.width || normalized.height !== dimensions.height || normalized.hasAlpha) fail('Native PNG normalization changed its dimensions or retained alpha');
  return { buffer, removedAlpha: Boolean(metadata.hasAlpha), originalBytes: original.length, originalSha256: hash(original) };
}

async function checkExisting(file, bytes, allowedRoot) {
  try {
    const actual = await checkedRealPath(allowedRoot, path.relative(allowedRoot, file));
    if (!(await stat(actual)).isFile() || hash(await readFile(actual)) !== hash(bytes)) fail(`Refusing to overwrite different bytes at an existing screenshot: ${file}`);
    return true;
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export async function writeOrReuse(file, bytes, allowedRoot) {
  resolveWithin(allowedRoot, path.relative(allowedRoot, file));
  await checkedRealPath(allowedRoot, path.relative(allowedRoot, path.dirname(file)));
  if (await checkExisting(file, bytes, allowedRoot)) return 'reused';
  let handle;
  try { handle = await open(file, 'wx'); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (await checkExisting(file, bytes, allowedRoot)) return 'reused';
    throw error;
  }
  try { await handle.writeFile(bytes); } finally { await handle.close(); }
  if (!(await checkExisting(file, bytes, allowedRoot))) fail('Written screenshot failed readback');
  return 'written';
}

export function validateConfig(config) {
  if (config.locale !== 'zh-Hans' || config.orientation !== 'portrait' || JSON.stringify(config.views) !== JSON.stringify(VIEWS) || !Array.isArray(config.groups) || config.groups.length !== 2 || new Set(config.groups.map(g => g.displayType)).size !== 2) fail('Unexpected native screenshot configuration');
  for (const group of config.groups) {
    const expected = TARGETS[group.displayType];
    if (!expected || Object.entries(expected).some(([key, value]) => group[key] !== value)) fail('Screenshot target path/dimensions differ from the native import contract');
  }
}

export async function importNativeScreenshots(nativeDirectory) {
  if (typeof nativeDirectory !== 'string' || !nativeDirectory.trim() || !path.isAbsolute(nativeDirectory) || /^[/\\]{2}/.test(nativeDirectory) || /^[a-z]+:\/\//i.test(nativeDirectory)) fail('WBR_SCREENSHOT_NATIVE_DIR is required and must be an absolute local directory (no URL or network share)');
  const root = await realpath(fileURLToPath(new URL('../', import.meta.url)));
  const nativeRoot = await realpath(nativeDirectory);
  if (!(await stat(nativeRoot)).isDirectory()) fail('WBR_SCREENSHOT_NATIVE_DIR is not a directory');
  const [config, app, eas] = await Promise.all(['store/ios/screenshot-sizes.json', 'apps/mobile-expo/app.json', 'apps/mobile-expo/eas.json'].map(async file => JSON.parse(await readFile(path.join(root, file), 'utf8'))));
  validateConfig(config);
  const expected = { appId: eas.submit?.production?.ios?.ascAppId, bundleIdentifier: app.expo?.ios?.bundleIdentifier, version: app.expo?.version, buildNumber: app.expo?.ios?.buildNumber };
  if (expected.appId !== '6821271597' || expected.bundleIdentifier !== 'com.helio.cyberbless' || (eas.submit.production.ios.bundleIdentifier && eas.submit.production.ios.bundleIdentifier !== expected.bundleIdentifier) || !expected.version) fail('Local project App Store identity is inconsistent');
  const sourceFile = await checkedRealPath(nativeRoot, 'capture-source.json');
  const sourceBytes = await readFile(sourceFile);
  const source = JSON.parse(sourceBytes.toString('utf8'));
  validateCaptureSource(source, expected);
  const manifest = { captureId: source.captureId, capturedAt: source.capturedAt, importedAt: new Date().toISOString(), source: source.source, nativeStatusBar: true, appId: source.appId, bundleIdentifier: source.bundleIdentifier, sourceCommit: source.sourceCommit, version: source.version, buildNumber: source.buildNumber, devices: source.devices, captureSourceSha256: hash(sourceBytes), specificationUrl: config.specificationUrl, groups: [] };
  const prepared = [];
  // Check all ten original inputs before creating any output files.
  for (const group of config.groups) {
    const directory = await checkedRealPath(nativeRoot, group.nativeDirectory);
    if (!(await stat(directory)).isDirectory()) fail('Native screenshot group is not a directory');
    const record = { displayType: group.displayType, label: group.label, width: group.width, height: group.height, legacy: false, nativeDirectory: group.nativeDirectory, source: source.source, device: source.devices[group.nativeDirectory], files: [] };
    for (const view of config.views) {
      const nativeFile = `${group.nativeDirectory}/${view}.png`;
      const originalPath = await checkedRealPath(nativeRoot, nativeFile);
      if (!(await stat(originalPath)).isFile()) fail(`Native screenshot is not a regular file: ${nativeFile}`);
      const result = await normalizeNativePng(await readFile(originalPath), group);
      const fileName = `${source.captureId}-${view}.png`;
      prepared.push({ group, record, nativeFile, fileName, ...result });
    }
    manifest.groups.push(record);
  }
  const output = await ensureDirectoryWithin(root, `store/screenshots/ios/${config.locale}`);
  for (const group of config.groups) {
    await ensureDirectoryWithin(output, group.directory);
  }
  // Preflight every destination, then create exclusively to cover later races.
  for (const item of prepared) {
    item.destination = resolveWithin(output, path.join(item.group.directory, item.fileName));
    await checkExisting(item.destination, item.buffer, output);
  }
  for (const item of prepared) {
    await writeOrReuse(item.destination, item.buffer, output);
    item.record.files.push({ file: path.relative(root, item.destination).replaceAll(path.sep, '/'), fileName: item.fileName, width: item.group.width, height: item.group.height, hasAlpha: false, bytes: item.buffer.length, sha256: hash(item.buffer), md5: hash(item.buffer, 'md5'), nativeFile: item.nativeFile, originalBytes: item.originalBytes, originalSha256: item.originalSha256, removedOpaqueAlpha: item.removedAlpha });
  }
  const manifestFile = resolveWithin(root, 'store/screenshots/ios-sizes-manifest.json');
  await checkedRealPath(root, path.relative(root, path.dirname(manifestFile)));
  const temporary = `${manifestFile}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, manifestFile);
  } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  console.log(`Imported ${manifest.groups.length} native groups / ${prepared.length} screenshots without resizing: ${manifestFile}`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await importNativeScreenshots(process.env.WBR_SCREENSHOT_NATIVE_DIR); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
