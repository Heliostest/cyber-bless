import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, realpath, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const manifestDigest = files => createHash('sha256').update(JSON.stringify({ schemaVersion: 1, files })).digest('hex');
const relativePath = (root, file) => path.relative(root, file).split(path.sep).join('/');

async function nativeRoot(repo, { allowMissing = false } = {}) {
  if (typeof repo !== 'string' || !path.isAbsolute(repo)) throw Error('Expected an absolute real repository directory');
  const root = path.resolve(repo);
  const directories = [root, path.join(root, 'apps'), path.join(root, 'apps/mobile-expo'), path.join(root, 'apps/mobile-expo/ios')];
  for (const directory of directories) {
    let info;
    try { info = await lstat(directory); }
    catch (error) {
      if (allowMissing && error.code === 'ENOENT' && directory === directories.at(-1)) return { repo: root, ios: null };
      throw error;
    }
    if (info.isSymbolicLink() || !info.isDirectory() || await realpath(directory) !== directory) throw Error('Native project ancestors must be real directories without links');
  }
  const ios = directories.at(-1);
  if (!path.isAbsolute(ios) || relativePath(root, ios) !== 'apps/mobile-expo/ios') throw Error('Native project path escaped its exact generated directory');
  return { repo: root, ios };
}

export async function resetNativeProject(repo) {
  const { ios } = await nativeRoot(repo, { allowMissing: true });
  // fs.rm unlinks nested symlinks/junctions; it never recursively removes their
  // targets. The only recursive-delete root is the validated generated folder.
  if (ios) await rm(ios, { recursive: true, force: false });
}

export async function assertNativeWriteTargets(repo) {
  const { ios } = await nativeRoot(repo);
  for (const relative of ['app.xcodeproj/project.pbxproj', 'app/Info.plist', 'ExpoWidgetsTarget/Info.plist']) {
    const file = path.join(ios, relative);
    if (!(await lstat(file)).isFile() || await realpath(file) !== file) throw Error('Native write targets must be real files without parent or file links: ' + relative);
  }
}

async function fileDigest(file) {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(file)) { hash.update(chunk); bytes += chunk.length; }
  return { bytes, sha256: hash.digest('hex') };
}

function isOutput(relative) {
  const [first, second] = relative.split('/');
  if (first === '.build' || first === 'DerivedData') return true;
  // React Native's build/generated contains compiled Codegen sources. Preserve
  // those inputs while excluding Xcode object files and other build output.
  return first === 'build' && second !== undefined && second !== 'generated';
}

export async function captureNativeInputs(repo) {
  const { repo: root, ios } = await nativeRoot(repo);
  const files = [];
  async function walk(directory) {
    for (const name of await readdir(directory)) {
      const file = path.join(directory, name), relative = relativePath(ios, file);
      if (isOutput(relative)) continue;
      const info = await lstat(file);
      if (info.isSymbolicLink()) {
        const target = await realpath(file), inside = path.relative(root, target);
        if (inside === '..' || inside.startsWith('..' + path.sep) || path.isAbsolute(inside)) throw Error('Native symlink target is outside the repository: ' + relative);
        const targetInfo = await stat(target);
        if (!targetInfo.isFile() && !targetInfo.isDirectory()) throw Error('Unsupported native symlink target: ' + relative);
        files.push({ path: relative, type: 'symlink', target: relativePath(root, target) || '.', targetType: targetInfo.isFile() ? 'file' : 'directory', ...(targetInfo.isFile() ? await fileDigest(target) : {}) });
        // A directory link records its destination only. Following it here can
        // revisit parent Pods directories indefinitely.
      } else if (info.isDirectory()) {
        if (await realpath(file) !== file) throw Error('Native input directory changed to a link');
        await walk(file);
      } else if (info.isFile()) {
        if (await realpath(file) !== file) throw Error('Native input file changed to a link');
        files.push({ path: relative, type: 'file', ...await fileDigest(file) });
      } else throw Error('Unsupported native input type: ' + relative);
    }
  }
  await walk(ios);
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { schemaVersion: 1, files, sha256: manifestDigest(files) };
}

export async function assertNativeInputs(repo, expected, { allowSigningChanges = false } = {}) {
  if (expected?.schemaVersion !== 1 || !Array.isArray(expected.files) || expected.sha256 !== manifestDigest(expected.files)) throw Error('Invalid native input manifest digest');
  const actual = await captureNativeInputs(repo);
  // Signing approval is represented by a fresh capture in build-report.json.
  // Never ignore project.pbxproj or Info.plist changes against an older capture.
  if (!isDeepStrictEqual(actual, expected)) throw Error(`Native inputs changed from the ${allowSigningChanges ? 'signed' : 'prepared'} manifest`);
  return actual;
}
