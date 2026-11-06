// @vitest-environment jsdom
import { act, createElement, useRef } from 'react';
import { expect, it, vi } from 'vitest';
import { renderUI, settle } from './dom-test-utils';
import { GrassDebugControls } from '../../../apps/cyber-bless/src/GrassDebugControls';
import { debugGrass } from '@wbr/scene-runtime/debug-grass';

it('switches real registered grass, keeps collapsed previews and restores on unmount', async () => {
  function Fixture({ hidden = false }) {
    const anchor = useRef<HTMLElement>(null);
    return <div className="app-shell"><aside ref={anchor}><GrassDebugControls anchor={anchor} hidden={hidden}/></aside></div>;
  }
  const ui = renderUI(createElement(Fixture)), apply = vi.fn();
  let entry: ReturnType<typeof debugGrass.register> | undefined;
  try {
    await act(async () => { entry = debugGrass.register('woodfish','木鱼',apply,ui.host.querySelector('.app-shell')!); });
    await settle();
    const select = ui.host.querySelector('select')!;
    expect([...select.options].map(option=>option.value)).toEqual(['original','komorebi']);
    await act(async () => { select.value = 'komorebi'; select.dispatchEvent(new Event('change',{bubbles:true})); });
    expect(apply).toHaveBeenLastCalledWith('komorebi');
    ui.rerender(createElement(Fixture,{hidden:true}));
    expect(apply).toHaveBeenLastCalledWith('komorebi');
    expect(ui.host.querySelector('section')!.hidden).toBe(true);
  } finally { ui.unmount(); entry?.dispose(); }
  expect(apply).toHaveBeenLastCalledWith('komorebi');
});
