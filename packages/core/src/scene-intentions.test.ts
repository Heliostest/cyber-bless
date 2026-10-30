import { describe, expect, it } from 'vitest';
import * as core from './index';
import { BLESSING_SCENE_IDS, WISH_SCENE_IDS, builtInScenes, isSceneVisibleInApp } from './daily-scenes';

describe('in-scene intention cues', () => {
  it('gives every App-visible scene an intention to show while its actions are underway', () => {
    const missing = builtInScenes.filter(isSceneVisibleInApp).filter(entry => {
      const intention = core.sceneIntention?.(entry.id);
      return !intention?.label.trim() || !intention.action.trim();
    }).map(entry => entry.id);

    expect(missing, 'new visible scenes need an action-specific intention cue').toEqual([]);
  });

  it('uses only the same two product categories across the visible catalog and scene cues', () => {
    const wishes = new Set<string>(WISH_SCENE_IDS);
    const blessings = new Set<string>(BLESSING_SCENE_IDS);
    const counts = { wish: 0, blessing: 0 };
    for (const entry of builtInScenes.filter(isSceneVisibleInApp)) {
      const category = wishes.has(entry.id) ? 'wish' : 'blessing';
      expect(blessings.has(entry.id), entry.id).toBe(!wishes.has(entry.id));
      expect(core.sceneIntention(entry.id)?.kind, entry.id).toBe(category);
      counts[category]++;
    }
    expect(counts).toEqual({ wish: 21, blessing: 70 });
  });

  it('groups former gratitude and reflection wish-list entries under blessing', () => {
    for (const id of ['aland-votive-ship', 'italian-ex-voto', 'polish-blessing-basket', 'phuang-malai', 'slavic-wreath']) {
      expect([...WISH_SCENE_IDS], id).not.toContain(id);
      expect([...BLESSING_SCENE_IDS], id).toContain(id);
      expect(core.sceneIntention(id), id).toMatchObject({ kind: 'blessing', optionalWish: false });
    }
  });
});
