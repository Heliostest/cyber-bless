import { useSyncExternalStore } from 'react'
import { getFormatLocale, getLocale, subscribeLocale } from '@wbr/i18n'
/** Rerender copy only; locale changes must not remount a gesture or scene. */
export function useDeveloperLocale() {
  useSyncExternalStore(subscribeLocale, getFormatLocale, getFormatLocale)
  return getLocale()
}
