import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, realpath, rename, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkoutTagSource, resolveRemoteTag } from './git-source.mjs';

const exec = promisify(execFile);
const tag = 'ios/v1.0.0-build.19';
async function runCommand({ command, args, cwd, env }) {
  try { return { ...await exec(command, args, { cwd, env, encoding: 'utf8', windowsHide: true }), exitCode: 0 }; }
  catch (error) {
    if (typeof error.code !== 'number') throw error;
    return { stdout: error.stdout, stderr: error.stderr, exitCode: error.code };
  }
}
async function git(cwd, ...args) {
  return (await exec('git', args, { cwd, encoding: 'utf8', windowsHide: true })).stdout.trim();
}
async function fixture(t, { lfs = false } = {}) {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'wbr-git-source-test-')));
  t.after(() => rm(base, { recursive: true, force: true, maxRetries: 3 }));
  const work = path.join(base, 'work'), remote = path.join(base, 'remote.git');
  await mkdir(work);
  await git(work, 'init', '--initial-branch=master');
  await git(work, 'config', 'user.name', 'Release fixture');
  await git(work, 'config', 'user.email', 'release@example.invalid');
  await git(work, 'config', 'core.autocrlf', 'false');
  await writeFile(path.join(work, 'source.txt'), 'tagged source\n');
  if (lfs) {
    await git(work, 'lfs', 'install', '--local');
    await writeFile(path.join(work, '.gitattributes'), '*.bin filter=lfs diff=lfs merge=lfs -text\n');
    await writeFile(path.join(work, 'model.bin'), Buffer.from([0, 255, 17, 30, 91, 0]));
  }
  await git(work, 'add', '.');
  await git(work, 'commit', '-m', 'Release source');
  await git(work, 'tag', '-a', tag, '-m', 'Release candidate');
  await git(base, 'init', '--bare', remote);
  await git(work, 'remote', 'add', 'origin', remote);
  await git(work, 'push', 'origin', 'master', `refs/tags/${tag}`);
  return {
    base, work, repositoryUrl: remote, tag, buildRoot: path.join(base, 'builds'),
    sourceCommit: await git(work, 'rev-parse', 'HEAD'),
    sourceTagObject: await git(work, 'rev-parse', `refs/tags/${tag}`),
    sourceTree: await git(work, 'rev-parse', 'HEAD^{tree}'),
  };
}

test('resolves an advertised annotated tag to its commit and tree in remote master history', async t => {
  const f = await fixture(t);
  const result = await resolveRemoteTag(f);
  assert.deepEqual(result, {
    sourceMode: 'git-tag', sourceTag: tag, sourceTagObject: f.sourceTagObject,
    sourceCommit: f.sourceCommit, sourceTree: f.sourceTree,
    repositoryUrl: f.repositoryUrl, sourceBranch: 'master',
  });
});

test('rejects a local tag that has not been pushed and a lightweight remote tag', async t => {
  const f = await fixture(t);
  await git(f.work, 'tag', '-a', 'ios/not-pushed', '-m', 'Local only');
  await assert.rejects(resolveRemoteTag({ ...f, tag: 'ios/not-pushed' }), /remote.*tag|tag.*remote/i);
  await git(f.work, 'tag', 'ios/lightweight');
  await git(f.work, 'push', 'origin', 'refs/tags/ios/lightweight');
  await assert.rejects(resolveRemoteTag({ ...f, tag: 'ios/lightweight' }), /annotated/i);
});

test('rejects a tag pointing at a commit outside remote master', async t => {
  const f = await fixture(t);
  await git(f.work, 'checkout', '-b', 'unmerged');
  await writeFile(path.join(f.work, 'unmerged.txt'), 'not merged\n');
  await git(f.work, 'add', '.');
  await git(f.work, 'commit', '-m', 'Unmerged source');
  await git(f.work, 'tag', '-a', 'ios/unmerged', '-m', 'Not on master');
  await git(f.work, 'push', 'origin', 'refs/tags/ios/unmerged');
  await assert.rejects(resolveRemoteTag({ ...f, tag: 'ios/unmerged' }), /master|ancestor|history/i);
});

test('cannot waive master ancestry by selecting the unmerged remote feature branch', async t => {
  const f = await fixture(t);
  await git(f.work, 'checkout', '-b', 'not-merged');
  await writeFile(path.join(f.work, 'unmerged.txt'), 'only on feature branch\n');
  await git(f.work, 'add', '.');
  await git(f.work, 'commit', '-m', 'Unmerged release candidate');
  await git(f.work, 'tag', '-a', 'ios/not-merged', '-m', 'Not on master');
  await git(f.work, 'push', 'origin', 'not-merged', 'refs/tags/ios/not-merged');
  const source = { ...f, tag: 'ios/not-merged', branch: 'not-merged' };
  await assert.rejects(resolveRemoteTag(source), /master/i);
  await assert.rejects(checkoutTagSource(source), /master/i);
});

test('fails closed when the advertised tag moves while Git objects are fetched', async t => {
  const f = await fixture(t);
  let changed = false;
  const runner = async ({ command, args, cwd, env }) => {
    const result = await runCommand({ command, args, cwd, env });
    if (args.includes('ls-remote') && !changed) {
      changed = true;
      await git(f.work, 'tag', '-f', '-a', tag, '-m', 'Replaced annotation');
      await git(f.work, 'push', '--force', 'origin', `refs/tags/${tag}`);
    }
    return result;
  };
  await assert.rejects(resolveRemoteTag(f, { runner }), /moved|changed|mismatch/i);
});

test('rejects malformed refs and credential-bearing URLs before starting Git', async () => {
  for (const input of [
    { repositoryUrl: 'https://token@example.invalid/repo.git', tag },
    { repositoryUrl: 'https://example.invalid/repo.git?token=secret', tag },
    { repositoryUrl: 'https://example.invalid/repo.git', tag: '../outside' },
    { repositoryUrl: 'https://example.invalid/repo.git', tag: 'main^{commit}' },
    { repositoryUrl: 'https://example.invalid/repo.git', tag, branch: '-option' },
  ]) {
    let ran = false;
    await assert.rejects(resolveRemoteTag(input, { runner: async () => { ran = true; throw Error('Should not run'); } }));
    assert.equal(ran, false);
  }
});

test('creates a clean detached checkout and keeps a valid checkout when master advances', async t => {
  const f = await fixture(t);
  const first = await checkoutTagSource(f);
  assert.equal(first.repo, path.join(f.buildRoot, 'releases', 'tag-ios%2Fv1.0.0-build.19', 'source'));
  assert.equal(first.sourceCommit, f.sourceCommit);
  assert.equal(first.sourceTree, f.sourceTree);
  assert.equal(await readFile(path.join(first.repo, 'source.txt'), 'utf8'), 'tagged source\n');
  assert.equal(await git(first.repo, 'config', '--get', 'core.autocrlf'), 'false');
  await assert.rejects(git(first.repo, 'symbolic-ref', '-q', 'HEAD'));
  assert.equal(await git(first.repo, 'status', '--porcelain'), '');
  await writeFile(path.join(f.work, 'later.txt'), 'later master\n');
  await git(f.work, 'add', '.');
  await git(f.work, 'commit', '-m', 'Advance master');
  await git(f.work, 'push', 'origin', 'master');
  assert.deepEqual(await checkoutTagSource(f), first);
});

test('refuses dirty, staged, untracked or attached existing checkouts without resetting them', async t => {
  const f = await fixture(t);
  const { repo } = await checkoutTagSource(f);
  const source = path.join(repo, 'source.txt');
  await writeFile(source, 'uncommitted work\n');
  await assert.rejects(checkoutTagSource(f), /clean|dirty|uncommitted/i);
  assert.equal(await readFile(source, 'utf8'), 'uncommitted work\n');
  await git(repo, 'add', 'source.txt');
  await assert.rejects(checkoutTagSource(f), /clean|dirty|uncommitted/i);
  await git(repo, 'restore', '--staged', 'source.txt');
  await git(repo, 'restore', 'source.txt');
  await writeFile(path.join(repo, 'unknown.txt'), 'keep me');
  await assert.rejects(checkoutTagSource(f), /clean|untracked/i);
  assert.equal(await readFile(path.join(repo, 'unknown.txt'), 'utf8'), 'keep me');
  await rm(path.join(repo, 'unknown.txt'));
  await git(repo, 'checkout', '-b', 'local-work');
  await assert.rejects(checkoutTagSource(f), /detached/i);
  assert.equal(await git(repo, 'symbolic-ref', '--short', 'HEAD'), 'local-work');
});

test('refuses a moved tag when reusing the old release directory', async t => {
  const f = await fixture(t);
  const old = await checkoutTagSource(f);
  await git(f.work, 'tag', '-f', '-a', tag, '-m', 'Moved annotation');
  await git(f.work, 'push', '--force', 'origin', `refs/tags/${tag}`);
  await assert.rejects(checkoutTagSource(f), /moved|mismatch|identity/i);
  assert.equal(await git(old.repo, 'rev-parse', `refs/tags/${tag}`), f.sourceTagObject);
});

test('does not initialize or delete an existing unknown source directory', async t => {
  const f = await fixture(t);
  const unknown = path.join(f.buildRoot, 'releases', 'tag-ios%2Fv1.0.0-build.19', 'source');
  await mkdir(unknown, { recursive: true });
  await writeFile(path.join(unknown, 'keep.txt'), 'only copy');
  await assert.rejects(checkoutTagSource(f), /existing|checkout|Git/i);
  assert.equal(await readFile(path.join(unknown, 'keep.txt'), 'utf8'), 'only copy');
});

test('rejects linked build roots and linked release directories without following their targets', async t => {
  const f = await fixture(t);
  const outside = path.join(f.base, 'outside');
  await mkdir(outside);
  const linked = path.join(f.base, 'linked-builds');
  await symlink(outside, linked, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(checkoutTagSource({ ...f, buildRoot: linked }), /link|canonical/i);
  await mkdir(f.buildRoot);
  await symlink(outside, path.join(f.buildRoot, 'releases'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(checkoutTagSource(f), /link|canonical/i);
  await assert.rejects(readFile(path.join(outside, 'source', '.git', 'config')));
});

test('rejects a checkout whose Git object storage was replaced by a junction', async t => {
  const f = await fixture(t);
  const { repo } = await checkoutTagSource(f);
  const from = path.join(repo, '.git', 'objects'), to = path.join(f.base, 'outside-objects');
  assert.ok((await realpath(from)).startsWith(f.base + path.sep));
  assert.equal(path.dirname(to), f.base);
  await rename(from, to);
  await symlink(to, from, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(checkoutTagSource(f), /link|canonical/i);
  assert.equal(await realpath(from), to);
});

test('fetches and materializes real Git LFS objects from a local bare remote', async t => {
  const f = await fixture(t, { lfs: true });
  const result = await checkoutTagSource(f);
  assert.deepEqual(await readFile(path.join(result.repo, 'model.bin')), Buffer.from([0, 255, 17, 30, 91, 0]));
  assert.equal(await git(result.repo, 'status', '--porcelain'), '');
});

test('rejects a remote that is missing the release LFS object', async t => {
  const f = await fixture(t, { lfs: true });
  const objects = path.join(f.repositoryUrl, 'lfs');
  assert.ok((await realpath(objects)).startsWith(f.base + path.sep));
  await rm(objects, { recursive: true, force: true });
  await assert.rejects(checkoutTagSource(f), /LFS/i);
});

test('rejects tracked source symlinks before checking them out', async t => {
  const f = await fixture(t);
  const blob = await git(f.work, 'hash-object', '-w', 'source.txt');
  await git(f.work, 'update-index', '--add', '--cacheinfo', `120000,${blob},linked-source`);
  await git(f.work, 'commit', '-m', 'Linked source entry');
  await git(f.work, 'tag', '-a', 'ios/linked', '-m', 'Linked input');
  await git(f.work, 'push', 'origin', 'master', 'refs/tags/ios/linked');
  await assert.rejects(checkoutTagSource({ ...f, tag: 'ios/linked' }), /linked|submodule/i);
});

test('rejects LFS pointers and incorrect bytes even if an external LFS command reports success', async t => {
  const f = await fixture(t, { lfs: true });
  let mode = 'pointer';
  const runner = async ({ command, args, cwd, env }) => {
    if (args[0] === 'lfs' && ['fetch', 'checkout', 'fsck'].includes(args[1])) {
      if (args[1] === 'checkout' && mode === 'wrong') await writeFile(path.join(cwd, 'model.bin'), 'not the model');
      return { stdout: '', stderr: '', exitCode: 0 };
    }
    return runCommand({ command, args, cwd, env });
  };
  await assert.rejects(checkoutTagSource(f, { runner }), /pointer|LFS/i);
  mode = 'wrong';
  await assert.rejects(checkoutTagSource(f, { runner }), /LFS|hash|bytes/i);
});

test('the bootstrap rejects unsupported flags without accessing a repository', async () => {
  const cli = fileURLToPath(new URL('./checkout-tag.mjs', import.meta.url));
  await assert.rejects(exec(process.execPath, [cli, '--repository=https://token@example.invalid/a.git']), error => {
    assert.match(error.stderr, /Usage|Unsupported/i);
    assert.doesNotMatch(error.stderr, /token/);
    return true;
  });
});

test('the official bootstrap has no branch override option', async () => {
  const cli = fileURLToPath(new URL('./checkout-tag.mjs', import.meta.url));
  await assert.rejects(exec(process.execPath, [cli, `--tag=${tag}`, '--root=relative', '--branch=not-merged']), error => {
    assert.match(error.stderr, /Usage|Unsupported/i);
    return true;
  });
});

test('the official bootstrap rejects a second App root before creating it or starting Git', async t => {
  const base = await realpath(await mkdtemp(path.join(tmpdir(), 'wbr-bootstrap-root-test-')));
  t.after(() => rm(base, { recursive: true, force: true, maxRetries: 3 }));
  const root = path.join(base, 'another-app-root');
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'path') env[key] = '';
  const cli = fileURLToPath(new URL('./checkout-tag.mjs', import.meta.url));
  await assert.rejects(exec(process.execPath, [cli, `--tag=${tag}`, `--root=${root}`], { env }), error => {
    assert.match(error.stderr, /official|designated|App root/i);
    return true;
  });
  await assert.rejects(lstat(root), { code: 'ENOENT' });
});
