import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const temporary = async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'feedback-lifecycle-'));
  t.after(() => rm(directory, { recursive: true, force: true })); return directory;
};
async function unusedPort() {
  const server = net.createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = server.address().port; await new Promise(resolve => server.close(resolve)); return String(port);
}
function childProcess(t, args, env) {
  const child = fork(cli, args, { env: { ...process.env, ...env }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true });
  t.after(() => { if (child.exitCode === null) child.kill(); }); return child;
}
async function bounded(promise, stage = 'child close') {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error(`Lifecycle timeout: ${stage}`)), 7000); })]); }
  finally { clearTimeout(timer); }
}

test('receiver drops its listeners when the supervisor IPC connection disappears', async t => {
  const dir = await temporary(t), submitPort = await unusedPort(), adminPort = await unusedPort();
  const child = childProcess(t, ['serve', '--submit-port', submitPort, '--admin-port', adminPort,
    '--config', path.join(dir, 'config.json'), '--inbox', path.join(dir, 'inbox'), '--runtime-file', path.join(dir, 'runtime.json')]);
  const [ready] = await bounded(once(child, 'message'), 'receiver ready');
  assert.equal(ready.type, 'receiver-ready');
  const response = await fetch(`http://127.0.0.1:${submitPort}/health`);
  assert.equal(response.status, 200); assert.equal((await response.json()).ok, true);
  const pending = net.connect(Number(submitPort), '127.0.0.1');
  t.after(() => pending.destroy()); await once(pending, 'connect');
  pending.write('POST /api/feedback HTTP/1.1\r\nHost: localhost\r\n');
  const closed = once(child, 'exit'); child.disconnect();
  assert.equal((await bounded(closed))[0], 0);
  await assert.rejects(fetch(`http://127.0.0.1:${submitPort}/health`));
});

test('tunnel wrapper does not remain alive on its IPC pipe after cloudflared fails to spawn', async t => {
  const dir = await temporary(t), server = http.createServer((_, response) => response.end('{"ok":true}'));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const child = childProcess(t, ['tunnel', '--submit-port', String(server.address().port), '--runtime-file', path.join(dir, 'runtime.json')],
    { CLOUDFLARED: path.join(dir, 'does-not-exist.exe') });
  const states = []; child.on('message', message => states.push(message));
  await bounded(once(child, 'close'));
  assert.ok(states.some(state => state.status === 'stopped' && state.publicUrl === ''));
});
