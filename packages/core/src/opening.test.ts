import { describe, expect, it } from 'vitest';
import { createState, reduce, restore, openingCollectibleId, chooseOpeningScenes, openingExclusions, type State } from './index';
import { BLESSING_SCENE_IDS, WISH_SCENE_IDS, builtInScenes, dailyPrimaryScene } from './daily-scenes';
import { createWidgetSnapshot, selectWidgetDay, resolveWidgetScene } from './widgets';

const at = '2026-10-18T10:00:00.000Z';
const day = '2026-10-19';
const primary = dailyPrimaryScene(builtInScenes, day)!;
const blessings = BLESSING_SCENE_IDS.includes(primary.id as never)
  ? [primary.id, ...BLESSING_SCENE_IDS.filter(id => id !== primary.id)]
  : [...BLESSING_SCENE_IDS];
const scenes: [string, string, string] = [blessings[0], blessings[1],
  WISH_SCENE_IDS.includes(primary.id as never) ? primary.id : WISH_SCENE_IDS[0]];

function walk(s: State, id: string) {
  s = reduce(s, { type: 'scene.visit', entry: builtInScenes.find(e => e.id === id)!, at });
  return reduce(s, { type: 'scene.progress', id, progress: id === 'woodfish' ? 12 : 3 });
}
function completed() {
  let s = reduce(restore(null), { type: 'opening.start', sceneIds: scenes });
  for (const sceneId of scenes) s = reduce(walk(s, sceneId), { type: 'opening.collect', sceneId, at });
  return reduce(s, { type: 'opening.finish', day, at });
}

describe('first-play opening', () => {
  it('starts only when there is no save, preserving legacy saves and settings', () => {
    expect(restore(null, { sound: false }).opening).toEqual({ status: 'new' });
    expect(restore(null, { sound: false }).settings.sound).toBe(false);
    expect(restore(JSON.stringify(createState())).opening).toBeUndefined();
  });

  it('randomly chooses two different blessing scenes followed by one wish scene', () => {
    const first = chooseOpeningScenes(builtInScenes, () => 0);
    expect(new Set(first).size).toBe(3);
    expect(first.slice(0, 2).every(id => BLESSING_SCENE_IDS.includes(id as never))).toBe(true);
    expect(WISH_SCENE_IDS).toContain(first[2]);
    expect(chooseOpeningScenes(builtInScenes, () => 0.9)).not.toEqual(first);
    expect(() => chooseOpeningScenes([], () => 0)).toThrow();
  });

  it('requires actual play in order, resumes and grants each keepsake only once', () => {
    let s = reduce(restore(null), { type: 'opening.start', sceneIds: scenes });
    expect(reduce(s, { type: 'opening.start', sceneIds: chooseOpeningScenes(builtInScenes) })).toBe(s);
    expect(() => reduce(s, { type: 'opening.collect', sceneId: scenes[0], at })).toThrow();
    expect(() => reduce(s, { type: 'opening.collect', sceneId: scenes[1], at })).toThrow();
    expect(() => reduce(s, { type: 'opening.finish', day, at })).toThrow();
    s = reduce(walk(s, scenes[0]), { type: 'opening.collect', sceneId: scenes[0], at });
    expect(s.opening).toMatchObject({ status: 'active', completed: 1 });
    expect(s.collectibles[0]).toMatchObject({ id: openingCollectibleId(scenes[0]), sceneId: scenes[0], wishScene: false });
    expect(s.ledger).toEqual([]);
    expect(reduce(s, { type: 'opening.collect', sceneId: scenes[0], at })).toBe(s);
    expect(restore(JSON.stringify(s))).toEqual(s);
    expect(completed().collectibles).toHaveLength(3);
    expect(completed().wishes).toHaveLength(0);
  });

  it('excludes all three on the completion day, including a finish after midnight, and keeps widgets consistent', () => {
    const s = completed();
    const exclusions = openingExclusions(s.opening, day);
    expect(exclusions).toEqual(scenes);
    const next = dailyPrimaryScene(builtInScenes, day, exclusions)!;
    expect(scenes).not.toContain(next.id);
    expect(openingExclusions(s.opening, '2026-10-20')).toEqual([]);
    const clock = new Date(`${day}T12:00:00`);
    const snapshot = createWidgetSnapshot(JSON.stringify(s), clock, 'opening-test');
    expect(selectWidgetDay(snapshot, clock)?.sceneId).toBe(next.id);
    expect(resolveWidgetScene({ day, sceneId: next.id }, day, builtInScenes, exclusions)?.id).toBe(next.id);
  });

  it('rejects malformed queues and inconsistent progress without losing legacy data', () => {
    expect(() => reduce(restore(null), { type: 'opening.start', sceneIds: [scenes[0], scenes[0], scenes[2]] })).toThrow();
    const s = completed();
    expect(() => restore(JSON.stringify({ ...s, collectibles: [] }))).toThrow();
    expect(() => restore(JSON.stringify({ ...s, opening: { ...s.opening, sceneIds: ['bad', ...scenes.slice(1)] } }))).toThrow();
  });
});
