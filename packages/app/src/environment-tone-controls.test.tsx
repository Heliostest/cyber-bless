// @vitest-environment jsdom
import { act, createElement, useRef } from 'react';
import { expect, it, vi } from 'vitest';
import { renderUI, settle } from './dom-test-utils';
import { EnvironmentToneControls } from '../../../apps/cyber-bless/src/EnvironmentToneControls';
import { debugEnvironmentTone } from '@wbr/scene-runtime/debug-environment-tone';

it('previews the registered environment, retains collapsed choices and restores on console unmount', async () => {
  function Fixture({ hidden = false }) {
    const anchor = useRef<HTMLElement>(null);
    return <div className="app-shell"><aside ref={anchor}><EnvironmentToneControls anchor={anchor} hidden={hidden}/></aside></div>;
  }
  const ui = renderUI(createElement(Fixture)), apply = vi.fn();
  let entry!: ReturnType<typeof debugEnvironmentTone.register>;
  try {
    await act(async () => { entry = debugEnvironmentTone.register('woodfish', '木鱼', apply, ui.host.querySelector('.app-shell')!); });
    await settle();
    const select = ui.host.querySelector('select')!;
    expect([...select.options].map(option => option.value)).toEqual(['original', 'tiny-delivery', 'komorebi']);
    await act(async () => { select.value = 'komorebi'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(apply).toHaveBeenLastCalledWith('komorebi');
    await act(async () => { select.value = 'tiny-delivery'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(apply).toHaveBeenLastCalledWith('tiny-delivery');
    ui.rerender(createElement(Fixture, { hidden: true }));
    expect(ui.host.querySelector('section')!.hidden).toBe(true);
    expect(apply).toHaveBeenLastCalledWith('tiny-delivery');
    ui.rerender(createElement(Fixture));
    await act(async () => { select.value = 'original'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(apply).toHaveBeenLastCalledWith('original');
    await act(async () => { select.value = 'tiny-delivery'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  } finally { ui.unmount(); entry?.dispose(); }
  expect(apply).toHaveBeenLastCalledWith('komorebi');
});
