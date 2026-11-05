// @vitest-environment jsdom
import { act, createElement, useRef } from 'react';
import { expect, it, vi } from 'vitest';
import { renderUI, clickOn, settle } from './dom-test-utils';
import { WaterDebugControls } from '../../../apps/cyber-bless/src/WaterDebugControls';
import { debugWater } from '@wbr/scene-runtime/debug-water';

it('switches real registered water, preserves the choice while collapsed and restores it on unmount', async () => {
  function Fixture({ hidden = false }) {
    const anchor = useRef<HTMLElement>(null);
    return <div className="app-shell"><aside ref={anchor}><WaterDebugControls anchor={anchor} hidden={hidden}/></aside></div>;
  }
  const ui = renderUI(createElement(Fixture));
  const scope = ui.host.querySelector('.app-shell')!, apply = vi.fn();
  let entry!: ReturnType<typeof debugWater.register>;
  try {
    await act(async () => { entry = debugWater.register('pool', '泉池', apply, scope); entry.report(2); });
    await settle();
    const select = ui.host.querySelector('select')!;
    expect(select.value).toBe('original');
    await act(async () => { select.value = 'toon-water'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(apply).toHaveBeenLastCalledWith('toon-water');
    ui.rerender(createElement(Fixture, { hidden: true }));
    expect(apply).toHaveBeenLastCalledWith('toon-water');
    expect(ui.host.querySelector('section')!.hidden).toBe(true);
    ui.rerender(createElement(Fixture));
    clickOn(ui.host.querySelector('[data-water-reset]')!);
    expect(apply).toHaveBeenLastCalledWith('original');
    await act(async () => { select.value = 'toon-water'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(apply).toHaveBeenLastCalledWith('toon-water');
  } finally { ui.unmount(); entry?.dispose(); }
  expect(apply).toHaveBeenLastCalledWith('original');
});
