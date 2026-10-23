import {describe,it,expect} from 'vitest'
import {builtInScenes,BLESSING_SCENE_IDS,isSceneVisibleInApp} from '@wbr/core/daily-scenes'
import {sceneIntention} from '../../../core/src/scene-intentions'
import {sceneRegistry,loadScene} from '../registry'
describe('window cloth blessing identity',()=>{
 it('opens as a visible blessing with its own source and no compulsory writing',()=>{const entry=builtInScenes.find(s=>s.id==='brat-bride-cloth');expect(entry).toMatchObject({title:'窗布祈护',engine:'brat-bride-cloth@1',traditionSlug:'brat-bride-cloth'});expect(isSceneVisibleInApp(entry!)).toBe(true);expect(BLESSING_SCENE_IDS).toContain('brat-bride-cloth');expect(sceneIntention('brat-bride-cloth')).toMatchObject({kind:'blessing',optionalWish:false})})
 it('loads the real module with matching dedicated provenance',async()=>{const loaded=await loadScene('brat-bride-cloth');expect(loaded.meta).toEqual(sceneRegistry.find(s=>s.id==='brat-bride-cloth'));expect(typeof loaded.create).toBe('function')})
})
