export type WaterRenderMethod = 'original' | 'toon-water';
export type DebugWaterScene = {
  id: string; label: string; scope?: object; surfaces: number; method: WaterRenderMethod;
};

/** Session-only developer choices. Never reads or writes production preferences. */
export function createDebugWater() {
  type Entry = { state: DebugWaterScene; apply(method: WaterRenderMethod): void };
  const entries = new Map<symbol, Entry>();
  const owners = new Map<object | undefined, Set<symbol>>();
  const choices = new Map<object | undefined, Map<string, WaterRenderMethod>>();
  const listeners = new Set<() => void>();
  let snapshot: DebugWaterScene[] = [];
  function publish() {
    snapshot = [...entries.values()].map(entry => ({ ...entry.state }));
    listeners.forEach(listener => listener());
  }
  function apply(entry: Entry) {
    const { scope, id } = entry.state;
    entry.state.method = owners.get(scope)?.size ? choices.get(scope)?.get(id) ?? 'original' : 'original';
    entry.apply(entry.state.method);
  }
  function applyScope(scope?: object) {
    entries.forEach(entry => { if (entry.state.scope === scope) apply(entry); });
    publish();
  }
  return {
    get observed() { return listeners.size > 0; },
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    enable(scope?: object) {
      const token = Symbol(), group = owners.get(scope) ?? new Set<symbol>();
      group.add(token); owners.set(scope, group); applyScope(scope);
      return () => {
        if (!group.delete(token)) return;
        if (!group.size) { owners.delete(scope); choices.delete(scope); }
        applyScope(scope);
      };
    },
    select(id: string, method: WaterRenderMethod, scope?: object) {
      if (!owners.get(scope)?.size || (method !== 'original' && method !== 'toon-water')) return;
      const group = choices.get(scope) ?? new Map<string, WaterRenderMethod>();
      group.set(id, method); choices.set(scope, group); applyScope(scope);
    },
    register(id: string, label: string, onMethod: Entry['apply'], scope?: object) {
      const token = Symbol(id), entry: Entry = { state: { id, label, scope, surfaces: 0, method: 'original' }, apply: onMethod };
      entries.set(token, entry); apply(entry); publish();
      return {
        report(surfaces: number) {
          if (!entries.has(token) || entry.state.surfaces === surfaces) return;
          entry.state.surfaces = surfaces; publish();
        },
        dispose() { if (entries.delete(token)) publish(); },
      };
    },
  };
}

export const debugWater = createDebugWater();
