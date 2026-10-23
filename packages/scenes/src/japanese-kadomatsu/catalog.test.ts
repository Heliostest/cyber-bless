import {describe,it,expect} from 'vitest'
import {builtInScenes,BLESSING_SCENE_IDS,isSceneVisibleInApp} from '@wbr/core/daily-scenes'
import {sceneIntention} from '../../../core/src/scene-intentions'
import {sceneRegistry,loadScene} from '../registry'
describe('kadomatsu welcome blessing identity',()=>{
 it('opens as a visible blessing with its own source and no compulsory writing',()=>{const entry=builtInScenes.find(s=>s.id==='japanese-kadomatsu');expect(entry).toMatchObject({title:'门松迎岁',engine:'japanese-kadomatsu@1',traditionSlug:'japanese-kadomatsu'});expect(isSceneVisibleInApp(entry!)).toBe(true);expect(BLESSING_SCENE_IDS).toContain('japanese-kadomatsu');expect(sceneIntention('japanese-kadomatsu')).toMatchObject({kind:'blessing',optionalWish:false})})
 it('loads the real module with matching dedicated provenance',async()=>{const loaded=await loadScene('japanese-kadomatsu');expect(loaded.meta).toEqual(sceneRegistry.find(s=>s.id==='japanese-kadomatsu'));expect(typeof loaded.create).toBe('function')})
})
