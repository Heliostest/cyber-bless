import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, rename, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const api = await import('./source-identity.mjs').catch(error => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return {};
});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }).trim();
}
async function fixture(t, { lfs = false, widgets = false, tagBranch = 'master' } = {}) {
  const testRoot = fileURLToPath(new URL('../../artifacts/', import.meta.url));
  await mkdir(testRoot, { recursive: true });
  const base = await mkdtemp(path.join(testRoot, 'source-identity-test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const repo = path.join(base, 'repo'), remote = path.join(base, 'origin.git');
  await mkdir(repo);
  git(base, 'init', '--bare', remote);
  git(repo, 'init', '--initial-branch=master');
  git(repo, 'config', 'user.name', 'Release Test');
  git(repo, 'config', 'user.email', 'release-test@example.invalid');
  git(repo, 'config', 'core.autocrlf', 'false');
  git(repo, 'remote', 'add', 'origin', remote);
  await mkdir(path.join(repo, 'scripts/ios-release'), { recursive: true });
  await mkdir(path.join(repo, 'apps/mobile-expo'), { recursive: true });
  await writeFile(path.join(repo, '.gitignore'), 'artifacts/\nnode_modules/\napps/mobile-expo/ios/\n');
  await writeFile(path.join(repo, 'scripts/ios-release/build-mac.mjs'), 'export const release = true;\n');
  await writeFile(path.join(repo, 'source.txt'), 'the tagged business source\n');
  await writeFile(path.join(repo, 'apps/mobile-expo/package.json'), JSON.stringify({ scripts: { ios: 'expo start --ios', android: 'expo start --android', start: 'expo start' } }) + '\n');
  const releaseInput = { version: '1.0.0', buildNumber: 19, appId: '123', bundleIdentifier: 'com.example.release', appleTeamId: 'TEAM' };
  await mkdir(path.join(repo, 'store/ios'), { recursive: true });
  await writeFile(path.join(repo, 'store/ios/release-input.json'), JSON.stringify(releaseInput));
  if (widgets) {
    await mkdir(path.join(repo, 'assets/widgets/today'), { recursive: true });
    const scene = { id: 'woodfish' };
    for (const size of ['small', 'medium', 'large']) {
      const file = `woodfish-${size}.png`, bytes = Buffer.from(`cover ${size}`);
      await writeFile(path.join(repo, 'assets/widgets/today', file), bytes);
      scene[size] = { file, sha256: hash(bytes) };
    }
    await writeFile(path.join(repo, 'assets/widgets/today/manifest.json'), JSON.stringify({ scenes: [scene] }));
  }
  if (lfs) {
    git(repo, 'lfs', 'install', '--local');
    await writeFile(path.join(repo, '.gitattributes'), '*.bin filter=lfs diff=lfs merge=lfs -text\n');
    await writeFile(path.join(repo, 'asset.bin'), Buffer.from('materialized release asset\n'));
  }
  git(repo, 'add', '.');
  git(repo, 'commit', '-m', 'Release inputs');
  if (tagBranch !== 'master') {
    git(repo, 'checkout', '-b', tagBranch);
    await writeFile(path.join(repo, 'source.txt'), 'unmerged branch source\n');
    git(repo, 'commit', '-am', 'Unmerged release branch');
  }
  git(repo, 'tag', '-a', 'ios/v1.0.0-build.19', '-m', 'Release 19');
  git(repo, 'push', '-u', 'origin', 'master', ...(tagBranch === 'master' ? [] : [tagBranch]), 'refs/tags/ios/v1.0.0-build.19');
  const source = { sourceMode: 'git-tag', repositoryUrl: remote, sourceBranch: tagBranch, sourceTag: 'ios/v1.0.0-build.19', sourceTagObject: git(repo, 'rev-parse', 'refs/tags/ios/v1.0.0-build.19'), sourceCommit: git(repo, 'rev-parse', 'HEAD'), sourceTree: git(repo, 'rev-parse', 'HEAD^{tree}') };
  const output = path.join(repo, 'artifacts/ios-release/19');
  await mkdir(output, { recursive: true });
  const config = { repo, output, ...source, ...releaseInput };
  const entrypoint = pathToFileURL(path.join(repo, 'scripts/ios-release/build-mac.mjs'));
  async function freeze() {
    assert.equal(typeof api.createGitSourceManifest, 'function', 'Git tag source manifest implementation is required');
    const manifest = await api.createGitSourceManifest(repo, source);
    config.sourceIdentitySha256 = manifest.sourceIdentitySha256;
    await writeFile(path.join(output, 'source-manifest.json'), JSON.stringify(manifest));
    return manifest;
  }
  return { repo, remote, source, config, output, entrypoint, freeze };
}

test('a manifest binds real tracked tag files rather than ignored generated output', async t => {
  const f = await fixture(t);
  await mkdir(path.join(f.repo, 'node_modules'));
  await writeFile(path.join(f.repo, 'node_modules/ignored.txt'), 'generated');
  const manifest = await f.freeze();
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.sourceMode, 'git-tag');
  assert.equal(manifest.commit, f.source.sourceCommit);
  assert.equal(manifest.tree, f.source.sourceTree);
  assert.equal(manifest.files.length, 5);
  assert.equal(manifest.files.find(file => file.path === 'source.txt').sha256, hash('the tagged business source\n'));
  assert.match(manifest.sourceIdentitySha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(manifest.validation, { lfsFilesVerified: 0, widgetImagesChecked: 0 });
  assert.equal((await api.assertReleaseSource(f.config, { entrypoint: f.entrypoint })).sourceIdentitySha256, manifest.sourceIdentitySha256);
});

for (const mode of ['unstaged', 'staged', 'untracked']) test(`freezing rejects ${mode} release inputs`, async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.repo, mode === 'untracked' ? 'new.txt' : 'source.txt'), 'changed');
  if (mode === 'staged') git(f.repo, 'add', 'source.txt');
  await assert.rejects(f.freeze(), /dirty|untracked|modified|clean/i);
});

test('HEAD, tag object, commit, tree and origin are checked against Git', async t => {
  const f = await fixture(t);
  for (const change of [{ sourceCommit: '1'.repeat(40) }, { sourceTree: '2'.repeat(40) }, { sourceTagObject: '3'.repeat(40) }, { repositoryUrl: path.join(f.repo, 'wrong.git') }]) {
    await assert.rejects(api.createGitSourceManifest(f.repo, { ...f.source, ...change }));
  }
  git(f.repo, 'commit', '--allow-empty', '-m', 'Another commit');
  await assert.rejects(api.createGitSourceManifest(f.repo, f.source), /HEAD|commit|tag/i);
});

test('an unmerged tag cannot substitute its own branch for the required master branch', async t => {
  const f = await fixture(t, { tagBranch: 'notmastertag' });
  await assert.rejects(f.freeze(), /master/i);
  await assert.rejects(api.createGitSourceManifest(f.repo, { ...f.source, sourceBranch: 'master' }));
});

test('release outputs must use this checkout and its exact positive build number directory', async t => {
  const f = await fixture(t), manifest = await f.freeze();
  for (const output of [path.join(f.repo, '../outside-release'), path.join(f.repo, 'artifacts/wrong-output'), path.join(f.repo, 'artifacts/ios-release/20')]) {
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, 'source-manifest.json'), JSON.stringify(manifest));
    await assert.rejects(api.assertReleaseSource({ ...f.config, output }, { entrypoint: f.entrypoint }), /output/i);
  }
  for (const buildNumber of [undefined, '19', 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(api.assertReleaseSource({ ...f.config, buildNumber }, { entrypoint: f.entrypoint }), /positive|build number|output/i);
  }
});

test('release output symlinks and junctions cannot redirect valid receipts outside their path', async t => {
  const f = await fixture(t);
  await f.freeze();
  const target = path.join(f.repo, '../redirected-output');
  await rename(f.output, target);
  await symlink(target, f.output, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint }), /output|symlink/i);
});

test('Git subprocesses ignore inherited repository, index, object and config redirections', async t => {
  const f = await fixture(t);
  await f.freeze();
  const invalid = path.join(f.repo, 'artifacts/not-the-release-git-directory');
  const overrides = {
    GIT_DIR: invalid, GIT_WORK_TREE: invalid, GIT_INDEX_FILE: invalid, GIT_COMMON_DIR: invalid,
    GIT_OBJECT_DIRECTORY: invalid, GIT_ALTERNATE_OBJECT_DIRECTORIES: invalid, GIT_NAMESPACE: 'wrong-namespace',
    GIT_CONFIG: invalid, GIT_CONFIG_GLOBAL: invalid, GIT_CONFIG_SYSTEM: invalid,
    GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.worktree', GIT_CONFIG_VALUE_0: invalid,
    GIT_CONFIG_PARAMETERS: "'core.worktree'='invalid'", GIT_SHALLOW_FILE: invalid,
  };
  const previous = new Map(Object.keys(overrides).map(key => [key, process.env[key]]));
  try {
    Object.assign(process.env, overrides);
    await assert.doesNotReject(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint }));
  } finally {
    for (const [key, value] of previous) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test('a moved or missing remote tag is rejected even when the local tag is unchanged', async t => {
  const f = await fixture(t);
  await f.freeze();
  git(f.repo, 'push', 'origin', ':refs/tags/ios/v1.0.0-build.19');
  await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint }), /remote|tag/i);
  await assert.doesNotReject(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint, verifyRemote: false }));
  git(f.remote, 'update-ref', 'refs/tags/ios/v1.0.0-build.19', f.source.sourceCommit);
  await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint }), /remote|tag/i);
});

test('changed source and changed publishing scripts are rejected after preparation', async t => {
  const f = await fixture(t);
  await f.freeze();
  for (const file of ['source.txt', 'scripts/ios-release/build-mac.mjs']) {
    const absolute = path.join(f.repo, file), original = await readFile(absolute);
    await writeFile(absolute, 'tampered after prepare\n');
    await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint }), /source|dirty|modified|hash/i);
    await writeFile(absolute, original);
  }
});

test('manifest edits cannot make changed files or a reduced file list appear authentic', async t => {
  const f = await fixture(t), manifest = await f.freeze();
  for (const altered of [
    { ...manifest, files: manifest.files.slice(1), fileCount: manifest.fileCount - 1 },
    { ...manifest, files: [...manifest.files, manifest.files[0]], fileCount: manifest.fileCount + 1 },
    { ...manifest, files: [{ ...manifest.files[0], path: '../escape' }, ...manifest.files.slice(1)] },
    { ...manifest, files: manifest.files.map(file => file.path === 'source.txt' ? { ...file, sha256: 'a'.repeat(64) } : file) },
    { ...manifest, sourceIdentitySha256: 'b'.repeat(64) },
  ]) {
    await writeFile(path.join(f.output, 'source-manifest.json'), JSON.stringify(altered));
    await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint }));
  }
  await writeFile(path.join(f.repo, 'source.txt'), 'forged input');
  const forged = { ...manifest, files: manifest.files.map(file => file.path === 'source.txt' ? { ...file, bytes: 12, sha256: hash('forged input') } : file) };
  await writeFile(path.join(f.output, 'source-manifest.json'), JSON.stringify(forged));
  await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint }));
});

test('a Git assume-unchanged flag cannot hide bytes that differ from the tagged blob', async t => {
  const f = await fixture(t);
  await f.freeze();
  git(f.repo, 'update-index', '--assume-unchanged', 'source.txt');
  await writeFile(path.join(f.repo, 'source.txt'), 'hidden changed source\n');
  assert.equal(git(f.repo, 'diff', '--name-only'), '');
  await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint }), /tagged Git blob/);
});

test('staging an otherwise permitted prebuild change is rejected', async t => {
  const f = await fixture(t);
  await f.freeze();
  const file = path.join(f.repo, 'apps/mobile-expo/package.json');
  const generated = JSON.parse(await readFile(file, 'utf8'));
  generated.scripts.ios = 'expo run:ios';
  await writeFile(file, JSON.stringify(generated));
  git(f.repo, 'add', 'apps/mobile-expo/package.json');
  await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint, allowPrebuildChanges: true }), /index.*dirty/i);
});

test('entrypoints must be actual tracked files inside this release checkout', async t => {
  const f = await fixture(t);
  await f.freeze();
  for (const entrypoint of [path.join(f.repo, 'source.txt'), path.join(f.repo, 'scripts/ios-release/not-tracked.mjs'), path.join(f.repo, '../build-mac.mjs'), 'scripts/ios-release/build-mac.mjs']) {
    await assert.rejects(api.assertReleaseSource(f.config, { entrypoint }));
  }
});

test('prebuild permits only the two recognized launch-script replacements', async t => {
  const f = await fixture(t), manifest = await f.freeze();
  const file = path.join(f.repo, 'apps/mobile-expo/package.json'), original = JSON.parse(await readFile(file, 'utf8'));
  const generated = structuredClone(original);
  generated.scripts.ios = 'expo run:ios'; generated.scripts.android = 'expo run:android';
  await writeFile(file, JSON.stringify(generated));
  await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint }));
  await assert.doesNotReject(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint, allowPrebuildChanges: true }));
  generated.scripts.start = 'unreviewed command';
  await writeFile(file, JSON.stringify(generated));
  await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint, allowPrebuildChanges: true }));
  assert.equal(api.onlyPrebuildScriptChanges(original, { ...original, scripts: { ...original.scripts, ios: 'expo run:ios' } }), true);
  assert.equal(api.onlyPrebuildScriptChanges(original, generated), false);
  assert.equal(manifest.commit, f.source.sourceCommit);
});

test('prepared receipts and downstream receipts must belong to the same source identity', async t => {
  const f = await fixture(t), manifest = await f.freeze(), receipt = api.sourceReceipt(manifest);
  assert.deepEqual(receipt, { sourceMode: 'git-tag', sourceTag: f.source.sourceTag, sourceTagObject: f.source.sourceTagObject, sourceCommit: f.source.sourceCommit, sourceTree: f.source.sourceTree, sourceIdentitySha256: manifest.sourceIdentitySha256 });
  api.assertSourceReceipt(receipt, manifest);
  for (const invalid of [{ sourceCommit: manifest.commit }, { ...receipt, sourceIdentitySha256: '0'.repeat(64) }, { ...receipt, sourceCommit: '1'.repeat(40) }]) assert.throws(() => api.assertSourceReceipt(invalid, manifest));
  await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint, requirePrepared: true }));
  for (const prepared of [{ ...receipt, allBusinessSourceHashesVerified: false }, { ...receipt, sourceCommit: '1'.repeat(40), allBusinessSourceHashesVerified: true }]) {
    await writeFile(path.join(f.output, 'source-post-prebuild.json'), JSON.stringify(prepared));
    await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint, requirePrepared: true }));
  }
  await writeFile(path.join(f.output, 'source-post-prebuild.json'), JSON.stringify({ ...receipt, allBusinessSourceHashesVerified: true }));
  await assert.doesNotReject(api.assertReleaseSource({ ...f.config, sourceIdentitySha256: manifest.sourceIdentitySha256 }, { entrypoint: f.entrypoint, requirePrepared: true }));
  await assert.rejects(api.assertReleaseSource({ ...f.config, sourceIdentitySha256: '0'.repeat(64) }, { entrypoint: f.entrypoint }));
});

test('legacy archives cannot be substituted for a Git source identity', async t => {
  const f = await fixture(t);
  await f.freeze();
  await assert.rejects(api.assertReleaseSource({ ...f.config, sourceTag: undefined, sourceArchiveSha256: '0'.repeat(64) }, { entrypoint: f.entrypoint }));
  await writeFile(path.join(f.output, 'source-manifest.json'), JSON.stringify({ schemaVersion: 1, commit: f.source.sourceCommit, archiveSha256: '0'.repeat(64), files: [] }));
  await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint }));
});

test('a machine configuration cannot override the tagged release identity', async t => {
  const f = await fixture(t);
  await f.freeze();
  for (const change of [{ version: '2.0.0' }, { buildNumber: 20 }, { appId: '456' }, { bundleIdentifier: 'com.other' }, { appleTeamId: 'OTHER' }, { sourceIdentitySha256: undefined }]) {
    await assert.rejects(api.assertReleaseSource({ ...f.config, ...change }, { entrypoint: f.entrypoint }));
  }
});

test('real widget resources are counted and verified against the tagged cover manifest', async t => {
  const f = await fixture(t, { widgets: true }), manifest = await f.freeze();
  assert.equal(manifest.validation.widgetImagesChecked, 3);
  await writeFile(path.join(f.repo, 'assets/widgets/today/woodfish-small.png'), 'wrong cover');
  await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint }));
});

test('LFS entities must be materialized and match the tagged object digest', async t => {
  const f = await fixture(t, { lfs: true }), manifest = await f.freeze();
  const bytes = Buffer.from('materialized release asset\n');
  assert.equal(manifest.validation.lfsFilesVerified, 1);
  assert.equal(manifest.files.find(file => file.path === 'asset.bin').gitLfsObject, hash(bytes));
  await writeFile(path.join(f.repo, 'asset.bin'), git(f.repo, 'show', `${f.source.sourceCommit}:asset.bin`) + '\n');
  await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint }), /LFS|pointer/i);
  await writeFile(path.join(f.repo, 'asset.bin'), 'corrupt LFS entity');
  await assert.rejects(api.assertReleaseSource(f.config, { entrypoint: f.entrypoint }), /LFS|source|dirty|modified/i);
});
