// @vitest-environment jsdom
import { act, createElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createState, reduce, restore, type State } from '@wbr/core';
import { builtInScenes } from './scene-library';
import { BlessingApp } from './App';
import { clickOn, renderUI, settle } from './dom-test-utils';

type Given = { progress?: number; checkpoint?(n: number): void; saveWish?(line: string): void };
const scene = vi.hoisted(() => ({ context: undefined as Given | undefined }));
vi.mock('./daily-scene-preview', () => ({ DailyScenePreview: () => null }));
vi.mock('@wbr/scene-runtime', async original => ({
  ...await original<typeof import('@wbr/scene-runtime')>(),
  mountScene: (config: { context: Given; ready(): void }) => {
    scene.context = config.context;
    queueMicrotask(config.ready);
    return { initialized: Promise.resolve(), setActive() {}, setReducedMotion() {}, dispose() {} };
  },
}));
const ids: [string, string, string] = ['furin-wind-chime', 'shinto-torii', 'crane'];
const started = (): State => ({ ...createState(), opening: { status: 'active', sceneIds: ids, completed: 0 } });

beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); scene.context = undefined; });
async function open(raw: string | null = JSON.stringify(started())) {
  let saved = raw;
  const ui = renderUI(createElement(BlessingApp, { host: {
    read: async () => saved, write: async next => { saved = next; },
  } }));
  await settle();
  return { ...ui, raw: () => saved!, state: () => restore(saved),
    tap: async (selector: string) => { clickOn(ui.host.querySelector(selector)!); await settle(); },
    walk: async () => { for (const n of [1, 2, 3]) act(() => scene.context!.checkpoint!(n)); await settle(); },
  };
}

it('prepares a first-time opening instead of showing the empty home or navigation', async () => {
  const ui = await open(null);
  expect(ui.host.querySelector('.opening-page')).not.toBeNull();
  expect(ui.host.querySelectorAll('.opening-track li')).toHaveLength(3);
  expect(ui.host.querySelector('.bottom-nav')).toBeNull();
  expect(ui.state().opening?.status).toBe('active');
  ui.unmount();
});

it('teaches three real walks, permits an empty wish, then opens a home with three replays and a different daily scene', async () => {
  let ui = await open();
  for (let index = 0; index < 3; index++) {
    await ui.tap('.opening-start');
    expect(ui.host.querySelector('.opening-guide')?.getAttribute('data-step')).toBe(String(index + 1));
    expect(ui.host.querySelector('.scene-done-row')).toBeNull();
    await ui.walk();
    const collect = ui.host.querySelector('[data-opening-collect]')!;
    expect(collect.parentElement?.classList.contains('scene-completion-actions')).toBe(true);
    expect(collect.parentElement?.querySelector('.favorite-chip')).not.toBeNull();
    expect(ui.host.querySelectorAll('.favorite-chip')).toHaveLength(1);
    await ui.tap('[data-opening-collect]');
    expect(ui.state().collectibles).toHaveLength(index + 1);
  }
  expect(ui.state().wishes).toHaveLength(0);
  expect(ui.host.querySelector('.opening-summary')).not.toBeNull();
  await ui.tap('.opening-finish');
  expect(ui.host.querySelector('.today-page')).not.toBeNull();
  expect([...ui.host.querySelectorAll('.daily-collected-grid button[data-scene]')].map(el => el.getAttribute('data-scene')).sort()).toEqual([...ids].sort());
  expect(ids).not.toContain(ui.host.querySelector('.daily-set-primary')?.getAttribute('data-scene'));
  const raw = ui.raw();
  ui.unmount();
  ui = await open(raw);
  expect(ui.host.querySelector('.opening-page')).toBeNull();
  expect(ui.host.querySelector('.bottom-nav')).not.toBeNull();
  ui.unmount();
});

it('resumes the same partial scene across back and reload, and collects only once on a double click', async () => {
  let ui = await open();
  await ui.tap('.opening-start');
  act(() => scene.context!.checkpoint!(1));
  await settle();
  const partial = ui.raw();
  ui.unmount();
  ui = await open(partial);
  await ui.tap('.opening-start');
  expect(scene.context!.progress).toBe(1);
  await ui.tap('.back-button');
  await ui.tap('.opening-start');
  expect(scene.context!.progress).toBe(1);
  await ui.walk();
  const finished = ui.raw();
  ui.unmount();
  ui = await open(finished);
  await ui.tap('.opening-start');
  expect(ui.host.querySelector('[data-opening-collect]')).not.toBeNull();
  const button = ui.host.querySelector('[data-opening-collect]')!;
  clickOn(button); clickOn(button);
  await settle();
  expect(ui.state().collectibles).toHaveLength(1);
  expect(ui.state().opening).toMatchObject({ completed: 1, sceneIds: ids });
  ui.unmount();
});

it('keeps a written wish without sending the player out of the opening', async () => {
  let state = started();
  for (const id of ids.slice(0, 2)) {
    state = reduce(state, { type: 'scene.visit', entry: builtInScenes.find(e => e.id === id)!, at: new Date().toISOString() });
    state = reduce(state, { type: 'scene.progress', id, progress: 3 });
    state = reduce(state, { type: 'opening.collect', sceneId: id, at: new Date().toISOString() });
  }
  const ui = await open(JSON.stringify(state));
  await ui.tap('.opening-start');
  act(() => scene.context!.saveWish!('愿自己每天从容一点'));
  await settle();
  expect(ui.state().wishes[0]?.title).toBe('愿自己每天从容一点');
  expect(ui.host.querySelector('.scene-wish-saved button')).toBeNull();
  await ui.walk();
  await ui.tap('[data-opening-collect]');
  expect(ui.host.querySelector('.opening-summary')).not.toBeNull();
  expect(ui.state().wishes).toHaveLength(1);
  ui.unmount();
});

it('leaves legacy saved players on Today', async () => {
  const ui = await open(JSON.stringify(createState()));
  expect(ui.host.querySelector('.today-page')).not.toBeNull();
  expect(ui.host.querySelector('.opening-page')).toBeNull();
  ui.unmount();
});
