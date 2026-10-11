import { expect, it, vi } from 'vitest';
import { createProjectedStorage } from './projected-storage';

it('projects exact committed saves in order and never projects a failed write', async () => {
  const projected: string[] = [];
  const writes: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>(r => { release = r; });
  const storage = createProjectedStorage({ read: async () => 'S0', write: async raw => { writes.push(raw); if (raw === 'S2') throw Error('disk full'); } }, async raw => { await gate; projected.push(raw ?? 'null'); });
  await storage.write('S1');
  await expect(storage.write('S2')).rejects.toThrow('disk full');
  await storage.write('S3');
  expect(writes).toEqual(['S1', 'S2', 'S3']);
  expect(projected).toEqual([]);
  release();
  await storage.flushProjection();
  expect(projected).toEqual(['S1', 'S3']);
});
it('keeps cache errors independent and retries the latest committed raw', async () => {
  const project = vi.fn().mockRejectedValueOnce(Error('cache')).mockResolvedValue(undefined);
  const error = vi.fn();
  const storage = createProjectedStorage({ read: async () => null, write: async () => {} }, project, error);
  await expect(storage.write('committed')).resolves.toBeUndefined();
  await storage.flushProjection();
  expect(error).toHaveBeenCalledOnce();
  await storage.refreshProjection();
  expect(project.mock.calls.map(c => c[0])).toEqual(['committed', 'committed']);
});
it('serializes read/refresh behind writes and does not forget the last good raw on failure', async () => {
  let raw = 'S0';
  const projected: (string | null | undefined)[] = [];
  const storage = createProjectedStorage({ read: async () => raw, write: async next => { if (next === 'bad') throw Error('disk'); raw = next; } }, async next => { projected.push(next); });
  await storage.read();
  await storage.write('S1');
  await expect(storage.write('bad')).rejects.toThrow();
  await storage.refreshProjection();
  await storage.flushProjection();
  expect(projected.at(-1)).toBe('S1');
});
it('serializes slow reads with later writes so an old read cannot overwrite the projection', async () => {
  let release!: (raw: string) => void;
  const projected: (string | null | undefined)[] = [];
  const storage = createProjectedStorage({ read: () => new Promise<string>(r => { release = r; }), write: async () => {} }, async raw => { projected.push(raw); });
  const reading = storage.read();
  for (let i = 0; i < 4; i++) await Promise.resolve();
  const writing = storage.write('S1');
  for (let i = 0; i < 8; i++) await Promise.resolve();
  release('S0');
  await Promise.all([reading, writing]);
  await storage.refreshProjection();
  expect(projected).toEqual(['S0', 'S1', 'S1']);
});
it('publishes an unavailable-source fallback on read failure and rebuilds after retry', async () => {
  const read = vi.fn().mockResolvedValueOnce('S0').mockRejectedValueOnce(Error('unavailable')).mockRejectedValueOnce(Error('unavailable')).mockResolvedValueOnce('S1');
  const project = vi.fn().mockResolvedValue(undefined);
  const storage = createProjectedStorage({ read, write: async () => {} }, project);
  await storage.read();
  await expect(storage.read()).rejects.toThrow('unavailable');
  await storage.flushProjection();
  expect(project.mock.calls.map(c => c[0])).toEqual(['S0', undefined]);
  await expect(storage.refreshProjection()).rejects.toThrow('unavailable');
  await storage.flushProjection();
  expect(project.mock.calls.at(-1)?.[0]).toBeUndefined();
  await storage.read();
  await storage.refreshProjection();
  expect(project.mock.calls.at(-1)?.[0]).toBe('S1');
});
