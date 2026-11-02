import { describe, expect, it } from 'vitest';
import { normalizeFeedbackEndpoint, parseFeedbackReceipt, parseFeedbackReport, parseFeedbackStatusQuery, parseFeedbackTeamStatus } from './test-feedback';

const report = () => ({ schemaVersion: 1, id: 'feedback-test-123', createdAt: '2026-11-02T08:00:00.000Z',
  scene: { id: 'crane', title: '纸鹤', engine: 'crane@1', revision: 'bundled' },
  context: { completedSteps: 0, totalSteps: 3, reportedStep: 1 }, message: '拖动时不能放下',
  client: { platform: 'ios', appVersion: '1.0', buildNumber: '20', locale: 'zh-Hans', width: 390, height: 844, pixelRatio: 3, reducedMotion: false } });

describe('test feedback wire contract', () => {
  it('accepts bounded diagnostic reports and rejects private extra state', () => {
    expect(parseFeedbackReport(report()).scene.id).toBe('crane');
    expect(() => parseFeedbackReport({ ...report(), state: { wishes: ['private'] } })).toThrow();
    const extra = report(); Object.assign(extra.context, { wishId: 'private' });
    expect(() => parseFeedbackReport(extra)).toThrow();
  });
  it('bounds step values, text, identifiers and device values', () => {
    for (const mutation of [
      (r: ReturnType<typeof report>) => { r.message = ' '; },
      (r: ReturnType<typeof report>) => { r.message = 'a'.repeat(4001); },
      (r: ReturnType<typeof report>) => { r.id = '../private'; },
      (r: ReturnType<typeof report>) => { r.context.reportedStep = 4; },
      (r: ReturnType<typeof report>) => { r.context.completedSteps = -1; },
      (r: ReturnType<typeof report>) => { r.client.pixelRatio = Infinity; },
    ]) { const r = report(); mutation(r); expect(() => parseFeedbackReport(r)).toThrow(); }
  });
  it('requires a receipt with an actual ID and timestamp', () => {
    expect(parseFeedbackReceipt({ id: 'feedback-test-123', receivedAt: '2026-11-02T08:00:00.000Z' }).id).toBe('feedback-test-123');
    for (const r of [{ ok: true }, { id: '../x', receivedAt: 'now' }, { id: 'feedback-test-123', receivedAt: 'yesterday' }])
      expect(() => parseFeedbackReceipt(r)).toThrow();
  });
  it('normalizes rotating tunnel addresses while rejecting unsafe targets and URL credentials', () => {
    expect(normalizeFeedbackEndpoint(' https://new-random.trycloudflare.com/ ')).toBe('https://new-random.trycloudflare.com/api/feedback');
    expect(normalizeFeedbackEndpoint('http://127.0.0.1:4318/api/feedback')).toBe('http://127.0.0.1:4318/api/feedback');
    for (const url of ['http://example.com', 'https://user:secret@example.com', 'https://example.com?token=secret', 'https://example.com/#token', 'https://example.com/admin', 'file:///tmp/report', 'http://127.0.0.1.evil.example'])
      expect(() => normalizeFeedbackEndpoint(url)).toThrow();
  });
  it('keeps old reports valid and requires versioned issue basis for a pass', () => {
    const hash = 'a'.repeat(64), basis = 'b'.repeat(64);
    expect(parseFeedbackReport(report()).result).toBeUndefined();
    const pass = { ...report(), result: 'pass', reviewToken: basis, scene: { ...report().scene, testingRevision: hash } };
    expect(parseFeedbackReport(pass).result).toBe('pass');
    for (const invalid of [{ ...pass, reviewToken: undefined }, { ...pass, scene: report().scene }, { ...pass, result: 'fixed' },
      { ...pass, scene: { ...pass.scene, testingRevision: 'bundled' } }, { ...pass, reviewToken: '../secret' }])
      expect(() => parseFeedbackReport(invalid)).toThrow();
  });
  it('validates narrow bounded scene queries and aggregate replies without private fields', () => {
    const identity = { id: 'crane', testingRevision: 'a'.repeat(64) };
    const query = { schemaVersion: 1, scenes: [identity] };
    expect(parseFeedbackStatusQuery(query).scenes).toEqual([identity]);
    for (const value of [{ ...query, scenes: [identity, identity] }, { ...query, scenes: Array.from({ length: 201 }, (_, n) => ({ ...identity, id: 'scene-' + n })) },
      { ...query, scenes: [{ ...identity, private: true }] }, { ...query, token: 'private' }]) expect(() => parseFeedbackStatusQuery(value)).toThrow();
    const status = { ...identity, state: 'retest', issueCount: 2, openIssueCount: 1, reviewToken: 'b'.repeat(64), latestFeedbackAt: '2026-11-02T08:00:00.000Z' };
    const reply = { schemaVersion: 1, generatedAt: '2026-11-02T08:00:00.000Z', scenes: [status] };
    expect(parseFeedbackTeamStatus(reply).scenes[0].state).toBe('retest');
    for (const value of [{ ...reply, scenes: [{ ...status, message: 'private' }] }, { ...reply, scenes: [{ ...status, openIssueCount: 3 }] },
      { ...reply, scenes: [{ ...status, state: 'pending' }] }, { ...reply, scenes: [{ ...status, state: ['retest'] }] },
      { ...reply, scenes: [status, status] }]) expect(() => parseFeedbackTeamStatus(value)).toThrow();
  });
});
