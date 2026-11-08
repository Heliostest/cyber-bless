/** Narrow, versioned diagnostic payload. Never include the game save or private wishes. */
export type FeedbackConnection = { endpoint: string; token: string };
export type FeedbackReceipt = { id: string; receivedAt: string };
export type FeedbackSceneIdentity = { id: string; testingRevision: string };
export type FeedbackSceneTestState = 'unreported' | 'reported' | 'retest' | 'verified';
export type FeedbackSceneStatus = FeedbackSceneIdentity & {
  state: FeedbackSceneTestState;
  issueCount: number;
  openIssueCount: number;
  reviewToken: string;
  latestFeedbackAt?: string;
};
export type FeedbackTeamStatus = { schemaVersion: 1; generatedAt: string; scenes: FeedbackSceneStatus[] };
export type FeedbackStatusQuery = { schemaVersion: 1; scenes: FeedbackSceneIdentity[] };
export const FEEDBACK_HISTORY_PAGE_SIZE=20;
export type FeedbackHistoryQuery={schemaVersion:1;type:'history';sceneId:string;cursor?:string};
export type FeedbackHistoryItem={
  id:string;createdAt:string;receivedAt:string;updatedAt:string;status:'new'|'triaged'|'fixed';message:string;
  reportedStep:number;totalSteps:number;instruction?:string;revision:string;testingRevision?:string;
  platform:'web'|'ios'|'android';appVersion:string;buildNumber:string;updateSourceCommit?:string;
};
export type FeedbackHistoryPage={schemaVersion:1;sceneId:string;generatedAt:string;items:FeedbackHistoryItem[];nextCursor?:string};
export type FeedbackReport = {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  scene: { id: string; title: string; engine: string; revision: string; testingRevision?: string };
  /** Absent on old reports, which remain ordinary issue feedback. */
  result?: 'issue' | 'pass';
  /** The issue basis seen by the tester; it is not an authentication credential. */
  reviewToken?: string;
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
    updateId?: string;
    updateRuntimeVersion?: string;
    updateSourceCommit?: string;
    updateSourceTree?: string;
    updateEmbedded?: boolean;
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
const sceneId = (v: unknown): v is string => bounded(v, 1, 100) && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(v);
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);

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
  if (!record(value) || !exactKeys(value, ['schemaVersion', 'id', 'createdAt', 'scene', 'context', 'message', 'client'], ['result', 'reviewToken']) ||
      value.schemaVersion !== 1 || !feedbackId(value.id) || !timestamp(value.createdAt) ||
      !bounded(value.message, 1, FEEDBACK_MAX_MESSAGE_LENGTH) || !value.message.trim() ||
      (value.result !== undefined && value.result !== 'issue' && value.result !== 'pass') ||
      (value.reviewToken !== undefined && !hash(value.reviewToken))) throw Error('Invalid feedback report');
  const { scene, context, client } = value;
  if (!record(scene) || !exactKeys(scene, ['id', 'title', 'engine', 'revision'], ['testingRevision']) ||
      !sceneId(scene.id) || !bounded(scene.title, 1, 200) || !bounded(scene.engine, 1, 150) || !bounded(scene.revision, 1, 150) ||
      (scene.testingRevision !== undefined && !hash(scene.testingRevision)) ||
      (value.result === 'pass' && (!hash(scene.testingRevision) || !hash(value.reviewToken)))) throw Error('Invalid feedback scene');
  if (!record(context) || !exactKeys(context, ['completedSteps', 'totalSteps', 'reportedStep'], ['instruction', 'variant', 'strikes']) ||
      !integer(context.totalSteps, 1, 1000) || !integer(context.completedSteps, 0, context.totalSteps) ||
      !integer(context.reportedStep, 1, context.totalSteps) ||
      (context.instruction !== undefined && !bounded(context.instruction, 0, 1000)) ||
      (context.variant !== undefined && !bounded(context.variant, 0, 200)) ||
      (context.strikes !== undefined && !integer(context.strikes, 0, 1000000))) throw Error('Invalid feedback step');
  if (!record(client) || !exactKeys(client,
    ['platform', 'appVersion', 'buildNumber', 'locale', 'width', 'height', 'pixelRatio', 'reducedMotion'], ['osVersion','updateId','updateRuntimeVersion','updateSourceCommit','updateSourceTree','updateEmbedded']) ||
      typeof client.platform !== 'string' || !['web', 'ios', 'android'].includes(client.platform) ||
      !bounded(client.appVersion, 1, 100) || !bounded(client.buildNumber, 1, 100) || !bounded(client.locale, 1, 50) ||
      !integer(client.width, 1, 32768) || !integer(client.height, 1, 32768) ||
      typeof client.pixelRatio !== 'number' || !Number.isFinite(client.pixelRatio) || client.pixelRatio < 0.25 || client.pixelRatio > 8 ||
      typeof client.reducedMotion !== 'boolean' ||
      (client.osVersion !== undefined && !bounded(client.osVersion, 1, 100)) ||
      (client.updateId!==undefined&&(typeof client.updateId!=='string'||!/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(client.updateId))) ||
      (client.updateRuntimeVersion!==undefined&&!bounded(client.updateRuntimeVersion,1,200)) ||
      ([client.updateSourceCommit,client.updateSourceTree].some(value=>value!==undefined&&(typeof value!=='string'||!/^[a-f\d]{40}$/.test(value)))) ||
      (client.updateEmbedded!==undefined&&typeof client.updateEmbedded!=='boolean')) throw Error('Invalid feedback client');
  return value as FeedbackReport;
}

export function parseFeedbackReceipt(value: unknown): FeedbackReceipt {
  if (!record(value) || !exactKeys(value, ['id', 'receivedAt']) || !feedbackId(value.id) || !timestamp(value.receivedAt))
    throw Error('Invalid feedback receipt');
  return value as FeedbackReceipt;
}

export function parseFeedbackStatusQuery(value: unknown): FeedbackStatusQuery {
  if (!record(value) || !exactKeys(value, ['schemaVersion', 'scenes']) || value.schemaVersion !== 1 ||
      !Array.isArray(value.scenes) || value.scenes.length > 200 || value.scenes.some(scene =>
        !record(scene) || !exactKeys(scene, ['id', 'testingRevision']) || !sceneId(scene.id) || !hash(scene.testingRevision)) ||
      new Set(value.scenes.map(scene => scene.id)).size !== value.scenes.length) throw Error('Invalid feedback status query');
  return value as FeedbackStatusQuery;
}

export function parseFeedbackTeamStatus(value: unknown): FeedbackTeamStatus {
  if (!record(value) || !exactKeys(value, ['schemaVersion', 'generatedAt', 'scenes']) || value.schemaVersion !== 1 || !timestamp(value.generatedAt) ||
      !Array.isArray(value.scenes) || value.scenes.length > 200 || value.scenes.some(scene =>
        !record(scene) || !exactKeys(scene, ['id', 'testingRevision', 'state', 'issueCount', 'openIssueCount', 'reviewToken'], ['latestFeedbackAt']) ||
        !sceneId(scene.id) || !hash(scene.testingRevision) || typeof scene.state !== 'string' || !['unreported', 'reported', 'retest', 'verified'].includes(scene.state) ||
        !integer(scene.issueCount, 0, 1000000) || !integer(scene.openIssueCount, 0, Number(scene.issueCount)) || !hash(scene.reviewToken) ||
        (scene.latestFeedbackAt !== undefined && !timestamp(scene.latestFeedbackAt))) ||
      new Set(value.scenes.map(scene => scene.id)).size !== value.scenes.length) throw Error('Invalid feedback team status');
  return value as FeedbackTeamStatus;
}

const historyCursor=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,512}$/.test(value);
export function parseFeedbackHistoryQuery(value:unknown):FeedbackHistoryQuery {
  if(!record(value)||!exactKeys(value,['schemaVersion','type','sceneId'],['cursor'])||value.schemaVersion!==1||value.type!=='history'||!sceneId(value.sceneId)||(value.cursor!==undefined&&!historyCursor(value.cursor)))throw Error('Invalid feedback history query');
  return value as FeedbackHistoryQuery;
}
export function parseFeedbackHistoryPage(value:unknown):FeedbackHistoryPage {
  if(!record(value)||!exactKeys(value,['schemaVersion','sceneId','generatedAt','items'],['nextCursor'])||value.schemaVersion!==1||!sceneId(value.sceneId)||!timestamp(value.generatedAt)||!Array.isArray(value.items)||value.items.length>FEEDBACK_HISTORY_PAGE_SIZE||(value.nextCursor!==undefined&&!historyCursor(value.nextCursor)))throw Error('Invalid feedback history page');
  for(const item of value.items){
    if(!record(item)||!exactKeys(item,['id','createdAt','receivedAt','updatedAt','status','message','reportedStep','totalSteps','revision','platform','appVersion','buildNumber'],['instruction','testingRevision','updateSourceCommit'])||!feedbackId(item.id)||![item.createdAt,item.receivedAt,item.updatedAt].every(timestamp)||typeof item.status!=='string'||!['new','triaged','fixed'].includes(item.status)||!bounded(item.message,1,FEEDBACK_MAX_MESSAGE_LENGTH)||!item.message.trim()||!integer(item.totalSteps,1,1000)||!integer(item.reportedStep,1,item.totalSteps)||!bounded(item.revision,1,150)||typeof item.platform!=='string'||!['web','ios','android'].includes(item.platform)||!bounded(item.appVersion,1,100)||!bounded(item.buildNumber,1,100)||(item.instruction!==undefined&&!bounded(item.instruction,0,1000))||(item.testingRevision!==undefined&&!hash(item.testingRevision))||(item.updateSourceCommit!==undefined&&(typeof item.updateSourceCommit!=='string'||!/^[a-f\d]{40}$/.test(item.updateSourceCommit))))throw Error('Invalid feedback history item');
  }
  if(new Set(value.items.map(item=>item.id)).size!==value.items.length)throw Error('Duplicate feedback history item');
  return value as FeedbackHistoryPage;
}
