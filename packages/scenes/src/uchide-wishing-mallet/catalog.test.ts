import {describe,it,expect} from 'vitest'
import {builtInScenes,BLESSING_SCENE_IDS,isSceneVisibleInApp} from '@wbr/core/daily-scenes'
import {sceneIntention} from '../../../core/src/scene-intentions'
import {sceneRegistry,loadScene} from '../registry'
describe('Uchide wish-shaking identity',()=>{
 it('opens as a visible blessing with its own source and no compulsory writing',()=>{const entry=builtInScenes.find(s=>s.id==='uchide-wishing-mallet');expect(entry).toMatchObject({title:'振槌寄愿',engine:'uchide-wishing-mallet@1',traditionSlug:'uchide-wishing-mallet'});expect(isSceneVisibleInApp(entry!)).toBe(true);expect(BLESSING_SCENE_IDS).toContain('uchide-wishing-mallet');expect(sceneIntention('uchide-wishing-mallet')).toMatchObject({kind:'blessing',optionalWish:false})})
 it('loads the real module with matching dedicated provenance',async()=>{const loaded=await loadScene('uchide-wishing-mallet');expect(loaded.meta).toEqual(sceneRegistry.find(s=>s.id==='uchide-wishing-mallet'));expect(typeof loaded.create).toBe('function')})
})
