import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createServiceLogger, acquireSupervisorLock, superviseProcess, trackTunnelAddress } from './supervisor.mjs';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) { for (let n = 0; n < 150; n++) { if (check()) return; await pause(5); } assert.fail('Timed out'); }
function fakeChild() {
  const child = new EventEmitter();
  child.connected = true; child.exitCode = null;
  child.send = message => { if (message.type === 'shutdown') { child.sentShutdown = true; child.exitCode = 0; child.emit('close', 0); } };
  child.kill = () => { child.killed = true; child.exitCode = 1; child.emit('close', 1); };
  return child;
}

test('restarts on exit even when Windows omits close, and shutdown cancels future retries', async () => {
  const abort = new AbortController(), children = [], messages = [];
  const work = superviseProcess({ name: 'receiver', signal: abort.signal, retryMs: 5, maxRetryMs: 10,
    spawnChild: () => { const c = fakeChild(); children.push(c); return c; }, log: m => messages.push(m) });
  await until(() => children.length === 1);
  children[0].exitCode = 1; children[0].emit('exit', 1);
  await until(() => children.length === 2);
  abort.abort(); await work; await pause(25);
  assert.equal(children.length, 2); assert.equal(children[1].sentShutdown, true);
  assert.ok(messages.some(m => m.includes('retry')));
});

test('consecutive health failures terminate and replace a hung child without overlapping launches', async () => {
  const abort = new AbortController(), children = [];
  let checks = 0;
  const work = superviseProcess({ name: 'tunnel', signal: abort.signal, retryMs: 5, maxRetryMs: 10,
    healthIntervalMs: 5, startupGraceMs: 0, failuresBeforeRestart: 2, checkHealth: async () => { checks++; return false; },
    spawnChild: () => { const c = fakeChild(); children.push(c); return c; }, log: () => {} });
  await until(() => children.length === 2);
  abort.abort(); await work;
  assert.ok(checks >= 2); assert.equal(children[0].sentShutdown, true);
  assert.equal(children[1].sentShutdown, true);
});

test('a failed spawn retries and an inactive prerequisite prevents launching', async () => {
  const abort = new AbortController(); let count = 0, allowed = false;
  const work = superviseProcess({ name: 'receiver', signal: abort.signal, retryMs: 5, maxRetryMs: 10,
    canStart: () => allowed, spawnChild: () => { count++; throw Error('missing executable'); }, log: () => {} });
  await pause(20); assert.equal(count, 0); allowed = true;
  await until(() => count >= 2); abort.abort(); await work;
});

test('the OS lock refuses a second supervisor and can be reacquired after close', async () => {
  const first = await acquireSupervisorLock(0);
  await assert.rejects(acquireSupervisorLock(first.port), /already running|in use/);
  await first.close(); const second = await acquireSupervisorLock(first.port); await second.close();
});

test('URL changes print once, clear on outage, and reject unrelated hostnames', () => {
  const messages = [], states = [];
  const track = trackTunnelAddress({ log: m => messages.push(m), update: s => states.push(s) });
  track({ status: 'running', publicUrl: 'https://one-test-url.trycloudflare.com' });
  track({ status: 'running', publicUrl: 'https://one-test-url.trycloudflare.com' });
  track({ status: 'stopped' });
  track({ status: 'running', publicUrl: 'https://two-test-url.trycloudflare.com' });
  track({ status: 'running', publicUrl: 'https://evil.example' });
  assert.equal(messages.filter(m => m.includes('Public upload URL')).length, 2);
  assert.equal(states[2].publicUrl, ''); assert.equal(states.at(-1).publicUrl, 'https://two-test-url.trycloudflare.com');
});

test('logs persist safe timestamped messages and rotate at a bounded size', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'feedback-log-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'supervisor.log');
  const log = createServiceLogger(file, { maxBytes: 150, stdout: () => {} });
  for (let n = 0; n < 10; n++) log(`event ${n}`);
  const content = await readFile(file, 'utf8');
  assert.match(content, /\d{4}-\d{2}-\d{2}T/); assert.match(content, /event 9/);
  assert.ok((await readFile(`${file}.1`, 'utf8')).length <= 200);
});
