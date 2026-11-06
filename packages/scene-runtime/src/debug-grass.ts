import { DEFAULT_GRASS_METHOD } from './environment-defaults';
export type GrassRenderMethod = 'original' | 'komorebi';
export type DebugGrassScene = { id: string; label: string; scope?: object; method: GrassRenderMethod };

/** One temporary grass choice per app; new scenes inherit it without touching saves. */
export function createDebugGrass() {
  const entries = new Map<symbol, { state: DebugGrassScene; apply(method: GrassRenderMethod): void }>();
  const owners = new Map<object | undefined, Set<symbol>>(), choices = new Map<object | undefined, GrassRenderMethod>();
  const listeners = new Set<() => void>();
  let snapshot: DebugGrassScene[] = [];
  function publish() { snapshot = [...entries.values()].map(entry => ({ ...entry.state })); listeners.forEach(fn => fn()); }
  function apply(scope?: object) {
    const method = owners.get(scope)?.size ? choices.get(scope) ?? DEFAULT_GRASS_METHOD : DEFAULT_GRASS_METHOD;
    entries.forEach(entry => {
      if (entry.state.scope === scope && entry.state.method !== method) { entry.state.method = method; entry.apply(method); }
    }); publish();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    enable(scope?: object) {
      const token = Symbol(), group = owners.get(scope) ?? new Set<symbol>(); group.add(token); owners.set(scope, group);
      return () => { if (!group.delete(token)) return; if (!group.size) { owners.delete(scope); choices.delete(scope); apply(scope); } };
    },
    select(method: GrassRenderMethod, scope?: object) {
      if (!owners.get(scope)?.size || !['original', 'komorebi'].includes(method)) return;
      choices.set(scope, method); apply(scope);
    },
    register(id: string, label: string, onMethod: (method: GrassRenderMethod) => void, scope?: object) {
      const token = Symbol(id), method = owners.get(scope)?.size ? choices.get(scope) ?? DEFAULT_GRASS_METHOD : DEFAULT_GRASS_METHOD;
      entries.set(token, { state: { id, label, scope, method }, apply: onMethod }); onMethod(method); publish();
      return { dispose() { if (entries.delete(token)) publish(); } };
    },
  };
}
export const debugGrass = createDebugGrass();
