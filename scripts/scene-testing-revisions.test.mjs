import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { computeSceneTestingRevisions, gameplayHostSource } from './scene-testing-revisions.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cyber-bless-scene-revisions-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  async function write(file, value) { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), value); }
  await write('a.ts', "import { target } from './input'; export const prompt='Move the cup'; export const scene=()=>target('a');\n");
  await write('b.ts', "export const scene=()=> 'b';\n");
  await write('input.ts', 'export const target=(id:string)=>id;\n');
  await write('woodfish.ts', "export const scene=()=> 'woodfish';\n");
  await write('assets/woodfish.glb', new Uint8Array([1, 2, 3]));
  const scenes = [{ id: 'a', roots: ['a.ts'] }, { id: 'b', roots: ['b.ts'] }, { id: 'woodfish', roots: ['woodfish.ts'] }];
  const translations = { 'zh-Hans': { 'scene.a.title': 'A', 'scene.b.title': 'B', 'scene.shared.move': 'Move the cup' }, en: { 'scene.a.title': 'A test', 'scene.b.title': 'B test', 'scene.shared.move': 'Move the cup' } };
  const options = { root, scenes, translations, assetsForScene: scene => scene.id === 'woodfish' ? ['assets/woodfish.glb'] : [] };
  return { root, write, options, revisions: extra => computeSceneTestingRevisions({ ...options, ...extra }) };
}
test('a scene source edit changes only that independent ritual', async t => {
  const f = await fixture(t), before = await f.revisions();
  await f.write('a.ts', "import { target } from './input'; export const scene=()=>target('corrected a');\n");
  const after = await f.revisions();
  assert.notEqual(after.a, before.a); assert.equal(after.b, before.b); assert.equal(after.woodfish, before.woodfish);
});
test('a shared input edit changes exactly its actual consumers', async t => {
  const f = await fixture(t);
  await f.write('b.ts', "import { target } from './input'; export const scene=()=>target('b');\n");
  const before = await f.revisions(); await f.write('input.ts', 'export const target=(id:string)=>id.trim();\n');
  const after = await f.revisions();
  assert.notEqual(after.a, before.a); assert.notEqual(after.b, before.b); assert.equal(after.woodfish, before.woodfish);
});
test('documentation, diagnostic modules and unrelated translations do not reset a ritual', async t => {
  const f = await fixture(t), before = await f.revisions();
  await f.write('README.md', 'New release notes'); await f.write('test-feedback-client.ts', 'changed diagnosis');
  f.options.translations.en['scene.b.title'] = 'Corrected B translation';
  const after = await f.revisions(); assert.equal(after.a, before.a); assert.notEqual(after.b, before.b); assert.equal(after.woodfish, before.woodfish);
  f.options.translations.en['scene.shared.move'] = 'Move this cup';
  const next = await f.revisions(); assert.notEqual(next.a, after.a); assert.equal(next.b, after.b);
});
test('woodfish model edits affect only woodfish', async t => {
  const f = await fixture(t), before = await f.revisions(); await f.write('assets/woodfish.glb', new Uint8Array([1, 2, 4]));
  const after = await f.revisions(); assert.equal(after.a, before.a); assert.equal(after.b, before.b); assert.notEqual(after.woodfish, before.woodfish);
});
test('stable path ordering and normalized line endings produce repeatable hashes', async t => {
  const f = await fixture(t), before = await f.revisions();
  await f.write('a.ts', "import { target } from './input'; export const prompt='Move the cup'; export const scene=()=>target('a');\r\n");
  const after = await f.revisions({ scenes: [...f.options.scenes].reverse() }); assert.deepEqual(after, before);
});
test('unresolved runtime imports fail while missing type-only dependencies do not', async t => {
  const f = await fixture(t);
  await f.write('b.ts', "import type { Hidden } from './absent'; export const scene=()=> 'b';\n"); await f.revisions();
  await f.write('b.ts', "import { target } from './absent'; export const scene=()=>target();\n");
  await assert.rejects(f.revisions(), /Unresolved local scene dependency/);
});
test('a registry barrel cannot make another scene implementation an accidental dependency', async t => {
  const f = await fixture(t);
  await f.write('a.ts', "import { loadScene } from '@wbr/scenes'; export const scene=()=>loadScene('a');\n");
  const before = await f.revisions(); await f.write('b.ts', "export const scene=()=> 'edited b';\n"); const after = await f.revisions();
  assert.equal(after.a, before.a); assert.notEqual(after.b, before.b);
});
test('shared reducer leaves invalidate gameplay without traversing aggregate narrative imports', async t => {
  const f = await fixture(t);
  await f.write('reducer.ts', "import allNarratives from './absent-aggregate'; export const reduce=(s,a)=>a.progress;\n");
  const before = await f.revisions({ sharedLeafRoots: ['reducer.ts'] });
  await f.write('reducer.ts', "import allNarratives from './absent-aggregate'; export const reduce=(s,a)=>Math.min(3,a.progress);\n");
  const after = await f.revisions({ sharedLeafRoots: ['reducer.ts'] });
  for (const id of ['a', 'b', 'woodfish']) assert.notEqual(after[id], before[id]);
});
test('checkpoint and woodfish finish logic are fingerprinted while reporter JSX and CRLF are excluded', () => {
  const source = `function ProceduralScene(){return <div/>;}\nfunction LoadedScene(){const [reporterOpen,setReporterOpen]=useState(false); const feedbackEnabled=true; const checkpoint=n=>save(n); return <><Woodfish onFinish={()=>checkpoint(12)}/>{feedbackEnabled&&<TestFeedbackOverlay title="old"/>}</>;}\nexport function SceneExperience(){return <LoadedScene/>;}\n`;
  const before = gameplayHostSource(source);
  assert.notEqual(gameplayHostSource(source.replace('save(n)', 'save(n+1)')), before);
  assert.notEqual(gameplayHostSource(source.replace('checkpoint(12)', 'checkpoint(13)')), before);
  assert.equal(gameplayHostSource(source.replace('title="old"', 'title="new"')), before);
  assert.equal(gameplayHostSource(source.replaceAll('\n', '\r\n')), before);
});
test('only imported external runtime versions influence the fingerprint', async t => {
  const f = await fixture(t);
  await f.write('a.ts', "import * as THREE from 'three'; export const scene=()=>THREE;\n");
  const before = await f.revisions({ externalVersions: { three: { version: '1' }, typescript: { version: '1' } } });
  const tools = await f.revisions({ externalVersions: { three: { version: '1' }, typescript: { version: '2' } } });
  assert.deepEqual(tools, before);
  const runtime = await f.revisions({ externalVersions: { three: { version: '2' }, typescript: { version: '2' } } });
  assert.notEqual(runtime.a, before.a); assert.equal(runtime.b, before.b);
});
test('unbounded dynamic imports cannot silently omit a runtime dependency', async t => {
  const f = await fixture(t);
  await f.write('a.ts', 'export const scene=(moduleName:string)=>import(moduleName);\n');
  await assert.rejects(f.revisions(), /Nonliteral scene dependency/);
});
