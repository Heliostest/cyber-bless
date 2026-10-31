import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, mkdtemp, open, readdir, realpath, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const DEFAULT_REPOSITORY_URL = 'https://github.com/Heliostest/cyber-bless.git';
const oidPattern = /^[a-f0-9]{40}$/;

function validateRefName(value, label) {
  // Restrict to names, never rev expressions, options or glob patterns.
  if (typeof value !== 'string' || !value || value.startsWith('-') || value.startsWith('/') || value.endsWith('/') ||
      value.endsWith('.') || value.includes('..') || value.includes('@{') || /[\x00-\x20\x7f~^:?*\[\\]/.test(value) ||
      value.split('/').some(part => !part || part.startsWith('.') || part.endsWith('.lock'))) throw Error(`Invalid ${label} name`);
  return value;
}

function validateRepository(value) {
  if (typeof value !== 'string' || !value || /[\x00-\x20\x7f]/.test(value)) throw Error('Invalid repository URL');
  if (path.isAbsolute(value)) return path.resolve(value);
  let parsed;
  try { parsed = new URL(value); } catch { throw Error('Expected an HTTPS repository URL'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash)
    throw Error('Repository URL must be HTTPS and contain no credentials, query or fragment');
  return value;
}

function inputs({ repositoryUrl = DEFAULT_REPOSITORY_URL, tag, branch = 'master' }) {
  if (branch !== 'master') throw Error('Release source must belong to remote master; branch overrides are not allowed');
  return { repositoryUrl: validateRepository(repositoryUrl), tag: validateRefName(tag, 'tag'), branch: 'master' };
}

function gitEnvironment() {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_LFS_SKIP_SMUDGE: '1', GIT_LFS_SKIP_DOWNLOAD_ERRORS: '0' };
  for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR', 'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES']) delete env[name];
  return env;
}

async function defaultRunner({ command, args, cwd, env }) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const out = [], err = [];
    let length = 0;
    function collect(chunks, chunk) {
      length += chunk.length;
      if (length > 32 * 1024 * 1024) { child.kill(); reject(Error('Git output exceeded its limit')); }
      else chunks.push(chunk);
    }
    child.stdout.on('data', chunk => collect(out, chunk));
    child.stderr.on('data', chunk => collect(err, chunk));
    child.on('error', reject);
    child.on('close', exitCode => resolve({ stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8'), exitCode }));
  });
}

function commands(options = {}) {
  const runner = options.runner ?? defaultRunner;
  return async function git(cwd, args, label, allowed = [0]) {
    let result;
    try { result = await runner({ command: 'git', args, cwd, env: gitEnvironment() }); }
    catch { throw Error(`Git ${label} failed; command output withheld`); }
    const code = result?.exitCode ?? result?.code ?? 0;
    if (!allowed.includes(code) || typeof result?.stdout !== 'string') throw Error(`Git ${label} failed; command output withheld`);
    return { stdout: result.stdout, code };
  };
}

async function advertisedTag(input, git) {
  const ref = `refs/tags/${input.tag}`, branchRef = `refs/heads/${input.branch}`;
  const { stdout } = await git(undefined, ['ls-remote', '--exit-code', input.repositoryUrl, ref, `${ref}^{}`, branchRef], 'remote tag verification');
  const refs = new Map();
  for (const line of stdout.trim().split(/\r?\n/).filter(Boolean)) {
    const match = /^([a-f0-9]{40})\t(.+)$/.exec(line);
    if (!match || ![ref, `${ref}^{}`, branchRef].includes(match[2]) || refs.has(match[2])) throw Error('Unexpected remote ref listing');
    refs.set(match[2], match[1]);
  }
  if (!refs.has(ref)) throw Error('Release tag is missing from the remote repository');
  if (!refs.has(`${ref}^{}`)) throw Error('Release requires an annotated remote tag');
  if (!refs.has(branchRef)) throw Error('Release source branch is missing from the remote repository');
  return { tagObject: refs.get(ref), commit: refs.get(`${ref}^{}`), branchCommit: refs.get(branchRef) };
}

async function fetchTag(repo, input, git, { bare = false } = {}) {
  const branchRef = bare ? `refs/heads/${input.branch}` : `refs/remotes/origin/${input.branch}`;
  await git(repo, ['fetch', '--no-tags', '--no-write-fetch-head', input.repositoryUrl,
    `refs/tags/${input.tag}:refs/tags/${input.tag}`, `refs/heads/${input.branch}:${branchRef}`], 'release tag fetch');
}

async function fetchedIdentity(repo, input, advertised, git, { bare = false } = {}) {
  async function text(args, label) { return (await git(repo, args, label)).stdout.trim(); }
  const ref = `refs/tags/${input.tag}`;
  const tagObject = await text(['rev-parse', '--verify', ref], 'tag object resolution');
  if (tagObject !== advertised.tagObject) throw Error('Remote release tag moved or its object identity changed');
  if (await text(['cat-file', '-t', tagObject], 'tag object type check') !== 'tag') throw Error('Release requires an annotated tag object');
  const commit = await text(['rev-parse', '--verify', `${ref}^{commit}`], 'tag commit resolution');
  if (commit !== advertised.commit || !oidPattern.test(commit)) throw Error('Remote release tag commit mismatch');
  const branchRef = bare ? `refs/heads/${input.branch}` : `refs/remotes/origin/${input.branch}`;
  const branchCommit = await text(['rev-parse', '--verify', branchRef], 'source branch resolution');
  if (branchCommit !== advertised.branchCommit) throw Error('Remote source branch changed during fetch; retry verification');
  const ancestor = await git(repo, ['merge-base', '--is-ancestor', commit, branchRef], `${input.branch} history check`, [0, 1]);
  if (ancestor.code !== 0) throw Error(`Release commit is not in remote ${input.branch} history`);
  const sourceTree = await text(['rev-parse', '--verify', `${commit}^{tree}`], 'source tree resolution');
  if (!oidPattern.test(sourceTree)) throw Error('Invalid release source tree identity');
  return {
    sourceMode: 'git-tag', sourceTag: input.tag, sourceTagObject: tagObject,
    sourceCommit: commit, sourceTree, repositoryUrl: input.repositoryUrl, sourceBranch: input.branch,
  };
}

async function assertRemoteUnchanged(input, advertised, git) {
  const current = await advertisedTag(input, git);
  if (current.tagObject !== advertised.tagObject || current.commit !== advertised.commit || current.branchCommit !== advertised.branchCommit)
    throw Error('Remote tag or source branch changed during source verification');
}

async function optionalStat(file) {
  try { return await lstat(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function inside(parent, file) {
  const relative = path.relative(parent, file);
  return relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

// Check every existing path component; realpath alone can silently accept links
// whose targets happen to resolve inside the intended root.
async function safeDirectory(directory, { create = false } = {}) {
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw Error('Build directory must be an absolute path');
  const absolute = path.resolve(directory), volume = path.parse(absolute).root;
  if (absolute === volume) throw Error('A filesystem root is not a release build directory');
  let current = volume;
  for (const part of absolute.slice(volume.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let info = await optionalStat(current);
    if (!info && create) {
      try { await mkdir(current); } catch (error) { if (error.code !== 'EEXIST') throw error; }
      info = await lstat(current);
    }
    if (!info || !info.isDirectory() || info.isSymbolicLink()) throw Error('Release path is missing, linked or not a directory');
    if (await realpath(current) !== current) throw Error('Release path is not canonical or contains a link');
  }
  return absolute;
}

export async function ensureBuildRoot(buildRoot) {
  return safeDirectory(buildRoot, { create: true });
}

export async function resolveRemoteTag(source, options = {}) {
  const input = inputs(source), git = commands(options);
  const advertised = await advertisedTag(input, git);
  const temporaryRoot = await realpath(tmpdir());
  const temporary = await mkdtemp(path.join(temporaryRoot, 'wbr-release-tag-'));
  try {
    await git(temporary, ['init', '--bare', '--template='], 'temporary repository initialization');
    await fetchTag(temporary, input, git, { bare: true });
    const identity = await fetchedIdentity(temporary, input, advertised, git, { bare: true });
    await assertRemoteUnchanged(input, advertised, git);
    return identity;
  } finally {
    // This exact directory was created by this invocation. Never remove an
    // existing checkout or follow a replacement link during cleanup.
    if (inside(temporaryRoot, temporary) && !(await lstat(temporary)).isSymbolicLink() && await realpath(temporary) === temporary)
      await rm(temporary, { recursive: true, force: true, maxRetries: 3 });
  }
}

async function assertCleanCheckout(repo, input, advertised, git) {
  await safeDirectory(repo);
  const metadata = await optionalStat(path.join(repo, '.git'));
  if (!metadata?.isDirectory() || metadata.isSymbolicLink()) throw Error('Existing source directory is not a regular Git checkout');
  await safeDirectory(path.join(repo, '.git'));
  async function checkMetadata(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name), info = await lstat(file);
      if (info.isSymbolicLink() || await realpath(file) !== file) throw Error('Git metadata contains a link or noncanonical path');
      if (info.isDirectory()) await checkMetadata(file);
      else if (!info.isFile()) throw Error('Git metadata contains an unsupported entry');
    }
  }
  await checkMetadata(path.join(repo, '.git'));
  if (await optionalStat(path.join(repo, '.git', 'commondir')) || await optionalStat(path.join(repo, '.git', 'objects', 'info', 'alternates')))
    throw Error('Existing checkout uses external Git object storage');
  const top = (await git(repo, ['rev-parse', '--show-toplevel'], 'checkout root check')).stdout.trim();
  if (await realpath(top) !== repo) throw Error('Existing checkout has a different Git root');
  const remote = (await git(repo, ['remote', 'get-url', 'origin'], 'checkout origin check')).stdout.trim();
  if (remote !== input.repositoryUrl) throw Error('Existing checkout repository identity mismatch');
  const localTag = (await git(repo, ['rev-parse', '--verify', `refs/tags/${input.tag}`], 'existing tag check')).stdout.trim();
  const head = (await git(repo, ['rev-parse', '--verify', 'HEAD'], 'existing HEAD check')).stdout.trim();
  if (localTag !== advertised.tagObject || head !== advertised.commit) throw Error('Existing release tag moved or checkout identity mismatch');
  const attached = await git(repo, ['symbolic-ref', '-q', 'HEAD'], 'detached checkout check', [0, 1]);
  if (attached.code !== 1) throw Error('Release source checkout must remain detached');
  if ((await git(repo, ['config', '--get', 'core.autocrlf'], 'checkout newline policy')).stdout.trim() !== 'false') throw Error('Existing checkout newline policy mismatch');
  if ((await git(repo, ['config', '--local', '--get', 'lfs.storage'], 'checkout LFS storage policy')).stdout.trim() !== path.join(repo, '.git', 'lfs'))
    throw Error('Existing checkout LFS storage identity mismatch');
  if ((await git(repo, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], 'clean source check')).stdout)
    throw Error('Release checkout must be clean: uncommitted or untracked inputs found');
}

async function rejectLinkedGitEntries(repo, commit, git) {
  const { stdout } = await git(repo, ['ls-tree', '-r', '-z', '--full-tree', commit], 'source entry validation');
  for (const entry of stdout.split('\0').filter(Boolean)) {
    const match = /^(\d+) (\w+) ([a-f0-9]{40})\t([\s\S]+)$/.exec(entry);
    if (!match || match[2] !== 'blob' || !['100644', '100755'].includes(match[1])) throw Error('Release source contains a linked file, submodule or unsupported Git entry');
    const relative = match[4];
    if (relative.includes('\\') || path.posix.isAbsolute(relative) || relative.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Unsafe release source path');
  }
}

async function checkLfsBytes(repo, git) {
  const { stdout } = await git(repo, ['lfs', 'ls-files', '--json'], 'LFS source inventory');
  let records;
  try { const value = JSON.parse(stdout).files; records = value === null ? [] : value; } catch { throw Error('Invalid Git LFS inventory'); }
  if (!Array.isArray(records)) throw Error('Invalid Git LFS inventory');
  for (const record of records) {
    if (typeof record.name !== 'string' || record.name.includes('\\') || path.posix.isAbsolute(record.name) ||
        record.name.split('/').some(part => !part || part === '.' || part === '..') ||
        !/^[a-f0-9]{64}$/.test(record.oid ?? '') || !Number.isSafeInteger(record.size) || record.size < 0) throw Error('Invalid Git LFS object record');
    const file = path.resolve(repo, record.name);
    if (!inside(repo, file)) throw Error('LFS source escaped its checkout');
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink() || await realpath(file) !== file) throw Error('LFS source is missing or linked');
    const handle = await open(file, 'r'), prefixBytes = Buffer.alloc(200);
    let prefixLength;
    try { ({ bytesRead: prefixLength } = await handle.read(prefixBytes, 0, prefixBytes.length, 0)); }
    finally { await handle.close(); }
    const prefix = prefixBytes.subarray(0, prefixLength).toString('utf8');
    if (prefix.startsWith('version https://git-lfs.github.com/spec/v1')) throw Error('Unexpanded Git LFS pointer in release source');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    if (info.size !== record.size || hash.digest('hex') !== record.oid) throw Error('Git LFS source bytes or hash mismatch');
  }
}

export async function checkoutTagSource(source, options = {}) {
  const input = inputs(source), git = commands(options);
  const advertised = await advertisedTag(input, git);
  const buildRoot = await ensureBuildRoot(source.buildRoot);
  const releaseDirectory = path.join(buildRoot, 'releases', `tag-${encodeURIComponent(input.tag)}`);
  await safeDirectory(releaseDirectory, { create: true });
  const repo = path.join(releaseDirectory, 'source');
  const existing = await optionalStat(repo);
  if (existing) await assertCleanCheckout(repo, input, advertised, git);
  else {
    await mkdir(repo);
    await safeDirectory(repo);
    await git(repo, ['init', '--template='], 'release checkout initialization');
    await git(repo, ['config', '--local', 'core.autocrlf', 'false'], 'checkout newline configuration');
    await git(repo, ['remote', 'add', 'origin', input.repositoryUrl], 'checkout origin configuration');
    await git(repo, ['config', '--local', 'lfs.storage', path.join(repo, '.git', 'lfs')], 'checkout LFS storage configuration');
    await git(repo, ['lfs', 'install', '--local', '--skip-smudge'], 'Git LFS availability/configuration');
  }
  await safeDirectory(repo);
  await fetchTag(repo, input, git);
  const identity = await fetchedIdentity(repo, input, advertised, git);
  await rejectLinkedGitEntries(repo, identity.sourceCommit, git);
  if (!existing) await git(repo, ['checkout', '--detach', identity.sourceCommit], 'detached source checkout');
  await assertCleanCheckout(repo, input, advertised, git);
  await git(repo, ['lfs', 'fetch', '--include=*', '--exclude=', 'origin', identity.sourceCommit], 'LFS object fetch');
  await git(repo, ['lfs', 'checkout'], 'LFS object checkout');
  await git(repo, ['lfs', 'fsck', '--objects', '--pointers', identity.sourceCommit], 'LFS object verification');
  await checkLfsBytes(repo, git);
  await assertCleanCheckout(repo, input, advertised, git);
  await assertRemoteUnchanged(input, advertised, git);
  return { ...identity, repo, buildRoot };
}
