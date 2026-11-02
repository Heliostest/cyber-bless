import { normalizeFeedbackEndpoint, parseFeedbackReport, parseFeedbackStatusQuery } from '@wbr/shared/test-feedback';
import type { Storage } from './index';

export const TEST_FEEDBACK_KEY = 'cyber-bless:test-feedback:v1';
export type TestFeedbackInfo = {
  platform: 'web' | 'ios' | 'android';
  appVersion: string;
  buildNumber: string;
  osVersion?: string;
};
export type TestFeedbackHost = Storage & {
  send(endpoint: string, token: string, reportJSON: string): Promise<string>;
  readStatus?(endpoint: string, token: string, queryJSON: string): Promise<string>;
  info?: TestFeedbackInfo;
};

/** Called only for an explicitly queued internal report, never a gameplay save. */
export async function sendTestFeedback(endpoint: string, token: string, reportJSON: string): Promise<string> {
  const url = normalizeFeedbackEndpoint(endpoint);
  const report = parseFeedbackReport(JSON.parse(reportJSON));
  if (!token.trim() || token.length > 256) throw Error('Invalid feedback invitation');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Feedback-Token': token },
      body: JSON.stringify(report), signal: controller.signal,
    });
    if (!response.ok) throw Error(`Feedback receiver returned ${response.status}`);
    const raw = await response.text();
    if (raw.length > 2048) throw Error('Invalid feedback receipt');
    return raw;
  } finally { clearTimeout(timeout); }
}

export function browserTestFeedbackHost(info?: TestFeedbackInfo): TestFeedbackHost {
  return {
    read: async () => localStorage.getItem(TEST_FEEDBACK_KEY),
    write: async raw => localStorage.setItem(TEST_FEEDBACK_KEY, raw),
    send: sendTestFeedback,
    readStatus: readTestFeedbackStatus,
    info: info ?? { platform: 'web', appVersion: 'development', buildNumber: 'local' },
  };
}

/** Reads only the authenticated team summary; individual reports stay on the local dashboard. */
export async function readTestFeedbackStatus(endpoint: string, token: string, queryJSON: string): Promise<string> {
  const url = new URL(normalizeFeedbackEndpoint(endpoint));
  url.pathname = '/api/scene-status';
  const query = parseFeedbackStatusQuery(JSON.parse(queryJSON));
  if (!token.trim() || token.length > 256) throw Error('Invalid feedback invitation');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url.href, { method: 'POST', redirect: 'error', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Feedback-Token': token }, body: JSON.stringify(query), signal: controller.signal });
    if (!response.ok) throw Error(`Feedback status receiver returned ${response.status}`);
    const raw = await response.text();
    if (raw.length > 256 * 1024) throw Error('Invalid feedback status reply');
    return raw;
  } finally { clearTimeout(timeout); }
}
