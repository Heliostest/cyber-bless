import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { feedbackDefaults } from './cli.mjs';
import { loadTunnelConfig } from './tunnel.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const delay = (ms, signal) => new Promise(resolve => {
  if (signal?.aborted) return resolve();
  const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', done); resolve(); };
  const timer = setTimeout(done, ms); signal?.addEventListener('abort', done, { once: true });
});

export function createServiceLogger(file, { maxBytes = 1024 * 1024, stdout = line => process.stdout.write(line) } = {}) {
  mkdirSync(path.dirname(file), { recursive: true });
  return message => {
    const line = `[${new Date().toISOString()}] ${message}\n`;
    try {
      try { if (statSync(file).size >= maxBytes) renameSync(file, `${file}.1`); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      appendFileSync(file, line, { mode: 0o600 });
    } catch { process.stderr.write('Feedback supervisor could not persist its log.\n'); }
    try { stdout(line); } catch { /* A detached terminal must not stop receipt of feedback. */ }
  };
}

/** Kernel-owned local lock: a stale PID file must never cause an unrelated process to be killed. */
export async function acquireSupervisorLock(port = 4320) {
  const server = net.createServer(socket => socket.end());
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen({ port, host: '127.0.0.1', exclusive: true }, resolve); });
  } catch (error) {
    if (error.code === 'EADDRINUSE') throw Error(`Feedback supervisor already running or local lock port ${port} in use`);
    throw error;
  }
  return { port: server.address().port, close: () => new Promise(resolve => server.close(resolve)) };
}

export function trackTunnelAddress({ log, update, expectedUrl }) {
  let previous = '';
  return state => {
    const url = state.status === 'running' ? state.publicUrl : '';
    if (url && (expectedUrl ? url !== expectedUrl : !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(url))) return;
    update({ tunnel: url ? 'running' : 'restarting', publicUrl: url });
    if (url && url !== previous) { log(`Public upload URL: ${url}`); previous = url; }
  };
}

/** One child at a time; every retry, health check and graceful stop belongs to this lifecycle. */
export async function superviseProcess({ name, spawnChild, signal, log, canStart = () => true,
  onMessage = () => {}, onDown = () => {}, checkHealth, retryMs = 1000, maxRetryMs = 60000,
  healthIntervalMs = 15000, startupGraceMs = 15000, failuresBeforeRestart = 3, stopTimeoutMs = 3000 }) {
  let failures = 0;
  while (!signal.aborted) {
    if (!canStart()) { await delay(retryMs, signal); continue; }
    const started = Date.now();
    try {
      const child = spawnChild();
      await new Promise(resolve => {
        let finished = false, stopping = false, checking = false, unhealthy = 0, forceTimer, healthTimer;
        const finish = (code, cause) => {
          if (finished) return; finished = true;
          clearTimeout(forceTimer); clearInterval(healthTimer);
          signal.removeEventListener('abort', stop); child.removeListener('message', message);
          onDown();
          if (!signal.aborted) log(`${name} stopped (${cause ?? code ?? 'unknown'}); will retry.`);
          resolve();
        };
        const stop = () => {
          if (stopping || finished) return; stopping = true;
          forceTimer = setTimeout(() => { try { child.kill(); } catch { /* Already gone. */ } }, stopTimeoutMs);
          if (child.connected) { try { child.send({ type: 'shutdown' }, () => {}); } catch { child.kill(); } }
          else child.kill();
        };
        const message = value => { if (!finished && !stopping) onMessage(value); };
        child.on('message', message);
        child.once('error', () => finish(null, 'spawn error'));
        // On Windows, parent-side IPC disconnect can omit 'close' even after 'exit'.
        child.once('exit', code => finish(code));
        child.once('close', code => finish(code));
        signal.addEventListener('abort', stop, { once: true });
        if (signal.aborted) stop();
        if (checkHealth && !finished) healthTimer = setInterval(async () => {
          if (checking || stopping || finished || Date.now() - started < startupGraceMs) return;
          checking = true;
          try {
            const healthy = await checkHealth();
            if (finished || stopping || signal.aborted) return;
            unhealthy = healthy ? 0 : unhealthy + 1;
            if (unhealthy >= failuresBeforeRestart) { log(`${name} health checks failed; restarting.`); stop(); }
          } catch {
            if (!finished && !stopping && ++unhealthy >= failuresBeforeRestart) { log(`${name} health checks failed; restarting.`); stop(); }
          } finally { checking = false; }
        }, healthIntervalMs);
      });
    } catch { onDown(); log(`${name} could not start; will retry.`); }
    if (signal.aborted) break;
    failures = Date.now() - started >= 120000 ? 0 : failures + 1;
    const retry = Math.min(maxRetryMs, retryMs * 2 ** Math.min(failures - 1, 10));
    log(`${name} retry in ${Math.round(retry / 1000)}s.`);
    await delay(retry, signal);
  }
}

function writeState(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  renameSync(temporary, file);
}
async function health(url) {
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000), redirect: 'error', cache: 'no-store' });
    return response.ok && (await response.json()).ok === true;
  } catch { return false; }
}

export async function main({ defaults = feedbackDefaults(), lockPort = 4320 } = {}) {
  const directory = path.dirname(defaults.runtimeFile);
  const log = createServiceLogger(path.join(directory, 'supervisor.log'));
  let lock;
  try { lock = await acquireSupervisorLock(lockPort); }
  catch (error) { log(error.message); process.exitCode = 1; return; }
  const abort = new AbortController();
  const stop = () => abort.abort();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  const state = { schemaVersion: 1, pid: process.pid, status: 'running', receiver: 'restarting', tunnel: 'restarting', publicUrl: '' };
  const update = patch => {
    Object.assign(state, patch, { updatedAt: new Date().toISOString() });
    try { writeState(path.join(directory, 'supervisor-runtime.json'), state); }
    catch { log('Unable to update supervisor state file.'); }
  };
  const launch = command => spawn(process.execPath, [cli, command], {
    cwd: root, windowsHide: true, shell: false, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  try {
    // Clear any stale URL before a replacement tunnel can announce readiness.
    writeState(defaults.runtimeFile, { schemaVersion: 1, status: 'starting', publicUrl: '', updatedAt: new Date().toISOString() });
    update({});
    const fixed = await loadTunnelConfig(defaults.tunnelConfig);
    const tunnelAddress = trackTunnelAddress({ log, update, expectedUrl: fixed?.publicUrl });
    log('Feedback supervisor started. Local inbox: http://127.0.0.1:4319/');
    await Promise.all([
      superviseProcess({ name: 'Receiver', signal: abort.signal, log,
        spawnChild: () => launch('serve'),
        onMessage: message => { if (message?.type === 'receiver-ready') { update({ receiver: 'running' }); log('Receiver ready on 4318; dashboard remains local on 4319.'); } },
        onDown: () => update({ receiver: 'restarting' }),
        checkHealth: () => state.receiver === 'running' && health('http://127.0.0.1:4318'),
      }),
      superviseProcess({ name: 'Tunnel', signal: abort.signal, log, startupGraceMs: 90000, healthIntervalMs: 30000,
        canStart: () => state.receiver === 'running',
        spawnChild: () => launch('tunnel'),
        onMessage: message => { if (message?.type === 'tunnel-status') tunnelAddress(message); },
        onDown: () => {
          tunnelAddress({ status: 'stopped' });
          try { writeState(defaults.runtimeFile, { schemaVersion: 1, status: 'stopped', publicUrl: '', updatedAt: new Date().toISOString() }); } catch { log('Unable to clear tunnel state.'); }
        },
        checkHealth: () => !!state.publicUrl && health(state.publicUrl),
      }),
    ]);
  } finally {
    abort.abort(); update({ status: 'stopped', receiver: 'restarting', tunnel: 'restarting', publicUrl: '' });
    try { writeState(defaults.runtimeFile, { schemaVersion: 1, status: 'stopped', publicUrl: '', updatedAt: new Date().toISOString() }); } catch { log('Unable to clear tunnel state.'); }
    process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    await lock.close(); log('Feedback supervisor stopped.');
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
  console.error('Feedback supervisor failed; the Windows runner will retry.'); process.exitCode = 1;
});
