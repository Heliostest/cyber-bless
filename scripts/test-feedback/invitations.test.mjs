import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as cli from './cli.mjs';

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'feedback-invitations-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  assert.equal(typeof cli.createInvitations, 'function');
  assert.equal(typeof cli.readInvitations, 'function');
  return path.join(directory, 'invitations.json');
}

test('named invitations persist independently and revocation preserves the remaining codes', async t => {
  const file = await fixture(t);
  assert.deepEqual(await cli.readInvitations(file), []);
  const created = await cli.createInvitations(file, ['测试员01', '测试员02']);
  assert.equal(created.length, 2);
  assert.equal(new Set(created.map(i => i.token)).size, 2);
  assert.ok(created.every(i => i.token.length >= 24 && i.label && i.id));
  assert.deepEqual(await cli.readInvitations(file), created);
  const extra = await cli.createInvitations(file, ['测试员03']);
  assert.deepEqual(await cli.readInvitations(file), [...created, ...extra]);
  await cli.revokeInvitation(file, created[0].id);
  assert.deepEqual(await cli.readInvitations(file), [created[1], extra[0]]);
});

test('invalid batches and damaged invitation configuration are preserved without partial changes or secrets in errors', async t => {
  const file = await fixture(t);
  await cli.createInvitations(file, ['测试员01']);
  const before = await readFile(file, 'utf8');
  for (const labels of [[], ['测试员01'], ['重复', '重复'], [''], ['a'.repeat(81)]]) {
    await assert.rejects(cli.createInvitations(file, labels));
    assert.equal(await readFile(file, 'utf8'), before);
  }
  await writeFile(file, '{damaged-private-code');
  await assert.rejects(cli.readInvitations(file), error => !error.message.includes('private-code'));
  await assert.rejects(cli.createInvitations(file, ['测试员02']));
  assert.equal(await readFile(file, 'utf8'), '{damaged-private-code');
});

test('ambiguous token/id configuration is rejected and concurrent edits cannot overwrite invitations', async t => {
  const file = await fixture(t);
  const [first] = await cli.createInvitations(file, ['测试员01']);
  const config = { schemaVersion: 1, invitations: [first, { ...first, id: 'another-id', label: '另一个人' }] };
  await writeFile(file, JSON.stringify(config));
  await assert.rejects(cli.readInvitations(file));
  await writeFile(file, JSON.stringify({ schemaVersion: 1, invitations: [first] }));
  await writeFile(file + '.lock', 'another writer');
  await assert.rejects(cli.createInvitations(file, ['测试员02']), /being edited/);
  assert.deepEqual(await cli.readInvitations(file), [first]);
});
