import { expect, it } from 'vitest';
import { createState, reduce, restore } from './index';
it('persists a typed language preference while keeping legacy saves and machine dates', () => {
  const original = createState();
  const next = reduce(original, { type: 'settings.locale', value: 'zh-Hant' });
  expect(next.settings.locale).toBe('zh-Hant');
  expect(restore(JSON.stringify(next)).settings.locale).toBe('zh-Hant');
  expect(restore(JSON.stringify(original)).version).toBe(1);
  expect(next.wishes).toBe(original.wishes);
});
it('ignores unsupported language preferences without discarding personal data', () => {
  const raw = JSON.stringify({ ...createState(), settings: { ...createState().settings, locale: 'bad' } });
  expect(restore(raw).settings.locale).toBe('system');
});
