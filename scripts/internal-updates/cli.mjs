import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { lstat, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, promisify } from 'node:util';
import { createInternalUpdateService, packageExpoExport } from './service.mjs';

const execute = promisify(execFile);
const repository = fileURLToPath(new URL('../../', import.meta.url));
const external = process.env.LOCALAPPDATA || process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
export function internalUpdateDefaults() {
  return { storageDir: process.env.INTERNAL_UPDATES_STORAGE || path.join(repository, 'artifacts', 'internal-updates'),
    publicBaseUrl: process.env.INTERNAL_UPDATES_PUBLIC_BASE_URL || 'https://feedback.heliosoft.win',
    privateKeyPath: process.env.INTERNAL_UPDATES_PRIVATE_KEY || path.join(external, 'CyberBless', 'internal-updates', 'private-key.pem'),
    certificatePath: process.env.INTERNAL_UPDATES_CERTIFICATE || path.join(repository, 'apps', 'mobile-expo', 'certs', 'internal-updates.pem'),
    keyId: 'main', channel: 'internal' };
}
async function git(repoDir, args) {
  try { return (await execute('git', ['-C', repoDir, ...args], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 })).stdout.trim(); }
  catch { throw new Error('Cannot inspect the Git source identity'); }
}
/** No dirty or untracked source is ever labeled with a committed identity. */
export async function captureCleanSource(repoDir) {
  const status = await git(repoDir, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (status) throw new Error('Update preparation requires a clean committed source tree, including untracked files');
  const commit = await git(repoDir, ['rev-parse', '--verify', 'HEAD']), tree = await git(repoDir, ['rev-parse', '--verify', 'HEAD^{tree}']);
  if (!/^[a-f0-9]{40}$/.test(commit) || !/^[a-f0-9]{40}$/.test(tree)) throw new Error('Unsupported Git source identity');
  return { commit, tree, dirty: false, method: 'clean-git-metro-export' };
}
async function nodeTool(executable, args, cwd, env, label) {
  try { return (await execute(process.execPath, [executable, ...args], { cwd, env, windowsHide: true, maxBuffer: 32 * 1024 * 1024 })).stdout; }
  catch (error) { throw new Error(`${label} failed (exit ${Number.isInteger(error.code) ? error.code : 'unavailable'}); no update package was prepared`); }
}
async function requireTracked(root, files) {
  for (let index = 0; index < files.length; index += 50) {
    await git(root, ['ls-files', '--error-unmatch', '--', ...files.slice(index, index + 50)]);
  }
}
async function assetBytes(file) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Generated registered asset must be a regular file');
  const bytes = await readFile(file);
  if (bytes.length < 1024 && bytes.toString('utf8').startsWith('version https://git-lfs.github.com/spec/v1')) throw new Error('Registered source asset is an unresolved LFS pointer');
  return bytes;
}
async function registeredAssetInputs(root, project) {
  const registry = path.join(project, 'bundled-assets.generated.ts');
  await requireTracked(root, [path.relative(root, registry).replaceAll('\\', '/')]);
  const text = await readFile(registry, 'utf8'), registrations = [...text.matchAll(/^\s*("(?:[^"\\]|\\.)+"):\s*\{\s*module:\s*require\(("(?:[^"\\]|\\.)+")\),\s*bytes:\s*(\d+),\s*md5:\s*"([a-f0-9]{32})"\s*\},?\s*$/gm)];
  if (!registrations.length) throw new Error('Generated registered asset inventory is missing');
  const manifest = JSON.parse(await assetBytes(path.join(project, 'public', 'wbr-assets.json')));
  if (!Array.isArray(manifest) || manifest.length !== registrations.length) throw new Error('Generated registered asset inventory is incomplete');
  const byFile = new Map(manifest.map(entry => [entry.file, entry]));
  if (byFile.size !== registrations.length) throw new Error('Duplicate generated registered asset');
  const inventory = [];
  for (const match of registrations) {
    const file = JSON.parse(match[1]), modulePath = JSON.parse(match[2]), declaredSize = Number(match[3]), declaredMD5 = match[4];
    if (!/^[a-zA-Z0-9_./+-]+$/.test(file) || file.startsWith('/') || file.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe generated registered asset path');
    const sourcePath = path.join(root, 'assets', file), sourceBytes = await assetBytes(sourcePath);
    const sourceSHA = createHash('sha256').update(sourceBytes).digest('hex'), sourceMD5 = createHash('md5').update(sourceBytes).digest('hex');
    const declared = byFile.get(file), targetPath = path.resolve(project, modulePath), alias = path.join(project, 'public', `${file}.bin`);
    if (!declared || declared.bytes !== sourceBytes.length || declared.sha256 !== sourceSHA || declaredSize !== sourceBytes.length || declaredMD5 !== sourceMD5 ||
      (targetPath !== sourcePath && targetPath !== alias)) throw new Error('Generated registered asset does not match committed source inputs');
    const targetBytes = await assetBytes(targetPath);
    if (targetBytes.length !== sourceBytes.length || createHash('sha256').update(targetBytes).digest('hex') !== sourceSHA) throw new Error('Generated registered asset alias changed from committed source');
    inventory.push({ file, sourcePath: `assets/${file}`, targetPath: path.relative(root, targetPath).replaceAll('\\', '/'),
      size: sourceBytes.length, sha256: sourceSHA, md5: sourceMD5, ext: path.extname(targetPath).slice(1).toLowerCase() });
  }
  await requireTracked(root, inventory.map(entry => entry.sourcePath));
  return inventory;
}
async function verifyExportedRegisteredAssets(exportDir, platform, inventory) {
  const metadata = JSON.parse(await readFile(path.join(exportDir, 'metadata.json'), 'utf8'));
  const assets = metadata?.fileMetadata?.[platform]?.assets;
  if (!Array.isArray(assets)) throw new Error('Metro registered asset inventory is missing');
  for (const asset of inventory) {
    const exportPath = `assets/${asset.md5}`;
    if (!assets.some(entry => typeof entry.path === 'string' && entry.path.replaceAll('\\', '/') === exportPath && entry.ext === asset.ext)) throw new Error('Metro export is missing a registered asset from committed source');
    const bytes = await assetBytes(path.join(exportDir, 'assets', asset.md5));
    if (bytes.length !== asset.size || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error('Metro registered asset bytes changed from committed source');
  }
}
/** Runs only the installed Expo tools; paths/commands are never accepted over HTTP. */
export async function prepareRelease({ repoDir = repository, projectDir = path.join(repoDir, 'apps', 'mobile-expo'), outputDir, platform, runtimeVersion, message = '', ...options }) {
  if (!['ios', 'android'].includes(platform)) throw new Error('Prepare requires --platform ios or android');
  if (!outputDir) throw new Error('Prepare requires a new --out package directory');
  const root = await realpath(repoDir), project = await realpath(projectDir), relative = path.relative(root, project);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('The Expo project must belong to the inspected Git repository');
  const source = await captureCleanSource(root), require = createRequire(path.join(project, 'package.json'));
  const expoCLI = require.resolve('expo/bin/cli'), updatesCLI = require.resolve('expo-updates/bin/cli.js');
  const env = { ...process.env, CI: '1', NODE_ENV: 'production', EXPO_NO_DOTENV: '1', EXPO_INTERNAL_UPDATES: '1' };
  const preparationScripts = ['scripts/i18n-compile.mjs', 'scripts/prepare-app-assets.mjs'];
  await requireTracked(root, preparationScripts);
  for (const script of preparationScripts) await nodeTool(path.join(root, script), [], root, env, 'Committed asset preparation');
  const prepared = await captureCleanSource(root);
  if (prepared.commit !== source.commit || prepared.tree !== source.tree) throw new Error('Source changed during generated asset preparation');
  const registeredInputs = await registeredAssetInputs(root, project);
  const resolveRuntime = async () => {
    const output = await nodeTool(updatesCLI, ['runtimeversion:resolve', '--platform', platform], project, env, 'Expo runtime resolution');
    let result; try { result = JSON.parse(output); } catch { throw new Error('Expo runtime resolver returned invalid JSON'); }
    if (typeof result.runtimeVersion !== 'string' || !result.runtimeVersion || result.runtimeVersion.length > 200) throw new Error('The internal build must configure an explicit or fingerprint runtime version');
    return result.runtimeVersion;
  };
  const resolved = await resolveRuntime();
  if (runtimeVersion !== undefined && runtimeVersion !== resolved) throw new Error('Requested runtime does not match the actual native runtime');
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'cyber-metro-update-'));
  try {
    const exportDir = path.join(temporary, 'export');
    await nodeTool(expoCLI, ['export', '--platform', platform, '--output-dir', exportDir], project, env, 'Metro export');
    const publicConfigOutput = await nodeTool(expoCLI, ['config', '--type', 'public', '--json'], project, env, 'Public Expo config');
    let expoClient; try { expoClient = JSON.parse(publicConfigOutput); } catch { throw new Error('Expo public config returned invalid JSON'); }
    if (JSON.stringify(await registeredAssetInputs(root, project)) !== JSON.stringify(registeredInputs)) throw new Error('Generated registered asset inputs changed during export');
    await verifyExportedRegisteredAssets(exportDir, platform, registeredInputs);
    const after = await captureCleanSource(root);
    if (source.commit !== after.commit || source.tree !== after.tree || await resolveRuntime() !== resolved) throw new Error('Source/native runtime changed during export; package refused');
    return await packageExpoExport({ exportDir, outputDir, runtimeVersion: resolved, source, message, expoClient, ...options });
  } finally { await rm(temporary, { recursive: true, force: true }); }
}

const usage = `Internal Expo update tooling (local administrator only)

  prepare --platform ios|android --out <new package directory> [--runtime <expected actual runtime>] [--message <notes>]
  import --package <prepared signed package directory>
  list
  publish --release <verified release UUID> [--platform ios|android] [--runtime <expected runtime>]
  rollback --release <verified release UUID> [--platform ios|android]
  rollback --embedded --platform ios|android --runtime <native runtime>

  Configuration: --store, --public-url, --private-key <external PEM path>, --certificate <public PEM path>
  Preparation: --repo <clean Git root>, --project <Expo project directory>
  Environment: INTERNAL_UPDATES_STORAGE, INTERNAL_UPDATES_PUBLIC_BASE_URL, INTERNAL_UPDATES_PRIVATE_KEY, INTERNAL_UPDATES_CERTIFICATE.

Prepare runs the installed Expo exporter against clean committed source, resolves the native runtime, and signs the file inventory.
Imports verify the public certificate, source attestation, complete Metro file inventory, DOM dependencies, sizes, and SHA-256.
Publish and rollback select only imported verified UUIDs. They never modify the native release tags or upload a native build.
Signing keys must live outside all Git working trees. No key is generated automatically.\n`;

export async function main(args = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, options: {
    help: { type: 'boolean', short: 'h' }, store: { type: 'string' }, 'public-url': { type: 'string' }, 'private-key': { type: 'string' }, certificate: { type: 'string' },
    repo: { type: 'string' }, project: { type: 'string' }, out: { type: 'string' }, platform: { type: 'string' }, runtime: { type: 'string' }, message: { type: 'string' },
    package: { type: 'string' }, release: { type: 'string' }, embedded: { type: 'boolean' },
  } });
  const command = positionals[0] ?? 'help';
  if (values.help || command === 'help') { process.stdout.write(usage); return; }
  if (positionals.length !== 1 || !['prepare', 'import', 'list', 'publish', 'rollback'].includes(command)) throw new Error('Unsupported internal update command');
  const defaults = internalUpdateDefaults(), options = { ...defaults,
    storageDir: path.resolve(values.store ?? defaults.storageDir), publicBaseUrl: values['public-url'] ?? defaults.publicBaseUrl,
    privateKeyPath: path.resolve(values['private-key'] ?? defaults.privateKeyPath), certificatePath: path.resolve(values.certificate ?? defaults.certificatePath) };
  const service = createInternalUpdateService(options); let result;
  if (command === 'list') result = await service.list();
  if (command === 'import') { if (!values.package) throw new Error('Import requires --package'); result = await service.importRelease(path.resolve(values.package)); }
  if (command === 'prepare') {
    if (!(await service.list()).signingConfigured) throw new Error('Configure the external signing key and matching public certificate before preparing an update');
    result = await prepareRelease({ ...options, repoDir: path.resolve(values.repo ?? repository), projectDir: path.resolve(values.project ?? path.join(values.repo ?? repository, 'apps', 'mobile-expo')),
      outputDir: values.out ? path.resolve(values.out) : undefined, platform: values.platform, runtimeVersion: values.runtime, message: values.message });
  }
  if (command === 'publish' || command === 'rollback') {
    const selection = { ...(values.release !== undefined ? { releaseId: values.release } : {}), ...(values.platform !== undefined ? { platform: values.platform } : {}),
      ...(values.runtime !== undefined ? { runtimeVersion: values.runtime } : {}), ...(values.embedded ? { embedded: true } : {}) };
    result = await service[command](selection);
  }
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
