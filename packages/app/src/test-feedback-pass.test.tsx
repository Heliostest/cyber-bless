// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { builtInScenes } from '@wbr/core/daily-scenes';
import { parseFeedbackReport, type FeedbackReport } from '@wbr/shared/test-feedback';
import { TestFeedbackOverlay, TEST_FEEDBACK_COPY } from './test-feedback-overlay';
import { SCENE_TEST_COPY } from './scene-feedback-status';
import { sceneTestingRevisions } from './scene-testing-revisions.generated';
import { clickOn, renderUI, settle, typeInto } from './dom-test-utils';

const current = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock('./test-feedback-provider', () => ({ useTestFeedback: () => current.value }));
const entry = builtInScenes.find(scene => scene.id === 'nanakusa-gayu')!;
const at = '2026-11-02T08:00:00.000Z';
const context = { completedSteps: 2, totalSteps: 3, reportedStep: 3, instruction: '公开提示' };
function existing(message: string): FeedbackReport {
  return { schemaVersion: 1, id: 'old-draft-id', createdAt: at, scene: { id: entry.id, title: entry.title, engine: entry.engine, revision: entry.revision, testingRevision: 'b'.repeat(64) },
    context: { completedSteps: 0, totalSteps: 3, reportedStep: 1 }, message,
    client: { platform: 'ios', appVersion: '1', buildNumber: '1', locale: 'zh-Hans', width: 390, height: 844, pixelRatio: 2, reducedMotion: false } };
}
async function setup(options: { status?: string; draft?: FeedbackReport; pending?: FeedbackReport[]; openIssue?: boolean; rowRevision?: string;historyMessage?:string } = {}) {
  const enqueue = vi.fn(async (_report: FeedbackReport) => true), saveDraft = vi.fn(async () => true), refreshTeamStatus = vi.fn(async () => {});
  const snapshot = { status: 'ready', saving: false, connection: { endpoint: 'https://feedback.example/api/feedback', token: 'invite' },
    drafts: options.draft ? { [entry.id]: options.draft } : {}, pending: options.pending ?? [], receipts: {},
    teamStatusState: options.status ?? 'fresh', teamStatus: { targetKey: 'receiver', fetchedAt: at, data: { schemaVersion: 1, generatedAt: at,
      scenes: [{ id: entry.id, testingRevision: options.rowRevision ?? sceneTestingRevisions[entry.id], state: options.openIssue ? 'reported' : 'retest', issueCount: 1,
        openIssueCount: options.openIssue ? 1 : 0, reviewToken: 'a'.repeat(64) }] } } };
  const readHistory=vi.fn(async()=>({schemaVersion:1,sceneId:entry.id,generatedAt:at,items:options.historyMessage?[{id:'old-fixed-issue-001',createdAt:at,receivedAt:at,updatedAt:at,status:'fixed',message:options.historyMessage,reportedStep:2,totalSteps:3,revision:'bundled',testingRevision:'b'.repeat(64),platform:'ios',appVersion:'1.0.0',buildNumber:'28'}]:[]}));
  current.value = { client: { enqueue, saveDraft, setConnection: vi.fn(async () => true), refreshTeamStatus,readHistory }, snapshot,
    info: { platform: 'ios', appVersion: '1', buildNumber: '2' } };
  const onOpenChange = vi.fn();
  const ui = renderUI(createElement(TestFeedbackOverlay, { entry, context, reducedMotion: false, onOpenChange }));
  clickOn(ui.host.querySelector('button')!); await settle();
  const button = (copy: string) => [...ui.host.querySelectorAll<HTMLButtonElement>('button')].find(candidate => candidate.textContent === copy)!;
  return { ...ui, snapshot, enqueue, saveDraft, refreshTeamStatus,readHistory, button,
    pass: () => button(SCENE_TEST_COPY.pass), textarea: () => ui.host.querySelector<HTMLTextAreaElement>('textarea')! };
}
afterEach(() => { current.value = undefined; document.body.replaceChildren(); });

it('automatically shows earlier fixed issues during retest without turning them into a new draft or a pass',async()=>{
 const ui=await setup({historyMessage:'之前第二步无法放下'});
 expect(ui.readHistory).toHaveBeenCalledWith(entry.id,undefined);expect(ui.host.textContent).toContain('之前第二步无法放下');expect(ui.host.textContent).toContain('已修复，待核对');expect(ui.host.textContent).toContain('1.0.0 (28)');
 expect(ui.textarea().value).toBe('');expect(ui.enqueue).not.toHaveBeenCalled();expect(ui.pass().disabled).toBe(false);ui.unmount();
});

it('creates an immutable explicit pass for the current version and review basis instead of converting an old draft', async () => {
  const oldDraft = existing('');
  const ui = await setup({ draft: oldDraft });
  expect(ui.pass().disabled).toBe(false); clickOn(ui.pass()); await settle();
  expect(ui.enqueue).toHaveBeenCalledTimes(1);
  const report = parseFeedbackReport(ui.enqueue.mock.calls[0][0]);
  expect(report.id).not.toBe(oldDraft.id);
  expect(report.result).toBe('pass');
  expect(report.scene.testingRevision).toBe(sceneTestingRevisions[entry.id]);
  expect(report.reviewToken).toBe('a'.repeat(64));
  expect(report.context).toEqual(context);
  expect(report.client.buildNumber).toBe('2');
  expect(oldDraft.scene.testingRevision).toBe('b'.repeat(64));
  expect(oldDraft.context.reportedStep).toBe(1);
  expect(ui.textarea().disabled).toBe(true); ui.unmount();
});

it.each(['stale', 'error', 'loading', 'unavailable'])('cannot confirm a pass from %s team status', async status => {
  const ui = await setup({ status });
  expect(ui.pass().disabled).toBe(true);
  expect(ui.host.textContent).toContain(SCENE_TEST_COPY.passNeedsSync);
  clickOn(ui.pass()); expect(ui.enqueue).not.toHaveBeenCalled(); ui.unmount();
});

it('cannot use a fresh response for older scene code to certify this version', async () => {
  const ui = await setup({ rowRevision: 'b'.repeat(64) });
  expect(ui.pass().disabled).toBe(true); ui.unmount();
});

it('protects unsent problem text and sends legacy drafts with their original fingerprint', async () => {
  const oldDraft = existing('旧版本的问题描述');
  const ui = await setup({ draft: oldDraft });
  expect(ui.pass().disabled).toBe(true);
  expect(ui.host.textContent).toContain(SCENE_TEST_COPY.passBlockedDraft);
  clickOn(ui.pass()); expect(ui.enqueue).not.toHaveBeenCalled();
  expect(ui.textarea().value).toBe(oldDraft.message);
  clickOn(ui.button(TEST_FEEDBACK_COPY.send)); await settle();
  const submitted = parseFeedbackReport(ui.enqueue.mock.calls[0][0]);
  expect(submitted.id).toBe(oldDraft.id);
  expect(submitted.result).toBeUndefined();
  expect(submitted.scene.testingRevision).toBe(oldDraft.scene.testingRevision);
  expect(ui.snapshot.drafts[entry.id]).toBe(oldDraft); ui.unmount();
});

it('blocks passes while the scene has queued feedback or a current unresolved issue', async () => {
  const pending = await setup({ pending: [existing('已排队的问题')] });
  expect(pending.pass().disabled).toBe(true);
  expect(pending.host.textContent).toContain(SCENE_TEST_COPY.passBlockedPending); pending.unmount();
  const unresolved = await setup({ openIssue: true });
  expect(unresolved.pass().disabled).toBe(true);
  expect(unresolved.host.textContent).toContain(SCENE_TEST_COPY.passBlockedOpen); unresolved.unmount();
});

it('new problem input blocks a pass without requiring the tester to lose or overwrite it', async () => {
  const ui = await setup(); typeInto(ui.textarea(), '这一步依然没有反应'); await settle();
  expect(ui.pass().disabled).toBe(true);
  expect(ui.saveDraft).toHaveBeenCalled();
  expect(ui.textarea().value).toBe('这一步依然没有反应'); ui.unmount();
});
