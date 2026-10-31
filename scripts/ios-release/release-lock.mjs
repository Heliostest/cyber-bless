import { randomUUID } from 'node:crypto';
import { open, readFile, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';

export const OFFICIAL_BUILD_ROOT = '/Users/heli/ios-builds/cyber-bless';
export function assertOfficialBuildRoot(buildRoot) {
  if (buildRoot !== OFFICIAL_BUILD_ROOT) throw Error('This App uses one fixed official build root: ' + OFFICIAL_BUILD_ROOT);
}

export async function withReleaseLock(buildRoot, action) {
  const root = path.resolve(buildRoot);
  if (await realpath(root) !== root) throw Error('Release root must not be symlinked');
  const file = path.join(root, '.release.lock');
  const owner = JSON.stringify({ token: randomUUID(), pid: process.pid, startedAt: new Date().toISOString() });
  let handle;
  try { handle = await open(file, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw Error('Another release already owns the app lock; inspect it before removing a stale lock');
    throw error;
  }
  try {
    await handle.writeFile(owner);
    await handle.close();
    return await action({ token: JSON.parse(owner).token, root });
  } finally {
    await handle.close().catch(() => {});
    if (await readFile(file, 'utf8').catch(() => null) === owner) await unlink(file);
  }
}

export async function assertReleaseLock(buildRoot, env = process.env) {
  if (!path.isAbsolute(buildRoot ?? '') || !env.WBR_RELEASE_LOCK_TOKEN) throw Error('Run release stages through release-runner.mjs to hold the app lock');
  const root = path.resolve(buildRoot);
  if (await realpath(root) !== root) throw Error('Release lock root is symlinked');
  let owner;
  try { owner = JSON.parse(await readFile(path.join(root, '.release.lock'), 'utf8')); }
  catch { throw Error('The active release lock is missing or invalid'); }
  if (owner.token !== env.WBR_RELEASE_LOCK_TOKEN || !Number.isSafeInteger(owner.pid)) throw Error('This process does not own the active app release lock');
  try { process.kill(owner.pid, 0); }
  catch { throw Error('The app release runner is no longer active'); }
}
