import {describe,it,expect} from 'vitest';
import {builtInScenes,BLESSING_SCENE_IDS,isSceneVisibleInApp,APP_HIDDEN_SCENE_IDS} from './daily-scenes';
import {sceneIntention} from './scene-intentions';
describe('Lunar New Year communal yusheng',()=>{
  it('can be discovered and offered as a sourced communal new-year blessing',()=>{
    const scene=builtInScenes.find(s=>s.id==='yusheng-lohei');
    expect(scene).toBeDefined();
    expect(scene?.traditionSlug).toBe('yusheng-lohei');
    expect(isSceneVisibleInApp(scene!)).toBe(true);
    expect(BLESSING_SCENE_IDS).toContain('yusheng-lohei');
    expect(APP_HIDDEN_SCENE_IDS).toHaveLength(67);
    const intent=sceneIntention('yusheng-lohei');
    expect(intent!.kind).toBe('blessing');expect(intent!.optionalWish).toBe(false);
  });
});
