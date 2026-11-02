import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function quickTunnelUrl(text) {
  return text.match(/https:\/\/(?!api\.)([a-z0-9-]+)\.trycloudflare\.com\b/i)?.[0];
}

/** Only the feedback intake/authenticated-summary port is exposed, never the local dashboard. */
export async function startQuickTunnel({ port = 4318, runtimeFile, binary = process.env.CLOUDFLARED ||
  (process.platform === 'win32' ? 'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe' : 'cloudflared') }) {
  const local = `http://127.0.0.1:${port}`;
  const check = await fetch(`${local}/health`, { signal: AbortSignal.timeout(3000) });
  if (!check.ok || (await check.json()).ok !== true) throw Error('Start the feedback receiver before opening the tunnel');
  await mkdir(path.dirname(runtimeFile), { recursive: true });
  const child = spawn(binary, ['--no-autoupdate', 'tunnel', '--url', local, '--protocol', 'http2'],
    { windowsHide: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
  let publicUrl = '', tail = '', writes = Promise.resolve();
  const publish = status => {
    writes = writes.then(() => writeFile(runtimeFile, JSON.stringify({ schemaVersion: 1, pid: child.pid, status,
      publicUrl: status === 'running' ? publicUrl : '', lastPublicUrl: publicUrl, submitPort: port, updatedAt: new Date().toISOString() }, null, 2) + '\n'));
    writes.catch(() => { console.error('Unable to update local tunnel status file'); });
  };
  const output = bytes => {
    tail = (tail + bytes.toString('utf8')).slice(-8192);
    const match = quickTunnelUrl(tail);
    if (!publicUrl && match) { publicUrl = match; publish('running'); console.log(`Temporary feedback upload URL: ${publicUrl}`); console.log('Copy the invitation from the local inbox dashboard. This address lasts only while the tunnel runs.'); }
  };
  child.stdout.on('data', output); child.stderr.on('data', output);
  child.once('error', error => { publish('stopped'); console.error(`Unable to start cloudflared: ${error.message}`); process.exitCode = 1; });
  child.once('exit', (code, signal) => {
    publish('stopped');
    if (!publicUrl && code) console.error('Quick Tunnel did not start. Check cloudflared networking or retry later.');
    else console.log(`Feedback tunnel stopped (${signal ?? code ?? 0}).`);
    process.exitCode = code ?? 0;
  });
  const stop = () => { if (!child.killed) child.kill(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  child.once('exit', () => { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); });
  publish('starting');
  console.log(`Opening only feedback submission port ${port}; local dashboard is not tunneled.`);
  return child;
}
