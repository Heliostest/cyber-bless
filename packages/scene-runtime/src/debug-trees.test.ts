import { describe, expect, it, vi } from 'vitest';
import { createDebugTrees } from './debug-trees';

describe('tree debug scope', () => {
  it('keeps choices in the owning app and restores recommendations when the last owner leaves', () => {
    const debug = createDebugTrees(), scope = {}, other = {}, apply = vi.fn(), applyOther = vi.fn();
    const tree = debug.register('tea', 'Tea', apply, scope), second = debug.register('tea', 'Tea', applyOther, other);
    tree.report({ count: 8, actual: 'original', status: 'ready' });
    debug.select('tea', 'quaternius', scope);
    expect(apply).toHaveBeenLastCalledWith('scene');
    const release = debug.enable(scope), releaseOtherOwner = debug.enable(scope);
    debug.select('tea', 'simple-tree', scope);
    expect(apply).toHaveBeenLastCalledWith('simple-tree');
    expect(applyOther).toHaveBeenLastCalledWith('scene');
    tree.report({ count: 8, actual: 'original', status: 'loading' });
    expect(debug.getSnapshot().find(entry => entry.scope === scope)).toMatchObject({ method: 'simple-tree', actual: 'original', status: 'loading' });
    release(); expect(apply).toHaveBeenLastCalledWith('simple-tree');
    releaseOtherOwner(); expect(apply).toHaveBeenLastCalledWith('scene');
    tree.dispose(); second.dispose(); expect(debug.getSnapshot()).toEqual([]);
  });
});
