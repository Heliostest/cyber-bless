import { restore, localDay, dailyCollectibleId } from './index';
import { builtInScenes, dailyPrimaryScene, WISH_SCENE_IDS } from './daily-scenes';

export const WIDGET_CATALOG_REVISION = 'bundled-daily-v1';
export type WidgetDay = {
  day: string; sceneId: string; title: string; category: 'blessing' | 'wish';
  artKey: string; collected: 'confirmed' | 'unknown'; deepLink: string;
};
export type WidgetSnapshotV1 = {
  schemaVersion: 1; sourceVersion: 1; sourceHash: string; catalogRevision: string;
  generatedAt: string; timeZone: string; validThroughDay: string; days: WidgetDay[];
};
export type WidgetLinkRequest = { day?: string; sceneId?: string };
export type WidgetNavigationRequest = WidgetLinkRequest & { requestId: number };
export type TodayWidgetProps = {
  day: string; title: string; subtitle: string; deepLink: string;
  sceneId?: string; collected: 'confirmed' | 'unknown';
  previewSmall?: string; previewMedium?: string;
};
const ids = new Set(builtInScenes.map(e => e.id));
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
export function resolveWidgetScene<T extends { id: string }>(request: WidgetLinkRequest, day: string, entries: readonly T[]): T | undefined {
  const current = dailyPrimaryScene(entries, day);
  if (request.day && request.day !== day) return;
  if (request.sceneId && request.sceneId !== current?.id) return;
  return current;
}
const midnight = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export function createWidgetSnapshot(raw: string | null | undefined, at: Date, sourceHash: string): WidgetSnapshotV1 {
  let state: ReturnType<typeof restore> | undefined;
  try { if (raw !== undefined) state = restore(raw); } catch { /* Preserve main raw; publish a public fallback. */ }
  const days: WidgetDay[] = [];
  if (state) for (let i = 0; i < 7; i++) {
    const date = new Date(at.getFullYear(), at.getMonth(), at.getDate() + i, 12);
    const day = localDay(date);
    const scene = dailyPrimaryScene(builtInScenes, day)!;
    const category = (WISH_SCENE_IDS as readonly string[]).includes(scene.id) ? 'wish' : 'blessing';
    days.push({ day, sceneId: scene.id, title: scene.title, category, artKey: scene.id,
      collected: i === 0 && state.collectibles.some(c => c.id === dailyCollectibleId(day, scene.id) && c.sceneId === scene.id) ? 'confirmed' : 'unknown',
      deepLink: widgetLink(day, scene.id) });
  }
  let timeZone: string;
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { timeZone = ''; }
  return { schemaVersion: 1, sourceVersion: 1, sourceHash, catalogRevision: WIDGET_CATALOG_REVISION,
    generatedAt: at.toISOString(), timeZone: timeZone || `UTC${-at.getTimezoneOffset()}`,
    validThroughDay: days.at(-1)?.day ?? localDay(at), days };
}
export function selectWidgetDay(value: unknown, now: Date): WidgetDay | undefined {
  const snapshot = value as WidgetSnapshotV1 | undefined;
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.sourceVersion !== 1 || snapshot.catalogRevision !== WIDGET_CATALOG_REVISION || !Array.isArray(snapshot.days)) return;
  const day = localDay(now);
  if (day > snapshot.validThroughDay) return;
  const entry = snapshot.days.find(e => e && typeof e === 'object' && e.day === day);
  if (!entry) return;
  const known = dailyPrimaryScene(builtInScenes, day);
  if (!known || entry.sceneId !== known.id || entry.title !== known.title || entry.artKey !== known.id || entry.deepLink !== widgetLink(day, known.id) || !['confirmed', 'unknown'].includes(entry.collected)) return;
  return entry;
}
export function widgetProps(entry?: WidgetDay): TodayWidgetProps {
  return entry ? { day: entry.day, sceneId: entry.sceneId, title: entry.title,
    // SDK57's gallery snapshot uses these same props, so all visible copy stays public.
    subtitle: '为今天，留一点温柔',
    collected: 'unknown', deepLink: entry.deepLink } : {
    day: '', title: '今日仪式', subtitle: '打开一日一念，看看今天的仪式', collected: 'unknown', deepLink: widgetLink() };
}
/** Calendar arithmetic (not 24h): future entries survive DST boundaries. */
export function widgetTimeline(snapshot: WidgetSnapshotV1, now: Date): Array<{ date: Date; props: TodayWidgetProps }> {
  const timeline = [{ date: now, props: widgetProps(selectWidgetDay(snapshot, now)) }];
  for (const entry of snapshot.days) {
    const date = midnight(entry.day);
    if (date > now) timeline.push({ date, props: widgetProps(entry) });
  }
  if (snapshot.days.length) {
    const expires = midnight(snapshot.validThroughDay);
    expires.setDate(expires.getDate() + 1);
    if (expires > now) timeline.push({ date: expires, props: widgetProps() });
  }
  return timeline;
}
