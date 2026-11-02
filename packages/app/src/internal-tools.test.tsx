// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createState } from '@wbr/core';
import { BlessingApp } from './App';
import { INTERNAL_TOOLS_ENABLED } from './internal-tools-config';
import { useApp } from './context';
import { clickOn, renderUI, settle } from './dom-test-utils';

vi.mock('./home', async importOriginal => ({
  ...await importOriginal<typeof import('./home')>(),
  Today: () => {
    const { go } = useApp();
    return <div data-test-today><button onClick={() => go({ page: 'scenes' })}>catalog route</button><button onClick={() => go({ page: 'cache' })}>cache route</button></div>;
  },
}));
vi.mock('./scene-library', async importOriginal => ({
  ...await importOriginal<typeof import('./scene-library')>(),
  SceneCatalog: () => <div data-test-catalog />,
  CacheManager: () => <div data-test-cache />,
}));

const host = { read: async () => JSON.stringify(createState()), write: async () => {} };
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

it('uses the shared build setting for default catalog visibility', async () => {
  const ui = renderUI(createElement(BlessingApp, { host, initialRoute: { page: 'me' } }));
  await settle();
  expect(ui.host.querySelector('.settings-card')?.textContent?.includes('场景目录')).toBe(INTERNAL_TOOLS_ENABLED);
  expect(ui.host.querySelector('.settings-card')?.textContent).not.toContain('资源缓存');
  ui.unmount();
});

it('hides the internal catalog when the build disables it while retaining settings', async () => {
  const ui = renderUI(createElement(BlessingApp, { host, internalToolsEnabled: false, initialRoute: { page: 'me' } }));
  await settle();
  expect(ui.host.querySelector('.settings-card')?.textContent).toContain('音效');
  expect(ui.host.querySelector('.settings-card')?.textContent).toContain('隐私政策');
  expect(ui.host.querySelector('.settings-card')?.textContent).not.toContain('场景目录');
  expect(ui.host.querySelector('.settings-card')?.textContent).not.toContain('资源缓存');
  ui.unmount();
});

it('keeps the catalog available from My during internal testing', async () => {
  const ui = renderUI(createElement(BlessingApp, { host, internalToolsEnabled: true, initialRoute: { page: 'me' } }));
  await settle();
  clickOn([...ui.host.querySelectorAll('.settings-row')].find(row => row.textContent === '场景目录')!);
  await settle();
  expect(ui.host.querySelector('[data-test-catalog]')).not.toBeNull();
  ui.unmount();
});

it.each(['scenes', 'cache'] as const)('blocks a direct initial %s route in a release host', async page => {
  const ui = renderUI(createElement(BlessingApp, { host, internalToolsEnabled: false, initialRoute: { page } }));
  await settle();
  expect(ui.host.querySelector('[data-test-catalog], [data-test-cache]')).toBeNull();
  expect(ui.host.querySelector('.settings-card')).not.toBeNull();
  ui.unmount();
});

it.each(['catalog route', 'cache route'])('blocks programmatic navigation to %s in a release host', async label => {
  const ui = renderUI(createElement(BlessingApp, { host, internalToolsEnabled: false }));
  await settle();
  clickOn([...ui.host.querySelectorAll('button')].find(button => button.textContent === label)!);
  await settle();
  expect(ui.host.querySelector('[data-test-today]')).not.toBeNull();
  expect(ui.host.querySelector('[data-test-catalog], [data-test-cache]')).toBeNull();
  ui.unmount();
});

it('immediately closes an internal route when the host disables internal tools', async () => {
  const props = { host, initialRoute: { page: 'scenes' as const } };
  const ui = renderUI(createElement(BlessingApp, { ...props, internalToolsEnabled: true }));
  await settle();
  expect(ui.host.querySelector('[data-test-catalog]')).not.toBeNull();
  ui.rerender(createElement(BlessingApp, { ...props, internalToolsEnabled: false }));
  expect(ui.host.querySelector('[data-test-catalog]')).toBeNull();
  await settle();
  expect(ui.host.querySelector('.settings-card')).not.toBeNull();
  ui.unmount();
});
