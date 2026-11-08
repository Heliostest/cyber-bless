import { createHash, createPrivateKey, randomBytes, randomUUID, sign, verify, X509Certificate } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SHA = /^[a-f0-9]{64}$/;
const PLATFORMS = new Set(['ios', 'android']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = (status, message) => Object.assign(new Error(message), { status });
const json = value => JSON.stringify(value);
const stable = value => JSON.stringify(value, (_k, v) => v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v);
const mime = ext => ({ js: 'application/javascript', hbc: 'application/javascript', bundle: 'application/javascript', html: 'text/html', css: 'text/css',
  json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4',
  mp4: 'video/mp4', glb: 'model/gltf-binary', gltf: 'model/gltf+json', hdr: 'application/octet-stream' }[ext] ?? 'application/octet-stream');

function text(value, label, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) throw fail(400, `Invalid ${label}`);
  return value;
}
function relativeFile(value) {
  if (typeof value !== 'string' || !value || value.length > 500 || /[\\:%?#\x00-\x20\x7f]/.test(value) || value.startsWith('/') ||
      value.split('/').some(p => !p || p === '.' || p === '..' || p.startsWith('.'))) throw fail(400, 'Unsafe export path');
  if (!/^(assets|dom|_expo)\/[a-zA-Z0-9_./@+-]+$/.test(value)) throw fail(400, 'Export path is outside the Metro allowlist');
  return value;
}
function extension(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9]{1,12}$/.test(value) || /^(pem|key|map|env|p12|mobileprovision)$/i.test(value)) throw fail(400, 'Invalid asset extension');
  return value.toLowerCase();
}
async function readRegular(root, relative, maxBytes = 512 * 1024 * 1024) {
  if ((await lstat(root)).isSymbolicLink()) throw fail(400, 'Symbolic links are forbidden in update artifacts');
  const rootPath = await realpath(root), segments = relative.split('/');
  let target = rootPath;
  for (const segment of segments) {
    target = path.join(target, segment);
    const info = await lstat(target);
    if (info.isSymbolicLink()) throw fail(400, 'Symbolic links are forbidden in update artifacts');
  }
  const info = await lstat(target);
  if (!info.isFile() || info.size === 0 || info.size > maxBytes) throw fail(400, 'Invalid update file size');
  const bytes = await readFile(target);
  if (bytes.length < 1024 && bytes.subarray(0, 43).toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1')) throw fail(400, 'Unresolved Git LFS pointer in update artifact');
  return bytes;
}
async function atomicFile(file, bytes, { exclusive = false } = {}) {
  await mkdir(path.dirname(file), { recursive: true });
  if (exclusive) {
    const handle = await open(file, 'wx', 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    return;
  }
  const temp = `${file}.${randomBytes(12).toString('hex')}.tmp`;
  let handle;
  try {
    handle = await open(temp, 'wx', 0o600); await handle.writeFile(bytes); await handle.sync(); await handle.close(); handle = undefined;
    await rename(temp, file);
  } finally { await handle?.close(); await rm(temp, { force: true }); }
}
async function maybeJSON(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
async function certificate(options, requirePrivate = false) {
  if (!options.certificatePath || (requirePrivate && !options.privateKeyPath)) throw fail(503, 'Update signing is not configured');
  let cert;
  try { cert = new X509Certificate(await readFile(options.certificatePath)); }
  catch { throw fail(503, 'Update signing certificate is unavailable or invalid'); }
  if (cert.publicKey.asymmetricKeyType !== 'rsa' || (cert.publicKey.asymmetricKeyDetails?.modulusLength ?? 0) < 2048 ||
      Date.now() < Date.parse(cert.validFrom) || Date.now() >= Date.parse(cert.validTo) || !cert.verify(cert.publicKey)) {
    throw fail(503, 'Update signing requires a valid self-signed RSA certificate (at least 2048 bits)');
  }
  if (!requirePrivate) return { cert };
  // Refuse even an ignored key inside any Git working tree. Public certificates may be committed.
  let keyPath;
  try { keyPath = await realpath(options.privateKeyPath); }
  catch { throw fail(503, 'Update signing private key is unavailable'); }
  let parent = path.dirname(keyPath);
  while (true) {
    try { await lstat(path.join(parent, '.git')); throw fail(503, 'Signing private key must be outside Git working trees'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const next = path.dirname(parent); if (next === parent) break; parent = next;
  }
  let privateKey;
  try { privateKey = createPrivateKey(await readFile(keyPath)); }
  catch { throw fail(503, 'Update signing private key is unavailable or invalid'); }
  if (!cert.checkPrivateKey(privateKey)) throw fail(503, 'Update signing key does not match certificate');
  return { cert, privateKey };
}
const signatureHeader = (body, privateKey, keyId) => `sig="${sign('RSA-SHA256', Buffer.from(body), privateKey).toString('base64')}", keyid="${keyId}", alg="rsa-v1_5-sha256"`;
function validSignature(body, signature, cert, keyId) {
  const match = typeof signature === 'string' && /^sig="([A-Za-z0-9+/=]+)", keyid="([a-zA-Z0-9_-]+)", alg="rsa-v1_5-sha256"$/.exec(signature);
  if (!match || match[2] !== keyId || !verify('RSA-SHA256', Buffer.from(body), cert.publicKey, Buffer.from(match[1], 'base64'))) throw fail(400, 'Invalid update signature');
}
function sourceIdentity(source) {
  if (!source || !/^[a-f0-9]{40}$/.test(source.commit) || !/^[a-f0-9]{40}$/.test(source.tree) || source.dirty !== false || source.method !== 'clean-git-metro-export') {
    throw fail(400, 'A clean Git commit/tree and verified Metro export provenance are required');
  }
  return { commit: source.commit, tree: source.tree, dirty: false, method: source.method };
}
function metadataFiles(metadata) {
  if (!metadata || metadata.version !== 0 || metadata.bundler !== 'metro' || !metadata.fileMetadata || typeof metadata.fileMetadata !== 'object') throw fail(400, 'Invalid Metro metadata.json');
  const platforms = Object.keys(metadata.fileMetadata).sort();
  if (!platforms.length || platforms.some(p => !PLATFORMS.has(p))) throw fail(400, 'Unsupported export platform');
  const files = new Map();
  for (const platform of platforms) {
    const data = metadata.fileMetadata[platform];
    if (!data || !Array.isArray(data.assets) || data.assets.length > 20000) throw fail(400, 'Invalid Metro assets');
    const bundle = relativeFile(data.bundle);
    if (!bundle.startsWith(`_expo/static/js/${platform}/`) || !/\.(js|hbc|bundle)$/.test(bundle)) throw fail(400, 'Invalid launch bundle path');
    files.set(bundle, { path: bundle, ext: 'js' });
    const local = new Set([bundle]), keys = new Set();
    for (const asset of data.assets) {
      const assetPath = relativeFile(asset.path), ext = extension(asset.ext);
      if (local.has(assetPath)) throw fail(400, 'Duplicate export asset path');
      local.add(assetPath);
      const name = path.posix.basename(assetPath), key = name.endsWith(`.${ext}`) ? name.slice(0, -(ext.length + 1)) : name;
      if (!/^[a-zA-Z0-9_-]{1,160}$/.test(key) || keys.has(key)) throw fail(400, 'Duplicate or invalid native asset key');
      keys.add(key);
      const existing = files.get(assetPath);
      if (existing && existing.ext !== ext) throw fail(400, 'Conflicting asset extensions');
      files.set(assetPath, { path: assetPath, ext, key });
    }
  }
  return { platforms, files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path)) };
}
function validateLocalDependency(value, file, all) {
  if (!value || value.startsWith('#') || value.startsWith('data:')) return;
  if (value.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(value) || /[\\%?#]/.test(value)) throw fail(400, 'External or unsafe DOM dependency');
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), value));
  if (!all.has(resolved)) throw fail(400, `Missing registered DOM dependency: ${resolved}`);
}
function validateDOM(file, bytes, all) {
  const content = bytes.toString('utf8');
  if (file.endsWith('.html')) {
    // Executable and stylesheet dependencies must be frozen with the update, never fetched remotely.
    for (const tag of content.matchAll(/<(?:script|link|img|source|audio|video|iframe)\b[^>]*>/gi)) {
      for (const attr of tag[0].matchAll(/\b(?:src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) validateLocalDependency(attr[1] ?? attr[2] ?? attr[3], file, all);
    }
    if (/<base\b|\b(?:srcset|srcdoc)\s*=/i.test(content)) throw fail(400, 'Unsupported DOM dependency attribute');
  }
  if (file.endsWith('.css')) {
    for (const match of content.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)|@import\s+["']([^"']+)["']/gi)) validateLocalDependency(match[1] ?? match[2], file, all);
  }
  if (file.startsWith('dom/') && /\.(js|html)$/.test(file)) {
    for (const match of content.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)|\b(?:import|export)\s+(?:[^;\n]*?\s+from\s+)?["']([^"']+)["']/g)) {
      validateLocalDependency(match[1] ?? match[2], file, all);
    }
  }
}

/** Trusted local packaging primitive; CLI prepare captures source before and after running Metro itself. */
export async function packageExpoExport({ exportDir, outputDir, runtimeVersion, source, message = '', expoClient = {}, ...signing }) {
  const identity = sourceIdentity(source), runtime = text(runtimeVersion, 'runtime version');
  if (typeof message !== 'string' || message.length > 4000 || /\x00/.test(message)) throw fail(400, 'Invalid release message');
  const { privateKey } = await certificate(signing, true), keyId = signing.keyId ?? 'main';
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(keyId)) throw fail(400, 'Invalid signing key ID');
  const metadata = JSON.parse(await readRegular(exportDir, 'metadata.json', 8 * 1024 * 1024));
  // SDK 57 uses path.join for metadata on Windows. Canonicalize separators before validation/signing.
  if (metadata?.fileMetadata && typeof metadata.fileMetadata === 'object') {
    for (const entry of Object.values(metadata.fileMetadata)) {
      if (typeof entry?.bundle === 'string') entry.bundle = entry.bundle.replaceAll('\\', '/');
      if (Array.isArray(entry?.assets)) for (const asset of entry.assets) if (typeof asset?.path === 'string') asset.path = asset.path.replaceAll('\\', '/');
    }
  }
  const { platforms, files } = metadataFiles(metadata), all = new Set(files.map(f => f.path)), contents = new Map();
  for (const file of files) {
    const bytes = await readRegular(exportDir, file.path); validateDOM(file.path, bytes, all);
    contents.set(file.path, bytes); file.size = bytes.length; file.sha256 = sha(bytes);
  }
  // Only explicitly public identifiers are retained; config extra/requestHeaders may contain credentials.
  const publicConfig = Object.fromEntries(['name', 'slug', 'version', 'sdkVersion', 'orientation', 'scheme', 'userInterfaceStyle'].filter(k =>
    typeof expoClient[k] === 'string').map(k => [k, expoClient[k]]));
  const release = { schemaVersion: 1, id: randomUUID(), createdAt: new Date().toISOString(), runtimeVersion: runtime, source: identity,
    message, platforms, metadata, files, expoClient: publicConfig };
  const body = json(release), signature = signatureHeader(body, privateKey, keyId);
  const target = path.resolve(outputDir), temporary = `${target}.${randomBytes(12).toString('hex')}.tmp`;
  // Never replace an existing prepared package, even if the caller reuses its path.
  try { await lstat(target); throw fail(409, 'Prepared update directory already exists'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  await mkdir(temporary, { recursive: true });
  try {
    for (const [name, bytes] of contents) await atomicFile(path.join(temporary, 'files', name), bytes);
    await atomicFile(path.join(temporary, 'release.json'), body);
    await atomicFile(path.join(temporary, 'release.sig'), signature);
    await rename(temporary, target);
  } finally { await rm(temporary, { recursive: true, force: true }); }
  return release;
}

function validateRelease(release) {
  if (!release || release.schemaVersion !== 1 || !UUID.test(release.id) || !Number.isFinite(Date.parse(release.createdAt))) throw fail(400, 'Invalid release identity');
  sourceIdentity(release.source); text(release.runtimeVersion, 'runtime version');
  if (typeof release.message !== 'string' || release.message.length > 4000 || !Array.isArray(release.files)) throw fail(400, 'Invalid release');
  const expected = metadataFiles(release.metadata);
  if (stable(release.platforms) !== stable(expected.platforms) || release.files.length !== expected.files.length) throw fail(400, 'Partial export file inventory');
  const fileMap = new Map(release.files.map(file => [file.path, file]));
  if (fileMap.size !== release.files.length) throw fail(400, 'Duplicate export file inventory');
  for (const file of expected.files) {
    const actual = fileMap.get(file.path);
    if (!actual || actual.ext !== file.ext || actual.key !== file.key || !SHA.test(actual.sha256) || !Number.isSafeInteger(actual.size) || actual.size < 1 || actual.size > 512 * 1024 * 1024) {
      throw fail(400, 'Invalid export hash/file inventory');
    }
  }
  return release;
}
function checkBytes(bytes, file) {
  if (bytes.length !== file.size || sha(bytes) !== file.sha256) throw fail(400, 'Update asset integrity/hash mismatch');
}
function sendJSON(res, status, value) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(json(value));
}
async function requestJSON(req, limit) {
  if (!(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) throw fail(415, 'Expected application/json');
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw fail(413, 'Update request is too large'); chunks.push(chunk); }
  try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error(); return value; }
  catch { throw fail(400, 'Invalid update request JSON'); }
}
function accepts(header, type) {
  return (header ?? '*/*').split(',').some(part => {
    const [media, ...parameters] = part.trim().toLowerCase().split(';');
    const q = parameters.find(p => p.trim().startsWith('q='));
    return (!q || Number(q.trim().slice(2)) > 0) && (media === type || media === '*/*' || media === `${type.split('/')[0]}/*`);
  });
}

/** Root owns invitation auth and localhost/Host/Origin checks for the admin listener. */
export function createInternalUpdateService(options) {
  if (!options?.storageDir) throw fail(400, 'Update storageDir is required');
  const directory = path.resolve(options.storageDir), keyId = options.keyId ?? 'main', channel = options.channel ?? 'internal';
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(keyId) || channel !== 'internal') throw fail(400, 'Invalid internal update channel or key ID');
  const base = new URL(options.publicBaseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') throw fail(400, 'Updates publicBaseUrl must be a fixed HTTPS origin');
  const publicOrigin = base.origin, prefix = '/api/internal-updates', statePath = path.join(directory, 'channel.json');
  const signing = { ...options, keyId };
  async function locked(operation) {
    await mkdir(directory, { recursive: true });
    let handle;
    try { handle = await open(path.join(directory, 'publish.lock'), 'wx', 0o600); }
    catch (e) { if (e.code === 'EEXIST') throw fail(409, 'Another update operation holds the storage lock; inspect publish.lock if a process crashed'); throw e; }
    try { await handle.writeFile(json({ pid: process.pid, hostname: os.hostname(), createdAt: new Date().toISOString() })); return await operation(); }
    finally { await handle.close(); await rm(path.join(directory, 'publish.lock'), { force: true }); }
  }
  async function state() {
    const value = await maybeJSON(statePath, { schemaVersion: 1, channel, entries: [], history: [] });
    if (value.schemaVersion !== 1 || value.channel !== channel || !Array.isArray(value.entries) || !Array.isArray(value.history) ||
        value.history.some(id => !UUID.test(id)) || value.entries.some(entry => !PLATFORMS.has(entry.platform) || typeof entry.runtimeVersion !== 'string' || !UUID.test(entry.publicationId))) {
      throw fail(503, 'Invalid internal update channel state');
    }
    return value;
  }
  async function readRelease(id, verifyFiles = true) {
    if (!UUID.test(id)) throw fail(400, 'Invalid release ID');
    const envelope = await maybeJSON(path.join(directory, 'releases', `${id}.json`));
    if (!envelope) throw fail(404, 'Verified release not found');
    const { cert } = await certificate(signing);
    validSignature(envelope.body, envelope.signature, cert, keyId);
    const release = validateRelease(JSON.parse(envelope.body));
    if (release.id !== id) throw fail(400, 'Release identity mismatch');
    if (verifyFiles) for (const file of release.files) checkBytes(await readRegular(path.join(directory, 'blobs'), file.sha256), file);
    return { release, envelope };
  }
  async function readPublication(id) {
    if (!UUID.test(id)) throw fail(503, 'Invalid publication identity');
    const publication = await maybeJSON(path.join(directory, 'publications', `${id}.json`));
    if (!publication || publication.updateId !== id || !['update', 'embedded'].includes(publication.type)) throw fail(503, 'Publication is missing or invalid');
    const { cert } = await certificate(signing); validSignature(publication.body, publication.signature, cert, keyId);
    const payload = JSON.parse(publication.body);
    if (publication.type === 'update' && (payload.id !== id || payload.createdAt !== publication.createdAt || payload.runtimeVersion !== publication.runtimeVersion ||
      payload.metadata?.channel !== channel || payload.metadata?.platform !== publication.platform || payload.extra?.internalUpdates?.releaseId !== publication.releaseId ||
      payload.extra?.internalUpdates?.sourceCommit !== publication.sourceCommit || payload.extra?.internalUpdates?.sourceTree !== publication.sourceTree ||
      payload.extra?.internalUpdates?.message !== publication.message)) throw fail(503, 'Publication identity mismatch');
    if (publication.type === 'embedded' && (payload.type !== 'rollBackToEmbedded' || payload.parameters?.commitTime !== publication.createdAt ||
      payload.extra?.internalUpdates?.channel !== channel || payload.extra?.internalUpdates?.platform !== publication.platform ||
      payload.extra?.internalUpdates?.runtimeVersion !== publication.runtimeVersion || payload.extra?.internalUpdates?.updateId !== id)) throw fail(503, 'Rollback directive mismatch');
    return publication;
  }
  async function list() {
    await mkdir(path.join(directory, 'releases'), { recursive: true });
    let signingConfigured = false;
    try { await certificate(signing, true); signingConfigured = true; } catch {}
    const releases = [], invalidReleases = [];
    for (const name of await readdir(path.join(directory, 'releases'))) {
      if (!UUID.test(name.replace(/\.json$/, '')) || !name.endsWith('.json')) continue;
      try {
        const { release } = await readRelease(name.slice(0, -5));
        releases.push({ id: release.id, createdAt: release.createdAt, runtimeVersion: release.runtimeVersion, platforms: release.platforms,
          source: release.source, message: release.message, fileCount: release.files.length, totalBytes: release.files.reduce((sum, f) => sum + f.size, 0), verified: true });
      } catch { invalidReleases.push(name.slice(0, -5)); }
    }
    const current = await state(), channels = [];
    for (const entry of current.entries) {
      const publication = await readPublication(entry.publicationId);
      if (publication.platform !== entry.platform || publication.runtimeVersion !== entry.runtimeVersion) throw fail(503, 'Channel scope does not match signed publication');
      const { body: _body, signature: _signature, ...summary } = publication;
      channels.push(summary);
    }
    return { schemaVersion: 1, channel, signingConfigured, releases: releases.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), channels, invalidReleases };
  }
  async function importRelease(packageDir) {
    const { cert } = await certificate(signing);
    const body = (await readRegular(packageDir, 'release.json', 16 * 1024 * 1024)).toString('utf8');
    const signature = (await readRegular(packageDir, 'release.sig', 16384)).toString('utf8');
    validSignature(body, signature, cert, keyId);
    const release = validateRelease(JSON.parse(body));
    return locked(async () => {
      const bytesByHash = new Map(), all = new Set(release.files.map(f => f.path));
      for (const file of release.files) {
        const bytes = await readRegular(path.join(packageDir, 'files'), file.path); checkBytes(bytes, file); validateDOM(file.path, bytes, all); bytesByHash.set(file.sha256, bytes);
      }
      const recordPath = path.join(directory, 'releases', `${release.id}.json`), envelope = { body, signature };
      const previous = await maybeJSON(recordPath);
      if (previous) { if (stable(previous) !== stable(envelope)) throw fail(409, 'Immutable release ID already exists'); await readRelease(release.id); return release; }
      for (const [hash, bytes] of bytesByHash) {
        const blobPath = path.join(directory, 'blobs', hash);
        try { const previousBytes = await readFile(blobPath); if (sha(previousBytes) !== hash) throw fail(400, 'Stored asset integrity/hash mismatch'); }
        catch (error) { if (error.code !== 'ENOENT') throw error; await atomicFile(blobPath, bytes); }
      }
      // Candidate becomes visible only once every blob has been copied and checked.
      await atomicFile(recordPath, json(envelope));
      return release;
    });
  }
  function asset(file, launch = false) {
    return { key: file.key ?? file.sha256, hash: Buffer.from(file.sha256, 'hex').toString('base64url'), contentType: mime(file.ext),
      ...(!launch ? { fileExtension: `.${file.ext}` } : {}), url: `${publicOrigin}${prefix}/assets/${file.sha256}` };
  }
  function validateSelection(selection, embeddedAllowed) {
    if (!selection || typeof selection !== 'object' || Array.isArray(selection)) throw fail(400, 'Invalid publication selection');
    const allowed = new Set(embeddedAllowed ? ['releaseId', 'platform', 'runtimeVersion', 'embedded'] : ['releaseId', 'platform', 'runtimeVersion']);
    if (Object.keys(selection).some(k => !allowed.has(k))) throw fail(400, 'Unsupported publication selection field');
    if (selection.platform !== undefined && !PLATFORMS.has(selection.platform)) throw fail(400, 'Invalid platform');
    if (selection.runtimeVersion !== undefined) text(selection.runtimeVersion, 'runtime version');
    if (selection.embedded === true) { if (selection.releaseId || !selection.platform || !selection.runtimeVersion) throw fail(400, 'Embedded rollback requires platform/runtime only'); }
    else if (selection.embedded !== undefined || !UUID.test(selection.releaseId ?? '')) throw fail(400, 'Invalid verified release ID');
  }
  async function change(selection, rollback) {
    validateSelection(selection, rollback);
    const { privateKey } = await certificate(signing, true);
    return locked(async () => {
      const current = await state(), release = selection.embedded ? undefined : (await readRelease(selection.releaseId)).release;
      if (release && selection.runtimeVersion !== undefined && selection.runtimeVersion !== release.runtimeVersion) throw fail(409, 'Release runtime does not match selection');
      const platforms = release ? selection.platform ? [selection.platform] : release.platforms : [selection.platform];
      if (release && platforms.some(p => !release.platforms.includes(p))) throw fail(409, 'Release platform is incompatible');
      const runtimeVersion = release?.runtimeVersion ?? selection.runtimeVersion;
      const latestTime = Math.max(0, ...await Promise.all(current.history.map(async id => Date.parse((await readPublication(id)).createdAt))));
      const createdAt = new Date(Math.max(Date.now(), latestTime + 1)).toISOString(), publications = [];
      for (const platform of platforms) {
        const old = current.entries.find(e => e.platform === platform && e.runtimeVersion === runtimeVersion);
        const oldPublication = old ? await readPublication(old.publicationId) : undefined;
        const updateId = randomUUID(); let payload;
        if (release) {
          const meta = release.metadata.fileMetadata[platform], byPath = new Map(release.files.map(f => [f.path, f]));
          payload = { id: updateId, createdAt, runtimeVersion, launchAsset: asset(byPath.get(meta.bundle), true), assets: meta.assets.map(a => asset(byPath.get(a.path))),
            metadata: { channel, platform }, extra: { expoClient: release.expoClient ?? {}, internalUpdates: {
              sourceCommit: release.source.commit, sourceTree: release.source.tree, message: release.message, releaseId: release.id,
              ...(rollback ? { rollback: true, rollbackFromReleaseId: oldPublication?.releaseId ?? null } : {}) } } };
        } else payload = { type: 'rollBackToEmbedded', parameters: { commitTime: createdAt }, extra: { internalUpdates: { channel, platform, runtimeVersion, updateId } } };
        const body = json(payload), publication = { updateId, createdAt, channel, platform, runtimeVersion, type: release ? 'update' : 'embedded',
          ...(release ? { releaseId: release.id, sourceCommit: release.source.commit, sourceTree: release.source.tree, message: release.message } : {}),
          ...(rollback ? { rollbackFromReleaseId: oldPublication?.releaseId ?? null } : {}), body, signature: signatureHeader(body, privateKey, keyId) };
        await atomicFile(path.join(directory, 'publications', `${updateId}.json`), json(publication)); publications.push(publication);
      }
      const next = { schemaVersion: 1, channel, entries: [
        ...current.entries.filter(e => !(e.runtimeVersion === runtimeVersion && platforms.includes(e.platform))),
        ...publications.map(p => ({ platform: p.platform, runtimeVersion, publicationId: p.updateId })) ], history: [...current.history, ...publications.map(p => p.updateId)] };
      // One atomic rename moves the entire channel. Orphan publication files are never served.
      await atomicFile(statePath, json(next));
      return { publications: publications.map(({ body: _body, signature: _sig, ...summary }) => summary) };
    });
  }
  function commonHeaders(res) {
    res.setHeader('expo-protocol-version', '1'); res.setHeader('expo-sfv-version', '0'); res.setHeader('expo-manifest-filters', `channel="${channel}"`);
    res.setHeader('expo-server-defined-headers', ''); res.setHeader('cache-control', 'private, max-age=0');
    res.setHeader('vary', 'Accept, Expo-Platform, Expo-Runtime-Version, Expo-Expect-Signature, X-Feedback-Token'); res.setHeader('x-content-type-options', 'nosniff');
  }
  async function publicRequest(req, res, authorized) {
    const requestPath = req.url.split('?')[0];
    if (req.method !== 'GET') throw fail(405, 'Expected GET');
    if (requestPath.startsWith(`${prefix}/assets/`)) {
      const hash = requestPath.slice(`${prefix}/assets/`.length);
      if (!SHA.test(hash)) throw fail(400, 'Invalid asset hash path');
      const current = await state(); let selected;
      for (const id of current.history) {
        const publication = await readPublication(id); if (publication.type !== 'update') continue;
        const manifest = JSON.parse(publication.body);
        selected = [manifest.launchAsset, ...manifest.assets].find(a => a.url === `${publicOrigin}${prefix}/assets/${hash}` && a.hash === Buffer.from(hash, 'hex').toString('base64url'));
        if (selected) break;
      }
      if (!selected) throw fail(404, 'Published asset not found');
      const bytes = await readRegular(path.join(directory, 'blobs'), hash);
      if (sha(bytes) !== hash) throw fail(503, 'Published asset integrity/hash mismatch');
      res.writeHead(200, { 'content-type': selected.contentType, 'content-length': bytes.length, 'cache-control': 'public, max-age=31536000, immutable',
        etag: `"${hash}"`, 'x-content-type-options': 'nosniff' }); res.end(bytes); return;
    }
    if (!authorized) throw fail(401, 'A valid internal invitation is required');
    if (req.headers['expo-protocol-version'] !== '1') throw fail(406, 'Expo Updates protocol version 1 is required');
    const platform = req.headers['expo-platform'], runtimeVersion = req.headers['expo-runtime-version'];
    if (!PLATFORMS.has(platform)) throw fail(400, 'Unsupported Expo platform'); text(runtimeVersion, 'Expo runtime version');
    if (req.headers['expo-channel-name'] !== undefined && req.headers['expo-channel-name'] !== channel) throw fail(400, 'Unsupported update channel');
    const expected = req.headers['expo-expect-signature'];
    if (expected && (typeof expected !== 'string' || (expected.match(/keyid="([^"]+)"/)?.[1] ?? keyId) !== keyId ||
      (expected.match(/alg="([^"]+)"/)?.[1] ?? 'rsa-v1_5-sha256') !== 'rsa-v1_5-sha256')) throw fail(406, 'Unsupported update signature key or algorithm');
    const current = await state(), entry = current.entries.find(e => e.platform === platform && e.runtimeVersion === runtimeVersion);
    commonHeaders(res);
    if (!entry) { res.writeHead(204); res.end(); return; }
    const publication = await readPublication(entry.publicationId);
    if (publication.platform !== platform || publication.runtimeVersion !== runtimeVersion) throw fail(503, 'Channel scope does not match signed publication');
    // An embedded launch can still have a newer downloaded update in its cache.
    // Let native selection apply the rollback timestamp so that update cannot
    // win the next launch; running the embedded ID alone does not prove rollback.
    if (publication.type === 'update' && req.headers['expo-current-update-id'] === publication.updateId) {
      res.writeHead(204); res.end(); return;
    }
    const accept = req.headers.accept;
    if (accepts(accept, 'multipart/mixed')) {
      const boundary = `expo-${randomBytes(18).toString('hex')}`, name = publication.type === 'update' ? 'manifest' : 'directive';
      const body = `--${boundary}\r\ncontent-disposition: form-data; name="${name}"\r\ncontent-type: application/json\r\nexpo-signature: ${publication.signature}\r\n\r\n${publication.body}\r\n--${boundary}--\r\n`;
      res.writeHead(200, { 'content-type': `multipart/mixed; boundary=${boundary}` }); res.end(body); return;
    }
    const type = accepts(accept, 'application/expo+json') ? 'application/expo+json' : accepts(accept, 'application/json') ? 'application/json' : undefined;
    if (publication.type !== 'update' || !type) throw fail(406, 'This response requires multipart/mixed');
    res.writeHead(200, { 'content-type': type, 'expo-signature': publication.signature }); res.end(publication.body);
  }
  async function protectedHandler(operation, res) {
    try { await operation(); }
    catch (error) { if (res.headersSent) { res.destroy(); return; } sendJSON(res, error.status ?? 503, { error: error.status ? error.message : 'Internal update storage is unavailable' }); }
    return true;
  }
  return {
    list, importRelease, publish: selection => change(selection, false), rollback: selection => change(selection, true),
    async handlePublic(req, res, { authorized = false } = {}) {
      const requestPath = req.url?.split('?')[0] ?? '';
      if (requestPath !== `${prefix}/check` && !requestPath.startsWith(`${prefix}/assets/`)) return false;
      return protectedHandler(() => publicRequest(req, res, authorized), res);
    },
    async handleAdmin(req, res) {
      const requestPath = req.url?.split('?')[0] ?? '';
      if (![prefix, `${prefix}/publish`, `${prefix}/rollback`].includes(requestPath)) return false;
      return protectedHandler(async () => {
        if (requestPath === prefix) { if (req.method !== 'GET') throw fail(405, 'Expected GET'); sendJSON(res, 200, await list()); return; }
        if (req.method !== 'POST') throw fail(405, 'Expected POST');
        const selection = await requestJSON(req, options.maxBodyBytes ?? 16384);
        sendJSON(res, 200, await change(selection, requestPath.endsWith('/rollback')));
      }, res);
    },
  };
}
