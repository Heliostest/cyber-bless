import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';

const invalid = () => Error('Invalid invitation configuration; original file preserved');
const validLabel = label => typeof label === 'string' && label === label.trim() && label.length > 0 && label.length <= 80 && !/[\x00-\x1f\x7f]/.test(label);

export function validateInvitations(invitations) {
  if (!Array.isArray(invitations) || invitations.length > 200) throw invalid();
  const ids = new Set(), tokens = new Set(), labels = new Set();
  for (const invitation of invitations) {
    if (!invitation || typeof invitation !== 'object' || Array.isArray(invitation) ||
        Object.keys(invitation).some(key => !['id', 'label', 'token', 'createdAt'].includes(key)) ||
        typeof invitation.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(invitation.id) || invitation.id === 'shared' ||
        !validLabel(invitation.label) || typeof invitation.token !== 'string' || !/^[A-Za-z0-9_-]{24,256}$/.test(invitation.token) ||
        (invitation.createdAt !== undefined && (typeof invitation.createdAt !== 'string' || !Number.isFinite(Date.parse(invitation.createdAt)))) ||
        ids.has(invitation.id) || tokens.has(invitation.token) || labels.has(invitation.label)) throw invalid();
    ids.add(invitation.id); tokens.add(invitation.token); labels.add(invitation.label);
  }
  return invitations;
}

export async function readInvitations(file) {
  let raw;
  try { raw = await readFile(file, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  try {
    if (raw.length > 128000) throw invalid();
    const config = JSON.parse(raw);
    if (config?.schemaVersion !== 1 || Object.keys(config).some(key => !['schemaVersion', 'invitations'].includes(key))) throw invalid();
    return validateInvitations(config.invitations);
  } catch { throw invalid(); }
}

async function editInvitations(file, edit) {
  await mkdir(path.dirname(file), { recursive: true });
  let lock;
  try { lock = await open(file + '.lock', 'wx', 0o600); }
  catch (error) { if (error.code === 'EEXIST') throw Error('Invitation configuration is being edited; retry later'); throw error; }
  const temporary = `${file}.${randomUUID()}.tmp`;
  let handle;
  try {
    const { invitations, result } = edit(await readInvitations(file));
    validateInvitations(invitations);
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(JSON.stringify({ schemaVersion: 1, invitations }, null, 2) + '\n');
    await handle.sync(); await handle.close(); handle = undefined;
    await rename(temporary, file);
    return result;
  } finally {
    await handle?.close();
    await rm(temporary, { force: true });
    await lock.close();
    await rm(file + '.lock', { force: true });
  }
}

export async function createInvitations(file, labels) {
  if (!Array.isArray(labels) || !labels.length || labels.length > 50 || !labels.every(validLabel) || new Set(labels).size !== labels.length) throw Error('Provide 1..50 unique invitation labels of 1..80 characters');
  return editInvitations(file, existing => {
    if (labels.some(label => existing.some(invitation => invitation.label === label))) throw Error('Invitation label already exists');
    const created = labels.map(label => ({ id: randomUUID(), label, token: randomBytes(24).toString('base64url'), createdAt: new Date().toISOString() }));
    return { invitations: [...existing, ...created], result: created };
  });
}

export async function revokeInvitation(file, id) {
  return editInvitations(file, existing => {
    if (!existing.some(invitation => invitation.id === id)) throw Error('Invitation ID not found');
    return { invitations: existing.filter(invitation => invitation.id !== id) };
  });
}
