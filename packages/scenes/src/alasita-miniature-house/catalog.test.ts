import {describe,it,expect} from 'vitest'
import {builtInScenes,WISH_SCENE_IDS,isSceneVisibleInApp} from '../../../core/src/daily-scenes'
import {sceneIntention} from '../../../core/src/scene-intentions'
import {sceneNarratives} from '../../../core/src/scene-narratives'
import {loadScene,isSceneImplemented,sceneRegistry} from '../registry'

describe('Alasita miniature wish house',()=>{
 it('offers an existing miniature house as a sourced wish object',()=>{
  expect(builtInScenes.find(x=>x.id==='alasita-miniature-house')).toMatchObject({title:'微屋寄愿',engine:'alasita-miniature-house@1',traditionSlug:'aymara'})
  expect([...WISH_SCENE_IDS]).toContain('alasita-miniature-house')
  expect(isSceneVisibleInApp({id:'alasita-miniature-house'})).toBe(true)
  expect(sceneIntention('alasita-miniature-house')).toMatchObject({kind:'wish',optionalWish:false})
  expect(sceneNarratives['alasita-miniature-house']).toContain('Alasita')
  expect(sceneNarratives['alasita-miniature-house']).toContain('Ekeko')
  expect(sceneNarratives['alasita-miniature-house']).toContain('微型房屋')
  expect(sceneNarratives['alasita-miniature-house']).not.toMatch(/北野|卧牛|猫柳|巧克力蛋|鱼生/)
 })
 it('loads matching host and module identities',async()=>{
  expect(isSceneImplemented('alasita-miniature-house')).toBe(true)
  expect((await loadScene('alasita-miniature-house')).meta).toEqual(sceneRegistry.find(x=>x.id==='alasita-miniature-house'))
 })
})
