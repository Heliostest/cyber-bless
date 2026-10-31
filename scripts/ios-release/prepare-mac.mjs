import { mkdir, open, readFile, realpath, unlink, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { assertReleaseLock, assertOfficialBuildRoot } from './release-lock.mjs';

export function validateGitPreparation(config) {
  if (config.sourceMode !== 'git-tag' || typeof config.sourceTag !== 'string' || !config.sourceTag) throw Error('Official releases require a pushed Git tag; worktree archives are no longer accepted');
  for (const field of ['sourceTagObject', 'sourceCommit', 'sourceTree']) if (!/^[a-f0-9]{40}$/.test(config[field] ?? '')) throw Error('Missing immutable tag/source identity: ' + field);
  if (!/^[a-f0-9]{64}$/.test(config.sourceIdentitySha256 ?? '')) throw Error('Missing source manifest identity');
  if (!Number.isSafeInteger(config.buildNumber) || config.buildNumber < 1) throw Error('Explicit positive build number required');
  if (!path.isAbsolute(config.repo ?? '') || !path.isAbsolute(config.buildRoot ?? '') || !config.repo.startsWith(config.buildRoot + path.sep)) throw Error('Expected an isolated tag checkout inside the app build root');
  if (config.output !== path.join(config.repo, 'artifacts/ios-release', String(config.buildNumber))) throw Error('Unexpected release output path');
  for (const field of ['nodeBinary', 'rubyBinary', 'developerDir']) if (!path.isAbsolute(config[field] ?? '')) throw Error('Expected absolute toolchain path: ' + field);
}

export async function main(configFile) {
  if (!path.isAbsolute(configFile ?? '')) throw Error('Pass an absolute release-config JSON path');
  const config = JSON.parse(await readFile(configFile, 'utf8'));
  validateGitPreparation(config);
  if (process.platform !== 'darwin' || os.homedir() !== '/Users/heli') throw Error('Run on the designated Mac account');
  const { repo, output, nodeBinary, rubyBinary, developerDir } = config;
  assertOfficialBuildRoot(config.buildRoot);
  await assertReleaseLock(config.buildRoot);
  if (await realpath(repo) !== repo || await realpath(output) !== output) throw Error('Source/output must not be symlinked');
  const { assertReleaseSource, sourceReceipt } = await import('./source-identity.mjs');
  const { inspectToolchain, installLockedPods } = await import('./dependencies.mjs');
  const { resetNativeProject, captureNativeInputs } = await import('./native-inputs.mjs');
  const { manifest } = await assertReleaseSource(config, { entrypoint: import.meta.url, allowPrebuildChanges: true });
  const identity = { ...sourceReceipt(manifest), ...Object.fromEntries(['version', 'buildNumber', 'bundleIdentifier', 'appId', 'appleTeamId'].map(key => [key, config[key]])) };
  for (const file of ['source-post-prebuild.json', 'prepare-result.json']) {
    await unlink(path.join(output, file)).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  const tooling = await inspectToolchain(config);
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, 'source-verification-mac.json'), JSON.stringify({ checkedAt: new Date().toISOString(), ...identity, commit: manifest.commit, filesChecked: manifest.fileCount, allSourceHashesVerified: true }, null, 2) + '\n');
  const env = {
    HOME: os.homedir(), USER: 'heli', LOGNAME: 'heli', SHELL: '/bin/zsh',
    PATH: `${path.dirname(nodeBinary)}:${path.dirname(rubyBinary)}:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
    DEVELOPER_DIR: developerDir, NODE_BINARY: nodeBinary,
    CI: '1', EXPO_NO_TELEMETRY: '1', EXPO_NO_DOTENV: '1', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8',
    ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
  };
  async function run(command, args, log, cwd = repo) {
    const handle = await open(path.join(output, log), 'w', 0o600);
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd, env, stdio: ['ignore', handle.fd, handle.fd] });
        child.once('error', () => reject(Error('Unable to start ' + path.basename(command))));
        child.once('close', code => code === 0 ? resolve() : reject(Error(path.basename(command) + ' failed; see ' + log)));
      });
    } finally { await handle.close(); }
  }
  await run(path.join(path.dirname(nodeBinary), 'npm'), ['ci', '--no-audit', '--no-fund'], 'npm-ci.log');
  await run(path.join(path.dirname(nodeBinary), 'npm'), ['run', 'i18n:verify'], 'i18n-verify-mac.log');
  await run(path.join(path.dirname(nodeBinary), 'npm'), ['run', 'assets:prepare', '-w', '@wbr/mobile'], 'assets-prepare.log');
  await resetNativeProject(repo);
  await run(nodeBinary, [path.join(repo, 'node_modules/expo/bin/cli'), 'prebuild', '--platform', 'ios', '--no-install'], 'expo-prebuild.log', path.join(repo, 'apps/mobile-expo'));
  const dependencies = await installLockedPods(config);
  await assertReleaseSource(config, { entrypoint: import.meta.url, allowPrebuildChanges: true });
  const nativeInputs = await captureNativeInputs(repo);
  const prepared = { checkedAt: new Date().toISOString(), ...identity, commit: manifest.commit, sourceFilesChecked: manifest.fileCount, allBusinessSourceHashesVerified: true, tooling, dependencies, nativeInputs };
  await writeFile(path.join(output, 'source-post-prebuild.json'), JSON.stringify(prepared, null, 2) + '\n');
  const result = { completedAt: new Date().toISOString(), ...identity, dependenciesInstalled: true, localizationVerified: true, offlineAssetsPrepared: true, nativeWorkspaceGenerated: true, podsInstalled: true, sourceHashesVerifiedAfterPrebuild: true, tooling };
  await writeFile(path.join(output, 'prepare-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.length === 3 ? process.argv[2] : null).catch(error => { console.error(error.message); process.exitCode = 1; });
