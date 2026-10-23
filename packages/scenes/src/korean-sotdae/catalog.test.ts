import {describe,it,expect} from 'vitest'
import {builtInScenes,BLESSING_SCENE_IDS,isSceneVisibleInApp} from '@wbr/core/daily-scenes'
import {sceneIntention} from '../../../core/src/scene-intentions'
import {sceneRegistry,loadScene} from '../registry'
describe('sotdae village blessing identity',()=>{
 it('opens as a visible blessing with its own source and no compulsory writing',()=>{const entry=builtInScenes.find(s=>s.id==='korean-sotdae');expect(entry).toMatchObject({title:'鸟竿祈安',engine:'korean-sotdae@1',traditionSlug:'korean-sotdae'});expect(isSceneVisibleInApp(entry!)).toBe(true);expect(BLESSING_SCENE_IDS).toContain('korean-sotdae');expect(sceneIntention('korean-sotdae')).toMatchObject({kind:'blessing',optionalWish:false})})
 it('loads the real module with matching dedicated provenance',async()=>{const loaded=await loadScene('korean-sotdae');expect(loaded.meta).toEqual(sceneRegistry.find(s=>s.id==='korean-sotdae'));expect(typeof loaded.create).toBe('function')})
})
