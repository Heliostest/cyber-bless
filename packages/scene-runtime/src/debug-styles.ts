import { visualStyleOptions as styleOptions, normalizeVisualPreference, type VisualPreferenceInput } from "@wbr/core/visual-style";
export { visualStyleOptions as styleOptions } from "@wbr/core/visual-style";
import type { RenderStyleId } from "@wbr/content";
import { DEFAULT_STYLE_PARAMETERS, normalizeStyleParameters, styleParameterControls, type RenderStyleParameters } from "./render-style-parameters";
export { styleParameterControls } from "./render-style-parameters";



type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
export type DebugScene = {
  scope?: object;
  id: string;
  label: string;
  defaultStyle: RenderStyleId;
  override: RenderStyleId | null;
  actual: RenderStyleId;
  parameters: RenderStyleParameters;
  userStyle: RenderStyleId | null;
};
type Entry = { state: DebugScene; apply(style: RenderStyleId, parameters: RenderStyleParameters): void };
const storageKey = "wbr.debug.scene-styles.v1";
const parametersKey = "wbr.debug.scene-parameters.v1";
function isStyle(value: unknown): value is RenderStyleId {
  return styleOptions.some((option) => option.id === value);
}

export function createDebugStyles() {
  let enabled = false;
  let storage: Storage | undefined;
  const choices = new Map<string, RenderStyleId>();
  const parameterChoices = new Map<string, RenderStyleParameters>();
  const entries = new Map<symbol, Entry>();
  const users = new Map<symbol, { id: string; scope?: object; preference: ReturnType<typeof normalizeVisualPreference>; cancelInput?: () => void }>();
  const listeners = new Set<() => void>();
  let snapshot: DebugScene[] = [];
  function publish() {
    snapshot = [...entries.values()].map(({ state }) => ({ ...state, parameters: { ...state.parameters } }));
    listeners.forEach((listener) => listener());
  }
  function apply(entry: Entry) {
    const user = [...users.values()].filter(owner => owner.id === entry.state.id && owner.scope === entry.state.scope).at(-1)?.preference;
    entry.state.userStyle = user?.style ?? null;
    entry.state.override = enabled ? choices.get(entry.state.id) ?? null : null;
    entry.state.actual = entry.state.override ?? entry.state.userStyle ?? entry.state.defaultStyle;
    entry.state.parameters = { ...((enabled ? parameterChoices.get(entry.state.id) : undefined) ?? user?.parameters ?? DEFAULT_STYLE_PARAMETERS) };
    entry.apply(entry.state.actual, { ...entry.state.parameters });
  }
  function applyId(id: string, scope?: object, allScopes = false) {
    entries.forEach(entry => { if (entry.state.id === id && (allScopes || entry.state.scope === scope)) apply(entry); });
    publish();
  }
  function setParameters(id: string, patch: Partial<RenderStyleParameters>) {
    if (!enabled) return;
    parameterChoices.set(id, normalizeStyleParameters(patch, parameterChoices.get(id)));
    try { storage?.setItem(parametersKey, JSON.stringify(Object.fromEntries(parameterChoices))); }
    catch { /* Live adjustment remains usable without browser storage. */ }
    entries.forEach(entry => { if (entry.state.id === id) apply(entry); });
    publish();
  }
  return {
    /** Production preferences are supplied by the App's native/web host save.
     * Last attached owner is a temporary menu preview; disposal restores its parent.
     */
    connectUserPreference(id: string, value: VisualPreferenceInput | null | undefined, cancelInput?: () => void, scope?: object) {
      const token = Symbol(id), owner = { id, scope, preference: normalizeVisualPreference(value), cancelInput };
      users.set(token, owner); applyId(id, scope);
      return {
        update(value: VisualPreferenceInput | null | undefined) {
          if (!users.has(token)) return;
          owner.preference = normalizeVisualPreference(value); applyId(id, scope);
        },
        dispose() { users.delete(token); applyId(id, scope); },
      };
    },
    cancelInput(id: string, scope?: object) { users.forEach(owner => { if (owner.id === id && owner.scope === scope) owner.cancelInput?.(); }); },
    clearDebugOverride(id: string) {
      choices.delete(id); parameterChoices.delete(id);
      try {
        storage?.setItem(storageKey, JSON.stringify(Object.fromEntries(choices)));
        storage?.setItem(parametersKey, JSON.stringify(Object.fromEntries(parameterChoices)));
      } catch { /* App editing works without debug storage. */ }
      applyId(id, undefined, true);
    },
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    enable(nextStorage?: Storage) {
      if (enabled) return;
      enabled = true;
      storage = nextStorage;
      try {
        const saved: unknown = JSON.parse(storage?.getItem(storageKey) ?? "{}");
        if (saved && typeof saved === "object" && !Array.isArray(saved)) {
          for (const [id, style] of Object.entries(saved)) {
            if (isStyle(style)) choices.set(id, style);
          }
        }
      } catch { /* Storage may be unavailable or contain an older format. */ }
      try {
        const saved: unknown = JSON.parse(storage?.getItem(parametersKey) ?? "{}");
        if (saved && typeof saved === "object" && !Array.isArray(saved)) {
          for (const [id, parameters] of Object.entries(saved)) parameterChoices.set(id, normalizeStyleParameters(parameters));
        }
      } catch { /* Invalid parameter storage must not discard valid preset choices. */ }
      entries.forEach(apply);
      publish();
    },
    select(id: string, style: RenderStyleId | null) {
      if (!enabled || (style !== null && !isStyle(style))) return;
      if (style === null) choices.delete(id);
      else choices.set(id, style);
      try { storage?.setItem(storageKey, JSON.stringify(Object.fromEntries(choices))); }
      catch { /* Live preview remains usable when persistence is denied. */ }
      entries.forEach((entry) => { if (entry.state.id === id) apply(entry); });
      publish();
    },
    setParameters,
    resetParameters(id: string, style: RenderStyleId) {
      const patch: Partial<RenderStyleParameters> = {};
      for (const control of styleParameterControls) {
        if (control.style === style) patch[control.key] = DEFAULT_STYLE_PARAMETERS[control.key];
      }
      if (Object.keys(patch).length) setParameters(id, patch);
    },
    register(id: string, label: string, onStyle: Entry["apply"], scope?: object) {
      const token = Symbol(id);
      const entry: Entry = {
        state: { id, label, scope, defaultStyle: "original", override: null, userStyle: null, actual: "original", parameters: { ...DEFAULT_STYLE_PARAMETERS } },
        apply: onStyle,
      };
      entries.set(token, entry);
      apply(entry);
      publish();
      return {
        setDefault(style: RenderStyleId) {
          if (!entries.has(token)) return;
          entry.state.defaultStyle = style;
          apply(entry);
          publish();
        },
        report(actual: RenderStyleId) {
          if (!entries.has(token) || actual === entry.state.actual) return;
          entry.state.actual = actual;
          publish();
        },
        dispose() { entries.delete(token); publish(); },
      };
    },
  };
}

export const debugStyles = createDebugStyles();
/** The same live registry; production consumers never enable debug storage. */
export const sceneStyles = debugStyles;
