// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { Context, type AppContext } from './context';
import { createState } from '@wbr/core';
import { renderUI, clickOn, settle } from './dom-test-utils';
import AudioDebugConsole from '../../../apps/cyber-bless/src/AudioDebugConsole';

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(clean => clean()); vi.restoreAllMocks(); });

it('shows only available declared targets and auditions independently of their business handlers', async () => {
  const play = vi.fn(() => 'played' as const), stop = vi.fn(), prepare = vi.fn(), business = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { x: 30, y: 80, left: 30, top: 80, right: 150, bottom: 120, width: 120, height: 40, toJSON() {} };
  });
  const context = { state: createState(), audioInspector: { play, stop, prepare } } as unknown as AppContext;
  function Fixture() {
    const [selected, setSelected] = useState(false);
    return <div className="app-shell">
      <button data-audio-cue="navigate" onClick={business}>Open</button>
      <button data-audio-cue={selected ? 'toggleOff' : 'toggleOn'} onClick={() => setSelected(!selected)}>Toggle</button>
      <button data-audio-cue="saved" disabled>Disabled</button>
      <button>Silent</button>
      <AudioDebugConsole />
    </div>;
  }
  const ui = renderUI(createElement(Context.Provider, { value: context }, createElement(Fixture)));
  cleanups.push(ui.unmount);
  expect(document.querySelector('[data-audio-preview]')).toBeNull();
  clickOn(ui.host.querySelector('[data-audio-console-toggle]')!);
  clickOn(ui.host.querySelector('[data-audio-filter]')!);
  await settle();
  expect(document.querySelectorAll('[data-audio-preview]')).toHaveLength(2);
  clickOn(document.querySelector('[data-audio-preview="navigate"]')!);
  expect(play).toHaveBeenLastCalledWith('navigate');
  expect(business).not.toHaveBeenCalled();
  clickOn(ui.host.querySelector('[data-audio-cue="toggleOn"]')!);
  await settle();
  expect(document.querySelector('[data-audio-preview="toggleOff"]')).not.toBeNull();
  expect(document.querySelector('[data-audio-preview="toggleOn"]')).toBeNull();
  clickOn(ui.host.querySelector('[data-audio-console-toggle]')!);
  expect(document.querySelectorAll('[data-audio-preview]')).toHaveLength(2);
  clickOn(ui.host.querySelector('[data-audio-console-toggle]')!);
  clickOn(ui.host.querySelector('[data-audio-filter]')!); await settle();
  expect(document.querySelector('[data-audio-preview]')).toBeNull();
  expect(stop).toHaveBeenCalled();
  expect(ui.host.querySelector('[data-audio-marked]')).toBeNull();
});

it('keeps preview controls outside buttons and labels, inside the owning dialog, and removes stale targets', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 30, top: 80, right: 150, bottom: 120, width: 120, height: 40 } as DOMRect);
  const play = vi.fn(() => 'played' as const);
  const context = { state: createState(), audioInspector: { play, stop() {}, prepare() {} } } as unknown as AppContext;
  const ui = renderUI(createElement(Context.Provider, { value: context }, createElement('div', { className: 'app-shell' },
    createElement('dialog', { open: true }, createElement('label', { 'data-audio-cue': 'select' }, createElement('input', { type: 'radio' }), 'Choice')),
    createElement(AudioDebugConsole))));
  cleanups.push(ui.unmount);
  clickOn(ui.host.querySelector('[data-audio-console-toggle]')!);
  clickOn(ui.host.querySelector('[data-audio-filter]')!); await settle();
  const marker = document.querySelector('[data-audio-preview]')!;
  expect(marker.closest('dialog')).not.toBeNull();
  expect(marker.closest('label')).toBeNull();
  expect(ui.host.querySelector('button button')).toBeNull();
  clickOn(marker);
  expect((ui.host.querySelector('input') as HTMLInputElement).checked).toBe(false);
  act(() => ui.host.querySelector('label')!.setAttribute('hidden', ''));
  await settle();
  expect(document.querySelector('[data-audio-preview]')).toBeNull();
});

it('discovers controls when a route entrance animation finishes without any DOM mutation', async () => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 30, top: 80, right: 150, bottom: 120, width: 120, height: 40 } as DOMRect);
  const nativeStyle = window.getComputedStyle;
  let entering = true;
  vi.spyOn(window, 'getComputedStyle').mockImplementation(element => {
    const style = nativeStyle(element);
    return element.classList.contains('app-content') ? new Proxy(style, {
      get(target, key) { return key === 'opacity' ? entering ? '0' : '1' : Reflect.get(target, key, target); },
    }) : style;
  });
  const context = { state: createState(), audioInspector: { play() { return 'played'; }, stop() {}, prepare() {} } } as unknown as AppContext;
  const ui = renderUI(createElement(Context.Provider, { value: context }, createElement('div', { className: 'app-shell' },
    createElement('main', { className: 'app-content' }, createElement('button', { 'data-audio-cue': 'navigate' }, 'Open')),
    createElement(AudioDebugConsole))));
  cleanups.push(ui.unmount);
  clickOn(ui.host.querySelector('[data-audio-console-toggle]')!);
  clickOn(ui.host.querySelector('[data-audio-filter]')!); await settle();
  expect(document.querySelector('[data-audio-preview]')).toBeNull();
  entering = false;
  act(() => ui.host.querySelector('main')!.dispatchEvent(new Event('animationend', { bubbles: true })));
  await settle();
  expect(document.querySelector('[data-audio-preview="navigate"]')).not.toBeNull();
});
