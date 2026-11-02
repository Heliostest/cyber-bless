/** Narrow, versioned diagnostic payload. Never include the game save or private wishes. */
export type FeedbackConnection = { endpoint: string; token: string };
export type FeedbackReceipt = { id: string; receivedAt: string };
export type FeedbackReport = {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  scene: { id: string; title: string; engine: string; revision: string };
  context: {
    completedSteps: number;
    totalSteps: number;
    reportedStep: number;
    instruction?: string;
    variant?: string;
    strikes?: number;
  };
  message: string;
  client: {
    platform: 'web' | 'ios' | 'android';
    appVersion: string;
    buildNumber: string;
    locale: string;
    width: number;
    height: number;
    pixelRatio: number;
    reducedMotion: boolean;
    osVersion?: string;
  };
};
export const FEEDBACK_MAX_BYTES = 32 * 1024;
export const FEEDBACK_MAX_MESSAGE_LENGTH = 4000;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const bounded = (v: unknown, min: number, max: number): v is string => typeof v === 'string' && v.length >= min && v.length <= max;
const integer = (v: unknown, min: number, max: number): v is number => Number.isSafeInteger(v) && Number(v) >= min && Number(v) <= max;
const exactKeys = (v: Record<string, unknown>, required: string[], optional: string[] = []) =>
  required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
const timestamp = (v: unknown): v is string => bounded(v, 20, 35) && Number.isFinite(Date.parse(v)) && /^\d{4}-\d\d-\d\dT/.test(v);
const feedbackId = (v: unknown): v is string => bounded(v, 8, 100) && /^[A-Za-z0-9][A-Za-z0-9_-]+$/.test(v);

/** Canonical submit URL; no credentials or tokens may travel in a URL. */
export function normalizeFeedbackEndpoint(value: string): string {
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash || !['', '/', '/api/feedback', '/api/feedback/'].includes(url.pathname))
    throw Error('Invalid feedback endpoint');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase());
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
    throw Error('Feedback requires HTTPS or a local loopback address');
  return `${url.origin}/api/feedback`;
}

/** Reject extra fields instead of silently accepting an accidentally attached private save. */
export function parseFeedbackReport(value: unknown): FeedbackReport {
  if (!record(value) || !exactKeys(value, ['schemaVersion', 'id', 'createdAt', 'scene', 'context', 'message', 'client']) ||
      value.schemaVersion !== 1 || !feedbackId(value.id) || !timestamp(value.createdAt) ||
      !bounded(value.message, 1, FEEDBACK_MAX_MESSAGE_LENGTH) || !value.message.trim()) throw Error('Invalid feedback report');
  const { scene, context, client } = value;
  if (!record(scene) || !exactKeys(scene, ['id', 'title', 'engine', 'revision']) ||
      !bounded(scene.id, 1, 100) || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(scene.id) ||
      !bounded(scene.title, 1, 200) || !bounded(scene.engine, 1, 150) || !bounded(scene.revision, 1, 150)) throw Error('Invalid feedback scene');
  if (!record(context) || !exactKeys(context, ['completedSteps', 'totalSteps', 'reportedStep'], ['instruction', 'variant', 'strikes']) ||
      !integer(context.totalSteps, 1, 1000) || !integer(context.completedSteps, 0, context.totalSteps) ||
      !integer(context.reportedStep, 1, context.totalSteps) ||
      (context.instruction !== undefined && !bounded(context.instruction, 0, 1000)) ||
      (context.variant !== undefined && !bounded(context.variant, 0, 200)) ||
      (context.strikes !== undefined && !integer(context.strikes, 0, 1000000))) throw Error('Invalid feedback step');
  if (!record(client) || !exactKeys(client,
      ['platform', 'appVersion', 'buildNumber', 'locale', 'width', 'height', 'pixelRatio', 'reducedMotion'], ['osVersion']) ||
      !['web', 'ios', 'android'].includes(String(client.platform)) ||
      !bounded(client.appVersion, 1, 100) || !bounded(client.buildNumber, 1, 100) || !bounded(client.locale, 1, 50) ||
      !integer(client.width, 1, 32768) || !integer(client.height, 1, 32768) ||
      typeof client.pixelRatio !== 'number' || !Number.isFinite(client.pixelRatio) || client.pixelRatio < 0.25 || client.pixelRatio > 8 ||
      typeof client.reducedMotion !== 'boolean' ||
      (client.osVersion !== undefined && !bounded(client.osVersion, 1, 100))) throw Error('Invalid feedback client');
  return value as FeedbackReport;
}

export function parseFeedbackReceipt(value: unknown): FeedbackReceipt {
  if (!record(value) || !exactKeys(value, ['id', 'receivedAt']) || !feedbackId(value.id) || !timestamp(value.receivedAt))
    throw Error('Invalid feedback receipt');
  return value as FeedbackReceipt;
}
