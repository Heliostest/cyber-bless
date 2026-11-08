import type { TestFeedbackHost } from '@wbr/runtime';
import { sha256 } from '@wbr/content';
import { FEEDBACK_MAX_MESSAGE_LENGTH, normalizeFeedbackEndpoint, parseFeedbackReceipt, parseFeedbackReport,
  parseFeedbackTeamStatus, parseFeedbackStatusQuery,
  parseFeedbackHistoryQuery,parseFeedbackHistoryPage,type FeedbackHistoryPage,
  type FeedbackConnection, type FeedbackReceipt, type FeedbackReport, type FeedbackTeamStatus, type FeedbackSceneIdentity } from '@wbr/shared/test-feedback';

export type TestFeedbackError = 'read' | 'write' | 'send' | 'receipt' | 'connection' | 'full' | 'invalid';
export const DEFAULT_TEST_FEEDBACK_ENDPOINT = 'https://feedback.heliosoft.win/api/feedback';
export type FeedbackStatusCache = { targetKey: string; data: FeedbackTeamStatus; fetchedAt: string };
export const feedbackConnectionKey = (value: FeedbackConnection) => sha256(new TextEncoder().encode(JSON.stringify([value.endpoint, value.token])).buffer);
const targetKey=feedbackConnectionKey;
type SavedFeedback = {
  version: 1;
  connection: FeedbackConnection;
  drafts: Record<string, FeedbackReport>;
  pending: FeedbackReport[];
  lastReceipt?: FeedbackReceipt;
  receipts?: Record<string, FeedbackReceipt>;
  teamStatus?: FeedbackStatusCache;
};
export type TestFeedbackSnapshot = Omit<SavedFeedback, 'version'> & {
  status: 'loading' | 'ready' | 'storage-error';
  saving: boolean;
  sending?: string;
  error?: TestFeedbackError;
  teamStatusState?: 'idle' | 'loading' | 'fresh' | 'stale' | 'error' | 'unavailable';
  teamStatusError?: boolean;
};
const MAX_PENDING = 100;
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function connection(value: unknown): FeedbackConnection {
  if (!object(value) || Object.keys(value).some(key => !['endpoint', 'token'].includes(key)) ||
      typeof value.endpoint !== 'string' || typeof value.token !== 'string' || value.endpoint.length > 2048 || value.token.length > 1024)
    throw Error('connection');
  return { endpoint: value.endpoint.trim() ? normalizeFeedbackEndpoint(value.endpoint) : '', token: value.token.trim() };
}
function draft(value: unknown): FeedbackReport {
  // Empty text is a valid local draft, but never a valid report for transmission.
  if (!object(value) || typeof value.message !== 'string' || value.message.length > FEEDBACK_MAX_MESSAGE_LENGTH) throw Error('draft');
  parseFeedbackReport({ ...value, message: value.message.trim() ? value.message : 'draft' });
  return clone(value as FeedbackReport);
}
function restore(raw: string | null): SavedFeedback {
  if (raw === null) return { version: 1, connection: { endpoint: DEFAULT_TEST_FEEDBACK_ENDPOINT, token: '' }, drafts: {}, pending: [], receipts: {} };
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || Object.keys(value).some(key => !['version', 'connection', 'drafts', 'pending', 'lastReceipt', 'receipts', 'teamStatus'].includes(key)) ||
      !object(value.drafts) || Object.keys(value.drafts).length > 200 || !Array.isArray(value.pending) || value.pending.length > MAX_PENDING)
    throw Error('store');
  const drafts: Record<string, FeedbackReport> = {};
  for (const [sceneId, candidate] of Object.entries(value.drafts)) {
    const report = draft(candidate);
    if (report.scene.id !== sceneId) throw Error('draft scene');
    Object.defineProperty(drafts, sceneId, { value: report, enumerable: true, configurable: true, writable: true });
  }
  const pending = value.pending.map(parseFeedbackReport).map(clone);
  if (new Set(pending.map(report => report.id)).size !== pending.length) throw Error('duplicate');
  if (value.receipts !== undefined && (!object(value.receipts) || Object.keys(value.receipts).length > MAX_PENDING)) throw Error('receipts');
  const receipts = Object.fromEntries(Object.entries(value.receipts ?? {}).map(([id, candidate]) => {
    const receipt = parseFeedbackReceipt(candidate);
    if (receipt.id !== id) throw Error('receipt id');
    return [id, receipt];
  }));
  let teamStatus: FeedbackStatusCache | undefined;
  try {
    const cache = value.teamStatus;
    if (object(cache) && typeof cache.targetKey === 'string' && /^[a-f0-9]{64}$/.test(cache.targetKey) &&
        typeof cache.fetchedAt === 'string' && Number.isFinite(Date.parse(cache.fetchedAt)))
      teamStatus = { targetKey: cache.targetKey, fetchedAt: cache.fetchedAt, data: parseFeedbackTeamStatus(cache.data) };
  } catch { /* Derived status caches never make durable pending reports unreadable. */ }
  return { version: 1, connection: connection(value.connection), drafts, pending, receipts, ...(teamStatus ? { teamStatus } : {}),
    ...(value.lastReceipt === undefined ? {} : { lastReceipt: parseFeedbackReceipt(value.lastReceipt) }) };
}

/** A separate durable outbox. It never reads or writes the player's game save. */
export function createTestFeedbackClient(host: TestFeedbackHost, options: { retryDelayMs?: number; sendTimeoutMs?: number;
  statusScenes?: readonly FeedbackSceneIdentity[] | (() => readonly FeedbackSceneIdentity[]) } = {}) {
  let saved = restore(null);
  let snapshot: TestFeedbackSnapshot = { ...saved, status: 'loading', saving: false, teamStatusState: 'idle' };
  let loaded = false, disposed = false, active = false;
  let revision = 0, durableRevision = -1, writes = 0, retries = 0;
  let writing: Promise<void> = Promise.resolve();
  let loading: Promise<boolean> | undefined;
  let flushing: Promise<void> | undefined;
  let flushAgain = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let acknowledging: { report: FeedbackReport; previous: SavedFeedback } | undefined;
  let statusGeneration = 0;
  let historyGeneration=0;
  let statusRequest: { key: string; promise: Promise<void> } | undefined;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<TestFeedbackSnapshot> = {}) => {
    let visible = saved;
    if (acknowledging) {
      const { report, previous } = acknowledging;
      const drafts = { ...saved.drafts };
      if (!drafts[report.scene.id] && previous.drafts[report.scene.id]?.id === report.id) drafts[report.scene.id] = previous.drafts[report.scene.id];
      const receipts = { ...saved.receipts };
      if (previous.receipts?.[report.id]) receipts[report.id] = previous.receipts[report.id];
      else delete receipts[report.id];
      visible = { ...saved, drafts, receipts, lastReceipt: previous.lastReceipt,
        pending: saved.pending.some(candidate => candidate.id === report.id) ? saved.pending : [report, ...saved.pending] };
    }
    const cache = visible.teamStatus?.targetKey === targetKey(saved.connection) ? visible.teamStatus : undefined;
    snapshot = { ...snapshot, ...visible, ...patch, teamStatus: cache, saving: writes > 0 };
    for (const listener of listeners) listener();
  };
  const cancelRetry = () => { if (retryTimer !== undefined) clearTimeout(retryTimer); retryTimer = undefined; };
  const scheduleRetry = () => {
    if (retryTimer !== undefined || !active || disposed || !saved.pending.length || !saved.connection.endpoint || !saved.connection.token) return;
    retryTimer = setTimeout(() => { retryTimer = undefined; void flush(); }, Math.min(120000, (options.retryDelayMs ?? 5000) * 2 ** Math.min(retries++, 5)));
    (retryTimer as unknown as { unref?: () => void }).unref?.();
  };
  const persist = (): Promise<boolean> => {
    const raw = JSON.stringify(saved), current = revision;
    writes++; publish();
    const operation = writing.then(async () => {
      if (disposed) return false;
      try {
        await host.write(raw);
        durableRevision = current;
        if (!disposed && loaded && current === revision) publish({ status: 'ready', error: snapshot.error === 'write' ? undefined : snapshot.error });
        return true;
      } catch {
        if (!disposed) publish({ status: 'storage-error', error: 'write' });
        return false;
      } finally { writes--; if (!disposed) publish(); }
    });
    writing = operation.then(() => {});
    return operation;
  };
  async function load(): Promise<boolean> {
    if (disposed) return false;
    if (loaded) return true;
    if (loading) return loading;
    publish({ status: 'loading', error: undefined });
    loading = (async () => {
      try {
        const restored = restore(await host.read());
        if (disposed) return false;
        const endpoint = restored.connection.endpoint;
        const migrate = !endpoint || new URL(endpoint).hostname.endsWith('.trycloudflare.com');
        saved = migrate ? { ...restored, connection: { ...restored.connection, endpoint: DEFAULT_TEST_FEEDBACK_ENDPOINT }, teamStatus: undefined } : restored;
        if (migrate) {
          // Persist the new target before either uploading retained reports or
          // publishing a ready snapshot. Pending IDs, drafts and invitations stay intact.
          revision++;
          if (!(await persist())) { scheduleRetry(); return false; }
          if (disposed) return false;
        }
        loaded = true; durableRevision = revision;
        publish({ status: 'ready', error: undefined, teamStatusState: saved.teamStatus?.targetKey === targetKey(saved.connection) ? 'stale' : 'idle' });
        return true;
      } catch {
        if (!disposed) publish({ status: 'storage-error', error: 'read' });
        return false;
      } finally { loading = undefined; }
    })();
    return loading;
  }
  async function change(next: SavedFeedback): Promise<boolean> {
    if (disposed || !loaded) return false;
    saved = next; revision++; publish({ error: undefined });
    return persist();
  }
  async function refreshTeamStatus(force = false): Promise<void> {
    if (!active || disposed) return;
    if (!(await load()) || disposed || !active) return;
    const target = { ...saved.connection };
    const identities = typeof options.statusScenes === 'function' ? options.statusScenes() : options.statusScenes ?? [];
    if (!host.readStatus || !target.endpoint || !target.token || !identities.length) {
      publish({ teamStatusState: 'unavailable', teamStatusError: false }); return;
    }
    const targetIdentity = targetKey(target);
    let query;
    try { query = parseFeedbackStatusQuery({ schemaVersion: 1, scenes: identities }); }
    catch { publish({ teamStatusState: snapshot.teamStatus ? 'stale' : 'error', teamStatusError: true }); return; }
    const queryJSON = JSON.stringify(query);
    const requestKey = targetIdentity + queryJSON;
    if (!force && statusRequest?.key === requestKey) return statusRequest.promise;
    const generation = ++statusGeneration;
    publish({ teamStatusState: 'loading', teamStatusError: false });
    const promise = (async () => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const raw = await Promise.race([Promise.resolve().then(() => host.readStatus!(target.endpoint, target.token, queryJSON)),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(Error('timeout')), options.sendTimeoutMs ?? 15000); })]);
        const data = parseFeedbackTeamStatus(JSON.parse(raw));
        if (data.scenes.length !== query.scenes.length || query.scenes.some(scene => !data.scenes.some(row => row.id === scene.id && row.testingRevision === scene.testingRevision)))
          throw Error('Status reply does not match requested scenes');
        if (disposed || !active || generation !== statusGeneration || targetKey(saved.connection) !== targetIdentity) return;
        const cache = { targetKey: targetIdentity, data, fetchedAt: new Date().toISOString() };
        // Store independently of delivery acknowledgement: failure keeps the last
        // durable cache and never rewrites a report or clears a pending item.
        const previous = saved.teamStatus;
        saved = { ...saved, teamStatus: cache }; revision++;
        const stored = await persist();
        if (disposed || generation !== statusGeneration || targetKey(saved.connection) !== targetIdentity) return;
        if (!stored && saved.teamStatus === cache) {
          saved = { ...saved, teamStatus: previous }; revision++;
        }
        publish({ teamStatusState: stored ? 'fresh' : (snapshot.teamStatus ? 'stale' : 'error'), teamStatusError: !stored });
      } catch {
        if (!disposed && active && generation === statusGeneration && targetKey(saved.connection) === targetIdentity)
          publish({ teamStatusState: snapshot.teamStatus ? 'stale' : 'error', teamStatusError: true });
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
        if (statusRequest?.key === requestKey && generation === statusGeneration) statusRequest = undefined;
      }
    })();
    statusRequest = { key: requestKey, promise };
    return promise;
  }
  async function send(report: FeedbackReport): Promise<FeedbackReceipt> {
    const target = { ...saved.connection };
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const raw = await Promise.race([
        host.send(target.endpoint, target.token, JSON.stringify(report)),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(Error('timeout')), options.sendTimeoutMs ?? 15000); }),
      ]);
      try {
        const receipt = parseFeedbackReceipt(JSON.parse(raw));
        if (receipt.id !== report.id) throw Error('wrong receipt');
        return receipt;
      } catch { throw Error('receipt'); }
    } finally { if (timeout !== undefined) clearTimeout(timeout); }
  }

  async function readHistory(sceneId:string,cursor?:string):Promise<FeedbackHistoryPage> {
    if(!active||disposed||!await load()||!host.readStatus)throw Error('History unavailable');
    const target={...saved.connection},identity=targetKey(target),generation=historyGeneration;
    if(!target.endpoint||!target.token)throw Error('History invitation required');
    const query=parseFeedbackHistoryQuery({schemaVersion:1,type:'history',sceneId,...(cursor?{cursor}:{})});
    let timer:ReturnType<typeof setTimeout>|undefined;
    try{
      const raw=await Promise.race([Promise.resolve().then(()=>host.readStatus!(target.endpoint,target.token,JSON.stringify(query))),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('History timeout')),options.sendTimeoutMs??15000)})]);
      const page=parseFeedbackHistoryPage(JSON.parse(raw));
      if(page.sceneId!==sceneId||cursor&&page.nextCursor===cursor||disposed||!active||generation!==historyGeneration||identity!==targetKey(saved.connection))throw Error('History reply no longer matches');
      return page;
    }finally{if(timer!==undefined)clearTimeout(timer)}
  }
  async function runFlush() {
    if (!active || disposed || !(await load())) return;
    cancelRetry();
    if (!saved.connection.endpoint || !saved.connection.token) {
      if (saved.pending.length) publish({ error: 'connection' });
      return;
    }
    // No request may leave until all preceding local writes actually succeeded.
    await writing;
    if (durableRevision !== revision && !(await persist())) { scheduleRetry(); return; }
    const attempts = new Map<string, number>();
    let retryFailedAfterSuccess = false;
    do {
      flushAgain = false;
      const reports = [...saved.pending];
      for (const report of reports) {
        if (!active || disposed) break;
        if ((attempts.get(report.id) ?? 0) >= (retryFailedAfterSuccess ? 2 : 1)) continue;
        if (!saved.pending.some(candidate => candidate.id === report.id)) continue;
        attempts.set(report.id, (attempts.get(report.id) ?? 0) + 1);
        // A newer settings/draft write may have failed while the previous request ran.
        await writing;
        if (durableRevision !== revision && !(await persist())) break;
        publish({ sending: report.id, error: undefined });
        try {
          const receipt = await send(report);
          if (disposed) return;
          const previous = saved;
          const drafts = { ...saved.drafts };
          if (drafts[report.scene.id]?.id === report.id) delete drafts[report.scene.id];
          const receipts = Object.fromEntries([...Object.entries(saved.receipts ?? {}).filter(([id]) => id !== report.id).slice(-(MAX_PENDING - 1)), [report.id, receipt]]);
          const next = { ...saved, drafts, pending: saved.pending.filter(candidate => candidate.id !== report.id), lastReceipt: receipt, receipts };
          // Commit acknowledgement locally before announcing success. A failed write
          // retains the old outbox for an idempotent retry after a restart.
          acknowledging = { report, previous };
          saved = next; revision++;
          if (!(await persist())) {
            // Do not overwrite newer typing/settings while restoring this item.
            saved = { ...saved, pending: saved.pending.some(candidate => candidate.id === report.id) ? saved.pending : [report, ...saved.pending] };
            if (saved.drafts[report.scene.id] === undefined && previous.drafts[report.scene.id]?.id === report.id)
              saved = { ...saved, drafts: { ...saved.drafts, [report.scene.id]: previous.drafts[report.scene.id] } };
            if (saved.lastReceipt?.id === report.id) saved = { ...saved, lastReceipt: previous.lastReceipt };
            const receipts = { ...saved.receipts };
            if (previous.receipts?.[report.id]) receipts[report.id] = previous.receipts[report.id];
            else delete receipts[report.id];
            saved = { ...saved, receipts };
            revision++;
            acknowledging = undefined;
            publish({ error: 'write' });
            break;
          }
          acknowledging = undefined;
          retries = 0; publish({ error: undefined });
          // A read started before this ACK cannot certify the post-upload state.
          void refreshTeamStatus(true);
          if (!retryFailedAfterSuccess) { retryFailedAfterSuccess = true; flushAgain = true; }
        } catch (error) {
          if (!disposed) publish({ error: error instanceof Error && error.message === 'receipt' ? 'receipt' : 'send' });
        } finally { if (!disposed) publish({ sending: undefined }); }
      }
    } while (active && !disposed && flushAgain && saved.pending.length);
    scheduleRetry();
  }
  function flush(): Promise<void> {
    if (flushing) { flushAgain = true; return flushing; }
    flushing = runFlush().finally(() => { flushing = undefined; });
    return flushing;
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load,
    async saveDraft(report: FeedbackReport): Promise<boolean> {
      if (!loaded || disposed) return false;
      try {
        const value = draft(report);
        const queued = saved.pending.find(candidate => candidate.id === value.id);
        if (queued && JSON.stringify(queued) !== JSON.stringify(value)) throw Error('queued is immutable');
        if (!(value.scene.id in saved.drafts) && Object.keys(saved.drafts).length >= 200) throw Error('too many drafts');
        return change({ ...saved, drafts: { ...saved.drafts, [value.scene.id]: value } });
      } catch { publish({ error: 'invalid' }); return false; }
    },
    async setConnection(value: FeedbackConnection): Promise<boolean> {
      if (!loaded || disposed) return false;
      let normalized: FeedbackConnection;
      try { normalized = connection(value); } catch { publish({ error: 'connection' }); return false; }
      const changed = targetKey(saved.connection) !== targetKey(normalized);
      if (changed) { statusGeneration++; historyGeneration++; publish({ teamStatusState: 'idle', teamStatusError: false }); }
      const success = await change({ ...saved, connection: normalized, ...(changed ? { teamStatus: undefined } : {}) });
      if (success) { retries = 0; cancelRetry(); void flush(); void refreshTeamStatus(); }
      return success;
    },
    async enqueue(report: FeedbackReport): Promise<boolean> {
      if (!loaded || disposed) return false;
      let value: FeedbackReport;
      try { value = clone(parseFeedbackReport(report)); } catch { publish({ error: 'invalid' }); return false; }
      const existing = saved.pending.find(candidate => candidate.id === value.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(value)) { publish({ error: 'invalid' }); return false; }
      if (!existing && saved.pending.length >= MAX_PENDING) { publish({ error: 'full' }); return false; }
      const success = await change({ ...saved, drafts: { ...saved.drafts, [value.scene.id]: value }, pending: existing ? saved.pending : [...saved.pending, value] });
      if (success) { cancelRetry(); void flush(); }
      return success;
    },
    flush,
    refreshTeamStatus,
    readHistory,
    setActive(value: boolean) {
      if(active!==value)historyGeneration++;
      active = value;
      if (!active) { cancelRetry(); statusGeneration++; statusRequest = undefined; }
      else if (!disposed) { retries = 0; void flush(); void refreshTeamStatus(); }
    },
    dispose() { disposed = true; active = false; statusGeneration++; historyGeneration++; cancelRetry(); listeners.clear(); },
  };
}
export type TestFeedbackClient = ReturnType<typeof createTestFeedbackClient>;
