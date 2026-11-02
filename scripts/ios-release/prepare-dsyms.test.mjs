import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareReleaseDsyms } from './prepare-dsyms.mjs';

async function fixture(t, phases) {
  const repo = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ios-release-dsyms-')));
  t.after(() => rm(repo, { recursive: true, force: true }));
  const pods = path.join(repo, 'apps/mobile-expo/ios/Pods');
  await mkdir(path.join(pods, 'Pods.xcodeproj'), { recursive: true });
  const output = path.join(repo, 'artifacts/ios-release/20');
  await mkdir(output, { recursive: true });
  const objects = phases.map((phase, index) => `${String(index + 1).padStart(24, '0')} = { isa = PBXShellScriptBuildPhase; name = ${JSON.stringify(phase.name)}; shellPath = /bin/sh; shellScript = ${JSON.stringify(phase.script)}; };`).join('\n');
  await writeFile(path.join(pods, 'Pods.xcodeproj/project.pbxproj'), `// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 54; objects = {\n/* Begin PBXShellScriptBuildPhase section */\n${objects}\n/* End PBXShellScriptBuildPhase section */\n}; rootObject = 999999999999999999999999; }\n`);
  return { config: { repo, output, nodeBinary: process.execPath }, pods };
}

test('replays only exact generated Expo dSYM resolvers with decoded scripts and Release environment', async t => {
  const script = 'echo "quoted $PODS_ROOT"\n. "$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh"\nprintf "\\n"\n';
  const { config, pods } = await fixture(t, [
    { name: '[CP-User] [Expo] Resolve ExpoModulesCore dSYM source maps', script },
    { name: '[CP-User] [Expo] Switch ExpoModulesCore XCFramework for build configuration', script: 'must not execute' },
    { name: '[CP-User] [Expo] Resolve ExpoFont dSYM source maps', script: 'echo second\n' },
    { name: '[CP-User] [Expo] Resolve ExpoFont dSYM source maps extra', script: 'must not execute' },
  ]);
  const calls = [];
  const actual = await prepareReleaseDsyms(config, { run: async (...args) => calls.push(args) });
  assert.deepEqual(actual, { phaseCount: 2 });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].slice(0, 2), ['/bin/bash', ['-c', script]]);
  assert.deepEqual(calls[0][2], {
    cwd: pods, log: 'prepare-dsym-0.log', env: {
      PODS_ROOT: pods, PODFILE_DIR: path.dirname(pods),
      REACT_NATIVE_PATH: path.join(config.repo, 'node_modules/react-native'),
      NODE_BINARY: config.nodeBinary, CONFIGURATION: 'Release',
      DERIVED_FILE_DIR: path.join(config.output, 'prepare-dsym-stamps'),
    },
  });
  assert.deepEqual(calls[1][1], ['-c', 'echo second\n']);
  assert.equal(calls[1][2].log, 'prepare-dsym-1.log');
  assert.equal((await stat(calls[0][2].env.DERIVED_FILE_DIR)).isDirectory(), true);
});

test('resolver failure stops preparation and propagates the command failure', async t => {
  const { config } = await fixture(t, [{ name: '[CP-User] [Expo] Resolve ExpoFont dSYM source maps', script: 'exit 7\n' }]);
  await assert.rejects(prepareReleaseDsyms(config, { run: async () => { throw Error('resolver exited 7'); } }), /resolver exited 7/);
});

test('missing resolver phases fail closed without executing unrelated phases', async t => {
  const { config } = await fixture(t, [{ name: '[Expo] Remove duplicate codegen output', script: 'must not execute' }]);
  await assert.rejects(prepareReleaseDsyms(config, { run: async () => { throw Error('Should not run'); } }), /No generated Expo dSYM resolver phases/);
});
