import { builtInScenes } from '../../packages/core/src/daily-scenes.ts';

export const LAYOUT_ACTIVE_WISH = 'layout-active';
export const LAYOUT_FULFILLED_WISH = 'layout-fulfilled';
export const USER_WISH_TITLE = 'Un pas après l’autre — 平安 e\u0301 👨‍👩‍👧‍👦';
export const USER_NOTE_COLLISION = '我的心愿';
export const LONG_USER_URL = `https://example.test/${'unbreakable'.repeat(16)}`;
export const USER_NOTE_DRAFT = `café e\u0301 🧑‍🚀 平安 — ${'Un petit pas, puis un autre. '.repeat(7)}${LONG_USER_URL}`;
const AT = '2026-10-26T08:00:00.000Z';

export function emptyLayoutState(locale) {
  return { version: 1, sceneRecords: [], wishes: [], activeSession: null, sessions: [],
    collectibles: [], ledger: [], settings: { locale, sound: false, haptics: false, reducedMotion: true } };
}

export function populatedLayoutState(locale) {
  const state = emptyLayoutState(locale);
  const source = id => {
    const entry = builtInScenes.find(entry => entry.id === id);
    if (!entry) throw Error(`Missing built-in layout fixture scene: ${id}`);
    return entry;
  };
  const wish = (id, title, extra = {}) => ({ id, title, intention: '', category: 'life', returnMethod: 'kindness',
    status: 'active', archived: false, createdAt: AT, notes: [], ...extra });
  state.wishes = [
    wish(LAYOUT_ACTIVE_WISH, USER_WISH_TITLE, { sourceSceneId: 'tanzaku-tanabata',
      intention: `Prendre le temps de continuer. ${'sansEspaces'.repeat(10)}`,
      notes: [
        { id: 'layout-note-collision', text: USER_NOTE_COLLISION, at: AT },
        { id: 'layout-note-mixed', text: 'cœur e\u0301 — 日本語 한국어 👨‍👩‍👧‍👦', at: AT },
        { id: 'layout-note-url', text: LONG_USER_URL, at: AT },
      ] }),
    wish(LAYOUT_FULFILLED_WISH, 'Une mélodie apprise, un souvenir à garder', { status: 'fulfilled',
      realizedAt: AT, fulfilledAt: AT, notes: [{ id: 'layout-note-fulfilled', text: 'Merci pour ce petit progrès.', at: AT }] }),
    wish('layout-archived', '给尚未想好的方向留一点时间', { archived: true }),
  ];
  state.sessions = [{ id: 'layout-woodfish', ritual: 'woodfish', progress: 12, strikes: 12, startedAt: AT, completedAt: AT }];
  state.sceneRecords = ['crane', 'tanzaku-tanabata'].map(id => {
    const entry = source(id);
    return { id, title: entry.title, engine: entry.engine, revision: entry.revision,
      manifestUrl: entry.manifestUrl, progress: 1, favorite: id === 'crane', lastOpened: AT };
  });
  const vessel = (id, sceneId, spent = false) => ({ id, kind: 'scene', title: source(sceneId).title,
    sceneId, wishScene: true, at: AT, ...(spent ? { spentAt: AT } : {}) });
  state.collectibles = [
    { id: 'ritual:layout-woodfish', kind: 'woodfish', title: '木鱼', at: AT },
    vessel('layout-vessel-used', 'crane', true),
    vessel('layout-vessel-unused', 'tanzaku-tanabata'),
    vessel('layout-vessel-pending', 'crane', true),
    vessel('layout-vessel-fourth', 'daruma-eye-painting'),
    { id: `wish:${LAYOUT_FULFILLED_WISH}`, kind: 'badge', title: '如愿', wishId: LAYOUT_FULFILLED_WISH, at: AT },
  ];
  state.vesselDrafts = { 'layout-vessel-pending': { line: 'Un vœu gardé · 平安 🌿', at: AT } };
  return state;
}
