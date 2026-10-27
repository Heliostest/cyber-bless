import { BlessingApp } from '@wbr/app';
import '@wbr/app/style.css';
import { createState } from '@wbr/core';
import { getLocalePreference, localePreferenceFromSave, translate as tr } from '@wbr/i18n';
import { useDeveloperLocale } from './locale';

// Dev-only, per-tab storage. The actual personal save is never read or written.
const key = 'cyber-bless:opening-preview:v1';
let stored: string | null = null, readError: unknown;
try { stored = sessionStorage.getItem(key); } catch (error) { readError = error; }
const seed = createState(); seed.settings.locale = getLocalePreference();
const initial = stored ?? JSON.stringify(seed);
const host = {
  initialLocalePreference: localePreferenceFromSave(initial),
  read: async () => { if (readError) throw readError; return sessionStorage.getItem(key) ?? initial; },
  write: async (raw: string) => { sessionStorage.setItem(key, raw); },
};

export default function OpeningPreview() {
  useDeveloperLocale();
  return <>
    <BlessingApp host={host} />
    <span style={{ position: 'fixed', bottom: 8, left: 8, zIndex: 50, padding: '5px 10px',
      borderRadius: 12, background: '#fff7e8e6', color: '#355d54', font: '12px sans-serif', pointerEvents: 'none' }}>
      {tr('开场预览 · 独立测试存档')}
    </span>
  </>;
}
