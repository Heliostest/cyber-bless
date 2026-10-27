import { createIntl, createIntlCache } from '@formatjs/intl';
import { catalogData, sourceIndex, sceneSourceIndex, type CatalogMessage, type CatalogMessages } from './catalog-data';
import { getLocale, getFormatLocale, getHour12 } from './controller';
import type { SupportedLocale } from './locales';
import type { MessageArguments, MessageId } from './message-types.generated';
export type MessageValues = Record<string, string | number | boolean | Date | null | undefined>;
const cache = createIntlCache();
const missing = new Set<string>();
const ownMessage = (table: CatalogMessages | undefined, id: string) => table && Object.hasOwn(table, id) ? table[id] : undefined;
const oneMessage = (id: string, text: CatalogMessage): CatalogMessages => typeof text === 'string' ? { [id]: text } : { [id]: text };
export function createTranslator(locale: SupportedLocale, formatLocale: string = locale, messages: CatalogMessages = catalogData[locale] ?? {}) {
  const intl = createIntl({ locale: formatLocale, defaultLocale: 'zh-Hans', messages, onError(error) {
    if (!missing.has(error.message)) { missing.add(error.message); if (typeof console !== 'undefined') console.warn('[i18n]', error.code); }
  } }, cache);
  return {
    message(id: string, values?: MessageValues): string {
      if (ownMessage(messages, id) !== undefined) return intl.formatMessage({ id }, values as Parameters<typeof intl.formatMessage>[1]) as string;
      const fallbackLocale = ownMessage(catalogData.en, id) !== undefined ? 'en' : 'zh-Hans';
      const fallback = ownMessage(catalogData[fallbackLocale], id);
      if (fallback === undefined) {
        const generic=ownMessage(catalogData[locale],'app.error.generic');
        return generic ? createIntl({locale,defaultLocale:locale,messages:oneMessage('generic',generic)},cache).formatMessage({id:'generic'}) as string : '…';
      }
      if (!missing.has(`${locale}:${id}`)) { missing.add(`${locale}:${id}`); console.warn('[i18n] Missing catalog message', locale, id); }
      // A fallback must use its own grammar, never evaluate English plurals as Chinese.
      const fallbackIntl = createIntl({ locale: fallbackLocale, defaultLocale: fallbackLocale,
        messages: oneMessage(id, fallback), onError: () => {} }, cache);
      return fallbackIntl.formatMessage({ id }, values as Parameters<typeof intl.formatMessage>[1]) as string;
    },
    date(at: string | number | Date, options: Intl.DateTimeFormatOptions = {}) {
      const date = new Date(at); return Number.isFinite(date.getTime()) ? intl.formatDate(date, options) : '—';
    },
    number(value: number, options?: Intl.NumberFormatOptions) { return intl.formatNumber(value, options as Parameters<typeof intl.formatNumber>[1]); },
  };
}
const translators = new Map<string, ReturnType<typeof createTranslator>>();
function currentTranslator(locale?: SupportedLocale) {
  const language = locale ?? getLocale(), format = locale ?? getFormatLocale(), key = `${language}:${format}`;
  let translator = translators.get(key);
  if (!translator) { translator = createTranslator(language, format); translators.set(key, translator); }
  return translator;
}
type MessageCall<Id extends string> = Id extends MessageId
  ? keyof MessageArguments[Id] extends never
    ? [values?: MessageValues, locale?: SupportedLocale]
    : [values: MessageArguments[Id], locale?: SupportedLocale]
  : [values?: MessageValues, locale?: SupportedLocale];
/** Known IDs check ICU argument names/types; dynamic persisted error IDs remain supported. */
export function message<Id extends string>(id: Id, ...[values, locale]: MessageCall<Id>): string {
  return currentTranslator(locale).message(id, values);
}
export const hasProductCopy = (source: string): boolean => Object.hasOwn(sourceIndex, source);
/** Trusted product copy ONLY. Never pass user-authored notes, titles or drafts. */
export function translate(source: string, values?: MessageValues, locale?: SupportedLocale): string {
  const id = Object.hasOwn(sourceIndex, source) ? sourceIndex[source] : undefined;
  if (id) return message(id, values, locale);
  // Unknown remote/source content remains original; catalog validation reports unindexed built-ins.
  return values ? source.replace(/\{(\w+)\}/g, (match, key) => key in values ? String(values[key] ?? '') : match) : source;
}
/** Scene copy has its own context: e.g. leaving a charm differs from staying on a page. */
export function translateScene(source: string, values?: MessageValues, locale?: SupportedLocale): string {
  const id = Object.hasOwn(sceneSourceIndex, source) ? sceneSourceIndex[source] : undefined;
  return id ? message(id, values, locale) : translate(source, values, locale);
}
export const formatDate = (at: string | number | Date, options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' }) =>
  currentTranslator().date(at, ('hour' in options || 'timeStyle' in options) && options.hour12 === undefined
    ? { ...options, hour12: getHour12() } : options);
export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => currentTranslator().number(value, options);
