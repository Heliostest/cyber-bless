import { describe, expect, it, vi } from 'vitest';
import { createDebugWater } from './debug-water';

describe('water debug scopes', () => {
  it('overrides only the owning App and restores originals when debugging stops', () => {
    const debug = createDebugWater(), scope = {}, other = {};
    const a = vi.fn(), b = vi.fn();
    const first = debug.register('pool', '泉池', a, scope);
    const second = debug.register('pool', '泉池', b, other);
    debug.select('pool', 'toon-water', scope);
    expect(a).toHaveBeenLastCalledWith('original');
    const release = debug.enable(scope);
    debug.select('pool', 'toon-water', scope);
    expect(a).toHaveBeenLastCalledWith('toon-water');
    expect(b).toHaveBeenLastCalledWith('original');
    first.report(2);
    expect(debug.getSnapshot().find(entry => entry.scope === scope)?.surfaces).toBe(2);
    release();
    expect(a).toHaveBeenLastCalledWith('original');
    expect(debug.getSnapshot().find(entry => entry.scope === scope)?.method).toBe('original');
    first.dispose(); second.dispose();
    expect(debug.getSnapshot()).toEqual([]);
  });

  it('notifies only on actual count changes and safely ignores stale registrations', () => {
    const debug = createDebugWater(), listener = vi.fn(), apply = vi.fn(), scope = {};
    debug.subscribe(listener);
    const release = debug.enable(scope), entry = debug.register('pool', '泉池', apply, scope);
    entry.report(1); listener.mockClear();
    entry.report(1);
    expect(listener).not.toHaveBeenCalled();
    entry.dispose(); listener.mockClear();
    entry.report(3); entry.dispose();
    expect(listener).not.toHaveBeenCalled();
    release();
  });
});
