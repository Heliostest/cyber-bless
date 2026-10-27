/** This small entry point is safe in native and widget generators. */
export const SUPPORTED_LOCALES = ['zh-Hans', 'zh-Hant', 'en', 'ja', 'ko', 'es', 'pt', 'fr'] as const;
export type SupportedLocale = typeof SUPPORTED_LOCALES[number];
export type LocalePreference = 'system' | SupportedLocale;
export const LOCALE_NAMES: Record<SupportedLocale, string> = {
  'zh-Hans': '简体中文', 'zh-Hant': '繁體中文', en: 'English', ja: '日本語', ko: '한국어', es: 'Español', pt: 'Português', fr: 'Français',
};
export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === 'string' && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
export const normalizeLocalePreference = (value: unknown): LocalePreference => isSupportedLocale(value) ? value : 'system';
export function matchLocale(tag: string): { locale: SupportedLocale; formatLocale: string } | undefined {
  try {
    const canonical = Intl.getCanonicalLocales(tag.replace(/_/g, '-'))[0];
    const parts = canonical.split('-'), language = parts[0];
    if (language === 'zh') {
      const script = parts.find(p => p === 'Hant' || p === 'Hans');
      return { locale: script === 'Hant' || (!script && parts.some(p => ['TW', 'HK', 'MO'].includes(p))) ? 'zh-Hant' : 'zh-Hans', formatLocale: canonical };
    }
    if (isSupportedLocale(language)) return { locale: language, formatLocale: canonical };
  } catch { /* Ignore a malformed OS preference and try the next one. */ }
}
export function resolveLocale(preference: LocalePreference = 'system', preferredLocales: readonly string[] = []) {
  if (isSupportedLocale(preference)) return { locale: preference, formatLocale: preference };
  for (const tag of preferredLocales) { const match = matchLocale(tag); if (match) return match; }
  return { locale: 'en' as SupportedLocale, formatLocale: 'en' };
}
export function localePreferenceFromSave(raw: string | null): LocalePreference {
  try { const save = raw ? JSON.parse(raw) : null; return normalizeLocalePreference(save?.version === 1 ? save?.settings?.locale : undefined); }
  catch { return 'system'; }
}
