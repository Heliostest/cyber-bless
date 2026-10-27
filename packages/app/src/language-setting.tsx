import { useSyncExternalStore } from 'react';
import { configureLocale, getFormatLocale, normalizeLocalePreference, SUPPORTED_LOCALES, LOCALE_NAMES, subscribeLocale, message } from '@wbr/i18n';
import { useApp } from './context';

/** A native select keeps language names readable and keyboard/reader accessible. */
export function LanguageSetting() {
  useSyncExternalStore(subscribeLocale, getFormatLocale, getFormatLocale);
  const { state, dispatch } = useApp();
  return <label className="settings-row language-setting">
    <span>{message('app.language.label')}<small>{message('app.language.description')}</small></span>
    <select aria-label={message('app.language.label')} value={state.settings.locale ?? 'system'} onChange={event => {
      const value = normalizeLocalePreference(event.currentTarget.value);
      if (dispatch({ type: 'settings.locale', value })) configureLocale(value);
    }}>
      <option value="system">{message('app.language.system')}</option>
      {SUPPORTED_LOCALES.map(locale => <option key={locale} value={locale} lang={locale}>{LOCALE_NAMES[locale]}</option>)}
    </select>
  </label>;
}
