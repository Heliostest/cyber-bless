import { beforeEach } from 'vitest';
import { configureLocale } from '@wbr/i18n';
// Existing regression fixtures are Chinese. Internationalization tests explicitly choose other locales.
beforeEach(() => {
  configureLocale('zh-Hans', ['zh-CN']);
  if (typeof navigator !== 'undefined') {
    Object.defineProperty(navigator, 'languages', { value: ['zh-CN'], configurable: true });
    Object.defineProperty(navigator, 'language', { value: 'zh-CN', configurable: true });
  }
});
