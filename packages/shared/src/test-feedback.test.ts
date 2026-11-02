import { describe, expect, it } from 'vitest';
import { normalizeFeedbackEndpoint, parseFeedbackReceipt, parseFeedbackReport } from './test-feedback';

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
});
