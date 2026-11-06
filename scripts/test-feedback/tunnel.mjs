import { spawn } from 'node:child_process';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function quickTunnelUrl(text) {
  return text.match(/https:\/\/(?!api\.)([a-z0-9-]+)\.trycloudflare\.com\b/i)?.[0];
}

/** An absent file preserves Quick Tunnel mode; an invalid file never silently falls back. */
export async function loadTunnelConfig(file) {
  let raw;
  try { raw = await readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return undefined; throw error; }
  try {
    const value = JSON.parse(raw), url = new URL(value.publicUrl);
    if (value.schemaVersion !== 1 || typeof value.publicUrl !== 'string' ||
        typeof value.tokenFile !== 'string' || !value.tokenFile.trim() ||
        Object.keys(value).some(key => !['schemaVersion', 'publicUrl', 'tokenFile'].includes(key)) ||
        url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port ||
        !['', '/'].includes(url.pathname) || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(url.hostname) ||
        /^\d+(?:\.\d+){3}$/.test(url.hostname) || url.hostname.endsWith('.localhost')) throw Error();
    return { publicUrl: url.origin, tokenFile: path.resolve(path.dirname(file), value.tokenFile) };
  } catch { throw Error('Invalid fixed tunnel configuration; original file preserved'); }
}

/** Only the feedback intake/authenticated-summary port is exposed, never the local dashboard. */
export async function startFeedbackTunnel({ port = 4318, runtimeFile, fixed, onStatus = () => {}, spawnProcess = spawn, binary = process.env.CLOUDFLARED ||
  (process.platform === 'win32' ? 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe' : 'cloudflared') }) {
  const local = `http://127.0.0.1:${port}`;
  const check = await fetch(`${local}/health`, { signal: AbortSignal.timeout(3000) });
  if (!check.ok || (await check.json()).ok !== true) throw Error('Start the feedback receiver before opening the tunnel');
  if (fixed) await access(fixed.tokenFile);
  await mkdir(path.dirname(runtimeFile), { recursive: true });
  const args = fixed
    ? ['--no-autoupdate', 'tunnel', '--protocol', 'http2', 'run', '--token-file', fixed.tokenFile]
    : ['--no-autoupdate', 'tunnel', '--url', local, '--protocol', 'http2'];
  const env = { ...process.env };
  if (fixed) { delete env.TUNNEL_TOKEN; delete env.TUNNEL_TOKEN_FILE; }
  const child = spawnProcess(binary, args,
    { windowsHide: true, shell: false, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let publicUrl = '', tail = '', writes = Promise.resolve();
  const publish = status => {
    const state = { schemaVersion: 1, pid: child.pid, status, publicUrl: status === 'running' ? publicUrl : '',
      lastPublicUrl: publicUrl, submitPort: port, updatedAt: new Date().toISOString() };
    onStatus(state);
    writes = writes.then(async () => {
      const temporary = `${runtimeFile}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
      await rename(temporary, runtimeFile);
    }).catch(() => { console.error('Unable to update local tunnel status file'); });
  };
  const output = bytes => {
    tail = (tail + bytes.toString('utf8')).slice(-8192);
    const match = fixed ? (/Registered tunnel connection\b/.test(tail) ? fixed.publicUrl : undefined) : quickTunnelUrl(tail);
    if (!publicUrl && match) {
      publicUrl = match; publish('running');
      console.log(`${fixed ? 'Fixed' : 'Temporary'} feedback upload URL: ${publicUrl}`);
      console.log('Copy the invitation from the local inbox dashboard.');
    }
  };
  child.stdout.on('data', output); child.stderr.on('data', output);
  child.once('error', () => { publish('stopped'); console.error('Unable to start cloudflared; check the installed executable and external configuration.'); process.exitCode = 1; });
  // close also fires for spawn errors; finish only after output and state writes drain.
  child.feedbackFinished = new Promise(resolve => child.once('close', async (code, signal) => {
    publish('stopped');
    if (!publicUrl && code) console.error('Feedback tunnel did not start. Check connector configuration and networking.');
    else console.log(`Feedback tunnel stopped (${signal ?? code ?? 0}).`);
    process.exitCode = code ?? 0;
    await writes; resolve();
  }));
  const stop = () => { if (!child.killed) child.kill(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  child.once('exit', () => { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); });
  publish('starting');
  console.log(`Opening only feedback submission port ${port}; local dashboard is not tunneled.`);
  return child;
}

export const startQuickTunnel = startFeedbackTunnel;
