import { resolveLocale, normalizeLocalePreference, type LocalePreference, type SupportedLocale } from './locales';
// Deterministic default for standalone scene tools. App startup resolves system before rendering.
let current = { locale: 'zh-Hans' as SupportedLocale, formatLocale: 'zh-Hans' };
let preference: LocalePreference = 'zh-Hans';
let preferred: readonly string[] = [];
let hour12: boolean | undefined;
const listeners = new Set<() => void>();
export const getLocale = () => current.locale;
export const getFormatLocale = () => current.formatLocale;
export const getLocalePreference = () => preference;
export const getHour12 = () => hour12;
/** Native OS clock choice is independent of the selected message language. */
export function configureHour12(value?: boolean) {
  const next = value ?? new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hour12;
  if (hour12 === next) return;
  hour12 = next;
  for (const notify of [...listeners]) notify();
}
export function configureLocale(next: LocalePreference, languages: readonly string[] = preferred) {
  preference = normalizeLocalePreference(next); preferred = [...languages];
  const resolved = resolveLocale(preference, preferred);
  if (resolved.locale === current.locale && resolved.formatLocale === current.formatLocale) return;
  current = resolved;
  for (const notify of [...listeners]) notify();
}
export function subscribeLocale(notify: () => void): () => void {
  listeners.add(notify); return () => { listeners.delete(notify); };
}
