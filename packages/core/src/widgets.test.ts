import { describe, expect, it } from 'vitest';
import { createState, dailyCollectibleId } from './index';
import { builtInScenes, dailyPrimaryScene } from './daily-scenes';
import { createWidgetSnapshot, parseWidgetLink, selectWidgetDay, widgetLink, widgetTimeline, resolveWidgetScene } from './widgets';

const at = new Date(2026, 9, 11, 12);
const hash = 'a'.repeat(64);
describe('read-only daily widget projection', () => {
  it('shares the exact bundled daily choice and exposes only public metadata', () => {
    const state = createState();
    state.wishes.push({ id: 'private', title: 'SECRET_WISH', intention: 'SECRET_NOTE', status: 'active', archived: false, createdAt: at.toISOString(), notes: [] });
    const snapshot = createWidgetSnapshot(JSON.stringify(state), at, hash);
    expect(snapshot.days).toHaveLength(7);
    for (const day of snapshot.days) {
      expect(day.sceneId).toBe(dailyPrimaryScene(builtInScenes, day.day)!.id);
      expect(day.deepLink).toBe(widgetLink(day.day, day.sceneId));
      expect(day.artKey).toBe(day.sceneId);
    }
    expect(snapshot.validThroughDay).toBe('2026-10-17');
    expect(JSON.stringify(snapshot)).not.toMatch(/SECRET|wishes|ledger|notes/);
    expect(snapshot.days.every(d => d.collected === 'unknown')).toBe(true);
  });
  it('confirms only a persisted current daily collectible, never future completion', () => {
    const state = createState();
    for (const day of ['2026-10-11', '2026-10-12']) {
      const scene = dailyPrimaryScene(builtInScenes, day)!;
      state.collectibles.push({ id: dailyCollectibleId(day, scene.id), kind: 'scene', sceneId: scene.id, title: scene.title, at: at.toISOString() });
    }
    const snapshot = createWidgetSnapshot(JSON.stringify(state), at, hash);
    expect(snapshot.days[0].collected).toBe('confirmed');
    expect(snapshot.days[1].collected).toBe('unknown');
    // The SDK57 gallery reads the first timeline props as a preview.
    expect(widgetTimeline(snapshot, at)[0].props.localePreference).toBe('system');
  });
  it('keeps a corrupt or unsupported main save out of the cache', () => {
    for (const raw of ['{bad', '{"version":999}', '{}']) {
      expect(createWidgetSnapshot(raw, at, hash).days).toEqual([]);
    }
    expect(createWidgetSnapshot(null, at, hash).days).toHaveLength(7);
    expect(createWidgetSnapshot(undefined, at, hash).days).toEqual([]);
  });
  it('has explicit expiry and rejects unknown cache schemas', () => {
    const snapshot = createWidgetSnapshot(null, at, hash);
    expect(selectWidgetDay(snapshot, new Date(2026, 9, 17))?.day).toBe('2026-10-17');
    expect(selectWidgetDay(snapshot, new Date(2026, 9, 18))).toBeUndefined();
    expect(selectWidgetDay({ ...snapshot, schemaVersion: 999 }, at)).toBeUndefined();
    expect(selectWidgetDay({ ...snapshot, days: [{ ...snapshot.days[0], title: 'SECRET' }] }, at)).toBeUndefined();
  });
  it('schedules local calendar midnights, including a generic eighth day', () => {
    const snapshot = createWidgetSnapshot(null, at, hash);
    const timeline = widgetTimeline(snapshot, at);
    expect(timeline).toHaveLength(8);
    expect(timeline[0].date.getTime()).toBe(at.getTime());
    expect(timeline[1].date.getHours()).toBe(0);
    expect(timeline.at(-1)!.props.sceneId).toBeUndefined();
    expect(timeline.at(-1)!.props.deepLink).toBe(widgetLink());
    expect(timeline.at(-1)!.date.getDate()).toBe(18);
  });
  it('rejects malformed cached entries without throwing', () => {
    const snapshot = createWidgetSnapshot(null, at, hash);
    for (const days of [[null], [42], [{ day: '2026-10-11' }]]) {
      expect(selectWidgetDay({ ...snapshot, days }, at)).toBeUndefined();
    }
  });
  it('publishes v2 public IDs with language preference and rejects private fields or unknown copy', () => {
    const state = createState();
    (state.settings as { locale?: string }).locale = 'ja';
    const snapshot = createWidgetSnapshot(JSON.stringify(state), at, hash);
    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.localePreference).toBe('ja');
    expect(snapshot.days[0]).not.toHaveProperty('title');
    expect(selectWidgetDay({ ...snapshot, copyRevision: 'stale' }, at)).toBeUndefined();
    expect(selectWidgetDay({ ...snapshot, notes: 'SECRET' }, at)).toBeUndefined();
    expect(selectWidgetDay({ ...snapshot, localePreference: 'xx' }, at)).toBeUndefined();
    expect(selectWidgetDay({ ...snapshot, days: snapshot.days.map((d, i) => i === 1 ? { ...d, collected: 'confirmed' } : d) }, at)).toBeUndefined();
  });
  it('reads a strictly validated legacy v1 cache without trusting stored titles for display', () => {
    const snapshot = createWidgetSnapshot(null, at, hash);
    const { localePreference: _preference, copyRevision: _copy, ...legacy } = snapshot;
    const old = { ...legacy, schemaVersion: 1, days: snapshot.days.map(day => ({ ...day, title: builtInScenes.find(s => s.id === day.sceneId)!.title })) };
    expect(selectWidgetDay(old, at)?.sceneId).toBe(snapshot.days[0].sceneId);
    expect(selectWidgetDay({ ...old, days: old.days.map((day, i) => i ? day : { ...day, title: 'private' }) }, at)).toBeUndefined();
  });
});
describe('widget links', () => {
  it('validates the scheme, version, actual date and whitelist', () => {
    expect(parseWidgetLink(widgetLink('2026-10-11', 'woodfish'))).toEqual({ day: '2026-10-11', sceneId: 'woodfish' });
    expect(parseWidgetLink(widgetLink())).toEqual({});
    for (const url of ['https://widget/today?v=1', 'cyber-bless://widget/today?v=2', 'cyber-bless://widget/today?v=1&day=2026-02-30&scene=crane', 'cyber-bless://widget/today?v=1&scene=secret', 'cyber-bless://widget/today?v=1&v=1', 'cyber-bless://widget/today?v=1&wish=private']) expect(parseWidgetLink(url)).toBeUndefined();
  });
  it('rechecks today at consumption and sends stale or changed recommendations to Today', () => {
    const today = dailyPrimaryScene(builtInScenes, '2026-10-11')!;
    expect(resolveWidgetScene({}, '2026-10-11', builtInScenes)).toBe(today);
    expect(resolveWidgetScene({ day: '2026-10-10', sceneId: today.id }, '2026-10-11', builtInScenes)).toBeUndefined();
    expect(resolveWidgetScene({ day: '2026-10-11', sceneId: 'unknown' }, '2026-10-11', builtInScenes)).toBeUndefined();
  });
});
