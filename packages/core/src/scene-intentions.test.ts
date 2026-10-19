import { describe, expect, it } from 'vitest';
import * as core from './index';
import { builtInScenes, isSceneVisibleInApp } from './daily-scenes';

describe('in-scene intention cues', () => {
  it('gives every App-visible scene an intention to show while its actions are underway', () => {
    const missing = builtInScenes.filter(isSceneVisibleInApp).filter(entry => {
      const intention = core.sceneIntention?.(entry.id);
      return !intention?.label.trim() || !intention.action.trim();
    }).map(entry => entry.id);

    expect(missing, 'new visible scenes need an action-specific intention cue').toEqual([]);
  });
});
