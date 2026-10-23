import {describe,it,expect} from 'vitest'
import {builtInScenes,BLESSING_SCENE_IDS,isSceneVisibleInApp} from '@wbr/core/daily-scenes'
import {sceneIntention} from '../../../core/src/scene-intentions'
import {sceneRegistry,loadScene} from '../registry'
describe('Longevity lock blessing identity',()=>{
 it('opens as a visible blessing with its own source and no compulsory writing',()=>{const entry=builtInScenes.find(s=>s.id==='chinese-longevity-lock');expect(entry).toMatchObject({title:'银锁寄安',engine:'chinese-longevity-lock@1',traditionSlug:'chinese-longevity-lock'});expect(isSceneVisibleInApp(entry!)).toBe(true);expect(BLESSING_SCENE_IDS).toContain('chinese-longevity-lock');expect(sceneIntention('chinese-longevity-lock')).toMatchObject({kind:'blessing',optionalWish:false})})
 it('loads the real module with matching dedicated provenance',async()=>{const loaded=await loadScene('chinese-longevity-lock');expect(loaded.meta).toEqual(sceneRegistry.find(s=>s.id==='chinese-longevity-lock'));expect(typeof loaded.create).toBe('function')})
})
