import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TestFeedbackHost } from '@wbr/runtime';
import type { FeedbackTeamStatus } from '@wbr/shared/test-feedback';
import { createTestFeedbackClient, type TestFeedbackClient } from './test-feedback-client';

const clients: TestFeedbackClient[] = [];
const scenes = [{ id: 'crane', testingRevision: 'a'.repeat(64) }];
const response = (state: 'unreported' | 'reported' | 'retest' | 'verified' = 'unreported'): FeedbackTeamStatus => ({
  schemaVersion: 1, generatedAt: '2026-11-02T08:00:00.000Z',
  scenes: [{ ...scenes[0]!, state, issueCount: state === 'unreported' ? 0 : 1, openIssueCount: state === 'reported' ? 1 : 0, reviewToken: 'b'.repeat(64) }],
});
async function setup(raw: string | null = null) {
  let disk = raw;
  const host: TestFeedbackHost = { read: vi.fn(async () => disk), write: vi.fn(async value => { disk = value; }),
    send: vi.fn(async () => '{}'), readStatus: vi.fn(async () => JSON.stringify(response())) };
  const client = createTestFeedbackClient(host, { statusScenes: scenes }); clients.push(client);
  await client.load();
  return { host, client, disk: () => disk };
}
afterEach(() => { clients.forEach(client => client.dispose()); clients.length = 0; vi.useRealTimers(); });
describe('team feedback status synchronization', () => {
  it('does not label an unconfigured or unavailable receiver as unreported', async () => {
    const { client, host } = await setup(); client.setActive(true); await client.refreshTeamStatus();
    expect(host.readStatus).not.toHaveBeenCalled();
    expect(client.getSnapshot().teamStatus).toBeUndefined();
    expect(client.getSnapshot().teamStatusState).toBe('unavailable');
  });
  it('stores a matching authenticated summary, and marks restored results as cached', async () => {
    const { client, disk, host } = await setup();
    await client.setConnection({ endpoint: 'https://receiver.example', token: 'invite-a' }); client.setActive(true);
    await client.refreshTeamStatus();
    expect(host.readStatus).toHaveBeenCalledWith('https://receiver.example/api/feedback', 'invite-a', JSON.stringify({ schemaVersion: 1, scenes }));
    expect(client.getSnapshot().teamStatusState).toBe('fresh');
    expect(client.getSnapshot().teamStatus?.data.scenes[0]?.state).toBe('unreported');
    const restarted = await setup(disk());
    expect(restarted.client.getSnapshot().teamStatusState).toBe('stale');
    expect(restarted.client.getSnapshot().teamStatus?.data.scenes).toEqual(response().scenes);
  });
  it('keeps a matching cache after failure without advertising it as fresh', async () => {
    const { client, host } = await setup(); await client.setConnection({ endpoint: 'https://receiver.example', token: 'invite-a' });
    client.setActive(true); await client.refreshTeamStatus();
    host.readStatus = vi.fn(async () => { throw Error('offline'); });
    await client.refreshTeamStatus();
    expect(client.getSnapshot().teamStatusState).toBe('stale');
    expect(client.getSnapshot().teamStatusError).toBe(true);
    expect(client.getSnapshot().teamStatus?.data.scenes).toEqual(response().scenes);
  });
  it('discards late old-address replies and never reuses another invitation cache', async () => {
    const { client, host } = await setup();
    let oldResolve!: (raw: string) => void;
    host.readStatus = vi.fn((endpoint: string) => endpoint.includes('old.example') ? new Promise(resolve => { oldResolve = resolve; }) : Promise.resolve(JSON.stringify(response('retest'))));
    await client.setConnection({ endpoint: 'https://old.example', token: 'old-invite' }); client.setActive(true);
    const old = client.refreshTeamStatus(); await Promise.resolve();
    await client.setConnection({ endpoint: 'https://new.example', token: 'new-invite' }); await client.refreshTeamStatus();
    oldResolve(JSON.stringify(response('verified'))); await old;
    expect(client.getSnapshot().teamStatus?.data.scenes[0]?.state).toBe('retest');
    expect(client.getSnapshot().connection.token).toBe('new-invite');
    client.setActive(false); await client.setConnection({ endpoint: 'https://new.example', token: 'different-invite' });
    expect(client.getSnapshot().teamStatus).toBeUndefined();
  });
  it('rejects replies with missing or changed query identities', async () => {
    const { client, host } = await setup(); await client.setConnection({ endpoint: 'https://receiver.example', token: 'invite-a' });
    host.readStatus = vi.fn(async () => JSON.stringify({ ...response(), scenes: [{ ...response().scenes[0], testingRevision: 'c'.repeat(64) }] }));
    client.setActive(true); await client.refreshTeamStatus();
    expect(client.getSnapshot().teamStatus).toBeUndefined(); expect(client.getSnapshot().teamStatusState).toBe('error');
  });
  it('ignores a corrupt derived cache while retaining the durable feedback settings', async () => {
    const raw = JSON.stringify({ version: 1, connection: { endpoint: 'https://receiver.example', token: 'invite-a' }, drafts: {}, pending: [], teamStatus: { broken: true } });
    const { client } = await setup(raw);
    expect(client.getSnapshot().status).toBe('ready'); expect(client.getSnapshot().connection.token).toBe('invite-a');
    expect(client.getSnapshot().teamStatus).toBeUndefined();
  });
  it('does a new status read after delivery instead of certifying a pre-upload in-flight reply', async () => {
    const { client, host } = await setup();
    let oldResolve!: (raw: string) => void;
    let reads = 0;
    host.readStatus = vi.fn(() => ++reads === 1 ? new Promise(resolve => { oldResolve = resolve; }) : Promise.resolve(JSON.stringify(response('reported'))));
    const issue = { schemaVersion: 1 as const, id: 'status-delivered-1', createdAt: '2026-11-02T08:00:00.000Z',
      scene: { id: 'crane', title: 'Paper crane', engine: 'crane@1', revision: 'bundled', testingRevision: scenes[0]!.testingRevision },
      context: { completedSteps: 1, totalSteps: 3, reportedStep: 2 }, message: 'The fold does not move',
      client: { platform: 'web' as const, appVersion: '1', buildNumber: '1', locale: 'en', width: 390, height: 844, pixelRatio: 1, reducedMotion: false } };
    host.send = vi.fn(async () => JSON.stringify({ id: issue.id, receivedAt: '2026-11-02T08:01:00.000Z' }));
    await client.setConnection({ endpoint: 'https://receiver.example', token: 'invite-a' }); client.setActive(true);
    await vi.waitFor(() => expect(host.readStatus).toHaveBeenCalledTimes(1));
    await client.enqueue(issue); await client.flush();
    await vi.waitFor(() => expect(client.getSnapshot().teamStatus?.data.scenes[0]?.state).toBe('reported'));
    oldResolve(JSON.stringify(response('unreported'))); await Promise.resolve(); await Promise.resolve();
    expect(client.getSnapshot().teamStatus?.data.scenes[0]?.state).toBe('reported');
    expect(client.getSnapshot().teamStatusState).toBe('fresh');
  });
});
