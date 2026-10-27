// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { createState, sceneIntention, type State, type ReturnMethod } from '@wbr/core';
import { configureLocale, translate, translateScene, message } from '@wbr/i18n';
import { Context, type AppContext } from './context';
import { builtInScenes, CATALOG_SEARCH_COPY, SceneCatalog, SceneLibraryContext } from './scene-library';
import { FulfillWish, WishNote } from './wishes';
import { Woodfish } from './woodfish';
import { SceneExperience } from './scene-experience';
import { Ritual } from './ritual';
import { localizedTitle } from './localization';
import { clickOn, renderUI, settle, typeInto } from './dom-test-utils';

const engine = vi.hoisted(() => ({ mounts: 0 }));
vi.mock('@wbr/scene-runtime', async original => ({
  ...await original<typeof import('@wbr/scene-runtime')>(),
  mountScene: (config: { ready(): void }) => {
    engine.mounts++;
    queueMicrotask(() => config.ready());
    const lifecycle = { setActive() {}, setReducedMotion() {}, dispose() {} };
    return { ...lifecycle, initialized: Promise.resolve(), controller: { ...lifecycle, inspect() {}, stopFollowing() {} } };
  },
}));
afterEach(() => { configureLocale('zh-Hans', ['zh-CN']); document.body.replaceChildren(); });
const wish = { id: 'wish', title: '我的原文 👩🏽‍💻', intention: '', status: 'active' as const, archived: false, createdAt: '2026-10-01T08:00:00.000Z', notes: [] };
function provider(node: ReactNode, state = createState(), dispatch = vi.fn(() => true), extra: Partial<AppContext> = {}) {
  return createElement(Context.Provider, { value: { state, dispatch, go() {}, active: true, fulfillmentDrafts: {}, setFulfillmentDraft() {}, ...extra } as unknown as AppContext },
    createElement(SceneLibraryContext.Provider, { value: { entries: builtInScenes, ready: true, library: { status: async () => 'bundled' } } as never }, node));
}
it('searches the displayed title, source title and stable ID with accent and case equivalence', async () => {
  configureLocale('fr', []);
  const ui = renderUI(provider(createElement(SceneCatalog)));
  await settle();
  const input = ui.host.querySelector<HTMLInputElement>('input[type=search]')!;
  expect(input.placeholder).toBe(translate(CATALOG_SEARCH_COPY.placeholder));
  const entry = builtInScenes.find(e => e.id === 'woodfish')!;
  const title = localizedTitle(entry);
  for (const query of [title.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase(), entry.title, 'WOODFISH']) {
    typeInto(input, query); await settle();
    expect(ui.host.querySelectorAll('.scene-card')).toHaveLength(1);
    expect(ui.host.querySelector('.scene-card')?.getAttribute('data-scene')).toBe(entry.id);
  }
  ui.unmount();
});
it('counts visible graphemes and preserves note composition until it commits', async () => {
  const state = { ...createState(), wishes: [wish] };
  const dispatch = vi.fn(() => true);
  const ui = renderUI(provider(createElement(WishNote, { id: wish.id }), state, dispatch));
  const input = ui.host.querySelector('textarea')!;
  expect(input.maxLength).toBe(8192);
  typeInto(input, '👩🏽‍💻'.repeat(500));
  expect(input.value).toBe('👩🏽‍💻'.repeat(500));
  expect(ui.host.querySelector('.field-heading span')?.textContent).toBe(message('app.input.counter', { n: 500, max: 500 }));
  act(() => input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
  typeInto(input, '👩🏽‍💻'.repeat(501));
  expect(input.value).toBe('👩🏽‍💻'.repeat(501));
  act(() => ui.host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(dispatch).not.toHaveBeenCalled();
  act(() => input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
  expect(input.value).toBe('👩🏽‍💻'.repeat(500));
  clickOn(ui.host.querySelector('button[type=submit]')!);
  expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ text: '👩🏽‍💻'.repeat(500) }));
  ui.unmount();
});
it('uses the same broad encoding cap for the fulfillment note', () => {
  const state = { ...createState(), wishes: [{ ...wish, status: 'realized' }] } as State;
  const ui = renderUI(provider(createElement(FulfillWish, { id: wish.id }), state));
  expect(ui.host.querySelector('textarea')!.maxLength).toBe(8192);
  ui.unmount();
});
it('preserves the fulfillment draft through language changes and commits complete emoji clusters after composition', () => {
  const state = { ...createState(), wishes: [{ ...wish, status: 'realized' }] } as State;
  const dispatch = vi.fn(() => false);
  function Draft() {
    const [draft, setDraft] = useState({ method: 'kindness' as ReturnMethod, text: '' });
    return provider(createElement(FulfillWish, { id: wish.id }), state, dispatch, {
      fulfillmentDrafts: { [wish.id]: draft },
      setFulfillmentDraft: (_id, next) => { if (next) setDraft(next); },
    });
  }
  const ui = renderUI(createElement(Draft));
  const input = ui.host.querySelector('textarea')!;
  typeInto(input, 'e\u0301'.repeat(60));
  configureLocale('fr', []); ui.rerender(createElement(Draft));
  expect(ui.host.querySelector('textarea')).toBe(input);
  expect(input.value).toBe('e\u0301'.repeat(60));
  expect(ui.host.querySelector('.field-heading span')?.textContent).toBe(message('app.input.counter', { n: 60, max: 60 }));
  act(() => input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
  typeInto(input, '👩🏽‍💻'.repeat(61));
  act(() => ui.host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(dispatch).not.toHaveBeenCalled();
  expect(input.value).toBe('👩🏽‍💻'.repeat(61));
  act(() => input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
  expect(input.value).toBe('👩🏽‍💻'.repeat(60));
  clickOn(ui.host.querySelector('button[type=submit]')!);
  expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ text: '👩🏽‍💻'.repeat(60) }));
  ui.unmount();
});
it('reformats a source instruction after locale changes without remounting the woodfish', async () => {
  engine.mounts = 0;
  const instruction = '轻点木鱼敲一下；按住拖动，木槌会跟着移动。';
  const node = () => provider(createElement(Woodfish, { active: true, reducedMotion: false, view: 'front', disabled: false, onStrike: () => true, onImpact() {}, onInstruction() {}, contentClient: {} as never, instruction }));
  const ui = renderUI(node()); await settle();
  configureLocale('fr', []); ui.rerender(node());
  expect(ui.host.querySelector('#woodfish-instruction')?.textContent).toBe(translateScene(instruction));
  expect(engine.mounts).toBe(1);
  ui.unmount();
});
it('resolves the legacy ritual source instruction and intention on every render', async () => {
  const ui = renderUI(provider(createElement(Ritual, { id: 'woodfish' })));
  await settle();
  const initialHint = ui.host.querySelector('#woodfish-instruction')!.textContent;
  act(() => configureLocale('ja', [])); ui.rerender(provider(createElement(Ritual, { id: 'woodfish' })));
  await settle();
  expect(ui.host.querySelector('#woodfish-instruction')!.textContent).not.toBe(initialHint);
  expect(ui.host.querySelector('.scene-intention strong')!.textContent).toBe(translateScene(sceneIntention('woodfish')!.label));
  ui.unmount();
});
it('retains unknown remote instructions verbatim and marks their unspecified language', async () => {
  configureLocale('fr', []);
  const instruction = 'Future remote wording Ω';
  const ui = renderUI(provider(createElement(Woodfish, { active: true, reducedMotion: false, view: 'front', disabled: false, onStrike: () => true, onImpact() {}, onInstruction() {}, contentClient: {} as never, instruction })));
  await settle();
  const hint = ui.host.querySelector('#woodfish-instruction')!;
  expect(hint.textContent).toBe(instruction);
  expect(hint.getAttribute('lang')).toBe('und');
  ui.unmount();
});
it.each(['en', 'ja', 'fr'] as const)('keeps the upgrade recovery classification in %s', async locale => {
  configureLocale(locale, []);
  const entry = { ...builtInScenes[0], engine: 'future@99' };
  const ui = renderUI(provider(createElement(SceneExperience, { entry })));
  await settle();
  expect(ui.host.querySelector('.scene-load-error')?.textContent).toContain(translate('此场景需要更新 App 后打开'));
  expect(ui.host.querySelector('.scene-load-error details')).toBeNull();
  ui.unmount();
});
