import { productError } from '@wbr/i18n/errors';
import { localePreferenceFromSave, type LocalePreference } from '@wbr/i18n/locales';
import { reduce, restore, type Action, type State } from "@wbr/core";
export { createProjectedStorage } from './projected-storage';
/**
 * The one save: the whole State (keepsakes included) as JSON, written on every
 * dispatch. The web host keeps it in localStorage; the phone App keeps it in
 * AsyncStorage under the same key (apps/mobile-expo/App.tsx).
 */
export const SAVE_KEY = "cyber-bless:personal:v1";
export type Storage = {
    read(): Promise<string | null>;
    write(raw: string): Promise<void>;
};
export type HapticStrength = "light" | "medium" | "heavy";
/** Serializable image export passed from the shared DOM UI to a native host. */
export type ShareImageRequest = { dataUrl: string; fileName: string; title: string };
/** Public scene page; the shared UI never adds a wish or a private record. */
export type ShareLinkRequest = { title: string; text: string; url: string };
/** `haptic` only where the host can vibrate; no strength keeps the usual tick. */
export type Host = Storage & {
    /** Validated, read-only bootstrap hint; the store remains the source of truth. */
    initialLocalePreference?: LocalePreference;
    haptic?(strength?: HapticStrength): Promise<void>;
    /** Opens the native image share sheet; resolving does not confirm delivery. */
    shareImage?(image: ShareImageRequest): Promise<void>;
    /** Deployed site root; an empty value leaves external link sharing unavailable. */
    publicShareBaseUrl?: string;
    /** Opens the native link share sheet; resolving does not confirm delivery. */
    shareLink?(request: ShareLinkRequest): Promise<void>;
};
type Snapshot = {
    state: State | null;
    status: "loading" | "load-error" | "saving" | "saved" | "save-error";
    error?: string;
    errorCode?: string;
};
export function createStore(storage: Storage,
/** Settings for a brand-new save, read when it is first loaded. */
initialSettings?: () => Partial<State["settings"]>) {
    let snapshot: Snapshot = { state: null, status: "loading" };
    let queue = Promise.resolve();
    let revision = 0;
    let loading: Promise<void> | undefined;
    const listeners = new Set<() => void>();
    const publish = (next: Snapshot) => {
        snapshot = next;
        listeners.forEach((fn) => fn());
    };
    const save = () => {
        if (!snapshot.state)
            return;
        const raw = JSON.stringify(snapshot.state);
        const current = ++revision;
        publish({ ...snapshot, status: "saving", error: undefined });
        queue = queue
            .then(() => storage.write(raw))
            .then(() => {
            if (current === revision)
                publish({ ...snapshot, status: "saved", error: undefined });
        })
            .catch(() => {
            if (current === revision)
                publish({
                    ...snapshot,
                    status: "save-error",
                    error: "这次变化还没保存，请重试并暂时保留页面。",
                    errorCode: productError('这次变化还没保存，请重试并暂时保留页面。').code,
                });
        });
    };
    return {
        getSnapshot: () => snapshot,
        subscribe(fn: () => void) {
            listeners.add(fn);
            return () => {
                listeners.delete(fn);
            };
        },
        load() {
            if (loading)
                return loading;
            publish({ state: null, status: "loading" });
            loading = storage
                .read()
                .then((raw) => publish({ state: restore(raw, initialSettings?.()), status: "saved" }))
                .catch(() => publish({
                state: null,
                status: "load-error",
                error: "暂时无法读取记录，原数据已保留。请重新读取。",
                errorCode: productError('暂时无法读取记录，原数据已保留。请重新读取。').code,
            }))
                .finally(() => {
                loading = undefined;
            });
            return loading;
        },
        dispatch(action: Action) {
            if (!snapshot.state)
                throw productError("\u8BF7\u5148\u8BFB\u53D6\u8BB0\u5F55");
            const next = reduce(snapshot.state, action);
            if (next === snapshot.state)
                return;
            snapshot = { ...snapshot, state: next };
            save();
        },
        retry: save,
        flush: () => queue,
    };
}
export type Store = ReturnType<typeof createStore>;
export function browserHost(): Host {
    let initialRaw: string | null = null;
    let initialError: unknown;
    try { initialRaw = localStorage.getItem(SAVE_KEY); } catch (error) { initialError = error; }
    let firstRead = true;
    // Checked once: iOS browsers have no Vibration API, so no haptics there.
    const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
    return {
        initialLocalePreference: localePreferenceFromSave(initialRaw),
        read: async () => {
            if (!firstRead) return localStorage.getItem(SAVE_KEY);
            firstRead = false;
            if (initialError) throw initialError;
            return initialRaw;
        },
        write: async (raw) => localStorage.setItem(SAVE_KEY, raw),
        ...(canVibrate
            ? {
                haptic: async (strength?: HapticStrength) => {
                    const duration = { light: 12, medium: 24, heavy: 40 };
                    navigator.vibrate(strength ? duration[strength] : 12);
                },
            }
            : {}),
    };
}
