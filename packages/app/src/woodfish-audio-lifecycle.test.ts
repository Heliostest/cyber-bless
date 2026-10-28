// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { createState } from '@wbr/core';
import { Context, type AppContext } from './context';
import { Woodfish } from './woodfish';
import { renderUI, settle } from './dom-test-utils';

const boundary = vi.hoisted(() => ({ impact: undefined as ((sound?: AudioBuffer) => void) | undefined }));
vi.mock('@wbr/scene-runtime', async importOriginal => ({
  ...await importOriginal<typeof import('@wbr/scene-runtime')>(),
  mountScene(config: { context: { impact(sound?: AudioBuffer): void }; ready(): void }) {
    boundary.impact = config.context.impact;
    queueMicrotask(config.ready);
    const controller = { strike() {}, stopFollowing() {}, inspect() {}, whenIdle: async () => {} };
    return { controller, setActive() {}, setReducedMotion() {}, dispose() {} };
  },
}));
afterEach(() => { boundary.impact = undefined; });

it('cuts the owned sound on local pause and rejects a late impact until resumed', async () => {
  const stopInteractionSound = vi.fn(), onImpact = vi.fn();
  const value = { state: createState(), decodeSound: vi.fn(), stopInteractionSound } as unknown as AppContext;
  const node = (active: boolean) => createElement(Context.Provider, { value }, createElement(Woodfish, {
    active, reducedMotion: false, view: 'front', disabled: false, onStrike: () => true,
    onImpact, onInstruction() {}, contentClient: {} as never,
  }));
  const ui = renderUI(node(true)); await settle();
  boundary.impact!(); expect(onImpact).toHaveBeenCalledOnce();
  ui.rerender(node(false));
  expect(stopInteractionSound).toHaveBeenCalledOnce();
  boundary.impact!(); expect(onImpact).toHaveBeenCalledOnce();
  ui.rerender(node(true)); boundary.impact!(); expect(onImpact).toHaveBeenCalledTimes(2);
  ui.unmount(); expect(stopInteractionSound).toHaveBeenCalledTimes(2);
});
