import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureLocale, getLocale, resolveLocale, subscribeLocale, createTranslator, graphemeLength, localePreferenceFromSave, configureHour12, formatDate } from './index';
import { productError } from './errors';

afterEach(() => configureLocale('zh-Hans', []));
it('never treats inherited object properties as catalog error IDs', () => {
  expect(productError('constructor').code).toBe('app.error.generic');
  expect(productError('__proto__').code).toBe('app.error.generic');
});
describe('locale resolution', () => {
  it.each([
    [['zh-TW'], 'zh-Hant'], [['zh-HK'], 'zh-Hant'], [['zh-MO'], 'zh-Hant'],
    [['zh-Hans-TW'], 'zh-Hans'], [['zh-Hant-CN'], 'zh-Hant'], [['zh-SG'], 'zh-Hans'],
    [['de-DE', 'ja-JP'], 'ja'], [['EN_gb'], 'en'], [['pt-BR'], 'pt'], [['pt-PT'], 'pt'],
    [['es-MX'], 'es'], [['fr-CA'], 'fr'], [['ko-KR'], 'ko'], [['nope', '%%%'], 'en'],
  ])('matches ordered %j to %s', (tags, locale) => {
    expect(resolveLocale('system', tags).locale).toBe(locale);
  });
  it('preserves regional formatting while explicit preference overrides system', () => {
    expect(resolveLocale('system', ['en-GB']).formatLocale).toBe('en-GB');
    expect(resolveLocale('fr', ['en-GB']).locale).toBe('fr');
  });
  it('publishes one language change and unsubscribes', () => {
    configureLocale('zh-Hans', []);
    const seen: string[] = [];
    const off = subscribeLocale(() => seen.push(getLocale()));
    configureLocale('ja', []); configureLocale('ja', []); off(); configureLocale('ko', []);
    expect(seen).toEqual(['ja']);
  });
  it('extracts the setting without mutating or replacing a damaged save', () => {
    expect(localePreferenceFromSave('{"version":1,"settings":{"locale":"fr"}}')).toBe('fr');
    expect(localePreferenceFromSave('{"version":1,"settings":{"locale":"fr-FR"}}')).toBe('system');
    expect(localePreferenceFromSave('bad')).toBe('system');
  });
});
it('uses ICU plurals and keeps interpolated user text exact', () => {
  const intl = createTranslator('en', 'en', { count: '{n, plural, =0 {No notes} one {# note} other {# notes}}', greeting: 'Hello, {name}' });
  expect(intl.message('count', { n: 0 })).toBe('No notes');
  expect(intl.message('count', { n: 1 })).toBe('1 note');
  expect(intl.message('count', { n: 2 })).toBe('2 notes');
  expect(intl.message('greeting', { name: '我的心愿 <script>' })).toBe('Hello, 我的心愿 <script>');
});
it('counts complete user-perceived characters', () => {
  expect(graphemeLength('e\u0301👩‍👩‍👧‍👦🇫🇷한')).toBe(4);
});
it('keeps the OS clock preference independent of message language and explicit format options', () => {
  const date = new Date(2026, 9, 27, 17, 8);
  configureLocale('en', []); configureHour12(false);
  expect(formatDate(date, { hour: '2-digit', minute: '2-digit' })).toBe('17:08');
  configureLocale('fr', []); configureHour12(true);
  expect(formatDate(date, { hour: '2-digit', minute: '2-digit' })).toMatch(/05:08/);
  expect(formatDate(date, { hour: '2-digit', minute: '2-digit', hour12: false })).toBe('17:08');
  configureHour12();
});
it('keeps skin-tone emoji and combining clusters together without Segmenter', () => {
  const segmenter = Intl.Segmenter;
  Object.defineProperty(Intl, 'Segmenter', { value: undefined, configurable: true });
  try {
    expect(graphemeLength('👩🏽‍💻e\u0301🇫🇷')).toBe(3);
    expect(graphemeLength('\u0301A')).toBe(2);
    expect(graphemeLength('\u1100\u1161')).toBe(1);
  }
  finally { Object.defineProperty(Intl, 'Segmenter', { value: segmenter, configurable: true }); }
});
