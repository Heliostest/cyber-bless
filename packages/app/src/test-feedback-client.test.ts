import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TestFeedbackHost } from '@wbr/runtime';
import type { FeedbackReport } from '@wbr/shared/test-feedback';
import { createTestFeedbackClient, type TestFeedbackClient } from './test-feedback-client';

const clients: TestFeedbackClient[] = [];
const report = (id = 'feedback_0001', message = 'The second drag does not attach.'): FeedbackReport => ({
  schemaVersion: 1, id, createdAt: '2026-11-02T08:00:00.000Z',
  scene: { id: 'crane', title: 'Paper crane', engine: 'crane@1', revision: 'bundled' },
  context: { completedSteps: 1, totalSteps: 3, reportedStep: 2 }, message,
  client: { platform: 'web', appVersion: '1.0.0', buildNumber: 'dev', locale: 'en', width: 390, height: 844, pixelRatio: 2, reducedMotion: false },
});
const receipt = (id: string) => JSON.stringify({ id, receivedAt: '2026-11-02T08:01:00.000Z' });
async function setup(raw: string | null = null) {
  let disk = raw;
  const host: TestFeedbackHost = {
    read: vi.fn(async () => disk), write: vi.fn(async value => { disk = value; }),
    send: vi.fn(async (_endpoint, _token, value) => receipt(JSON.parse(value).id)),
  };
  const client = createTestFeedbackClient(host, { retryDelayMs: 5000, sendTimeoutMs: 1000 }); clients.push(client);
  await client.load();
  if (raw === null) await client.setConnection({ endpoint: 'https://first.example', token: 'test-invite' });
  return { client, host, disk: () => disk };
}
afterEach(() => { for (const client of clients) client.dispose(); clients.length = 0; vi.useRealTimers(); });

describe('durable test feedback outbox', () => {
  it('persists first and only clears text after a matching durable receipt', async () => {
    const { client, host, disk } = await setup();
    const first = report();
    await client.saveDraft(first);
    await client.enqueue(first);
    expect(host.send).not.toHaveBeenCalled();
    let resolve!: (value: string) => void;
    host.send = vi.fn(() => new Promise<string>(done => { resolve = done; }));
    client.setActive(true);
    await vi.waitFor(() => expect(host.send).toHaveBeenCalledTimes(1));
    expect(JSON.parse(disk()!).pending[0]).toEqual(first);
    expect(client.getSnapshot().drafts.crane.message).toBe(first.message);
    expect(client.getSnapshot().lastReceipt).toBeUndefined();
    resolve(receipt(first.id)); await client.flush();
    expect(client.getSnapshot().pending).toEqual([]);
    expect(client.getSnapshot().drafts.crane).toBeUndefined();
    expect(client.getSnapshot().lastReceipt?.id).toBe(first.id);
    expect(JSON.parse(disk()!).pending).toEqual([]);
  });

  it('keeps failed text across restart and flushes to a newly edited URL', async () => {
    const first = await setup();
    first.host.send = vi.fn(async () => { throw Error('offline'); });
    await first.client.enqueue(report()); first.client.setActive(true); await first.client.flush();
    expect(first.client.getSnapshot().error).toBe('send');
    first.client.dispose();
    const second = await setup(first.disk());
    expect(second.client.getSnapshot().drafts.crane.message).toBe(report().message);
    second.client.setActive(true);
    await second.client.setConnection({ endpoint: 'https://new.trycloudflare.com/', token: 'test-invite' });
    await second.client.flush();
    expect(second.host.send).toHaveBeenLastCalledWith('https://new.trycloudflare.com/api/feedback', 'test-invite', JSON.stringify(report()));
    expect(second.client.getSnapshot().pending).toEqual([]);
  });

  it('never sends when the initial write fails and recovers without losing text', async () => {
    const { client, host } = await setup();
    host.write = vi.fn(async () => { throw Error('disk full'); });
    expect(await client.enqueue(report())).toBe(false);
    client.setActive(true); await client.flush();
    expect(host.send).not.toHaveBeenCalled();
    expect(client.getSnapshot().drafts.crane.message).toBe(report().message);
    expect(client.getSnapshot().status).toBe('storage-error');
    host.write = vi.fn(async () => {});
    await client.flush();
    expect(host.send).toHaveBeenCalledTimes(1);
    expect(client.getSnapshot().pending).toHaveLength(0);
  });

  it('preserves corrupt or unreadable storage and does not overwrite it', async () => {
    const { client, host, disk } = await setup('{corrupt');
    expect(client.getSnapshot().error).toBe('read');
    expect(await client.saveDraft(report())).toBe(false);
    expect(await client.setConnection({ endpoint: 'https://new.example', token: 'token' })).toBe(false);
    client.setActive(true); await client.flush();
    expect(host.write).not.toHaveBeenCalled();
    expect(host.send).not.toHaveBeenCalled();
    expect(disk()).toBe('{corrupt');
  });

  it('persists fast edits in order even if storage completion is delayed', async () => {
    const { client, host } = await setup();
    const written: string[] = [];
    let unblock!: () => void;
    host.write = vi.fn(async raw => {
      if (!written.length) await new Promise<void>(done => { unblock = done; });
      written.push(raw);
    });
    const a = client.saveDraft(report('feedback_0001', 'first'));
    const b = client.saveDraft(report('feedback_0001', 'latest dictation'));
    await vi.waitFor(() => expect(host.write).toHaveBeenCalledTimes(1));
    expect(client.getSnapshot().drafts.crane.message).toBe('latest dictation');
    unblock(); await Promise.all([a, b]);
    expect(JSON.parse(written.at(-1)!).drafts.crane.message).toBe('latest dictation');
    expect(host.send).not.toHaveBeenCalled();
  });

  it('retains blank draft clearing across restore, but never enqueues blank feedback', async () => {
    const { client, disk } = await setup();
    await client.saveDraft(report());
    expect(await client.saveDraft(report('feedback_0001', ''))).toBe(true);
    expect(await client.enqueue(report('feedback_0001', ''))).toBe(false);
    const restored = await setup(disk());
    expect(restored.client.getSnapshot().drafts.crane.message).toBe('');
  });

  it.each(['wrong-id', 'malformed'])('does not treat a %s receipt as success', async kind => {
    const { client, host } = await setup();
    host.send = vi.fn(async () => kind === 'wrong-id' ? receipt('feedback_wrong') : '{}');
    await client.enqueue(report()); client.setActive(true); await client.flush();
    expect(client.getSnapshot().pending).toHaveLength(1);
    expect(client.getSnapshot().drafts.crane).toEqual(report());
    expect(client.getSnapshot().lastReceipt).toBeUndefined();
    expect(client.getSnapshot().error).toBe('receipt');
  });

  it('uses the same id when an acknowledgement is lost after server persistence', async () => {
    const { client, host } = await setup();
    const received = new Set<string>();
    let first = true;
    host.send = vi.fn(async (_endpoint, _token, raw) => {
      const id = JSON.parse(raw).id; received.add(id);
      if (first) { first = false; throw Error('response lost'); }
      return receipt(id);
    });
    await client.enqueue(report()); client.setActive(true); await client.flush();
    expect(client.getSnapshot().pending[0].id).toBe(report().id);
    await client.flush();
    expect(received.size).toBe(1);
    expect(client.getSnapshot().pending).toHaveLength(0);
  });

  it('preserves the queue if writing the acknowledgement fails', async () => {
    const { client, host, disk } = await setup();
    await client.enqueue(report());
    const oldWrite = host.write;
    host.write = vi.fn(async raw => {
      if (JSON.parse(raw).pending.length === 0) throw Error('disk full on ack');
      await oldWrite(raw);
    });
    client.setActive(true); await client.flush();
    expect(client.getSnapshot().pending).toHaveLength(1);
    expect(client.getSnapshot().drafts.crane).toEqual(report());
    expect(client.getSnapshot().lastReceipt).toBeUndefined();
    expect(JSON.parse(disk()!).pending).toHaveLength(1);
    host.write = oldWrite; await client.flush();
    expect(client.getSnapshot().pending).toHaveLength(0);
  });

  it('publishes no successful receipt or queue removal before the ACK write completes', async () => {
    const { client, host } = await setup();
    await client.enqueue(report());
    let acceptWrite!: () => void;
    const original = host.write;
    host.write = vi.fn(async raw => {
      if (JSON.parse(raw).lastReceipt) await new Promise<void>(done => { acceptWrite = done; });
      await original(raw);
    });
    client.setActive(true);
    await vi.waitFor(() => expect(acceptWrite).toBeTypeOf('function'));
    expect(client.getSnapshot().pending).toHaveLength(1);
    expect(client.getSnapshot().drafts.crane).toBeDefined();
    expect(client.getSnapshot().lastReceipt).toBeUndefined();
    expect(client.getSnapshot().receipts?.[report().id]).toBeUndefined();
    acceptWrite(); await client.flush();
    expect(client.getSnapshot().receipts?.[report().id]?.id).toBe(report().id);
  });

  it('retains a receipt for every successfully flushed report in a batch', async () => {
    const { client, disk } = await setup();
    await client.enqueue(report('feedback_0001')); await client.enqueue(report('feedback_0002'));
    client.setActive(true); await client.flush();
    expect(Object.keys(client.getSnapshot().receipts!)).toEqual(['feedback_0001', 'feedback_0002']);
    expect(client.getSnapshot().lastReceipt?.id).toBe('feedback_0002');
    const restored = await setup(disk());
    expect(Object.keys(restored.client.getSnapshot().receipts!)).toEqual(['feedback_0001', 'feedback_0002']);
  });

  it('does not let the same queued id mutate, or clear newer draft text when it arrives', async () => {
    const { client } = await setup();
    await client.enqueue(report());
    expect(await client.saveDraft(report('feedback_0001', 'edited after send'))).toBe(false);
    expect(await client.enqueue(report('feedback_0001', 'edited after send'))).toBe(false);
    await client.saveDraft(report('feedback_0002', 'new issue'));
    client.setActive(true); await client.flush();
    expect(client.getSnapshot().drafts.crane.message).toBe('new issue');
  });

  it('tries later queued reports and retries a failed report after another success', async () => {
    const { client, host } = await setup();
    const counts = new Map<string, number>();
    host.send = vi.fn(async (_endpoint, _token, raw) => {
      const id = JSON.parse(raw).id;
      const count = (counts.get(id) ?? 0) + 1; counts.set(id, count);
      if (id === 'feedback_0001' && count === 1) throw Error('temporary');
      return receipt(id);
    });
    await client.enqueue(report('feedback_0001')); await client.enqueue(report('feedback_0002'));
    client.setActive(true); await client.flush();
    expect(counts.get('feedback_0001')).toBe(2);
    expect(counts.get('feedback_0002')).toBe(1);
    expect(client.getSnapshot().pending).toHaveLength(0);
  });

  it('retries on foreground and scheduled backoff, but pauses when inactive', async () => {
    vi.useFakeTimers();
    const { client, host } = await setup();
    let online = false;
    host.send = vi.fn(async (_endpoint, _token, raw) => { if (!online) throw Error('offline'); return receipt(JSON.parse(raw).id); });
    await client.enqueue(report()); client.setActive(true); await client.flush();
    expect(host.send).toHaveBeenCalledTimes(1);
    client.setActive(false); online = true;
    await vi.advanceTimersByTimeAsync(10000);
    expect(host.send).toHaveBeenCalledTimes(1);
    client.setActive(true); await client.flush();
    expect(client.getSnapshot().pending).toHaveLength(0);
  });

  it('bounds hanging requests and leaves them durable for retry', async () => {
    vi.useFakeTimers();
    const { client, host } = await setup();
    host.send = vi.fn(() => new Promise<string>(() => {}));
    await client.enqueue(report()); client.setActive(true);
    const flushing = client.flush();
    await vi.advanceTimersByTimeAsync(1100); await flushing;
    expect(client.getSnapshot().pending).toHaveLength(1);
    expect(client.getSnapshot().error).toBe('send');
    expect(client.getSnapshot().sending).toBeUndefined();
  });

  it('automatically retries at the backoff deadline without user action', async () => {
    vi.useFakeTimers();
    const { client, host } = await setup();
    let online = false;
    host.send = vi.fn(async (_endpoint, _token, raw) => { if (!online) throw Error('offline'); return receipt(JSON.parse(raw).id); });
    await client.enqueue(report()); client.setActive(true); await client.flush();
    online = true;
    await vi.advanceTimersByTimeAsync(5001);
    await client.flush();
    expect(host.send).toHaveBeenCalledTimes(2);
    expect(client.getSnapshot().pending).toHaveLength(0);
  });

  it('refuses an overflowing outbox without evicting earlier failures', async () => {
    const pending = Array.from({ length: 100 }, (_, index) => report(`feedback_${String(index).padStart(4, '0')}`));
    const { client, host } = await setup(JSON.stringify({ version: 1,
      connection: { endpoint: 'https://first.example/api/feedback', token: 'test-invite' }, drafts: {}, pending }));
    expect(await client.enqueue(report('feedback_overflow'))).toBe(false);
    expect(client.getSnapshot().error).toBe('full');
    expect(client.getSnapshot().pending).toEqual(pending);
    expect(host.write).not.toHaveBeenCalled();
  });
});
