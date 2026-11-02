import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import type { TestFeedbackHost } from '@wbr/runtime';
import { createTestFeedbackClient, type TestFeedbackClient, type TestFeedbackSnapshot } from './test-feedback-client';

type TestFeedbackContext = { client: TestFeedbackClient; snapshot: TestFeedbackSnapshot; info?: TestFeedbackHost['info'] };
const Context = createContext<TestFeedbackContext | undefined>(undefined);
const empty: TestFeedbackSnapshot = { status: 'loading', saving: false, connection: { endpoint: '', token: '' }, drafts: {}, pending: [] };
const noopSubscribe = () => () => {};
const emptySnapshot = () => empty;

/** Enabling internal tools only changes context; the real App subtree stays mounted. */
export function TestFeedbackProvider({ host, enabled, active, children }: {
  host?: TestFeedbackHost; enabled: boolean; active: boolean; children: ReactNode;
}) {
  const client = useMemo(() => host ? createTestFeedbackClient(host) : undefined, [host]);
  const lifetimes = useRef(new WeakMap<TestFeedbackClient, { generation: number }>());
  const snapshot = useSyncExternalStore(client?.subscribe ?? noopSubscribe, client?.getSnapshot ?? emptySnapshot, emptySnapshot);
  useEffect(() => {
    if (!client) return;
    const lifetime = lifetimes.current.get(client) ?? { generation: 0 };
    lifetimes.current.set(client, lifetime);
    const generation = ++lifetime.generation;
    return () => {
      client.setActive(false);
      // StrictMode replays setup immediately. Only a real unmount or host
      // replacement disposes the stable client, after that replay opportunity.
      queueMicrotask(() => { if (lifetime.generation === generation) client.dispose(); });
    };
  }, [client]);
  useEffect(() => {
    client?.setActive(enabled && active);
    if (enabled) void client?.load();
    const online = () => { if (enabled && active) void client?.flush(); };
    if (enabled) window.addEventListener('online', online);
    return () => window.removeEventListener('online', online);
  }, [client, enabled, active]);
  const value = useMemo(() => enabled && client ? { client, snapshot, info: host?.info } : undefined, [enabled, client, snapshot, host?.info]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useTestFeedback = () => useContext(Context);
