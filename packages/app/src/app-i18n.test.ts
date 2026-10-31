// @vitest-environment jsdom
import { act, createElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createState } from '@wbr/core';
import { configureLocale, getLocale, translate } from '@wbr/i18n';
import { BlessingApp } from './App';
import { renderUI, settle, clickOn } from './dom-test-utils';
import { localizedNote, localizedTitle } from './localization';
import { sceneWish } from './scene-wish';

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.setAttribute('open', ''); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value: function (this: HTMLDialogElement) { this.removeAttribute('open'); this.dispatchEvent(new Event('close')); } });
});
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); configureLocale('zh-Hans', ['zh-CN']); });
it('switches and persists language without replacing the store, route or user text', async () => {
  const state = createState();
  state.wishes.push({ id: 'wish', title: '我的心愿', intention: '', status: 'active', archived: false, createdAt: '2026-10-01T08:00:00.000Z', notes: [] });
  let saved = JSON.stringify(state);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const host = { read: vi.fn(async () => saved), write: vi.fn(async (raw: string) => { saved = raw; }) };
  const ui = renderUI(createElement(BlessingApp, { host, systemLocales: ['zh-CN'], initialRoute: { page: 'me' } }));
  await settle();
  const trigger = ui.host.querySelector<HTMLButtonElement>('.language-setting-trigger')!;
  expect(trigger).not.toBeNull();
  clickOn(trigger);
  expect(ui.host.querySelector('dialog[open]')).not.toBeNull();
  clickOn(ui.host.querySelector('input[value="fr"]')!);
  await settle();
  expect(ui.host.querySelector('dialog[open]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(trigger.textContent).toContain('Français');
  expect(document.documentElement.lang).toBe('fr');
  expect(document.title).toBe(translate('一日一念'));
  expect(ui.host.querySelector('[data-tab="today"] span')?.textContent).toBe('Jour');
  expect(ui.host.querySelector('[data-tab="today"]')?.getAttribute('aria-label')).toBe('Aujourd’hui');
  expect(ui.host.querySelector('.app-shell')?.getAttribute('data-page')).toBe('me');
  expect(JSON.parse(saved).settings.locale).toBe('fr');
  expect(host.read).toHaveBeenCalledTimes(1);
  clickOn(ui.host.querySelector('[data-tab="wishes"]')!); await settle();
  expect(ui.host.querySelector('.wish-card strong')?.textContent).toBe('我的心愿');
  expect(JSON.parse(saved).wishes[0].title).toBe('我的心愿');
  ui.unmount();
});
it('dismisses the language modal without changing the saved preference or leaving Me', async () => {
  const state = createState(); state.settings.locale = 'ja';
  let saved = JSON.stringify(state);
  const host = { read: async () => saved, write: async (raw: string) => { saved = raw; } };
  const props = { host, systemLocales: ['fr'], initialRoute: { page: 'me' as const } };
  const ui = renderUI(createElement(BlessingApp, props));
  await settle();
  const trigger = ui.host.querySelector<HTMLButtonElement>('.language-setting-trigger')!;
  clickOn(trigger);
  expect(ui.host.querySelector<HTMLInputElement>('input[value="ja"]')?.checked).toBe(true);
  act(() => { ui.host.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true })); });
  expect(ui.host.querySelector('dialog[open]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  clickOn(trigger);
  ui.rerender(createElement(BlessingApp, { ...props, backRequest: 1 }));
  expect(ui.host.querySelector('dialog[open]')).toBeNull();
  expect(ui.host.querySelector('.app-shell')?.getAttribute('data-page')).toBe('me');
  expect(JSON.parse(saved).settings.locale).toBe('ja');
  clickOn(trigger);
  clickOn(ui.host.querySelector('input[value="system"]')!);
  await settle();
  expect(getLocale()).toBe('fr');
  expect(JSON.parse(saved).settings.locale).toBe('system');
  ui.unmount();
});
it('ignores a previous host read after replacement or unmount', async () => {
  let resolveOld!: (raw: string) => void;
  const oldHost = { read: () => new Promise<string>(resolve => { resolveOld = resolve; }), write: async () => {} };
  const fresh = createState(); fresh.settings.locale = 'fr';
  const nextHost = { read: async () => JSON.stringify(fresh), write: async () => {} };
  const ui = renderUI(createElement(BlessingApp, { host: oldHost, systemLocales: ['en'] }));
  ui.rerender(createElement(BlessingApp, { host: nextHost, systemLocales: ['en'] }));
  await settle(); expect(getLocale()).toBe('fr');
  const old = createState(); old.settings.locale = 'ja';
  await act(async () => { resolveOld(JSON.stringify(old)); });
  expect(getLocale()).toBe('fr');
  ui.unmount();
  const late = renderUI(createElement(BlessingApp, { host: oldHost, systemLocales: ['en'] }));
  late.unmount(); configureLocale('ko', []);
  await act(async () => { resolveOld(JSON.stringify(old)); });
  expect(getLocale()).toBe('ko');
});
it('uses the host bootstrap preference before the asynchronous store read', () => {
  const host = { initialLocalePreference: 'ja' as const, read: () => new Promise<null>(() => {}), write: async () => {} };
  const ui = renderUI(createElement(BlessingApp, { host, systemLocales: ['fr'] }));
  expect(document.documentElement.lang).toBe('ja');
  expect(ui.host.textContent).toContain(translate('正在展开你的小天地…'));
  ui.unmount();
});
it('redraws existing note times when only the native clock preference changes', async () => {
  const state = createState(); state.settings.locale = 'en';
  const at = new Date(2026, 9, 27, 17, 8).toISOString();
  state.wishes.push({ id: 'clock', title: 'Clock', intention: '', status: 'active', archived: false, createdAt: at,
    notes: [{ id: 'note-clock', text: 'My note', at }] });
  const host = { initialLocalePreference: 'en' as const, read: async () => JSON.stringify(state), write: async () => {} };
  const props = { host, systemLocales: ['en'], initialRoute: { page: 'wish' as const, id: 'clock' } };
  const ui = renderUI(createElement(BlessingApp, { ...props, systemHour12: false }));
  await settle(); expect(ui.host.querySelector('.note-preview time')?.textContent).toContain('17:08');
  ui.rerender(createElement(BlessingApp, { ...props, systemHour12: true }));
  await settle(); expect(ui.host.querySelector('.note-preview time')?.textContent).toContain('05:08');
  ui.unmount();
});
it('does not translate user-authored notes or unknown historical names matching a product label', () => {
  configureLocale('fr', []);
  expect(localizedNote({ id: 'user-note', text: '写好了', at: '2026-10-01T08:00:00.000Z' }, createState())).toBe('写好了');
  expect(localizedTitle({ id: 'unknown-remote', title: '我的' })).toBe('我的');
});
it('keeps all emoji and combining clusters intact in a scene wish', () => {
  const line = '👩🏽‍💻'.repeat(60) + 'e\u0301';
  const result = sceneWish(line, 'crane', 'w', '2026-10-01T08:00:00.000Z')!;
  expect(result.title).toBe('👩🏽‍💻'.repeat(60));
  expect(result.intention).toBe(line);
});
