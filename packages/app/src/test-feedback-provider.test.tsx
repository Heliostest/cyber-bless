// @vitest-environment jsdom
import { createElement, StrictMode, useEffect } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import type { TestFeedbackHost } from '@wbr/runtime';
import { TestFeedbackProvider, useTestFeedback } from './test-feedback-provider';
import { renderUI, settle } from './dom-test-utils';

afterEach(() => document.body.replaceChildren());
function adapter(): TestFeedbackHost { return { read: vi.fn(async () => null), write: vi.fn(async () => {}), send: vi.fn(async () => '{}') }; }
function Probe({ mounted }: { mounted?: () => void }) {
  const feedback = useTestFeedback();
  useEffect(() => { mounted?.(); }, []);
  return <output>{feedback?.snapshot.status ?? 'disabled'}</output>;
}
it('does no diagnostic IO in production and enabling tools preserves the actual App subtree', async () => {
  const host = adapter(), mounted = vi.fn();
  const tree = (enabled: boolean) => <TestFeedbackProvider host={host} enabled={enabled} active><Probe mounted={mounted}/></TestFeedbackProvider>;
  const ui = renderUI(tree(false)); await settle();
  expect(host.read).not.toHaveBeenCalled(); expect(host.send).not.toHaveBeenCalled();
  expect(ui.host.textContent).toBe('disabled');
  ui.rerender(tree(true)); await settle();
  expect(mounted).toHaveBeenCalledTimes(1);
  expect(host.read).toHaveBeenCalledTimes(1);
  expect(ui.host.textContent).toBe('ready');
  ui.rerender(tree(false)); await settle();
  expect(ui.host.textContent).toBe('disabled');
  expect(mounted).toHaveBeenCalledTimes(1); ui.unmount();
});
it('still loads after React StrictMode replays effects', async () => {
  const host = adapter();
  const ui = renderUI(createElement(StrictMode, {}, <TestFeedbackProvider host={host} enabled active><Probe/></TestFeedbackProvider>));
  await settle();
  expect(ui.host.textContent).toBe('ready');
  expect(host.read).toHaveBeenCalledTimes(1); ui.unmount();
});
