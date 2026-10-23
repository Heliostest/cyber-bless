import {describe,it,expect} from 'vitest'
import {builtInScenes,BLESSING_SCENE_IDS,isSceneVisibleInApp} from '@wbr/core/daily-scenes'
import {sceneIntention} from '../../../core/src/scene-intentions'
import {sceneRegistry,loadScene} from '../registry'
describe('Pucara household blessing identity',()=>{
 it('opens as a visible blessing with its own source and no compulsory writing',()=>{const entry=builtInScenes.find(s=>s.id==='pucara-rooftop-bulls');expect(entry).toMatchObject({title:'陶牛护家',engine:'pucara-rooftop-bulls@1',traditionSlug:'pucara-rooftop-bulls'});expect(isSceneVisibleInApp(entry!)).toBe(true);expect(BLESSING_SCENE_IDS).toContain('pucara-rooftop-bulls');expect(sceneIntention('pucara-rooftop-bulls')).toMatchObject({kind:'blessing',optionalWish:false})})
 it('loads the real module with matching dedicated provenance',async()=>{const loaded=await loadScene('pucara-rooftop-bulls');expect(loaded.meta).toEqual(sceneRegistry.find(s=>s.id==='pucara-rooftop-bulls'));expect(typeof loaded.create).toBe('function')})
})
