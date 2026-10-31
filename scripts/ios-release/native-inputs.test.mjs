import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resetNativeProject, captureNativeInputs, assertNativeInputs, assertNativeWriteTargets } from './native-inputs.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function fixture(t) {
  const base = await realpath(await mkdtemp(path.join(os.tmpdir(), 'ios-native-inputs-')));
  t.after(() => rm(base, { recursive: true, force: true }));
  const repo = path.join(base, 'repo'), ios = path.join(repo, 'apps/mobile-expo/ios');
  const files = {
    'app/AppDelegate.swift': 'class AppDelegate {}\n',
    'app/Info.plist': '<plist>app</plist>\n',
    'ExpoWidgetsTarget/Info.plist': '<plist>widget</plist>\n',
    'app.xcodeproj/project.pbxproj': '{ buildSettings = {}; }\n',
    Podfile: "pod 'Example'\n", 'Podfile.lock': 'Example (1.0.0)\n',
    'Pods/Example/Source.m': 'void example(void) {}\n',
    'Pods/Manifest.lock': 'Example (1.0.0)\n',
  };
  for (const [file, bytes] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(ios, file)), { recursive: true });
    await writeFile(path.join(ios, file), bytes);
  }
  await writeFile(path.join(repo, 'apps/mobile-expo/package.json'), '{}\n');
  const outside = path.join(base, 'outside');
  await mkdir(outside); await writeFile(path.join(outside, 'keep.txt'), 'preserve outside target\n');
  return { base, repo, ios, outside };
}

test('captures original native sources, Pods and locks and accepts the unchanged manifest', async t => {
  const { repo } = await fixture(t);
  const manifest = await captureNativeInputs(repo);
  assert.equal(manifest.schemaVersion, 1);
  assert.match(manifest.sha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.files.length, 8);
  assert.deepEqual(manifest.files.find(file => file.path === 'app/AppDelegate.swift'), { path: 'app/AppDelegate.swift', type: 'file', bytes: 21, sha256: digest('class AppDelegate {}\n') });
  assert.ok(manifest.files.some(file => file.path === 'Pods/Example/Source.m'));
  assert.ok(manifest.files.some(file => file.path === 'Pods/Manifest.lock'));
  await assertNativeInputs(repo, manifest);
});

test('rejects modified Swift and newly added native sources', async t => {
  for (const [file, bytes] of [['app/AppDelegate.swift', 'class ChangedDelegate {}\n'], ['app/Injected.swift', 'class Injected {}\n']]) {
    const { repo, ios } = await fixture(t);
    const manifest = await captureNativeInputs(repo);
    await writeFile(path.join(ios, file), bytes);
    await assert.rejects(assertNativeInputs(repo, manifest), /native.*(?:changed|differ)/i);
  }
});

test('a signing-stage manifest must bind the exact changed project and Info files', async t => {
  const { repo, ios } = await fixture(t);
  const prepared = await captureNativeInputs(repo);
  await writeFile(path.join(ios, 'app.xcodeproj/project.pbxproj'), '{ buildSettings = { signing = manual; }; }\n');
  await writeFile(path.join(ios, 'app/Info.plist'), '<plist>signed app</plist>\n');
  await writeFile(path.join(ios, 'ExpoWidgetsTarget/Info.plist'), '<plist>signed widget</plist>\n');
  await assert.rejects(assertNativeInputs(repo, prepared, { allowSigningChanges: true }), /native.*(?:changed|differ)/i);
  const signed = await captureNativeInputs(repo);
  await assertNativeInputs(repo, signed, { allowSigningChanges: true });
  await writeFile(path.join(ios, 'app/Info.plist'), '<plist>changed after signing</plist>\n');
  await assert.rejects(assertNativeInputs(repo, signed, { allowSigningChanges: true }), /native.*(?:changed|differ)/i);
});

test('ignores new compiler outputs while retaining generated code used as native source', async t => {
  const { repo, ios } = await fixture(t);
  await mkdir(path.join(ios, 'build/generated/ios'), { recursive: true });
  await writeFile(path.join(ios, 'build/generated/ios/Codegen.h'), '#define CODEGEN 1\n');
  const manifest = await captureNativeInputs(repo);
  for (const relative of ['build/Objects/app.o', '.build/cache/state', 'DerivedData/index/cache']) {
    await mkdir(path.dirname(path.join(ios, relative)), { recursive: true });
    await writeFile(path.join(ios, relative), 'new compiler output');
  }
  await assertNativeInputs(repo, manifest);
  await writeFile(path.join(ios, 'build/generated/ios/Codegen.h'), '#define CODEGEN 2\n');
  await assert.rejects(assertNativeInputs(repo, manifest), /native.*(?:changed|differ)/i);
});

test('native root and ancestor directory links are rejected before capture or cleanup', async t => {
  for (const relative of ['apps', 'apps/mobile-expo', 'apps/mobile-expo/ios']) {
    const { base, repo, outside } = await fixture(t);
    const linked = path.join(repo, relative);
    await rename(linked, path.join(base, 'saved-original'));
    await symlink(outside, linked, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(captureNativeInputs(repo), /link|real directory/i);
    await assert.rejects(resetNativeProject(repo), /link|real directory/i);
    assert.equal(await readFile(path.join(outside, 'keep.txt'), 'utf8'), 'preserve outside target\n');
    assert.equal((await lstat(linked)).isSymbolicLink(), true);
  }
});

test('a repository alias cannot bypass the real-root boundary', async t => {
  const { base, repo } = await fixture(t);
  const alias = path.join(base, 'alias');
  await symlink(repo, alias, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(captureNativeInputs(alias), /link|real directory/i);
  await assert.rejects(resetNativeProject(alias), /link|real directory/i);
});

test('cleanup removes only generated ios and does not follow a nested link target', async t => {
  const { repo, ios, outside } = await fixture(t);
  await symlink(outside, path.join(ios, 'Pods/External'), process.platform === 'win32' ? 'junction' : 'dir');
  await resetNativeProject(repo);
  await assert.rejects(access(ios), { code: 'ENOENT' });
  assert.equal(await readFile(path.join(outside, 'keep.txt'), 'utf8'), 'preserve outside target\n');
  assert.equal(await readFile(path.join(repo, 'apps/mobile-expo/package.json'), 'utf8'), '{}\n');
  await resetNativeProject(repo);
});

test('captures in-repository directory links without recursively following them', async t => {
  const { repo, ios } = await fixture(t);
  await symlink(path.join(ios, 'Pods'), path.join(ios, 'Pods/Example/loop'), process.platform === 'win32' ? 'junction' : 'dir');
  const manifest = await captureNativeInputs(repo);
  assert.equal(manifest.files.length, 9);
  assert.deepEqual(manifest.files.find(file => file.path === 'Pods/Example/loop'), { path: 'Pods/Example/loop', type: 'symlink', target: 'apps/mobile-expo/ios/Pods', targetType: 'directory' });
  await assertNativeInputs(repo, manifest);
});

test('rejects native symlinks whose real targets leave the repository', async t => {
  const { repo, ios, outside } = await fixture(t);
  await symlink(outside, path.join(ios, 'Pods/External'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(captureNativeInputs(repo), /outside|escape|repository/i);
});

test('binds Pods header file links to their real in-repository content', async t => {
  const { repo, ios } = await fixture(t);
  const target = path.join(ios, 'Pods/Example/Source.m'), linked = path.join(ios, 'Pods/Example/Header.h');
  await symlink(target, linked, 'file');
  const manifest = await captureNativeInputs(repo);
  const entry = manifest.files.find(file => file.path === 'Pods/Example/Header.h');
  assert.equal(entry.type, 'symlink');
  assert.equal(entry.target, 'apps/mobile-expo/ios/Pods/Example/Source.m');
  assert.equal(entry.sha256, digest('void example(void) {}\n'));
  await writeFile(target, 'void changed(void) {}\n');
  await assert.rejects(assertNativeInputs(repo, manifest), /native.*(?:changed|differ)/i);
});

test('rejects a forged native manifest digest', async t => {
  const { repo } = await fixture(t);
  const manifest = await captureNativeInputs(repo);
  await assert.rejects(assertNativeInputs(repo, { ...manifest, sha256: '0'.repeat(64) }), /manifest|digest/i);
});

test('accepts real project and Info files as native signing write targets', async t => {
  const { repo } = await fixture(t);
  await assertNativeWriteTargets(repo);
});

test('rejects a project-directory link even when its target remains in the repository', async t => {
  const { repo, ios } = await fixture(t);
  const original = path.join(ios, 'app.xcodeproj'), target = path.join(ios, 'actual-project');
  await rename(original, target);
  await symlink(target, original, process.platform === 'win32' ? 'junction' : 'dir');
  await captureNativeInputs(repo);
  await assert.rejects(assertNativeWriteTargets(repo), /write.*(?:link|real)|(?:link|real).*write/i);
});

test('rejects linked App and widget Info files even when their targets stay inside the repository', async t => {
  for (const relative of ['app/Info.plist', 'ExpoWidgetsTarget/Info.plist']) {
    const { repo, ios } = await fixture(t);
    const original = path.join(ios, relative), target = path.join(path.dirname(original), 'actual-Info.plist');
    await rename(original, target);
    await symlink(target, original, 'file');
    await captureNativeInputs(repo);
    await assert.rejects(assertNativeWriteTargets(repo), /write.*(?:link|real)|(?:link|real).*write/i);
  }
});
