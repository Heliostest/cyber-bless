import { describe, expect, it } from 'vitest'
import { builtInScenes, BLESSING_SCENE_IDS, isSceneVisibleInApp } from '../../../core/src/daily-scenes'
import { sceneIntention } from '../../../core/src/scene-intentions'
import { isSceneImplemented, loadScene, sceneRegistry } from '../registry'

describe('Kitano head-stroking prayer integration', () => {
  it('offers a sourced learning prayer in the public blessing catalogue', () => {
    const entry = builtInScenes.find(x => x.id === 'kitano-nadeushi')
    expect(entry).toMatchObject({ title: '抚牛寄愿', engine: 'kitano-nadeushi@1', traditionSlug: 'kitano-nadeushi' })
    expect(isSceneVisibleInApp({ id: 'kitano-nadeushi' })).toBe(true)
    expect([...BLESSING_SCENE_IDS]).toContain('kitano-nadeushi')
    expect(sceneIntention('kitano-nadeushi')).toMatchObject({ kind: 'blessing', optionalWish: false })
  })
  it('loads the same source identity as the registry without changing existing engines', async () => {
    expect(isSceneImplemented('kitano-nadeushi')).toBe(true)
    const module = await loadScene('kitano-nadeushi')
    expect(module.meta).toEqual(sceneRegistry.find(x => x.id === 'kitano-nadeushi'))
  })
})
