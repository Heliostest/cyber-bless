import { BlessingApp } from '@wbr/app';
import '@wbr/app/style.css';

// Dev-only, per-tab storage. The actual personal save is never read or written.
const key = 'cyber-bless:opening-preview:v1';
const host = {
  read: async () => sessionStorage.getItem(key),
  write: async (raw: string) => { sessionStorage.setItem(key, raw); },
};

export default function OpeningPreview() {
  return <>
    <BlessingApp host={host} />
    <span style={{ position: 'fixed', bottom: 8, left: 8, zIndex: 50, padding: '5px 10px',
      borderRadius: 12, background: '#fff7e8e6', color: '#355d54', font: '12px sans-serif', pointerEvents: 'none' }}>
      开场预览 · 独立测试存档
    </span>
  </>;
}
