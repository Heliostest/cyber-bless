import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify, isDeepStrictEqual } from 'node:util';

const execute = promisify(execFile);
const oidPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const digestPattern = /^[a-f0-9]{64}$/;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const packagePath = 'apps/mobile-expo/package.json';

async function git(repo, args, { buffer = false } = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
  try {
    const { stdout } = await execute('git', ['-C', repo, ...args], {
      encoding: buffer ? 'buffer' : 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 45000,
      env: { ...env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', GIT_NO_REPLACE_OBJECTS: '1' },
    });
    return buffer ? stdout : stdout.trim();
  } catch { throw Error(`Git source verification failed (${args[0]}); command output withheld`); }
}

function safeSourcePath(repo, relative) {
  if (typeof relative !== 'string' || !relative || /[\\\x00-\x1f\x7f]/.test(relative) || path.posix.isAbsolute(relative) || /^[a-z]:/i.test(relative) || relative.split('/').some(part => !part || part === '.' || part === '..') || relative.split('/')[0].toLowerCase() === '.git') throw Error('Unsafe source manifest path');
  const file = path.resolve(repo, relative);
  const inside = path.relative(repo, file);
  if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) throw Error('Source path escaped the release checkout');
  return file;
}

function assertSourceFields(source) {
  if (!source || (source.sourceMode !== undefined && source.sourceMode !== 'git-tag') || source.sourceArchiveSha256 !== undefined || source.archiveSha256 !== undefined ||
      !oidPattern.test(source.sourceCommit ?? '') || !oidPattern.test(source.sourceTree ?? '') || !oidPattern.test(source.sourceTagObject ?? '') ||
      typeof source.sourceTag !== 'string' || !source.sourceTag || source.sourceTag.startsWith('-') || /[\x00-\x20\x7f]/.test(source.sourceTag) ||
      typeof source.sourceBranch !== 'string' || !source.sourceBranch || typeof source.repositoryUrl !== 'string' || !source.repositoryUrl) throw Error('A complete Git tag source identity is required; legacy source archives are unsupported');
  if (source.sourceBranch !== 'master') throw Error('Release tags must be merged into master; another source branch is unsupported');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(source.repositoryUrl)) {
    const url = new URL(source.repositoryUrl);
    if (url.username || url.password || url.search || url.hash) throw Error('Repository URLs must not contain credentials or query parameters');
  }
}

export function onlyPrebuildScriptChanges(before, after) {
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return false;
  const normalized = structuredClone(after);
  for (const platform of ['ios', 'android']) {
    if (before.scripts?.[platform] === after.scripts?.[platform]) continue;
    if (before.scripts?.[platform] !== `expo start --${platform}` || after.scripts?.[platform] !== `expo run:${platform}`) return false;
    normalized.scripts[platform] = before.scripts[platform];
  }
  return isDeepStrictEqual(before, normalized);
}

async function assertGitIdentity(repo, source, verifyRemote) {
  assertSourceFields(source);
  if (!path.isAbsolute(repo ?? '') || await realpath(repo) !== repo || await realpath(await git(repo, ['rev-parse', '--show-toplevel'])) !== repo) throw Error('Expected the exact Git release checkout root');
  await git(repo, ['check-ref-format', `refs/tags/${source.sourceTag}`]);
  await git(repo, ['check-ref-format', `refs/heads/${source.sourceBranch}`]);
  const tag = `refs/tags/${source.sourceTag}`;
  const [head, tagObject, type, commit, tree, origin] = await Promise.all([
    git(repo, ['rev-parse', '--verify', 'HEAD']), git(repo, ['rev-parse', '--verify', tag]),
    git(repo, ['cat-file', '-t', tag]), git(repo, ['rev-parse', '--verify', `${tag}^{commit}`]),
    git(repo, ['rev-parse', '--verify', `${tag}^{tree}`]), git(repo, ['remote', 'get-url', 'origin']),
  ]);
  if (head !== source.sourceCommit || tagObject !== source.sourceTagObject || type !== 'tag' || commit !== source.sourceCommit || tree !== source.sourceTree || origin !== source.repositoryUrl) throw Error('Git HEAD, annotated tag, commit, tree or origin identity mismatch');
  await git(repo, ['merge-base', '--is-ancestor', source.sourceCommit, `refs/remotes/origin/${source.sourceBranch}`]);
  if (verifyRemote) {
    const lines = (await git(repo, ['ls-remote', '--exit-code', 'origin', tag, `${tag}^{}`])).split('\n').map(line => line.split(/\s+/));
    const refs = new Map(lines.map(([oid, ref]) => [ref, oid]));
    if (refs.get(tag) !== source.sourceTagObject || refs.get(`${tag}^{}`) !== source.sourceCommit) throw Error('Remote release tag is missing or has moved');
  }
}

async function assertCleanInputs(repo, allowPrebuildChanges) {
  if (await git(repo, ['diff', '--cached', '--name-only', '-z'])) throw Error('Release index is dirty');
  if (await git(repo, ['ls-files', '--others', '--exclude-standard', '-z'])) throw Error('Release checkout contains untracked inputs');
  const dirty = (await git(repo, ['diff', '--name-only', '-z'])).split('\0').filter(Boolean);
  if (dirty.some(file => !allowPrebuildChanges || file !== packagePath)) throw Error('Release source has modified tracked files');
  if (await git(repo, ['diff', '--summary'])) throw Error('Release source file modes or paths changed');
}

async function hashWorkingFile(file, size, objectLength) {
  const content = createHash('sha256');
  const blob = createHash(objectLength === 64 ? 'sha256' : 'sha1').update(`blob ${size}\0`);
  let prefix = Buffer.alloc(0);
  for await (const bytes of createReadStream(file)) {
    content.update(bytes); blob.update(bytes);
    if (prefix.length < 200) prefix = Buffer.concat([prefix, bytes.subarray(0, 200 - prefix.length)]);
  }
  if (prefix.toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1')) throw Error('LFS pointer is not a materialized release source');
  return { sha256: content.digest('hex'), blob: blob.digest('hex') };
}

async function collectManifest(repo, source, { allowPrebuildChanges = false, verifyRemote = true } = {}) {
  await assertGitIdentity(repo, source, verifyRemote);
  await assertCleanInputs(repo, allowPrebuildChanges);
  const tree = await git(repo, ['ls-tree', '-r', '-z', '--full-tree', source.sourceCommit]);
  const lfs = new Map();
  for (const line of (await git(repo, ['lfs', 'ls-files', '--long', source.sourceCommit])).split('\n').filter(Boolean)) {
    const match = /^([a-f0-9]{64}) [*-] (.+)$/.exec(line);
    if (!match || lfs.has(match[2])) throw Error('Invalid Git LFS source listing');
    lfs.set(match[2], match[1]);
  }
  const records = [], seen = new Set();
  for (const entry of tree.split('\0').filter(Boolean)) {
    const match = /^(100644|100755) blob ([a-f0-9]+)\t(.+)$/.exec(entry);
    if (!match || !oidPattern.test(match[2])) throw Error('Release tree must contain regular files only; symlinks and submodules are unsupported');
    const [, , object, relative] = match;
    const absolute = safeSourcePath(repo, relative), key = process.platform === 'win32' ? relative.toLowerCase() : relative;
    if (seen.has(key)) throw Error('Duplicate source path');
    seen.add(key);
    const info = await lstat(absolute);
    if (!info.isFile() || await realpath(absolute) !== absolute) throw Error(`Release source is missing or symlinked: ${relative}`);
    const actual = await hashWorkingFile(absolute, info.size, object.length);
    const lfsObject = lfs.get(relative);
    let bytes = info.size, digest = actual.sha256;
    if (lfsObject) {
      if (digest !== lfsObject) throw Error(`Git LFS content mismatch: ${relative}`);
    } else if (actual.blob !== object) {
      if (!allowPrebuildChanges || relative !== packagePath) throw Error(`Source bytes differ from the tagged Git blob: ${relative}`);
      const before = await git(repo, ['show', `${source.sourceCommit}:${relative}`], { buffer: true });
      if (!onlyPrebuildScriptChanges(JSON.parse(before.toString('utf8')), JSON.parse(await readFile(absolute, 'utf8')))) throw Error('Unexpected source mutation after prebuild');
      bytes = before.length; digest = sha256(before);
    }
    records.push({ path: relative, bytes, sha256: digest, ...(lfsObject ? { gitLfsObject: lfsObject } : {}) });
  }
  if ([...lfs.keys()].some(file => !seen.has(process.platform === 'win32' ? file.toLowerCase() : file))) throw Error('Git LFS file is absent from the tagged source tree');
  records.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  let widgetImagesChecked = 0;
  if (seen.has('assets/widgets/today/manifest.json')) {
    const widgets = JSON.parse(await readFile(path.join(repo, 'assets/widgets/today/manifest.json'), 'utf8'));
    if (!Array.isArray(widgets.scenes)) throw Error('Invalid tagged widget image manifest');
    const indexed = new Map(records.map(record => [record.path, record]));
    for (const scene of widgets.scenes) for (const size of ['small', 'medium', 'large']) {
      const cover = scene[size];
      if (!cover || !/^[a-z0-9-]+\.png$/.test(cover.file ?? '') || !digestPattern.test(cover.sha256 ?? '') || indexed.get(`assets/widgets/today/${cover.file}`)?.sha256 !== cover.sha256) throw Error('Tagged widget cover is missing or its digest differs');
      widgetImagesChecked++;
    }
  }
  const manifest = { schemaVersion: 2, sourceMode: 'git-tag', sourceTag: source.sourceTag, sourceTagObject: source.sourceTagObject, commit: source.sourceCommit, tree: source.sourceTree,
    repositoryUrl: source.repositoryUrl, sourceBranch: source.sourceBranch, files: records, fileCount: records.length,
    validation: { lfsFilesVerified: lfs.size, widgetImagesChecked } };
  manifest.sourceIdentitySha256 = sha256(JSON.stringify(manifest));
  return manifest;
}

export async function createGitSourceManifest(repo, source) {
  return collectManifest(repo, source);
}

export function sourceReceipt(manifest) {
  if (manifest?.schemaVersion !== 2 || manifest.sourceMode !== 'git-tag' || !digestPattern.test(manifest.sourceIdentitySha256 ?? '')) throw Error('Expected a Git tag source manifest');
  return { sourceMode: manifest.sourceMode, sourceTag: manifest.sourceTag, sourceTagObject: manifest.sourceTagObject, sourceCommit: manifest.commit, sourceTree: manifest.tree, sourceIdentitySha256: manifest.sourceIdentitySha256 };
}

export function assertSourceReceipt(receipt, manifest) {
  for (const [key, expected] of Object.entries(sourceReceipt(manifest))) if (!receipt || receipt[key] !== expected) throw Error('Release receipt belongs to a different or legacy source identity');
}

export async function assertReleaseSource(config, { entrypoint, allowPrebuildChanges = false, requirePrepared = false, verifyRemote = true } = {}) {
  assertSourceFields(config);
  if (!Number.isSafeInteger(config.buildNumber) || config.buildNumber < 1) throw Error('Expected a positive build number');
  if (!path.isAbsolute(config.repo ?? '') || config.output !== path.join(config.repo, 'artifacts/ios-release', String(config.buildNumber))) throw Error('Release output must be this checkout\'s exact build number directory');
  const outputInfo = await lstat(config.output);
  if (!outputInfo.isDirectory() || outputInfo.isSymbolicLink() || await realpath(config.output) !== config.output) throw Error('Release output must be a real directory without symlink redirection');
  if (!digestPattern.test(config.sourceIdentitySha256 ?? '')) throw Error('Expected a fixed source identity digest');
  const manifest = JSON.parse(await readFile(path.join(config.output, 'source-manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 2 || manifest.sourceMode !== 'git-tag' || manifest.archiveSha256 !== undefined || manifest.sourceArchiveSha256 !== undefined || !Array.isArray(manifest.files) || manifest.fileCount !== manifest.files.length) throw Error('Expected a Git tag source manifest, not a legacy source archive');
  const paths = new Set();
  for (const record of manifest.files) {
    safeSourcePath(config.repo, record.path);
    const key = process.platform === 'win32' ? record.path.toLowerCase() : record.path;
    if (paths.has(key) || !Number.isSafeInteger(record.bytes) || record.bytes < 0 || !digestPattern.test(record.sha256 ?? '') || (record.gitLfsObject !== undefined && !digestPattern.test(record.gitLfsObject))) throw Error('Invalid or duplicate source manifest record');
    paths.add(key);
  }
  let executed;
  if (entrypoint instanceof URL || (typeof entrypoint === 'string' && entrypoint.startsWith('file:'))) executed = fileURLToPath(entrypoint);
  else executed = entrypoint;
  if (typeof executed !== 'string' || !path.isAbsolute(executed)) throw Error('Expected an absolute release entrypoint or file URL');
  const relativeEntrypoint = path.relative(config.repo, executed).split(path.sep).join('/');
  if (!relativeEntrypoint.startsWith('scripts/ios-release/') || !manifest.files.some(file => file.path === relativeEntrypoint) || await realpath(executed) !== executed) throw Error('Release entrypoint is not a tracked script in this checkout');
  const expected = await collectManifest(config.repo, config, { allowPrebuildChanges, verifyRemote });
  if (!isDeepStrictEqual(manifest, expected) || config.sourceIdentitySha256 !== expected.sourceIdentitySha256) throw Error('Source manifest differs from the actual tagged Git source identity');
  const releaseFile = 'store/ios/release-input.json';
  if (!manifest.files.some(file => file.path === releaseFile)) throw Error('Tagged release input is missing');
  const input = JSON.parse(await readFile(path.join(config.repo, releaseFile), 'utf8'));
  for (const key of ['version', 'buildNumber', 'appId', 'bundleIdentifier', 'appleTeamId']) if (input[key] === undefined || input[key] !== config[key]) throw Error(`Machine configuration differs from tagged release input: ${key}`);
  if (requirePrepared) {
    const prepared = JSON.parse(await readFile(path.join(config.output, 'source-post-prebuild.json'), 'utf8'));
    assertSourceReceipt(prepared, manifest);
    if (prepared.allBusinessSourceHashesVerified !== true) throw Error('Release source preparation has not been verified');
  }
  return { manifest, sourceIdentitySha256: manifest.sourceIdentitySha256 };
}
