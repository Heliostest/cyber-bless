import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { inspectToolchain, installLockedPods } from './dependencies.mjs';

const required = {
  node: '24.12.0', npm: '11.6.2', ruby: '3.2.0', cocoapods: '1.16.2', bundler: '2.4.1',
  xcode: '26.6', xcodeBuild: '17F113', sdk: '26.5', platform: 'darwin', arch: 'arm64',
  osVersion: '26.5.1', osBuild: '25F80',
};
const lock = 'PODS:\n  - Example (1.0.0)\n\nCOCOAPODS: 1.16.2\n';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
  const repo = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ios-release-dependencies-')));
  t.after(() => rm(repo, { recursive: true, force: true }));
  await mkdir(path.join(repo, 'store/ios'), { recursive: true });
  await mkdir(path.join(repo, 'apps/mobile-expo/ios'), { recursive: true });
  await mkdir(path.join(repo, 'output'));
  const release = { version: '1.0.0', buildNumber: 27, bundleIdentifier: 'com.example.app', appId: '123', appleTeamId: 'TEAM', toolchain: required };
  const config = { repo, output: path.join(repo, 'output'), version: '1.0.0', buildNumber: 27, bundleIdentifier: 'com.example.app', appId: '123', appleTeamId: 'TEAM', nodeBinary: '/tools/node/bin/node', rubyBinary: '/tools/ruby/bin/ruby', developerDir: '/tools/Xcode/Contents/Developer' };
  await writeFile(path.join(repo, 'store/ios/release-input.json'), JSON.stringify(release));
  await writeFile(path.join(repo, 'store/ios/Podfile.lock'), lock);
  await writeFile(path.join(repo, 'package-lock.json'), '{"lockfileVersion":3}\n');
  await writeFile(path.join(repo, 'Gemfile'), "source 'https://rubygems.org'\nruby '3.2.0'\ngem 'cocoapods', '= 1.16.2'\n");
  await writeFile(path.join(repo, 'Gemfile.lock'), 'GEM\n  specs:\n    cocoapods (1.16.2)\n\nBUNDLED WITH\n   2.4.1\n');
  return { repo, config, release };
}

function commands(config, overrides = {}) {
  const responses = new Map([
    ['node --version', 'v24.12.0\n'], ['npm --version', '11.6.2\n'],
    ['ruby --version', 'ruby 3.2.0 (2022-12-25 revision a528908271) [arm64-darwin25]\n'],
    ['bundle --version', 'Bundler version 2.4.1\n'], ['bundle exec pod --version', '1.16.2\n'],
    ['xcodebuild -version', 'Xcode 26.6\nBuild version 17F113\n'],
    ['xcrun --sdk iphoneos --show-sdk-version', '26.5\n'],
    ['uname -s', 'Darwin\n'], ['uname -m', 'arm64\n'],
    ['sw_vers -productVersion', '26.5.1\n'], ['sw_vers -buildVersion', '25F80\n'],
  ]);
  return async (command, args, options) => {
    assert.equal(options.env.DEVELOPER_DIR, config.developerDir);
    assert.equal(options.env.BUNDLE_GEMFILE, path.join(config.repo, 'Gemfile'));
    assert.equal(options.env.BUNDLE_FROZEN, 'true');
    const key = `${path.basename(command)} ${args.join(' ')}`;
    if (key in overrides) return { stdout: overrides[key] };
    if (!responses.has(key)) throw Error('Unexpected tool probe: ' + key);
    return { stdout: responses.get(key) };
  };
}

test('reports actual tool versions and hashes the fixed dependency inputs', async t => {
  const { config } = await fixture(t);
  const actual = await inspectToolchain(config, { run: commands(config) });
  for (const [key, value] of Object.entries(required)) assert.equal(actual[key], value);
  assert.equal(actual.podLockSha256, sha256(lock));
  assert.equal(actual.packageLockSha256, sha256('{"lockfileVersion":3}\n'));
  assert.match(actual.gemLockSha256, /^[a-f0-9]{64}$/);
});

test('rejects a probed tool version that differs from tracked requirements', async t => {
  const { config } = await fixture(t);
  await assert.rejects(inspectToolchain(config, { run: commands(config, { 'node --version': 'v24.13.0\n' }) }), /node.*24\.12\.0.*24\.13\.0/i);
});

test('rejects an unallocated tracked build number before installing dependencies', async t => {
  const { repo, config, release } = await fixture(t);
  await writeFile(path.join(repo, 'store/ios/release-input.json'), JSON.stringify({ ...release, buildNumber: null }));
  await assert.rejects(installLockedPods(config, { run: () => { throw Error('Should not run'); } }), /build number/i);
});

test('copies the tracked pod lock and installs with frozen bundle deployment', async t => {
  const { repo, config } = await fixture(t);
  await writeFile(path.join(repo, 'apps/mobile-expo/ios/Podfile.lock'), 'old generated lock');
  const actual = await installLockedPods(config, { run: async (command, args, options) => {
    assert.equal(path.basename(command), 'bundle');
    assert.deepEqual(args, ['exec', 'pod', 'install', '--deployment']);
    assert.equal(options.cwd, path.join(repo, 'apps/mobile-expo/ios'));
    assert.equal(options.env.BUNDLE_GEMFILE, path.join(repo, 'Gemfile'));
    assert.equal(options.env.BUNDLE_FROZEN, 'true');
    assert.equal(await readFile(path.join(options.cwd, 'Podfile.lock'), 'utf8'), lock);
    return { stdout: 'Pod installation complete!\n' };
  } });
  assert.equal(actual.podsInstalled, true);
  assert.equal(actual.podLockSha256, sha256(lock));
  assert.equal(await readFile(path.join(repo, 'store/ios/Podfile.lock'), 'utf8'), lock);
});

test('rejects a pod command that changes the lock without returning success', async t => {
  const { repo, config } = await fixture(t);
  let result;
  await assert.rejects(async () => {
    result = await installLockedPods(config, { run: async () => {
      await writeFile(path.join(repo, 'apps/mobile-expo/ios/Podfile.lock'), lock.replace('1.0.0', '2.0.0'));
      return { stdout: '' };
    } });
  }, /Podfile\.lock.*changed/i);
  assert.equal(result, undefined);
  assert.deepEqual(await readdir(config.output), []);
  assert.equal(await readFile(path.join(repo, 'store/ios/Podfile.lock'), 'utf8'), lock);
});

test('propagates pod installation failure without a success receipt', async t => {
  const { config } = await fixture(t);
  let result;
  await assert.rejects(async () => {
    result = await installLockedPods(config, { run: async () => { throw Error('pod exited 1'); } });
  }, /pod exited 1/);
  assert.equal(result, undefined);
  assert.deepEqual(await readdir(config.output), []);
});
