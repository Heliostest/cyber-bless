import { TREE_RENDER_METHODS, type TreeRenderMethod, type TreeSpecies } from './tree-models';
import { DEFAULT_TREE_METHOD } from './environment-defaults';
export type { TreeRenderMethod, TreeSpecies } from './tree-models';
export type TreeRenderReport = { count: number; actual: TreeRenderMethod; status: 'ready' | 'loading' | 'error' };
export type DebugTreeScene = TreeRenderReport & { id: string; label: string; scope?: object; method: TreeRenderMethod; recommendation: TreeSpecies };

/** App-scoped, session-only choices; never changes production preferences. */
export function createDebugTrees() {
  type Entry = { state: DebugTreeScene; apply(method: TreeRenderMethod): void };
  const entries = new Map<symbol, Entry>(), owners = new Map<object | undefined, Set<symbol>>();
  const choices = new Map<object | undefined, Map<string, TreeRenderMethod>>(), listeners = new Set<() => void>();
  let snapshot: DebugTreeScene[] = [];
  function publish() {
    snapshot = [...entries.values()].map(entry => ({ ...entry.state }));
    listeners.forEach(listener => listener());
  }
  function apply(entry: Entry, initial = false) {
    const { scope, id } = entry.state;
    const method = owners.get(scope)?.size ? choices.get(scope)?.get(id) ?? DEFAULT_TREE_METHOD : DEFAULT_TREE_METHOD;
    if (initial || method !== entry.state.method) { entry.state.method = method; entry.apply(method); }
  }
  function applyScope(scope?: object) {
    entries.forEach(entry => { if (entry.state.scope === scope) apply(entry); }); publish();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    enable(scope?: object) {
      const token = Symbol(), group = owners.get(scope) ?? new Set<symbol>();
      group.add(token); owners.set(scope, group); applyScope(scope);
      return () => {
        if (!group.delete(token)) return;
        if (!group.size) { owners.delete(scope); choices.delete(scope); } applyScope(scope);
      };
    },
    select(id: string, method: TreeRenderMethod, scope?: object) {
      if (!owners.get(scope)?.size || !(TREE_RENDER_METHODS as readonly string[]).includes(method)) return;
      const group = choices.get(scope) ?? new Map<string, TreeRenderMethod>();
      group.set(id, method); choices.set(scope, group); applyScope(scope);
    },
    register(id: string, label: string, onMethod: Entry['apply'], scope?: object, recommendation: TreeSpecies = 'original') {
      const token = Symbol(id), entry: Entry = { state: { id, label, scope, recommendation, count: 0, method: DEFAULT_TREE_METHOD, actual: 'original', status: 'ready' }, apply: onMethod };
      entries.set(token, entry); apply(entry, true); publish();
      return {
        report(report: TreeRenderReport) {
          if (!entries.has(token) || (Object.keys(report) as (keyof TreeRenderReport)[]).every(key => entry.state[key] === report[key])) return;
          Object.assign(entry.state, report); publish();
        },
        dispose() { if (entries.delete(token)) publish(); },
      };
    },
  };
}
export const debugTrees = createDebugTrees();
