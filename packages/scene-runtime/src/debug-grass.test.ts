import { expect, it, vi } from 'vitest';
import { createDebugGrass } from './debug-grass';

it('retains one grass choice per app across remounts and clears only after the final owner leaves', () => {
  const registry = createDebugGrass(), a = {}, b = {}, apply = vi.fn(), other = vi.fn();
  const one = registry.enable(a), two = registry.enable(a);
  const entry = registry.register('woodfish','woodfish',apply,a);
  registry.register('woodfish','woodfish',other,b);
  registry.select('original',a); expect(apply).toHaveBeenLastCalledWith('original');
  expect(other).toHaveBeenLastCalledWith('komorebi');
  entry.dispose();
  const late = vi.fn(); registry.register('river','river',late,a);
  expect(late).toHaveBeenLastCalledWith('original');
  one(); expect(late).toHaveBeenLastCalledWith('original');
  two(); expect(late).toHaveBeenLastCalledWith('komorebi');
  registry.select('original',a); expect(late).toHaveBeenLastCalledWith('komorebi');
});
