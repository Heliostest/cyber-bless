// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { localDay, createState, reduce } from '@wbr/core';
import { builtInScenes, dailyPrimaryScene } from '@wbr/core/daily-scenes';
import { BlessingApp } from './App';
import { clickOn, renderUI, settle, typeInto } from './dom-test-utils';

vi.mock('./scene-experience', () => ({ SceneExperience: ({ entry, daily }: { entry: { id: string }; daily?: string }) => createElement('div', { 'data-test-scene': entry.id, 'data-test-day': daily }) }));
afterEach(() => vi.restoreAllMocks());
it('does not interrupt the first-play opening with a widget request', async () => {
  const ack = vi.fn(async () => {});
  const ui = renderUI(createElement(BlessingApp, { host: { read: async () => null, write: async () => {} },
    navigationRequest: { requestId: 9 }, onNavigationConsumed: ack }));
  await settle();
  expect(ui.host.querySelector('.opening-page')).not.toBeNull();
  expect(ui.host.querySelector('[data-test-scene]')).toBeNull();
  expect(ack).not.toHaveBeenCalled();
  ui.unmount();
});
it('waits for a valid loaded save, opens today through the scene route, and acknowledges after render', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  let release!: (raw: string) => void;
  const read = vi.fn(() => new Promise<string>(resolve => { release = resolve; }));
  const ack = vi.fn(async () => {});
  const props = { host: { read, write: async () => {} }, navigationRequest: { requestId: 1 }, onNavigationConsumed: ack };
  const ui = renderUI(createElement(BlessingApp, props));
  await settle();
  expect(ack).not.toHaveBeenCalled();
  release(JSON.stringify(createState()));
  await settle();
  expect(ui.host.querySelector('[data-test-scene]')?.getAttribute('data-test-scene')).toBe(dailyPrimaryScene(builtInScenes, localDay())!.id);
  expect(ui.host.querySelector('[data-test-day]')?.getAttribute('data-test-day')).toBe(localDay());
  expect(ack).toHaveBeenCalledWith(1);
  clickOn(ui.host.querySelector('.back-button')!);
  await settle();
  ui.rerender(createElement(BlessingApp, { ...props, active: false }));
  await settle();
  expect(read).toHaveBeenCalledOnce();
  expect(ack).toHaveBeenCalledOnce();
  expect(ui.host.querySelector('[data-test-scene]')).toBeNull();
  ui.unmount();
});
it('keeps warm-start form text and defers navigation until the user leaves it', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const state = reduce(createState(), {
    type: 'wish.create', id: 'w1', title: '面试顺利', intention: '',
    returnMethod: 'kindness', at: '2026-10-05T08:00:00.000Z',
  });
  const host = { read: async () => JSON.stringify(state), write: async () => {} };
  const ack = vi.fn(async () => {});
  const ui = renderUI(createElement(BlessingApp, { host }));
  await settle();
  clickOn(ui.host.querySelector('[data-tab="wishes"]')!);
  clickOn(ui.host.querySelector('.wish-card[data-wish-id="w1"]')!);
  await settle();
  clickOn([...ui.host.querySelectorAll('.wish-detail-page button')].find(button => button.textContent?.includes('记一笔'))!);
  await settle();
  typeInto(ui.host.querySelector('#wish-note')!, '未提交的努力记录');
  ui.rerender(createElement(BlessingApp, { host, navigationRequest: { requestId: 2 }, onNavigationConsumed: ack }));
  await settle();
  expect((ui.host.querySelector('#wish-note') as HTMLTextAreaElement).value).toBe('未提交的努力记录');
  expect(ack).not.toHaveBeenCalled();
  expect(ui.host.querySelector('.widget-entry-notice')).not.toBeNull();
  clickOn(ui.host.querySelector('.back-button')!);
  await settle();
  expect(ui.host.querySelector('[data-test-scene]')).not.toBeNull();
  expect(ack).toHaveBeenCalledWith(2);
  ui.unmount();
});
it('falls back to Today for a stale link and never grants a reward', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const write = vi.fn(async () => {}), ack = vi.fn(async () => {});
  const ui = renderUI(createElement(BlessingApp, { host: { read: async () => JSON.stringify(createState()), write }, navigationRequest: { requestId: 3, day: '2020-01-01', sceneId: 'crane' }, onNavigationConsumed: ack }));
  await settle();
  expect(ui.host.querySelector('.today-page')).not.toBeNull();
  expect(ack).toHaveBeenCalledWith(3);
  expect(write).not.toHaveBeenCalled();
  ui.unmount();
});
it('does not consume a link when load failed, and continues after successful retry', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const read = vi.fn().mockRejectedValueOnce(Error('disk')).mockResolvedValue(JSON.stringify(createState())), ack = vi.fn(async () => {});
  const ui = renderUI(createElement(BlessingApp, { host: { read, write: async () => {} }, navigationRequest: { requestId: 4 }, onNavigationConsumed: ack }));
  await settle();
  expect(ack).not.toHaveBeenCalled();
  clickOn(ui.host.querySelector('.loading-screen button')!);
  await settle();
  expect(ack).toHaveBeenCalledWith(4);
  ui.unmount();
});
it('acknowledges a rendered scene even while its completed progress reset is still saving', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const entry = dailyPrimaryScene(builtInScenes, localDay())!;
  let state = reduce(createState(), { type: 'scene.visit', entry, at: new Date().toISOString() });
  // Today's unfinished walk resumes; a completed walk restarts and saves its reset.
  state = reduce(state, { type: 'scene.progress', id: entry.id, progress: entry.engine === 'woodfish@1' ? 12 : 3 });
  let release!: () => void;
  const ack = vi.fn(async () => {});
  const ui = renderUI(createElement(BlessingApp, { host: { read: async () => JSON.stringify(state), write: () => new Promise<void>(r => { release = r; }) }, navigationRequest: { requestId: 5 }, onNavigationConsumed: ack }));
  await settle();
  expect(ui.host.querySelector('[data-test-scene]')).not.toBeNull();
  expect(ui.host.querySelector('.save-status')?.textContent).toBe('正在保存…');
  expect(ack).toHaveBeenCalledWith(5);
  clickOn(ui.host.querySelector('.back-button')!);
  release();
  await settle();
  expect(ack).toHaveBeenCalledOnce();
  ui.unmount();
});
