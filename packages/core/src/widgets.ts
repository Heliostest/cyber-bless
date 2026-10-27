import { restore, localDay, dailyCollectibleId, openingExclusions } from './index';
import { validOpeningSceneIds } from './opening';
import { builtInScenes, dailyPrimaryScene, WISH_SCENE_IDS } from './daily-scenes';
import type { LocalePreference } from '../../i18n/src/locales';
import { WIDGET_COPY_REVISION } from '../../i18n/src/widget-copy-revision.generated';

export const WIDGET_CATALOG_REVISION = 'bundled-daily-v1';
export type WidgetDay = {
  day: string; sceneId: string; category: 'blessing' | 'wish';
  artKey: string; collected: 'confirmed' | 'unknown'; deepLink: string;
};
type SnapshotBase = {
  opening?: { day: string; sceneIds: [string, string, string] };
  sourceVersion: 1; sourceHash: string; catalogRevision: string;
  generatedAt: string; timeZone: string; validThroughDay: string;
};
export type WidgetSnapshotV1 = SnapshotBase & { schemaVersion: 1; days: Array<WidgetDay & { title: string }> };
export type WidgetSnapshotV2 = SnapshotBase & {
  schemaVersion: 2; localePreference: LocalePreference; copyRevision: string; days: WidgetDay[];
};
export type WidgetSnapshot = WidgetSnapshotV1 | WidgetSnapshotV2;
export type WidgetLinkRequest = { day?: string; sceneId?: string };
export type WidgetNavigationRequest = WidgetLinkRequest & { requestId: number };
export type TodayWidgetProps = {
  day: string; deepLink: string; sceneId?: string; collected: 'confirmed' | 'unknown';
  localePreference: LocalePreference; copyRevision: string;
  resolvedLocale?: string; localizedDay?: string;
  /** Old timelines are tolerated, but display never trusts their strings. */
  title?: string; subtitle?: string;
  previewSmall?: string; previewMedium?: string; previewLarge?: string;
};
const ids = new Set(builtInScenes.map(e => e.id));
const preferences = new Set(['system', 'zh-Hans', 'zh-Hant', 'en', 'ja', 'ko', 'es', 'pt', 'fr']);
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join('|') === keys.sort().join('|');
const rootKeys = ['schemaVersion', 'sourceVersion', 'sourceHash', 'catalogRevision', 'generatedAt', 'timeZone', 'validThroughDay', 'days'];
export function widgetLink(day?: string, sceneId?: string): string {
  return `cyber-bless://widget/today?v=1${day && sceneId ? `&day=${day}&scene=${sceneId}` : ''}`;
}
export function isLocalDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
export function parseWidgetLink(raw: string): WidgetLinkRequest | undefined {
  if (raw.length > 512) return;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'cyber-bless:' || url.host !== 'widget' || url.pathname !== '/today' || url.hash || url.username || url.password) return;
    const keys = [...url.searchParams.keys()];
    if (new Set(keys).size !== keys.length || keys.some(k => !['v', 'day', 'scene'].includes(k)) || url.searchParams.get('v') !== '1') return;
    const day = url.searchParams.get('day'), sceneId = url.searchParams.get('scene');
    if (day === null && sceneId === null) return {};
    if (!day || !isLocalDay(day) || !sceneId || !ids.has(sceneId)) return;
    return { day, sceneId };
  } catch { return; }
}
export function resolveWidgetScene<T extends { id: string }>(request: WidgetLinkRequest, day: string, entries: readonly T[], excluded: readonly string[] = []): T | undefined {
  const current = dailyPrimaryScene(entries, day, excluded);
  if (request.day && request.day !== day) return;
  if (request.sceneId && request.sceneId !== current?.id) return;
  return current;
}
const midnight = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export function createWidgetSnapshot(raw: string | null | undefined, at: Date, sourceHash: string): WidgetSnapshotV2 {
  let state: ReturnType<typeof restore> | undefined;
  try { if (raw !== undefined) state = restore(raw); } catch { /* Preserve main raw; publish a public fallback. */ }
  const days: WidgetDay[] = [];
  if (state) for (let i = 0; i < 7; i++) {
    const date = new Date(at.getFullYear(), at.getMonth(), at.getDate() + i, 12);
    const day = localDay(date);
    const scene = dailyPrimaryScene(builtInScenes, day, openingExclusions(state.opening, day))!;
    const category = (WISH_SCENE_IDS as readonly string[]).includes(scene.id) ? 'wish' : 'blessing';
    days.push({ day, sceneId: scene.id, category, artKey: scene.id,
      collected: i === 0 && state.collectibles.some(c => c.id === dailyCollectibleId(day, scene.id) && c.sceneId === scene.id) ? 'confirmed' : 'unknown',
      deepLink: widgetLink(day, scene.id) });
  }
  let timeZone: string;
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { timeZone = ''; }
  const opening = state?.opening?.status === 'complete'
    ? { day: state.opening.completedDay, sceneIds: state.opening.sceneIds } : undefined;
  const savedPreference = (state?.settings as { locale?: string } | undefined)?.locale;
  const localePreference = preferences.has(savedPreference ?? '') ? savedPreference as LocalePreference : 'system';
  return { schemaVersion: 2, sourceVersion: 1, sourceHash, catalogRevision: WIDGET_CATALOG_REVISION,
    localePreference, copyRevision: WIDGET_COPY_REVISION, ...(opening ? { opening } : {}),
    generatedAt: at.toISOString(), timeZone: timeZone || `UTC${-at.getTimezoneOffset()}`,
    validThroughDay: days.at(-1)?.day ?? localDay(at), days };
}
function generationDay(snapshot: Record<string, unknown>): string | undefined {
  if (typeof snapshot.generatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(snapshot.generatedAt) || !Number.isFinite(Date.parse(snapshot.generatedAt)) || typeof snapshot.timeZone !== 'string') return;
  const instant = new Date(snapshot.generatedAt);
  const offset = /^UTC([+-]?\d{1,4})$/.exec(snapshot.timeZone);
  if (offset) {
    const minutes = Number(offset[1]);
    if (minutes < -840 || minutes > 840) return;
    return new Date(instant.getTime() + minutes * 60000).toISOString().slice(0, 10);
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: snapshot.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', calendar: 'gregory', numberingSystem: 'latn' }).formatToParts(instant);
    const part = (key: string) => parts.find(p => p.type === key)?.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  } catch { return; }
}
/** Strict legacy reader; canonical title is checked only for v1 compatibility. */
export function readWidgetSnapshot(value: unknown): WidgetSnapshotV2 | undefined {
  try {
    if (!plain(value) || ![1, 2].includes(value.schemaVersion as number) || value.sourceVersion !== 1 || value.catalogRevision !== WIDGET_CATALOG_REVISION || typeof value.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(value.sourceHash)) return;
    const v2 = value.schemaVersion === 2;
    const keys = [...rootKeys, ...(v2 ? ['localePreference', 'copyRevision'] : []), ...('opening' in value ? ['opening'] : [])];
    if (!exactKeys(value, keys) || (v2 && (!preferences.has(value.localePreference as string) || value.copyRevision !== WIDGET_COPY_REVISION))) return;
    if (!Array.isArray(value.days) || ![0, 7].includes(value.days.length) || typeof value.validThroughDay !== 'string' || !isLocalDay(value.validThroughDay)) return;
    const firstDay = generationDay(value);
    if (!firstDay || !isLocalDay(firstDay)) return;
    let opening: WidgetSnapshotV2['opening'];
    if ('opening' in value) {
      if (!plain(value.opening) || !exactKeys(value.opening, ['day', 'sceneIds']) || typeof value.opening.day !== 'string' || !isLocalDay(value.opening.day) || !validOpeningSceneIds(value.opening.sceneIds)) return;
      opening = value.opening as WidgetSnapshotV2['opening'];
    }
    const days: WidgetDay[] = [];
    for (const [index, entry] of value.days.entries()) {
      if (!plain(entry) || !exactKeys(entry, ['day', 'sceneId', 'category', 'artKey', 'collected', 'deepLink', ...(!v2 ? ['title'] : [])])) return;
      const expectedDay = new Date(`${firstDay}T12:00:00Z`);
      expectedDay.setUTCDate(expectedDay.getUTCDate() + index);
      if (entry.day !== expectedDay.toISOString().slice(0, 10)) return;
      const excluded = opening?.day === entry.day ? opening.sceneIds : [];
      const known = dailyPrimaryScene(builtInScenes, entry.day as string, excluded);
      if (!known || entry.sceneId !== known.id || entry.artKey !== known.id || entry.deepLink !== widgetLink(entry.day as string, known.id) || (!v2 && entry.title !== known.title)) return;
      const category = (WISH_SCENE_IDS as readonly string[]).includes(known.id) ? 'wish' : 'blessing';
      if (entry.category !== category || !['confirmed', 'unknown'].includes(entry.collected as string) || (index > 0 && entry.collected !== 'unknown')) return;
      days.push({ day: entry.day as string, sceneId: known.id, category, artKey: known.id, collected: entry.collected as WidgetDay['collected'], deepLink: widgetLink(entry.day as string, known.id) });
    }
    if (value.validThroughDay !== (days.at(-1)?.day ?? firstDay)) return;
    return { ...value, schemaVersion: 2, days, localePreference: v2 ? value.localePreference : 'system', copyRevision: WIDGET_COPY_REVISION } as WidgetSnapshotV2;
  } catch { return; }
}
export function selectWidgetDay(value: unknown, now: Date): WidgetDay | undefined {
  const snapshot = readWidgetSnapshot(value), day = localDay(now);
  if (!snapshot || day > snapshot.validThroughDay) return;
  return snapshot.days.find(e => e.day === day);
}
export function widgetProps(entry?: WidgetDay, localePreference: LocalePreference = 'system'): TodayWidgetProps {
  return { day: entry?.day ?? '', ...(entry ? { sceneId: entry.sceneId } : {}),
    localePreference, copyRevision: WIDGET_COPY_REVISION,
    collected: 'unknown', deepLink: entry?.deepLink ?? widgetLink() };
}
/** Calendar arithmetic (not 24h): future entries survive DST boundaries. */
export function widgetTimeline(value: WidgetSnapshot, now: Date): Array<{ date: Date; props: TodayWidgetProps }> {
  const snapshot = readWidgetSnapshot(value);
  const preference = snapshot?.localePreference ?? 'system';
  const timeline = [{ date: now, props: widgetProps(selectWidgetDay(value, now), preference) }];
  for (const entry of snapshot?.days ?? []) {
    const date = midnight(entry.day);
    if (date > now) timeline.push({ date, props: widgetProps(entry, preference) });
  }
  if (snapshot?.days.length) {
    const expires = midnight(snapshot.validThroughDay);
    expires.setDate(expires.getDate() + 1);
    if (expires > now) timeline.push({ date: expires, props: widgetProps(undefined, preference) });
  }
  return timeline;
}
