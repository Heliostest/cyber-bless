// @vitest-environment jsdom
import { act, createElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createState, reduce } from '@wbr/core';
import { builtInScenes } from '@wbr/core/daily-scenes';
import type { TestFeedbackHost } from '@wbr/runtime';
import { BlessingApp } from './App';
import { Context, type AppContext, type Route } from './context';
import { useOpenScene } from './scene-library';
import { TEST_FEEDBACK_COPY } from './test-feedback-overlay';
import { clickOn, renderUI, settle, typeInto } from './dom-test-utils';

const scene = vi.hoisted(() => ({ mounts: [] as { context: { checkpoint(n: number): void }; active: boolean[] }[] }));
vi.mock('@wbr/scene-runtime', async original => ({
  ...await original<typeof import('@wbr/scene-runtime')>(),
  mountScene(config: { context: { checkpoint(n: number): void }; ready(): void }) {
    const mount = { context: config.context, active: [] as boolean[] }; scene.mounts.push(mount);
    queueMicrotask(() => config.ready());
    return { initialized: Promise.resolve(), controller: null, setActive(active: boolean) { mount.active.push(active); }, setReducedMotion() {}, dispose() {} };
  },
}));
const entry = builtInScenes.find(candidate => candidate.id === 'nanakusa-gayu')!;
const at = '2026-11-02T08:00:00.000Z';
function fixture(initialFeedback: unknown = null) {
  let state = reduce(createState(), { type: 'scene.visit', entry, at });
  state = reduce(state, { type: 'scene.progress', id: entry.id, progress: 1 });
  let game = JSON.stringify(state), feedbackRaw: string | null = initialFeedback === null ? null : JSON.stringify(initialFeedback);
  const adapter: TestFeedbackHost = {
    read: vi.fn(async () => feedbackRaw), write: vi.fn(async raw => { feedbackRaw = raw; }),
    send: vi.fn(async () => { throw Error('offline'); }),
    info: { platform: 'ios', appVersion: '1.0.0', buildNumber: '42', osVersion: '18.0' },
  };
  const host = { read: async () => game, write: async (raw: string) => { game = raw; }, testFeedback: adapter };
  return { state, host, adapter, feedback: () => feedbackRaw ? JSON.parse(feedbackRaw) : null, feedbackRaw: () => feedbackRaw };
}
async function open({ enabled = true, marker = true, readFailure = false, initialFeedback = null as unknown } = {}) {
  const data = fixture(initialFeedback);
  if (readFailure) data.adapter.read = vi.fn(async () => { throw Error('storage unavailable'); });
  const initialRoute: Route = { page: 'scene', id: entry.id, entry, ...(marker ? { feedbackSession: true } : {}) };
  const props = { host: data.host, internalToolsEnabled: enabled, initialRoute };
  const ui = renderUI(createElement(BlessingApp, props));
  await settle(); await settle();
  return { ...data, ...ui, props,
    trigger: () => ui.host.querySelector<HTMLButtonElement>('.test-feedback-trigger')!,
    dialog: () => ui.host.querySelector<HTMLDialogElement>('.test-feedback-dialog')!,
    textarea: () => ui.host.querySelector<HTMLTextAreaElement>('.test-feedback-dialog textarea')!,
  };
}
async function openReporter(ui: Awaited<ReturnType<typeof open>>) {
  clickOn(ui.trigger()); await settle();
}
function button(host: HTMLElement, copy: string) {
  return [...host.querySelectorAll('button')].find(candidate => candidate.textContent === copy)!;
}
afterEach(() => { document.body.replaceChildren(); scene.mounts = []; vi.restoreAllMocks(); });

describe('internal ritual feedback overlay', () => {
  it.each([[true, false], [false, true], [false, false]])('stays absent for enabled=%s and catalog marker=%s', async (enabled, marker) => {
    const ui = await open({ enabled, marker });
    expect(ui.trigger()).toBeNull(); ui.unmount();
  });

  it('freezes the reported checkpoint while pausing and resuming the same scene instance', async () => {
    const ui = await open();
    expect(scene.mounts).toHaveLength(1);
    await openReporter(ui);
    expect(ui.dialog().hasAttribute('open')).toBe(true);
    expect(scene.mounts[0].active.at(-1)).toBe(false);
    expect(ui.dialog().querySelector<HTMLInputElement>('input[type=number]')!.value).toBe('2');
    // A late callback cannot change the context frozen when the reporter opened.
    act(() => scene.mounts[0].context.checkpoint(2)); await settle();
    expect(ui.dialog().querySelector<HTMLInputElement>('input[type=number]')!.value).toBe('2');
    expect(ui.dialog().textContent).toContain('1 / 3');
    clickOn(ui.dialog().querySelector('[data-feedback-close]')!); await settle();
    expect(scene.mounts).toHaveLength(1);
    expect(scene.mounts[0].active.at(-1)).toBe(true);
    expect(document.activeElement).toBe(ui.trigger()); ui.unmount();
  });

  it('keeps failed text and pending reports locally and can resume another report', async () => {
    const ui = await open(); await openReporter(ui);
    typeInto(ui.textarea(), '第二步松手后没有反应');
    typeInto(ui.dialog().querySelector<HTMLInputElement>('input[type=url]')!, 'https://old.trycloudflare.com');
    typeInto(ui.dialog().querySelector<HTMLInputElement>('input[type=password]')!, 'test-invite');
    clickOn(button(ui.host, TEST_FEEDBACK_COPY.send)); await settle(); await settle();
    expect(ui.feedback()?.pending).toHaveLength(1);
    expect(ui.feedback().pending[0].message).toBe('第二步松手后没有反应');
    expect(ui.textarea().value).toBe('第二步松手后没有反应');
    expect(ui.textarea().disabled).toBe(true);
    expect(ui.dialog().textContent).toContain(TEST_FEEDBACK_COPY.queued);
    const queuedId = ui.feedback().pending[0].id;
    clickOn(button(ui.host, TEST_FEEDBACK_COPY.newReport)); await settle();
    typeInto(ui.textarea(), '另一个操作问题'); await settle();
    expect(ui.feedback().drafts[entry.id].id).not.toBe(queuedId);
    expect(ui.feedback().pending[0].id).toBe(queuedId);
    clickOn(ui.dialog().querySelector('[data-feedback-close]')!); await settle();
    await openReporter(ui);
    expect(ui.textarea().value).toBe('另一个操作问题'); ui.unmount();
  });

  it('shows success only after a matching receipt and keeps invitation out of the report', async () => {
    const ui = await open();
    ui.adapter.send = vi.fn(async (_endpoint, _token, reportJSON) => JSON.stringify({ id: JSON.parse(reportJSON).id, receivedAt: at }));
    await openReporter(ui);
    typeInto(ui.textarea(), '拖动后没有响应');
    typeInto(ui.dialog().querySelector<HTMLInputElement>('input[type=url]')!, 'https://receiver.example');
    typeInto(ui.dialog().querySelector<HTMLInputElement>('input[type=password]')!, 'secret-invite');
    clickOn(button(ui.host, TEST_FEEDBACK_COPY.send)); await settle(); await settle();
    expect(ui.dialog().textContent).toContain(TEST_FEEDBACK_COPY.sent);
    expect(ui.feedback().pending).toEqual([]);
    const submitted = JSON.parse(vi.mocked(ui.adapter.send).mock.calls[0][2]);
    expect(JSON.stringify(submitted)).not.toContain('secret-invite');
    expect(submitted).not.toHaveProperty('state');
    expect(submitted.context).toMatchObject({ completedSteps: 1, totalSteps: 3, reportedStep: 2 });
    expect(submitted.client).toMatchObject({ platform: 'ios', buildNumber: '42' }); ui.unmount();
  });

  it('native back closes feedback before navigating away from the scene', async () => {
    const ui = await open(); await openReporter(ui);
    ui.rerender(createElement(BlessingApp, { ...ui.props, backRequest: 1 })); await settle();
    expect(ui.dialog()).toBeNull();
    expect(ui.host.querySelector('.scene-experience')).not.toBeNull();
    expect(scene.mounts).toHaveLength(1);
    expect(scene.mounts[0].active.at(-1)).toBe(true); ui.unmount();
  });

  it('retains unsaved input through close and reopen when feedback storage cannot be read', async () => {
    const ui = await open({ readFailure: true }); await openReporter(ui);
    typeInto(ui.textarea(), '尚未保存但不能丢失的描述');
    expect(ui.dialog().textContent).toContain(TEST_FEEDBACK_COPY.readError);
    clickOn(ui.dialog().querySelector('[data-feedback-close]')!); await settle();
    await openReporter(ui);
    expect(ui.textarea().value).toBe('尚未保存但不能丢失的描述');
    expect(ui.adapter.send).not.toHaveBeenCalled(); ui.unmount();
  });

  it.each(['新输入 B', ''])('keeps newer local draft %j when recovery restores old disk input, and persists it for restart', async newer => {
    const first = await open(); await openReporter(first);
    typeInto(first.textarea(), '旧草稿 A'); await settle();
    const oldStore = first.feedback(); first.unmount();
    const ui = await open({ readFailure: true, initialFeedback: oldStore }); await openReporter(ui);
    typeInto(ui.textarea(), '先输入再清空');
    typeInto(ui.textarea(), newer);
    clickOn(ui.dialog().querySelector('[data-feedback-close]')!); await settle();
    await openReporter(ui);
    expect(ui.textarea().value).toBe(newer);
    ui.adapter.read = vi.fn(async () => ui.feedbackRaw());
    clickOn(button(ui.host, '重新读取')); await settle(); await settle();
    clickOn(ui.dialog().querySelector('[data-feedback-close]')!); await settle();
    await openReporter(ui);
    expect(ui.textarea().value).toBe(newer);
    expect(ui.feedback().drafts[entry.id].message).toBe(newer);
    const recoveredStore = ui.feedback(); ui.unmount();
    const restarted = await open({ initialFeedback: recoveredStore }); await openReporter(restarted);
    expect(restarted.textarea().value).toBe(newer); restarted.unmount();
  });
});

it('catalog feedback provenance resumes incomplete gameplay rather than restarting it', () => {
  const data = fixture(), dispatch = vi.fn(), go = vi.fn();
  function Probe() { const openScene = useOpenScene(); return createElement('button', { onClick: () => openScene(entry, { feedbackSession: true }) }, 'open'); }
  const ui = renderUI(createElement(Context.Provider, { value: { state: data.state, dispatch, go } as unknown as AppContext }, createElement(Probe)));
  clickOn(ui.host.querySelector('button')!);
  expect(dispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'scene.progress', progress: 0 }));
  expect(go).toHaveBeenCalledWith(expect.objectContaining({ page: 'scene', feedbackSession: true })); ui.unmount();
});
