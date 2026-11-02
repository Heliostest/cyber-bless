import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserTestFeedbackHost, sendTestFeedback, TEST_FEEDBACK_KEY } from './test-feedback';

const report = {
  schemaVersion: 1, id: 'transport-report-1', createdAt: '2026-11-02T08:00:00.000Z',
  scene: { id: 'crane', title: '纸鹤', engine: 'crane@1', revision: 'bundled' },
  context: { completedSteps: 1, totalSteps: 3, reportedStep: 2 }, message: 'Second fold did not respond',
  client: { platform: 'web', appVersion: 'development', buildNumber: 'local', locale: 'en', width: 390, height: 844, pixelRatio: 1, reducedMotion: false },
};
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe('internal feedback host transport', () => {
  it('sends only the validated report to the selected endpoint without cookies or redirecting', async () => {
    const receipt = JSON.stringify({ id: report.id, receivedAt: report.createdAt });
    const fetch = vi.fn(async () => new Response(receipt, { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    expect(await sendTestFeedback('https://feedback.example/', 'invite', JSON.stringify(report))).toBe(receipt);
    expect(fetch).toHaveBeenCalledWith('https://feedback.example/api/feedback', expect.objectContaining({
      method: 'POST', credentials: 'omit', redirect: 'error', body: JSON.stringify(report),
      headers: { 'Content-Type': 'application/json', 'X-Feedback-Token': 'invite' },
    }));
  });
  it('rejects private-state extras and insecure remote endpoints before network use', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(sendTestFeedback('http://example.com', 'invite', JSON.stringify(report))).rejects.toThrow();
    await expect(sendTestFeedback('https://example.com', 'invite', JSON.stringify({ ...report, state: { wishes: ['private'] } }))).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('does not turn failed HTTP or oversized replies into a delivery acknowledgement', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })));
    await expect(sendTestFeedback('http://127.0.0.1:4318', 'invite', JSON.stringify(report))).rejects.toThrow('503');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x'.repeat(2049), { status: 200 })));
    await expect(sendTestFeedback('http://127.0.0.1:4318', 'invite', JSON.stringify(report))).rejects.toThrow('receipt');
  });
  it('uses a separate local key and surfaces storage errors', async () => {
    const data = new Map([['cyber-bless:personal:v1', 'game-save']]);
    vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, raw: string) => data.set(key, raw) });
    const host = browserTestFeedbackHost(); await host.write('feedback-state');
    expect(data.get(TEST_FEEDBACK_KEY)).toBe('feedback-state');
    expect(data.get('cyber-bless:personal:v1')).toBe('game-save');
    vi.stubGlobal('localStorage', { setItem: () => { throw Error('full'); } });
    await expect(host.write('pending')).rejects.toThrow('full');
  });
});
