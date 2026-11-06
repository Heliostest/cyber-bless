// @vitest-environment jsdom
import { act, createElement, useRef } from 'react';
import { expect, it, vi } from 'vitest';
import { renderUI, clickOn, settle } from './dom-test-utils';
import { TreeDebugControls } from '../../../apps/cyber-bless/src/TreeDebugControls';
import { debugTrees } from '@wbr/scene-runtime/debug-trees';

it('offers both real tree sources, keeps collapsed previews and restores on console exit', async () => {
  function Fixture({ hidden = false }) {
    const anchor = useRef<HTMLElement>(null);
    return <div className="app-shell"><aside ref={anchor}><TreeDebugControls anchor={anchor} hidden={hidden}/></aside></div>;
  }
  const ui = renderUI(createElement(Fixture)), scope = ui.host.querySelector('.app-shell')!, apply = vi.fn();
  let entry!: ReturnType<typeof debugTrees.register>;
  try {
    await act(async () => { entry = debugTrees.register('tea', '茶', apply, scope, 'cherry'); entry.report({ count: 12, actual: 'original', status: 'ready' }); });
    await settle();
    const select = ui.host.querySelector('select')!;
    expect([...select.options].map(option => option.value)).toEqual(['original', 'scene', 'quaternius', 'simple-tree', 'komorebi', 'cherry', 'cypress', 'willow', 'conifer', 'toona', 'acer', 'maple']);
    expect(select.options[1].textContent).toContain('樱花');
    for (const [id, label] of [['toona', '椿树'], ['acer', '槭树'], ['maple', '枫树']]) {
      expect([...select.options].find(option => option.value === id)?.textContent).toContain(label);
    }
    await act(async () => { select.value = 'scene'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(apply).toHaveBeenLastCalledWith('scene');
    expect(ui.host.querySelector('[data-tree-attribution]')).toBeNull();
    await act(async () => entry.report({ count: 12, actual: 'cherry', status: 'ready' }));
    await act(async () => { select.value = 'cypress'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    await act(async () => entry.report({ count: 12, actual: 'cherry', status: 'loading' }));
    expect(ui.host.querySelector('[data-tree-attribution]')).toBeNull();
    await act(async () => entry.report({ count: 12, actual: 'cypress', status: 'ready' }));
    expect(ui.host.querySelector('[data-tree-attribution]')).toBeNull();
    for (const method of ['cherry', 'cypress', 'willow', 'conifer', 'toona', 'acer', 'maple']) {
      await act(async () => { select.value = method; select.dispatchEvent(new Event('change', { bubbles: true })); });
      expect(apply).toHaveBeenLastCalledWith(method);
    }
    for (const method of ['komorebi', 'quaternius', 'simple-tree']) {
      await act(async () => { select.value = method; select.dispatchEvent(new Event('change', { bubbles: true })); });
      expect(apply).toHaveBeenLastCalledWith(method);
    }
    await act(async () => entry.report({ count: 12, actual: 'original', status: 'loading' }));
    expect(ui.host.querySelector('[role="status"]')!.textContent).toContain('加载');
    ui.rerender(createElement(Fixture, { hidden: true }));
    expect(apply).toHaveBeenLastCalledWith('simple-tree'); expect(ui.host.querySelector('section')!.hidden).toBe(true);
    ui.rerender(createElement(Fixture)); clickOn(ui.host.querySelector('[data-tree-reset]')!);
    expect(apply).toHaveBeenLastCalledWith('scene');
    await act(async () => { select.value = 'quaternius'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  } finally { ui.unmount(); entry?.dispose(); }
  expect(apply).toHaveBeenLastCalledWith('scene');
});
