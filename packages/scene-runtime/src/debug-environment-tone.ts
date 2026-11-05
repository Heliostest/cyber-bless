import { DEFAULT_ENVIRONMENT_TONE } from './environment-defaults';
export type EnvironmentTone = 'original' | 'tiny-delivery';
export type DebugEnvironmentScene = { id: string; label: string; scope?: object; tone: EnvironmentTone };

/** One session-only palette per app shell, retained when navigating between scenes. */
export function createDebugEnvironmentTone() {
  const entries = new Map<symbol, { state: DebugEnvironmentScene; apply(tone: EnvironmentTone): void }>();
  const owners = new Map<object | undefined, Set<symbol>>();
  const choices = new Map<object | undefined, EnvironmentTone>();
  const listeners = new Set<() => void>();
  let snapshot: DebugEnvironmentScene[] = [];
  function publish() {
    snapshot = [...entries.values()].map(entry => ({ ...entry.state }));
    listeners.forEach(listener => listener());
  }
  function applyScope(scope?: object) {
    const tone = owners.get(scope)?.size ? choices.get(scope) ?? DEFAULT_ENVIRONMENT_TONE : DEFAULT_ENVIRONMENT_TONE;
    entries.forEach(entry => {
      if (entry.state.scope !== scope || entry.state.tone === tone) return;
      entry.state.tone = tone; entry.apply(tone);
    });
    publish();
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    enable(scope?: object) {
      const token = Symbol(), group = owners.get(scope) ?? new Set<symbol>();
      group.add(token); owners.set(scope, group);
      return () => {
        if (!group.delete(token)) return;
        if (!group.size) { owners.delete(scope); choices.delete(scope); applyScope(scope); }
      };
    },
    select(tone: EnvironmentTone, scope?: object) {
      if (!owners.get(scope)?.size || (tone !== 'original' && tone !== 'tiny-delivery')) return;
      choices.set(scope, tone); applyScope(scope);
    },
    register(id: string, label: string, apply: (tone: EnvironmentTone) => void, scope?: object) {
      const token = Symbol(id), tone = owners.get(scope)?.size ? choices.get(scope) ?? DEFAULT_ENVIRONMENT_TONE : DEFAULT_ENVIRONMENT_TONE;
      entries.set(token, { state: { id, label, scope, tone }, apply });
      apply(tone); publish();
      return { dispose() { if (entries.delete(token)) publish(); } };
    },
  };
}

export const debugEnvironmentTone = createDebugEnvironmentTone();
