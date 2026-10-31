import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, access, rm, copyFile, realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import os from 'node:os';
import path from 'node:path';

async function temporary(t) {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'release-runner-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('a second release cannot enter while the first owns the app lock', async t => {
  const { withReleaseLock } = await import('./release-lock.mjs');
  const root = await temporary(t);
  let entered;
  const ready = new Promise(resolve => { entered = resolve; });
  let finish;
  const done = new Promise(resolve => { finish = resolve; });
  const first = withReleaseLock(root, async () => { entered(); await done; });
  await ready;
  await assert.rejects(withReleaseLock(root, async () => assert.fail('concurrent release entered')), /already|lock/i);
  finish();
  await first;
  await assert.rejects(access(path.join(root, '.release.lock')), { code: 'ENOENT' });
});

test('failed release stages release their own lock without erasing foreign ownership', async t => {
  const { withReleaseLock } = await import('./release-lock.mjs');
  const root = await temporary(t);
  await assert.rejects(withReleaseLock(root, async () => { throw Error('stage failed'); }), /stage failed/);
  await withReleaseLock(root, async () => {});
  await writeFile(path.join(root, '.release.lock'), 'foreign lock');
  await assert.rejects(withReleaseLock(root, async () => {}), /already|lock/i);
  assert.equal(await readFile(path.join(root, '.release.lock'), 'utf8'), 'foreign lock');
});

test('a child stage must prove ownership of the active app lock', async t => {
  const { withReleaseLock, assertReleaseLock } = await import('./release-lock.mjs');
  assert.equal(typeof assertReleaseLock, 'function');
  const root = await temporary(t);
  await assert.rejects(assertReleaseLock(root, {}), /lock|runner/i);
  await withReleaseLock(root, async lease => {
    await assert.rejects(assertReleaseLock(root, { WBR_RELEASE_LOCK_TOKEN: 'another-release' }), /lock|runner/i);
    await assertReleaseLock(root, { WBR_RELEASE_LOCK_TOKEN: lease.token });
  });
});

test('official app releases cannot select another root to evade the app lock', async () => {
  const { assertOfficialBuildRoot } = await import('./release-lock.mjs');
  assert.equal(typeof assertOfficialBuildRoot, 'function');
  assert.doesNotThrow(() => assertOfficialBuildRoot('/Users/heli/ios-builds/cyber-bless'));
  assert.throws(() => assertOfficialBuildRoot('/Users/heli/ios-builds/another-root'), /root/i);
});

test('release input must allocate a positive build number and match the selected app', async t => {
  const { readReleaseInput } = await import('./release-runner.mjs');
  const root = await temporary(t);
  await mkdir(path.join(root, 'store/ios'), { recursive: true });
  await mkdir(path.join(root, 'apps/mobile-expo'), { recursive: true });
  await writeFile(path.join(root, 'apps/mobile-expo/app.json'), JSON.stringify({ expo: { version: '1.0.0', ios: { bundleIdentifier: 'com.example.app', appleTeamId: 'TEAM' } } }));
  const input = { version: '1.0.0', buildNumber: null, bundleIdentifier: 'com.example.app', appleTeamId: 'TEAM', appId: '123', toolchain: {} };
  const file = path.join(root, 'store/ios/release-input.json');
  await writeFile(file, JSON.stringify(input));
  await assert.rejects(readReleaseInput(root), /build number/i);
  await writeFile(file, JSON.stringify({ ...input, buildNumber: 19 }));
  assert.equal((await readReleaseInput(root)).buildNumber, 19);
  await writeFile(file, JSON.stringify({ ...input, buildNumber: 19, version: '2.0.0' }));
  await assert.rejects(readReleaseInput(root), /identity|version/i);
});

test('a build request checks allocation before preparing and never uploads', async t => {
  const { runReleaseStage } = await import('./release-runner.mjs');
  const root = await temporary(t);
  await mkdir(path.join(root, 'source/scripts/ios-release'), { recursive: true });
  const config = { repo: path.join(root, 'source'), buildRoot: root, nodeBinary: process.execPath };
  const stages = [];
  await runReleaseStage(config, path.join(root, 'release-config.json'), 'build', {
    run: async (command, args) => { stages.push(path.basename(args[0]) + ':' + (args[2] ?? '')); },
  });
  assert.deepEqual(stages, ['asc.mjs:preflight', 'prepare-mac.mjs:', 'build-mac.mjs:', 'verify-mac.mjs:']);
});

test('a preparation failure prevents archive and upload commands', async t => {
  const { runReleaseStage } = await import('./release-runner.mjs');
  const root = await temporary(t);
  const config = { repo: root, buildRoot: root, nodeBinary: process.execPath };
  let calls = 0;
  await assert.rejects(runReleaseStage(config, path.join(root, 'config.json'), 'build', {
    run: async () => { calls++; if (calls === 2) throw Error('dependency installation failed'); },
  }), /dependency installation failed/);
  assert.equal(calls, 2);
});

test('rebuilding an old tag neither allocates a new number nor uploads', async t => {
  const { runReleaseStage } = await import('./release-runner.mjs');
  const root = await temporary(t);
  const calls = [];
  await runReleaseStage({ repo: root, buildRoot: root, nodeBinary: process.execPath, syncEasCounter: true }, path.join(root, 'config.json'), 'rebuild', {
    run: async (command, args) => { calls.push(path.basename(args[0])); },
  });
  assert.deepEqual(calls, ['prepare-mac.mjs', 'build-mac.mjs', 'verify-mac.mjs']);
});

test('mixed EAS builds install dependencies before checking the counter and before archive', async t => {
  const { runReleaseStage } = await import('./release-runner.mjs');
  const root = await temporary(t);
  const calls = [];
  await runReleaseStage({ repo: root, buildRoot: root, nodeBinary: process.execPath, syncEasCounter: true }, path.join(root, 'config.json'), 'build', {
    run: async (command, args) => { calls.push(path.basename(args[0])); },
  });
  assert.deepEqual(calls, ['asc.mjs', 'prepare-mac.mjs', 'counter.mjs', 'build-mac.mjs', 'verify-mac.mjs']);
});

test('a fresh checkout can load the real EAS context only after preparation installs its package', async t => {
  const { runReleaseStage } = await import('./release-runner.mjs');
  const root = await temporary(t);
  await mkdir(path.join(root, 'scripts'), { recursive: true });
  await mkdir(path.join(root, 'apps/mobile-expo'), { recursive: true });
  await writeFile(path.join(root, 'apps/mobile-expo/package.json'), '{}');
  await copyFile(new URL('../eas-project-context.mjs', import.meta.url), path.join(root, 'scripts/eas-project-context.mjs'));
  await runReleaseStage({ repo: root, buildRoot: root, nodeBinary: process.execPath, syncEasCounter: true }, path.join(root, 'config.json'), 'build', {
    run: async (command, args) => {
      if (path.basename(args[0]) === 'prepare-mac.mjs') {
        await mkdir(path.join(root, 'node_modules/eas-cli'), { recursive: true });
        await writeFile(path.join(root, 'node_modules/eas-cli/package.json'), '{"name":"eas-cli","version":"24.12.1"}');
      }
      if (path.basename(args[0]) === 'counter.mjs') await import(pathToFileURL(path.join(root, 'scripts/eas-project-context.mjs')));
    },
  });
  await access(path.join(root, 'node_modules/eas-cli/package.json'));
});

test('unsupported stages fail before touching the build directory', async () => {
  const { runReleaseStage } = await import('./release-runner.mjs');
  await assert.rejects(runReleaseStage({}, '/unused.json', 'publish'), /stage|Usage/i);
});
