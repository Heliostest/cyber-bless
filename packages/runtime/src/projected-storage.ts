import type { Storage } from './index';

/** Main-save writes and the rebuildable widget cache have separate success states. */
export function createProjectedStorage(storage: Storage, project: (raw: string | null | undefined) => Promise<void>, onError: () => void = () => {}) {
  let writes = Promise.resolve();
  let projection = Promise.resolve();
  let committed: string | null = null;
  let loaded = false;
  const enqueue = (raw: string | null | undefined) => {
    projection = projection.then(() => project(raw)).catch(() => { try { onError(); } catch { /* Diagnostics cannot stall the cache queue. */ } });
  };
  const read = () => {
    const pending = writes.catch(() => {}).then(async () => {
      let raw: string | null;
      try { raw = await storage.read(); }
      catch (error) {
        loaded = false;
        enqueue(undefined); // Unavailable differs from an empty, successfully read save.
        throw error;
      }
      committed = raw;
      loaded = true;
      enqueue(raw);
      return raw;
    });
    writes = pending.then(() => {}, () => {});
    return pending;
  };
  return {
    read,
    write(raw: string) {
      const pending = writes.catch(() => {}).then(async () => {
        await storage.write(raw);
        committed = raw;
        loaded = true;
        enqueue(raw);
      });
      writes = pending;
      return pending;
    },
    async refreshProjection() {
      await writes.catch(() => {});
      if (loaded) enqueue(committed);
      else await read();
      await projection;
    },
    flushProjection: () => projection,
    flushWrites: () => writes,
  };
}
