import type { FeedbackSceneStatus, FeedbackSceneTestState, FeedbackTeamStatus } from '@wbr/shared/test-feedback';
import { sceneTestingRevisions } from './scene-testing-revisions.generated';

export const SCENE_TEST_COPY = {
  unreported: '未反馈', reported: '已反馈', retest: '待复测', verified: '复测通过', unknown: '状态未同步',
  filter: '测试状态', all: '全部测试状态', pendingFilter: '待上传',
  pending: '待上传 {p0} 条', refresh: '刷新状态', refreshing: '正在同步测试状态…',
  unconfigured: '填写上传网址和邀请码后，可同步团队测试状态。',
  unavailable: '状态同步暂不可用，暂不判断是否反馈。',
  cached: '正在显示缓存状态，联网后刷新。', lastSync: '上次同步：{p0}',
  empty: '没有符合测试状态的仪式。', clearFilter: '清除状态筛选',
  pass: '本版本测试通过', passMessage: '本版本测试通过。',
  passNeedsSync: '先同步当前版本状态，再确认测试通过。',
  passBlockedDraft: '请先发送或清空当前问题描述，再确认通过。',
  passBlockedPending: '请先上传本仪式的待发送反馈，再确认通过。',
  passBlockedOpen: '当前版本仍有未处理反馈，请整改后再确认通过。',
  oldDraft: '这是更新前保留的草稿；发送时会保留原版本信息。',
} as const;

export type SceneTestState = FeedbackSceneTestState | 'unknown';
export type SceneTestFilter = SceneTestState | 'all' | 'pending';
type StatusSnapshot = {
  teamStatus?: { data: FeedbackTeamStatus; fetchedAt: string };
  teamStatusState?: string;
  pending: { scene: { id: string } }[];
};

/** A status for different scene code must never certify this installation. */
export function currentSceneTestStatus(sceneId: string, snapshot?: StatusSnapshot): FeedbackSceneStatus | undefined {
  const revision = sceneTestingRevisions[sceneId];
  return revision ? snapshot?.teamStatus?.data.scenes.find(row => row.id === sceneId && row.testingRevision === revision) : undefined;
}

export function sceneTestState(sceneId: string, snapshot?: StatusSnapshot): SceneTestState {
  const current = currentSceneTestStatus(sceneId, snapshot);
  if (current) return current.state;
  // Target-scoped cached history remains useful after an App update, but it
  // cannot certify changed scene code. An old untouched scene stays a cached
  // unreported result; any prior testing history now needs a fresh retest.
  const previous = snapshot?.teamStatusState !== 'fresh' && snapshot?.teamStatus?.data.scenes.find(row => row.id === sceneId);
  return previous ? previous.state === 'unreported' ? 'unreported' : 'retest' : 'unknown';
}

export function pendingSceneFeedback(sceneId: string, snapshot?: StatusSnapshot): number {
  return snapshot?.pending.filter(report => report.scene.id === sceneId).length ?? 0;
}

export function matchesSceneTestFilter(sceneId: string, filter: SceneTestFilter, snapshot?: StatusSnapshot): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending') return pendingSceneFeedback(sceneId, snapshot) > 0;
  return sceneTestState(sceneId, snapshot) === filter;
}
