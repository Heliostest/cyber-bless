// @vitest-environment jsdom
import { act, createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { createState } from '@wbr/core';
import { isSceneVisibleInApp } from '@wbr/core/daily-scenes';
import { Context, type AppContext } from './context';
import { builtInScenes, SceneCatalog, SceneLibraryContext } from './scene-library';
import { currentSceneTestStatus, SCENE_TEST_COPY } from './scene-feedback-status';
import { sceneTestingRevisions } from './scene-testing-revisions.generated';
import { clickOn, renderUI, settle, typeInto } from './dom-test-utils';

const current = vi.hoisted(() => ({ value: undefined as unknown }));
vi.mock('./test-feedback-provider', () => ({ useTestFeedback: () => current.value }));
const entries = builtInScenes.filter(isSceneVisibleInApp).slice(0, 5);
const at = '2026-11-02T08:00:00.000Z';
function row(index: number, state: 'unreported' | 'reported' | 'retest' | 'verified') {
  return { id: entries[index].id, testingRevision: sceneTestingRevisions[entries[index].id], state,
    issueCount: state === 'unreported' ? 0 : 1, openIssueCount: state === 'reported' ? 1 : 0, reviewToken: 'a'.repeat(64) };
}
function setup(options: { state?: string; rows?: ReturnType<typeof row>[]; pending?: string[]; configured?: boolean } = {}) {
  const rows = options.rows ?? [row(0, 'unreported'), row(1, 'reported'), row(2, 'retest'), row(3, 'verified')];
  const refreshTeamStatus = vi.fn(async () => {}), go = vi.fn();
  const snapshot = {
    status: 'ready', connection: options.configured === false ? { endpoint: '', token: '' } : { endpoint: 'https://feedback.example/api/feedback', token: 'invite' },
    pending: (options.pending ?? []).map(id => ({ scene: { id } })),
    ...(options.state === 'unavailable' ? {} : { teamStatus: { targetKey: 'receiver', fetchedAt: at, data: { schemaVersion: 1, generatedAt: at, scenes: rows } } }),
    teamStatusState: options.state ?? 'fresh',
  };
  current.value = { snapshot, client: { refreshTeamStatus } };
  const ui = renderUI(createElement(Context.Provider, { value: { state: createState(), go, dispatch: () => true } as unknown as AppContext },
    createElement(SceneLibraryContext.Provider, { value: { entries, ready: true, error: '' } as never }, createElement(SceneCatalog))));
  return { ...ui, snapshot, refreshTeamStatus, go,
    card: (index: number) => ui.host.querySelector(`[data-scene="${entries[index].id}"]`),
    filter: () => ui.host.querySelector<HTMLSelectElement>('.scene-test-toolbar select')!,
  };
}
function select(field: HTMLSelectElement, value: string) {
  act(() => { field.value = value; field.dispatchEvent(new Event('change', { bubbles: true })); });
}
afterEach(() => { current.value = undefined; document.body.replaceChildren(); });

it('shows the four authoritative team states and keeps unsent feedback separate', async () => {
  const ui = setup({ pending: [entries[0].id, entries[0].id] }); await settle();
  for (const [index, state] of ['unreported', 'reported', 'retest', 'verified'].entries()) {
    expect(ui.card(index)?.querySelector('.scene-test-badge')?.getAttribute('data-test-state')).toBe(state);
    expect(ui.card(index)?.textContent).toContain(SCENE_TEST_COPY[state as keyof typeof SCENE_TEST_COPY]);
  }
  expect(ui.card(0)?.querySelector('.scene-test-pending')?.textContent).toContain('2');
  expect(ui.card(0)?.querySelector('.scene-test-badge')?.textContent).toBe(SCENE_TEST_COPY.unreported);
  expect(ui.card(4)?.querySelector('.scene-test-badge')?.textContent).toBe(SCENE_TEST_COPY.unknown);
  expect(ui.refreshTeamStatus).toHaveBeenCalledTimes(1);
  clickOn([...ui.host.querySelectorAll('button')].find(button => button.textContent === SCENE_TEST_COPY.refresh)!);
  expect(ui.refreshTeamStatus).toHaveBeenCalledTimes(2);
  ui.unmount();
});

it('combines status filters with search and keeps the catalog feedback route marker', async () => {
  const ui = setup({ pending: [entries[1].id] }); await settle();
  select(ui.filter(), 'retest'); await settle();
  expect(ui.host.querySelectorAll('.scene-card')).toHaveLength(1);
  expect(ui.card(2)).not.toBeNull();
  typeInto(ui.host.querySelector<HTMLInputElement>('.scene-search input')!, 'not-a-match'); await settle();
  expect(ui.host.querySelectorAll('.scene-card')).toHaveLength(0);
  expect(ui.host.textContent).toContain(SCENE_TEST_COPY.empty);
  typeInto(ui.host.querySelector<HTMLInputElement>('.scene-search input')!, '');
  select(ui.filter(), 'pending'); await settle();
  expect(ui.host.querySelectorAll('.scene-card')).toHaveLength(1);
  clickOn(ui.card(1)!);
  expect(ui.go).toHaveBeenCalledWith(expect.objectContaining({ id: entries[1].id, feedbackSession: true }));
  ui.unmount();
});

it('does not mislabel unavailable status or a different scene fingerprint as unreported', async () => {
  const wrong = { ...row(0, 'verified'), testingRevision: 'b'.repeat(64) };
  const ui = setup({ rows: [wrong], state: 'error' }); await settle();
  expect(currentSceneTestStatus(entries[0].id, ui.snapshot as never)).toBeUndefined();
  expect(ui.card(0)?.querySelector('.scene-test-badge')?.textContent).toBe(SCENE_TEST_COPY.retest);
  expect(ui.host.textContent).toContain(SCENE_TEST_COPY.cached); ui.unmount();
  const untouched = setup({ rows: [{ ...row(0, 'unreported'), testingRevision: 'b'.repeat(64) }], state: 'stale' }); await settle();
  expect(untouched.card(0)?.querySelector('.scene-test-badge')?.textContent).toBe(SCENE_TEST_COPY.unreported);
  expect(untouched.host.textContent).toContain(SCENE_TEST_COPY.cached); untouched.unmount();
  const offline = setup({ state: 'unavailable' }); await settle();
  expect(offline.host.querySelectorAll('[data-test-state="unreported"]')).toHaveLength(0);
  expect(offline.host.textContent).toContain(SCENE_TEST_COPY.unavailable); offline.unmount();
});

it('labels cached results and requires connection setup before team synchronization', async () => {
  const cached = setup({ state: 'stale' }); await settle();
  expect(cached.card(2)?.querySelector('.scene-test-badge')?.textContent).toBe(SCENE_TEST_COPY.retest);
  expect(cached.host.textContent).toContain(SCENE_TEST_COPY.cached);
  expect(cached.host.textContent).toContain('11'); cached.unmount();
  const missing = setup({ state: 'unavailable', configured: false }); await settle();
  expect(missing.host.textContent).toContain(SCENE_TEST_COPY.unconfigured);
  expect([...missing.host.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === SCENE_TEST_COPY.refresh)?.disabled).toBe(true);
  missing.unmount();
});
