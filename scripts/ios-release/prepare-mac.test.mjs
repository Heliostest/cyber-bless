import test from 'node:test';
import assert from 'node:assert/strict';

const valid = () => ({
  sourceMode: 'git-tag', sourceTag: 'ios/v1.0.0-build.19', sourceTagObject: '1'.repeat(40),
  sourceCommit: '2'.repeat(40), sourceTree: '3'.repeat(40), sourceIdentitySha256: '4'.repeat(64),
  repo: '/Users/heli/ios-builds/cyber-bless/releases/tag-example/source',
  buildRoot: '/Users/heli/ios-builds/cyber-bless', buildNumber: 19,
  output: '/Users/heli/ios-builds/cyber-bless/releases/tag-example/source/artifacts/ios-release/19',
  nodeBinary: '/Users/heli/node/bin/node', rubyBinary: '/Users/heli/ruby/bin/ruby',
  developerDir: '/Applications/Xcode.app/Contents/Developer',
});

test('official preparation refuses old dirty-worktree archive configurations', async () => {
  const { validateGitPreparation } = await import('./prepare-mac.mjs');
  assert.equal(typeof validateGitPreparation, 'function');
  assert.throws(() => validateGitPreparation({ ...valid(), sourceMode: undefined, sourceArchiveSha256: '5'.repeat(64) }), /tag/i);
});

test('preparation requires a complete immutable source identity before any commands', async () => {
  const { validateGitPreparation } = await import('./prepare-mac.mjs');
  assert.equal(typeof validateGitPreparation, 'function');
  for (const field of ['sourceTag', 'sourceTagObject', 'sourceCommit', 'sourceTree', 'sourceIdentitySha256']) {
    const config = valid(); delete config[field];
    assert.throws(() => validateGitPreparation(config), /source|tag|identity/i);
  }
});

test('release output cannot target another checkout or another build number', async () => {
  const { validateGitPreparation } = await import('./prepare-mac.mjs');
  assert.equal(typeof validateGitPreparation, 'function');
  // Use native paths so this validation also runs on Windows.
  const path = await import('node:path');
  const root = path.resolve('artifacts/prepare-test');
  const config = { ...valid(), repo: path.join(root, 'source'), buildRoot: root,
    nodeBinary: process.execPath, rubyBinary: process.execPath, developerDir: root };
  config.output = path.join(config.repo, 'artifacts/ios-release/19');
  assert.doesNotThrow(() => validateGitPreparation(config));
  assert.throws(() => validateGitPreparation({ ...config, output: path.join(root, 'outside') }), /output/i);
  assert.throws(() => validateGitPreparation({ ...config, buildNumber: 20 }), /output/i);
});
