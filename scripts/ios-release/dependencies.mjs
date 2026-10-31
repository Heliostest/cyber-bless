import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const toolchainFields = ['node', 'npm', 'ruby', 'cocoapods', 'bundler', 'xcode', 'xcodeBuild', 'sdk', 'platform', 'arch', 'osVersion', 'osBuild'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function regularFile(file) {
  if (!(await lstat(file)).isFile() || await realpath(file) !== path.resolve(file)) throw Error('Dependency input must be a regular file without symlinks: ' + file);
  return readFile(file);
}

async function inputs(config) {
  const repo = config.repo;
  if (!repo || !path.isAbsolute(repo)) throw Error('Expected absolute release checkout path');
  const input = JSON.parse(await regularFile(path.join(repo, 'store/ios/release-input.json')));
  if (!Number.isSafeInteger(input.buildNumber) || input.buildNumber < 1) throw Error('Tracked release build number is unallocated; check used numbers, commit the release input, and create a new tag');
  for (const field of ['version', 'buildNumber', 'bundleIdentifier', 'appId', 'appleTeamId']) {
    if (input[field] !== config[field]) throw Error('Tracked release input mismatch: ' + field);
  }
  for (const field of toolchainFields) if (typeof input.toolchain?.[field] !== 'string' || !input.toolchain[field]) throw Error('Missing tracked toolchain requirement: ' + field);
  const files = {
    podLock: path.join(repo, 'store/ios/Podfile.lock'),
    packageLock: path.join(repo, 'package-lock.json'),
    gemfile: path.join(repo, 'Gemfile'),
    gemLock: path.join(repo, 'Gemfile.lock'),
  };
  const bytes = {};
  for (const [name, file] of Object.entries(files)) bytes[name] = await regularFile(file);
  return { input, files, bytes };
}

function environment(config, gemfile) {
  const nodeBinary = config.nodeBinary ?? process.execPath;
  const rubyBinary = config.rubyBinary ?? 'ruby';
  return {
    HOME: os.homedir(), USER: os.userInfo().username, LOGNAME: os.userInfo().username,
    PATH: `${path.dirname(nodeBinary)}:${path.dirname(rubyBinary)}:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin`,
    DEVELOPER_DIR: config.developerDir, NODE_BINARY: nodeBinary,
    BUNDLE_GEMFILE: gemfile, BUNDLE_FROZEN: 'true', BUNDLE_IGNORE_CONFIG: 'true', BUNDLE_DISABLE_VERSION_CHECK: 'true',
    CI: '1', COCOAPODS_DISABLE_STATS: 'true', LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8',
    ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
  };
}

async function defaultRun(command, args, options) {
  return execute(command, args, { ...options, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function stdout(result) {
  if (typeof result === 'string') return result.trim();
  if (typeof result?.stdout === 'string') return result.stdout.trim();
  throw Error('Tool command did not provide stdout');
}

function version(text, pattern, name) {
  const found = pattern.exec(text);
  if (!found) throw Error('Unable to parse actual ' + name + ' version');
  return found[1];
}

export async function inspectToolchain(config, { run = defaultRun } = {}) {
  const { input, files, bytes } = await inputs(config);
  const options = { cwd: config.repo, env: environment(config, files.gemfile) };
  const call = async (command, args) => stdout(await run(command, args, options));
  const nodeBinary = config.nodeBinary ?? process.execPath;
  const rubyBinary = config.rubyBinary ?? 'ruby';
  const bundle = path.join(path.dirname(rubyBinary), 'bundle');
  const actual = {
    node: version(await call(nodeBinary, ['--version']), /^v(\d+\.\d+\.\d+)$/, 'Node'),
    npm: version(await call(path.join(path.dirname(nodeBinary), 'npm'), ['--version']), /^(\d+\.\d+\.\d+)$/, 'npm'),
    ruby: version(await call(rubyBinary, ['--version']), /^ruby (\d+\.\d+\.\d+)(?:\s|$)/, 'Ruby'),
    bundler: version(await call(bundle, ['--version']), /^Bundler version (\d+\.\d+\.\d+)$/, 'Bundler'),
    cocoapods: version(await call(bundle, ['exec', 'pod', '--version']), /^(\d+\.\d+\.\d+)$/, 'CocoaPods'),
  };
  const xcode = await call('/usr/bin/xcodebuild', ['-version']);
  actual.xcode = version(xcode, /^Xcode (\S+)$/m, 'Xcode');
  actual.xcodeBuild = version(xcode, /^Build version (\S+)$/m, 'Xcode build');
  actual.sdk = await call('/usr/bin/xcrun', ['--sdk', 'iphoneos', '--show-sdk-version']);
  actual.platform = (await call('/usr/bin/uname', ['-s'])).toLowerCase();
  actual.arch = await call('/usr/bin/uname', ['-m']);
  actual.osVersion = await call('/usr/bin/sw_vers', ['-productVersion']);
  actual.osBuild = await call('/usr/bin/sw_vers', ['-buildVersion']);
  for (const field of toolchainFields) {
    if (actual[field] !== input.toolchain[field]) throw Error(`Toolchain ${field} mismatch: expected ${input.toolchain[field]}, actual ${actual[field]}`);
  }
  return {
    ...actual,
    podLockSha256: hash(bytes.podLock), packageLockSha256: hash(bytes.packageLock),
    gemfileSha256: hash(bytes.gemfile), gemLockSha256: hash(bytes.gemLock),
  };
}

export async function installLockedPods(config, { run = defaultRun } = {}) {
  const { files, bytes } = await inputs(config);
  const native = path.join(config.repo, 'apps/mobile-expo/ios');
  if (!(await lstat(native)).isDirectory() || await realpath(native) !== path.resolve(native)) throw Error('Generated iOS directory must not be symlinked');
  const generatedLock = path.join(native, 'Podfile.lock');
  try {
    if (!(await lstat(generatedLock)).isFile() || await realpath(generatedLock) !== path.resolve(generatedLock)) throw Error('Generated Podfile.lock must not be symlinked');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(generatedLock, bytes.podLock);
  const bundle = path.join(path.dirname(config.rubyBinary ?? 'ruby'), 'bundle');
  await run(bundle, ['exec', 'pod', 'install', '--deployment'], { cwd: native, env: environment(config, files.gemfile) });
  if (!(await regularFile(generatedLock)).equals(bytes.podLock)) throw Error('Generated Podfile.lock changed during deployment installation');
  for (const [name, file] of Object.entries(files)) {
    if (!(await regularFile(file)).equals(bytes[name])) throw Error('Tracked dependency input changed during installation: ' + path.basename(file));
  }
  return { podsInstalled: true, podLockSha256: hash(bytes.podLock), gemLockSha256: hash(bytes.gemLock) };
}
