import {describe,it,expect} from 'vitest'
import {builtInScenes,BLESSING_SCENE_IDS,isSceneVisibleInApp} from '../../../core/src/daily-scenes'
import {sceneIntention} from '../../../core/src/scene-intentions'
import {sceneNarratives} from '../../../core/src/scene-narratives'
import {loadScene,isSceneImplemented,sceneRegistry} from '../registry'
describe('contemporary Espoo willow blessing visit',()=>{
  it('offers the branch and neighbour blessing as one sourced practice',()=>{
    const entry=builtInScenes.find(x=>x.id==='finnish-virpominen')
    expect(entry).toMatchObject({title:'柳枝祝春',engine:'finnish-virpominen@1',traditionSlug:'finnish-virpominen'})
    expect([...BLESSING_SCENE_IDS]).toContain('finnish-virpominen');expect(isSceneVisibleInApp({id:'finnish-virpominen'})).toBe(true)
    expect(sceneIntention('finnish-virpominen')).toMatchObject({kind:'blessing',optionalWish:false})
    expect(sceneNarratives['finnish-virpominen']).toContain('埃斯波')
    expect(sceneNarratives['finnish-virpominen']).toContain('猫柳枝')
    expect(sceneNarratives['finnish-virpominen']).toContain('巧克力蛋')
    expect(sceneNarratives['finnish-virpominen']).not.toMatch(/北野|卧牛|学业/)
  })
  it('loads matching registry and module identities',async()=>{
    expect(isSceneImplemented('finnish-virpominen')).toBe(true)
    expect((await loadScene('finnish-virpominen')).meta).toEqual(sceneRegistry.find(x=>x.id==='finnish-virpominen'))
  })
})
