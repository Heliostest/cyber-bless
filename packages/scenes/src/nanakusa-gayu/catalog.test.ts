import {describe,it,expect}from'vitest'
import {builtInScenes,BLESSING_SCENE_IDS,isSceneVisibleInApp}from'../../../core/src/daily-scenes'
import {sceneIntention}from'../../../core/src/scene-intentions'
import {sceneNarratives}from'../../../core/src/scene-narratives'
import {isSceneImplemented,loadScene,sceneRegistry}from'../registry'
describe('nanakusa seasonal health prayer',()=>{
 it('places the sourced seasonal porridge in the blessing pool',()=>{
  expect(builtInScenes.find(x=>x.id==='nanakusa-gayu')).toMatchObject({title:'七草祈安',engine:'nanakusa-gayu@1',traditionSlug:'nanakusa-gayu'})
  expect([...BLESSING_SCENE_IDS]).toContain('nanakusa-gayu');expect(isSceneVisibleInApp({id:'nanakusa-gayu'})).toBe(true)
  expect(sceneIntention('nanakusa-gayu')).toMatchObject({kind:'blessing',optionalWish:false})
  expect(sceneNarratives['nanakusa-gayu']).toContain('1月7日');expect(sceneNarratives['nanakusa-gayu']).toContain('无病息灾')
  expect(sceneNarratives['nanakusa-gayu']).not.toMatch(/Alasita|Ekeko|蜂蜜|鱼生|卧牛|巧克力/)
 })
 it('loads matching module and registry metadata',async()=>{
  expect(isSceneImplemented('nanakusa-gayu')).toBe(true)
  expect((await loadScene('nanakusa-gayu')).meta).toEqual(sceneRegistry.find(x=>x.id==='nanakusa-gayu'))
 })
})
