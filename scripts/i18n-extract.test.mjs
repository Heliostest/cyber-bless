import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditSourceText } from './i18n-extract.mjs';

const registry = {
  sources: new Map([['写好了', [{ id: 'scene.submit', group: 'scene' }]], ['已完成 {p0} 次', [{ id: 'scene.count', group: 'scene' }]]]),
  ids: new Set(['scene.submit', 'scene.count', 'native.failure.retry']),
};

test('a newly introduced unmapped trusted literal fails with its source location', () => {
  const result = auditSourceText('packages/app/src/new.tsx', "const text = tr('新增但未登记的文案');", registry);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0].code, 'unmapped-source');
  assert.equal(result.issues[0].source, '新增但未登记的文案');
  assert.equal(result.issues[0].line, 1);
});

test('known source and complete named templates pass without changing IDs', () => {
  const result = auditSourceText('packages/scenes/src/example/scene.ts', "bindSceneText(button, sceneTemplate('已完成 {p0} 次', {p0: count})); translateScene('写好了');", registry);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.messages.map(item => item.id), ['scene.count', 'scene.submit']);
});

test('raw JSX and DOM copy require a localizing sink even if the source is registered', () => {
  const result = auditSourceText('packages/app/src/new.tsx', "const a = <button title='写好了'>写好了</button>; button.textContent = '写好了';", registry);
  assert.equal(result.issues.filter(item => item.code === 'unlocalized-sink').length, 3);
});

test('unknown metadata and clauses in trusted copy containers fail', () => {
  const result = auditSourceText('packages/scenes/src/example/scene.ts', "const COPY = { hint: '新提示' }; setSafeText(hint, COPY.hint, safe);", registry);
  assert.ok(result.issues.some(item => item.source === '新提示' && item.code === 'unmapped-source'));
  const metadata = auditSourceText('packages/core/src/daily-scenes.ts', "const scenes = [{id: 'x', title: '未登记标题', engine: '技术引擎', steps: ['新步骤']}];", registry);
  assert.deepEqual(metadata.issues.map(item => item.source).sort(), ['新步骤', '未登记标题']);
});

test('raw dynamic interpolation is rejected and user or technical fields stay outside extraction', () => {
  const result = auditSourceText('packages/app/src/new.tsx', "tr(`已完成 ${count} 次`); const a = <p>{wish.text}</p>; const technical = '技术字符串';", registry);
  assert.ok(result.issues.some(item => item.code === 'dynamic-source'));
  assert.ok(!result.messages.some(item => item.source === '技术字符串'));
  assert.ok(!result.issues.some(item => item.source === 'wish.text'));
});

test('original artifact inscriptions are exempt only at the documented drawing sink', () => {
  const original = auditSourceText('packages/app/src/scene-icons.tsx', 'const x = <text>{"運"}</text>;', registry);
  assert.deepEqual(original.issues, []);
  assert.equal(original.exemptions.length, 1);
  const copied = auditSourceText('packages/app/src/new.tsx', 'const x = <button>{"運"}</button>;', registry);
  assert.ok(copied.issues.some(item => item.code === 'unlocalized-sink'));
});

test('semantic message IDs and named imports are checked', () => {
  const result = auditSourceText('packages/app/src/new.tsx', "import {translate as localize} from '@wbr/i18n'; localize('新增'); message('native.failure.retry'); message('missing.id');", registry);
  assert.ok(result.issues.some(item => item.source === '新增'));
  assert.ok(result.issues.some(item => item.code === 'unknown-message-id' && item.source === 'missing.id'));
  assert.ok(!result.issues.some(item => item.source === 'native.failure.retry'));
});

test('source clauses, product errors and accessible value text cannot bypass registration', () => {
  const result = auditSourceText('packages/app/src/new.tsx', "sceneJoin('新子句', sceneProductCopy('新产品参数')); productError('New product error'); const button = <input aria-valuetext='未知值' />;", registry);
  assert.deepEqual(result.issues.map(item => item.source).sort(), ['New product error', '新产品参数', '新子句', '未知值']);
});

test('module copy constants are followed, while numeric composition stays outside language extraction', () => {
  const result = auditSourceText('packages/app/src/new.tsx', "const NEW_COPY = '新文案'; tr(NEW_COPY); const value = <p>{index + 1}</p>; output.textContent = `${formatNumber(n)}/${formatNumber(max)}`;", registry);
  assert.deepEqual(result.issues.map(item => item.source), ['新文案']);
  assert.equal(result.dynamic.length, 2);
});

test('a fixed brand lockup exemption cannot hide copy in a different UI sink', () => {
  const source = 'CYBER BLESS · A LITTLE EVERY DAY';
  const original = auditSourceText('packages/app/src/App.tsx', `<div className="desktop-note"><span>${source}</span></div>`, registry);
  assert.deepEqual(original.issues, []);
  const moved = auditSourceText('packages/app/src/App.tsx', `<button>${source}</button>`, registry);
  assert.equal(moved.issues[0].code, 'unlocalized-sink');
});

test('the exact cue SVG shell is exempt only when its icon table contains geometry alone', () => {
  const shell = 'direction.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[cue.kind]}</svg>`;';
  const good = auditSourceText('packages/scene-runtime/src/interaction-cues.ts', `const icons = {tap: '<path d="M0 0"/>'}; ${shell}`, registry);
  assert.deepEqual(good.issues, []);
  const bad = auditSourceText('packages/scene-runtime/src/interaction-cues.ts', `const icons = {tap: '<text>新文案</text>'}; ${shell}`, registry);
  assert.equal(bad.issues[0].code, 'dynamic-source');
  const accessible = auditSourceText('packages/scene-runtime/src/interaction-cues.ts', `const icons = {tap: '<path aria-label="新文案" d="M0 0"/>'}; ${shell}`, registry);
  assert.equal(accessible.issues[0].code, 'dynamic-source');
});
