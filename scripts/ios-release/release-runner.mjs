import { readFile, mkdir, realpath, writeFile, lstat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withReleaseLock, assertOfficialBuildRoot } from './release-lock.mjs';

const json = async file => JSON.parse(await readFile(file, 'utf8'));
const stages = {
  prepare: [['prepare-mac.mjs']],
  build: [['asc.mjs', 'preflight'], ['prepare-mac.mjs'], ['build-mac.mjs'], ['verify-mac.mjs']],
  rebuild: [['prepare-mac.mjs'], ['build-mac.mjs'], ['verify-mac.mjs']],
  verify: [['verify-mac.mjs']],
  status: [['asc.mjs', 'status']],
  upload: [['verify-mac.mjs'], ['asc.mjs', 'upload']],
  finish: [['asc.mjs', 'finish']],
  'counter-status': [['counter.mjs', 'status']],
  'counter-sync': [['counter.mjs', 'sync']],
};

export async function readReleaseInput(repo) {
  const input = await json(path.join(repo, 'store/ios/release-input.json'));
  if (!Number.isSafeInteger(input.buildNumber) || input.buildNumber < 1) throw Error('Allocate and commit a positive release build number before tagging');
  const { expo } = await json(path.join(repo, 'apps/mobile-expo/app.json'));
  if (input.version !== (expo.ios?.version ?? expo.version) || input.bundleIdentifier !== expo.ios?.bundleIdentifier || input.appleTeamId !== expo.ios?.appleTeamId || !/^\d+$/.test(input.appId ?? '')) throw Error('Committed release input version/App identity mismatch');
  return input;
}

async function safeOutput(repo, output) {
  const relative = path.relative(repo, output);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Release output must stay in its checkout');
  let current = repo;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    try {
      const entry = await lstat(current);
      if (!entry.isDirectory() || entry.isSymbolicLink() || await realpath(current) !== current) throw Error('Release output contains a symlink or non-directory');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await mkdir(output, { recursive: true });
}

export async function configureRelease(source, machine) {
  const repo = path.resolve(source.repo ?? '');
  if (await realpath(repo) !== repo || source.sourceMode !== 'git-tag') throw Error('Expected a verified tag checkout');
  const input = await readReleaseInput(repo);
  for (const field of ['nodeBinary', 'rubyBinary', 'developerDir', 'privateDir']) if (!path.isAbsolute(machine[field] ?? '')) throw Error('Expected an absolute machine path: ' + field);
  if (!machine.groupId || !path.isAbsolute(source.buildRoot ?? '') || !repo.startsWith(path.resolve(source.buildRoot) + path.sep)) throw Error('Missing app-specific build root or internal test group');
  const output = path.join(repo, 'artifacts/ios-release', String(input.buildNumber));
  const { createGitSourceManifest } = await import('./source-identity.mjs');
  const manifest = await createGitSourceManifest(repo, source);
  const config = {
    repo, output, localOutput: output, buildRoot: path.resolve(source.buildRoot),
    version: input.version, buildNumber: input.buildNumber, appId: input.appId,
    bundleIdentifier: input.bundleIdentifier, appleTeamId: input.appleTeamId,
    sourceMode: 'git-tag', sourceTag: source.sourceTag, sourceTagObject: source.sourceTagObject,
    sourceCommit: source.sourceCommit, sourceTree: source.sourceTree,
    sourceIdentitySha256: manifest.sourceIdentitySha256,
    repositoryUrl: source.repositoryUrl, sourceBranch: source.sourceBranch,
    nodeBinary: machine.nodeBinary, rubyBinary: machine.rubyBinary, developerDir: machine.developerDir,
    privateDir: machine.privateDir, groupId: machine.groupId, whatToTest: machine.whatToTest ?? '',
    syncEasCounter: input.syncEasCounter === true,
    derivedData: path.join(repo, 'artifacts/ios-release/DerivedData'),
  };
  await safeOutput(repo, output);
  const file = path.join(output, 'release-config.json');
  try {
    const previous = await json(file);
    if (JSON.stringify(previous) !== JSON.stringify(config)) throw Error('Release configuration already exists with different inputs; use a new tag/build');
    return { config, configFile: file, manifest };
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(path.join(output, 'source-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  await writeFile(file, JSON.stringify(config, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { config, configFile: file, manifest };
}

async function run(command, args, options) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: 'inherit' });
    child.once('error', () => reject(Error('Unable to start release stage')));
    child.once('close', code => code === 0 ? resolve() : reject(Error('Release stage failed: ' + path.basename(args[0]) + ' (' + code + ')')));
  });
}

export async function runReleaseStage(config, configFile, stage, options = {}) {
  let steps = stages[stage];
  if (!steps) throw Error('Unsupported release stage');
  if (stage === 'build' && config.syncEasCounter === true) steps = [...steps.slice(0, 2), ['counter.mjs', 'status'], ...steps.slice(2)];
  return withReleaseLock(config.buildRoot, async lease => {
    for (const [script, mode] of steps) {
      await (options.run ?? run)(config.nodeBinary, [path.join(config.repo, 'scripts/ios-release', script), configFile, ...(mode ? [mode] : [])], { cwd: config.repo, env: { ...process.env, WBR_RELEASE_LOCK_TOKEN: lease.token } });
    }
  });
}

export async function main(args = process.argv.slice(2)) {
  if (args[0] === 'configure' && args.length === 3) {
    if (process.platform !== 'darwin') throw Error('Configure releases on the designated Mac');
    const source = await json(path.resolve(args[1]));
    const machine = await json(path.resolve(args[2]));
    assertOfficialBuildRoot(source.buildRoot);
    if (fileURLToPath(import.meta.url) !== path.join(source.repo, 'scripts/ios-release/release-runner.mjs')) throw Error('Configure using the runner from the selected tag checkout');
    return withReleaseLock(source.buildRoot, async () => {
      const result = await configureRelease(source, machine);
      console.log(JSON.stringify({ configFile: result.configFile, sourceTag: result.config.sourceTag, sourceCommit: result.config.sourceCommit }));
    });
  }
  if (args.length !== 2 || !stages[args[1]] || !path.isAbsolute(args[0])) throw Error('Usage: release-runner.mjs configure <source.json> <machine.json> | <absolute-release-config.json> prepare|build|rebuild|verify|status|upload|finish|counter-status|counter-sync');
  if (process.platform !== 'darwin') throw Error('Run release stages on the designated Mac');
  const config = await json(args[0]);
  assertOfficialBuildRoot(config.buildRoot);
  const { assertReleaseSource } = await import('./source-identity.mjs');
  await assertReleaseSource(config, { entrypoint: import.meta.url, allowPrebuildChanges: true });
  await runReleaseStage(config, args[0], args[1]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
