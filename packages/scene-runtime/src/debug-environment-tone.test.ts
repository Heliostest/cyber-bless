import { expect, it, vi } from 'vitest';
import { createDebugEnvironmentTone } from './debug-environment-tone';

it('keeps a scoped tone across scene mounts, collapse and release without production storage', () => {
  const store = createDebugEnvironmentTone(), a = {}, b = {}, apply = vi.fn(), other = vi.fn();
  const release = store.enable(a);
  const first = store.register('tea', '茶', apply, a);
  const second = store.register('tea', '茶', other, b);
  store.select('original', a);
  expect(apply).toHaveBeenLastCalledWith('original');
  expect(other).toHaveBeenLastCalledWith('komorebi');
  first.dispose();
  const next = store.register('woodfish', '木鱼', apply, a);
  expect(apply).toHaveBeenLastCalledWith('original');
  release();
  expect(apply).toHaveBeenLastCalledWith('komorebi');
  expect(store.getSnapshot().every(entry => entry.tone === 'komorebi')).toBe(true);
  next.dispose(); second.dispose();
});
