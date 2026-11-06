import test from 'node:test';
import assert from 'node:assert/strict';
import { quickTunnelUrl } from './tunnel.mjs';
import { loadTunnelConfig, startFeedbackTunnel } from './tunnel.mjs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { EventEmitter, once } from 'node:events';
import { PassThrough } from 'node:stream';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

test('captures the temporary upload hostname but never mistakes the Cloudflare API for it', () => {
  assert.equal(quickTunnelUrl('failed POST https://api.trycloudflare.com/tunnel'), undefined);
  assert.equal(quickTunnelUrl('Your quick Tunnel\nhttps://four-words-test-url.trycloudflare.com\n'), 'https://four-words-test-url.trycloudflare.com');
});

test('fixed tunnel configuration resolves an external credential file and refuses malformed configuration', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'feedback-fixed-tunnel-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = path.join(directory, 'tunnel.json');
  assert.equal(await loadTunnelConfig(file), undefined);
  await writeFile(file, JSON.stringify({ schemaVersion: 1, publicUrl: 'https://feedback.heliosoft.win/', tokenFile: 'connector.token' }));
  assert.deepEqual(await loadTunnelConfig(file), { publicUrl: 'https://feedback.heliosoft.win', tokenFile: path.join(directory, 'connector.token') });
  for (const publicUrl of ['http://feedback.heliosoft.win', 'https://user:secret@feedback.heliosoft.win',
    'https://feedback.heliosoft.win?token=secret', 'https://feedback.heliosoft.win/admin', 'https://127.0.0.1', 'https://feedback.heliosoft.win:4319']) {
    await writeFile(file, JSON.stringify({ schemaVersion: 1, publicUrl, tokenFile: 'connector.token' }));
    await assert.rejects(loadTunnelConfig(file), /Invalid fixed tunnel configuration/);
  }
  await writeFile(file, '{broken');
  await assert.rejects(loadTunnelConfig(file), /Invalid fixed tunnel configuration/);
});

test('named tunnel keeps its hostname across restarts and publishes readiness only after a connected event', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'feedback-named-lifecycle-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const tokenFile = path.join(directory, 'connector.token'), secret = 'a-private-connector-token';
  await writeFile(tokenFile, secret);
  const server = http.createServer((_, response) => response.end('{"ok":true}'));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const launches = [], states = [];
  function spawnProcess(binary, args, options) {
    launches.push({ binary, args, options });
    const child = new EventEmitter();
    child.pid = 1234; child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.killed = false;
    child.kill = () => { child.killed = true; child.emit('exit', 0); child.emit('close', 0); };
    return child;
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    const runtimeFile = path.join(directory, 'runtime.json');
    const child = await startFeedbackTunnel({ port: server.address().port, runtimeFile, binary: 'cloudflared', spawnProcess,
      fixed: { publicUrl: 'https://feedback.heliosoft.win', tokenFile }, onStatus: state => states.push(state) });
    assert.equal(states.at(-1).status, 'starting');
    child.stderr.write('Starting tunnel; waiting for connection\n');
    assert.equal(states.at(-1).publicUrl, '');
    child.stderr.write('Registered tunnel connection connIndex=0 protocol=http2\n');
    assert.equal(states.at(-1).publicUrl, 'https://feedback.heliosoft.win');
    child.kill(); await child.feedbackFinished;
    const saved = JSON.parse(await readFile(runtimeFile, 'utf8'));
    assert.equal(saved.status, 'stopped'); assert.equal(saved.publicUrl, '');
    assert.equal(saved.lastPublicUrl, 'https://feedback.heliosoft.win');
  }
  assert.equal(launches.length, 2);
  for (const launch of launches) {
    assert.ok(launch.args.includes('run')); assert.ok(launch.args.includes('--token-file'));
    assert.ok(launch.args.includes(tokenFile)); assert.ok(!launch.args.includes('--url'));
    assert.ok(!launch.args.join(' ').includes(secret)); assert.equal(launch.options.windowsHide, true);
  }
  assert.equal(states.filter(state => state.status === 'running').length, 2);
});
